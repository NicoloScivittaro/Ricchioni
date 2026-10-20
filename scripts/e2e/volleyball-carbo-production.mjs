import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
const base=process.env.PROD_URL??'http://localhost:3004';process.env.CTRL_URL=base+'/controller.html';
const {launch,addPhone,sleep}=await import('./lib.mjs');
const browser=await launch(),errors=[],games=[],out='docs/agent-work/volleyball-casacarbo';
const until=async(fn,label,ms=90000)=>{const t=Date.now();while(Date.now()-t<ms){if(await fn())return;await sleep(100);}throw Error('Timeout '+label);};
async function capture(page){const c=await page.createCDPSession();await c.send('Network.enable');const data={room:null,status:null,minEnergy:100,maxDiveCooldown:0,points:0};c.on('Network.webSocketFrameReceived',({response})=>{if(!response.payloadData.startsWith('42'))return;try{const [e,p]=JSON.parse(response.payloadData.slice(2));if(e==='room:state')data.room=p;if(e==='controller:signal'){if(['defense','carboRace'].includes(p.type))data.status=p;if(p.type==='defense'){data.minEnergy=Math.min(data.minEnergy,p.value);data.maxDiveCooldown=Math.max(data.maxDiveCooldown,p.cooldown);}if(p.type==='point')data.points++;}}catch{}});page.on('pageerror',e=>errors.push(e.message));return data;}
const touch=async(page,selector,ms=80)=>{const c=await page.createCDPSession(),point=await page.$eval(selector,e=>{const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};});await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...point,id:1}]});await sleep(ms);await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await c.detach();};
try{
 for(const [id,arrows] of [['volleyball',7]]){
  const host=await browser.newPage(),wire=await capture(host);host.on('dialog',d=>d.accept());
  await host.goto(base+'/',{waitUntil:'load'});await host.waitForSelector('canvas');await sleep(1200);
  for(let i=0;i<3;i++){await host.keyboard.press('ArrowRight');await sleep(150);}await host.keyboard.press('Enter');await until(()=>wire.room?.roomCode,'room');
  const phone=await addPhone(browser,wire.room.roomCode,'SOL PROD',0),pwire=await capture(phone.page);
  for(let i=0;i<arrows;i++){await host.keyboard.press('ArrowRight');await sleep(150);}await until(()=>wire.room.selectedMinigameId===id,'selection');await host.keyboard.press('Enter');await until(()=>wire.room.phase==='MINIGAME_PLAYING','start');
  assert.equal(wire.room.players.length,5);assert.equal(wire.room.players.filter(p=>p.bot).length,4);
  await until(()=>pwire.status?.type===(id==='volleyball'?'defense':'carboRace'),'live new feature');
  if(id==='volleyball'){
   await phone.page.waitForSelector('#volley-dive');await touch(phone.page,'#volley-hit');
   const c=await phone.page.createCDPSession(),joy=await phone.page.$eval('.arena-joy-base',e=>{const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};}),sprint=await phone.page.$eval('#volley-sprint',e=>{const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};});
   for(let i=0;i<3&&pwire.minEnergy===100;i++){
    await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...joy,id:1},{...sprint,id:2}]});
    await c.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:joy.x+35,y:joy.y,id:1},{...sprint,id:2}]});await sleep(650);await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await touch(phone.page,'#volley-hit');await sleep(400);
   }await c.detach();await until(()=>pwire.minEnergy<100,'real sprint');
   for(let i=0;i<5&&pwire.maxDiveCooldown===0;i++){await touch(phone.page,'#volley-dive');await sleep(500);}assert.ok(pwire.maxDiveCooldown>0,'real dive');
   await until(()=>pwire.points>0,'natural rally point',45000);
  }else{
   await until(()=>pwire.status.name&&pwire.status.cooldown>0,'natural race');
   await touch(phone.page,'.ctl-bucket',350);assert.ok(await phone.page.$('#carbo-race'),'race phone UI');
  }
  const fps=await host.evaluate(async()=>{const a=[],start=performance.now();await new Promise(r=>{const f=t=>{a.push(t);if(t-start<5000)requestAnimationFrame(f);else r();};requestAnimationFrame(f);});return(a.length-1)*1000/(a.at(-1)-a[0]);});
  await host.screenshot({path:`${out}/${id}-production.png`});await host.keyboard.press('Escape');await until(()=>wire.room.paused,'pause');
  await host.$$eval('button',buttons=>buttons.find(b=>b.textContent.includes('TORNA ALLA LOBBY')).dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})));
  await until(()=>wire.room.phase==='LOBBY','lobby',20000);await sleep(300);assert.equal(await host.evaluate(()=>document.querySelectorAll('canvas').length),1);
  games.push({id,compiled:true,players:5,humans:1,bots:4,phoneInput:true,featureStatus:pwire.status,minSprintEnergy:pwire.minEnergy,maxDiveCooldown:pwire.maxDiveCooldown,naturalPoints:pwire.points,fps,pause:true,cleanup:true});console.log('PASS PRODUCTION '+id+' '+JSON.stringify(games.at(-1)));
  await host.evaluate(()=>localStorage.removeItem('ricchioni.hostToken'));await host.close();await phone.ctx.close();
 }assert.deepEqual(errors,[]);
}finally{writeFileSync(`${out}/production-checks.json`,JSON.stringify({games,errors},null,2));await browser.close();}
