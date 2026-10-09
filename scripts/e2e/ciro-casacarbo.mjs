import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { launch, createRoomOnHost, addPhone } from './lib.mjs';
import { startGame, until } from './padmock.mjs';
const out='docs/agent-work/ciro-animation-update';
const browser=await launch(),errors=[];
try {
  const {page,code}=await createRoomOnHost(browser);
  page.on('pageerror',e=>errors.push(String(e)));
  await addPhone(browser,code,'Ciro',4);await addPhone(browser,code,'Carbo',3);
  await startGame(page,'casacarbo');
  await until(async()=>await page.evaluate(()=>window.__casacarbo?.phase==='playing'),30000,'Casa Carbo playing');
  await page.waitForFunction(()=>[...window.__casacarbo.entities.values()].every(e=>e.goblinDebug()?.state==='ready'),{timeout:60000});
  const report=await page.evaluate(()=>{
    const g=window.__casacarbo,p=g.sim.players.find(p=>p.characterId==='ciro'),e=g.entities.get(p.id);
    g.setPaused(true);g.hud.clearCountdown();
    const handle=e.goblinHandle(),skeleton=handle.skeleton.uniqueId,meshIds=handle.meshes.map(m=>m.uniqueId);
    Object.assign(p,{vx:0,vy:0,bucket:0,dashT:0,slipT:0,scooping:false,squeegee:false,containing:null,holdKey:'',holdT:0});
    const rows=[];
    const sample=(phase)=>{
      const before=JSON.stringify(g.sim.players),water=Array.from(g.sim.h);
      for(let i=0;i<8;i++)g.updateVisuals(.05,performance.now());
      g.scene.render();
      const debug=e.goblinDebug(),meshes=e.goblinHandle().meshes;
      rows.push({phase,debug,sameSkeleton:e.goblinHandle().skeleton.uniqueId===skeleton,sameMeshes:JSON.stringify(meshes.map(m=>m.uniqueId))===JSON.stringify(meshIds),visible:meshes.filter(m=>m.getTotalVertices()>0).every(m=>m.isEnabled()&&m.isVisible),finite:meshes.filter(m=>m.getTotalVertices()>0).every(m=>Array.from(m.getPositionData(true,true)).every(Number.isFinite)),physicsUnchanged:before===JSON.stringify(g.sim.players)&&water.every((v,i)=>v===g.sim.h[i]),bucketY:g.buckets.get(p.id).position.y});
    };
    sample('idle');p.vx=100;p.bucket=3;sample('bucketWalk');
    p.scooping=true;sample('scoopB');
    const first=e.goblinDebug().animator;
    g.updateVisuals(.05,performance.now());const next=e.goblinDebug().animator;
    const clockContinues=next.token===first.token&&next.seconds>first.seconds;
    p.scooping=false;p.squeegee=true;sample('squeegee');
    p.squeegee=false;p.containing='front';sample('floodBlock');
    p.containing=null;g.handle({t:'drain',id:p.id,via:'bucket',drain:'bagno',amount:3});sample('bucketEmpty');
    p.slipT=.6;sample('slip');
    p.slipT=0;sample('getUp');
    p.dashT=.3;sample('dash');
    p.dashT=0;p.vx=0;p.bucket=0;sample('idle-return');
    g.phase='ending';e.playVictory();sample('victory');
    return {rows,clockContinues,other:g.sim.players.filter(p=>p.characterId!=='ciro').map(p=>g.entities.get(p.id).goblinDebug()),perf:e.goblinDebug().sampleMs};
  });
  const expected=['idle','bucketWalk','scoopB','squeegee','floodBlock','bucketEmpty','fallBackward','getUp','dash','idle','victory'];
  report.rows.forEach((r,i)=>{
    assert.equal(r.debug.animator.name,`ciro.${expected[i]}`,r.phase);
    assert.equal(r.debug.clips,59);assert.equal(r.debug.bones,65);assert.equal(r.debug.activeTracks,195);
    assert.ok(r.sameSkeleton&&r.sameMeshes&&r.visible&&r.finite&&r.physicsUnchanged,r.phase);
    assert.ok(Number.isFinite(r.bucketY)&&r.bucketY>=.19,r.phase);
  });
  assert.ok(report.clockContinues,'held gestures do not restart every frame');
  assert.ok(report.other.every(r=>r.character==='judoka'&&r.clips===49),'updated Carbo shares scene with Ciro');
  await page.screenshot({path:`${out}/shots/casacarbo.png`});
  await page.evaluate(()=>window.__casacarbo.dispose());
  const counters=await page.evaluate(async()=>(await import('/src/minigames/characters/goblinVisual.ts')).goblinVisualCounters());
  assert.equal(counters.liveInstances,0);assert.deepEqual(errors,[]);
  writeFileSync(`${out}/casacarbo.json`,JSON.stringify({report,counters,errors},null,2));
  console.log('PASS: Ciro Casa Carbo native gestures, continuous loops, same skin/rig, unchanged players/water, updated Carbo, victory restored, disposal');
}finally{await browser.close();}
