// BOTTE SUL CORNICIONE — SESSIONE e PULIZIA: fighter -> risultati -> rullo -> fighter ... -> menu ESC -> lobby, senza refresh.
// Dopo OGNI round, col gioco gia' smontato: nessun canvas/overlay/timer/oscillatore/listener in piu', nessuna maniglia di debug,
// AbilityHub vuoto (nessuno stato di abilita' sopravvive), heap stabile (nessuna hitbox/camera/mesh residua), host e telefoni al flusso.
//   ROUNDS=4 node scripts/e2e/fighter-session.mjs
import { launch, addPhone, hostEval, hostSnapshot, sleep } from './lib.mjs';
import { makeCheck, until, finishNow } from './padmock.mjs';

const ROUNDS = Number(process.env.ROUNDS ?? 4);
const { st, check } = makeCheck();

/** Strumentazione installata PRIMA degli script della pagina: timer pendenti e oscillatori audio vivi. */
const INSTRUMENT = () => {
  const w = window;
  w.__timers = new Set();
  const st0 = w.setTimeout.bind(w);
  const ct = w.clearTimeout.bind(w);
  const si = w.setInterval.bind(w);
  const ci = w.clearInterval.bind(w);
  w.setTimeout = (fn, ms, ...a) => {
    const id = st0((...x) => {
      w.__timers.delete(id);
      return typeof fn === 'function' ? fn(...x) : undefined;
    }, ms, ...a);
    w.__timers.add(id);
    return id;
  };
  w.clearTimeout = (id) => {
    w.__timers.delete(id);
    return ct(id);
  };
  w.setInterval = (fn, ms, ...a) => {
    const id = si(fn, ms, ...a);
    w.__timers.add(id);
    return id;
  };
  w.clearInterval = (id) => {
    w.__timers.delete(id);
    return ci(id);
  };
  w.__osc = 0;
  const AC = w.AudioContext || w.webkitAudioContext;
  if (AC) {
    const orig = AC.prototype.createOscillator;
    AC.prototype.createOscillator = function () {
      const o = orig.call(this);
      w.__osc++;
      o.addEventListener('ended', () => w.__osc--);
      return o;
    };
  }
};

const METRICS = () => ({
  canvases: document.querySelectorAll('canvas').length,
  overlays3d: [...document.querySelectorAll('canvas')].filter((c) => c.style.zIndex === '10000').length,
  domOverlays: [...document.body.children].filter((el) => el.tagName === 'DIV' && /z-index:\s*(20001|30000)/.test(el.getAttribute('style') ?? '')).length,
  timers: window.__timers?.size ?? -1,
  osc: (window.__osc ?? -1) - (window.__musicOsc ?? 0)
});

async function heapMB(page) {
  const cdp = await page.createCDPSession();
  await cdp.send('HeapProfiler.enable');
  await cdp.send('HeapProfiler.collectGarbage');
  await sleep(200);
  await cdp.send('HeapProfiler.collectGarbage');
  const { usedSize } = await cdp.send('Runtime.getHeapUsage');
  await cdp.detach();
  return usedSize / 1048576;
}

async function windowListeners(page) {
  const cdp = await page.createCDPSession();
  const { result } = await cdp.send('Runtime.evaluate', { expression: 'window' });
  const { listeners } = await cdp.send('DOMDebugger.getEventListeners', { objectId: result.objectId });
  const byType = {};
  for (const l of listeners) byType[l.type] = (byType[l.type] ?? 0) + 1;
  await cdp.detach();
  return byType;
}

