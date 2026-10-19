import assert from 'node:assert/strict';import{writeFileSync}from'node:fs';
process.env.HOST_URL='http://localhost:5180/?quality=high';process.env.CTRL_URL='http://localhost:5180/controller.html';
const{launch,createRoomOnHost,addPhone,hostEval,sleep}=await import('./lib.mjs');const{gameEval,until}=await import('./padmock.mjs');
const out='docs/agent-work/primo-karting',browser=await launch(),errors=[],report={};
try{
 const{page,code}=await createRoomOnHost(browser,{targetKeyPresses:3});page.on('dialog',d=>d.accept());page.on('pageerror',e=>errors.push(e.message));const assets=[];page.on('response',r=>{if(/\.glb$/.test(r.url()))assets.push(r.url());});
 const phones=[];for(let i=0;i<5;i++)phones.push(await addPhone(browser,code,'PRIMO '+(i+1),i));
 assert.ok(!assets.some(u=>u.includes('primo_karting')),'GLB is lazy before race');
 for(const id of ['litorale','arcobaleno','sydney','primo']){await hostEval(page,(gm,id)=>gm.selectMinigame('kart3d',id),id);await until(()=>hostEval(page,(gm,id)=>gm.state.selectedKartTrackId===id,id),6000,'select '+id);}
 report.tracks=['litorale','arcobaleno','sydney','primo'];await hostEval(page,gm=>gm.startGame());await until(()=>hostEval(page,gm=>gm.state.phase==='MINIGAME_ROULETTE'),15000,'roulette');await hostEval(page,gm=>gm.skip());await until(()=>hostEval(page,gm=>gm.state.phase==='MINIGAME_MAP_VOTE'),15000,'vote');
 assert.deepEqual(await hostEval(page,gm=>gm.state.mapVote.options.map(m=>m.id)),report.tracks);
 for(const phone of phones){await phone.page.waitForSelector('[data-map-id="primo"]');await phone.page.click('[data-map-id="primo"]');}
 await until(()=>hostEval(page,gm=>Object.values(gm.state.mapVote?.votes??{}).filter(v=>v==='primo').length===5),6000,'five votes');report.vote={options:4,votes:5};
 await phones[0].page.reload({waitUntil:'load'});await phones[0].page.waitForSelector('[data-map-id="primo"][aria-pressed="true"]');report.phoneReconnect=true;
 const G=(fn,arg)=>gameEval(page,'kart3d',fn,arg);await until(()=>G(g=>g.race.phase==='racing'&&!!g.primo),100000,'Primo ready');
 report.map=await hostEval(page,gm=>({mapId:gm.pendingMinigame.mapId,track:gm.pendingMinigame.kartTrackId}));assert.equal(report.map.track,'primo');
 report.layouts=await G(g=>{const seen=[];for(let n=2;n<=5;n++){g.cameraManager.applyLayout(g.order.slice(0,n));g.hud.layout(g.order.slice(0,n));g.scene.render();seen.push({n,cameras:g.scene.activeCameras.length});}g.cameraManager.applyLayout(g.order);g.hud.layout(g.order);return seen;});assert.ok(report.layouts.every(x=>x.n===x.cameras));
 await G(g=>{g.soloBots.ids=new Set(g.karts.keys());for(const p of g.ctx.players)p.bot=true;g.engine.setHardwareScalingLevel(1);g.engine.setHardwareScalingLevel=()=>{};[...g.karts.values()].forEach((k,i)=>{k.distance=g.spline.totalLength*(.04+i*.19);k.lateral=0;k.speed=34;k.absHeading=g.trackAngleAt(k.distance);k.heading=0;});});await sleep(2200);
 report.performance=await G(async g=>{const times=[],start=performance.now();await new Promise(resolve=>{const frame=t=>{times.push(t);if(t-start<8000)requestAnimationFrame(frame);else resolve();};requestAnimationFrame(frame);});const ms=times.slice(1).map((t,i)=>t-times[i]).sort((a,b)=>a-b);return {fps:(times.length-1)*1000/(times.at(-1)-times[0]),p95:ms[Math.floor(ms.length*.95)],width:g.engine.getRenderWidth(),height:g.engine.getRenderHeight(),scale:g.engine.getHardwareScalingLevel(),views:g.scene.activeCameras.length,shadows:g.scene.shadowsEnabled,renderer:g.engine.getGlInfo(),meshes:g.scene.meshes.length,staticBatches:g.scene.meshes.filter(m=>m.name.startsWith('primoBatch')).length,textures:g.scene.textures.length};});
 assert.equal(report.performance.views,5);assert.equal(report.performance.width,1280);assert.equal(report.performance.height,720);assert.equal(report.performance.scale,1);
 await G(g=>{g.paused=true;});await page.screenshot({path:out+'/five-views.png'});
 for(const mode of ['general','grid','corner']){
  await G((g,mode)=>{
   const list=[...g.karts.values()],first=list[0],id=first.playerId,base=mode==='corner'?g.spline.totalLength*.51:0;
   g.cameraManager.applyLayout([id]);g.hud.layout([id]);g.hud.setCountdown('');
   for(const[i,k]of list.entries()){
    const d=base-(mode==='grid'?Math.floor(i/2)*3.6+1:i*4);
    Object.assign(k,{distance:d,lateral:mode==='grid'?(i%2?-1:1)*(2.3+Math.floor(i/2)*.15):(i%2?-1.6:1.6),heading:0,absHeading:g.trackAngleAt(d),speed:mode==='grid'?0:30,jumpHeight:0,jumpVelocity:0,flight:'DRIVE',boostTimer:0,boostPower:0,abilityActive:false,abilityTimer:0,truckMode:false,lightMode:false,stunTimer:0,invulnTimer:0,drifting:false,driftCharge:0,glideLanding:0});
   }
   for(let i=0;i<100;i++)g.cameraManager.update(1/60,id,first,g.spline);g.present(1/60);
   const cam=g.cameraManager.rigs.get(id).camera;cam.layerMask=0x000fffff;cam.maxZ=3000;
   if(mode==='general'){for(const m of g.scene.meshes)if(m.metadata?.primoRoof)m.setEnabled(false);cam.position.set(0,340,160);cam.setTarget(g.spline.positionAt(0).clone().set(-5,0,0));}
   else {for(const m of g.scene.meshes)if(m.metadata?.primoRoof)m.setEnabled(true);const p=g.spline.positionAt(base),t=g.spline.tangentAt(base),r=g.spline.rightAt(base);cam.position.copyFrom(p.subtract(t.scale(mode==='grid'?18:14)).add(r.scale(mode==='grid'?12:15)));cam.position.y=mode==='grid'?13:12;cam.setTarget(p.add(t.scale(mode==='grid'?-2:5)));}
   g.scene.render();g.scene.render();
  },mode);await sleep(120);await page.screenshot({path:`${out}/${mode}.png`});
 }
 report.geometry=await G(g=>({length:g.spline.totalLength,checkpoints:g.checkpoints.length,boxes:g.primo.boxes.length,originalGround:g.scene.meshes.filter(m=>m.name.startsWith('primoBatch:ground')).length,roofs:g.scene.meshes.filter(m=>m.metadata?.primoRoof).length}));
 await hostEval(page,gm=>gm.restartMatch());await until(()=>hostEval(page,gm=>gm.state.phase==='LOBBY'),15000,'lobby');assert.equal(await page.evaluate(()=>document.querySelectorAll('canvas').length),1);report.cleanup=true;
 assert.deepEqual(errors,[]);await page.evaluate(()=>localStorage.removeItem('ricchioni.hostToken'));for(const phone of phones)await phone.ctx.close();console.log(JSON.stringify(report));
}finally{writeFileSync(out+'/browser-checks.json',JSON.stringify({...report,errors},null,2));await browser.close();}
