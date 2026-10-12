// Compare like-for-like graphics audits; flag sustained changes for investigation.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import assert from 'node:assert/strict';
const root = 'docs/agent-work/graphics-performance';
const configs = (process.env.CONFIGS ?? '2-medium,5-low').split(',');
const rows = [];
for (const config of configs) {
  const before = JSON.parse(readFileSync(`${root}/before-${config}/results.json`));
  const after = JSON.parse(readFileSync(`${root}/after-${config}/results.json`));
  const fixedBeforePath = `${root}/before-${config}-fixed/results.json`, fixedAfterPath = `${root}/after-${config}-fixed/results.json`;
  const fixedBefore = existsSync(fixedBeforePath) ? JSON.parse(readFileSync(fixedBeforePath)) : null;
  const fixedAfter = existsSync(fixedAfterPath) ? JSON.parse(readFileSync(fixedAfterPath)) : null;
  assert.ok(before.ok && after.ok, `${config}: complete audits`);
  for (const original of after.games) {
    const a = fixedAfter?.ok ? fixedAfter.games.find(g=>g.id===original.id) ?? original : original;
    const b = (fixedBefore?.ok ? fixedBefore.games.find(g=>g.id===a.id) : null) ?? before.games.find(g => g.id === a.id); assert.ok(b, a.id);
    // Aggregate repeated windows rather than assigning an isolated scheduling/GC stall to the graphics.
    // Raw windows remain in each audit; fixed-scale reruns have a longer asset warm-up.
    const summarize = game => {
      const result = {...game.samples.at(-1)};
      for (const key of ['fps','frameMsMedian','frameMsP95','cpuMsMean','drawMean']) {
        const values = game.samples.map(s=>s[key]).filter(Number.isFinite).sort((x,y)=>x-y), n=values.length;
        result[key] = n ? (values[Math.floor((n-1)/2)]+values[Math.floor(n/2)])/2 : null;
      }
      return result;
    };
    const old = summarize(b), now = summarize(a);
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
const probeBefore=JSON.parse(readFileSync(`${root}/before-fps-probe.json`)),probeAfter=JSON.parse(readFileSync(`${root}/after-fps-probe.json`));
assert.ok(probeBefore.ok&&probeAfter.ok,'FPS probes complete');
for(let i=0;i<probeAfter.rows.length;i++){
  const a=probeAfter.rows[i],b=probeBefore.rows[i];
  for(const key of ['n','q','mobile','renderer','scale','meshes','materials','textures','lights','cameras'])assert.equal(a[key],b[key],`FPS probe: same ${key}`);
  assert.deepEqual(a.resolution,b.resolution,'FPS probe: same resolution');
  assert.ok(a.fps>=b.fps-1.5&&a.p95<=b.p95+Math.max(1.5,b.p95*.1),'FPS probe: no repeatable regression');
  console.log(`PASS FPS probe ${a.mobile?'phone':a.n+' viewports'}: identical resources and resolution`);
}
process.exitCode = rows.some(r => r.investigate) ? 1 : 0;
