import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
process.env.HOST_URL='http://localhost:5176/?quality=high&backroomsSeed=12345';process.env.CTRL_URL='http://localhost:5176/controller.html';
const {launch,createRoomOnHost,addPhone,hostEval,sleep}=await import('./lib.mjs');
const browser=await launch(),reports=[],errors=[],tag=process.env.PROFILE_PHASE??'before',out='docs/agent-work/playability-performance';mkdirSync(out,{recursive:true});
const until=async(fn,label)=>{const t=Date.now();while(Date.now()-t<90000){if(await fn())return;await sleep(100);}throw Error('Timeout '+label);};
try{
 for(const id of ['backrooms','minigolf']){
  const {page,code}=await createRoomOnHost(browser,{targetKeyPresses:3});page.on('pageerror',e=>errors.push(e.message));await addPhone(browser,code,'TEST GOBLIN',0);
  await hostEval(page,gm=>{gm.selectMinigame('backrooms');},null);await hostEval(page,(gm,id)=>{gm.selectMinigame(id);gm.startGame();},id);
  await until(()=>hostEval(page,gm=>!!gm.minigameContext),'contesto');await hostEval(page,async gm=>{const {Rng}=await import('/shared/rng.ts');gm.minigameContext.rng=new Rng(12345);});
  await until(()=>hostEval(page,(gm,id)=>{const scene=gm.game.scene.getScenes(true).find(s=>s.scene.key===id);return !!scene?.game3d&&!gm.loadWatchdog;},id),'motore '+id);await sleep(3500);
  const result=await hostEval(page,async(gm,id)=>{
   const g=gm.game.scene.getScene(id).game3d,record={step:[],render:[],hud:[],characters:[],entities:0,hudCalls:0};
   // Stesso buffer del profilo iniziale: il confronto non deve guadagnare FPS riducendo risoluzione.
   const fixedScale=id==='backrooms'?1.25:1;g.engine.setHardwareScalingLevel(fixedScale);g.engine.setHardwareScalingLevel=()=>{};
   const wrap=(object,key,list)=>{if(typeof object[key]!=='function')return;const original=object[key];object[key]=function(...args){const start=performance.now();try{return original.apply(this,args);}finally{record[list].push(performance.now()-start);}};};
   wrap(g,'step','step');wrap(g.scene,'render','render');
   if(g.hud&&typeof g.hud.update==='function'){wrap(g.hud,'update','hud');const update=g.hud.update.bind(g.hud);g.hud.update=(...a)=>{record.hudCalls++;return update(...a);};}
   if(typeof g.updatePanel==='function')wrap(g,'updatePanel','hud');
   wrap(g,'updateCharacters','characters');for(const e of g.entities.values()){const old=e.updateVisual.bind(e);e.updateVisual=(...args)=>{record.entities++;return old(...args);};}
   const frames=[],start=performance.now();await new Promise(resolve=>{const frame=t=>{frames.push(t);if(t-start<8000)requestAnimationFrame(frame);else resolve();};requestAnimationFrame(frame);});
   const summarise=a=>{const sorted=a.slice().sort((a,b)=>a-b);return{count:a.length,meanMs:+(a.reduce((x,y)=>x+y,0)/Math.max(1,a.length)).toFixed(3),p95Ms:+(sorted[Math.floor(sorted.length*.95)]??0).toFixed(3),maxMs:+Math.max(0,...a).toFixed(3)};};
   return {id,players:g.match.players.length,seed:g.match.maze?.seed??12345,course:g.match.course?.id??null,fps:+((frames.length-1)*1000/(frames.at(-1)-frames[0])).toFixed(2),frames:summarise(frames.slice(1).map((t,i)=>t-frames[i])),step:summarise(record.step),render:summarise(record.render),hud:summarise(record.hud),characters:summarise(record.characters),entityUpdates:record.entities,hudCalls:record.hudCalls,meshes:g.scene.meshes.length,scale:g.engine.getHardwareScalingLevel(),width:g.engine.getRenderWidth(),height:g.engine.getRenderHeight(),shadows:g.scene.shadowsEnabled};
  },id);
  assert.equal(result.players,5);reports.push(result);console.log(JSON.stringify(result));await page.screenshot({path:`${out}/${tag}-${id}.png`});await hostEval(page,gm=>gm.restartMatch());await until(()=>hostEval(page,gm=>gm.state.phase==='LOBBY'),'lobby');assert.equal(await page.evaluate(()=>document.querySelectorAll('canvas').length),1);await page.evaluate(()=>localStorage.removeItem('ricchioni.hostToken'));await page.close();
 }
 assert.deepEqual(errors,[]);
}finally{writeFileSync(`${out}/${tag}-performance.json`,JSON.stringify({reports,errors},null,2));await browser.close();}
