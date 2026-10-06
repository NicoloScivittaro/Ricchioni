// AMBIENTI — screenshot di gioco + conteggi della scena (PRIMA/DOPO la passata ambienti), stessa scena, stessa qualita',
// stesso numero di giocatori (4 telefoni + 4 controller: la Sparatoria va in split-screen a 4 sulla TV).
//   VIEWPORT=1920x1080 OUT=e2e-shots/env TAG=after QUALITY=medium node scripts/e2e/env-shots.mjs
//   GAMES=arena,kart3d  (sottoinsieme)
// Scrive OUT/<TAG>-<gioco>-<WxH>.png e OUT/<TAG>-stats-<WxH>.json. Le misure di draw call sono quelle di UN frame.
import { launch, createRoomOnHost, addPhone, hostEval, hostSnapshot, sleep } from './lib.mjs';
import { XBOX, DS, GENERIC, installMock, add, tap, until } from './padmock.mjs';
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.resolve(process.env.OUT ?? 'e2e-shots/env');
const TAG = process.env.TAG ?? 'after';
const VP = process.env.VIEWPORT ?? '1280x720';
const QUALITY = process.env.QUALITY ?? 'medium';
const GAMES = (process.env.GAMES ?? 'arena,dodgeball,soccer,volleyball,kart3d,fps,memory,reaction,quiz,cultura').split(',');
fs.mkdirSync(OUT, { recursive: true });

/** Conteggi della scena Babylon del minigioco in corso (nessuna dipendenza dal codice nuovo: vale anche per il PRIMA). */
const probe = (page, key) =>
  hostEval(
    page,
    async (gm, k) => {
      const ph = gm.game.scene.getScene(k);
      const g = ph?.game3d ?? ph?.splitScreen;
      const sc = g?.scene;
      if (!sc) return null;
      const eng = sc.getEngine();
      const dc = await new Promise((res) => {
        const pc = eng._drawCalls;
        if (!pc) return res(-1);
        sc.onBeforeRenderObservable.addOnce(() => pc.fetchNewFrame());
        sc.onAfterRenderObservable.addOnce(() => res(pc.current));
      });
      const visible = sc.meshes.filter((m) => m.isEnabled() && m.isVisible);
      const texNames = new Map();
      for (const t of sc.textures) texNames.set(t.name, (texNames.get(t.name) ?? 0) + 1);
      return {
        meshes: sc.meshes.length,
        visibleMeshes: visible.length,
        instances: sc.meshes.filter((m) => m.getClassName() === 'InstancedMesh').length,
        activeMeshes: sc.getActiveMeshes().length,
        materials: sc.materials.length,
        textures: sc.textures.length,
        dupTextureNames: [...texNames.values()].filter((n) => n > 1).reduce((a, b) => a + b, 0),
        lights: sc.lights.length,
        particleSystems: sc.particleSystems.length,
        effectLayers: (sc.effectLayers ?? []).length,
        collidable: sc.meshes.filter((m) => m.checkCollisions).length,
        cameras: (sc.activeCameras?.length || 1),
        drawCalls: dc,
        fps: Math.round(eng.getFps())
      };
    },
    key
  );

