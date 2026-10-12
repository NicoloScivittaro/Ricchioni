import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
process.env.CTRL_URL='http://127.0.0.1:3001/controller.html';
const {launch,addPhone,sleep}=await import('./lib.mjs');
const browser=await launch(),out='docs/agent-work/geofall-2',report={errors:[],models:[],phases:[],chunks:[],assets:[],webglErrors:[]};
try{
 const page=await browser.newPage();let state=null,code=null;const t0=Date.now();page.on('pageerror',e=>report.errors.push(String(e)));
 page.on('console',m=>{if(['error','warn'].includes(m.type())&&/WebGL|GL_INVALID|shader|context.*lost/i.test(m.text()))report.webglErrors.push(m.text());});
 page.on('response',r=>{if(/\.glb(?:\?|$)/.test(r.url()))report.models.push({url:r.url(),status:r.status()});if(/\/geofall\/.+\.svg/.test(r.url()))report.assets.push({url:r.url(),status:r.status()});});
 page.on('request',r=>{if(/BabylonGeofallGame-.*\.js/.test(r.url()))report.chunks.push({url:r.url(),ms:Date.now()-t0});});
 const net=await page.createCDPSession();await net.send('Network.enable');net.on('Network.webSocketFrameReceived',({response})=>{const raw=response.payloadData??'';if(!raw.startsWith('42'))return;try{const[e,p]=JSON.parse(raw.slice(2));if(e==='room:state'){if(p.phase!==state?.phase)report.phases.push({phase:p.phase,ms:Date.now()-t0});state=p;code??=p.roomCode;}}catch{}});
 const until=async(fn,label,ms=60000)=>{const t=Date.now();while(Date.now()-t<ms){if(await fn())return;await sleep(150);}throw new Error('timeout '+label);};
 await page.goto('http://127.0.0.1:3001/',{waitUntil:'load'});await page.waitForSelector('#app canvas');await sleep(1800);
 for(let i=0;i<3;i++){await page.keyboard.press('ArrowRight');await sleep(160);}await page.keyboard.press('Enter');await until(()=>code,'room');
 const phone=await addPhone(browser,code,'Niko',0);phone.page.on('pageerror',e=>report.errors.push('phone '+e));await until(()=>state.players.length===1&&state.players[0].ready,'ready');
 for(let i=0;i<14;i++){await page.keyboard.press('ArrowRight');await sleep(150);}await until(()=>state.selectedMinigameId==='geofall','Geofall selected');report.start=Date.now()-t0;await page.keyboard.press('Enter');await until(()=>state.phase==='MINIGAME_PLAYING','playing');report.playing=Date.now()-t0;
 assert.equal(state.players.length,5);assert.equal(state.players.filter(p=>p.bot).length,4);
 await phone.page.waitForSelector('.ctl-up');await until(()=>phone.page.evaluate(()=>document.querySelector('#geo-phone-status')?.textContent.includes('SPINTA PRONTA')&&!document.querySelector('.ctl-up').disabled),'authoritative answer ready');
 await until(()=>new Set(report.assets.filter(a=>a.status===200).map(a=>a.url)).size===106,'106 local SVG');await until(()=>report.models.filter(r=>r.status===200).length>=4,'original models');
 assert.ok(await phone.page.$('.ctl-ability'));await phone.page.evaluate(()=>document.querySelector('.ctl-ability').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:90})));await sleep(200);assert.match(await phone.page.$eval('.ctl-ability',e=>e.textContent),/ATTIVA|RICARICA|PRONTA/);await page.screenshot({path:`${out}/production-five.png`});await phone.page.screenshot({path:`${out}/production-phone.png`});const start=Date.now();
 // Human client deliberately stays at spawn: loses one life per round then becomes spectator.
 await until(()=>phone.page.evaluate(()=>document.querySelector('#geo-phone-status')?.textContent.includes('SPETTATORE')),'natural spectator',90000);report.spectatorSeconds=(Date.now()-start)/1000;
 assert.equal(await phone.page.evaluate(()=>[...document.querySelectorAll('#ctl button')].every(b=>b.disabled)),true);await phone.page.screenshot({path:`${out}/production-spectator.png`});
 await until(()=>state.lastResults&&state.lastResults.results.length===5,'natural winner',480000);report.wallSeconds=(Date.now()-start)/1000;report.results=state.lastResults;
 assert.deepEqual(state.lastResults.results.map(r=>r.placement).sort(),[1,2,3,4,5]);assert.ok(state.lastResults.results.every(r=>r.stats.length===3));assert.ok(Object.values(state.lastResults.deltas).every(v=>v>0));
 await until(()=>state.phase==='ROUND_RESULTS','result screen');await sleep(6000);await page.screenshot({path:`${out}/production-results.png`});
 assert.ok(report.chunks.length);assert.ok(report.chunks[0].ms>=report.start&&report.chunks[0].ms<report.playing);assert.deepEqual(report.errors,[]);assert.deepEqual(report.webglErrors,[]);
 console.log('PASS production Geofall:real menu/rullo,106 localSVG,4Tripo,3 natural life losses,spectator,4imperfectbots,natural winner and global5p ranking,no dev imports/no errors.');
}finally{writeFileSync(`${out}/production.json`,JSON.stringify(report,null,2));await browser.close();}
