// CASA CARBO — prova a vista nel browser: 2-5 giocatori guidati dai bot di test (solo debug), screenshot a intervalli in
// e2e-shots/casacarbo/, il gioco gira davvero (acqua che entra, acqua tolta, HUD), la camera fissa tiene in quadro tutti,
// nessun errore di pagina.        node scripts/e2e/casacarbo-smoke.mjs [giocatori=5] [secondi=30] [fine=0]
//   fine=1: lascia finire la partita (120 s di gioco) e fotografa la scena finale col vicino.
import { launch, createRoomOnHost, addPhone, hostEval, sleep } from './lib.mjs';
import { makeCheck, until, startGame, gameEval, finishNow } from './padmock.mjs';

const N = Number(process.argv[2] ?? 5);
const SECS = Number(process.argv[3] ?? 30);
const TO_END = process.argv[4] === '1';
const { st, check } = makeCheck();
const browser = await launch();
const errs = [];
try {
  const { page, code } = await createRoomOnHost(browser, { targetKeyPresses: N - 2 });
  page.on('pageerror', (e) => {
    errs.push('HOST ' + String(e.stack ?? e).replace(/\s+/g, ' ').slice(0, 300));
    console.log('PAGEERROR', String(e.stack ?? e).slice(0, 500));
  });
  for (let i = 0; i < N; i++) await addPhone(browser, code, `P${i + 1}`, i);
  const pids = await hostEval(page, (gm) => gm.state.players.map((p) => p.id));
  await startGame(page, 'casacarbo');
  await until(async () => (await page.evaluate(() => window.__casacarbo?.phase ?? null)) !== null, 60000, 'scena casacarbo');
  await page.evaluate(() => document.getElementById('pad-controls')?.remove());
  await until(async () => (await page.evaluate(() => window.__casacarbo?.phase)) === 'playing', 60000, 'via');
  if (process.argv[5] !== 'idle') await page.evaluate((ids) => ids.forEach((id) => window.__casacarbo.setBot(id, true)), pids);
  // tutti i personaggi devono stare dentro l'inquadratura (camera fissa)
  await page.evaluate(() => {
    window.__camAudit = { n: 0, bad: 0 };
    window.__camTimer = setInterval(() => {
      const g = window.__casacarbo;
      if (!g) return;
      const cam = g.camera;
      const eng = g.scene.getEngine();
      for (const e of g.entities.values()) {
        const BABYLON_V = e.root.getAbsolutePosition();
        const vp = cam.viewport.toGlobal(eng.getRenderWidth(), eng.getRenderHeight());
        const m = g.scene.getTransformMatrix();
        // proiezione manuale
        const x = BABYLON_V.x, y = BABYLON_V.y + 1, z = BABYLON_V.z;
        const v = m.m;
        const w = x * v[3] + y * v[7] + z * v[11] + v[15];
        const sx = ((x * v[0] + y * v[4] + z * v[8] + v[12]) / w + 1) / 2;
        const sy = (1 - (x * v[1] + y * v[5] + z * v[9] + v[13]) / w) / 2;
        window.__camAudit.n++;
        if (sx < 0 || sx > 1 || sy < 0 || sy > 1) window.__camAudit.bad++;
        void vp;
      }
    }, 200);
  });
  const t0 = Date.now();
  let shot = 0;
  const total = TO_END ? 400 : SECS;
  while ((Date.now() - t0) / 1000 < total) {
    await sleep(3000);
    const ph = await page.evaluate(() => window.__casacarbo?.phase ?? 'gone');
    if (shot < 12 || ph === 'ending') await page.screenshot({ path: `e2e-shots/casacarbo/smoke-${N}p-${String(++shot).padStart(2, '0')}.png` });
    if (ph === 'ending' || ph === 'gone') {
      await sleep(2500);
      await page.screenshot({ path: `e2e-shots/casacarbo/smoke-${N}p-finale.png` });
      break;
    }
  }
  const info = await page.evaluate(() => {
    const g = window.__casacarbo;
    if (!g) return null;
    const w = g.sim;
    return { t: w.time, dry: w.dryFraction(), inflow: w.inflowTotal, drained: w.drainedCredited, finite: w.players.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)) };
  });
  console.log(JSON.stringify(info));
  const cam = await page.evaluate(() => {
    clearInterval(window.__camTimer);
    return window.__camAudit;
  });
  if (info) {
    check(info.t > 5, `la simulazione avanza (${info.t.toFixed(1)} s di gioco)`);
    check(info.inflow > 0, `l'acqua entra dalle porte (${info.inflow.toFixed(1)})`);
    check(info.drained > 0, `i bot tolgono acqua (${info.drained.toFixed(1)})`);
    check(info.finite, 'posizioni finite');
  }
  check(cam.n > 20 && cam.bad === 0, `camera fissa: tutti i personaggi sempre in quadro (${cam.bad}/${cam.n} fuori)`);
  if (!TO_END) {
    await finishNow(page);
    await until(async () => (await hostEval(page, (gm) => gm.state?.phase)) !== 'MINIGAME_PLAYING', 30000, 'fine');
  } else {
    await until(async () => (await hostEval(page, (gm) => gm.state?.phase)) !== 'MINIGAME_PLAYING', 60000, 'fine naturale');
    check(true, 'la partita finisce da sola');
  }
  check(errs.length === 0, `nessun errore di pagina ${errs.join(' | ')}`);
} catch (e) {
  console.log('ERRORE', e);
  st.fails++;
} finally {
  await browser.close();
}
console.log(st.fails ? `❌ ${st.fails} falliti` : '✅ ok');
process.exit(st.fails ? 1 : 0);
