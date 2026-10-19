import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
process.env.HOST_URL='http://localhost:5180/?quality=high';process.env.CTRL_URL='http://localhost:5180/controller.html';
const {launch,createRoomOnHost,addPhone,hostEval,sleep}=await import('./lib.mjs');
const {gameEval,until,installMock,add,XBOX,tap,stick,trig,remove}=await import('./padmock.mjs');
const browser=await launch(),checks=[],errors=[],out='docs/agent-work/glide-polish',details=[];
const G=(p,f,a)=>gameEval(p,'kart3d',f,a),ok=(c,label)=>{assert.ok(c,label);checks.push(label);console.log('PASS '+label);};
const pointer=(p,s,t)=>p.$eval(s,(e,t)=>e.dispatchEvent(new PointerEvent(t,{bubbles:true,pointerId:42,pointerType:'touch'})),t);
try{
 for(const n of (process.env.CLIENTS??'2,3,4,5').split(',').map(Number)){
  const {page,code}=await createRoomOnHost(browser,{targetKeyPresses:n-2});page.on('pageerror',e=>errors.push(e.message));
  const phones=[];for(let i=0;i<n;i++)phones.push(await addPhone(browser,code,'ARC '+i,i));
  const ids=await hostEval(page,gm=>gm.state.players.map(p=>p.id));
  if(n===2){await installMock(page);await add(page,0,XBOX);await page.evaluate(id=>window.__pads.setTarget(id),ids[0]);await tap(page,0,'A');await page.evaluate(()=>window.__pads.setTarget(null));}
  await page.keyboard.press('ArrowLeft');await until(()=>hostEval(page,gm=>gm.state.selectedKartTrackId==='arcobaleno'),5000,'UI track');
  await hostEval(page,gm=>gm.startGame());await until(()=>G(page,g=>g.controlsDone&&g.race.phase==='racing'),90000,'race');
  ok(await G(page,g=>g.rainbow&&g.karts.size===g.scene.activeCameras.length&&g.rainbow.checkpoints.every(s=>g.spline.hasRoadAt(s))),`${n}: selection, import, checkpoints and viewports`);
  await G(page,g=>{g.soloBots.ids=new Set();g.hud.setCountdown('');});
  const direction=await G(page,g=>g.ctx.modifier?.id==='controlli_invertiti'?-1:1);
  // A real mobile button and the actual mocked gamepad pipeline steer in air.
  const place=async id=>G(page,(g,id)=>{const k=g.karts.get(id),gap=g.rainbow.gaps[0];Object.assign(k,{distance:gap.launch+120,glideStart:gap.launch,glideEnd:gap.landing,flight:'GLIDE',flightTime:0,flightEntryHeight:0,jumpHeight:g.spline.flightHeightAt(gap.launch+120),jumpVelocity:0,lateral:0,speed:40,heading:0,absHeading:g.trackAngleAt(gap.launch+120),stunTimer:0,respawnTimer:0,slipVelocity:0,collisionYawVelocity:0,drifting:false,driftCharge:0,disturbTimer:0,oilTimer:0,faultyTimer:0,bumperTimer:0});},id);
  await place(ids[n-1]);const before=await G(page,(g,id)=>g.karts.get(id).lateral,ids[n-1]);await pointer(phones[n-1].page,'.ctl-right','pointerdown');await until(()=>G(page,(g,a)=>(g.karts.get(a.id).lateral-a.before)*a.direction>.2,{id:ids[n-1],before,direction}),4000,'phone steering with round modifier');await pointer(phones[n-1].page,'.ctl-right','pointerup');
  ok(await G(page,(g,a)=>(g.karts.get(a.id).lateral-a.before)*a.direction>.2,{id:ids[n-1],before,direction}),`${n}: phone steers glider`);
  if(n===2){await place(ids[0]);await trig(page,0,'RT',1);await stick(page,0,-.5,0);await until(()=>G(page,(g,a)=>g.karts.get(a.id).lateral*a.direction<-.1,{id:ids[0],direction}),4000,'pad flight steering');ok(await G(page,(g,a)=>g.karts.get(a.id).lateral*a.direction<-.1,{id:ids[0],direction}),'Xbox analog steering in GLIDE');await stick(page,0,0,0);await trig(page,0,'RT',0);await remove(page,0);await sleep(350);ok(await hostEval(page,(gm,id)=>Math.abs(gm.input.get(id).peekAxis('steer').x)<.01,ids[0]),'pad disconnect clears held steering');}
  await page.keyboard.press('Escape');await until(()=>hostEval(page,gm=>gm.state.paused),5000,'pause');const beforePause=await G(page,g=>({t:g.race.raceTime,p:[...g.karts.values()].map(k=>[k.distance,k.lateral,k.jumpHeight])}));await sleep(600);
  ok(JSON.stringify(beforePause)===JSON.stringify(await G(page,g=>({t:g.race.raceTime,p:[...g.karts.values()].map(k=>[k.distance,k.lateral,k.jumpHeight])}))),`${n}: pause freezes flight`);
  await phones[n-1].page.reload({waitUntil:'load'});await phones[n-1].page.waitForSelector('.ctl-right',{timeout:20000});ok(await hostEval(page,(gm,id)=>gm.state.players.some(p=>p.id===id&&p.connected),ids[n-1]),`${n}: phone reconnect keeps identity`);
  await page.keyboard.press('Escape');await until(()=>hostEval(page,gm=>!gm.state.paused),5000,'resume');
  // Scripted miss, but actual fall/countdown/checkpoint recovery through the game loop.
  await G(page,(g,id)=>{const k=g.karts.get(id),gap=g.rainbow.gaps[0];Object.assign(k,{distance:gap.landing-.1,glideStart:gap.launch,glideEnd:gap.landing,flight:'GLIDE',lateral:12,speed:42,heading:0,absHeading:g.trackAngleAt(gap.landing),lastValidCheckpointS:gap.launch-12,respawnTimer:0});},ids[0]);
  await until(()=>G(page,(g,id)=>g.karts.get(id).flight==='FALL',ids[0]),5000,'fall');await sleep(250);ok(await G(page,(g,id)=>g.karts.get(id).jumpHeight<0,ids[0]),`${n}: visible missed-landing fall`);
  await until(()=>G(page,(g,id)=>{const k=g.karts.get(id);return k.flight==='DRIVE'&&Math.abs(k.distance-k.lastValidCheckpointS)<1;},ids[0]),5000,'automatic checkpoint respawn');ok(true,`${n}: automatic safe respawn`);
  await G(page,g=>{g.paused=true;for(const k of g.karts.values()){const gap=g.rainbow.gaps[0];Object.assign(k,{distance:gap.launch+140,lateral:0,heading:0,absHeading:g.trackAngleAt(gap.launch+140),flight:'GLIDE',glideStart:gap.launch,glideEnd:gap.landing,jumpHeight:g.spline.flightHeightAt(gap.launch+140)});g.entities.get(k.playerId).updateVisual(k,g.spline);g.wings.get(k.playerId).update(1,true,0);for(let i=0;i<150;i++)g.cameraManager.update(1/60,k.playerId,k,g.spline);}g.hud.setCountdown('');g.present(1/60);g.scene.render();});
  await page.screenshot({path:`${out}/split-${n}.png`});
  ok(await G(page,g=>g.scene.activeCameras.every(c=>Number.isFinite(c.position.x+c.position.y+c.position.z)&&c.position.y>40)),`${n}: finite flight cameras`);
  if(n===5){
   // All items use the real manager on both surfaces; only ground-only effects stay held in flight.
   const interactions=await G(page,g=>{const k=[...g.karts.values()][0],target=[...g.karts.values()][1],ids=['turbo','super_turbo','sfera','olio','scudo','disturbo','calamita','piccione','turbo_difettoso','buca','raffica','paraurti','mollone'],rows=[];
    for(const flight of ['DRIVE','GLIDE'])for(const item of ids){const gap=g.rainbow.gaps[0],d=flight==='GLIDE'?gap.launch+180:40;for(const [a,offset]of [[k,0],[target,8]])Object.assign(a,{flight,distance:d+offset,lateral:0,jumpHeight:flight==='GLIDE'?g.spline.flightHeightAt(d+offset):0,respawnTimer:0,finished:false,stunTimer:0,heldItem:null});k.heldItem=item;g.items.useItem(k,[k,target],id=>id===k.playerId?2:1);rows.push({flight,item,retained:k.heldItem===item});}
    const abilities=[];for(const characterId of ['goblin','dottore','judoka','buttafuori','ciro']){Object.assign(k,{characterId,flight:'GLIDE',abilityMeter:1,abilityCharges:1,abilityActive:false,abilityTimer:0,truckMode:false,lightMode:false,debtPending:false,refundTimer:0,recoverWindow:1,stunTimer:0,respawnTimer:0});const result=g.abilities.onAbilityPress(k,[k,target],()=>{},g.trackAngleAt);abilities.push({characterId,result,flight:k.flight});}return {rows,abilities};});
   ok(interactions.rows.every(r=>r.retained===(r.flight==='GLIDE'&&['olio','buca','raffica','calamita','mollone'].includes(r.item))),'13 items: ground use and documented airborne retention');
   ok(interactions.abilities.every(a=>a.result==='ok'),'five abilities activate during flight/recovery');details.push(interactions);
   const alignment=await G(page,g=>{const road=g.scene.meshes.find(m=>m.material?.name==='rainbowRoadTiles');const positions=road.getVerticesData('position'),matrix=road.getWorldMatrix(),V=g.spline.positionAt(0).constructor;let min=Infinity,max=-Infinity;for(let i=0;i<positions.length;i+=3){const p=V.TransformCoordinates(new V(...positions.slice(i,i+3)),matrix);min=Math.min(min,p.x);max=Math.max(max,p.x);}return {roadBounds:[min,max],meshes:g.scene.meshes.length,materials:g.scene.materials.length};});ok(alignment.roadBounds[0]>-260&&alignment.roadBounds[1]<270,'imported surface correctly aligned with race coordinates');details.push(alignment);
  }
  await hostEval(page,gm=>gm.restartMatch());await until(()=>hostEval(page,gm=>gm.state.phase==='LOBBY'),15000,'lobby');await until(()=>page.evaluate(()=>document.querySelectorAll('canvas').length===1),10000,'canvas disposal');ok(true,`${n}: lobby cleanup`);
  await page.evaluate(()=>localStorage.removeItem('ricchioni.hostToken'));for(const ph of phones)await ph.ctx.close();await page.close();
 }
 ok(errors.length===0,'no runtime page errors');
}finally{writeFileSync(`${out}/browser-qa.json`,JSON.stringify({checks,errors,details},null,2));await browser.close();}
