import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {launch,createRoomOnHost,addPhone,hostEval,hostSnapshot,sleep} from './lib.mjs';
import {gameEval,startGame,until,installMock,add,XBOX,DS,GENERIC,btn,tap} from './padmock.mjs';
import {visualCounters} from './tripo-counters.mjs';
const browser=await launch(),report={errors:[],accelerated:true};
try{
 const {page,code}=await createRoomOnHost(browser,{targetKeyPresses:3});page.on('pageerror',e=>report.errors.push(String(e)));
 const phones=[];for(let i=0;i<5;i++){const p=await addPhone(browser,code,`P${i}`,i);p.page.on('pageerror',e=>report.errors.push(String(e)));phones.push(p);}
 const ids=await hostEval(page,gm=>gm.state.players.map(p=>p.id));await installMock(page);
 for(let i=0;i<3;i++){await add(page,i,[XBOX,DS,GENERIC][i]);await page.evaluate(id=>window.__pads.setTarget(id),ids[i]);for(let n=0;n<6&&(await page.evaluate(()=>window.__pads.pairedCount()))<i+1;n++){await tap(page,i,'A');await sleep(350);}}
 await page.evaluate(()=>window.__pads.setTarget(null));assert.equal(await page.evaluate(()=>window.__pads.pairedCount()),3);
 const G=(fn,arg)=>gameEval(page,'casacarbo',fn,arg);
 await startGame(page,'casacarbo');await until(async()=>await G(g=>g.tutorialStarted),30000,'tutorial interattivo');
 assert.equal(await G(g=>g.sim.time),0,'match clock stops during rehearsal');
 await G(g=>{const p=g.world.players[0];p.x=712;p.y=675;p.fx=0;p.fy=1;p.vx=p.vy=0;});
 await btn(page,0,'X',true);await until(async()=>await G(g=>g.tutorialStage>=1),5000,'spinta nel tutorial');await btn(page,0,'X',false);
 await btn(page,0,'Y',true);await until(async()=>await G(g=>g.tutorialStage>=2),5000,'raccolta nel tutorial');await btn(page,0,'Y',false);await sleep(250);
 await G(g=>{const p=g.world.players[0];p.x=860;p.y=795;p.vx=p.vy=0;});await tap(page,0,'Y',350);
 await until(async()=>await G(g=>g.phase==='countdown'),4000,'fine prova');
 assert.equal(await G(g=>g.world.players.reduce((a,p)=>a+p.bucket+p.stats.drainedBucket+p.stats.abilityUses,0)),0,'no carryover');
 await until(async()=>await G(g=>g.phase==='playing'),10000,'via');
 await page.keyboard.press('Escape');await phones[4].page.waitForSelector('#pause-overlay');const clock=await G(g=>g.sim.time);
 await phones[4].page.reload({waitUntil:'load'});await phones[4].page.waitForSelector('#pause-overlay');await sleep(350);assert.equal(await G(g=>g.sim.time),clock);
 await page.keyboard.press('Escape');await phones[4].page.waitForFunction(()=>!document.querySelector('#pause-overlay'));
 // Critical water fixture: no extra source in shipping gameplay. It exercises real emergency interaction and renderer.
 await G(g=>{const w=g.world;w.time=40;w.schedule=[];for(const k of w.grid.tvCells){w.h[k]=.9;w.inflowTotal+=.9;}const p=w.players[0];p.x=1245;p.y=580;p.vx=p.vy=0;});
 await until(async()=>await G(g=>g.world.tv==='danger'),3000,'TV in pericolo');await page.screenshot({path:'docs/agent-work/post-playtest/carbo-emergency.png'});
 await btn(page,0,'B',true);await until(async()=>await G(g=>g.world.tv==='saved'),4000,'TV salvata');await btn(page,0,'B',false);
 assert.ok(await G(g=>g.world.players[0].stats.tvSaved===1));
 await G(g=>g.world.players.forEach(p=>g.setBot(p.id,true)));
 let info;for(let batch=0;batch<35;batch++){
  info=await G(g=>{for(let i=0;i<120&&!g.resultsSent;i++)g.step(.05);return {time:g.world.time,phase:g.phase,dry:g.world.dryFraction(),inflow:g.world.inflowTotal,drained:g.world.drainedCredited,mesh:g.scene.meshes.length,finite:g.world.players.every(p=>[p.x,p.y,p.bucket].every(Number.isFinite))};});
  if(info?.phase==='ending')break;await sleep(70);
 }
 assert.equal(info.phase,'ending');assert.ok(info.time>=120&&info.drained>0&&info.finite);report.round=info;
 await G(g=>{for(let i=0;i<160&&!g.resultsSent;i++)g.step(.05);});
 await until(async()=>['ROUND_RESULTS','MATCH_END'].includes((await hostSnapshot(page)).phase),15000,'risultati naturali');assert.equal(await hostEval(page,gm=>gm.state.lastResults.results.length),5);
 await hostEval(page,gm=>gm.restartMatch());await until(async()=>(await hostSnapshot(page)).phase==='LOBBY',15000,'lobby');
 assert.equal((await visualCounters(page)).liveInstances,0);assert.equal(await page.evaluate(()=>document.querySelectorAll('canvas').length),1);assert.deepEqual(report.errors,[]);
 writeFileSync('docs/agent-work/post-playtest/carbo-browser.json',JSON.stringify(report,null,2));console.log('PASS Casa Carbo: five players, Xbox/DS/generic+phones, interactive 3-step rehearsal and no carryover, critical TV, real 120s simulator/result, pause/reload/lobby/resources, no pageerror. Accelerated + critical-water fixture.');
}finally{await browser.close();}
