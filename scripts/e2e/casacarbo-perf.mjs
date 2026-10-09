// CASA CARBO — budget: mesh, materiali, draw call, triangoli, FPS e costo CPU della simulazione (headless SwiftShader: la GPU
// REALE resta da verificare). 5 giocatori guidati dai bot di test, campionati per ~12 s di partita.
//   node scripts/e2e/casacarbo-perf.mjs
import { launch, createRoomOnHost, addPhone, hostEval, sleep } from './lib.mjs';
import { until, startGame, finishNow } from './padmock.mjs';

const browser = await launch();
const errs = [];
try {
  const { page, code } = await createRoomOnHost(browser, { targetKeyPresses: 3 });
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  for (let i = 0; i < 5; i++) await addPhone(browser, code, `P${i + 1}`, i);
  const pids = await hostEval(page, (gm) => gm.state.players.map((p) => p.id));
  await startGame(page, 'casacarbo');
  await until(async () => (await page.evaluate(() => window.__casacarbo?.phase)) === 'playing', 90000, 'via');
  await page.evaluate((ids) => ids.forEach((id) => window.__casacarbo.setBot(id, true)), pids);
  // costo CPU: simulazione (world.step) e aggiornamento della texture dell'acqua, misurati avvolgendo i metodi
  await page.evaluate(() => {
    const g = window.__casacarbo;
    const w = g.sim;
    window.__cost = { step: 0, stepN: 0, water: 0, waterN: 0 };
    const s0 = w.step.bind(w);
    w.step = (...a) => { const t = performance.now(); const r = s0(...a); window.__cost.step += performance.now() - t; window.__cost.stepN++; return r; };
    const u0 = g.env.updateWater.bind(g.env);
    g.env.updateWater = (...a) => { const t = performance.now(); const r = u0(...a); window.__cost.water += performance.now() - t; window.__cost.waterN++; return r; };
    window.__frames = [];
    let last = performance.now();
    g.scene.onAfterRenderObservable.add(() => { const n = performance.now(); window.__frames.push(n - last); last = n; });
  });
  const samples = [];
  for (let i = 0; i < 12; i++) {
    await sleep(1000);
    samples.push(await page.evaluate(() => {
      const g = window.__casacarbo;
      const sc = g.scene;
      const e = sc.getEngine();
      return { fps: e.getFps(), draw: e._drawCalls?.current ?? -1, active: sc.getActiveMeshes().length, tris: sc.getActiveIndices() / 3 };
    }));
  }
  const info = await page.evaluate(() => {
    const sc = window.__casacarbo.scene;
    return { meshes: sc.meshes.length, materials: sc.materials.length, textures: sc.textures.length, lights: sc.lights.length, particleSystems: sc.particleSystems.length };
  });
  const cost = await page.evaluate(() => {
    const c = window.__cost;
    const f = window.__frames.slice(5).sort((a, b) => a - b);
    return { stepMs: (c.step / Math.max(1, c.stepN)).toFixed(2), waterMs: (c.water / Math.max(1, c.waterN)).toFixed(2), frameMedian: f[f.length >> 1]?.toFixed(0), frameP95: f[Math.floor(f.length * 0.95)]?.toFixed(0) };
  });
  const avg = (k) => (samples.reduce((a, s) => a + s[k], 0) / samples.length).toFixed(1);
  console.log(JSON.stringify(info));
  console.log(`draw call medie ${avg('draw')} (max ${Math.max(...samples.map((s) => s.draw))}) · mesh attive ${avg('active')} · triangoli ${avg('tris')} · FPS headless ${avg('fps')}`);
  console.log(`CPU: world.step ${cost.stepMs} ms/passo · texture acqua ${cost.waterMs} ms/aggiornamento · frame mediano ${cost.frameMedian} ms (p95 ${cost.frameP95} ms)`);
  await finishNow(page);
  await until(async () => (await hostEval(page, (gm) => gm.state?.phase)) !== 'MINIGAME_PLAYING', 30000, 'fine');
  console.log(errs.length ? '❌ errori: ' + errs.join(' | ') : '✅ nessun errore di pagina');
  console.log('NOTA: SwiftShader (CPU) — i numeri di FPS NON rappresentano una GPU vera; contano mesh/materiali/draw call e il costo CPU.');
} finally {
  await browser.close();
}
