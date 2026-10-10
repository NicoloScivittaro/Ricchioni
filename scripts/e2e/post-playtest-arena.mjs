import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {launch,createRoomOnHost,addPhone,hostEval,hostSnapshot,sleep} from './lib.mjs';
import {installMock,add,tap,stick,XBOX,DS,GENERIC,until,slots,startGame,gameEval} from './padmock.mjs';
import {visualCounters} from './tripo-counters.mjs';
const browser=await launch();const report={errors:[],accelerated:true};
try{
 const {page,code}=await createRoomOnHost(browser,{targetKeyPresses:3});
 page.on('pageerror',e=>report.errors.push(String(e)));
 const phones=[];for(let i=0;i<5;i++){const p=await addPhone(browser,code,`P${i}`,i);p.page.on('pageerror',e=>report.errors.push(String(e)));phones.push(p);}
 const ids=await hostEval(page,gm=>gm.state.players.map(p=>p.id));
 const G=(fn,arg)=>gameEval(page,'arena',fn,arg);
 await installMock(page);
 for(let i=0;i<4;i++){await add(page,i,[XBOX,DS,GENERIC][i%3]);await page.evaluate(id=>window.__pads.setTarget(id),ids[i]);await tap(page,i,'A');}
 await page.evaluate(()=>window.__pads.setTarget(null));const pairing=await slots(page);
 await startGame(page,'arena');await until(async()=>await G(g=>g.phase==='playing'),30000,'via');
 await stick(page,0,.8,0);await sleep(350);await stick(page,0,0,0);
 assert.ok(await G((g,id)=>g.players.find(p=>p.id===id).vx>0,ids[0]),'stick produce movimento');
 await tap(page,0,'A');assert.ok(await G((g,id)=>g.players.find(p=>p.id===id).dashCooldown>0,ids[0]));
 await page.keyboard.press('Escape');await phones[4].page.waitForSelector('#pause-overlay');
 const time=await G(g=>g.gameTime);await phones[4].page.reload({waitUntil:'load'});await phones[4].page.waitForSelector('#pause-overlay');
 await sleep(300);assert.equal(await G(g=>g.gameTime),time);
 await page.keyboard.press('Escape');await phones[4].page.waitForFunction(()=>!document.querySelector('#pause-overlay'));
 await G(g=>{
  g.ctx.input.reset();g.gameTime=g.durationSec-.05;g.hitStop=0;
  g.players.forEach((p,i)=>{const a=i*Math.PI*2/5;p.x=Math.cos(a)*2.6;p.z=Math.sin(a)*2.6;p.vx=0;p.vz=0;p.dashing=false;p.dashCooldown=0;});
  g.step(.1);g.scene.render();
 });
 assert.deepEqual(await G(g=>[g.phase,g.suddenDeath,g.players.filter(p=>p.alive).length]),['playing',true,5]);
 assert.ok((await G(g=>g.currentRadius))>3.6);
 await page.screenshot({path:'docs/agent-work/post-playtest/arena-sudden.png'});
 const outcome=await G(g=>{
  let maximumAliveAtMinimum=0;
  for(let i=0;i<2500 && !g.resultsSent;i++){
   for(const p of g.players){if(!p.alive)continue;const d=Math.hypot(p.x,p.z)||1;g.ctx.input.get(p.id).setAxis('move',-p.x/d,p.z/d);}
   g.step(.05);
   if(g.currentRadius<=3.6001)maximumAliveAtMinimum=Math.max(maximumAliveAtMinimum,g.players.filter(p=>p.alive).length);
  }
  g.scene.render();
  return {phase:g.phase,time:g.gameTime,radius:g.currentRadius,alive:g.players.filter(p=>p.alive).length,results:g.buildResults(),maximumAliveAtMinimum,finite:g.players.every(p=>[p.x,p.z,p.vx,p.vz].every(Number.isFinite))};
 });
 assert.equal(outcome.phase,'celebrating');assert.ok(outcome.alive<=1);assert.ok(outcome.time>45);
 assert.equal(outcome.radius,3.6);assert.ok(outcome.maximumAliveAtMinimum>=2);assert.ok(outcome.finite);assert.equal(outcome.results.length,5);
 report.pressure=outcome;
 await until(async()=>['ROUND_RESULTS','MATCH_END'].includes((await hostSnapshot(page)).phase),15000,'risultati naturali');
 await hostEval(page,gm=>gm.restartMatch());await until(async()=>(await hostSnapshot(page)).phase==='LOBBY',15000,'lobby');
 assert.equal((await visualCounters(page)).liveInstances,0);assert.equal(await page.evaluate(()=>document.querySelectorAll('canvas').length),1);assert.equal(await slots(page),pairing);
 for(const p of phones){await p.page.waitForSelector('#ready');await p.page.click('#ready');}
 await until(()=>hostEval(page,gm=>gm.state.players.every(p=>p.ready)),5000,'pronti');
 await startGame(page,'arena');await until(async()=>await G(g=>g.phase==='playing'),30000,'secondo via');
 const tie=await G(g=>{
  g.ctx.input.reset();g.players.forEach((p,i)=>{p.x=g.currentRadius+.1+i*.1;p.z=0;p.vx=0;p.vz=0;});
  g.checkEliminations();g.checkEndCondition();
  const winner=g.resolvedWinnerId;
  for(let i=0;i<45 && !g.resultsSent;i++)g.step(.05);
  return {winner,expected:g.players[0].id,alive:g.players.filter(p=>p.alive).length,results:g.buildResults()};
 });
 assert.equal(tie.alive,0);assert.equal(tie.winner,tie.expected);assert.equal(tie.results[0].playerId,tie.winner);assert.match(tie.results[0].stats.join(' '),/spareggio/);
 report.tie=tie;
 await until(async()=>['ROUND_RESULTS','MATCH_END'].includes((await hostSnapshot(page)).phase),15000,'risultati simultanei');
 await hostEval(page,gm=>gm.restartMatch());await until(async()=>(await hostSnapshot(page)).phase==='LOBBY',15000,'lobby finale');
 assert.equal((await visualCounters(page)).liveInstances,0);assert.deepEqual(report.errors,[]);
 writeFileSync('docs/agent-work/post-playtest/arena-browser.json',JSON.stringify(report,null,2));
 console.log('PASS Arena: 5 giocatori, pad/fallback, pausa/rejoin, nessuna vittoria al timer, sudden death/minimo, anti-stallo contro input verso centro, spareggio, risultati naturali e cleanup. Tempo accelerato.');
}finally{await browser.close();}
