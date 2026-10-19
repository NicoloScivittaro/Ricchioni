import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
const base='http://localhost:3008';process.env.CTRL_URL=base+'/controller.html';
const {launch,addPhone,sleep}=await import('./lib.mjs');
const browser=await launch(),report={errors:[],scripts:[],models:[],compiled:true};let state,started=false;
const until=async(fn,label,ms=90000)=>{const t=Date.now();while(Date.now()-t<ms){if(await fn())return;await sleep(100);}throw Error('Timeout '+label);};
async function observe(p){p.on('pageerror',e=>report.errors.push(e.message));p.on('console',m=>{if(m.type()==='error'&&/TypeError|ReferenceError|\[minigioco\]/.test(m.text()))report.errors.push(m.text());});const c=await p.createCDPSession();await c.send('Network.enable');c.on('Network.webSocketFrameReceived',({response})=>{if(!response.payloadData.startsWith('42'))return;try{const [event,data]=JSON.parse(response.payloadData.slice(2));if(event==='room:state')state=data;if(event==='private:data'&&(data.type==='info'||data.data?.type==='info'))started=true;}catch{}});}
try{
 const host=await browser.newPage();host.on('dialog',d=>d.accept());await observe(host);host.on('response',r=>{if(/\/assets\/.*\.js/.test(r.url()))report.scripts.push(r.url());if(/\.glb/.test(r.url())&&[200,304].includes(r.status()))report.models.push(r.url());});
 await host.goto(base+'/',{waitUntil:'load'});await host.waitForSelector('canvas');await sleep(1200);for(let i=0;i<3;i++){await host.keyboard.press('ArrowRight');await sleep(160);}await host.keyboard.press('Enter');await until(()=>state?.roomCode,'room');
 const phone=await addPhone(browser,state.roomCode,'RIB PROD',0);await observe(phone.page);await until(()=>state.players[0]?.ready,'ready');await host.keyboard.press('ArrowLeft');await sleep(200);await until(()=>state.selectedMinigameId==='kart3d'&&state.selectedKartTrackId==='arcobaleno','kart selection');await host.keyboard.press('Enter');await until(()=>state.phase==='MINIGAME_PLAYING','playing');
 assert.equal(state.players.length,5);assert.equal(state.players.filter(p=>p.bot).length,4);assert.equal(state.currentMinigame.durationSec,230);await until(()=>started,'VIA private info');
 const c=await phone.page.createCDPSession(),point=await phone.page.$eval('.ctl-up',e=>{const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};});
 await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...point,id:1}]});await sleep(900);await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await c.detach();await sleep(18000);
 await host.screenshot({path:'docs/agent-work/rainbow-glide/compiled-preview.png'});assert.ok(report.scripts.length>5);assert.ok(report.models.some(url=>url.endsWith('/assets/tracks/gba_rainbow_road.glb')),'compiled GLB loaded');
 await host.keyboard.press('Escape');await until(()=>state.paused,'pause');await host.$$eval('button',buttons=>buttons.find(b=>b.textContent.includes('TORNA ALLA LOBBY')).dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})));
 await until(()=>state.phase==='LOBBY','lobby',20000);await sleep(200);assert.equal(await host.evaluate(()=>document.querySelectorAll('canvas').length),1);assert.deepEqual(report.errors,[]);
 report.players=5;report.humans=1;report.bots=4;report.liveSeconds=18;report.touchInput=true;report.pause=true;report.cleanup=true;console.log('PASS compiled Rainbow: 1 touch phone + 4 bots, new 230s cap, live track, pause, lobby cleanup, no errors.');
}finally{writeFileSync('docs/agent-work/rainbow-glide/production-checks.json',JSON.stringify(report,null,2));await browser.close();}
