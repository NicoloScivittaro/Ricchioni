import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {launch,createRoomOnHost,addPhone,hostEval,hostSnapshot,sleep} from './lib.mjs';
import {gameEval,sceneEval,startGame,until} from './padmock.mjs';
const report={errors:[],games:{}},out='docs/agent-work/physics-update';
for(const id of (process.env.COLLISION_GAMES??'dodgeball,soccer,kart3d,fps').split(',')){
 const browser=await launch();try{
  const {page,code}=await createRoomOnHost(browser,{targetKeyPresses:3});page.on('pageerror',e=>report.errors.push(`${id}: ${e}`));
  for(let i=0;i<5;i++)await addPhone(browser,code,'Collision'+i,i);
  await startGame(page,id);const G=(fn,arg)=>(id==='fps'?sceneEval:gameEval)(page,id,fn,arg);
  if(id!=='fps')await until(()=>G(g=>g.phase==='playing'||g.race?.phase==='racing'),30000,'via');
  await sleep(id==='fps'?12000:6000);
  if(id!=='fps')await G(g=>{g.paused=true;g.ctx.input.reset();g.soloBots.ids.clear();});else await G(g=>{g.scene.pause();g.ctx.input.reset();g.soloBots.ids.clear();});
  const cases=[];
  if(id==='dodgeball')for(const fps of [30,60,120])for(const kind of ['hit','dodge','parry','moving']){
   const r=await G((g,a)=>{g.players.forEach((p,i)=>Object.assign(p,{alive:true,falling:false,hasBall:false,x:-10+i*5,z:6,y:0,vx:0,vz:0,invulnTime:0,dodgeTime:0,parryTime:0,guardTime:0,truckTime:0,armTime:0}));
    const [owner,victim]=g.players;owner.x=-12;owner.z=0;victim.x=0;victim.z=0;
    const prev=new Map(g.players.map(p=>[p.id,{x:p.x,z:p.z}]));if(a.kind==='moving'){prev.set(victim.id,{x:-3,z:0});victim.x=3;}
    if(a.kind==='dodge')victim.invulnTime=.3;if(a.kind==='parry')victim.parryTime=.3;
    const b=g.balls[0];g.balls.slice(1).forEach(b=>b.state='held');Object.assign(b,{state:'flying',holderId:null,throwerId:owner.id,x:a.kind==='moving'?0:-2,z:0,vx:a.kind==='moving'?4:240,vz:0,life:.2,bounces:0,bounceDamp:.82});
    g.updateBalls(1/a.fps,prev);g.syncBallMeshes(performance.now());return {alive:victim.alive,life:b.life,state:b.state,thrower:b.throwerId,owner:owner.id,victim:victim.id,vx:b.vx};
   },{fps,kind});if(kind==='hit'||kind==='moving')assert.equal(r.alive,false,`${fps} ${kind}`);if(kind==='dodge')assert.ok(r.alive&&r.state==='flying'&&r.thrower===r.owner,'dodge passes ball without bounce');if(kind==='parry')assert.equal(r.thrower,r.victim);cases.push({fps,kind,...r});
  }
  if(id==='soccer')for(const fps of [30,60,120]){
   const r=await G((g,fps)=>{g.phase='playing';g.ctx.input.reset();g.players.forEach((p,i)=>Object.assign(p,{alive:true,x:8+i,z:8,y:0,vx:0,vz:0,stunTime:0,hasBall:false,lunge:false,charging:false}));const p=g.players[1];p.x=p.z=0;
    Object.assign(g.ball,{x:-2,z:0,vx:30,vz:0,ownerId:null,lastKickerId:g.players[0].id,curve:0,freeGrace:1});for(let n=0;n<Math.ceil(fps*.06);n++)g.step(1/fps);return {vx:g.ball.vx,x:g.ball.x,phase:g.phase};
   },fps);assert.ok(r.vx<0,`${fps} soccer block`);cases.push({fps,...r});
  }
  if(id==='kart3d')for(const fps of [30,60,120]){
   const r=await G((g,fps)=>{g.race.phase='racing';g.ctx.input.reset();const ks=[...g.karts.values()];ks.forEach((k,i)=>Object.assign(k,{distance:100+i*20,lateral:0,speed:0,heading:0,absHeading:g.trackAngleAt(100+i*20),invulnTimer:0,finished:false,respawnTimer:0,stunTimer:0,collisionYawVelocity:0,slipVelocity:0,bumperTimer:0,boostTimer:0,oilTimer:0,lightMode:false,truckMode:false}));const[a,b]=ks;a.distance=100;a.speed=80;b.distance=103.5;b.speed=-18;b.absHeading=g.trackAngleAt(b.distance);g.ctx.input.get(a.playerId).setDown('up');g.step(1/fps);const first={a:a.speed,b:b.speed,gap:b.distance-a.distance};a.distance=100;b.distance=110;a.lateral=b.lateral=0;a.speed=b.speed=40;a.heading=b.heading=0;a.slipVelocity=b.slipVelocity=0;g.resolveKartCollisions();return {first,nearby:[a.speed,b.speed]};},fps);
   assert.ok(r.first.gap>2.7&&r.first.a<80&&r.first.b>=0,'no fast overtaking through stationary collider');assert.deepEqual(r.nearby,[40,40]);cases.push({fps,...r});
  }
  if(id==='fps'){
   const r=await G(async g=>{const {getWeapon}=await import('/shared/fpsWeapons.ts');const[owner,front,rear,protectedP]=g.players;g.players.forEach((q,i)=>Object.assign(q,{alive:true,hp:100,x:12,z:-22+i*2,spawnProtection:0,guardTime:0,armTime:0,wallTime:0,stunTime:0}));
    front.x=-3.5;front.z=0;rear.x=3.5;rear.z=0;protectedP.x=-4;protectedP.z=0;protectedP.spawnProtection=5;
    g.blasts=[{x:-2.52,y:1,z:0,at:g.clock,owner:owner.id,dmg:40,radius:8}];g.stepBlasts();const splash={front:front.hp,rear:rear.hp,protected:protectedP.hp};
    const weapons=[];
    const {WEAPONS}=await import('/shared/fpsWeapons.ts');
    for(const w of WEAPONS){g.players.forEach((q,i)=>Object.assign(q,{alive:true,hp:100,spawnProtection:0,x:12,z:-22+i*2}));owner.x=-4;owner.z=0;owner.yaw=Math.PI/2;owner.pitch=owner.recoilPitch=owner.recoilYaw=owner.heat=0;owner.ads=1;owner.moving=0;owner.magazine=w.magazine;owner.fireCooldown=0;owner.reloading=false;owner.weaponId=w.id;rear.x=4;rear.z=0;g.blasts=[];g.fireShot(owner,w);g.clock+=10;g.stepBlasts();weapons.push({id:w.id,hp:rear.hp});}
    g.splitScreen?.update(.001,g.players.map(p=>g.toRenderSnapshot(p))); return {splash,weapons};
   });assert.ok(r.splash.front<100);assert.equal(r.splash.rear,100);assert.equal(r.splash.protected,100);assert.ok(r.weapons.every(w=>w.hp===100),'all weapons blocked by centre container');cases.push(r);
  }
  report.games[id]=cases;console.log('PASS collision',id,JSON.stringify(cases));
  // Render actual prepared scene continuously, without advancing simulation.
  if(id!=='fps')await G(g=>g.engine.runRenderLoop(()=>{if(!g.scene.isDisposed)g.scene.render();}));await sleep(350);await page.screenshot({path:`${out}/collision-${id}-five.png`});
  await hostEval(page,gm=>gm.restartMatch());await until(async()=>(await hostSnapshot(page)).phase==='LOBBY',15000,'lobby');assert.equal(await page.evaluate(()=>document.querySelectorAll('canvas').length),1);
 }finally{await browser.close();writeFileSync(`${out}/collision-browser-progress.json`,JSON.stringify(report,null,2));}
}
assert.deepEqual(report.errors,[]);writeFileSync(`${out}/collision-browser.json`,JSON.stringify(report,null,2));console.log('PASS five-player collision browser and cleanup');
