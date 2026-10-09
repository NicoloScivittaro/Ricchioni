import {visualCounters} from './tripo-counters.mjs';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { launch, createRoomOnHost, addPhone, sleep } from './lib.mjs';
import { startGame, until } from './padmock.mjs';
const out='docs/agent-work/general-polish';
const browser=await launch(),errors=[];
try {
  const {page,code}=await createRoomOnHost(browser,{targetKeyPresses:2});
  page.on('pageerror',e=>errors.push(String(e)));
  for(const [name,index] of [['Goblin',0],['BOSCHI',1],['Carbo',3],['Ciro',4]])await addPhone(browser,code,name,index);
  await startGame(page,'casacarbo');
  await until(async()=>await page.evaluate(()=>window.__casacarbo?.phase==='playing'),30000,'Casa Carbo playing');
  await page.waitForFunction(()=>[...window.__casacarbo.entities.values()].every(e=>e.goblinDebug()?.state==='ready'),{timeout:60000});
  const report=await page.evaluate(()=>{
    const g=window.__casacarbo;g.setPaused(true);g.hud.clearCountdown();
    for(const p of g.sim.players){Object.assign(p,{vx:0,vy:0,bucket:0,dashT:0,slipT:0,scooping:false,squeegee:false,containing:null,holdKey:'',holdT:0});p.ab.blockT=p.ab.windupT=0;}
    const rows=[],clocks=[];
    for(const p of g.sim.players){
      const e=g.entities.get(p.id),handle=e.goblinHandle(),skeleton=handle.skeleton.uniqueId,meshIds=handle.meshes.map(m=>m.uniqueId);
      const sample=(phase,expected)=>{
        const before=JSON.stringify(g.sim.players),water=Array.from(g.sim.h);
        for(let i=0;i<8;i++)g.updateVisuals(.05,performance.now());g.scene.render();
        const debug=e.goblinDebug(),meshes=e.goblinHandle().meshes;
        rows.push({character:p.characterId,phase,expected,debug,sameSkeleton:e.goblinHandle().skeleton.uniqueId===skeleton,sameMeshes:JSON.stringify(meshes.map(m=>m.uniqueId))===JSON.stringify(meshIds),visible:meshes.filter(m=>m.getTotalVertices()>0).every(m=>m.isEnabled()&&m.isVisible),finite:meshes.filter(m=>m.getTotalVertices()>0).every(m=>Array.from(m.getPositionData(true,true)).every(Number.isFinite)),physicsUnchanged:before===JSON.stringify(g.sim.players)&&water.every((v,i)=>v===g.sim.h[i]),bucketY:g.buckets.get(p.id).position.y});
      };
      sample('idle','idle');p.vx=100;p.bucket=3;sample('bucketWalk','bucketWalk');
      p.scooping=true;sample('scoopB','scoopB');
      const first=e.goblinDebug().animator;g.updateVisuals(.05,performance.now());const next=e.goblinDebug().animator;
      clocks.push({character:p.characterId,continues:next.token===first.token&&next.seconds>first.seconds});
      p.scooping=false;p.squeegee=true;sample('squeegee','squeegee');
      p.squeegee=false;p.containing='front';sample('contain',p.characterId==='goblin'?'block':'floodBlock');
      p.containing=null;g.handle({t:'drain',id:p.id,via:'bucket',drain:'bagno',amount:3});sample('bucketEmpty','bucketEmpty');
      p.slipT=.6;sample('slip','fallBackward');p.slipT=0;sample('getUp','getUp');
      p.dashT=.3;sample('dash','dash');p.dashT=0;p.vx=0;p.bucket=0;sample('idle-return','idle');
      if(p.characterId==='buttafuori'){
        p.ab.blockT=2;p.ab.blockDoor='front';g.handle({t:'ability',id:p.id,a:'boschi_block',door:'front'});sample('ability-block','floodBlock');
        p.ab.blockT=0;g.handle({t:'ability',id:p.id,a:'boschi_release'});
        for(let i=0;i<90;i++)g.updateVisuals(.1,performance.now());sample('ability-release','idle');
      }
      if(p.characterId==='judoka'){
        g.handle({t:'ability',id:p.id,a:'carbo_dam'});sample('ability-build','floodBarrier');
        g.updateVisuals(1.01,performance.now());sample('ability-build-return','idle');
      }
    }
    for(const p of g.sim.players)p.scooping=true;
    for(let i=0;i<20;i++)g.updateVisuals(.05,performance.now());g.scene.render();
    return {rows,clocks,skeletonIds:[...g.entities.values()].map(e=>e.goblinHandle().skeleton.uniqueId)};
  });
  const counts={goblin:52,buttafuori:54,judoka:49,ciro:59};
  for(const r of report.rows){
    assert.equal(r.debug.animator.name,`${r.character}.${r.expected}`,`${r.character} ${r.phase}`);
    assert.equal(r.debug.clips,counts[r.character]);assert.equal(r.debug.bones,65);assert.equal(r.debug.activeTracks,195);
    assert.ok(r.sameSkeleton&&r.sameMeshes&&r.visible&&r.finite&&r.physicsUnchanged,`${r.character} ${r.phase}`);
    assert.ok(Number.isFinite(r.bucketY)&&r.bucketY>=.19,r.phase);
  }
  assert.ok(report.clocks.every(c=>c.continues),'held gestures do not restart every frame');
  assert.equal(new Set(report.skeletonIds).size,4,'four independent skeletons');
  await page.screenshot({path:`${out}/shots/casacarbo-four-characters.png`});
  const hud=await page.evaluate(()=>{
    const g=window.__casacarbo;g.hud.announce('IL TEMPORALE È AL MASSIMO','TUTTE E DUE LE PORTE!','#f87171',1800,46);g.scene.render();
    const during={feed:g.hud.feed.isVisible,banner:g.hud.bannerBox.isVisible};
    g.hud.endingLayout();g.scene.render();
    const ending={feed:g.hud.feed.isVisible,banner:g.hud.bannerBox.isVisible};
    return {during,ending};
  });
  assert.equal(hud.during.feed,false);assert.equal(hud.during.banner,true);assert.equal(hud.ending.feed,true);assert.equal(hud.ending.banner,true);
  await page.evaluate(async()=>{
    const g=window.__casacarbo;
    const url=performance.getEntriesByType('resource').map(e=>e.name).find(n=>/\/@babylonjs_core\.js\?/.test(n));
    const {SceneInstrumentation}=await import(url),ins=new SceneInstrumentation(g.scene);
    ins.captureFrameTime=true;ins.captureRenderTime=true;
    window.__perf={ins,rows:[]};
    g.scene.onAfterRenderObservable.add(()=>window.__perf.rows.push({frameMs:ins.frameTimeCounter.current,renderMs:ins.renderTimeCounter.current,drawCalls:ins.drawCallsCounter.current,samplerMs:[...g.entities.values()].reduce((s,e)=>s+(e.goblinVisual?.animator?.sampleMs??0),0),renderer:g.engine.getGlInfo().renderer}));
    // Casa Carbo pauses its complete loop. Render the real scene/poses while leaving simulation frozen.
    g.engine.runRenderLoop(()=>{g.updateVisuals(.016,performance.now());g.scene.render();});
  });
  await page.waitForFunction(()=>window.__perf.rows.length>=40,{timeout:60000});
  const perf=await page.evaluate(()=>window.__perf.rows.slice(5,40));
  const ending=await page.evaluate(()=>{
    const g=window.__casacarbo;g.phase='ending';
    for(const e of g.entities.values())e.playVictory();
    for(let i=0;i<8;i++)g.updateVisuals(.05,performance.now());
    return [...g.entities.values()].map(e=>e.goblinDebug());
  });
  assert.ok(ending.every(d=>d.animator.name===`${d.character}.victory`),'end of game clears water gestures');
  await page.evaluate(()=>{window.__perf.ins.dispose();window.__casacarbo.dispose();});
  const counters=await visualCounters(page);
  assert.equal(counters.liveInstances,0);assert.deepEqual(errors,[]);
  writeFileSync(`${out}/casacarbo.json`,JSON.stringify({report,ending,perf,counters,errors,hud},null,2));
  console.log('PASS: four phones/characters; native water actions, BOSCHI block, Carbo barrier, continuous loops, same skins, unchanged players/water, victory and disposal');
}finally{await browser.close();}
