import {visualCounters} from './tripo-counters.mjs';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {launch,HOST_URL,sleep} from './lib.mjs';
const browser=await launch(),report={};
try {
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(HOST_URL,{waitUntil:'load'});
 await page.setRequestInterception(true);
 const intercept=r=>/_(?:casacarbo|animated)\.glb/.test(r.url())?r.abort('failed'):r.continue();page.on('request',intercept);
 await page.evaluate(async()=>{
  const {KartEntity}=await import('/src/minigames/kart-race/kartEntity.ts');
  const url=performance.getEntriesByType('resource').map(e=>e.name).find(n=>/\/@babylonjs_core\.js\?/.test(n));
  const core=await import(url),engine=new core.Engine(document.createElement('canvas')),scene=new core.Scene(engine);
  window.__test={core,engine,scene,KartEntity,ids:['goblin','buttafuori','judoka','ciro']};
  window.__test.entities=window.__test.ids.map(id=>new KartEntity(scene,'#22cc88',id));
 });
 await page.waitForFunction(()=>window.__test.entities.every(e=>e.goblinDebug()?.state==='error'),{timeout:30000});
 report.failed=await page.evaluate(()=>window.__test.entities.map(e=>({debug:e.goblinDebug(),fallback:e.driverTorso.isEnabled()&&e.driverHead.isEnabled()&&e.driverArms.every(m=>m.isEnabled())})));
 assert.ok(report.failed.every(r=>r.debug.state==='error'&&r.fallback));
 await page.evaluate(()=>{window.__test.entities.forEach(e=>e.dispose());window.__test.engine.dispose();});
 page.off('request',intercept);await page.setRequestInterception(false);
 await page.goto(`${HOST_URL}?debug=1&goblinDelay=1200`,{waitUntil:'load'});
 await page.evaluate(async()=>{
  const {KartEntity}=await import('/src/minigames/kart-race/kartEntity.ts');
  const url=performance.getEntriesByType('resource').map(e=>e.name).find(n=>/\/@babylonjs_core\.js\?/.test(n));
  const core=await import(url),engine=new core.Engine(document.createElement('canvas')),scene=new core.Scene(engine);
  const entities=['goblin','buttafuori','judoka','ciro'].map(id=>new KartEntity(scene,'#22cc88',id));
  window.__test={entities,scene};entities.forEach(e=>e.dispose());engine.dispose();
 });
 for(let n=0;n<300&&(await visualCounters(page)).abortedLoads<4;n++)await sleep(100);
 report.late={counters:await visualCounters(page),disposed:await page.evaluate(()=>window.__test.scene.isDisposed)};
 assert.equal(report.late.counters.liveInstances,0);assert.equal(report.late.disposed,true);assert.equal(report.late.counters.abortedLoads,4);assert.deepEqual(errors,[]);
 writeFileSync('docs/agent-work/general-polish/kart-fallback.json',JSON.stringify({report,errors},null,2));
 console.log('PASS: all four failed Kart imports retain procedural drivers; immediate disposal before delayed imports leaves no live instance or page error');
}finally{await browser.close();}
