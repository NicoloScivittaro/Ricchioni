import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
process.env.CTRL_URL='http://127.0.0.1:3001/controller.html';
const {launch,addPhone,sleep}=await import('./lib.mjs');
const browser=await launch(),out='docs/agent-work/minigolf',report={errors:[],models:[],chunks:[],phases:[]};
try{
 const page=await browser.newPage();let state=null,code=null;page.on('pageerror',e=>report.errors.push(String(e)));
 const t0=Date.now();page.on('request',r=>{if(/BabylonMinigolfGame-.*\.js/.test(r.url()))report.chunks.push({url:r.url(),ms:Date.now()-t0});});
 page.on('response',r=>{if(/\.glb(?:\?|$)/.test(r.url()))report.models.push({url:r.url(),status:r.status()});});
 const cdp=await page.createCDPSession();await cdp.send('Network.enable');cdp.on('Network.webSocketFrameReceived',({response})=>{const raw=response.payloadData??'';if(!raw.startsWith('42'))return;try{const [e,p]=JSON.parse(raw.slice(2));if(e==='room:state'){if(p.phase!==state?.phase)report.phases.push({phase:p.phase,ms:Date.now()-t0});state=p;code??=p.roomCode;}}catch{}});
 const until=async(fn,label,ms=60000)=>{const t=Date.now();while(Date.now()-t<ms){if(await fn())return;await sleep(150);}throw new Error('Timeout '+label);};
 await page.goto('http://127.0.0.1:3001/',{waitUntil:'load'});await page.waitForSelector('#app canvas');await sleep(1800);
 assert.equal(await page.evaluate(()=>!!window.__gallery||[...document.querySelectorAll('div')].some(d=>d.style.zIndex==='2147483000')),false);
 for(let i=0;i<3;i++){await page.keyboard.press('ArrowRight');await sleep(160);}await page.keyboard.press('Enter');await until(()=>code,'room');assert.equal(state.playerCount,5);
 const phone=await addPhone(browser,code,'Niko',0);phone.page.on('pageerror',e=>report.errors.push('phone '+e));
 await until(()=>state.players.length===1&&state.players[0].ready,'ready');
 for(let i=0;i<13;i++){await page.keyboard.press('ArrowRight');await sleep(150);}await until(()=>state.selectedMinigameId==='minigolf','golf selected');report.start=Date.now()-t0;await page.keyboard.press('Enter');await until(()=>state.phase==='MINIGAME_PLAYING','playing');report.playing=Date.now()-t0;
 assert.equal(state.players.length,5);assert.equal(state.players.filter(p=>p.bot).length,4);report.players=state.players.map(p=>({name:p.displayName,char:p.characterId,bot:p.bot}));
 const phoneCDP=await phone.page.createCDPSession();
 await phone.page.waitForSelector('#golf-shoot');await until(()=>phone.page.evaluate(()=>!document.querySelector('#golf-shoot').disabled),'tee ready');
 await until(()=>report.models.filter(r=>r.status===200).length>=4,'four original models');
 await page.screenshot({path:`${out}/production-five.png`});await phone.page.screenshot({path:`${out}/production-phone.png`});
 let shots=0;const gameStart=Date.now();
 while(Date.now()-gameStart<220000&&!state.lastResults){
  const ready=await phone.page.evaluate(()=>{const b=document.querySelector('#golf-shoot');return b&&!b.disabled;});
  if(ready){const r=await phone.page.$eval('#golf-shoot',b=>{const r=b.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};});await phoneCDP.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:r.x,y:r.y,id:1}]});await sleep(280);await phoneCDP.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});shots++;}
  await sleep(400);
 }
 assert.ok(state.lastResults,'natural result');assert.equal(state.lastResults.results.length,5);assert.deepEqual(state.lastResults.results.map(r=>r.placement).sort(),[1,2,3,4,5]);assert.ok(state.lastResults.results.every(r=>r.stats.length===3));
 report.wallSeconds=(Date.now()-gameStart)/1000;report.phoneShots=shots;report.results=state.lastResults;await until(()=>state.phase==='ROUND_RESULTS','result screen',15000);await sleep(6000);await page.screenshot({path:`${out}/production-results.png`});
 assert.ok(report.chunks.length);assert.ok(report.chunks[0].ms>=report.start&&report.chunks[0].ms<report.playing-5000,'preload during roulette/intro');assert.deepEqual(report.errors,[]);
 console.log('PASS production: UI selection #13, 1 real phone + 4 bots, original GLBs, 3 holes at real clock speed, natural ranking, no page errors');
}finally{writeFileSync(`${out}/production.json`,JSON.stringify(report,null,2));await browser.close();}
