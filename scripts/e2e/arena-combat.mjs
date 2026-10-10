import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {launch,createRoomOnHost,addPhone,hostEval,hostSnapshot,sleep} from './lib.mjs';
import {installMock,add,remove,btn,tap,stick,XBOX,DS,GENERIC,until,startGame,gameEval,watchControls} from './padmock.mjs';
import {visualCounters} from './tripo-counters.mjs';
const browser=await launch(),report={errors:[],accelerated:true};
try {
 const {page,code}=await createRoomOnHost(browser,{targetKeyPresses:3});
 page.on('pageerror',e=>report.errors.push(String(e)));
 const phones=[];for(let i=0;i<5;i++){const ph=await addPhone(browser,code,`Arena ${i}`,i);phones.push(ph);ph.page.on('pageerror',e=>report.errors.push(String(e)));}
 const ids=await hostEval(page,gm=>gm.state.players.map(p=>p.id));
 const G=(fn,arg)=>gameEval(page,'arena',fn,arg);
 await installMock(page);for(let i=0;i<4;i++){await add(page,i,[XBOX,DS,GENERIC][i%3]);await page.evaluate(id=>window.__pads.setTarget(id),ids[i]);await tap(page,i,'A');}
 await page.evaluate(()=>window.__pads.setTarget(null));await watchControls(page);
 await startGame(page,'arena');await until(async()=>await G(g=>g.phase==='playing'),40000,'via');
 assert.match(await page.evaluate(()=>window.__cc.text),/SPALLATA/);
 await until(async()=>await G(g=>[...g.entities.values()].filter(e=>e.goblinDebug()).every(e=>e.goblinDebug().state==='ready')),30000,'native skins');
 // Each physical pad family uses the new held binding through GamepadManager.
 for(let i=0;i<3;i++){
  await btn(page,i,'X',true);await until(async()=>await G((g,id)=>g.players.find(p=>p.id===id).charging,ids[i]),5000,'pad charge');
  await until(async()=>await G((g,id)=>g.players.find(p=>p.id===id).chargeTime>.35,ids[i]),4000,'hold');
  await btn(page,i,'X',false);await until(async()=>await G((g,id)=>g.players.find(p=>p.id===id).attackCooldown>1,ids[i]),5000,'release shoulder');
 }
 await G(g=>{g.gameTime=0;g.hitStop=0;g.players.forEach((p,i)=>{p.x=(i-2)*4;p.z=0;p.vx=p.vz=0;p.dashing=false;p.shoulderTime=0;p.stunTime=0;p.recoveryTime=0;p.attackCooldown=0;});});
 // Actual two-finger stream: movement and held attack coexist.
 const ph=phones[4].page;await ph.waitForSelector('#arena-attack');
 const cd=await ph.createCDPSession();await cd.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:3});
 const points=await ph.evaluate(()=>{
  const c=s=>{const r=document.querySelector(s).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};};
  return{attack:{...c('#arena-attack'),id:1},joy:{...c('#arena-joy-base'),id:2}};
 });
 await cd.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[points.attack,points.joy]});
 await cd.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[points.attack,{...points.joy,x:points.joy.x-45}]});
 await until(async()=>await G((g,id)=>{const p=g.players.find(p=>p.id===id);return p.charging&&p.chargeTime>.4&&g.ctx.input.get(id).peekAxis('move').x<-.2;},ids[4]),6000,'phone charge + joystick');
 await ph.screenshot({path:'docs/agent-work/arena-combat/phone-charge.png'});
 await cd.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
 await sleep(250);
 assert.equal(await G((g,id)=>{const p=g.players.find(p=>p.id===id);return p.charging||p.shoulderTime>0;},ids[4]),false);
 await ph.setViewport({width:800,height:390,isMobile:true,hasTouch:true});await sleep(200);
 report.phoneLayout=await ph.evaluate(()=>[...document.querySelectorAll('#arena-attack,#arena-dash,#arena-ability,#arena-instability')].map(e=>{const r=e.getBoundingClientRect();return{id:e.id,x:r.x,y:r.y,right:r.right,bottom:r.bottom};}));
 assert.ok(report.phoneLayout.every(r=>r.x>=0&&r.y>=0&&r.right<=800&&r.bottom<=390));
 await ph.screenshot({path:'docs/agent-work/arena-combat/phone-landscape.png'});
 // Pause and disconnect cancel rather than release a pending attack.
 await btn(page,0,'X',true);await until(async()=>await G(g=>g.players[0].charging),5000,'pause charge');
 await page.keyboard.press('Escape');await sleep(200);assert.equal(await G(g=>g.players[0].charging),false);
 await btn(page,0,'X',false);await page.keyboard.press('Escape');await sleep(250);assert.equal(await G(g=>g.players[0].shoulderTime),0);
 await btn(page,1,'X',true);await until(async()=>await G(g=>g.players[1].charging),5000,'disconnect charge');
 await remove(page,1);await sleep(250);assert.equal(await G(g=>g.players[1].charging||g.players[1].shoulderTime>0),false);
 // Deterministic fixtures exercise the actual Babylon game, effects, abilities and round path.
 report.combat=await G(async g=>{
  g.paused=true;
  const {createArenaPlayer}=await import('/src/minigames/arena/arenaTypes.ts');
  const initial=g.players.map(p=>({id:p.id,characterId:p.characterId,color:p.color,avatar:p.avatar,name:p.name}));
  const reset=()=>{
   g.ctx.input.reset();g.gameTime=0;g.hitStop=0;g.phase='playing';g.currentRadius=14;g.suddenDeath=false;
   g.eliminationOrder=[];g.eliminatedAt.clear();g.exitDistance.clear();g.resultsSent=false;
   g.players.forEach((p,i)=>{g.hud.setPlayerOut(p.id,false);const e=g.entities.get(p.id);e.celebration=null;e.goblinVisual?.playResult(null);e.root.setEnabled(true);const s=initial[i];Object.assign(p,createArenaPlayer(s.id,s.characterId,s.color,s.avatar,s.name));p.x=(i-2)*4;p.z=-7;p.prevX=p.x;p.prevZ=p.z;g.abilities.init(p);p.cancelVersion=g.ctx.input.get(p.id).cancellationVersion;});
  };
  const steps=(sec,dt=.01)=>{for(let t=0;t<sec-1e-8;t+=dt){g.hitStop=0;g.step(dt);}};
  const attack=(p,seconds)=>{const input=g.ctx.input.get(p.id);input.setDown('attack');steps(seconds);input.setUp('attack');steps(.01);};
  const out={};
  reset();let a=g.players[0],b=g.players[1];a.x=0;a.z=0;b.x=2.6;b.z=0;a.facing=Math.PI/2;attack(a,.05);
  out.tap={power:b.vx,instability:b.instability,shoulder:a.shoulderTime};
  if(!(b.vx>0&&b.vx<8&&b.instability>0&&a.shoulderTime===0))throw Error('short tap must push, not shoulder');
  const before=b.instability;steps(2);if(b.instability!==before)throw Error('premature regeneration');steps(1.5);if(!(b.instability<before))throw Error('no regeneration');out.recovered=b.instability;
  out.equal=[];
  for(const cid of ['goblin','buttafuori','judoka','ciro','dottore']) {
   reset();a=g.players[0];b=g.players[1];a.characterId=cid;b.characterId=cid;
   g.applyKnockback(b,1,0,18,a);out.equal.push({cid,velocity:b.vx,meter:b.instability});
  }
  if(out.equal.some(e=>e.velocity!==out.equal[0].velocity||e.meter!==out.equal[0].meter))throw Error('unequal character mechanics');
  reset();a=g.players[0];b=g.players[1];b.instability=100;g.applyKnockback(b,1,0,18,a);
  out.criticalVelocity=b.vx;if(Math.abs(b.vx-39.6)>.0001)throw Error('critical vulnerability');
  reset();a=g.players[0];b=g.players[1];a.x=7;a.z=0;b.x=11;b.z=0;a.facing=Math.PI/2;
  attack(a,1);steps(.8);out.early={time:g.gameTime,radius:g.currentRadius,alive:b.alive,credit:b.lastHitBy,eliminations:a.eliminations};
  if(b.alive||g.gameTime>=15||g.currentRadius<13.9||b.lastHitBy!==a.id||a.eliminations!==1)throw Error('early credited KO on large arena');
  reset();a=g.players[0];a.x=7;a.z=3;a.facing=Math.PI/2;attack(a,1);steps(.6);
  out.whiff={alive:a.alive,time:g.gameTime,radius:g.currentRadius,lastHitBy:a.lastHitBy};
  if(a.alive||a.lastHitBy||g.currentRadius<13.9)throw Error('full missed shoulder should self-eliminate');
  reset();a=g.players[0];b=g.players[1];a.x=0;a.z=0;b.x=3;b.z=0;b.parryTime=.4;b.characterId='goblin';
  a.dashing=true;a.shoulderTime=.3;a.shoulderPower=28;g.applyKnockback(b,1,0,28,a);
  out.parry={meter:b.instability,credit:b.lastHitBy,attackerStun:a.stunTime,attackerMomentum:a.momentumTime};
  if(b.instability||b.lastHitBy||!a.stunTime||!a.momentumTime)throw Error('parry meter/credit/reflection');
  reset();a=g.players[0];b=g.players[1];a.dashing=true;a.shoulderTime=.3;b.characterId='dottore';b.awareTime=.4;g.applyKnockback(b,1,0,28,a);
  if(b.instability||b.lastHitBy||!a.stunTime)throw Error('Dottore dodge');
  reset();a=g.players[0];b=g.players[1];b.characterId='buttafuori';g.abilities.init(b);g.abilities.onAbilityPress(b,g.players,()=>{});g.applyKnockback(b,1,0,20,a);
  out.shield={velocity:b.vx,stored:b.stored,meter:b.instability};if(!(b.vx<20&&b.stored>0&&b.instability>0))throw Error('Boschi absorption');
  reset();a=g.players[0];a.characterId='ciro';g.abilities.init(a);g.abilities.onAbilityPress(a,g.players,()=>{});a.x=15;a.z=0;g.checkEliminations();if(!a.alive||!a.debtTime)throw Error('Ciro recovery');
  reset();a=g.players[0];a.facing=Math.PI/2;const ip=g.ctx.input.get(a.id);ip.setDown('attack');steps(.6);ip.cancelAll();steps(.1);if(a.charging||a.shoulderTime)throw Error('cancel version');
  reset();a=g.players[0];ip.setDown('attack');steps(.6);g.applyKnockback(a,1,0,6,g.players[1]);ip.setUp('attack');steps(.1);if(a.charging||a.shoulderTime)throw Error('interrupted charge release');
  reset();g.players.forEach((p,i)=>{p.instability=i*20;g.ctx.input.get(p.id).setDown('attack');});steps(.7);g.hud.setAlive(5,5);g.scene.render();
  out.native=[...g.entities.values()].map(e=>({debug:e.goblinDebug(),imported:e.importedBody,legacy:e.legacyAction,lean:e.root.rotation.x}));
  if(out.native.filter(e=>e.debug).some(e=>e.debug.state!=='ready'||!e.imported||e.legacy||!e.lean||!e.debug.animator?.name.endsWith('.block')))throw Error('native charge skin');
  out.otherContext=g.players.filter(p=>g.entities.get(p.id).goblinDebug()).map(p=>{
   const e=g.entities.get(p.id);e.visualContext='soccer';e.updateVisual(p,.01,performance.now());const lean=e.root.rotation.x;e.visualContext='arena';e.updateVisual(p,.01,performance.now());return lean;
  });
  if(out.otherContext.some(x=>x!==0))throw Error('Arena wind-up leaked into soccer');
  return out;
 });
 await sleep(2500);await page.screenshot({path:'docs/agent-work/arena-combat/five-charge.png'});
 report.round=await G(g=>{
  g.ctx.input.reset();g.gameTime=g.durationSec-.01;g.players.forEach((p,i)=>{p.charging=false;p.shoulderTime=0;p.dashing=false;p.vx=p.vz=0;p.x=Math.cos(i*2*Math.PI/5)*2.6;p.z=Math.sin(i*2*Math.PI/5)*2.6;});
  for(let i=0;i<2000&&!g.resultsSent;i++){g.hitStop=0;g.step(.05);}
  g.scene.render();return{phase:g.phase,radius:g.currentRadius,sudden:g.suddenDeath,results:g.buildResults(),finite:g.players.every(p=>[p.x,p.z,p.vx,p.vz].every(Number.isFinite))};
 });
 assert.equal(report.round.phase,'celebrating');assert.equal(report.round.sudden,true);assert.equal(report.round.results.length,5);assert.ok(report.round.finite);
 await until(async()=>['ROUND_RESULTS','MATCH_END'].includes((await hostSnapshot(page)).phase),15000,'natural finish');
 await hostEval(page,gm=>gm.restartMatch());await until(async()=>(await hostSnapshot(page)).phase==='LOBBY',15000,'lobby');
 report.cleanup=await visualCounters(page);assert.equal(report.cleanup.liveInstances,0);assert.equal(await page.evaluate(()=>document.querySelectorAll('canvas').length),1);
 assert.deepEqual(report.errors,[]);console.log('PASS Arena browser: mixed pads, real multi-touch, cancel/pause/disconnect, early KO, self-whiff, regeneration, abilities, native skins, sudden death, results and cleanup.');
}catch(e){report.failure=String(e);throw e;}
finally{writeFileSync('docs/agent-work/arena-combat/browser.json',JSON.stringify(report,null,2));await browser.close();}
