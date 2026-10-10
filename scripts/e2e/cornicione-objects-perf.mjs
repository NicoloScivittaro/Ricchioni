import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { launch, HOST_URL, sleep } from './lib.mjs';
const browser=await launch();
try {
  const page=await browser.newPage(), errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(`${HOST_URL}?fighter=1&debug=1`,{waitUntil:'load'});
  await page.waitForFunction(()=>window.__fighterLab?.game(),{timeout:60000});
  await page.evaluate(()=>window.__fighterLab.restart(5,'goblin'));
  await page.waitForFunction(()=>{
    const g=window.__fighterLab.game();return g.phase==='playing'&&[...g.entities.values()].filter(e=>e.goblinDebug?.()).every(e=>e.goblinDebug().state==='ready');
  },{timeout:90000});
  await page.evaluate(()=>{const g=window.__fighterLab.game();g.world.fighters.forEach(f=>g.setBot(f.id,true));});
  const samples=[];
  for(let i=0;i<12;i++) {
    await sleep(1000);
    samples.push(await page.evaluate(()=>{
      const g=window.__fighterLab.game(),scene=g.scene,engine=g.engine;
      return {fps:engine.getFps(),activeMeshes:scene.getActiveMeshes().length,drawCalls:engine._drawCalls?.current??null,
        projectiles:g.world.projectiles.length,fragments:g.objects.fragments.filter(f=>f.t>0).length,
        objectMeshes:scene.meshes.filter(m=>/^(objectPart|objectLabel|objectFragment|fragmentCoin|fragmentDrop|fragmentGlass)$/.test(m.name)).length};
    }));
  }
  const pool=await page.evaluate(()=>{
    const g=window.__fighterLab.game(),gl=g.engine._gl,ext=gl?.getExtension('WEBGL_debug_renderer_info');
    return {props:g.objects.props.size,fragments:g.objects.fragments.length,templates:g.objects.shapeTemplates.length,
      materialCount:g.objects.materials.length,labelTextures:g.objects.textures.length,
      renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):null};
  });
  assert.equal(pool.props,5);assert.equal(pool.fragments,60);
  assert.ok(samples.every(s=>s.objectMeshes===samples[0].objectMeshes&&s.fragments<=60&&s.projectiles<=5));
  assert.deepEqual(errors,[]);
  const report={headless:true,seconds:12,pool,samples,averageFps:samples.reduce((n,s)=>n+s.fps,0)/samples.length,errors};
  writeFileSync('docs/agent-work/cornicione-throws/performance.json',JSON.stringify(report,null,2));
  console.log('PASS: five actors, fixed object/fragment allocation, no pageerrors. Headless render measurements:',JSON.stringify(pool));
} finally { await browser.close(); }
