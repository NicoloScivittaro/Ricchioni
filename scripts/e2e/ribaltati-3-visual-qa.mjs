import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
process.env.HOST_URL='http://localhost:5179/?quality=high';process.env.CTRL_URL='http://localhost:5179/controller.html';
const {launch,createRoomOnHost,addPhone,hostEval,sleep}=await import('./lib.mjs');
const {gameEval,until}=await import('./padmock.mjs');
const browser=await launch(),report={layouts:[],errors:[]},out='docs/agent-work/ribaltati-3';
try{
 const {page,code}=await createRoomOnHost(browser,{targetKeyPresses:3});page.on('pageerror',e=>report.errors.push(e.message));for(let i=0;i<5;i++)await addPhone(browser,code,'QA '+i,i);
 await hostEval(page,gm=>{gm.selectMinigame('kart3d');gm.startGame();});const G=(f,a)=>gameEval(page,'kart3d',f,a);await until(()=>G(g=>g.race.phase==='racing'),90000,'race');await sleep(3000);
 await G(g=>{g.paused=true;g.engine.setHardwareScalingLevel(1);g.engine.setHardwareScalingLevel=()=>{};window.__oldKart=g;});
 for(const n of [2,3,4,5]){
  await G((g,n)=>{g.cameraManager.applyLayout(g.order.slice(0,n));g.hud.layout(g.order.slice(0,n));for(const [i,id]of g.order.slice(0,n).entries()){const k=g.karts.get(id);Object.assign(k,{distance:g.spline.totalLength*(.05+i*.185),lateral:0,heading:0,speed:30,jumpHeight:0,stunTimer:0,drifting:false,heldItem:null});g.entities.get(id).updateVisual(k,g.spline);g.hud.update(id,k,5,3,[.55,1.2,2.1],0);g.hud.flash(id,i===0?'BUCA DEL COMUNE':'ULTIMO GIRO','#ffd166',1.5);for(let j=0;j<90;j++)g.cameraManager.update(1/60,id,k,g.spline);}g.scene.render();},n);
  await sleep(150);const result=await G((g,n)=>{g.hud.layout(g.order.slice(0,n));g.scene.render();return g.order.slice(0,n).map(id=>{const e=g.hud.entries.get(id);return{font:e.posText._font,flash:e.flashText._font,ability:e.abilityLabel.text,size:e.adt.getSize(),panel:{w:e.panel.widthInPixels,h:e.panel.heightInPixels}};});},n);
  for(const e of result){const px=Number(/([\d.]+)px/.exec(e.font)?.[1]);assert.ok(px<=41,`position font ${e.font} in ${n} views`);if(n>=3)assert.ok(Number(/([\d.]+)px/.exec(e.flash)?.[1])<=20);assert.ok(e.ability.includes('\n'));}
  report.layouts.push({n,entries:result});await page.screenshot({path:`${out}/layout-${n}.png`});
 }
 report.animation=await G(g=>{const id=g.order[0],k=g.karts.get(id),e=g.entities.get(id);k.jumpHeight=1.1;k.jumpVelocity=-4;e.updateVisual(k,g.spline);k.jumpHeight=0;k.jumpVelocity=0;e.updateVisual(k,g.spline);const compression=e.carriage.position.y;k.steerVisual=.8;e.updateVisual(k,g.spline);return{compression,steer:e.frontPivots[0].rotation.y,wheels:e.wheels.length,bodyVertices:e.body.getTotalVertices(),skins:[...g.entities.values()].map(e=>e.goblinDebug())};});
 assert.ok(report.animation.compression<-.03);assert.ok(report.animation.steer>.3);assert.equal(report.animation.wheels,4);assert.ok(report.animation.skins.filter(Boolean).every(s=>s.state==='ready'));
 report.occlusion=await G(g=>{
  const blockers=g.scene.meshes.filter(m=>/gateBanner|cpBar|sectorBeam|loadingCraneBeam|viaductCrossbeams|coastalDetailBatch|coastalStaticBatch|batchedTrackGuide/.test(m.name)),hits=[];let samples=0;
  for(const n of [2,3,4,5]){g.cameraManager.applyLayout(g.order.slice(0,n));for(let sector=0;sector<28;sector++)for(const [i,id]of g.order.slice(0,n).entries()){
   const k=g.karts.get(id);k.distance=g.spline.totalLength*sector/28;k.lateral=i%2?3:-3;k.heading=0;k.jumpHeight=sector%3===0?1:0;
   for(let j=0;j<90;j++)g.cameraManager.update(1/60,id,k,g.spline);
   const cam=g.cameraManager.rigs.get(id).camera,target=g.spline.worldPoint(k.distance,k.lateral,.8+k.jumpHeight),ray=g.scene.createPickingRay(0,0,undefined,cam);ray.origin.copyFrom(cam.position);const delta=target.subtract(cam.position);ray.length=delta.length();ray.direction.copyFrom(delta.normalize());
   for(const m of blockers){const hit=ray.intersectsMesh(m,false);if(hit.hit&&hit.distance>0&&hit.distance<ray.length-.6)hits.push({n,sector,id:i,mesh:m.name,distance:hit.distance});}samples++;
  }}return{samples,hits};
 });
 assert.equal(report.occlusion.hits.length,0,'structures do not block camera-to-kart ray');
 await hostEval(page,gm=>gm.restartMatch());await until(()=>hostEval(page,gm=>gm.state.phase==='LOBBY'),20000,'lobby');await until(()=>page.evaluate(()=>window.__oldKart.engine.isDisposed),5000,'engine disposal');report.cleanup=await page.evaluate(()=>({engineDisposed:window.__oldKart.engine.isDisposed,sceneDisposed:window.__oldKart.scene.isDisposed,particles:window.__oldKart.scene.particleSystems.length,canvases:document.querySelectorAll('canvas').length}));assert.equal(report.cleanup.engineDisposed,true);assert.equal(report.cleanup.sceneDisposed,true);assert.equal(report.cleanup.particles,0);assert.equal(report.cleanup.canvases,1);assert.deepEqual(report.errors,[]);console.log(JSON.stringify(report));
}finally{writeFileSync(`${out}/visual-qa.json`,JSON.stringify(report,null,2));await browser.close();}
