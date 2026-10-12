// Comparable real-browser graphics audit. No product hooks or production calls.
// GOBLIN_GPU=1 STAGE=before PLAYERS=2 QUALITY=medium node scripts/e2e/graphics-performance.mjs
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { launch, addPhone, hostEval, hostSnapshot, sleep, installTrace, readTrace, HOST_URL } from './lib.mjs';
const stage = process.env.STAGE ?? 'before', players = Number(process.env.PLAYERS ?? 2);
const quality = process.env.QUALITY ?? 'medium', repeats = Number(process.env.REPEATS ?? 2);
const games = (process.env.GAMES ?? 'quiz,reaction,memory,arena,dodgeball,soccer,volleyball,kart3d,cultura,fps,cornicione,casacarbo,minigolf,geofall,backrooms').split(',');
const out = `docs/agent-work/graphics-performance/${stage}-${players}-${quality}${process.env.SUFFIX ?? ''}`;
mkdirSync(out, { recursive: true });
const report = { stage, players, quality, viewport: process.env.VIEWPORT ?? '1280x720', games: [], errors: [] };
if (process.env.RESUME === '1') report.games = JSON.parse(readFileSync(`${out}/results.json`)).games;
const browser = await launch();
const until = async (fn, what, ms = 60000) => {
  const start = Date.now();
  while (Date.now() - start < ms) { if (await fn()) return; await sleep(120); }
  throw new Error(`Timeout ${what}`);
};
const save = () => writeFileSync(`${out}/results.json`, JSON.stringify(report, null, 2));
try {
  const page = await browser.newPage();
  // Pin presentation and authored random layouts in both versions, never lower quality.
  const hostUrl = new URL(HOST_URL); hostUrl.searchParams.set('quality', quality); hostUrl.searchParams.set('backroomsSeed', '4242');
  await page.goto(hostUrl.href, { waitUntil: 'load' });
  await until(() => hostEval(page, gm => gm.connected && gm.game?.scene.getScenes(true).some(s => s.scene.key === 'LobbyScene')), 'host ready');
  await sleep(300);
  for (let i = 2; i < players; i++) { await page.keyboard.press('ArrowRight'); await sleep(180); }
  await page.keyboard.press('Enter');
  await until(() => hostEval(page, gm => !!gm.roomCode && gm.game.scene.getScenes(true).some(s => s.scene.key === 'RoomScene')), 'room');
  const code = await hostEval(page, gm => {
    const build = gm.buildContext.bind(gm);
    gm.buildContext = payload => { const ctx = build(payload); ctx.rng.state = 4242; ctx.showControls = () => Promise.resolve(); return ctx; };
    return gm.roomCode;
  });
  const phones = [];
  page.on('pageerror', e => report.errors.push(`host: ${e}`));
  for (let i = 0; i < players; i++) {
    const p = await addPhone(browser, code, ['Niko', 'Boschi', 'Dottore', 'Carbo', 'Ciro'][i], i);
    p.page.on('pageerror', e => report.errors.push(`phone${i}: ${e}`)); phones.push(p);
  }
  for (const id of games) {
    if (report.games.some(g => g.id === id)) continue;
    console.log(`${stage}: ${players}p ${quality} ${id}`);
    if ((await hostSnapshot(page)).phase !== 'LOBBY') {
      await hostEval(page, gm => gm.restartMatch());
      await until(async () => (await hostSnapshot(page)).phase === 'LOBBY', 'restart');
      for (const p of phones) { await p.page.waitForSelector('#ready'); if (!/PRONTO ✅/.test(await p.page.$eval('#ready', e => e.textContent))) await p.page.click('#ready'); }
    }
    await until(() => hostEval(page, gm => gm.state.players.every(p => p.ready)), 'all ready');
    await hostEval(page, (gm, id) => gm.selectMinigame(id), id); await sleep(180); await hostEval(page, gm => gm.startGame());
    await until(async () => {
      const s = await hostSnapshot(page);
      if (s.phase === 'MINIGAME_PLAYING') return true;
      await hostEval(page, gm => gm.skip()); return false;
    }, `${id} playing`);
    await until(() => hostEval(page, (gm, id) => {
      const s = gm.game.scene.getScene(id); return s?.sys.isActive() && (!('game3d' in s) || !!s.game3d);
    }, id), `${id} scene`);
    await hostEval(page, async (gm, id) => { await gm.game.scene.getScene(id).game3d?.ready; }, id);
    if (process.env.PIN_SCALE === '1') await hostEval(page, (gm, {id,scale}) => {
      const g = gm.game.scene.getScene(id).game3d;
      if (!g) return;
      // Test-only resolution lock: compare equal native/preset pixel counts, without changing product auto-quality.
      const set = g.engine.setHardwareScalingLevel.bind(g.engine);
      set(scale); g.engine.setHardwareScalingLevel = () => set(scale);
    }, {id,scale:quality === 'low' ? 1.5 : 1});
    await sleep(Number(process.env.WARMUP_MS ?? 2500));
    // Capture the visible game, not a controls/loading overlay.
    assert.equal(await page.$('#pad-controls'), null);
    const row = { id, samples: [] };
    await page.screenshot({ path: `${out}/${id}.png` });
    for (let pass = 0; pass < repeats; pass++) {
      row.samples.push(await hostEval(page, async (gm, id) => {
        const s = gm.game.scene.getScene(id), g = s.game3d, sc = g?.scene, e = g?.engine;
        const values = [], cpu = [], draw = []; let previous = performance.now();
        let observer, instrumentation, stop = false;
        if (sc) {
          const url = performance.getEntriesByType('resource').map(e => e.name).find(n => /\/deps\/@babylonjs_core\.js/.test(n));
          const { SceneInstrumentation } = await import(url ?? '/node_modules/.vite/deps/@babylonjs_core.js');
          instrumentation = new SceneInstrumentation(sc); instrumentation.captureFrameTime = true;
          observer = sc.onAfterRenderObservable.add(() => {
            const now = performance.now(); values.push(now - previous); previous = now;
            cpu.push(instrumentation.frameTimeCounter.current); draw.push(instrumentation.drawCallsCounter.current);
          });
        } else {
          const frame = now => { if (stop) return; values.push(now - previous); previous = now; requestAnimationFrame(frame); };
          requestAnimationFrame(frame);
        }
        await new Promise(r => setTimeout(r, 3000)); stop = true;
        if (sc) { sc.onAfterRenderObservable.remove(observer); instrumentation.dispose(); }
        const avg = xs => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
        const percentile = (xs, k) => xs.length ? [...xs].sort((a,b) => a-b)[Math.min(xs.length-1, Math.floor(xs.length*k))] : null;
        const gl = e?._gl ?? gm.game.renderer.gl, ext = gl?.getExtension('WEBGL_debug_renderer_info');
        return {
          frames: values.length, fps: 1000 / avg(values), frameMsMedian: percentile(values, .5), frameMsP95: percentile(values, .95),
          cpuMsMean: avg(cpu), drawMean: avg(draw), renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unavailable',
          resolution: e ? [e.getRenderWidth(), e.getRenderHeight()] : [gm.game.canvas.width, gm.game.canvas.height],
          scale: e?.getHardwareScalingLevel() ?? 1, meshes: sc?.meshes.length, materials: sc?.materials.length,
          textures: sc?.textures.length, lights: sc?.lights.length, cameras: sc?.activeCameras?.length ?? (sc ? 1 : 0),
          activeScene: s.sys.isActive(), phase: gm.state.phase
        };
      }, id));
    }
    assert.ok(row.samples.every(s => s.frames > 30 && s.activeScene && s.phase === 'MINIGAME_PLAYING'), `${id}: stable render samples`);
    if (stage === 'after' && ['kart3d','casacarbo'].includes(id)) {
      row.hudFit = await hostEval(page, (gm,id) => {
        const hud = gm.game.scene.getScene(id).game3d.hud;
        const labels = id === 'kart3d' ? [...hud.entries.values()].map(e=>e.abilityLabel) : [...hud.rows.values()].map(e=>e.status);
        return labels.map(t=>({text:t.text,width:t.widthInPixels,height:t.heightInPixels,font:t.fontSizeInPixels,lineHeight:t._fontOffset.height,
          lines:t.lines.map(l=>({text:l.text,width:l.width}))}));
      },id);
      assert.equal(row.hudFit.length,players);
      for(const label of row.hudFit) {
        assert.ok(label.lines.every(l=>l.width<=label.width+.5),`${id}: ability text fits horizontally: ${label.text}`);
        assert.ok(label.lines.length*label.lineHeight<=label.height+.5,`${id}: ability text fits vertically: ${JSON.stringify(label)}`);
      }
    }
    if (id === 'backrooms') assert.equal(row.samples[0].cameras, players, `${id}: all split-screen cameras`);
    // With phone controls FPS renders its host radar; hardware-pad split-screen is measured separately.
    if (id === 'fps') assert.equal(row.samples[0].cameras, 0, 'FPS host radar with phone controls');
    if (id === 'fps') await phones[0].page.screenshot({ path: `${out}/fps-phone.png` });
    row.phoneLayouts = [];
    for (const p of phones) row.phoneLayouts.push(await p.page.evaluate(() => ({
      title: document.querySelector('#app h1')?.textContent, scroll: document.documentElement.scrollHeight > innerHeight + 2,
      controls: document.querySelectorAll('#app button,#app canvas,#app input').length
    })));
    await installTrace(page, 'host');
    await hostEval(page, gm => {
      const ctx = gm.minigameContext; ctx.finish({ results: ctx.players.map((p,i) => ({ playerId:p.id, placement:i+1, score:10-i })) });
    });
    await until(async () => {
      const trace = await readTrace(page);
      if (trace.some(e => e.ph === 'MINIGAME_ROULETTE')) return true;
      if (trace.at(-1)?.ph === 'ROUND_RESULTS') await hostEval(page,gm=>gm.skip());
      return false;
    }, 'finished/results/roulette');
    const trace = await readTrace(page);
    assert.ok(trace.some(e => e.ph === 'MINIGAME_FINISHED' && e.act.length === 1 && e.act[0] === 'FinishedScene' && e.ov === 0), `${id}: 3D cleanup`);
    row.cleanup = true; report.games.push(row); save();
    console.log(`PASS ${id} FPS=${row.samples.map(s => s.fps.toFixed(1)).join('/')} draw=${row.samples[0].drawMean}`);
  }
  assert.deepEqual(report.errors, []); report.ok = true; save();
} catch (e) { report.failure = String(e); save(); throw e; }
finally { await browser.close(); }
