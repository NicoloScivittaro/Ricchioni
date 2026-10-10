import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
process.env.CTRL_URL='http://127.0.0.1:3001/controller.html';
const {launch,addPhone,sleep}=await import('./lib.mjs');
const browser=await launch(),report={errors:[],accelerated:false,combatStates:[]};
async function until(fn,label,ms=60000){const end=Date.now()+ms;while(Date.now()<end){if(await fn())return;await sleep(150);}throw Error(`Timeout ${label}`);}
async function observe(page,callback){
 page.on('pageerror',e=>report.errors.push(String(e)));
 const cd=await page.createCDPSession();await cd.send('Network.enable');
 cd.on('Network.webSocketFrameReceived',({response})=>{if(!response.payloadData.startsWith('42'))return;try{callback(...JSON.parse(response.payloadData.slice(2)));}catch{}});return cd;
}
try {
 const host=await browser.newPage();let state,latest,viaAt;
 await observe(host,(ev,data)=>{if(ev==='room:state')state=data;});
 await host.goto('http://127.0.0.1:3001/',{waitUntil:'load'});await host.waitForSelector('#app canvas');await sleep(1500);
 for(let i=0;i<3;i++){await host.keyboard.press('ArrowRight');await sleep(180);}await host.keyboard.press('Enter');
 await until(()=>state?.roomCode,'room');const phone=await addPhone(browser,state.roomCode,'Niko Arena',4);
 const cd=await observe(phone.page,(ev,data)=>{
  if(ev!=='controller:signal')return;
  if(data.type==='countdown'&&data.value===0)viaAt=Date.now();
  if(data.type==='arenaCombat'){
   latest=data;
   if(report.combatStates.length<50&&(data.charge>0||data.cooldown>0||data.instability>0))report.combatStates.push(data);
  }
 });
 await until(()=>state.players.length===1&&state.players[0].ready,'ready');
 for(let i=0;i<4;i++){await host.keyboard.press('ArrowRight');await sleep(180);}await host.keyboard.press('Enter');
 await until(()=>state.phase==='MINIGAME_PLAYING'&&state.currentMinigame?.minigameId==='arena','arena');
 assert.equal(state.players.length,5);assert.equal(state.players.filter(p=>p.bot).length,4);
 await phone.page.waitForSelector('#arena-attack');await until(()=>viaAt&&latest?.alive,'via');
 await cd.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:3});
 const attack=await phone.page.evaluate(()=>{const r=document.querySelector('#arena-attack').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2,id:1};});
 await cd.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[attack]});
 await until(()=>latest?.charge>.4,'charged attack',5000);
 await phone.page.screenshot({path:'docs/agent-work/arena-combat/production-phone.png'});
 await cd.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await until(()=>latest?.cooldown>1&&latest.charge===0,'committed shoulder',5000);
 report.heldRelease=true;
 await host.screenshot({path:'docs/agent-work/arena-combat/production-arena.png'});
 await until(()=>state.phase==='ROUND_RESULTS'||state.phase==='MATCH_END','natural five-player results',180000);
 report.wallSeconds=(Date.now()-viaAt)/1000;report.results=state.lastResults.results;
 assert.equal(report.results.length,5);assert.ok(report.results.every(r=>r.placement>=1&&r.placement<=5));
 report.firstEliminationSecond=Math.min(...report.results.flatMap(r=>r.stats.map(s=>/caduto dopo (\d+)s/.exec(s)).filter(Boolean).map(m=>Number(m[1]))));
 report.assets=await host.evaluate(()=>performance.getEntriesByType('resource').map(e=>new URL(e.name).pathname).filter(p=>/\/assets\/(main|BabylonArenaGame)-/.test(p)));
 assert.ok(report.assets.length>=2);assert.deepEqual(report.errors,[]);
 console.log('PASS production Arena: phone hold/release, four bots, real-time natural round and five results. First KO:',report.firstEliminationSecond,'seconds; round:',report.wallSeconds);
}catch(e){report.failure=String(e);throw e;}
finally{writeFileSync('docs/agent-work/arena-combat/production.json',JSON.stringify(report,null,2));await browser.close();}
