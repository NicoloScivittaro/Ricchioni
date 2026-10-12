import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {launch,createRoomOnHost,addPhone,hostEval,hostSnapshot,sleep} from './lib.mjs';
import {gameEval,startGame,until} from './padmock.mjs';
const out='docs/agent-work/minigolf-2';mkdirSync(out,{recursive:true});const rows=[];
for(const n of (process.env.GOLF_PLAYERS??'2,3,4,5').split(',').map(Number)){
 const browser=await launch(),errors=[];
 try{
  const {page,code}=await createRoomOnHost(browser,{targetKeyPresses:n-2});page.on('pageerror',e=>errors.push(String(e)));
  const phones=[];for(let i=0;i<n;i++)phones.push(await addPhone(browser,code,`Golfer${i+1}`,i));const G=(f,a)=>gameEval(page,'minigolf',f,a);
  await startGame(page,'minigolf');await until(()=>G(g=>g.phase==='playing'),50000,'playing');
  const first=await G(g=>({id:g.match.active.id,turn:g.match.turn,pos:{x:g.match.active.ball.x,z:g.match.active.ball.z}}));
  await until(()=>G((g,t)=>g.match.turn>t,first.turn),22000,'natural fifteen second timeout');
  const timeout=await G((g,id)=>{const p=g.players.find(p=>p.id===id);return{strokes:p.strokes,x:p.ball.x,z:p.ball.z};},first.id);assert.equal(timeout.strokes,1);assert.equal(timeout.x,first.pos.x);assert.equal(timeout.z,first.pos.z);
  await G(g=>{for(const p of g.players)p.bot=true;});let data;
  for(let i=0;i<800;i++){const d=await G(g=>{for(let j=0;j<50&&!g.resultsSent;j++)g.step(.02);return window.__golfLast={ended:g.resultsSent,time:g.match.time,courses:g.match.courses.map(c=>c.id),players:g.players.map(p=>({id:p.id,total:p.total,penalties:p.totalPenalties,completed:p.completed,aimTime:p.completionTime,records:p.records}))};});
   if(d)data=d;else{data=await page.evaluate(()=>window.__golfLast);data.ended=true;break;}if(data.ended)break;await sleep(20);}
  assert.ok(data.ended);assert.equal(data.courses.length,3);assert.ok(data.players.every(p=>p.records.length===3));await until(async()=>['ROUND_RESULTS','MATCH_END'].includes((await hostSnapshot(page)).phase),15000,'natural ranking');
  const results=await hostEval(page,gm=>gm.state.lastResults.results);assert.equal(results.length,n);assert.ok(results.every(p=>p.placement>=1&&p.placement<=n));assert.equal(new Set(data.courses).size,3);
  await sleep(5500);await page.screenshot({path:`${out}/natural-results-${n}p.png`});const scores=await hostEval(page,gm=>gm.state.players.map(p=>p.score));assert.ok(scores.some(s=>s>0));
  await hostEval(page,gm=>gm.restartMatch());await until(async()=>(await hostSnapshot(page)).phase==='LOBBY',12000,'lobby');assert.equal(await page.evaluate(()=>document.querySelectorAll('canvas').length),1);assert.deepEqual(errors,[]);
  rows.push({n,...data,timeout,results,scores,errors});console.log(`PASS ${n}p: timeout without movement, three unique natural courses, full ranking, global points and lobby disposal.`);
 }finally{writeFileSync(`${out}/natural-rounds.json`,JSON.stringify(rows,null,2));await browser.close();}
}
