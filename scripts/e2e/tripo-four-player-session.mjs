import {visualCounters} from './tripo-counters.mjs';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { launch, createRoomOnHost, addPhone, hostEval, hostSnapshot, phoneView, sleep, HOST_URL, CTRL_URL } from './lib.mjs';

const out='docs/agent-work/general-polish';
mkdirSync(out,{recursive:true});
const browser=await launch(), report={rooms:[],games:[],errors:[]};
const until=async(fn,what,ms=60000)=>{
 const start=Date.now();
 while(Date.now()-start<ms){const value=await fn();if(value)return value;await sleep(120);}
 throw new Error(`Timeout ${what}`);
};
try {
 const {page}=await createRoomOnHost(browser,{targetKeyPresses:2});
 page.on('pageerror',e=>report.errors.push(`host: ${e}`));
 await page.evaluate(()=>{window.__morning='host';for(const id of ['goblin','buttafuori','judoka','ciro'])sessionStorage.setItem(`ricchioni.${id}Visual`,'old');});
 // A new room after abandoning the previous one must work without reloading the host.
 for(let i=0;i<2;i++){
  report.rooms.push(await hostEval(page,gm=>gm.roomCode));
  await page.keyboard.press('Escape');
  await until(async()=>(await hostSnapshot(page)).active.includes('LobbyScene'),'return to lobby');
  await sleep(180);
  if(i===1){await page.keyboard.press('ArrowRight');await sleep(160);await page.keyboard.press('ArrowRight');for(let k=0;k<2;k++){await sleep(160);await page.keyboard.press('ArrowDown');}}
  await page.keyboard.press('Enter');
  await until(async()=>(await hostSnapshot(page)).active.includes('RoomScene'),'create next room',8000);
 }
 const code=await hostEval(page,gm=>gm.roomCode);report.rooms.push(code);
 assert.equal(new Set(report.rooms).size,3);
 console.log('Three rooms created/abandoned on the same host document: PASS');
 if(process.env.RECREATE_ONLY==='1')process.exitCode=0;
 else {
  report.qr=await hostEval(page,async gm=>gm.game.scene.getScene('RoomScene').controllerUrl(gm.roomCode));
  assert.equal(new URL(report.qr).port,new URL(HOST_URL).port);
  assert.ok(!['localhost','127.0.0.1','[::1]'].includes(new URL(report.qr).hostname),'QR uses LAN address');
  const phones=[];
  for(const [name,index] of [['Nicolò',0],['BOSCHI',1],['Carbo',3],['Ciro',4]]){
   const p=await addPhone(browser,code,name,index);
   p.page.on('pageerror',e=>report.errors.push(`${name}: ${e}`));
   await p.page.evaluate(async()=>{window.__morning='phone';const main=performance.getEntriesByType('resource').map(e=>e.name).find(n=>/\/controller\/main\.ts(?:\?|$)/.test(n));const source=await (await fetch(main??'/src/controller/main.ts')).text();const url=/import\("([^"]*fpsClient\.ts[^"]*)"\)/.exec(source)?.[1];if(!url)throw new Error('FPS client module URL missing');const {FpsClient}=await import(url);const spawn=FpsClient.prototype.spawnRemote;window.__fpsRemotes=[];FpsClient.prototype.spawnRemote=function(ps){const e=spawn.call(this,ps);window.__fpsRemotes.push(e);return e;};});phones.push(p);
  }
  for(const p of phones){
   const labels=await p.page.$$eval('#chars .char',es=>es.map(e=>e.textContent));
   assert.ok(labels.some(s=>s.includes('BOSCHI')));assert.ok(labels.some(s=>s.includes('Carbo')));
  }
  await page.screenshot({path:`${out}/room-four-players.png`});
  const seq=(process.env.SEQ??'arena,cornicione,dodgeball,soccer,volleyball,kart3d,fps,casacarbo,quiz,memory,cultura,reaction').split(',');
  await hostEval(page,(gm,id)=>gm.selectMinigame(id),seq[0]);await sleep(150);await page.keyboard.press('Enter');
  let reconnected=false;
  for(let i=0;i<seq.length;i++){
   const id=seq[i];
   await until(async()=>(await hostSnapshot(page)).phase==='MINIGAME_PLAYING',`playing ${id}`);
   await until(()=>hostEval(page,(gm,id)=>{const s=gm.game.scene.getScene(id);return s?.sys.isActive()&&(!('game3d' in s)||!!s.game3d);},id),`ready ${id}`);
   if(['arena','cornicione','dodgeball','soccer','volleyball','kart3d','casacarbo'].includes(id)){
    await until(()=>hostEval(page,(gm,id)=>{const g=gm.game.scene.getScene(id).game3d;return g&&[...(g.entities??g.avatars).values()].every(e=>(e.goblinDebug?.()??e.goblin?.debug?.())?.state==='ready');},id),`four imported rigs ${id}`);
    const samples=await hostEval(page,(gm,id)=>[...(gm.game.scene.getScene(id).game3d.entities??gm.game.scene.getScene(id).game3d.avatars).values()].map(e=>e.goblinDebug?.()??e.goblin?.debug?.()),id);
    assert.deepEqual(samples.map(s=>s.character).sort(),['buttafuori','ciro','goblin','judoka']);
    assert.ok(samples.every(s=>s.bones===65));assert.equal((await visualCounters(page)).liveInstances,4);
   }
   await sleep(id==='fps'?3500:1600);
   let snap=await hostSnapshot(page);assert.deepEqual(snap.active,[id]);
   for(const p of phones){const v=await phoneView(p.page);assert.ok(!/PROSSIMO|ROUND TERMINATO|Attendi|Riconnessione/.test(v.h1),`${p.name} controller ${id}: ${v.h1}`);}
   if(id==='fps')for(const p of phones){await p.page.waitForFunction(()=>window.__fpsRemotes.length===3&&window.__fpsRemotes.every(e=>e.tripo?.debug().state==='ready'),{timeout:60000});assert.ok(await p.page.evaluate(()=>window.__fpsRemotes.every(e=>e.tripo.debug().bones===65&&!e.body.isVisible&&!e.head.isEnabled())));assert.equal((await visualCounters(p.page)).liveInstances,3);}
   if(id==='arena'){
    await until(()=>hostEval(page,gm=>gm.game.scene.getScene('arena').game3d.phase==='playing'),'arena countdown');
    const p=phones[1],pid=await hostEval(page,gm=>gm.state.players.find(p=>p.displayName==='BOSCHI').id);
    // Move a real joystick; losing focus must release it, and a new gesture must still work.
    await p.page.evaluate(()=>{const el=document.querySelector('.arena-joy-base'),r=el.getBoundingClientRect();el.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:19,clientX:r.x+r.width*.8,clientY:r.y+r.height*.5}));});
    await until(()=>hostEval(page,(gm,pid)=>Math.abs(gm.input.get(pid).axis('move').x)>.1,pid),'joystick input');
    await p.page.evaluate(()=>window.dispatchEvent(new Event('blur')));
    await until(()=>hostEval(page,(gm,pid)=>gm.input.get(pid).axis('move').x===0&&gm.input.get(pid).axis('move').y===0,pid),'blur releases movement',5000);
    await p.page.evaluate(()=>{const el=document.querySelector('.arena-joy-base'),r=el.getBoundingClientRect();el.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:20,clientX:r.x+r.width*.2,clientY:r.y+r.height*.5}));});
    await until(()=>hostEval(page,(gm,pid)=>gm.input.get(pid).axis('move').x<-.1,pid),'new joystick gesture after blur',5000);
    await p.page.evaluate(()=>window.dispatchEvent(new Event('blur')));
    await page.keyboard.press('Escape');await until(()=>hostEval(page,gm=>gm.state.paused),'pause');
    for(const p of phones)assert.equal((await phoneView(p.page)).pause,true);
    const t0=await hostEval(page,gm=>gm.game.scene.getScene('arena').game3d.gameTime);await sleep(900);
    assert.ok(Math.abs((await hostEval(page,gm=>gm.game.scene.getScene('arena').game3d.gameTime))-t0)<.05);
    await page.keyboard.press('Escape');await until(()=>hostEval(page,gm=>!gm.state.paused),'resume');
    const old=phones[2],savedId=await old.page.evaluate(()=>localStorage.getItem('ricchioni.pid'));
    await old.page.close();const np=await old.ctx.newPage();await np.setViewport({width:390,height:800,isMobile:true,hasTouch:true});
    np.on('pageerror',e=>report.errors.push(`Carbo reconnect: ${e}`));await np.goto(`${CTRL_URL}?room=${code}`,{waitUntil:'load'});
    await until(()=>np.evaluate(()=>document.querySelector('.arena-joy-base')),'Carbo reconnect controller');
    assert.equal(await np.evaluate(()=>localStorage.getItem('ricchioni.pid')),savedId);await np.evaluate(async()=>{const main=performance.getEntriesByType('resource').map(e=>e.name).find(n=>/\/controller\/main\.ts(?:\?|$)/.test(n));const source=await (await fetch(main??'/src/controller/main.ts')).text();const url=/import\("([^"]*fpsClient\.ts[^"]*)"\)/.exec(source)?.[1];if(!url)throw new Error('FPS client module URL missing');const {FpsClient}=await import(url);const spawn=FpsClient.prototype.spawnRemote;window.__fpsRemotes=[];FpsClient.prototype.spawnRemote=function(ps){const e=spawn.call(this,ps);window.__fpsRemotes.push(e);return e;};});
    assert.equal(await hostEval(page,gm=>gm.state.players.length),4);phones[2]={...old,page:np};reconnected=true;
   }
   if(id==='reaction'){
    // Natural five-round finish, with inputs from all four actual controllers.
    await until(async()=>{
     const s=await hostSnapshot(page);if(s.phase!=='MINIGAME_PLAYING')return true;
     const phase=await hostEval(page,gm=>gm.game.scene.getScene('reaction').phase);
     if(phase==='via')for(const p of phones)await p.page.click('#app button:not([disabled])').catch(()=>{});
     return false;
    },'natural reaction finish',180000);
   }else await hostEval(page,(gm,round)=>{const c=gm.minigameContext;c.finish({results:c.players.map((p,i)=>({playerId:p.id,placement:(i+round)%4+1,score:10-i}))});},i);
   await until(async()=>['ROUND_RESULTS','MINIGAME_FINISHED','GAME_FINISHED'].includes((await hostSnapshot(page)).phase),`finish ${id}`);
   assert.equal(await hostEval(page,gm=>gm.state.lastResults.results.length),4);
   if(i+1<seq.length)await hostEval(page,(gm,id)=>gm.selectMinigame(id),seq[i+1]);
   await until(async()=>['MINIGAME_ROULETTE','GAME_FINISHED'].includes((await hostSnapshot(page)).phase),`results ${id}`);
   snap=await hostSnapshot(page);assert.equal(snap.active.length,1);assert.equal(snap.overlays,0);
   const counters=await visualCounters(page);assert.equal(counters.liveInstances,0,`dispose ${id}`);if(id==='fps')for(const p of phones)assert.equal((await visualCounters(p.page)).liveInstances,0,'phone remotes disposed');
   report.games.push({id,phase:snap.phase,scores:snap.scores,counters});writeFileSync(`${out}/four-player-${process.env.SESSION??'session'}.json`,JSON.stringify(report,null,2));console.log(`${id}: four controllers, complete placements, results and disposal: PASS`);
   if(snap.phase==='GAME_FINISHED')break;
  }
  if(seq.includes('arena'))assert.equal(reconnected,true);
  assert.equal(report.games.length,seq.length,'every selected game ran with four phones');
  // Fast cosmetic transitions for the remaining rounds to exercise the real target and final podium.
  for(let n=0;n<18&&(await hostSnapshot(page)).phase!=='GAME_FINISHED';n++){
   await until(async()=>{const s=await hostSnapshot(page);if(s.phase==='GAME_FINISHED')return true;if(s.phase==='MINIGAME_PLAYING')return true;await hostEval(page,gm=>gm.skip());return false;},'remaining round');
   if((await hostSnapshot(page)).phase==='GAME_FINISHED')break;
   await hostEval(page,gm=>{const c=gm.minigameContext;c.finish({results:c.players.map((p,i)=>({playerId:p.id,placement:i+1,score:10-i}))});});
   await until(async()=>{const s=await hostSnapshot(page);if(s.phase==='GAME_FINISHED'||s.phase==='MINIGAME_ROULETTE')return true;await hostEval(page,gm=>gm.skip());return false;},'remaining results');
  }
  await until(async()=>(await hostSnapshot(page)).phase==='GAME_FINISHED','final podium',10000);
  const players=await hostEval(page,gm=>gm.state.players);assert.equal(players.length,4);assert.ok(players.some(p=>p.score>=120));
  await hostEval(page,gm=>gm.restartMatch());await until(async()=>(await hostSnapshot(page)).phase==='LOBBY','new match');
  assert.ok(await hostEval(page,gm=>gm.state.players.length===4&&gm.state.players.every(p=>p.score===0)));
  assert.equal(await page.evaluate(()=>window.__morning),'host');
  assert.equal(report.errors.length,0,report.errors.join('\n'));
  console.log('QR, BOSCHI/Carbo, real input, pause, reconnect, final podium, new match without refresh: PASS');
 }
 writeFileSync(`${out}/four-player-${process.env.SESSION??'session'}.json`,JSON.stringify(report,null,2));
}finally{await browser.close();}
