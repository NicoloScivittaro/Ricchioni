import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
process.env.HOST_URL='http://localhost:5179/?quality=high';process.env.CTRL_URL='http://localhost:5179/controller.html';
const {launch,createRoomOnHost,addPhone,hostEval,sleep}=await import('./lib.mjs');
const {gameEval,until}=await import('./padmock.mjs');
const browser=await launch(),errors=[],checks=[],out='docs/agent-work/ribaltati-3';
const ok=(c,s)=>{assert.ok(c,s);checks.push(s);console.log('PASS '+s);};
const G=(p,f,a)=>gameEval(p,'kart3d',f,a);
const pointer=(p,selector,type)=>p.$eval(selector,(e,t)=>e.dispatchEvent(new PointerEvent(t,{bubbles:true,pointerId:42,pointerType:'touch'})),type);
try{
 for(const n of (process.env.CLIENTS??'2,3,4,5').split(',').map(Number)){
  const {page,code}=await createRoomOnHost(browser,{targetKeyPresses:n-2});page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/TypeError|ReferenceError|\[minigioco\]|\[loop/.test(m.text()))errors.push(m.text());});const phones=[];
  for(let i=0;i<n;i++){const ph=await addPhone(browser,code,'RIB '+i,i);ph.page.on('pageerror',e=>errors.push(e.message));phones.push(ph);}
  const id=await hostEval(page,gm=>gm.state.players[0].id);await hostEval(page,gm=>{gm.selectMinigame('kart3d');gm.startGame();});
  await until(()=>G(page,g=>g.race.phase==='racing'),90000,'racing');
  ok(await G(page,g=>g.karts.size===g.scene.activeCameras.length&&g.spline.totalLength>1250),`${n} players and cameras load new track`);
  ok(await hostEval(page,gm=>gm.minigameContext.durationSec===230),'updated 230s cap delivered by server');
  // Drive from a genuine phone control, then release and rejoin the same identity.
  await G(page,(g,id)=>{const k=g.karts.get(id);k.distance=60;k.lateral=0;k.speed=0;k.absHeading=g.trackAngleAt(60);k.heading=0;k.stunTimer=0;k.slipVelocity=0;k.collisionYawVelocity=0;k.respawnTimer=0;},id);
  await pointer(phones[0].page,'.ctl-up','pointerdown');await until(()=>G(page,(g,id)=>g.karts.get(id).speed>10,id),5000,'isolated phone throttle');await pointer(phones[0].page,'.ctl-up','pointerup');
  ok(true,'phone throttle drives kart on a clear section');
  await page.keyboard.press('Escape');await until(()=>hostEval(page,gm=>gm.state.paused),5000,'pause');
  const before=await G(page,g=>({time:g.race.raceTime,positions:[...g.karts.values()].map(k=>[k.distance,k.lateral,k.jumpHeight])}));await sleep(650);
  ok(JSON.stringify(before)===JSON.stringify(await G(page,g=>({time:g.race.raceTime,positions:[...g.karts.values()].map(k=>[k.distance,k.lateral,k.jumpHeight])}))),`${n} pause freezes race and jumps`);
  await phones[0].page.reload({waitUntil:'load'});await phones[0].page.waitForSelector('.ctl-up',{timeout:20000});
  ok(await hostEval(page,(gm,id)=>gm.state.players.some(p=>p.id===id),id),'rejoin retains identity');
  await page.keyboard.press('Escape');await until(()=>hostEval(page,gm=>!gm.state.paused),5000,'resume');
  if(n===5){
   // Capture the real new landmarks and geometry; then reset into an unaccelerated bot-driven race.
   for(const [label,f]of [['belvedere',.17],['viadotto',.24],['porto',.555],['pontile',.63],['bivio',.803]]){
    await G(page,(g,a)=>{g.paused=true;const id=g.order[0],k=g.karts.get(id);k.distance=g.spline.totalLength*a.f;k.lateral=a.f>.79?-5:0;k.heading=0;k.jumpHeight=0;g.entities.get(id).updateVisual(k,g.spline);g.cameraManager.applyLayout([id]);g.hud.layout([id]);g.hud.setSector(id,a.label,0);g.hud.flash(id,'','#fff',0);for(let i=0;i<180;i++)g.cameraManager.update(1/60,id,k,g.spline);g.setPieces.update(g.race.raceTime);g.scene.render();},{label,f});
    await page.screenshot({path:`${out}/section-${label}.png`});
   }
   await G(page,g=>{const id=g.order[0],cam=g.scene.activeCameras[0],V=g.spline.positionAt(0).constructor;cam.position.set(0,390,-60);cam.setTarget(new V(0,0,0));cam.fov=1.16;for(const e of g.hud.entries.values())e.adt.rootContainer.isVisible=false;g.scene.render();});await page.screenshot({path:`${out}/overview.png`});
   await G(page,g=>{
    const ks=[...g.karts.values()];ks.forEach((k,i)=>Object.assign(k,{distance:-1-Math.floor(i/2)*3.6,lateral:i%2?2.3:-2.3,absHeading:g.trackAngleAt(-1-Math.floor(i/2)*3.6),heading:0,speed:0,slipVelocity:0,collisionYawVelocity:0,wallContact:false,lap:0,nextCheckpoint:0,lastValidCheckpointS:0,finished:false,finishTime:0,lapStartTime:0,bestLapTime:Infinity,placement:0,stunTimer:0,invulnTimer:1.2,respawnTimer:0,jumpHeight:0,jumpVelocity:0,boostTimer:0,boostPower:0,heldItem:null,drifting:false,driftCharge:0,oilTimer:0,abilityMeter:0}));
    g.race=new g.race.constructor(g.checkpoints,g.spline.totalLength,230,g.trackAngleAt,ev=>g.onRaceEvent(ev));g.race.phase='racing';g.soloBots.ids=new Set(g.karts.keys());g.resultsSent=false;g.paused=false;
    for(const e of g.hud.entries.values())e.adt.rootContainer.isVisible=true;g.cameraManager.applyLayout(g.order);g.hud.layout(g.order);for(const k of ks){const rig=g.cameraManager.rigs.get(k.playerId);rig.smoothPos.copyFrom(g.spline.worldPoint(k.distance,k.lateral,3));rig.smoothLook.copyFrom(g.spline.worldPoint(k.distance+9,k.lateral,1));for(let i=0;i<60;i++)g.cameraManager.update(1/60,k.playerId,k,g.spline);}
    window.__ribAudit={launches:0,cameraSamples:0,badCameras:0,peakHeight:0,overtakes:0,itemUses:0,contacts:0,gaps:[],audio:[]};
    const event=g.onRaceEvent.bind(g);g.onRaceEvent=ev=>{if(ev.type==='overtake')window.__ribAudit.overtakes++;return event(ev);};
    const use=g.items.useItem.bind(g.items);g.items.useItem=(...args)=>{const before=args[0].heldItem;const out=use(...args);if(before&&!args[0].heldItem)window.__ribAudit.itemUses++;return out;};
    const step=g.present.bind(g);let t=0;g.present=dt=>{step(dt);t+=dt;if(t>1){t=0;const ks=[...g.karts.values()].filter(k=>!k.finished).sort((a,b)=>a.distance-b.distance);for(let i=1;i<ks.length;i++)window.__ribAudit.gaps.push(ks[i].distance-ks[i-1].distance);}};
const flash=g.hud.flash.bind(g.hud);g.hud.flash=(id,text,...rest)=>{if(text==='DECOLLO!')window.__ribAudit.launches++;return flash(id,text,...rest);};
    const update=g.cameraManager.update.bind(g.cameraManager);g.cameraManager.update=(dt,id,k,sp)=>{update(dt,id,k,sp);const c=g.cameraManager.rigs.get(id).camera,ground=sp.worldPoint(k.distance-6.4,k.lateral);const a=window.__ribAudit;a.cameraSamples++;if(!Number.isFinite(c.position.x+c.position.y+c.position.z)||c.position.y<ground.y+.8)a.badCameras++;a.peakHeight=Math.max(a.peakHeight,k.jumpHeight);};
   });
   if(!process.env.VISUAL_ONLY){
   const t0=Date.now();let logged=0;
   while(await hostEval(page,gm=>gm.state.phase==='MINIGAME_PLAYING')){
    await sleep(1000);if(Date.now()-t0>210000)throw Error('natural race timeout');
    if(Date.now()-t0>logged+20000){logged=Date.now()-t0;console.log('NATURAL '+JSON.stringify(await G(page,g=>({time:g.race.raceTime,laps:[...g.karts.values()].map(k=>k.lap)}))));}
   }
   const result=await hostEval(page,gm=>gm.state.lastResults.results),audit=await page.evaluate(()=>window.__ribAudit);
   ok(result.length===5&&result.some(r=>r.stats.some(s=>s.startsWith('tempo '))),'natural full three-lap race reaches real results');
   ok(audit.launches>=20&&audit.peakHeight>1&&audit.badCameras===0,'ramps used repeatedly, cameras above road throughout natural race');
   const seconds=Math.min(...result.map(r=>r.score))/1000;ok(seconds>75&&seconds<180,'actual browser race longer than old 55–59s');
   writeFileSync(`${out}/natural-race.json`,JSON.stringify({seconds,results:result,audit,wallSeconds:(Date.now()-t0)/1000},null,2));
   }
  }
  await hostEval(page,gm=>gm.restartMatch());await until(()=>hostEval(page,gm=>gm.state.phase==='LOBBY'),20000,'lobby');
  ok(await page.evaluate(()=>document.querySelectorAll('canvas').length)===1,`${n} cleanup releases 3D canvas`);
  await page.evaluate(()=>localStorage.removeItem('ricchioni.hostToken'));for(const p of phones)await p.ctx.close();await page.close();
 }
 ok(errors.length===0,'no runtime page errors');
}finally{writeFileSync(`${out}/${process.env.VISUAL_ONLY?'visual-checks':process.env.CLIENTS?'browser-final-5':'browser-checks'}.json`,JSON.stringify({checks,errors},null,2));await browser.close();}
