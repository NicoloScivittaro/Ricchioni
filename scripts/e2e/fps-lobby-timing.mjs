// FPS -> cambio vista sul telefono: quanto passa dal cambio di fase dell'host alla nuova vista SUL TELEFONO che sta eseguendo la Sparatoria.
// Misura separatamente (stesso orologio Date.now, host e telefoni sono sulla stessa macchina):
//   host: cambio fase | telefono: arrivo roomState | render() (vista montata) | canvas 3D rimosso | stop loop / vm / scene / engine dispose
//   MODE=lobby  (TORNA ALLA LOBBY -> scelta personaggio)     MODE=finish  (fine gioco -> "ROUND TERMINATO")     RUNS=3
//   node scripts/e2e/fps-lobby-timing.mjs
import { launch, createRoomOnHost, hostEval, hostSnapshot, sleep, CTRL_URL } from './lib.mjs';

const MODE = process.env.MODE ?? 'lobby';
const RUNS = Number(process.env.RUNS ?? 3);
const GAME = process.env.GAME ?? 'fps'; // GAME=quiz: controllo senza motore 3D sul telefono
const results = [];
let browser = await launch();
async function joinPhone(code, name, charIndex) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 390, height: 800, isMobile: true, hasTouch: true });
  await page.goto(`${CTRL_URL}?room=${code}&debug=1`, { waitUntil: 'load' });
  await page.waitForSelector('#name', { timeout: 15000 });
  await page.type('#name', name);
  await page.click('#go');
  await page.waitForSelector('#chars .char', { timeout: 15000 });
  const btns = await page.$$('#chars .char');
  await btns[charIndex].click();
  await page.waitForFunction(() => document.querySelector('#chars .char.mine') && !document.querySelector('#ready')?.disabled, { timeout: 10000 });
  await page.click('#ready');
  await page.waitForFunction(() => /PRONTO ✅/.test(document.getElementById('ready')?.textContent ?? ''), { timeout: 10000 });
  return { page, ctx };
}
try {
  for (let run = 1; run <= RUNS; run++) {
    if (run > 1) {
      await browser.close().catch(() => {});
      browser = await launch(); // un browser pulito per ogni misura
    }
    const { page: host, code } = await createRoomOnHost(browser);
    const phones = [await joinPhone(code, 'P1', 0), await joinPhone(code, 'P2', 1)];
    await hostEval(host, (gm, id) => gm.selectMinigame(id), GAME);
    await sleep(300);
    await host.keyboard.press('Enter');
    for (let i = 0; i < 300 && (await hostSnapshot(host)).phase !== 'MINIGAME_PLAYING'; i++) await sleep(150);
    // il telefono deve avere il motore 3D attivo
    let has3d = GAME !== 'fps';
    for (let i = 0; i < 100 && !has3d; i++) {
      has3d = await phones[0].page.evaluate(() => !!document.querySelector('#fps-canvas'));
      if (!has3d) await sleep(200);
    }
    await sleep(4000); // il 3D gira: e' lo stato piu' pesante da smontare
    const p = phones[0].page;
    await p.evaluate(() => {
      window.__mark = { lobbyAt: null, endedAt: null, canvasGoneAt: null };
      new MutationObserver(() => {
        const now = Date.now();
        if (!window.__mark.lobbyAt && document.querySelector('#chars .char')) window.__mark.lobbyAt = now;
        const h1 = document.getElementById('app')?.querySelector('h1')?.textContent?.trim();
        if (!window.__mark.endedAt && h1 === 'ROUND TERMINATO') window.__mark.endedAt = now;
        if (!window.__mark.canvasGoneAt && !document.querySelector('#fps-canvas')) window.__mark.canvasGoneAt = now;
      }).observe(document.body, { childList: true, subtree: true });
      window.__phaseTiming.length = 0;
    });
    if (process.env.TRACE) await p.tracing.start({ categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'v8', 'blink', 'gpu'] });
    const Th = await hostEval(host, (gm, mode) => {
      const t = Date.now();
      if (mode === 'lobby') gm.restartMatch();
      else {
        const ctx = gm.minigameContext;
        ctx.finish({ results: ctx.players.map((pl, i) => ({ playerId: pl.id, placement: i + 1, score: 5 - i })) });
      }
      return t;
    }, MODE);
    const key = MODE === 'lobby' ? 'lobbyAt' : 'endedAt';
    let mark = null;
    for (let i = 0; i < 300; i++) {
      await sleep(100);
      mark = await p.evaluate(() => window.__mark);
      if (mark[key]) break;
    }
    await sleep(1500); // lascia finire lo smontaggio
    if (process.env.TRACE) {
      const buf = await p.tracing.stop();
      const ev = JSON.parse(Buffer.from(buf).toString()).traceEvents;
      const long = ev.filter((e) => e.ph === 'X' && e.dur > 250000 && /RunTask|ThreadControllerImpl/.test(e.name));
      const urlOf = {};
      for (const e of ev) {
        const u = e.args?.data?.url ?? e.args?.data?.documentLoaderURL;
        if (u && /localhost|5173/.test(u) && !urlOf[e.pid + ':' + e.tid]) urlOf[e.pid + ':' + e.tid] = u;
      }
      const t0ev = Math.min(...ev.filter((e) => e.ts > 0).map((e) => e.ts));
      for (const L of long) {
        console.log('  pagina:', urlOf[L.pid + ':' + L.tid] ?? '(?) pid ' + L.pid, ' inizio(ms dall inizio traccia)=', Math.round((L.ts - t0ev) / 1000));
        const kids = ev.filter((e) => e.ph === 'X' && e.tid === L.tid && e.pid === L.pid && e.ts >= L.ts && e.ts + e.dur <= L.ts + L.dur && e !== L && e.dur > 20000).sort((a, b) => b.dur - a.dur).slice(0, 8);
        console.log(`  TASK ${L.name} tid=${L.tid} dur=${Math.round(L.dur / 1000)}ms  figli: ` + kids.map((k) => `${k.name}:${Math.round(k.dur / 1000)}${k.args?.data?.functionName ? '(' + k.args.data.functionName + ')' : ''}`).join(' | '));
      }
    }
    // istante in cui il SERVER ha cambiato fase (traccia dev: server avviato con FLOW_TRACE=1)
    let tSrv = null;
    try {
      const tr = await (await fetch('http://localhost:3001/debug/trace/' + code)).json();
      const want = MODE === 'lobby' ? '-> LOBBY' : '-> MINIGAME_FINISHED';
      tSrv = tr.filter((e) => e.kind === 'phase' && String(e.note).endsWith(want)).pop()?.t ?? null;
    } catch {
      /* server senza FLOW_TRACE */
    }
    const timing = await p.evaluate(() => ({ phases: window.__phaseTiming, longTasks: window.__longTasks }));
    const recv = timing.phases.find((e) => e.kind === 'roomState' && (MODE === 'lobby' ? e.phase === 'LOBBY' : e.phase === 'MINIGAME_FINISHED'));
    const disp = timing.phases.find((e) => e.kind === 'fpsDispose');
    const r = {
      run,
      'host->server': tSrv ? tSrv - Th : null,
      'server->telefono (arrivo)': tSrv && recv ? recv.recvAt - tSrv : null,
      'host->recv': recv ? recv.recvAt - Th : null,
      'recv->vista montata (render)': recv ? recv.renderMs : null,
      'host->vista visibile': mark[key] ? mark[key] - Th : null,
      'host->canvas 3D rimosso': mark.canvasGoneAt ? mark.canvasGoneAt - Th : null,
      'dispose (stop/vm/scene/engine ms)': disp ? `${disp.totalMs} = ${JSON.stringify(disp.parts)}` : null,
      'long task (inizio dopo l arrivo del roomState : durata ms)': timing.longTasks.filter((t) => t.at >= Th - 200 && t.at < Th + 3000).map((t) => `${recv ? t.at - recv.recvAt : t.at - Th}:${t.dur}`).join(' ') || 'nessuno'
    };
    results.push(r);
    console.log(JSON.stringify(r));
    for (const ph of phones) await ph.ctx.close().catch(() => {});
    await host.close().catch(() => {});
  }
  const shown = results.map((r) => r['host->vista visibile']).filter((x) => x !== null);
  console.log(`\nMODE=${MODE}: vista nuova visibile dopo ${shown.join(' / ')} ms dal cambio di fase dell'host (media ${Math.round(shown.reduce((a, b) => a + b, 0) / Math.max(1, shown.length))} ms)`);
  process.exitCode = shown.length === RUNS ? 0 : 1;
} catch (e) {
  console.error('ERRORE', e);
  process.exitCode = 2;
} finally {
  await browser.close();
}
