import {visualCounters} from './tripo-counters.mjs';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {launch,HOST_URL,sleep} from './lib.mjs';
const out='docs/agent-work/general-polish';mkdirSync(`${out}/shots`,{recursive:true});
const browser=await launch(),report={};
try {
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(`${HOST_URL}?debug=1`,{waitUntil:'load'});
 await page.evaluate(async()=>{
  const {ArenaEntity}=await import('/src/minigames/arena/arenaEntity.ts');
  const url=performance.getEntriesByType('resource').map(e=>e.name).find(n=>/\/@babylonjs_core\.js\?/.test(n));
  const core=await import(url),{Engine,Scene,ArcRotateCamera,HemisphericLight,Vector3,Color4,DynamicTexture}=core;
  for(const el of document.body.children)el.style.visibility='hidden';
  const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;canvas.style.cssText='position:fixed;inset:0;width:100%;height:100%;z-index:999999';document.body.append(canvas);
  const engine=new Engine(canvas,true,{preserveDrawingBuffer:true}),scene=new Scene(engine);scene.clearColor=new Color4(.38,.43,.49,1);
  const camera=new ArcRotateCamera('camera',-Math.PI/2,1.2,13,new Vector3(0,1,0),scene);
  engine.runRenderLoop(()=>scene.render());
  new HemisphericLight('light',Vector3.Up(),scene).intensity=1.1;
  const dot=new DynamicTexture('dot',16,scene);
  window.__probe={core,engine,scene,camera,dot,ArenaEntity,entities:[],base:Object.freeze({x:0,y:0,z:0,vx:0,vz:0,facing:Math.PI,alive:true,falling:false,spin:0,dashing:false,stunTime:0,hitFlash:0,grounded:true}),ids:['goblin','buttafuori','judoka','ciro']};
 });
 for(const context of ['soccer','volley']){
  await page.evaluate(context=>{
   const a=window.__probe;a.entities.forEach(e=>e.dispose());
   a.entities=a.ids.map((ns,i)=>new a.ArenaEntity(a.scene,a.dot,'#22cc88',ns,'','',null,{context,nameplate:false}));
  },context);
  await page.waitForFunction(()=>window.__probe.entities.every(e=>e.goblinDebug()?.state==='ready'),{timeout:60000});
  assert.equal((await visualCounters(page)).liveInstances,4);
  report[context]=await page.evaluate(context=>{
   const a=window.__probe,rows=[];
   const sample=(phase,action,expected,dt=0,extra={})=>{
    for(const [i,e] of a.entities.entries()){
     const state=Object.freeze({...a.base,x:(i-1.5)*3.3,...extra}),before=JSON.stringify(state);
     if(action)action(e);e.updateVisual(state,dt,performance.now());a.scene.render();
     const d=e.goblinDebug(),h=e.goblinHandle();
     rows.push({phase,expected,character:d.character,debug:d,physicsUnchanged:before===JSON.stringify(state),legacy:e.legacyAction,oldHidden:e.bodyMeshes.every(m=>!m.isEnabled()),meshIds:h.meshes.map(m=>m.uniqueId),finite:h.meshes.filter(m=>m.getTotalVertices()>0).every(m=>Array.from(m.getPositionData(true,true)).every(Number.isFinite)),visible:h.meshes.filter(m=>m.getTotalVertices()>0).every(m=>m.isEnabled()&&m.isVisible)});
    }
   };
   for(let n=0;n<10;n++)a.entities.forEach((e,i)=>e.updateVisual({...a.base,x:(i-1.5)*3.3},.05,performance.now()));
   sample('idle',null,'idle');
   if(context==='soccer'){
    for(const k of [.25,.75]){
     a.entities.forEach(e=>e.setCharge(k));
     for(let n=0;n<4;n++)a.entities.forEach((e,i)=>e.updateVisual({...a.base,x:(i-1.5)*3.3},.05,performance.now()));
     sample(`charge-${k}`,null,'frontKick');
    }
    sample('kick',e=>e.playKick(.9),'frontKick');
   }else{
    sample('serve',e=>e.playThrow(),'ballThrow');
    sample('spike',e=>e.playSpike(),'ballThrow');
    sample('receive',e=>e.playAbsorb(),'ballCatch');
   }
   sample('recoil',e=>e.playRecoil(),'knockback');
   for(let n=0;n<15;n++)a.entities.forEach((e,i)=>e.updateVisual({...a.base,x:(i-1.5)*3.3},.05,performance.now()));
   sample('jump',null,null,.016,{y:1,grounded:false,vy:4});
   a.scene.render();return rows;
  },context);
  for(const r of report[context]){
   if(r.expected)assert.equal(r.debug.animator.name,`${r.character}.${r.expected}`);
   assert.ok(r.finite&&r.visible&&r.oldHidden&&r.physicsUnchanged&&!r.legacy,r.phase);
   assert.equal(r.debug.bones,65);assert.equal(r.debug.activeTracks,195);
   if(['kick','serve','spike','receive'].includes(r.phase))assert.equal(r.debug.animator.contactTime,0,'ball contact stays at the existing event instant');
  }
  assert.ok(report[context].every(r=>JSON.stringify(r.meshIds)===JSON.stringify(report[context].find(s=>s.character===r.character).meshIds)),'same body throughout sports actions');
  await page.evaluate(context=>{
   const a=window.__probe;a.entities.forEach((e,i)=>{if(context==='soccer'){e.setCharge(0);e.playKick(.9);}else e.playSpike();e.updateVisual({...a.base,x:(i-1.5)*3.3},0,performance.now());});a.scene.render();
  },context);
  await sleep(200);
  await sleep(200);
 await page.screenshot({path:`${out}/shots/${context}-four-native-actions.png`});
 }
 await page.evaluate(async()=>{
  const a=window.__probe;a.entities.forEach(e=>e.dispose());a.entities=[];
  const {KartEntity}=await import('/src/minigames/kart-race/kartEntity.ts'),{createKartState}=await import('/src/minigames/kart-race/raceTypes.ts'),{buildTrack}=await import('/src/minigames/kart-race/track.ts');
  a.KartEntity=KartEntity;a.createKartState=createKartState;a.spline=buildTrack();
  a.drivers=a.ids.map(ns=>new KartEntity(a.scene,'#22cc88',ns));
  a.camera.target.set(0,.8,0);a.camera.radius=12;a.camera.beta=1.32;
 });
 await page.waitForFunction(()=>window.__probe.drivers.every(e=>e.goblinDebug()?.state==='ready'),{timeout:60000});
 assert.equal((await visualCounters(page)).liveInstances,4);
 report.kart=await page.evaluate(()=>{
  const a=window.__probe,rows=[];
  for(const [i,e] of a.drivers.entries()){
   const ns=a.ids[i],state=a.createKartState(ns,ns,'#22cc88','');Object.assign(state,{speed:15,steerVisual:.8,drifting:true,driftDir:1});
   const before=JSON.stringify(state),meshIds=e.goblinDriver.meshes.map(m=>m.uniqueId);
   for(const phase of ['drive','boost','ability','finish']){
    if(phase==='boost')e.playBoost();if(phase==='ability')e.playAbility();if(phase==='finish')e.playFinish(true);
    e.updateVisual(state,a.spline,.5);e.root.position.set((i-1.5)*3.3,0,0);e.root.rotationQuaternion=a.core.Quaternion.RotationAxis(a.core.Vector3.Up(),Math.PI);
    a.scene.render();const d=e.goblinDebug(),meshes=e.goblinDriver.meshes;
    rows.push({phase,character:ns,debug:d,meshIds:meshes.map(m=>m.uniqueId),sameMeshes:JSON.stringify(meshes.map(m=>m.uniqueId))===JSON.stringify(meshIds),physicsUnchanged:before===JSON.stringify(state),oldHidden:!e.driverTorso.isEnabled()&&!e.driverHead.isEnabled()&&e.driverArms.every(m=>!m.isEnabled()),finite:meshes.filter(m=>m.getTotalVertices()>0).every(m=>Array.from(m.getPositionData(true,true)).every(Number.isFinite)),visible:meshes.filter(m=>m.getTotalVertices()>0).every(m=>m.isEnabled()&&m.isVisible),hips:e.goblinDriver.attachment('HIPS',true)?.asArray(),rightHand:e.goblinDriver.attachment('RIGHT_HAND',true)?.asArray()});
   }
  }
  a.scene.render();return rows;
 });
 for(const r of report.kart){assert.ok(r.debug.seated&&r.debug.seatedApplied&&r.sameMeshes&&r.physicsUnchanged&&r.oldHidden&&r.finite&&r.visible,`${r.character} ${r.phase}`);assert.equal(r.debug.bones,65);assert.equal(r.debug.animationPlaying,false);assert.ok(r.hips.every(Number.isFinite));}
 await sleep(200);
 await page.screenshot({path:`${out}/shots/kart-four-drivers.png`});
 for(let i=0;i<4;i++){
  await page.evaluate(i=>{const a=window.__probe;a.camera.target.set((i-1.5)*3.3,.8,0);a.camera.radius=3.8;a.camera.alpha=-Math.PI*.15;a.camera.beta=1.32;},i);
  await sleep(180);await page.screenshot({path:`${out}/shots/kart-${['goblin','boschi','carbo','ciro'][i]}-side.png`});
 }
 report.particles=await page.evaluate(()=>{
  const a=window.__probe,first=a.drivers[0].boostFx.particleTexture.uniqueId;
  a.drivers.forEach(e=>e.dispose());a.engine.dispose();
  const engine=new a.core.Engine(document.createElement('canvas')),scene=new a.core.Scene(engine),e=new a.KartEntity(scene,'#22cc88','dottore');
  const tex=e.boostFx.particleTexture,result={first,next:tex.uniqueId,sameScene:tex.getScene()===scene,source:tex.getClassName()};
  e.dispose();engine.dispose();return result;
 });
 assert.equal(report.particles.sameScene,true);assert.notEqual(report.particles.first,report.particles.next);
 const counters=await visualCounters(page);
 assert.equal(counters.liveInstances,0);assert.deepEqual(errors,[]);
 writeFileSync(`${out}/sports-drivers.json`,JSON.stringify({report,counters,errors},null,2));
 console.log('PASS: four native skins in Soccer/Volley, charge and contact-at-event poses; seated Kart drivers through drive/boost/ability/finish; no physics writes; fresh particles per scene; disposal');
}finally{await browser.close();}
