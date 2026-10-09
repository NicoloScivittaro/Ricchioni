import assert from 'node:assert/strict';
import {mkdirSync, writeFileSync} from 'node:fs';
import {launch,createRoomOnHost,addPhone,hostEval,hostSnapshot,sleep} from './lib.mjs';
import {visualCounters} from './tripo-counters.mjs';
const out='docs/agent-work/solo-bots';mkdirSync(out,{recursive:true});
const browser=await launch(), report={games:[],errors:[]};
const until=async(fn,label,timeout=60000)=>{const t=Date.now();while(Date.now()-t<timeout){const v=await fn();if(v)return v;await sleep(130);}throw new Error(`Timeout: ${label}`);};
try {
 let {page,code}=await createRoomOnHost(browser);
 code=await hostEval(page,async gm=>{gm.backToLobby();const ack=await gm.createRoom(4,200);gm.game.scene.start('RoomScene');return ack.roomCode;});
 console.log('Four seats requested',code);
 page.on('pageerror',e=>report.errors.push(String(e)));
 const phone=await addPhone(browser,code,'Niko',0);phone.page.on('pageerror',e=>report.errors.push(`phone: ${e}`));
 await until(()=>hostEval(page,gm=>gm.state.players.length===1&&gm.state.players[0].ready),'one ready human');
 await until(()=>hostEval(page,gm=>gm.game.scene.getScene('RoomScene').startText.text.includes('3 BOT')),'solo start label');
 await page.screenshot({path:`${out}/solo-lobby.png`});
 await page.evaluate(async()=>{
  const url=performance.getEntriesByType('resource').map(e=>e.name).find(n=>/\/PlayerInput\.ts(?:\?|$)/.test(n));
  const {PlayerInput}=await import(url);window.__botActions={};
  const tap=PlayerInput.prototype.tap,down=PlayerInput.prototype.setDown;
  PlayerInput.prototype.tap=function(control){if(this.owner?.startsWith('bot:'))window.__botActions[control]=(window.__botActions[control]??0)+1;return tap.call(this,control);};
  PlayerInput.prototype.setDown=function(control){if(this.owner?.startsWith('bot:')&&!this.pressed(control))window.__botActions[`hold:${control}`]=(window.__botActions[`hold:${control}`]??0)+1;return down.call(this,control);};
 });
 console.log('Solo lobby ready');
 const seq=(process.env.SEQ??'arena,cornicione,dodgeball,soccer,volleyball,kart3d,fps,casacarbo,quiz,memory,cultura,reaction').split(',');
 for(const id of seq){
  console.log(`Testing ${id}`);
  if(id==='fps')await phone.page.evaluate(async()=>{
   const main=performance.getEntriesByType('resource').map(e=>e.name).find(n=>/\/controller\/main\.ts(?:\?|$)/.test(n));
   const source=await (await fetch(main)).text();const url=/import\("([^"]*fpsClient\.ts[^"]*)"\)/.exec(source)?.[1];
   const {FpsClient}=await import(url);const spawn=FpsClient.prototype.spawnRemote;window.__fpsRemotes=[];
   FpsClient.prototype.spawnRemote=function(ps){const e=spawn.call(this,ps);window.__fpsRemotes.push(e);return e;};
  });
  if((await hostSnapshot(page)).phase!=='LOBBY'){
   await hostEval(page,gm=>gm.restartMatch());await until(async()=>(await hostSnapshot(page)).phase==='LOBBY','restart');
   assert.equal(await hostEval(page,gm=>gm.state.players.length),1);
   await phone.page.waitForSelector('#ready');await phone.page.click('#ready');
   await until(()=>hostEval(page,gm=>gm.state.players[0].ready),'ready again');
  }
  await hostEval(page,(gm,id)=>gm.selectMinigame(id),id);await sleep(200);await page.evaluate(()=>window.__botActions={});await page.keyboard.press('Enter');
  await until(async()=>{const s=await hostSnapshot(page);if(s.phase==='MINIGAME_PLAYING')return true;await hostEval(page,gm=>gm.skip());return false;},`${id} playing`);
  await until(()=>hostEval(page,(gm,id)=>{const s=gm.game.scene.getScene(id);return s?.sys.isActive()&&(!('game3d'in s)||!!s.game3d);},id),`${id} loaded`);
  assert.ok(await hostEval(page,gm=>gm.state.players.length===4&&gm.state.players.filter(p=>p.bot).length===3));
  await hostEval(page,(gm,id)=>{
   clearInterval(window.__soloTimer);window.__soloSample=null;
   const s=gm.game.scene.getScene(id),g=s.game3d??s,ctx=gm.minigameContext;
   window.__soloCapture=()=>{
    if(!s.sys.isActive()||g.disposed)return window.__soloSample;
    const ps=g.players??g.world?.players??g.world?.fighters??(g.karts?[...g.karts.values()]:[]);
    window.__soloSample={phase:g.phase,finished:s.finished,resultsSent:g.resultsSent,red:g.redScore,blue:g.blueScore,ball:g.ball?{state:g.ball.state,holder:g.ball.holderId}:null,players:ps instanceof Map?[]:ps.map(p=>({id:p.id??p.playerId??p.snap?.id,x:p.x??p.distance,z:p.z??p.lateral,alive:p.alive??p.inGame,eliminations:p.eliminations,goals:p.goals,shots:p.shotsFired,kills:p.kills,lap:p.lap,finished:p.finished,water:p.waterCollected,correct:p.totalCorrect,roundTimes:p.roundTimes})),quiz:s.manager?.buildResults(),actions:{...window.__botActions},texts:ctx.players.filter(p=>p.bot).map(p=>({id:p.id,bluff:gm.input.get(p.id).text('bluff'),vote:gm.input.get(p.id).text('vote')}))};
    return window.__soloSample;
   };
   window.__soloTimer=setInterval(window.__soloCapture,100);window.__soloCapture();
  },id);
  if(['arena','cornicione','dodgeball','soccer','volleyball','kart3d','casacarbo'].includes(id)){
   await until(()=>hostEval(page,(gm,id)=>[...(gm.game.scene.getScene(id).game3d.entities??gm.game.scene.getScene(id).game3d.avatars).values()].every(e=>e.goblinDebug?.()?.state==='ready'),id),`${id} Tripo`);
   assert.equal((await visualCounters(page)).liveInstances,4);
  }
  await page.evaluate(async()=>{const u=performance.getEntriesByType('resource').map(e=>e.name).find(n=>/\/ControlsHelp\.ts(?:\?|$)/.test(n));(await import(u)).dismissControlsHelp();});
  const before=await hostEval(page,(gm,id)=>{const s=gm.game.scene.getScene(id),g=s.game3d??s;const ps=g.players??g.world?.players??g.world?.fighters??(g.karts?[...g.karts.values()]:[]);return ps instanceof Map?[]:ps.map(p=>({id:p.id??p.playerId??p.snap?.id,x:p.x??p.distance,z:p.z??p.lateral}));},id);
  await sleep(4500);
  if((await hostSnapshot(page)).phase==='MINIGAME_PLAYING'){
   await page.keyboard.press('Escape');await until(()=>hostEval(page,gm=>gm.state.paused===true),'pause');
   const pausedBefore=await hostEval(page,(gm,id)=>{const s=gm.game.scene.getScene(id),g=s.game3d??s;return [g.soloBots?.time??g.world?.time,g.gameTime??s.gameTime];},id);
   await sleep(700);
   const pausedAfter=await hostEval(page,(gm,id)=>{const s=gm.game.scene.getScene(id),g=s.game3d??s;return [g.soloBots?.time??g.world?.time,g.gameTime??s.gameTime];},id);
   assert.deepEqual(pausedAfter,pausedBefore,`${id} pause freezes AI`);
   await page.keyboard.press('Escape');await until(()=>hostEval(page,gm=>!gm.state.paused),'resume');
  }
  if(['arena','kart3d','cornicione'].includes(id))await page.screenshot({path:`${out}/solo-${id}.png`});
  if(id==='fps'){
   await phone.page.waitForFunction(()=>window.__fpsRemotes.length===3&&window.__fpsRemotes.every(e=>e.tripo?.debug().state==='ready'),{timeout:60000});
   assert.equal((await visualCounters(phone.page)).liveInstances,3);
   await phone.page.screenshot({path:`${out}/solo-fps-phone.png`});
  }
  if(id==='kart3d')assert.equal(await hostEval(page,gm=>gm.game.scene.getScene('kart3d').game3d.scene.activeCameras.length),1,'one human viewport');
  let simulated=0,last=await page.evaluate(()=>window.__soloCapture());
  while((await hostSnapshot(page)).phase==='MINIGAME_PLAYING'&&simulated<500){
   last=await hostEval(page,(gm,{id})=>{
    const s=gm.game.scene.getScene(id),g=s.game3d??s;if(!s.sys.isActive())return window.__soloSample;
    for(let n=0;n<100;n++){
     const human=gm.minigameContext.players.find(p=>!p.bot),input=gm.input.get(human.id);
     if(id==='volleyball'&&g.ball.state==='held'&&g.ball.holderId===human.id)input.tap('hit');
     if(id==='quiz'&&s.manager.phase==='question')input.tap('answerA');
     if(id==='cultura'&&s.phase==='bluff')input.setText('bluff',`La risposta di Niko ${s.round}`);
     if(id==='cultura'&&s.phase==='vote'){const i=s.options.findIndex(o=>o.ownerId!==human.id);input.setText('vote',String(i));}
     if(id==='reaction'&&s.phase==='via')input.tap('action');
     if(id==='memory'&&s.phase==='repeat'){const p=s.players.find(p=>!p.snap.bot);if(p.alive&&!p.resolved)input.tap(`c${s.sequences[s.round][p.inputIndex]}`);}
     if(s.game3d)g.step(.05);else s.update(performance.now(),50);
     if(g.resultsSent||s.resultsSent||s.finished||g.race?.phase==='ended')break;
    }
    return window.__soloCapture();
   },{id});
   simulated+=5;await sleep(last?.finished||last?.resultsSent?1600:80);
  }
  assert.notEqual((await hostSnapshot(page)).phase,'MINIGAME_PLAYING',`${id} naturally completes within 500 simulated seconds: ${JSON.stringify(last)}`);
  const results=await hostEval(page,gm=>gm.state.lastResults);assert.equal(results.results.length,4);assert.equal(new Set(results.results.map(p=>p.playerId)).size,4);
  report.games.push({id,before,last,results,simulated,counters:await visualCounters(page)});
  if(!['cornicione','casacarbo','cultura'].includes(id))assert.ok(Object.keys(last.actions).length>0,`${id} bots issued commands`);
  if(id==='fps')assert.ok(last.players.filter(p=>p.id.startsWith('bot:')).some(p=>p.shots>0&&p.kills>0),'FPS real shots and kills');
  if(id==='soccer')assert.ok(last.players.filter(p=>p.id.startsWith('bot:')).some(p=>p.goals>0),'soccer bot scored a real goal');
  writeFileSync(`${out}/browser-${process.env.SESSION??'all'}.json`,JSON.stringify(report,null,2));console.log(`${id}: SOLO, Tripo, pause, real bot commands, natural results PASS`);
 }
 await hostEval(page,gm=>gm.restartMatch());await until(async()=>(await hostSnapshot(page)).phase==='LOBBY','final restart');
 assert.equal(await hostEval(page,gm=>gm.state.players.length),1);assert.equal((await visualCounters(page)).liveInstances,0);
 const friend=await addPhone(browser,code,'Christian',1);await phone.page.waitForSelector('#ready');await phone.page.click('#ready');
 await until(()=>hostEval(page,gm=>gm.state.players.every(p=>p.ready)),'two humans ready');await page.keyboard.press('Enter');
 await until(async()=>(await hostSnapshot(page)).phase!=='LOBBY','multiplayer start');assert.ok(await hostEval(page,gm=>gm.state.players.length===2&&gm.state.players.every(p=>!p.bot)),'multiplayer has no auto bots');
 await hostEval(page,gm=>gm.backToLobby());await friend.ctx.close();
 assert.equal(report.errors.length,0,report.errors.join('\n'));report.multiplayer=true;
 writeFileSync(`${out}/browser-${process.env.SESSION??'all'}.json`,JSON.stringify(report,null,2));console.log('PASS restart removes bots; real friend can join; multiplayer unchanged');
}catch(e){report.failure=String(e);writeFileSync(`${out}/browser-${process.env.SESSION??'all'}.json`,JSON.stringify(report,null,2));throw e;}finally{await browser.close();}
