// BOTTE SUL CORNICIONE — budget: mesh, materiali, draw call, FPS (headless SwiftShader: la GPU REALE resta da verificare).
// 5 giocatori guidati dai bot di test nel laboratorio (?fighter=1), campionati per ~12 s; l'ambiente da solo (senza personaggi).
//   node scripts/e2e/fighter-perf.mjs
import { launch, HOST_URL, sleep } from './lib.mjs';

const browser = await launch();
try {
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  await page.goto(`${HOST_URL}?fighter=1&debug=1`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__fighterLab?.game()?.phase === 'countdown', { timeout: 60000 });
  await page.evaluate(async () => { await window.__fighterLab.restart(5, 'goblin'); });
  await page.waitForFunction(() => window.__fighterLab.game()?.phase === 'playing', { timeout: 30000 });
  await page.evaluate(() => { const g = window.__fighterLab.game(); g.sim.fighters.slice(0).forEach((f) => g.setBot(f.id, true)); });
  const samples = [];
  for (let i = 0; i < 12; i++) {
    await sleep(1000);
    samples.push(await page.evaluate(() => {
      const g = window.__fighterLab.game();
      const sc = g.scene;
      const e = sc.getEngine();
      return { fps: e.getFps(), draw: e._drawCalls?.current ?? -1, active: sc.getActiveMeshes().length, tris: sc.getActiveIndices() / 3 };
    }));
  }
  const info = await page.evaluate(() => {
    const g = window.__fighterLab.game();
    const sc = g.scene;
    const isChar = (m) => /^(arenaChar|char|nameplate|charPopup|arenaFx)/i.test(m.name) || (m.parent && /arenaChar/.test(m.parent.name ?? ''));
    const meshes = sc.meshes.length;
    const charMeshes = sc.meshes.filter(isChar).length;
    return { meshes, charMeshes, envMeshes: meshes - charMeshes, materials: sc.materials.length, textures: sc.textures.length, lights: sc.lights.length, particleSystems: sc.particleSystems.length };
  });
  // ripartizione: mesh attive dei personaggi (figlie di arenaChar) e dell'ambiente (il resto: palco, cielo, HUD escluso)
  const split = await page.evaluate(() => {
    const sc = window.__fighterLab.game().scene;
    const under = (m) => { for (let p = m; p; p = p.parent) if (p.name === 'arenaChar') return true; return false; };
    const act = sc.getActiveMeshes().data.slice(0, sc.getActiveMeshes().length);
    const chars = act.filter(under).length;
    return { chars, env: act.length - chars };
  });
  const envOnly = { draw: split.env, active: split.env };
  console.log(`ripartizione mesh attive: ambiente ${split.env} · personaggi (5) ${split.chars}`);
  const avg = (k) => (samples.reduce((a, s) => a + s[k], 0) / samples.length).toFixed(1);
  console.log(JSON.stringify(info));
  console.log(`draw call medie ${avg('draw')} (max ${Math.max(...samples.map((s) => s.draw))}) · mesh attive ${avg('active')} · triangoli ${avg('tris')} · FPS headless ${avg('fps')}`);
  console.log(errs.length ? '❌ errori: ' + errs.join(' | ') : '✅ nessun errore di pagina');
  console.log('NOTA: SwiftShader (CPU) — i numeri di FPS NON rappresentano una GPU vera; contano mesh/materiali/draw call.');
} finally {
  await browser.close();
}
