import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
process.env.CTRL_URL='http://localhost:3008/controller.html';
const {launch,addPhone,sleep}=await import('./lib.mjs');
const browser=await launch(),report={errors:[],models:[],compiled:true};let state,started=false;
const until=async(fn,label,ms=75000)=>{const t=Date.now();while(!await fn()){if(Date.now()-t>ms)throw Error('Timeout '+label);await sleep(100);}};
async function observe(page){
 page.on('pageerror',e=>report.errors.push(e.message));const c=await page.createCDPSession();await c.send('Network.enable');
 c.on('Network.webSocketFrameReceived',({response})=>{if(!response.payloadData.startsWith('42'))return;try{const [event,data]=JSON.parse(response.payloadData.slice(2));if(event==='room:state')state=data;if(event==='minigame:selected')report.pick=data;if(event==='private:data'&&(data.type==='info'||data.data?.type==='info'))started=true;}catch{}});
}
try{
 const page=await browser.newPage();page.on('dialog',dialog=>dialog.accept());await observe(page);page.on('response',r=>{if(/\.glb(?:\?|$)/.test(r.url()))report.models.push(r.url());});
 await page.goto('http://localhost:3008/',{waitUntil:'load'});await page.waitForSelector('canvas');await sleep(1000);
 for(let i=0;i<3;i++){await page.keyboard.press('ArrowRight');await sleep(160);}await page.keyboard.press('Enter');await until(()=>state?.roomCode,'room');
 assert.equal(report.models.length,0,'Sydney model remains lazy in the lobby');
 const phone=await addPhone(browser,state.roomCode,'SYDNEY BUILD',0);await observe(phone.page);await until(()=>state.players[0]?.ready,'ready');
 await page.keyboard.press('ArrowLeft');await until(()=>state.selectedMinigameId==='kart3d'&&state.selectedKartTrackId==='sydney','Sydney in compiled lobby');
 await page.keyboard.press('Enter');await until(()=>state.phase==='MINIGAME_ROULETTE','roulette');await sleep(200);await page.keyboard.press('Enter');await until(()=>state.phase==='MINIGAME_MAP_VOTE','vote');
 assert.deepEqual(state.mapVote.options.map(m=>m.id),['litorale','arcobaleno','sydney']);await phone.page.waitForSelector('[data-map-id="sydney"]');await phone.page.click('[data-map-id="sydney"]');await phone.page.waitForSelector('[data-map-id="sydney"][aria-pressed="true"]');
 await until(()=>state.phase==='MINIGAME_PLAYING'&&started,'compiled Sydney starts');await until(()=>report.models.some(url=>url.endsWith('/sydney_sprint.glb')),'Sydney asset fetched');await sleep(1500);
 assert.equal(report.pick.kartTrackId,'sydney');assert.equal(report.pick.mapId,'sydney');assert.ok(!report.models.some(url=>url.endsWith('/gba_rainbow_road.glb')));
 report.map='sydney';report.players=state.players.length;report.botCount=state.players.filter(p=>p.bot).length;report.lazyLoading=true;
 await page.keyboard.press('Escape');await until(()=>state.paused,'pause');
 await page.$$eval('button',bs=>bs.find(b=>b.textContent.includes('TORNA ALLA LOBBY')).dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})));
 await until(()=>state.phase==='LOBBY','cleanup');await sleep(200);assert.equal(await page.evaluate(()=>document.querySelectorAll('canvas').length),1);report.cleanup=true;
 assert.deepEqual(report.errors,[]);await phone.ctx.close();console.log('PASS compiled Sydney: selection, vote, lazy GLB, gameplay, pause and cleanup');
}finally{writeFileSync('docs/agent-work/sydney-sprint/production-checks.json',JSON.stringify(report,null,2));await browser.close();}
