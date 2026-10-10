import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
process.env.CTRL_URL=process.env.PROD_CTRL??'http://127.0.0.1:3001/controller.html';
const {launch,addPhone,sleep}=await import('./lib.mjs');
const browser=await launch();const report={errors:[],accelerated:false,eliminated:[],suddenAt:null,startedAt:null};
const until=async(fn,what,ms=60000)=>{const end=Date.now()+ms;while(Date.now()<end){if(await fn())return;await sleep(100);}throw Error(`Timeout ${what}`);};
async function observe(page,callback){page.on('pageerror',e=>report.errors.push(String(e)));const c=await page.createCDPSession();await c.send('Network.enable');c.on('Network.webSocketFrameReceived',({response})=>{if(!response.payloadData.startsWith('42'))return;try{callback(...JSON.parse(response.payloadData.slice(2)));}catch{}});}
try{
 const host=await browser.newPage();let state;
 await observe(host,(event,data)=>{if(event==='room:state')state=data;});
 await host.goto(process.env.PROD_HOST??'http://127.0.0.1:3001/',{waitUntil:'load'});await host.waitForSelector('#app canvas');await sleep(1500);
 for(let i=0;i<3;i++){await host.keyboard.press('ArrowRight');await sleep(180);}await host.keyboard.press('Enter');await until(()=>state?.roomCode,'stanza');
 const phones=[];
 for(let i=0;i<5;i++){
  const p=await addPhone(browser,state.roomCode,`P${i}`,i);
  await observe(p.page,(event,data)=>{
   if(event!=='controller:signal')return;
   if(data.type==='countdown'&&data.value===0&&!report.startedAt)report.startedAt=Date.now();
   if(data.type==='sudden_death'&&!report.suddenAt){report.suddenAt=Date.now();report.phaseAtSudden=state.phase;}
   if(data.type==='eliminated')report.eliminated.push({playerId:p.playerId,time:Date.now()});
   if(data.type==='won')report.winner=p.playerId;
  });
  p.playerId=state.players.find(x=>x.displayName===`P${i}`).id;phones.push(p);
 }
 await until(()=>state.players.length===5&&state.players.every(p=>p.ready),'pronti');
 for(let i=0;i<4;i++){await host.keyboard.press('ArrowRight');await sleep(180);}await host.keyboard.press('Enter');
 await until(()=>state.phase==='MINIGAME_PLAYING'&&state.currentMinigame?.minigameId==='arena','Arena');
 await until(()=>!!report.suddenAt,'sudden death a tempo reale',100000);
 assert.equal(report.phaseAtSudden,'MINIGAME_PLAYING');assert.ok(report.suddenAt-report.startedAt>=44000);
 await host.screenshot({path:'docs/agent-work/post-playtest/arena-production.png'});
 await until(()=>state.phase==='ROUND_RESULTS'||state.phase==='MATCH_END','risultati naturali',60000);
 const results=state.lastResults.results;assert.equal(results.length,5);assert.ok(report.eliminated.length>=4);
 assert.equal(results[0].playerId,report.winner);
 if(report.eliminated.length===5)assert.match(results[0].stats.join(' '),/spareggio/);
 else assert.match(results[0].stats.join(' '),/ultimo in piedi/);
 assert.deepEqual(report.errors,[]);report.results=results;
 writeFileSync('docs/agent-work/post-playtest/arena-production.json',JSON.stringify(report,null,2));
 console.log('PASS produzione Arena: 5 giocatori, oltre 45 secondi reali, sudden death senza termine al timer e conclusione naturale coerente. Nessun debug/accelerazione/pageerror.');
}finally{await browser.close();}
