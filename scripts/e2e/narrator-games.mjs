import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
process.env.HOST_URL='http://localhost:5175/';process.env.CTRL_URL='http://localhost:5175/controller.html';
const {launch,createRoomOnHost,addPhone,hostEval,sleep}=await import('./lib.mjs');
const browser=await launch(),errors=[],games=[];
const until=async(fn,label,ms=120000)=>{const t=Date.now();while(Date.now()-t<ms){if(await fn())return;await sleep(100);}throw Error('Timeout '+label);};
try{
 const {page:host,code}=await createRoomOnHost(browser);host.on('pageerror',e=>errors.push(e.message));
 const phones=[await addPhone(browser,code,'TEST GOBLIN',0),await addPhone(browser,code,'TEST BOSCHI',1)];
 await host.evaluate(async()=>{const {narratorSettings}=await import('/src/audio/narrator/NarratorSettings.ts');narratorSettings.set({frequency:'chatty'});});
 const ids=await host.evaluate(async()=>{const {MINIGAME_DEFINITIONS}=await import('/shared/minigames.ts');return MINIGAME_DEFINITIONS.filter(g=>g.enabled!==false).map(g=>({id:g.id,scene:g.sceneKey}));});
 for(const def of ids){
  for(const p of phones){await p.page.waitForSelector('#ready');await p.page.$eval('#ready',e=>{if(!/PRONTO ✅/.test(e.textContent)&&!e.disabled)e.click();});}
  await until(()=>hostEval(host,gm=>gm.state.players.every(p=>p.ready)),'giocatori pronti');
  await hostEval(host,(gm,id)=>{gm.selectMinigame(id);gm.startGame();},def.id);
  await until(()=>hostEval(host,(gm,def)=>{const s=gm.game.scene.getScenes(true).find(s=>s.scene.key===def.scene);return gm.state?.phase==='MINIGAME_PLAYING'&&s&&(!('game3d' in s)||!!s.game3d)&&!gm.loadWatchdog;},def),'avvio '+def.id);
  await sleep(250);
  const state=await host.evaluate(async()=>{const {narrator}=await import('/src/audio/narrator/NarratorDirector.ts');return narrator.stats();});
  assert.equal(state.active,null);assert.equal(await host.$('#narrator-subtitles'),null);assert.equal(state.listeners,8);
  const announcement=state.history.filter(h=>h.event==='game').at(-1);assert.ok(announcement?.id.startsWith('game-'+def.id+'-'),def.id+' ha annuncio reale corretto');
  await hostEval(host,gm=>gm.restartMatch());await until(()=>hostEval(host,gm=>gm.state?.phase==='LOBBY'),'ritorno lobby');await sleep(100);
  assert.equal((await host.evaluate(async()=>{const {narrator}=await import('/src/audio/narrator/NarratorDirector.ts');return narrator.stats();})).pending,false);
  games.push({id:def.id,started:true,spokenAnnouncement:announcement.id,noVoiceInGameplay:true,lobbyCleanup:true,listeners:8});console.log('NARRATORE gioco '+def.id+': avvio/voce/lobby OK');
  writeFileSync('docs/agent-work/narrator/games-tests.json',JSON.stringify({games,errors},null,2));
 }
 assert.equal(games.length,17);assert.deepEqual(errors,[]);
}finally{await browser.close();}
