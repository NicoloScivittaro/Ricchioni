import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { launch, HOST_URL, sleep } from './lib.mjs';
const out='docs/agent-work/characters-animation-update',browser=await launch();
try {
  const page=await browser.newPage(),errors=[],report={};
  page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(`${HOST_URL}?characters=1&goblin=new&buttafuori=new&judoka=new&ciro=new`,{waitUntil:'load'});
  await page.waitForFunction(()=>window.__gallery?.sample().filter(s=>s?.state==='ready').length===4,{timeout:60000});
  report.mixed=await page.evaluate(()=>window.__gallery.sample().filter(Boolean));
  assert.deepEqual(report.mixed.map(d=>[d.character,d.clips]).sort(),[['goblin',52],['buttafuori',54],['judoka',49],['ciro',59]].sort());
  assert.equal(await page.$('#dottore-new'),null);
  for(const [ns,layout,mode] of [['goblin','setLayout','setGoblin'],['buttafuori','setButtafuoriLayout','setButtafuori'],['judoka','setJudokaLayout','setJudoka']]) {
    await page.evaluate(layout=>{window.__gallery[layout]('compare');window.__gallery.setState('IDLE');window.__gallery.setCamera(-Math.PI/2,1.32,6.5);},layout);
    await page.waitForFunction(()=>window.__gallery.sample().filter(s=>s?.state==='ready').length===1,{timeout:60000});
    await sleep(500);await page.screenshot({path:`${out}/shots/${ns}-old-new.png`});
    await page.evaluate(layout=>window.__gallery[layout](5),layout);
    await page.waitForFunction(()=>window.__gallery.sample().filter(s=>s?.state==='ready').length===5,{timeout:60000});
    const five=await page.evaluate(()=>window.__gallery.sample());
    assert.equal(new Set(five.map(s=>s.skeletonId)).size,5);
    assert.equal(new Set(five.flatMap(s=>s.geometryIds).filter(i=>i>=0)).size,1);
    await page.evaluate(mode=>window.__gallery[mode]('old'),mode);
    assert.ok(await page.evaluate(()=>window.__gallery.sample().every(s=>s===null)));
    await page.evaluate(mode=>window.__gallery[mode]('new'),mode);
    await page.waitForFunction(()=>window.__gallery.sample().filter(s=>s?.state==='ready').length===5,{timeout:60000});
    report[ns]={five,oldNew:true};
  }
  await page.evaluate(()=>document.querySelector('#char-gallery button:last-child').click());
  const counters=await page.evaluate(async()=>(await import('/src/minigames/characters/goblinVisual.ts')).goblinVisualCounters());
  assert.equal(counters.liveInstances,0);
  await page.goto(`${HOST_URL}?debug=1&goblin=new&buttafuori=new&judoka=new`,{waitUntil:'load'});
  await page.setRequestInterception(true);
  page.on('request',r=>/_(?:casacarbo)\.glb/.test(r.url())?r.abort('failed'):r.continue());
  await page.evaluate(async()=>{
    const {ArenaEntity}=await import('/src/minigames/arena/arenaEntity.ts');
    const coreUrl=performance.getEntriesByType('resource').map(e=>e.name).find(n=>/\/@babylonjs_core\.js\?/.test(n));
    const {Engine,Scene,DynamicTexture}=await import(coreUrl);
    const engine=new Engine(document.createElement('canvas')),scene=new Scene(engine),dot=new DynamicTexture('dot',16,scene);
    const entities=['goblin','buttafuori','judoka'].map(ns=>new ArenaEntity(scene,dot,'#ef4444',ns,'🥊','PROBE',null,{context:'casacarbo'}));
    window.__fallback={entities,engine};
  });
  await page.waitForFunction(()=>window.__fallback.entities.every(e=>e.goblinDebug()?.state==='error'),{timeout:30000});
  report.fallback=await page.evaluate(()=>{
    const {entities,engine}=window.__fallback;
    const physics=Object.freeze({x:0,y:0,z:0,vx:0,vz:0,facing:0,alive:true,falling:false,spin:0,dashing:false,stunTime:0,hitFlash:0});
    const rows=entities.map(entity=>{
      const before=JSON.stringify(physics);
      entity.overrideImportedAnimation('fallBackward',.6);entity.updateVisual(physics,.016,performance.now());
      const imported=entity.goblinDebug(),fallbackVisible=entity.bodyMeshes.some(m=>m.isEnabled()&&m.isVisible);
      entity.setBodyVisible(false);const hidden=entity.bodyMeshes.every(m=>!m.isEnabled());
      entity.setBodyVisible(true);const restored=entity.bodyMeshes.some(m=>m.isEnabled()&&m.isVisible);
      entity.dispose();return {imported,fallbackVisible,hidden,restored,physicsUnchanged:before===JSON.stringify(physics)};
    });
    engine.dispose();return rows;
  });
  assert.ok(report.fallback.every(r=>r.imported.state==='error'&&r.imported.bones===0&&r.fallbackVisible&&r.hidden&&r.restored&&r.physicsUnchanged));
  assert.deepEqual(errors,[]);
  writeFileSync(`${out}/gallery-fallback.json`,JSON.stringify({report,counters,errors},null,2));
  console.log('PASS: mixed Gallery, OLD/NEW comparisons, five independent rigs per character, original Dottore, disposal; three failed downloads retain functional procedural skins');
}finally{await browser.close();}
