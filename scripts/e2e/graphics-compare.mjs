// Compare like-for-like graphics audits; flag sustained changes for investigation.
import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const root = 'docs/agent-work/graphics-performance';
const configs = (process.env.CONFIGS ?? '2-medium,5-low').split(',');
const rows = [];
for (const config of configs) {
  const before = JSON.parse(readFileSync(`${root}/before-${config}/results.json`));
  const after = JSON.parse(readFileSync(`${root}/after-${config}/results.json`));
  assert.ok(before.ok && after.ok, `${config}: complete audits`);
  for (const a of after.games) {
    const b = before.games.find(g => g.id === a.id); assert.ok(b, a.id);
    // The final sample follows the first full sampling window and asset warm-up.
    const old = b.samples.at(-1), now = a.samples.at(-1);
    assert.equal(now.renderer, old.renderer, `${a.id}: same GPU`);
    assert.deepEqual(now.resolution, old.resolution, `${a.id}: same resolution`);
    assert.equal(now.scale, old.scale, `${a.id}: same render scale`);
    for (const k of ['meshes','materials','textures','lights','cameras'])
      assert.equal(now[k], old[k], `${a.id}: no extra ${k}`);
    const fpsChange = now.fps - old.fps, p95Change = now.frameMsP95 - old.frameMsP95;
    const investigate = fpsChange < -1.5 || p95Change > Math.max(1.5, old.frameMsP95 * .1);
    rows.push({ config, id:a.id, beforeFps:old.fps, afterFps:now.fps, fpsChange,
      beforeMedian:old.frameMsMedian, afterMedian:now.frameMsMedian, beforeP95:old.frameMsP95, afterP95:now.frameMsP95,
      beforeCpu:old.cpuMsMean, afterCpu:now.cpuMsMean, beforeDraw:old.drawMean, afterDraw:now.drawMean, investigate });
    console.log(`${investigate?'CHECK':'PASS'} ${config} ${a.id}: ${old.fps.toFixed(1)} -> ${now.fps.toFixed(1)} FPS; p95 ${old.frameMsP95.toFixed(1)} -> ${now.frameMsP95.toFixed(1)} ms`);
  }
}
writeFileSync(`${root}/comparison.json`,JSON.stringify(rows,null,2));
process.exitCode = rows.some(r => r.investigate) ? 1 : 0;
