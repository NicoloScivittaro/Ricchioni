import assert from 'node:assert/strict';import {writeFileSync} from 'node:fs';
process.env.HOST_URL='http://localhost:5186/?quality=high';process.env.CTRL_URL='http://localhost:5186/controller.html';
const {launch,createRoomOnHost,addPhone,hostEval,sleep}=await import('./lib.mjs');
const {sceneEval,until,installMock,add,tap,trig,stick,XBOX}=await import('./padmock.mjs');
const out='docs/agent-work/terminal-fixes',report={},errors=[];const browser=await launch();
try{
 const {page,code}=await createRoomOnHost(browser,{targetKeyPresses:3});page.setDefaultTimeout(180000);page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('dialog',d=>d.accept());
 await page.evaluate(()=>performance.setResourceTimingBufferSize(10000));
 const phones=[];for(let i=0;i<5;i++)phones.push(await addPhone(browser,code,'TERMINAL '+(i+1),i));
 const ids=await hostEval(page,gm=>gm.state.players.map(p=>p.id));await installMock(page,5);for(let i=0;i<5;i++)await add(page,i,XBOX);await sleep(400);
 for(let i=0;i<5;i++){await page.evaluate(id=>window.__pads.setTarget(id),ids[i]);await tap(page,i,'A',150);}await page.evaluate(()=>window.__pads.setTarget(null));
 await hostEval(page,gm=>{gm.selectMinigame('fps');gm.startGame();});await until(()=>hostEval(page,gm=>gm.state.phase==='MINIGAME_ROULETTE'),15000,'roulette');await hostEval(page,gm=>gm.skip());
 await until(()=>hostEval(page,gm=>gm.state.phase==='MINIGAME_MAP_VOTE'),15000,'map ballot');report.maps=await hostEval(page,gm=>gm.state.mapVote.options.map(m=>m.id));assert.deepEqual(report.maps,['cantiere','nuketown','terminal']);
 for(const phone of phones){await phone.page.waitForSelector('[data-map-id="terminal"]');await phone.page.click('[data-map-id="terminal"]');}
 const G=(fn,arg)=>sceneEval(page,'fps',fn,arg);
 await until(()=>G(g=>g.roundReady&&g.controlsDone&&g.worldReady&&g.splitScreen?.cams.length===5),180000,'Terminal ready');

 await G(g=>{g.controlsDone=false;g.nuketownBots.ids=new Set();g.ctx.finish=r=>{window.__fixResult=r;};});
 report.motion=await G(async g=>{
  const {FPS_BODY}=await import('/shared/fpsRules.ts');const p=g.players[0],input=g.ctx.input.get(p.id);input.setAxis('move',0,0);p.spawnProtection=0;
  const floor=p.y;input.setDown('jump');g.stepPlayer(p,1/60);input.setUp('jump');g.ctx.input.update();let apex=p.y-floor;
  for(let n=0;n<90;n++){g.stepPlayer(p,1/60);g.ctx.input.update();apex=Math.max(apex,p.y-floor);}
  const landed=p.grounded&&Math.abs(p.y-floor)<.01;
  input.setDown('crouch');g.stepPlayer(p,1/60);const crouch={active:p.crouching,eye:p.eyeHeight};input.setUp('crouch');g.ctx.input.update();g.stepPlayer(p,1/60);const stood=!p.crouching&&p.eyeHeight===FPS_BODY.eye;
  p.verticalSpeed=4;p.grounded=false;p.crouching=true;g.respawn(p);const reset=p.grounded&&p.verticalSpeed===0&&!p.crouching;
  return{apex,landed,crouch,stood,reset};
 });assert.ok(report.motion.apex>.9&&report.motion.landed&&report.motion.crouch.active&&report.motion.crouch.eye<1&&report.motion.stood&&report.motion.reset);
 report.combat=await G(async g=>{
  const {getWeapon}=await import('/shared/fpsWeapons.ts'),old=await(await fetch('/docs/agent-work/terminal-2/initial-browser-checks.json')).json(),pair=old.geometry.clear;
  const [a,b,...rest]=g.players;for(const p of rest){p.alive=false;p.respawnTimer=1000;}
  const setup=()=>{for(const [i,p]of[a,b].entries()){Object.assign(p,pair[i],{groundY:pair[i].y,grounded:true,verticalSpeed:0,crouching:false,eyeHeight:1.5,alive:true,hp:100,spawnProtection:0,guardTime:0,debtTime:0,armTime:0,weaponId:'laser',magazine:10,reloading:false,fireCooldown:0,ads:1,heat:0,recoilPitch:0,recoilYaw:0});}a.yaw=Math.atan2(b.x-a.x,b.z-a.z);a.pitch=0;};
  setup();g.fireShot(a,getWeapon('laser'));const standingHp=b.hp;setup();b.crouching=true;b.eyeHeight=.86;g.fireShot(a,getWeapon('laser'));const crouchedHp=b.hp;
  setup();g.matchTime=1000;g.controlsDone=true;g.update(0,16);const continued=!g.finished;g.controlsDone=false;
  setup();a.kills=9;b.hp=1;g.fireShot(a,getWeapon('laser'));const winner=g.winnerId===a.id;const afterWinDamage=g.applyDamage(a,100,b);g.controlsDone=true;g.update(0,16);g.controlsDone=false;
  return{standingHp,crouchedHp,continued,winner,kills:a.kills,afterWinDamage,finished:g.finished,result:window.__fixResult};
 });assert.ok(report.combat.standingHp<100);assert.equal(report.combat.crouchedHp,100);assert.ok(report.combat.continued&&report.combat.winner&&report.combat.finished);assert.equal(report.combat.kills,10);assert.equal(report.combat.afterWinDamage,false);assert.equal(report.combat.result.results[0].score,10);
 report.profile=await page.evaluate(async()=>{const {profileFor}=await import('/src/input/profiles.ts');return profileFor('fps').controls.map(c=>({control:c.control,binding:c.binding}));});assert.ok(report.profile.some(c=>c.control==='jump'&&c.binding==='PRIMARY')&&report.profile.some(c=>c.control==='crouch'&&c.binding==='SECONDARY'));
 await page.screenshot({path:out+'/gameplay-five.png'});assert.deepEqual(errors,[]);console.log(JSON.stringify(report));
}finally{writeFileSync(out+'/gameplay-checks.json',JSON.stringify({...report,errors},null,2));await browser.close();}
