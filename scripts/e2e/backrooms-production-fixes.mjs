import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
process.env.CTRL_URL='http://127.0.0.1:3001/controller.html';
const {launch,addPhone,sleep}=await import('./lib.mjs');
const browser=await launch(),out='docs/agent-work/backrooms-fixes',report={errors:[],models:[],phases:[],chunks:[],phoneStates:[],webglErrors:[]};
try{
 const page=await browser.newPage();let state=null,code=null;const t0=Date.now();page.on('pageerror',e=>report.errors.push(String(e)));
 page.on('console',m=>{if((m.type()==='error'||m.type()==='warn')&&/WebGL|GL_INVALID|shader|context.*lost/i.test(m.text()))report.webglErrors.push(m.text());});
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
 await page.screenshot({path:`${out}/production-five.png`});await phone.page.screenshot({path:`${out}/production-phone.png`});await sleep(5000);
 assert.equal(await page.$('#backrooms-debug'),null);report.devOverlayAbsent=true;
 const panels=await page.evaluate(()=>({views:document.querySelectorAll('.back-view').length,canvases:document.querySelectorAll('canvas').length}));assert.equal(panels.views,5);assert.equal(panels.canvases,2);report.panels=panels;
 await page.keyboard.press('Escape');await sleep(400);assert.ok(await phone.page.$('#pause-overlay'));await page.keyboard.press('Escape');await sleep(500);
 await page.screenshot({path:`${out}/production-five.png`});
 assert.ok(report.chunks.length);assert.ok(report.chunks[0].ms>=report.start&&report.chunks[0].ms<report.playing);assert.deepEqual(report.errors,[]);assert.deepEqual(report.webglErrors,[]);
 console.log('PASS compiled production smoke: real menu/lazy chunk/4 Tripo/5 cameras/phone/no DEV overlay/pause/no errors. Full 2–5 round completion covered separately in native source rooms.');
}finally{writeFileSync(`${out}/production.json`,JSON.stringify(report,null,2));await browser.close();}
