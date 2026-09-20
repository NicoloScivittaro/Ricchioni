// PERDITE su molti minigiochi CONSECUTIVI (host + telefoni, nessun refresh): dopo ogni round, con il minigioco già smontato,
// misura heap JS (dopo GC), canvas, overlay DOM, scene attive, timer pendenti, oscillatori audio vivi e listener su window.
//   ROUNDS=14 PHONES=2 node scripts/e2e/leak.mjs
import { launch, createRoomOnHost, addPhone, hostEval, hostSnapshot, sleep } from './lib.mjs';

const ROUNDS = Number(process.env.ROUNDS ?? 14);
const PHONES = Number(process.env.PHONES ?? 2);

/** Strumentazione installata PRIMA degli script della pagina: timer pendenti e oscillatori audio vivi. */
const INSTRUMENT = () => {
  const w = window;
  w.__timers = new Set();
  const st = w.setTimeout.bind(w);
  const ct = w.clearTimeout.bind(w);
  const si = w.setInterval.bind(w);
  const ci = w.clearInterval.bind(w);
  w.setTimeout = (fn, ms, ...a) => {
    const id = st((...x) => {
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
  bodyChildren: document.body.children.length,
  timers: window.__timers?.size ?? -1,
  osc: window.__osc ?? -1
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
  const { page: host, code } = await (async () => {
    const page = await browser.newPage();
    await page.evaluateOnNewDocument(INSTRUMENT);
    page.on('pageerror', (e) => errs.push('HOST ' + String(e).slice(0, 160)));
    await page.goto(process.env.HOST_URL ?? 'http://localhost:5173/', { waitUntil: 'load' });
    await page.waitForFunction(() => performance.getEntriesByType('resource').some((e) => /GameManager\.ts/.test(e.name)), { timeout: 30000 });
    await page.waitForFunction(async () => {
      try {
        const url = performance.getEntriesByType('resource').map((e) => e.name).find((n) => /GameManager\.ts/.test(n));
        const { game: gm } = await import(url);
        return !!gm.game && gm.game.scene.getScenes(true).some((s) => s.scene.key === 'LobbyScene');
      } catch {
        return false;
      }
    }, { timeout: 30000 });
    await sleep(300);
    for (let i = 0; i < Math.max(0, PHONES - 2); i++) await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await page.waitForFunction(async () => {
      const url = performance.getEntriesByType('resource').map((e) => e.name).find((n) => /GameManager\.ts/.test(n));
      const { game: gm } = await import(url);
      return !!gm.roomCode && gm.game.scene.getScenes(true).some((s) => s.scene.key === 'RoomScene');
    }, { timeout: 20000 });
    const code = await hostEval(page, (gm) => gm.roomCode);
    return { page, code };
  })();
  const phones = [];
  for (let i = 0; i < PHONES; i++) phones.push(await addPhone(browser, code, `P${i + 1}`, i));
  for (const p of phones) await p.page.evaluate(INSTRUMENT).catch(() => {});
  await host.keyboard.press('Enter');

  let newGames = 0;
  /** Se la partita è finita (target raggiunto): NUOVA PARTITA, telefoni di nuovo PRONTI, host avvia. */
  const handleGameOver = async () => {
    const ph = (await hostSnapshot(host)).phase;
    if (ph !== 'GAME_FINISHED') return false;
    await sleep(1500);
    await hostEval(host, (gm) => gm.restartMatch());
    let g = 0;
    while ((await hostSnapshot(host)).phase !== 'LOBBY' && g++ < 40) await sleep(300);
    const scores = await hostEval(host, (gm) => gm.state.players.map((p) => p.score));
    if (scores.some((x) => x !== 0)) throw new Error('NUOVA PARTITA: punteggi non azzerati ' + JSON.stringify(scores));
    await sleep(600);
    for (const p of phones) await p.page.click('#ready').catch(() => {});
    await sleep(600);
    await host.keyboard.press('Enter');
    newGames++;
    return true;
  };
  const rows = [];
  const played = [];
  for (let round = 1; round <= ROUNDS; round++) {
    // porta il round a PLAYING saltando le fasi cosmetiche
    let guard = 0;
    while ((await hostSnapshot(host)).phase !== 'MINIGAME_PLAYING') {
      if (await handleGameOver()) continue;
      await hostEval(host, (gm) => gm.skip());
      await sleep(450);
      if (++guard > 80) throw new Error('PLAYING non raggiunto');
    }
    const snap = await hostSnapshot(host);
    played.push(snap.pending);
    await sleep(2500); // il gioco gira un po' (creazione scena/engine inclusa)
    await hostEval(host, (gm) => {
      const ctx = gm.minigameContext;
      ctx.finish({ results: ctx.players.map((p, i) => ({ playerId: p.id, placement: i + 1, score: 5 - i })) });
    });
    // fino al prossimo rullo (fasi cosmetiche saltate)
    guard = 0;
    while ((await hostSnapshot(host)).phase !== 'MINIGAME_ROULETTE') {
      if ((await hostSnapshot(host)).phase === 'GAME_FINISHED') break; // finale: lo gestisce il ciclo successivo
      await hostEval(host, (gm) => gm.skip());
      await sleep(450);
      if (++guard > 80) throw new Error('rullo successivo non raggiunto');
    }
    await sleep(1200);
    if ((await hostSnapshot(host)).phase === 'GAME_FINISHED') {
      // il finale conta come "round": verifica solo pulizia scene, poi NUOVA PARTITA al ciclo successivo
      console.log(`R${String(round).padStart(2)} FINALE (target raggiunto) → NUOVA PARTITA`);
      const fin = await hostSnapshot(host);
      if (fin.active.length !== 1 || fin.active[0] !== 'GameOverScene') throw new Error('finale: scene ' + JSON.stringify(fin.active));
      continue;
    }
    const s = await hostSnapshot(host);
    const m = await host.evaluate(METRICS);
    const heap = await heapMB(host);
    const ph = await phones[0].page.evaluate(METRICS).catch(() => ({}));
    const pheap = await heapMB(phones[0].page);
    const lst = await windowListeners(host);
    rows.push({ round, game: snap.pending, heap, pheap, scenes: s.active.length, ...m, listeners: Object.values(lst).reduce((a, b) => a + b, 0), phoneTimers: ph.timers, phoneOsc: ph.osc });
    console.log(
      `R${String(round).padStart(2)} ${String(snap.pending).padEnd(10)} heap host ${heap.toFixed(1)}MB tel ${pheap.toFixed(1)}MB · scene ${s.active.length} · canvas ${m.canvases} (3D ${m.overlays3d}) · overlay DOM ${m.domOverlays} · body ${m.bodyChildren} · timer ${m.timers} · osc ${m.osc} · listener window ${rows[rows.length - 1].listeners}`
    );
  }

  // ---- verdetto: confronto tra il primo terzo e l'ultimo terzo dei round ----
  const third = Math.max(1, Math.floor(rows.length / 3));
  const avg = (arr, k) => arr.reduce((a, r) => a + (r[k] ?? 0), 0) / arr.length;
  const first = rows.slice(0, third);
  const last = rows.slice(-third);
  const growth = (k) => avg(last, k) - avg(first, k);
  console.log(`\nGiochi giocati: ${played.join(', ')} · NUOVE PARTITE dopo il target: ${newGames}`);
  const checks = [
    ['scene attive == 1 dopo ogni round', rows.every((r) => r.scenes === 1)],
    ['nessun canvas 3D residuo', rows.every((r) => r.overlays3d === 0)],
    ['nessun overlay DOM residuo', rows.every((r) => r.domOverlays === 0)],
    [`canvas stabili (crescita ${growth('canvases').toFixed(1)})`, growth('canvases') <= 0.5],
    [`elementi in body stabili (crescita ${growth('bodyChildren').toFixed(1)})`, growth('bodyChildren') <= 0.5],
    [`timer pendenti stabili (crescita ${growth('timers').toFixed(1)})`, growth('timers') <= 3],
    [`oscillatori vivi al rullo ≤ 2 (max ${Math.max(...rows.map((r) => r.osc))})`, rows.every((r) => r.osc <= 2)],
    [`listener su window stabili (crescita ${growth('listeners').toFixed(1)})`, growth('listeners') <= 1],
    [`heap host: ${avg(first, 'heap').toFixed(0)} → ${avg(last, 'heap').toFixed(0)} MB (crescita ${growth('heap').toFixed(1)} MB, ${(rows.length)} round)`, growth('heap') <= Math.max(25, avg(first, 'heap') * 0.35)],
    [`heap telefono: ${avg(first, 'pheap').toFixed(0)} → ${avg(last, 'pheap').toFixed(0)} MB`, growth('pheap') <= Math.max(15, avg(first, 'pheap') * 0.5)]
  ];
  let fails = 0;
  for (const [msg, okk] of checks) {
    console.log(`${okk ? '✅' : '❌'} ${msg}`);
    if (!okk) fails++;
  }
  if (errs.length) {
    console.log('❌ errori pagina:', errs.slice(0, 3));
    fails++;
  }
  process.exitCode = fails ? 1 : 0;
} catch (e) {
  console.error('ERRORE', e);
  process.exitCode = 2;
} finally {
  await browser.close();
}
