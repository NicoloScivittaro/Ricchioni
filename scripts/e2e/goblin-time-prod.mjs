import assert from 'node:assert/strict';
import { mkdirSync,writeFileSync } from 'node:fs';
process.env.CTRL_URL=process.env.CTRL_URL??'http://localhost:3002/controller.html';
const {launch,addPhone,sleep}=await import('./lib.mjs');
const base=process.env.PROD_HOST??'http://localhost:3002/';
const out='docs/agent-work/goblin-time/production';mkdirSync(out,{recursive:true});const browser=await launch();const reports=[],errors=[];
const until=async(fn,label,ms=40000)=>{const start=Date.now();while(Date.now()-start<ms){if(await fn())return;await sleep(100);}throw Error(`Timeout ${label}`);};
async function listen(page){const cdp=await page.target().createCDPSession();await cdp.send('Network.enable');const state={room:null,pub:null,priv:null};cdp.on('Network.webSocketFrameReceived',({response})=>{if(!response.payloadData.startsWith('42'))return;try{const [event,data]=JSON.parse(response.payloadData.slice(2));if(event==='room:state')state.room=data;if(event==='goblin:public')state.pub=data;if(event==='private:data'&&data?.type==='goblinPrivate')state.priv=data;}catch{}});page.on('pageerror',e=>errors.push(e.message));return state;}
async function play(page,s){await page.evaluate(s=>{
  const click=q=>{const b=document.querySelector(q);if(b&&!b.disabled)b.click();};
  if(s.choice){for(const id of s.choice.options.slice(0,s.choice.min).map(o=>o.id)){const b=[...document.querySelectorAll('[data-option]')].find(e=>e.dataset.option===id);if(b&&!b.disabled&&!b.classList.contains('chosen'))b.click();}click('[data-op=choose]');}
  else if(s.canDeclare)click('[data-op=declare]');else if(s.canDraw)click('[data-op=draw]');
  else {const id=s.playable[0]??s.armable[0];if(!id)return;const card=[...document.querySelectorAll('[data-card]')].find(e=>e.dataset.card===id);if(card&&!card.classList.contains('selected'))card.click();click(s.playable.includes(id)?'[data-op=play]':'[data-op=arm]');}
},s);}
try{
 for(const {n,h,mode}of [{n:2,h:2,mode:'base'},{n:5,h:1,mode:'personal'}]){
  const host=await browser.newPage();await host.setViewport({width:1280,height:720});const messages=await listen(host);await host.goto(base,{waitUntil:'load'});await host.waitForSelector('canvas');await sleep(1200);
  for(let i=2;i<n;i++){await host.keyboard.press('ArrowRight');await sleep(150);}await host.keyboard.press('Enter');await until(()=>!!messages.room?.roomCode,'creazione stanza');const code=messages.room.roomCode;
  const phones=[];for(let i=0;i<h;i++){const p=await addPhone(browser,code,`PROD ${i+1}`,i);await p.page.evaluate(()=>Object.defineProperty(crypto,'randomUUID',{value:undefined,configurable:true}));phones.push({page:p.page,wire:await listen(p.page)});}
  for(let i=0;i<16;i++){await host.keyboard.press('ArrowRight');await sleep(120);}await until(()=>messages.room.selectedMinigameId==='goblinTime','selezione gioco');await host.keyboard.press('Enter');await until(()=>messages.room.phase==='MINIGAME_PLAYING','avvio scena');await sleep(700);
  await host.mouse.click(mode==='base'?390:890,420);await until(()=>!!messages.pub,'motore compilato',60000);await until(()=>phones.every(p=>p.wire.priv?.hand.length===2),'mani private');assert.equal(messages.priv,null);assert.equal(messages.pub.players.length,n);
  await until(()=>host.evaluate(()=>!!document.getElementById('goblin-avatars')),'modelli 3D');await sleep(1200);
  const performanceData=await host.evaluate(async()=>{const stamps=[];const start=performance.now();await new Promise(resolve=>{const frame=t=>{stamps.push(t);if(t-start<3000)requestAnimationFrame(frame);else resolve();};requestAnimationFrame(frame);});const times=stamps.slice(1).map((t,i)=>t-stamps[i]).sort((a,b)=>a-b);const canvas=document.getElementById('goblin-avatars'),gl=canvas.getContext('webgl2')??canvas.getContext('webgl'),ext=gl?.getExtension('WEBGL_debug_renderer_info');return{fps:+((stamps.length-1)*1000/(stamps.at(-1)-stamps[0])).toFixed(1),p95FrameMs:+times[Math.floor(times.length*.95)].toFixed(2),renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unknown',width:canvas.width,height:canvas.height};});
  await host.screenshot({path:`${out}/${n}p-tv.png`});await phones[0].page.screenshot({path:`${out}/${n}p-phone.png`,fullPage:true});
  const started=Date.now();while(messages.pub?.phase!=='finished'&&Date.now()-started<450000){for(const p of phones)if(p.wire.priv)await play(p.page,p.wire.priv);await sleep(140);}
  assert.equal(messages.pub.phase,'finished');assert.equal(messages.pub.results.length,n);assert.equal(messages.priv,null);await host.screenshot({path:`${out}/${n}p-finish.png`});
  await until(()=>messages.room.phase!=='MINIGAME_PLAYING','punteggi');assert.ok(messages.room.players.some(p=>p.score>0));assert.equal(await host.evaluate(()=>document.querySelectorAll('#goblin-avatars').length),0);assert.equal(await phones[0].page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  reports.push({players:n,humans:h,bots:n-h,mode,compiled:true,privacy:true,results:true,disposed:true,performance:performanceData,endReason:messages.pub.endReason,turns:messages.pub.turnNumber});console.log(`PROD ${n}p ${mode}: partita conclusa, ${performanceData.fps} FPS, p95 ${performanceData.p95FrameMs} ms`);
  await host.evaluate(()=>localStorage.clear());for(const p of phones)await p.page.close();await host.close();
  writeFileSync(`${out}/results.json`,JSON.stringify({reports,errors},null,2));
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
