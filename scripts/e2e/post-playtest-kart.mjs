import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {launch,createRoomOnHost,addPhone,hostEval,hostSnapshot,sleep} from './lib.mjs';
import {gameEval,startGame,until} from './padmock.mjs';
import {visualCounters} from './tripo-counters.mjs';
const browser=await launch(),report={errors:[],accelerated:true};
try{
 const {page,code}=await createRoomOnHost(browser,{targetKeyPresses:3});page.on('pageerror',e=>report.errors.push(String(e)));
 const phones=[];for(let i=0;i<5;i++){const p=await addPhone(browser,code,`P${i}`,i);p.page.on('pageerror',e=>report.errors.push(String(e)));phones.push(p);}
 const G=(fn,arg)=>gameEval(page,'kart3d',fn,arg);
 await startGame(page,'kart3d');await until(async()=>await G(g=>g.race.phase==='racing'),30000,'via');
 await until(async()=>await G(g=>[...g.entities.values()].filter(e=>e.goblinDebug?.()).every(e=>e.goblinDebug().state==='ready')),60000,'Tripo pronti');
 assert.equal(await G(g=>g.scene.activeCameras.length),5);
 await page.keyboard.press('Escape');await phones[0].page.waitForSelector('#pause-overlay');
 const paused=await G(g=>g.race.raceTime);await phones[0].page.reload({waitUntil:'load'});await phones[0].page.waitForSelector('#pause-overlay');
 await sleep(300);assert.equal(await G(g=>g.race.raceTime),paused);await page.keyboard.press('Escape');await phones[0].page.waitForFunction(()=>!document.querySelector('#pause-overlay'));
 const probes=await G(g=>{
  g.ctx.input.reset();
  const [a,b,...others]=[...g.karts.values()];
  const place=(k,d,l,s=44,h=0)=>{k.distance=d;k.lateral=l;k.speed=s;k.heading=h;k.absHeading=g.trackAngleAt(d)+h;k.slipVelocity=0;k.collisionYawVelocity=0;k.wallContact=false;k.stunTimer=0;k.invulnTimer=0;k.boostTimer=0;k.truckMode=false;k.lightMode=false;k.speedCapMultiplier=1;k.respawnTimer=0;};
  others.forEach((k,i)=>place(k,160+i*60,0,0));
  place(a,60,-1.5);place(b,60,1.5);
  for(let i=0;i<120;i++)g.resolveKartCollisions();const proximity=[a.speed,b.speed];
  place(a,60,-.99);place(b,60,.99);
  for(let i=0;i<120;i++)g.resolveKartCollisions();const gentle=[a.speed,b.speed,Math.abs(a.lateral-b.lateral)];
  place(a,60,0);place(b,62.6,0,20);g.resolveKartCollisions();const rear=[a.speed,b.speed];
  place(a,60,-.95,44,.2);place(b,60,.95,44,-.2);g.resolveKartCollisions();const side=[a.speed,b.speed,a.slipVelocity,b.slipVelocity,a.collisionYawVelocity,b.collisionYawVelocity];
  g.scene.render();return {proximity,gentle,rear,side};
 });
 assert.deepEqual(probes.proximity,[44,44]);assert.deepEqual(probes.gentle.slice(0,2),[44,44]);assert.ok(probes.gentle[2]>=2);
 assert.ok(probes.rear[0]<44&&probes.rear[0]>25&&probes.rear[1]>20);
 assert.ok(Math.abs(probes.side[2])+Math.abs(probes.side[3])>0);assert.ok(probes.side[0]>25&&probes.side[1]>25);report.probes=probes;
 await G(g=>{
  g.ctx.input.reset();g.race.raceTime=0;
  [...g.karts.values()].forEach((k,i)=>{k.distance=40-i*4;k.lateral=(i%2?1:-1)*2.3;k.absHeading=g.trackAngleAt(k.distance);k.heading=0;k.speed=0;k.slipVelocity=0;k.collisionYawVelocity=0;k.wallContact=false;k.stunTimer=0;k.lap=0;k.nextCheckpoint=1;k.lastValidCheckpointS=0;k.finished=false;k.finishTime=0;k.placement=0;});
  // Cinque piloti simulati scrivono nell'InputManager. Nessun traguardo o risultato viene forzato.
  g.soloBots.ids=new Set([...g.karts.keys()]);
 });
 await sleep(2500);await page.screenshot({path:'docs/agent-work/post-playtest/kart-five.png'});
 let result;
 for(let batch=0;batch<70&&(await hostSnapshot(page)).phase==='MINIGAME_PLAYING';batch++){
  result=await G(g=>{
   for(let i=0;i<120&&!g.resultsSent;i++)g.step(.05);
   return {phase:g.race.phase,time:g.race.raceTime,players:[...g.karts.values()].map(k=>({id:k.playerId,lap:k.lap,finished:k.finished,speed:k.speed,slip:k.slipVelocity,yaw:k.collisionYawVelocity,placement:k.placement})),finite:[...g.karts.values()].every(k=>[k.distance,k.lateral,k.speed,k.slipVelocity].every(Number.isFinite))};
  });
  if(result?.phase==='ended')break;await sleep(100);
 }
 assert.equal(result.phase,'ended');assert.ok(result.finite);assert.ok(result.players.some(k=>k.finished&&k.lap===3),'tre giri reali');report.race=result;
 await until(async()=>['ROUND_RESULTS','MATCH_END'].includes((await hostSnapshot(page)).phase),15000,'risultati');
 assert.equal(await hostEval(page,gm=>gm.state.lastResults.results.length),5);
 await hostEval(page,gm=>gm.restartMatch());await until(async()=>(await hostSnapshot(page)).phase==='LOBBY',15000,'lobby');
 assert.equal((await visualCounters(page)).liveInstances,0);assert.equal(await page.evaluate(()=>document.querySelectorAll('canvas').length),1);assert.deepEqual(report.errors,[]);
 writeFileSync('docs/agent-work/post-playtest/kart-browser.json',JSON.stringify(report,null,2));
 console.log('PASS Kart: 5 telefoni/viewport, Tripo, contatti reali senza frenata per vicinanza, tamponamento/laterale, pausa/rejoin, piloti simulati e tre giri, risultati naturali, lobby/cleanup. Tempo accelerato.');
}finally{await browser.close();}
