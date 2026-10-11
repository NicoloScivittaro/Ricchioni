import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {launch,createRoomOnHost,addPhone,hostEval,hostSnapshot} from './lib.mjs';
import {gameEval,startGame,until} from './padmock.mjs';
const browser=await launch(),report={errors:[]};
try {
 const {page,code}=await createRoomOnHost(browser,{targetKeyPresses:3}); page.on('pageerror',e=>report.errors.push(String(e)));
 for(let i=0;i<5;i++) await addPhone(browser,code,`Olio${i}`,i);
 const G=(fn,arg)=>gameEval(page,'kart3d',fn,arg);
 await startGame(page,'kart3d'); await until(async()=>await G(g=>g.race.phase==='racing'),30000,'via');
 await until(async()=>await G(g=>[...g.entities.values()].filter(e=>e.goblinDebug?.()).every(e=>e.goblinDebug().state==='ready')),60000,'modelli pronti');
 report.visual=await G(g=>{
   g.engine.stopRenderLoop(); g.ctx.input.reset(); g.soloBots.ids.clear();
   const ks=[...g.karts.values()];
   for(const [i,k] of ks.entries()){k.distance=60+i*75;k.lateral=0;k.speed=0;k.heading=0;k.absHeading=g.trackAngleAt(k.distance);k.invulnTimer=0;k.finished=false;}
   for(const k of ks){const drop={...k,distance:k.distance+17.5};g.items.spawnTrap(drop);}
   for(let i=0;i<60;i++) for(const k of ks){g.entities.get(k.playerId).updateVisual(k,g.spline);g.cameraManager.update(.05,k.playerId,k,g.spline);}
   g.scene.render();
   return {cameras:g.scene.activeCameras.length,traps:g.items.traps.length,positions:g.items.traps.map(t=>({distance:t.distance,vertices:t.mesh.getTotalVertices(),worldBounds:t.mesh.getBoundingInfo().boundingBox.maximumWorld.asArray()}))};
 });
 assert.equal(report.visual.cameras,5);assert.equal(report.visual.traps,5);
 await G(async g=>{await g.scene.whenReadyAsync();g.scene.render();});
 await page.screenshot({path:'docs/agent-work/physics-update/oil-five-1280.png'});
 await page.setViewport({width:1920,height:1080});await G(g=>{g.engine.resize();g.scene.render();});
 await page.screenshot({path:'docs/agent-work/physics-update/oil-five-1920.png'});
 report.effect=await G(g=>{
   const k=[...g.karts.values()][1], t=g.items.traps[0];
   k.distance=t.distance-6;k.lateral=t.lateral;k.speed=44;k.invulnTimer=0;g.items.update(.001,[k],()=>1,1);
   k.distance=t.distance+4;g.items.update(.001,[k],()=>1,1);
   const first={speed:k.speed,oil:k.oilTimer,stun:k.stunTimer};
   const meshes=g.scene.meshes.length,mats=g.scene.materials.length;
   for(const trap of g.items.traps) trap.life=0;g.items.update(.001,[k],()=>1,1);g.scene.render();
   return {first,before:{meshes,mats},after:{meshes:g.scene.meshes.length,mats:g.scene.materials.length,traps:g.items.traps.length}};
 });
 assert.equal(report.effect.first.speed,44);assert.equal(report.effect.first.stun,0);assert.equal(report.effect.first.oil,1.6);assert.equal(report.effect.after.traps,0);
 assert.equal(report.effect.before.mats-report.effect.after.mats,15);
 await hostEval(page,gm=>gm.restartMatch()); await until(async()=>(await hostSnapshot(page)).phase==='LOBBY',15000,'lobby');
 assert.equal(await page.evaluate(()=>document.querySelectorAll('canvas').length),1);assert.deepEqual(report.errors,[]);
 writeFileSync('docs/agent-work/physics-update/oil-browser.json',JSON.stringify(report,null,2));
 console.log('PASS browser olio: cinque viewport, strada e rampe, sweep veloce, no freno, scadenza mesh/materiali, lobby. Screenshot 1280/1920.');
} finally {await browser.close();}
