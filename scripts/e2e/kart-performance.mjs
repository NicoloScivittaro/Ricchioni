import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {launch,createRoomOnHost,addPhone,hostEval,sleep} from './lib.mjs';
import {gameEval,startGame,until} from './padmock.mjs';
const dir='docs/agent-work/physics-update',label=process.env.PERF_LABEL??'kart-performance',browser=await launch(),report={errors:[],warmupMs:Number(process.env.PERF_WARMUP_MS??0),fixture:'five participants driven by existing bot logic; mixed initial items; live simulation/render',samples:[]};
try{
 const {page,code}=await createRoomOnHost(browser,{targetKeyPresses:3});
 page.on('pageerror',e=>report.errors.push(String(e)));
 for(let i=0;i<5;i++)await addPhone(browser,code,'Perf'+i,i);
 const G=(fn,arg)=>gameEval(page,'kart3d',fn,arg);
 await startGame(page,'kart3d');await until(()=>G(g=>g.race.phase==='racing'),30000,'via');
 await until(()=>G(g=>[...g.entities.values()].filter(e=>e.goblinDebug?.()).every(e=>e.goblinDebug().state==='ready')),60000,'native');
 await G(g=>{
  const ks=[...g.karts.values()];g.soloBots.ids=new Set(ks.map(k=>k.playerId));
  for(const [i,k] of ks.entries())Object.assign(k,{distance:65+i*8,lateral:0,speed:40,heading:0,absHeading:g.trackAngleAt(65+i*8)});
  const use=(k,item)=>{k.heldItem=item;g.items.useItem(k,ks,id=>ks.findIndex(k=>k.playerId===id)+1);};
  use(ks[0],'calamita');use(ks[0],'turbo_difettoso');use(ks[1],'piccione');use(ks[2],'buca');use(ks[3],'raffica');use(ks[4],'paraurti');use(ks[4],'mollone');
 });
 await sleep(report.warmupMs);
 await G(g=>{
  const stats={};g.__perfCounts=stats;
  const measure=(object,key,name)=>{const original=object[key];object[key]=function(...args){const t=performance.now();try{return original.apply(this,args);}finally{stats[name+'Ms']=(stats[name+'Ms']??0)+performance.now()-t;stats[name+'Calls']=(stats[name+'Calls']??0)+1;}};};
  measure(g,'step','step');measure(g.scene,'render','render');
  for(const e of g.entities.values())measure(e,'updateVisual','visual');
  for(const key of ['update','layout','updateMinimap'])measure(g.hud,key,'hud');
 });
 const start=await G(g=>g.race.raceTime);
 for(const [width,height] of [[1280,720],[1920,1080]]){
  await page.setViewport({width,height});await G(g=>g.engine.resize());await sleep(1000);
  for(let i=0;i<3;i++){await sleep(1000);report.samples.push({width,height,...await G(g=>({fps:g.engine.getFps(),scale:g.engine.getHardwareScalingLevel(),renderSize:[g.engine.getRenderWidth(),g.engine.getRenderHeight()],shadows:g.scene.shadowsEnabled,meshes:g.scene.meshes.length,materials:g.scene.materials.length,time:g.race.raceTime,speeds:[...g.karts.values()].map(k=>k.speed),paused:g.paused,cpu:g.__perfCounts}))});}
  await page.screenshot({path:`${dir}/${label}-${width}.png`});
 }
 assert.ok(report.samples.every(s=>!s.paused&&s.speeds.every(Number.isFinite)));
 assert.ok(report.samples.at(-1).time-start>5,'real clock advances while rendering');
 await hostEval(page,gm=>gm.restartMatch());await sleep(1500);
 report.cleanup=await page.evaluate(()=>document.querySelectorAll('canvas').length);assert.equal(report.cleanup,1);
 assert.deepEqual(report.errors,[]);console.log('PASS live five-kart performance',JSON.stringify(report.samples.map(s=>({width:s.width,fps:s.fps}))));
}finally{writeFileSync(`${dir}/${label}.json`,JSON.stringify(report,null,2));await browser.close();}
