import assert from 'node:assert/strict';import {writeFileSync} from 'node:fs';
process.env.HOST_URL='http://localhost:5186/?quality=high';process.env.CTRL_URL='http://localhost:5186/controller.html';
const {launch,createRoomOnHost,addPhone,hostEval,sleep}=await import('./lib.mjs');
const {sceneEval,until,installMock,add,tap,XBOX}=await import('./padmock.mjs');
const out='docs/agent-work/fps-arsenal',report={},errors=[],browser=await launch();
try{
 const {page,code}=await createRoomOnHost(browser,{targetKeyPresses:3});page.setDefaultTimeout(180000);page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('dialog',d=>d.accept());
 const phones=[];for(let i=0;i<5;i++)phones.push(await addPhone(browser,code,'ARSENALE '+(i+1),i));
 const ids=await hostEval(page,gm=>gm.state.players.map(p=>p.id));await installMock(page,5);for(let i=0;i<5;i++)await add(page,i,XBOX);await sleep(400);
 for(let i=0;i<5;i++){await page.evaluate(id=>window.__pads.setTarget(id),ids[i]);await tap(page,i,'A',150);}await page.evaluate(()=>window.__pads.setTarget(null));
 await hostEval(page,gm=>{gm.selectMinigame('fps');gm.startGame();});await until(()=>hostEval(page,gm=>gm.state.phase==='MINIGAME_ROULETTE'),15000,'roulette');await hostEval(page,gm=>gm.skip());
 await until(()=>hostEval(page,gm=>gm.state.phase==='MINIGAME_MAP_VOTE'),15000,'map vote');
 for(const phone of phones){await phone.page.waitForSelector('[data-map-id="cantiere"]');await phone.page.click('[data-map-id="cantiere"]');}
 const G=(fn,arg)=>sceneEval(page,'fps',fn,arg);
 await until(()=>G(g=>g.roundReady&&g.controlsDone&&g.worldReady&&g.splitScreen?.cams.length===5),180000,'fps ready');
 await G(g=>{g.controlsDone=false;g.soloBots.ids=new Set();g.ctx.finish=r=>{window.__arsenalResult=r;};});
 report.combat=await G(async g=>{
  const {getWeapon,WEAPONS}=await import('/shared/fpsWeapons.ts');const[a,b,...rest]=g.players;
  const ia=g.ctx.input.get(a.id);for(const p of g.players)g.ctx.input.get(p.id).cancelAll();
  const setup=(id='pistola',enemy=false)=>{
   g.winnerId=null;g.energyBolts=[];for(const p of g.players){p.alive=false;p.respawnTimer=1000;}
   for(const [p,z] of [[a,-20],[b,-10]])Object.assign(p,{x:-20,z,y:0,groundY:0,grounded:true,verticalSpeed:0,crouching:false,eyeHeight:1.5,hp:100,alive:p===a||enemy,spawnProtection:0,guardTime:0,debtTime:0,armTime:0,lockTime:0,stunTime:0,buffShots:0,drowsyTime:0,kills:0,weaponId:id,magazine:100,reloading:false,reloadTimer:0,fireCooldown:0,burstLeft:0,burstTimer:0,ads:1,heat:0,recoilPitch:0,recoilYaw:0,moving:0,shotsFired:0});
   ia.cancelAll();ia.setAxis('move',0,0);ia.setAxis('look',0,0);a.yaw=0;a.pitch=0;g.resetAim(a);a.cancelVersion=ia.cancellationVersion;a.ads=1;
  };
  const step=(n)=>{for(let j=0;j<n;j++){g.stepPlayer(a,1/120);g.ctx.input.update();}};
  setup();ia.setDown('fire');step(120);const held=a.shotsFired;ia.setUp('fire');g.ctx.input.update();
  setup();for(let j=0;j<6;j++){ia.tap('fire');step(20);}const taps=a.shotsFired;
  setup();ia.tap('fire');g.stepPlayer(a,.008);g.stepPlayer(a,.008);const substeps=a.shotsFired;
  setup();a.fireCooldown=.06;ia.tap('fire');step(12);const buffered=a.shotsFired;
  setup();a.fireCooldown=.06;ia.tap('fire');step(1);ia.cancelAll();step(20);const cancelled=a.shotsFired;
  setup('mitraglia');ia.setDown('fire');step(120);const automatic=a.shotsFired;
  setup('raffica');ia.setDown('fire');step(1);ia.setUp('fire');step(29);const burst=a.shotsFired;
  setup('laser',true);g.fireShot(a,getWeapon('laser'));const sniper={hp:b.hp,alive:b.alive,kills:a.kills};
  setup('laser',true);b.guardTime=5;g.fireShot(a,getWeapon('laser'));const armorPreserved=b.alive;
  setup('bombarda',true);g.fireShot(a,getWeapon('bombarda'));const rayAtLaunch={hp:b.hp,bolts:g.energyBolts.length};for(let j=0;j<30;j++)g.stepEnergyBolts(1/120);const rayHit={hp:b.hp,ownerHp:a.hp,bolts:g.energyBolts.length};
  setup('bombarda',true);g.fireShot(a,getWeapon('bombarda'));b.x=-16;for(let j=0;j<180;j++)g.stepEnergyBolts(1/120);const dodged=b.hp;
  setup('bombarda',true);a.x=b.x=0;a.z=-12;b.z=-5;g.fireShot(a,getWeapon('bombarda'));for(let j=0;j<180;j++)g.stepEnergyBolts(1/120);const blocked=b.hp;
  setup('bombarda',true);Object.assign(rest[0],{...b,id:rest[0].id,x:-18.9,alive:true,hp:100});g.fireShot(a,getWeapon('bombarda'));for(let j=0;j<30;j++)g.stepEnergyBolts(1/120);const splash=rest[0].hp;
  setup('pistola');a.magazine=1;ia.tap('fire');step(1);const autoReload=a.reloading;step(150);const reloaded=!a.reloading&&a.magazine===getWeapon('pistola').magazine;
  setup();a.bag=[];const bag=[];for(let j=0;j<WEAPONS.length;j++){g.equipNext(a);bag.push(a.weaponId);}
  const {BotInputs}=await import('/src/minigames/bots/BotInputs.ts');const bot=new BotInputs(g.ctx,1);setup();for(let j=0;j<120;j++){bot.tick(1/120);bot.fireWeapon(a.id,true,'pistola');g.stepPlayer(a,1/120);g.ctx.input.update();}const botSemi=a.shotsFired;
  setup('laser',true);a.kills=9;g.fireShot(a,getWeapon('laser'));const target10=g.winnerId===a.id&&a.kills===10;g.winnerId=null;a.kills=0;
  const importedMaps=[];
  const {TerminalArena}=await import('/src/minigames/fps/terminalArena.ts');const {NuketownArena}=await import('/src/minigames/fps/nuketownArena.ts');
  const terminal=await TerminalArena.load(),nuke=new NuketownArena(),legacy=await(await fetch('/docs/agent-work/terminal-2/initial-browser-checks.json')).json();
  let nukePair;for(const x of nuke.spawns){for(const y of nuke.nav){const d=Math.hypot(y.x-x.x,y.z-x.z);if(d>4&&d<10&&nuke.visible(x,y)){nukePair=[x,{...y,y:nuke.floorAt(y.x,y.z)}];break;}}if(nukePair)break;}
  for(const [name,arena,pair,cover]of [['terminal',terminal,legacy.geometry.clear,legacy.geometry.covered],['nuketown',nuke,nukePair,null]]){
   g.nuketown=arena;
   const shoot=points=>{setup('bombarda',true);for(const[p,v]of[[a,points[0]],[b,points[1]]])Object.assign(p,v,{groundY:v.y??0,y:v.y??0});const dx=b.x-a.x,dz=b.z-a.z;a.yaw=Math.atan2(dx,dz);a.pitch=Math.atan2(b.y+1.2-a.y-1.5,Math.hypot(dx,dz));g.fireShot(a,getWeapon('bombarda'));for(let j=0;j<180;j++)g.stepEnergyBolts(1/120);return b.hp;};
   const clearHp=shoot(pair),coveredHp=cover?shoot(cover):null;importedMaps.push({name,clearHp,coveredHp});
  }g.nuketown=null;
  for(const p of g.players){p.alive=true;p.hp=100;p.reloading=false;p.weaponId='laser';p.ads=1;p.kills=0;}
  return{held,taps,substeps,buffered,cancelled,automatic,burst,sniper,armorPreserved,rayAtLaunch,rayHit,dodged,blocked,splash,autoReload,reloaded,bag,botSemi,target10,importedMaps};
 });
 const c=report.combat;assert.equal(c.held,1);assert.equal(c.taps,6);assert.equal(c.substeps,1);assert.equal(c.buffered,1);assert.equal(c.cancelled,0);assert.ok(c.automatic>=8);assert.equal(c.burst,3);assert.equal(c.sniper.alive,false);assert.ok(c.armorPreserved);assert.equal(c.rayAtLaunch.hp,100);assert.equal(c.rayAtLaunch.bolts,1);assert.equal(c.rayHit.hp,20);assert.equal(c.rayHit.ownerHp,100);assert.equal(c.rayHit.bolts,0);assert.equal(c.dodged,100);assert.equal(c.blocked,100);assert.ok(c.splash<100&&c.splash>55);assert.ok(c.autoReload&&c.reloaded&&c.target10);assert.equal(new Set(c.bag).size,6);assert.ok(c.botSemi>=5);assert.ok(c.importedMaps.every(m=>m.clearHp===20));assert.equal(c.importedMaps[0].coveredHp,100);
 report.fiveScopes=await G(async g=>{
  const r=g.splitScreen;for(let i=0;i<g.players.length;i++)Object.assign(g.players[i],{x:-20+i*4,z:-20,alive:true,weaponId:'laser',magazine:5,ads:1,reloading:false});
  const snaps=g.players.map(p=>g.toRenderSnapshot(p));r.update(1/60,snaps);await Promise.all(r.cams.map(c=>c.vm.whenReady()));for(let i=0;i<90;i++)r.update(1/60,snaps);await r.scene.whenReadyAsync();r.scene.render();
  return r.cams.map(c=>({scope:r.hud.get(c.playerId).scope.alpha,fov:c.camera.fov,gunHidden:!c.vm.current.root.isEnabled(),scopeSize:r.hud.get(c.playerId).scopeSize}));
 });assert.equal(report.fiveScopes.length,5);assert.ok(report.fiveScopes.every(s=>s.scope===1&&s.gunHidden&&s.fov<.3));await sleep(400);await page.screenshot({path:out+'/scope-five.png'});
 report.fxPool=await G(g=>{const r=g.splitScreen,before=r.scene.meshes.length;for(let i=0;i<100;i++){r.onSignal(null,{type:'energyBolt',id:i,ox:-20,oy:1.5,oz:-20,dx:0,dy:0,dz:1,speed:55,range:60});r.onSignal(null,{type:'energyImpact',id:i,x:-20,y:1.5,z:-10,r:1.8});r.updateFx(.01);}return{before,after:r.scene.meshes.length,bolts:r.energyFx.bolts.length,impacts:r.energyFx.impacts.length};});assert.equal(report.fxPool.before,report.fxPool.after);assert.equal(report.fxPool.bolts,32);
 assert.deepEqual(errors,[]);console.log(JSON.stringify(report));
}finally{writeFileSync(out+'/gameplay-checks.json',JSON.stringify({...report,errors},null,2));await browser.close();}