const browser = await launch();
const errs = [];
try {
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(INSTRUMENT);
  page.on('pageerror', (e) => errs.push('HOST ' + String(e).slice(0, 200)));
  page.on('dialog', (d) => void d.accept());
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') console.log('CONSOLE', m.type(), m.text().slice(0, 300));
  });
  page.on('requestfailed', (r) => console.log('REQFAIL', r.url().slice(0, 160), r.failure()?.errorText));
  await page.goto(process.env.HOST_URL ?? 'http://localhost:5173/', { waitUntil: 'load' });
  await page.waitForFunction(
    async () => {
      try {
        const url = performance.getEntriesByType('resource').map((e) => e.name).find((n) => /GameManager\.ts/.test(n));
        const { game: gm } = await import(url);
        return !!gm.game && gm.game.scene.getScenes(true).some((s) => s.scene.key === 'LobbyScene');
      } catch {
        return false;
      }
    },
    { timeout: 40000 }
  );
  await sleep(300);
  await page.keyboard.press('ArrowRight');
  await sleep(150);
  await page.keyboard.press('ArrowRight'); // 4 giocatori
  await sleep(150);
  await page.keyboard.press('Enter');
  await page.waitForFunction(
    async () => {
      const url = performance.getEntriesByType('resource').map((e) => e.name).find((n) => /GameManager\.ts/.test(n));
      const { game: gm } = await import(url);
      return !!gm.roomCode && gm.game.scene.getScenes(true).some((s) => s.scene.key === 'RoomScene');
    },
    { timeout: 20000 }
  );
  const code = await hostEval(page, (gm) => gm.roomCode);
  const phones = [];
  for (let i = 0; i < 4; i++) phones.push(await addPhone(browser, code, `P${i + 1}`, i));
  for (const p of phones) await p.page.evaluate(INSTRUMENT).catch(() => {});
  const pids = await hostEval(page, (gm) => gm.state.players.map((p) => p.id));
  check(pids.length === 4, '4 giocatori in stanza');

  /** Porta l'host a MINIGAME_PLAYING del Cornicione saltando le fasi cosmetiche. */
  const startCornicione = async () => {
    let guard = 0;
    for (;;) {
      const s = await hostSnapshot(page);
      if (s.phase === 'MINIGAME_PLAYING') {
        if (s.pending === 'cornicione') return;
        await finishNow(page); // il rullo ha scelto altro: lo chiudiamo
      } else if (s.phase === 'GAME_FINISHED') {
        await hostEval(page, (gm) => gm.restartMatch());
        await sleep(1500);
        for (const p of phones) await p.page.click('#ready').catch(() => {});
        await sleep(600);
        await page.keyboard.press('Enter');
      } else if (s.phase === 'LOBBY') {
        await hostEval(page, (gm) => gm.selectMinigame('cornicione'));
        await sleep(300);
        await page.keyboard.press('Enter');
      } else if (s.phase === 'MINIGAME_ROULETTE' || s.phase === 'ROUND_RESULTS' || s.phase === 'MINIGAME_INTRO') {
        await hostEval(page, (gm) => gm.selectMinigame('cornicione'));
        await sleep(300);
        await hostEval(page, (gm) => gm.skip());
      } else await hostEval(page, (gm) => gm.skip());
      await sleep(500);
      if (++guard > 150) throw new Error('PLAYING non raggiunto, fase ' + s.phase);
    }
  };

  await sleep(500);
  const rows = [];
  for (let r = 1; r <= ROUNDS; r++) {
    await startCornicione();
    await until(async () => (await page.evaluate(() => window.__fighter?.phase)) === 'playing', 90000, 'via del cornicione');
    await page.evaluate((ids) => ids.forEach((id) => window.__fighter.setBot(id, true)), pids);
    await sleep(5000);
    const live = await page.evaluate(() => ({ t: window.__fighter.sim.time, hub: window.__abilityHub.rows().length }));
    check(live.t > 1 && live.hub === 4, `R${r}: il gioco gira (${live.t.toFixed(1)} s) e AbilityHub ha 4 righe`);
    await finishNow(page);
    let guard = 0;
    while ((await hostSnapshot(page)).phase !== 'MINIGAME_ROULETTE') {
      if ((await hostSnapshot(page)).phase === 'GAME_FINISHED') break;
      await hostEval(page, (gm) => gm.skip());
      await sleep(450);
      if (++guard > 80) throw new Error('rullo non raggiunto');
    }
    await sleep(1500);
    const m = await page.evaluate(METRICS);
    const clean = await page.evaluate(() => ({ lab: !!window.__fighter, hub: window.__abilityHub.rows().length }));
    const heap = await heapMB(page);
    const lst = await windowListeners(page);
    rows.push({ r, m, heap, lst });
    console.log(`R${r}: canvas ${m.canvases} overlay3d ${m.overlays3d} timer ${m.timers} osc ${m.osc} heap ${heap.toFixed(1)} MB · maniglia debug ${clean.lab ? 'SI' : 'no'} · hub ${clean.hub}`);
    check(!clean.lab && clean.hub === 0, `R${r}: maniglia di debug rimossa e AbilityHub vuoto`);
    check(m.overlays3d === 0 && m.domOverlays === 0, `R${r}: nessun overlay 3D / menu rimasto`);
  }
  const first = rows[0];
  const last = rows[rows.length - 1];
  check(last.m.canvases <= first.m.canvases, `canvas stabili (${first.m.canvases} -> ${last.m.canvases})`);
  check(last.m.timers <= first.m.timers + 2, `timer stabili (${first.m.timers} -> ${last.m.timers})`);
  check(last.m.osc <= first.m.osc + 1, `oscillatori audio stabili (${first.m.osc} -> ${last.m.osc})`);
  check(last.heap < first.heap + 25, `heap stabile dopo ${rows.length} round (${first.heap.toFixed(1)} -> ${last.heap.toFixed(1)} MB)`);
  for (const t of Object.keys(last.lst)) check((last.lst[t] ?? 0) <= (first.lst[t] ?? 0) + 1, `listener window "${t}" stabili (${first.lst[t] ?? 0} -> ${last.lst[t]})`);

  // menu ESC -> TORNA ALLA LOBBY
  await startCornicione();
  try {
    await until(async () => await page.evaluate(() => !!window.__fighter), 60000, 'cornicione per il menu');
  } catch (e) {
    console.log('SCENE', JSON.stringify(await hostEval(page, (gm) => { const sc = gm.game.scene.getScene('cornicione'); return sc ? { cancelled: sc.cancelled, g3: !!sc.game3d, active: sc.sys.isActive(), canvas: !!sc.overlayCanvas, loading: !!sc.hideLoading } : null; })));
    console.log('SNAP', JSON.stringify(await hostSnapshot(page)), 'ERRS', JSON.stringify(errs), 'DOM', await page.evaluate(() => [...document.body.children].map((e) => e.tagName + (e.id ? '#' + e.id : '') + ':' + (e.innerText ?? '').slice(0, 60)).join(' | ')));
    throw e;
  }
  await sleep(1500);
  await page.keyboard.press('Escape');
  await sleep(700);
  const clicked = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /TORNA ALLA LOBBY/.test(x.textContent ?? ''));
    b?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 9 }));
    return !!b;
  });
  check(clicked, 'menu ESC: bottone TORNA ALLA LOBBY presente');
  let snap2;
  for (let i = 0; i < 60; i++) {
    snap2 = await hostSnapshot(page);
    if (snap2.phase === 'LOBBY' && snap2.active[0] === 'RoomScene') break;
    await sleep(200);
  }
  await sleep(800);
  snap2 = await hostSnapshot(page);
  check(snap2.phase === 'LOBBY' && snap2.active.length === 1 && snap2.active[0] === 'RoomScene', `lobby: host in RoomScene pulita (${snap2.phase} ${JSON.stringify(snap2.active)})`);
  const after = await page.evaluate(() => ({ lab: !!window.__fighter, hub: window.__abilityHub.rows().length }));
  check(!after.lab && after.hub === 0, 'lobby: nessuno stato del gioco rimasto');
  check(errs.length === 0, `nessun errore di pagina ${errs.join(' | ')}`);
} catch (e) {
  console.log('ERRORE', e);
  st.fails++;
} finally {
  await browser.close();
}
console.log(st.fails ? `❌ ${st.fails} controlli falliti` : '✅ tutto ok');
process.exit(st.fails ? 1 : 0);
