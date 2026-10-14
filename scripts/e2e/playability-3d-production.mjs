import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
process.env.CTRL_URL='http://localhost:3005/controller.html';
const {launch,addPhone,sleep}=await import('./lib.mjs');
const browser=await launch(),errors=[],games=[],modelRequests=[],out='docs/agent-work/playability-performance';
const until=async(fn,label,ms=90000)=>{const t=Date.now();while(Date.now()-t<ms){if(await fn())return;await sleep(100);}throw Error('Timeout '+label);};
async function capture(page){const c=await page.target().createCDPSession();await c.send('Network.enable');const data={room:null,status:null};c.on('Network.webSocketFrameReceived',({response})=>{if(!response.payloadData.startsWith('42'))return;try{const [e,p]=JSON.parse(response.payloadData.slice(2));if(e==='room:state')data.room=p;if(e==='controller:signal'&&['backroomsStatus','minigolfStatus'].includes(p.type))data.status=p;}catch{}});page.on('pageerror',e=>errors.push(e.message));return data;}
try{
 for(const [id,arrows] of [['backrooms',15],['minigolf',13]]){
  const host=await browser.newPage(),wire=await capture(host),models=[];host.on('dialog',d=>d.accept());host.on('response',r=>{if(/\.glb(?:\?|$)/.test(r.url())){const record={id,url:r.url(),status:r.status(),cached:r.fromCache()};models.push(record);modelRequests.push(record);}});
  await host.goto('http://localhost:3005/',{waitUntil:'load'});await host.waitForSelector('canvas');await sleep(1100);for(let i=0;i<3;i++){await host.keyboard.press('ArrowRight');await sleep(150);}await host.keyboard.press('Enter');await until(()=>wire.room?.roomCode,'stanza');
  const p=await addPhone(browser,wire.room.roomCode,'TEST GOBLIN',0),phone=await capture(p.page);for(let i=0;i<arrows;i++){await host.keyboard.press('ArrowRight');await sleep(120);}await until(()=>wire.room.selectedMinigameId===id,'selezione');await host.keyboard.press('Enter');await until(()=>wire.room.phase==='MINIGAME_PLAYING','avvio');
  await until(()=>phone.status?.available,'comandi disponibili');await until(()=>models.filter(m=>m.status===200||m.status===304).length>=4,'modelli originali');assert.equal(wire.room.players.length,5);
  if(id==='backrooms'){
   const c=await p.page.target().createCDPSession(),point=await p.page.$eval('#back-move',e=>{const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};});
   await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...point,id:1}]});await c.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:point.x+35,y:point.y,id:1}]});await sleep(650);await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   assert.equal(await host.$eval('#backrooms-hud',e=>e.querySelectorAll('.back-view').length),5);
  }else{
   await until(()=>phone.status.ready&&p.page.$eval('#golf-shoot',e=>!e.disabled),'tiro umano');const before=phone.status.strokes,c=await p.page.target().createCDPSession(),point=await p.page.$eval('#golf-shoot',e=>{const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};});
   await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...point,id:1}]});await sleep(450);await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await until(()=>phone.status.strokes>before,'tiro reale');
  }
  await host.screenshot({path:`${out}/${id}-production.png`});await host.keyboard.press('Escape');await until(()=>wire.room.paused,'pausa');
  await host.$$eval('button',buttons=>{const b=buttons.find(b=>b.textContent.includes('TORNA ALLA LOBBY'));b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));});
  await until(()=>wire.room.phase==='LOBBY','lobby',20000);await sleep(200);assert.equal(await host.evaluate(()=>document.querySelectorAll('canvas').length),1);assert.equal(await host.$('#backrooms-hud'),null);
  games.push({id,compiled:true,players:5,humans:1,bots:4,originalModels:models.filter(m=>m.status===200||m.status===304).length,phoneInput:true,pause:true,lobbyCleanup:true});console.log('PRODUZIONE '+id+': cinque giocatori, modelli originali, input telefono e cleanup OK');await host.evaluate(()=>localStorage.removeItem('ricchioni.hostToken'));await host.close();await p.ctx.close();
 }
 assert.deepEqual(errors,[]);
}finally{writeFileSync(`${out}/3d-production.json`,JSON.stringify({games,modelRequests,errors},null,2));await browser.close();}
