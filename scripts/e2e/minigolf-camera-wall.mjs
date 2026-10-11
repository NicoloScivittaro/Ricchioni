import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {launch,createRoomOnHost,addPhone,hostEval,hostSnapshot,sleep} from './lib.mjs';
import {gameEval,startGame,until} from './padmock.mjs';
const out='docs/agent-work/minigolf-redesign',browser=await launch(),rows=[];
try{
 const {page,code}=await createRoomOnHost(browser,{targetKeyPresses:3});for(let i=0;i<5;i++)await addPhone(browser,code,'Golfer'+i,i);const G=(f,a)=>gameEval(page,'minigolf',f,a);
 await startGame(page,'minigolf');await until(()=>G(g=>g.match.aiming),50000,'aim');
 await G(async g=>{const u=performance.getEntriesByType('resource').map(e=>e.name).find(n=>n.includes('/minigolfCourses.ts'));if(g.players.length!==5)throw new Error('expected five golfers');g.match.courses[0]=(await import(u)).COURSES[0];g.match.spawn();g.match.activeIndex=0;g.match.phase='playing';g.match.stage='aim';g.paused=true;g.courseIndex=-1;g.syncCourse();Object.assign(g.match.active.ball,{x:0,z:13.5,y:.28,vx:0,vy:0,vz:0,grounded:true,readyFor:1});
  window.__wallRender=()=>{g.visuals.update(g.players,g.match.course,0,[],1/60,g.match.active.id,true);g.cameraRig.update(g.match.active,g.match.course,0,[],false,1/60);g.hud.update(g.match,0);g.updateCharacters(1/60);g.scene.render();};g.engine.runRenderLoop(window.__wallRender);
 });
 for(const i of[0,4,8,12]){await G((g,i)=>{g.match.active.aim={x:Math.sin(i*Math.PI/8),z:Math.cos(i*Math.PI/8)};g.cameraRig.reset();},i);await sleep(700);
  const row=await G(g=>{const V=g.camera.position.constructor,M=g.scene.getTransformMatrix().constructor,b=g.match.active.ball,vp=g.camera.viewport.toGlobal(g.engine.getRenderWidth(),g.engine.getRenderHeight()),up=g.camera.getDirection(new V(0,1,0)),p=new V(b.x,b.y,b.z),proj=q=>V.Project(q,M.Identity(),g.scene.getTransformMatrix(),vp);
   const center=proj(p),bottom=proj(p.subtract(up.scale(.28)));return{x:center.x/vp.width,y:center.y/vp.height,bottom:bottom.y/vp.height,eyeY:g.camera.position.y,ballY:b.y,frame:[vp.width,vp.height],meshes:g.scene.meshes.length};});
  assert.ok(row.bottom<580/720,'ball stays above power HUD');assert.ok(row.x>.1&&row.x<.9);rows.push({direction:i,...row});await page.screenshot({path:`${out}/camera-wall-${i}.png`});
 }
 await hostEval(page,gm=>gm.restartMatch());await until(async()=>(await hostSnapshot(page)).phase==='LOBBY',15000,'lobby');assert.equal(await page.evaluate(()=>document.querySelectorAll('canvas').length),1);console.log('PASS final back-wall camera: four aim directions, five balls, ball above power HUD, original renderer and lobby cleanup.');
}finally{writeFileSync(`${out}/camera-wall.json`,JSON.stringify(rows,null,2));await browser.close();}
