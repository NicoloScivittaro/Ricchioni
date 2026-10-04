// SPARATORIA DEI DISAGIATI — misura di performance dello split-screen (M6.1, punto 5). SOLO simulazione/headless:
// il browser headless renderizza con SwiftShader (rasterizzatore SOFTWARE, nessuna vera GPU) — questi numeri NON
// equivalgono a una GPU reale, servono solo a confrontare 2 vs 3 vs 4 vs 5 viewport TRA LORO, sulla STESSA macchina.
// NON modifica la qualita': legge solo quello che il sistema quality (src/core/quality.ts) sceglie da solo.
//   node scripts/e2e/fps-perf.mjs
import { launch, createRoomOnHost, addPhone, hostEval, hostSnapshot, sleep } from './lib.mjs';
import { XBOX, DS, GENERIC, makeCheck, installMock, add, remove, tap, until, sceneEval, watchControls, resetControlsWatch, f3Text } from './padmock.mjs';

const { st, check } = makeCheck();
const F = (page, fn, arg) => sceneEval(page, 'fps', fn, arg);
const XBOX2 = 'Xbox 360 Controller (STANDARD GAMEPAD Vendor: 045e Product: 028e)';
const PS3 = 'PLAYSTATION(R)3 Controller (STANDARD GAMEPAD Vendor: 054c Product: 0268)';
const FAMILIES = [XBOX, DS, GENERIC, XBOX2, PS3];

