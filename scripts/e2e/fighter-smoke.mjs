// BOTTE SUL CORNICIONE — prova a vista nel browser: 5 giocatori guidati dai bot di test (solo debug), screenshot a intervalli,
// nessun errore di pagina, il gioco gira davvero (movimento, colpi, HUD). Gli screenshot vanno in e2e-shots/fighter/.
//   node scripts/e2e/fighter-smoke.mjs [giocatori=5] [secondi=25]
import { launch, createRoomOnHost, addPhone, hostEval, sleep } from './lib.mjs';
import { makeCheck, until, startGame, gameEval, finishNow } from './padmock.mjs';

const N = Number(process.argv[2] ?? 5);
const SECS = Number(process.argv[3] ?? 25);
const { st, check } = makeCheck();
const browser = await launch();
const errs = [];
try {
  const { page, code } = await createRoomOnHost(browser, { targetKeyPresses: N - 2 });
  page.on('pageerror', (e) => {
    errs.push('HOST ' + String(e.stack ?? e).replace(/\s+/g, ' ').slice(0, 300));
    console.log('PAGEERROR', String(e.stack ?? e).slice(0, 600));
  });
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') console.log('CONSOLE', m.type(), m.text().slice(0, 300));
  });
  for (let i = 0; i < N; i++) await addPhone(browser, code, `P${i + 1}`, i);
  const pids = await hostEval(page, (gm) => gm.state.players.map((p) => p.id));
  await startGame(page, 'cornicione');
  await until(async () => !!(await gameEval(page, 'cornicione', (g) => g.phase === 'playing' || g.phase === 'countdown')), 60000, 'scena cornicione');
  await page.evaluate(() => document.getElementById('pad-controls')?.remove());
  await until(async () => (await gameEval(page, 'cornicione', (g) => g.phase)) === 'playing', 60000, 'via');
  await page.evaluate((ids) => ids.forEach((id) => window.__fighter.setBot(id, true)), pids);
  await page.evaluate(() => window.__fighter.setShowBoxes(false));
  // la camera deve tenere in quadro tutti quelli che combattono (entro i limiti di inseguimento): campionamento ogni 100 ms nella pagina
  await page.evaluate(() => {
    window.__camAudit = { n: 0, bad: 0, worst: 0 };
    window.__camTimer = setInterval(() => {
      const g = window.__fighter;
      if (!g) return;
      const v = g.camera.view;
      for (const f of g.sim.fighters) {
        if (!f.inGame || f.dead || f.ab.vanishT > 0 || f.ab.windowT > 0 || Math.abs(f.x) > 26 || f.y < -12 || f.y > 20) continue;
        window.__camAudit.n++;
        const out = Math.max(Math.abs(f.x - v.cx) - v.hw, Math.abs(f.y + 1.1 - v.cy) - v.hh);
        if (out > 0.5) window.__camAudit.bad++;
        window.__camAudit.worst = Math.max(window.__camAudit.worst, out);
      }
    }, 100);
  });
  const t0 = Date.now();
  let shot = 0;
  while ((Date.now() - t0) / 1000 < SECS) {
    await sleep(3000);
    await page.screenshot({ path: `e2e-shots/fighter/smoke-${N}p-${++shot}.png` });
  }
  const info = await gameEval(page, 'cornicione', (g) => ({ t: g.sim.time, phase: g.sim.phase, f: g.sim.fighters.map((f) => ({ x: f.x, y: f.y, pct: Math.round(f.percent), lives: f.lives, kos: f.stats.kos })) }));
  console.log(JSON.stringify(info));
  const cam = await page.evaluate(() => { clearInterval(window.__camTimer); return window.__camAudit; });
  check(cam.n > 20 && cam.bad / cam.n < 0.1, `camera: i combattenti restano in quadro (${cam.bad}/${cam.n} campioni fuori, peggiore ${cam.worst.toFixed(1)} m)`);
  check(info.t > 5, `la simulazione avanza (${info.t.toFixed(1)} s di gioco)`);
  check(info.f.some((f) => f.pct > 0), 'qualcuno ha preso dei colpi');
  check(info.f.every((f) => Number.isFinite(f.x) && Number.isFinite(f.y)), 'posizioni finite');
  await finishNow(page);
  await until(async () => (await hostEval(page, (gm) => gm.state?.phase)) !== 'MINIGAME_PLAYING', 30000, 'fine');
  check(errs.length === 0, `nessun errore di pagina ${errs.join(' | ')}`);
} catch (e) {
  console.log('ERRORE', e);
  st.fails++;
} finally {
  await browser.close();
}
console.log(st.fails ? `❌ ${st.fails} falliti` : '✅ ok');
process.exit(st.fails ? 1 : 0);
