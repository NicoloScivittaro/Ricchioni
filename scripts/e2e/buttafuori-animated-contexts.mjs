import assert from 'node:assert/strict';
import {launch,HOST_URL,sleep} from './lib.mjs';
import {writeFileSync} from 'node:fs';
const browser=await launch(),report={};
try{
 const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(String(e)));
 await p.goto(`${HOST_URL}?debug=1&buttafuori=new`,{waitUntil:'load'});
 await p.evaluate(async()=>{
  const {setButtafuoriVisualMode}=await import('/src/minigames/characters/buttafuoriVisualMode.ts');setButtafuoriVisualMode('new');
  const {InputManager}=await import('/src/network/InputManager.ts'),{Rng}=await import('/shared/rng.ts');
  window.__gctx={InputManager,Rng};
 });
 for(const mode of ['old','new'])for(const kind of ['cornicione','arena','dodgeball','fps']){
  // A fresh document gives OLD/NEW the same module graph after Vite hot updates.
  await p.goto(`${HOST_URL}?debug=1&buttafuori=${mode}`,{waitUntil:'load'});
  await p.evaluate(async()=>{const {InputManager}=await import('/src/network/InputManager.ts'),{Rng}=await import('/shared/rng.ts');window.__gctx={InputManager,Rng};});
  await p.evaluate(async({mode,kind})=>{
   const {setButtafuoriVisualMode}=await import('/src/minigames/characters/buttafuoriVisualMode.ts');setButtafuoriVisualMode(mode);
   const {InputManager,Rng}=window.__gctx;
   const players=Array.from({length:5},(_,i)=>({id:`probe${i}`,characterId:'buttafuori',displayName:`G${i}`,name:`G${i}`,roleTitle:'',avatar:'👺',color:'#22cc88',quote:'',score:0}));
   const canvas=document.createElement('canvas');canvas.style.cssText='position:fixed;inset:0;width:100%;height:100%;z-index:999999';document.body.append(canvas);
   const ctx={players,playerIds:players.map(p=>p.id),rng:new Rng(771),durationSec:150,modifier:null,modifiers:new Map(),input:new InputManager(),consume:()=>false,sendPrivate:()=>{},vibrate:()=>{},signal:()=>{},finish:()=>{}};
   let g;
   if(kind==='fps'){
    const {BabylonFpsGame}=await import('/src/minigames/fps/BabylonFpsGame.ts');g=new BabylonFpsGame(canvas,players);
    const snapshots=players.map((p,i)=>({...p,x:-20+i*2,z:-20+i,yaw:Math.PI/4,pitch:0,hp:100,maxHp:100,alive:true,kills:0,weaponId:'mitraglia',magazine:30,reloading:false}));
    g.scene.onBeforeRenderObservable.add(()=>{const dt=.016;g.update(dt,snapshots);});g.update(.016,snapshots);
   }else{
    const path=kind==='cornicione'?'/src/minigames/cornicione/BabylonCornicioneGame.ts':kind==='arena'?'/src/minigames/arena/BabylonArenaGame.ts':'/src/minigames/dodgeball/BabylonDodgeballGame.ts';
    const module=await import(path),Ctor=module[kind==='cornicione'?'BabylonCornicioneGame':kind==='arena'?'BabylonArenaGame':'BabylonDodgeballGame'];
    g=new Ctor(canvas,ctx,{devArena:true});
   }
   const coreUrl=performance.getEntriesByType('resource').map(e=>e.name).find(n=>/\/@babylonjs_core\.js\?/.test(n));
   const core=await import(coreUrl);
   const ins=new core.SceneInstrumentation(g.scene);ins.captureFrameTime=true;ins.captureAnimationsTime=true;ins.captureRenderTime=true;
   window.__probe={g,canvas,ins,kind,mode,rows:[]};
   g.scene.onAfterRenderObservable.add(()=>{
    const q=window.__probe;
    if(!q.capture)return;
    const es=kind==='fps'?[...g.avatars.values()].map(e=>e.goblin):[...g.entities.values()].map(e=>e.goblinVisual);
    q.rows.push({dt:g.engine.getDeltaTime(),frameMs:ins.frameTimeCounter.current,renderMs:ins.renderTimeCounter.current,engineAnimationMs:ins.animationsTimeCounter.current,drawCalls:ins.drawCallsCounter.current,samplerMs:es.reduce((sum,e)=>sum+(e?.animator?.sampleMs??0),0),skeletonPrepareMs:q.skinMs??0,skeletonPrepareCalls:q.skinCalls??0,activeTracks:es.reduce((sum,e)=>sum+(e?.animator?.activeTracks??0),0),meshes:g.scene.meshes.length,materials:g.scene.materials.length,textures:g.scene.textures.length,skeletons:g.scene.skeletons.length,renderer:g.engine.getGlInfo().renderer});
   });
  },{mode,kind});
  if(mode==='new')await p.waitForFunction(()=>{const {g,kind}=window.__probe;const es=kind==='fps'?[...g.avatars.values()].map(e=>e.goblin):[...g.entities.values()].map(e=>e.goblinVisual);return es.length===5&&es.every(e=>e?.ready);},{timeout:60000});
  if(mode==='old')assert.equal(await p.evaluate(()=>window.__probe.g.scene.skeletons.length),0,'OLD must really have no imported skeleton');
  await p.evaluate(()=>{const q=window.__probe;q.g.engine.onBeginFrameObservable.add(()=>{q.skinMs=0;q.skinCalls=0;});for(const skeleton of q.g.scene.skeletons){const prepare=skeleton.prepare.bind(skeleton);skeleton.prepare=()=>{const begin=performance.now();prepare();q.skinMs=(q.skinMs??0)+performance.now()-begin;q.skinCalls=(q.skinCalls??0)+1;};}});
  await sleep(1000);
  await p.evaluate(()=>{window.__probe.capture=true;});
  await p.waitForFunction(()=>window.__probe.rows.length>=35,{timeout:90000});
  report[`${kind}-${mode}`]=await p.evaluate(()=>window.__probe.rows);
  if(mode==='new')await p.screenshot({path:`e2e-shots/buttafuori-animations/${kind}-5goblins.png`});
  if(kind==='dodgeball'&&mode==='new'){
   report.dodgeball=await p.evaluate(()=>{
    const {g}=window.__probe;g.setPaused(true);const player=g.players[0],e=g.entities.get(player.id);
    e.playPickup();e.updateVisual(player,0,performance.now());g.scene.render();
    const pickup=e.goblinDebug();e.playThrow();e.updateVisual(player,0,performance.now());g.scene.render();
    const throwing=e.goblinDebug();
    g.balls[0].state='held';g.balls[0].holderId=player.id;player.facing+=Math.PI/2;
    e.updateVisual(player,.016,performance.now());g.syncBallMeshes(performance.now());
    const h=e.handWorldAnchor;const heldError=h?g.ballMeshes[0].position.subtract(h).length():Infinity;
    e.playAbsorb();e.updateVisual(player,0,performance.now());
    return {pickup,throw:throwing,catch:e.goblinDebug(),hand:e.handAnchor,heldError};
   });
   assert.equal(report.dodgeball.pickup.animator.contactTime,0);assert.equal(report.dodgeball.throw.animator.contactTime,0);
   assert.equal(report.dodgeball.catch.animator.name,'buttafuori.ballCatch');assert.ok(report.dodgeball.heldError<1e-5,'held ball follows actual hand while facing is smoothed');
   await p.screenshot({path:'e2e-shots/buttafuori-animations/dodgeball-throw.png'});
   await p.evaluate(()=>{const {g}=window.__probe,e=[...g.entities.values()][0];e.playPickup();e.updateVisual(g.players[0],0,performance.now());g.scene.render();});
   await p.screenshot({path:'e2e-shots/buttafuori-animations/dodgeball-pickup.png'});
  }
  const counters=await p.evaluate(async()=>{const q=window.__probe;q.g.dispose();q.canvas.remove();q.ins.dispose();window.__probe=null;const {goblinVisualCounters}=await import('/src/minigames/characters/goblinVisual.ts');return goblinVisualCounters();});
  assert.equal(counters.liveInstances,0,`${kind} ${mode} instance disposal`);
  console.log(`${kind} ${mode}: ${report[`${kind}-${mode}`].length} samples, disposed`);
 }
 assert.equal(errors.length,0,errors.join(';'));report.errors=errors;
 writeFileSync(`docs/agent-work/buttafuori-animation-phase/${process.env.GOBLIN_GPU==='1'?'hardware-':''}context-performance.json`,JSON.stringify(report,null,2));
}finally{await browser.close();}
