import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { launch, HOST_URL } from './lib.mjs';
const out = 'docs/agent-work/ciro-animation-update';
mkdirSync(`${out}/shots`, { recursive: true });
const browser = await launch();
try {
  const page = await browser.newPage(), errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(`${HOST_URL}?debug=1`, { waitUntil: 'load' });
  await page.evaluate(async () => {
    const { GoblinVisualInstance } = await import('/src/minigames/characters/goblinVisual.ts');
    const { CIRO_PROFILE } = await import('/src/minigames/characters/ciroProfile.ts');
    const u = performance.getEntriesByType('resource').map(e => e.name).find(n => /\/@babylonjs_core\.js\?/.test(n));
    const { Engine, Scene, ArcRotateCamera, HemisphericLight, Vector3, TransformNode, Color4, Camera } = await import(u);
    const canvas = document.createElement('canvas');
    canvas.width = 1280; canvas.height = 720; canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:999999'; document.body.append(canvas);
    const engine = new Engine(canvas, true, { preserveDrawingBuffer: true }), scene = new Scene(engine);
    scene.clearColor = new Color4(.42, .46, .54, 1);
    const camera = new ArcRotateCamera('camera', -Math.PI/2, 1.32, 4, new Vector3(0, 1, 0), scene);
    new HemisphericLight('light', Vector3.Up(), scene).intensity = 1;
    const root = new TransformNode('ciro', scene); root.rotation.y = Math.PI;
    const model = new GoblinVisualInstance(scene, root, { height: 2, profile: CIRO_PROFILE });
    window.__ciroUpdate = { engine, scene, model, root, camera, profile: CIRO_PROFILE, GoblinVisualInstance, TransformNode, Camera, Vector3 };
    engine.runRenderLoop(() => scene.render());
  });
  await page.waitForFunction(() => window.__ciroUpdate.model.ready, { timeout: 60000 });
  const report = await page.evaluate(() => {
    const { model, scene, profile } = window.__ciroUpdate;
    const state = { speedFrac: 0, alive: true, falling: false, dashing: false, stunned: false, grounded: true };
    const rows = [];
    for (const clip of profile.clips) {
      const poses = [];
      for (const fraction of [0, .25, .5, .75, 1]) {
        model.preview(clip.name, 1, false);
        let left = fraction * (clip.to - clip.from);
        while (left > 0) { const dt = Math.min(.05, left); model.update(dt, state); left -= dt; }
        model.update(0, state); scene.render();
        poses.push(model.meshes.filter(m => m.getTotalVertices() > 0).every(m => Array.from(m.getPositionData(true, true)).every(Number.isFinite)));
      }
      rows.push({ name: clip.name, debug: model.debug(), poses });
    }
    return { rows, materials: model.meshes.filter(m => m.material).map(m => ({ class: m.material.getClassName(), pickable: m.isPickable, textures: m.material.getActiveTextures().map(t => ({ ready: t.isReady(), size: t.getSize() })) })), autoplay: scene.animationGroups.some(g => g.isPlaying) };
  });
  assert.equal(report.rows.length, 59);
  for (const r of report.rows) { assert.equal(r.debug.bones, 65); assert.equal(r.debug.activeTracks, 195); assert.ok(r.poses.every(Boolean), r.name); }
  assert.equal(report.autoplay, false);
  assert.ok(report.materials.every(m => !m.pickable && m.textures.length === 3 && m.textures.every(t => t.ready && t.size.width === 4096)));
  // Native pose sheets to review the new gestures without inferred labels from truncated animation names.
  await page.setViewport({ width: 1200, height: 1200 });
  await page.evaluate(() => {
    const a = window.__ciroUpdate; a.model.dispose();
    a.camera.alpha = -Math.PI/2; a.camera.beta = Math.PI/2; a.camera.radius = 25;
    a.camera.target.set(0, 4.8, 0); a.camera.mode = a.Camera.ORTHOGRAPHIC_CAMERA;
    a.camera.orthoLeft = -6.3; a.camera.orthoRight = 6.3; a.camera.orthoTop = 6.3; a.camera.orthoBottom = -6.3;
    const oldNames = new Set(['interactionA','floodBlock','scoopA','bucketWalk','scoopB','floodBarrier','bucketEmpty','getUp','squeegee','interactionB','floodLoop','slip','fallBackward']);
    a.extra = a.profile.clips.filter(c => oldNames.has(c.name.split('.')[1])).map((c, i) => {
      const root = new a.TransformNode(c.name, a.scene); root.position.set((i%4-1.5)*3, (3-Math.floor(i/4))*3-1.2, 0); root.rotation.y = Math.PI;
      return { clip: c, model: new a.GoblinVisualInstance(a.scene, root, { height: 2, profile: a.profile }) };
    });
    const labels = document.createElement('div'); labels.style.cssText='position:fixed;inset:0;z-index:1000000;display:grid;grid-template-columns:repeat(4,1fr);grid-template-rows:repeat(4,1fr);pointer-events:none;color:white;font:bold 18px Arial';
    for (const { clip } of a.extra) { const l = document.createElement('div'); l.style.cssText='align-self:end;text-align:center;padding-bottom:10px'; l.textContent = clip.name; labels.append(l); }
    document.body.append(labels); a.engine.resize();
  });
  await page.waitForFunction(() => window.__ciroUpdate.extra.every(e => e.model.ready), { timeout: 60000 });
  for (const sec of [.6, 1.5, 2.6, 4.0]) {
    await page.evaluate(sec => {
      const a = window.__ciroUpdate;
      for (const e of a.extra) {
        e.model.preview(e.clip.name, 1, false);
        for (let t = 0; t < sec; t += .05) e.model.update(Math.min(.05, sec-t), { speedFrac: 0, alive: true, falling: false, dashing: false, stunned: false, grounded: true });
      }
      a.scene.render();
    }, sec);
    await page.screenshot({ path: `${out}/shots/new-poses-${sec}.png` });
  }
  const counters = await page.evaluate(async () => {
    const a = window.__ciroUpdate; a.extra.forEach(e => e.model.dispose()); a.engine.dispose();
    return (await import('/src/minigames/characters/goblinVisual.ts')).goblinVisualCounters();
  });
  assert.equal(counters.liveInstances, 0); assert.deepEqual(errors, []);
  writeFileSync(`${out}/asset-render.json`, JSON.stringify({ report, counters, errors }, null, 2));
  console.log('PASS: 59 native clips × 5 poses, finite deformed skin, 65 bones/195 tracks, original 4K PBR textures, no autoplay, disposal');
} finally { await browser.close(); }
