import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
process.env.CTRL_URL=process.env.PROD_CTRL??'http://127.0.0.1:3001/controller.html';
const {launch,addPhone,sleep}=await import('./lib.mjs');
const browser=await launch(),report={errors:[],models:[],responses:[]};
try {
 const page=await browser.newPage();let state=null,code=null;
 page.on('pageerror',e=>report.errors.push(`host: ${e}`));
 page.on('request',r=>{if(/\.glb(?:\?|$)/.test(r.url()))report.models.push(r.url());});
 page.on('response',r=>{if(/\.glb(?:\?|$)/.test(r.url()))report.responses.push({url:r.url(),status:r.status()});});
 const cdp=await page.createCDPSession();await cdp.send('Network.enable');
 cdp.on('Network.webSocketFrameReceived',({response})=>{
  const raw=response.payloadData??'';if(!raw.startsWith('42'))return;
  try{const [event,payload]=JSON.parse(raw.slice(2));if(event==='room:state'){state=payload;code??=payload.roomCode;}}catch{}
 });
 const until=async(fn,label,ms=60000)=>{const t=Date.now();while(Date.now()-t<ms){if(await fn())return;await sleep(120);}throw new Error(`Timeout ${label}`);};
 await page.goto(process.env.PROD_HOST??'http://127.0.0.1:3001/',{waitUntil:'load'});await page.waitForSelector('#app canvas');await sleep(2000);
 await page.keyboard.press('Enter');await until(()=>code,'room');assert.equal(state.playerCount,2);
 const phone=await addPhone(browser,code,'Solo Niko',0);phone.page.on('pageerror',e=>report.errors.push(`phone: ${e}`));
 await until(()=>state.players.length===1&&state.players[0].ready,'one real player ready');await sleep(350);
 await page.screenshot({path:'docs/agent-work/solo-bots/production-solo-lobby.png'});
 for(let i=0;i<4;i++){await page.keyboard.press('ArrowRight');await sleep(180);}
 await until(()=>state.selectedMinigameId==='arena','Arena selected');await page.keyboard.press('Enter');
 await until(()=>state.phase==='MINIGAME_PLAYING','solo starts');
 assert.equal(state.players.length,2);assert.equal(state.players.filter(p=>p.bot).length,1);
 report.players=state.players;report.room=code;
 await until(()=>report.responses.filter(r=>r.status===200).length>=2,'original Tripo models');
 assert.ok(report.responses.some(r=>r.url.includes('/models/goblin-tripo/')&&r.status===200));
 assert.ok(report.responses.some(r=>r.url.includes('/models/detailed-tripo/')&&r.status===200));
 await sleep(6000);await page.screenshot({path:'docs/agent-work/solo-bots/production-solo-arena.png'});
 await until(()=>state.lastResults&&state.phase!=='MINIGAME_PLAYING','natural result',100000);
 assert.equal(state.lastResults.results.length,2);report.results=state.lastResults;
 assert.equal(report.errors.length,0,report.errors.join('\n'));
 console.log('PASS packaged production: normal UI, one phone + one bot, original Tripo models, natural Arena results');
 writeFileSync('docs/agent-work/solo-bots/production.json',JSON.stringify(report,null,2));
}finally{await browser.close();}
