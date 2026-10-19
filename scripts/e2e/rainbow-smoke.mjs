import {writeFileSync} from 'node:fs';
process.env.HOST_URL='http://localhost:5180/?quality=high';process.env.CTRL_URL='http://localhost:5180/controller.html';
const {launch,createRoomOnHost,addPhone,hostEval,sleep}=await import('./lib.mjs');
const {gameEval,until}=await import('./padmock.mjs');
const browser=await launch(),errors=[];let page;
try{
 const room=await createRoomOnHost(browser);page=room.page;page.on('pageerror',e=>errors.push(e.message));
 const phone=await addPhone(browser,room.code,'RAINBOW',0);
 // The final catalogue card must select the variant using the ordinary UI.
 await page.keyboard.press('ArrowLeft');await until(()=>hostEval(page,gm=>gm.state.selectedKartTrackId==='arcobaleno'),5000,'variant');
 console.log('SELECTION',await hostEval(page,gm=>({id:gm.state.selectedMinigameId,track:gm.state.selectedKartTrackId})));
 await hostEval(page,gm=>gm.startGame());
 await until(()=>gameEval(page,'kart3d',g=>g.race.phase==='racing'),120000,'loaded');
 const data=await gameEval(page,'kart3d',g=>({ready:!!g.rainbow,L:g.spline.totalLength,gaps:g.rainbow?.gaps,meshes:g.scene.meshes.filter(m=>m.name==='Object_6'||m.name==='Object_7').map(m=>{m.computeWorldMatrix(true);const b=m.getBoundingInfo().boundingBox;return {name:m.name,min:b.minimumWorld.asArray(),max:b.maximumWorld.asArray()};}),karts:g.karts.size,cameras:g.scene.activeCameras.length}));
 console.log(JSON.stringify(data));
 await page.screenshot({path:'docs/agent-work/rainbow-glide/first-import.png'});
 await gameEval(page,'kart3d',g=>{g.paused=true;const k=g.karts.get(g.order[0]);k.distance=g.rainbow.gaps[0].launch+140;k.glideStart=g.rainbow.gaps[0].launch;k.glideEnd=g.rainbow.gaps[0].landing;k.flight='GLIDE';k.lateral=0;k.heading=0;k.jumpHeight=g.spline.flightHeightAt(k.distance);k.absHeading=g.trackAngleAt(k.distance);g.entities.get(k.playerId).updateVisual(k,g.spline);g.wings.get(k.playerId).update(1,true,0);for(let i=0;i<180;i++)g.cameraManager.update(1/60,k.playerId,k,g.spline);g.scene.render();});
 await page.screenshot({path:'docs/agent-work/rainbow-glide/first-glide.png'});
 writeFileSync('docs/agent-work/rainbow-glide/import-smoke.json',JSON.stringify({data,errors},null,2));
 await hostEval(page,gm=>gm.restartMatch());await sleep(700);await page.evaluate(()=>localStorage.removeItem('ricchioni.hostToken'));await phone.ctx.close();
}finally{await browser.close();}