const browser = await launch();
const stats = {};
try {
  // qualita' fissata per confronti equi (scelta "a mano": l'auto-quality non cambia livello)
  const { page, code } = await createRoomOnHost(browser, { targetKeyPresses: 2, scoreDownPresses: 2 });
  await page.evaluate((q) => localStorage.setItem('ricchioni.quality', q), QUALITY);
  for (let i = 0; i < 4; i++) await addPhone(browser, code, ['Nicolò', 'Christian', 'Carbo', 'Victor'][i], i);
  const pids = await hostEval(page, (gm) => gm.state.players.map((p) => p.id));
  await installMock(page);
  for (let k = 0; k < 4; k++) await add(page, k, [XBOX, DS, GENERIC, XBOX + ' 2'][k]);
  await sleep(800);
  for (let k = 0; k < 4; k++) {
    for (let t = 0; t < 3 && (await page.evaluate((id) => window.__pads.slotOf(id)?.state, pids[k])) !== 'paired'; t++) {
      await page.evaluate((id) => window.__pads.setTarget(id), pids[k]);
      await tap(page, k, 'A');
      await sleep(200);
    }
  }
  await page.evaluate(() => window.__pads.setTarget(null));
  console.log('controller associati', await page.evaluate(() => window.__pads.pairedCount()));

  for (const id of GAMES.filter((g) => g !== 'roulette')) {
    const t0 = Date.now();
    await hostEval(page, (gm, g) => gm.selectMinigame(g), id);
    if ((await hostSnapshot(page)).phase === 'LOBBY') {
      await sleep(300);
      await page.keyboard.press('Enter');
    }
    await until(async () => (await hostSnapshot(page)).phase === 'MINIGAME_PLAYING', 120000, `${id} PLAYING`).catch(async (e) => {
      const sn = await hostSnapshot(page);
      console.log(`STATO al timeout: fase ${sn.phase}, gioco ${sn.minigameId ?? sn.currentMinigame ?? '?'}`);
      throw e;
    });
    // via la schermata CONTROLLI, poi qualche secondo di gioco "vuoto"
    const ctrlShown = () => page.evaluate(() => !!document.getElementById('pad-controls'));
    await until(ctrlShown, 12000, 'controlli su').catch(() => {});
    await until(async () => !(await ctrlShown()), 30000, 'controlli giu').catch(() => {});
    await sleep(id === 'kart3d' ? 5500 : 3500);
    const key = id === 'kart3d' ? 'kart3d' : id;
    stats[id] = await probe(page, key);
    await page.screenshot({ path: path.join(OUT, `${TAG}-${id}-${VP}.png`) });
    console.log(id, JSON.stringify(stats[id]), `${Math.round((Date.now() - t0) / 1000)}s`);
    // vincitore a rotazione: con 10 giochi nessuno arriva all'obiettivo (prima la serata finiva prima del rullo)
    await hostEval(page, (gm, k) => {
      const ctx = gm.minigameContext;
      const n = ctx.players.length;
      ctx.finish({ results: ctx.players.map((pl, i) => ({ playerId: pl.id, placement: ((i + k) % n) + 1, score: 0 })) });
    }, GAMES.indexOf(id));
    await until(async () => ['ROUND_RESULTS', 'GLOBAL_LEADERBOARD', 'NEXT_ROUND'].includes((await hostSnapshot(page)).phase), 30000, 'risultati');
    await sleep(500);
  }
  // rullo: lo si lascia partire da solo
  if (!process.env.GAMES || GAMES.includes('roulette')) {
    await until(async () => (await hostSnapshot(page)).phase === 'MINIGAME_ROULETTE', 90000, 'rullo').catch(() => {});
    await sleep(1600);
    await page.screenshot({ path: path.join(OUT, `${TAG}-roulette-${VP}.png`) });
    console.log('roulette');
  }
  fs.writeFileSync(path.join(OUT, `${TAG}-stats-${VP}.json`), JSON.stringify(stats, null, 2));
  // confronto PRIMA/DOPO (stessa scena, stessa qualita', stessi giocatori): un aumento grosso di draw call o materiali non passa
  const beforeFile = path.join(OUT, `before-stats-${VP}.json`);
  if (TAG !== 'before' && fs.existsSync(beforeFile)) {
    const before = JSON.parse(fs.readFileSync(beforeFile, 'utf8'));
    let fails = 0;
    for (const [id, a] of Object.entries(stats)) {
      const b = before[id];
      if (!a || !b) continue;
      const okDraw = a.drawCalls <= b.drawCalls * 1.15;
      const okMat = a.materials <= b.materials * 1.25;
      const okCol = a.collidable === 0;
      if (!okDraw || !okMat || !okCol) fails++;
      console.log(`${okDraw && okMat && okCol ? '✅' : '❌'} ${id}: draw ${b.drawCalls}→${a.drawCalls} · mesh ${b.meshes}→${a.meshes} · materiali ${b.materials}→${a.materials} · texture ${b.textures}→${a.textures} · luci ${b.lights}→${a.lights} · collidibili ${a.collidable}`);
    }
    process.exitCode = fails ? 1 : 0;
  }
} finally {
  await browser.close();
}
