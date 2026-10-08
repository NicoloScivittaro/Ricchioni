// Acceptance measurement only: no application or asset changes.
import puppeteer from 'puppeteer-core';
import { writeFileSync } from 'node:fs';
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  defaultViewport: { width: 1600, height: 900 }
});
const results = [];
try {
  for (const mode of ['old', 'new']) {
    const page = await browser.newPage();
    await page.goto(`http://localhost:5173/?characters=1&goblin=${mode}`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__gallery?.ready, { timeout: 60000 });
    if (mode === 'new') await page.waitForFunction(() => window.__gallery.goblins()[0]?.state === 'ready', { timeout: 60000 });
    await page.evaluate(async () => {
      const resource = performance.getEntriesByType('resource').map((r) => r.name).find((name) => /@babylonjs_core\.js/.test(name));
      if (!resource) throw new Error('Babylon module URL not observed');
      const { Engine, SceneInstrumentation } = await import(resource);
      const scene = Engine.LastCreatedEngine.scenes[0];
      const instrumentation = new SceneInstrumentation(scene);
      const counts = [];
      scene.onAfterRenderObservable.add(() => counts.push(instrumentation.drawCallsCounter.current));
      window.__reviewPerf = { instrumentation, counts };
    });
    await new Promise((resolve) => setTimeout(resolve, 5000));
    results.push(await page.evaluate((m) => {
      const counts = window.__reviewPerf.counts;
      return { mode: m, perf: { ...window.__gallery.perf(), drawCalls: undefined, drawCallsPerFrame: counts.length ? counts.reduce((sum, n) => sum + n, 0) / counts.length : null, drawCallSamples: counts.length }, stats: window.__gallery.stats(), asset: window.__gallery.goblin().assets };
    }, mode));
    await page.close();
  }
} finally {
  await browser.close();
}
writeFileSync(new URL('./evidence/review-perf.json', import.meta.url), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
