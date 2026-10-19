import {writeFileSync} from 'node:fs';
process.env.HOST_URL='http://localhost:5180/?quality=high';process.env.CTRL_URL='http://localhost:5180/controller.html';
const {launch,createRoomOnHost,addPhone,hostEval,sleep}=await import('./lib.mjs');
const {gameEval,until}=await import('./padmock.mjs');
const stage=process.env.R13_STAGE??'after',out=`docs/agent-work/rainbow-1-3/${stage}`,browser=await launch(),errors=[],G=(p,f,a)=>gameEval(p,'kart3d',f,a);
try{
 const {page,code}=await createRoomOnHost(browser,{targetKeyPresses:3});page.on('pageerror',e=>errors.push(e.message));const phones=[];for(let i=0;i<5;i++)phones.push(await addPhone(browser,code,'P'+(i+1),i));
 await hostEval(page,gm=>{gm.selectMinigame('kart3d','arcobaleno');gm.startGame();});await until(()=>G(page,g=>g.race.phase==='racing'),90000,'race');
 await sleep(900);await G(page,g=>{g.paused=true;g.engine.setHardwareScalingLevel(1);g.engine.setHardwareScalingLevel=()=>{};g.hud.setCountdown('');g.savedOrder=g.order;g.order=[g.order[0]];g.cameraManager.applyLayout(g.order);g.hud.layout(g.order);});
 const poses=[['long',0,.5],['short',1,.5],['wings',0,.76],['portal',0,.94],['space',0,.38],['bank',-1,1300],['turbo',-1,1100,'goblin'],['defence',0,.6,'ciro'],['offence',-1,1100,'judoka']];
 for(const [name,index,t,cid] of poses){
  await G(page,(g,a)=>{
   const [name,index,t,cid]=a,id=g.order[0],k=g.karts.get(id),gap=g.rainbow.gaps[Math.max(0,index)],d=index<0?t:gap.launch+(gap.landing-gap.launch)*t;
   for(const [pid,other] of g.karts)if(pid!==id){other.distance=d-40-other.placement*8;other.lateral=0;other.flight='DRIVE';other.jumpHeight=0;}
   Object.assign(k,{distance:d,lateral:0,heading:0,absHeading:g.trackAngleAt(d),speed:44,flight:index<0?'DRIVE':'GLIDE',glideStart:gap.launch,glideEnd:gap.landing,flightTime:3,jumpHeight:index<0?0:g.rainbow.flightHeightAt(d),jumpVelocity:0,glideLanding:0,stunTimer:0,invulnTimer:0,boostTimer:0,boostPower:0,abilityActive:false,abilityTimer:0,abilityCooldown:0,abilityMeter:1,abilityCharges:1,debtPending:false,truckMode:false,lightMode:false,characterId:cid??'goblin'});
   if(cid){g.abilities.setRaceTime(20);g.abilities.onAbilityPress(k,[...g.karts.values()],f=>g.onAbilityFeedback(id,f),g.trackAngleAt);if(cid==='ciro')g.abilities.tryDelayHit(k,{stun:1.3},f=>g.onAbilityFeedback(id,f));}
   for(let i=0;i<110;i++){g.cameraManager.update(1/60,id,k,g.spline);g.wings.get(id).update(1/60,index>=0,0);}
   g.world.update(10000);g.present(1/60);g.scene.render();g.scene.render();
  },[name,index,t,cid]);
  await G(page,async g=>{await g.scene.whenReadyAsync();g.scene.render();g.scene.render();});await sleep(100);
  await page.screenshot({path:`${out}/${name}.png`});
 }
 const contact=await G(page,g=>{const a=g.karts.get(g.order[0]),b=[...g.karts.values()].find(k=>k!==a);Object.assign(a,{truckMode:true});Object.assign(b,{lateral:0,speed:62,shielded:false,invulnTimer:0,flight:'GLIDE',slipVelocity:0});for(let i=0;i<12;i++){g.race.raceTime=20+i/120;g.abilities.setRaceTime(g.race.raceTime);g.truckBump(a,b,1);}return {lateral:b.lateral,slip:b.slipVelocity,speed:b.speed,cap:b.speedCapMultiplier,time:b.speedCapTimer};});
 await G(page,g=>{g.order=g.savedOrder;g.cameraManager.applyLayout(g.order);g.hud.layout(g.order);for(const [i,k]of [...g.karts.values()].entries()){k.finished=true;k.lap=3;k.finishTime=165+i;k.placement=i+1;k.distance=g.spline.totalLength*3+i;}g.race.phase='ended';g.paused=false;});
 if(stage==='before'){await until(()=>hostEval(page,gm=>gm.state.phase==='ROUND_RESULTS'),20000,'results');await hostEval(page,gm=>{const sc=gm.game.scene.getScene('ResultsScene');sc.time.timeScale=20;sc.tweens.timeScale=20;});await sleep(600);}else{await until(()=>page.$('#rainbow-finish'),10000,'podium');}
 await page.screenshot({path:`${out}/finish.png`});
 writeFileSync(`${out}/presentation.json`,JSON.stringify({poses,contact,errors},null,2));
 await hostEval(page,gm=>gm.restartMatch());await sleep(500);await page.evaluate(()=>localStorage.removeItem('ricchioni.hostToken'));for(const ph of phones)await ph.ctx.close();
 console.log('PHOTOS '+stage+' '+JSON.stringify({contact,errors}));
}finally{await browser.close();}
