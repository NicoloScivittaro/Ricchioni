import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
process.env.CTRL_URL='http://127.0.0.1:3001/controller.html';
const {launch,addPhone,sleep}=await import('./lib.mjs');
const browser=await launch(),out='docs/agent-work/backrooms',report={errors:[],models:[],phases:[],chunks:[],phoneStates:[]};
try{
 const page=await browser.newPage();let state=null,code=null;const t0=Date.now();page.on('pageerror',e=>report.errors.push(String(e)));
 page.on('response',r=>{if(/\.glb(?:\?|$)/.test(r.url()))report.models.push({url:r.url(),status:r.status()});});
 page.on('request',r=>{if(/BabylonBackroomsGame-.*\.js/.test(r.url()))report.chunks.push({url:r.url(),ms:Date.now()-t0});});
 const net=await page.createCDPSession();await net.send('Network.enable');net.on('Network.webSocketFrameReceived',({response})=>{const raw=response.payloadData??'';if(!raw.startsWith('42'))return;try{const[e,p]=JSON.parse(raw.slice(2));if(e==='room:state'){if(p.phase!==state?.phase)report.phases.push({phase:p.phase,ms:Date.now()-t0});state=p;code??=p.roomCode;}}catch{}});
 const until=async(fn,label,ms=60000)=>{const t=Date.now();while(Date.now()-t<ms){if(await fn())return;await sleep(150);}throw new Error('timeout '+label);};
 await page.goto('http://127.0.0.1:3001/',{waitUntil:'load'});await page.waitForSelector('#app canvas');await sleep(1800);
 for(let i=0;i<3;i++){await page.keyboard.press('ArrowRight');await sleep(160);}await page.keyboard.press('Enter');await until(()=>code,'room');
 const phone=await addPhone(browser,code,'Niko',0);phone.page.on('pageerror',e=>report.errors.push('phone '+e));
 const phoneNet=await phone.page.createCDPSession();await phoneNet.send('Network.enable');let lastStatus='';phoneNet.on('Network.webSocketFrameReceived',({response})=>{const raw=response.payloadData??'';if(!raw.startsWith('42'))return;try{const[e,s]=JSON.parse(raw.slice(2));if(e==='controller:signal'&&s.type==='backroomsStatus'){const key=s.state+':'+s.lives;if(key!==lastStatus){lastStatus=key;report.phoneStates.push({state:s.state,lives:s.lives,ms:Date.now()-t0});}}}catch{}});await until(()=>state.players.length===1&&state.players[0].ready,'ready');
 for(let i=0;i<15;i++){await page.keyboard.press('ArrowRight');await sleep(150);}await until(()=>state.selectedMinigameId==='backrooms','Backrooms selected');report.start=Date.now()-t0;await page.keyboard.press('Enter');await until(()=>state.phase==='MINIGAME_PLAYING','playing');report.playing=Date.now()-t0;
 assert.equal(state.players.length,5);assert.equal(state.players.filter(p=>p.bot).length,4);
 await phone.page.waitForSelector('#back-move');await until(()=>phone.page.$eval('#back-run',b=>!b.disabled),'authoritative exploration ready');
 await until(()=>report.models.filter(r=>r.status===200).length>=4,'4 original models');assert.equal(await phone.page.evaluate(()=>document.querySelectorAll('canvas').length),0);
 await page.screenshot({path:`${out}/production-five.png`});await phone.page.screenshot({path:`${out}/production-phone.png`});const start=Date.now();
 // No fixture/import/forced finish. The human is AFK; creatures may capture them after grace. Escape/elimination or the real seven-minute cap ends the round.
 await until(()=>state.lastResults&&state.lastResults.results.length===5,'natural completion or seven-minute cap',530000);report.wallSeconds=(Date.now()-start)/1000;report.results=state.lastResults;
 assert.deepEqual(state.lastResults.results.map(r=>r.placement).sort(),[1,2,3,4,5]);assert.ok(state.lastResults.results.every(r=>r.stats.length>=1));assert.ok(Object.values(state.lastResults.deltas).every(v=>v>0));
 await until(()=>state.phase==='ROUND_RESULTS','result screen');await sleep(6000);await page.screenshot({path:`${out}/production-results.png`});
 assert.ok(report.chunks.length);assert.ok(report.chunks[0].ms>=report.start&&report.chunks[0].ms<report.playing);assert.deepEqual(report.errors,[]);
 console.log('PASS compiled production Backrooms: real menu, lazy chunk,4Tripo,phone controller only,4 bots,natural completion and global scores,no dev imports/no forced finish/no errors.');
}finally{writeFileSync(`${out}/production.json`,JSON.stringify(report,null,2));await browser.close();}
