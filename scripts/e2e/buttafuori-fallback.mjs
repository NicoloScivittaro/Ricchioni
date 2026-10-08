import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { launch, HOST_URL } from './lib.mjs';
const browser = await launch();
try {
  const page = await browser.newPage(), errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(`${HOST_URL}?debug=1&buttafuori=new`, { waitUntil: 'load' });
  await page.waitForSelector('#app canvas');
  await page.setRequestInterception(true);
  page.on('request', req => /detailed_character\.glb/.test(req.url()) ? req.abort('failed') : req.continue());
  await page.evaluate(async () => {
    const { ArenaEntity } = await import('/src/minigames/arena/arenaEntity.ts');
    const coreUrl = performance.getEntriesByType('resource').map(e => e.name).find(n => /\/@babylonjs_core\.js\?/.test(n));
    const { Engine, Scene, DynamicTexture } = await import(coreUrl);
    const { setButtafuoriVisualMode } = await import('/src/minigames/characters/buttafuoriVisualMode.ts');
    setButtafuoriVisualMode('new');
    const canvas = document.createElement('canvas'), engine = new Engine(canvas), scene = new Scene(engine);
    const entity = new ArenaEntity(scene, new DynamicTexture('dot', 16, scene), '#ef4444', 'buttafuori', '🥊', 'PROBE', null);
    window.__fallback = { entity, engine };
  });
  await page.waitForFunction(() => window.__fallback.entity.goblinDebug()?.state === 'error', { timeout: 30000 });
  const result = await page.evaluate(() => {
    const { entity, engine } = window.__fallback;
    const physics = Object.freeze({ x: 0, y: 0, z: 0, vx: 0, vz: 0, facing: 0, alive: true, falling: false, spin: 0, dashing: false, stunTime: 0, hitFlash: 0 });
    entity.updateVisual(physics, .016, performance.now());
    const imported = entity.goblinDebug(), fallbackVisible = entity.bodyMeshes.some(m => m.isEnabled() && m.isVisible);
    entity.setBodyVisible(false); const hidden = entity.bodyMeshes.every(m => !m.isEnabled());
    entity.setBodyVisible(true); const restored = entity.bodyMeshes.some(m => m.isEnabled() && m.isVisible);
    entity.dispose(); engine.dispose();
    return { imported, fallbackVisible, hidden, restored };
  });
  assert.equal(result.imported.state, 'error'); assert.equal(result.imported.bones, 0);
  assert.ok(result.fallbackVisible && result.hidden && result.restored);
  assert.equal(errors.length, 0, errors.join(';'));
  writeFileSync('docs/agent-work/detailed-character-pilot/fallback.json', JSON.stringify({ result, errors }, null, 2));
  console.log('Failed import retains functional Legacy body/visibility without gameplay writes: PASS');
} finally { await browser.close(); }
