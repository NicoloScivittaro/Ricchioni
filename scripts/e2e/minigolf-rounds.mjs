import assert from 'node:assert/strict';
import {writeFileSync,readFileSync} from 'node:fs';
import {launch,createRoomOnHost,addPhone,hostEval,hostSnapshot,sleep} from './lib.mjs';
import {gameEval,startGame,until,watchControls,installMock,add,tap,XBOX,DS,GENERIC} from './padmock.mjs';
const rows=process.env.GOLF_PLAYERS?JSON.parse(readFileSync('docs/agent-work/minigolf/natural-rounds.json','utf8')).filter(r=>!process.env.GOLF_PLAYERS.split(',').map(Number).includes(r.n)):[];const out='docs/agent-work/minigolf';
for(const n of (process.env.GOLF_PLAYERS??'5,2,3,4').split(',').map(Number)){
 const browser=await launch();const errors=[];
 try{
  const {page,code}=await createRoomOnHost(browser,{targetKeyPresses:n-2});page.on('pageerror',e=>errors.push(String(e)));
  const phones=[];for(let i=0;i<n;i++){const p=await addPhone(browser,code,`Golfer${i+1}`,i);p.page.on('pageerror',e=>errors.push(String(e)));phones.push(p);}
  const G=(f,a)=>gameEval(page,'minigolf',f,a);
  if(n===5){await installMock(page);const ids=await hostEval(page,gm=>gm.state.players.map(p=>p.id));for(const [i,pad]of[XBOX,DS,GENERIC].entries()){await add(page,i,pad);await sleep(200);await page.evaluate(id=>window.__pads.setTarget(id),ids[i]);await tap(page,i,'A');}await page.evaluate(()=>window.__pads.setTarget(null));}
  await watchControls(page);await startGame(page,'minigolf');await until(()=>G(g=>g.phase==='playing'),50000,'playing');
  if(n===5){
   await G(g=>{for(const [i,p]of g.players.entries()){Object.assign(p.ball,{x:-8+i*4,z:2,y:.28,vx:0,vy:0,vz:p.characterId==='judoka'?7:0,readyFor:1,grounded:true});p.used=false;p.blocked=false;p.charging=false;p.aim={x:0,z:-1};}});
   for(let i=0;i<3;i++)await tap(page,i,'RB');
   await G(g=>{const p=g.players[3];p.ball.x=6;p.ball.z=0;p.ball.vx=0;p.ball.vz=-5;});
   for(const i of[3,4])await phones[i].page.click('#golf-ability');
   console.log('ability fixture',JSON.stringify(await G(g=>g.players.map(p=>({char:p.characterId,used:p.used,speed:Math.hypot(p.ball.vx,p.ball.vz),armed:p.armed})))));
   await until(()=>G(g=>g.players.every(p=>p.used)),5000,'all five abilities via actual inputs');
   assert.equal(await G(g=>g.match.extras.length),1);
   await until(()=>phones[0].page.evaluate(()=>document.querySelector('#cc-status')?.textContent.includes('ARMATO')),4000,'companion armed');
   await until(()=>phones[3].page.evaluate(()=>document.querySelector('#golf-ability-status')?.textContent==='ESAURITA'),4000,'phone ability spent');
   await phones[0].page.screenshot({path:`${out}/companion-ability.png`});await phones[3].page.screenshot({path:`${out}/phone-ability-spent.png`});
   await G(g=>{g.players[2].charge=.6;g.players[2].charging=true;g.visuals.update(g.players,g.match.course,g.match.time,g.match.extras,.016);g.scene.render();});
   await page.screenshot({path:`${out}/five-abilities.png`});
   for(let i=0;i<3;i++)await tap(page,i,'RB');await sleep(200);assert.equal(await G(g=>g.match.extras.length),1,'no repeated resources');
   // Start an untouched match after the ability fixture; no forced result or cup teleport.
   await G(g=>{g.match=new g.match.constructor(g.ctx.players,()=>g.ctx.rng.next());g.courseIndex=-1;g.syncCourse();});
  }
  await G(g=>{for(const p of g.players)p.bot=true;});
  let data;
  for(let i=0;i<220;i++){
   const sample=await G(g=>{for(let j=0;j<50&&!g.resultsSent;j++)g.step(.02);return window.__golfLast={ended:g.resultsSent,phase:g.phase,course:g.match.courseIndex,courses:g.match.courses.map(c=>c.id),players:g.players.map(p=>({id:p.id,total:p.total,pens:p.totalPenalties,completed:p.completed,records:p.records}))};});
   if(sample)data=sample;else{assert.ok(await hostEval(page,gm=>gm.state.lastResults),'natural scene teardown');data=await page.evaluate(()=>window.__golfLast);data.ended=true;break;}
   if(i===12)await page.screenshot({path:`${out}/natural-${n}p.png`});
   if(data.ended)break;await sleep(25);
  }
  assert.ok(data.ended,`${n}p ended`);assert.ok(data.players.every(p=>p.records.length===3));assert.equal(new Set(data.courses).size,3);
  await until(async()=>['ROUND_RESULTS','MATCH_END'].includes((await hostSnapshot(page)).phase),15000,'results');
  const results=await hostEval(page,gm=>gm.state.lastResults.results);assert.equal(results.length,n);assert.deepEqual(results.map(r=>r.placement).sort(),Array.from({length:n},(_,i)=>i+1));
  await sleep(6000);await page.screenshot({path:`${out}/results-${n}p.png`});
  await hostEval(page,gm=>gm.restartMatch());await until(async()=>(await hostSnapshot(page)).phase==='LOBBY',12000,'lobby');assert.equal(await page.evaluate(()=>document.querySelectorAll('canvas').length),1);assert.deepEqual(errors,[]);
  rows.push({n,ok:true,...data,results,errors});console.log(`PASS ${n}p: three natural holes, ranking and lobby cleanup${n===5?', all abilities pad/phone, Companion and phone states':''}`);
 }finally{writeFileSync(`${out}/natural-rounds.json`,JSON.stringify(rows,null,2));await browser.close();}
}