const browser = await launch();
try {
  const { page, code } = await createRoomOnHost(browser, { targetKeyPresses: 3 }); // 5 giocatori
  const errs = [];
  page.on('pageerror', (e) => errs.push('HOST ' + String(e.stack ?? e).replace(/\s+/g, ' ').slice(0, 300)));
  const phones = [];
  for (let i = 0; i < 5; i++) phones.push(await addPhone(browser, code, `P${i + 1}`, i));
  const pids = await hostEval(page, (gm) => gm.state.players.map((p) => p.id));
  await installMock(page, 5);
  await watchControls(page);

  const phaseNow = async () => (await hostSnapshot(page)).phase;
  async function setActivePads(n) {
    for (let k = 0; k < 5; k++) {
      const paired = (await page.evaluate((id) => window.__pads.slotOf(id)?.state, pids[k])) === 'paired';
      if (k < n && !paired) { await add(page, k, FAMILIES[k]); await sleep(350); }
      else if (k >= n && paired) { await remove(page, k); await sleep(200); }
    }
    await sleep(400);
  }

  // Associa tutti e 5 UNA VOLTA (stesso motivo del test principale: nuova associazione = solo in lobby).
  for (let k = 0; k < 5; k++) await add(page, k, FAMILIES[k]);
  await sleep(500);
  for (let k = 0; k < 5; k++) {
    await page.evaluate((id) => window.__pads.setTarget(id), pids[k]);
    await tap(page, k, 'A');
  }
  await page.evaluate(() => window.__pads.setTarget(null));
  await setActivePads(0);
  if (!(await f3Text(page))) await page.keyboard.press('F3'); // riusa l'overlay di debug esistente per leggere qualita'/scala, nessun import nuovo

  const results = [];

  async function measure(n) {
    console.log(`\n--- MISURA ${n} VIEWPORT ---`);
    await setActivePads(n);
    await resetControlsWatch(page);
    await hostEval(page, (gm, id) => gm.selectMinigame(id), 'fps');
    if ((await phaseNow()) === 'LOBBY') {
      await sleep(300);
      await page.keyboard.press('Enter');
    }
    await until(async () => (await phaseNow()) === 'MINIGAME_PLAYING', 60000, `fps PLAYING (${n})`);
    await until(async () => await page.evaluate(() => window.__cc.shownAt !== null), 15000, `CONTROLLI (${n})`);
    await until(async () => await page.evaluate(() => window.__cc.hiddenAt !== null), 8000, `fine CONTROLLI (${n})`);
    // Margine ampio (il modulo Babylon dello split-screen puo' essere un import "freddo" al primo avvio, piu' lento
    // di quanto sembri sotto carico macchina pesante — non e' un bug del gioco, e' solo la macchina di sviluppo).
    await until(async () => (await F(page, (g) => g.splitScreen?.cams.length ?? 0)) === n, 45000, `${n} camere pronte`);
    await sleep(1500); // riscaldamento: lascia che l'engine e l'eventuale auto-quality si stabilizzino un po'

    const samples = [];
    for (let i = 0; i < 16; i++) {
      const fps = await F(page, (g) => g.splitScreen.engine.getFps());
      if (Number.isFinite(fps) && fps > 0) samples.push(fps);
      await sleep(180);
    }
    const info = await F(page, (g) => {
      const e = g.splitScreen.engine;
      const s = g.splitScreen.scene;
      return {
        scale: e.getHardwareScalingLevel(),
        meshes: s.meshes.length,
        activeCameras: s.activeCameras.length,
        // drawCalls: Babylon lo espone solo con SceneInstrumentation attivata (non lo e' qui di default) — onesto
        // dire "non disponibile" invece di inventare un numero.
        drawCalls: e._drawCalls?.current ?? null
      };
    });
    const avg = samples.reduce((a, b) => a + b, 0) / Math.max(1, samples.length);
    const min = Math.min(...samples);
    const frameMs = avg > 0 ? 1000 / avg : NaN;
    // Riusa l'overlay F3 esistente (core/debug.ts) per leggere il preset scelto dal sistema quality gia' esistente
    // ("qualità low/medium/high (auto) · scala N.NN") — nessun secondo sistema qualita' specifico per FPS.
    const qLine = (await f3Text(page)).split('\n').find((l) => l.includes('qualità')) ?? '';
    const qMatch = /qualità (\w+)( \(auto\))? · scala ([\d.]+)/.exec(qLine);
    const row = {
      viewports: n,
      avgFps: +avg.toFixed(1),
      minFps: +min.toFixed(1),
      frameMs: +frameMs.toFixed(2),
      scale: info.scale,
      meshes: info.meshes,
      activeCameras: info.activeCameras,
      drawCalls: info.drawCalls,
      qualityLevel: qMatch?.[1] ?? 'n/d',
      qualityAuto: !!qMatch?.[2],
      qualityScaleF3: qMatch?.[3] ?? 'n/d'
    };
    results.push(row);
    console.log(`   FPS medio ${row.avgFps} · minimo ${row.minFps} · frame ${row.frameMs}ms · scala rendering ${row.scale} · qualita' ${row.qualityLevel}${row.qualityAuto ? ' (auto)' : ''} · mesh ${row.meshes} · draw call ${row.drawCalls ?? 'non disponibile (SceneInstrumentation non attiva)'}`);
    check(samples.length >= 8, `${n} viewport: campioni raccolti a sufficienza (${samples.length}/16)`);
    check(row.activeCameras === n, `${n} viewport: ${row.activeCameras} camere attive durante la misura`);

    await hostEval(page, (gm) => {
      const ctx = gm.minigameContext;
      ctx.finish({ results: ctx.players.map((p, i) => ({ playerId: p.id, placement: i + 1, score: 5 - i })) });
    });
    await until(async () => (await phaseNow()) === 'ROUND_RESULTS', 30000, 'risultati');
    await until(async () => ['NEXT_ROUND', 'MINIGAME_ROULETTE'].includes(await phaseNow()), 60000, 'rullo');
  }

  await measure(2);
  await measure(3);
  await measure(4);
  await measure(5);

  console.log('\n=== RIEPILOGO (headless/SwiftShader — SOLO confronto relativo tra viewport, NON una GPU reale) ===');
  for (const r of results) console.log(`   ${r.viewports}p: ${r.avgFps} FPS medio (min ${r.minFps}), frame ${r.frameMs}ms, scala ${r.scale}, qualita' ${r.qualityLevel}${r.qualityAuto ? ' (auto)' : ''}, ${r.meshes} mesh`);

  check(errs.length === 0, `nessun errore di pagina ${errs.length ? JSON.stringify(errs.slice(0, 3)) : ''}`);
} catch (e) {
  console.error('ERRORE', e);
  st.fails++;
} finally {
  await browser.close();
}
process.exitCode = st.fails ? 1 : 0;
