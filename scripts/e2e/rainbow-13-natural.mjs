import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
process.env.HOST_URL='http://localhost:5180/?quality=high';process.env.CTRL_URL='http://localhost:5180/controller.html';
const {launch,createRoomOnHost,addPhone,hostEval,sleep}=await import('./lib.mjs');
const {gameEval,until}=await import('./padmock.mjs');
const browser=await launch(),errors=[],out='docs/agent-work/rainbow-1-3/after',G=(p,f,a)=>gameEval(p,'kart3d',f,a);
try{
 const {page,code}=await createRoomOnHost(browser,{targetKeyPresses:3});page.on('pageerror',e=>errors.push(e.message));const phones=[];
 for(let i=0;i<5;i++)phones.push(await addPhone(browser,code,'VOLO '+i,i));
 await page.evaluate(async()=>{
  const url=performance.getEntriesByType('resource').map(e=>e.name).find(n=>/AudioManager.ts/.test(n)),{audio}=await import(url),create=audio.createEngine.bind(audio);
  window.__engineRefs=[];audio.createEngine=()=>{const e=create();window.__engineRefs.push(e);return e;};
 });
 await hostEval(page,gm=>{gm.selectMinigame('kart3d','arcobaleno');gm.startGame();});await until(()=>G(page,g=>g.controlsDone&&g.race.phase==='countdown'),90000,'countdown');
 await G(page,async g=>{
  const timings={last:0},renderScene=g.scene.render.bind(g.scene);g.scene.render=(...args)=>{const t=performance.now();try{return renderScene(...args);}finally{timings.last=performance.now()-t;}};
  g.engine.setHardwareScalingLevel(1);g.engine.setHardwareScalingLevel=()=>{};g.soloBots.ids=new Set(g.karts.keys());
  window.__audit={renderer:g.engine.getGlInfo().renderer,events:[],frames:[],badCameras:0,cameraSamples:0,itemUses:0,airItemUses:0,abilities:0,abilityUses:{},falls:[],overtakes:0,itemsAt:[]};
  const flash=g.hud.flash.bind(g.hud);g.hud.flash=(id,text,...args)=>{if(/ALI APERTE|ATTERRAGGIO!|CADUTA ·/.test(text)){window.__audit.events.push({id,text,t:g.race.raceTime});if(text.startsWith('CADUTA')){const k=g.karts.get(id);window.__audit.falls.push({id,t:g.race.raceTime,d:k.distance,lateral:k.lateral,reason:k.fallReason,ability:k.characterId,active:k.abilityActive});}}return flash(id,text,...args);};
  const event=g.onRaceEvent.bind(g);g.onRaceEvent=e=>{if(e.type==='overtake')window.__audit.overtakes++;return event(e);};
  const use=g.items.useItem.bind(g.items);g.items.useItem=(k,...args)=>{const before=k.heldItem,result=use(k,...args);if(before&&!k.heldItem){window.__audit.itemUses++;window.__audit.itemsAt.push(g.race.raceTime);if(k.flight==='GLIDE')window.__audit.airItemUses++;}return result;};
  const ability=g.abilities.onAbilityPress.bind(g.abilities);g.abilities.onAbilityPress=(...args)=>{const result=ability(...args);if(result==='ok'){window.__audit.abilities++;const cid=args[0].characterId;window.__audit.abilityUses[cid]=(window.__audit.abilityUses[cid]??0)+1;}return result;};
  const present=g.present.bind(g);g.present=dt=>{present(dt);if(g.race.raceTime>2&&g.race.raceTime<10)window.__audit.frames.push({dt:g.engine.getDeltaTime(),render:timings.last,draw:g.engine._drawCalls?.current??null,scale:g.engine.getHardwareScalingLevel()});for(const c of g.scene.activeCameras){window.__audit.cameraSamples++;if(!Number.isFinite(c.position.x+c.position.y+c.position.z))window.__audit.badCameras++;}};
 });
 await G(page,async g=>{
   const url=performance.getEntriesByType('resource').map(e=>e.name).find(n=>/AudioManager.ts/.test(n)),{audio}=await import(url);window.__r13Audio=audio;
   audio.unlock();const stream=g.engine.getRenderingCanvas().captureStream(30),dest=audio.ctx.createMediaStreamDestination();audio.analyser.connect(dest);for(const t of dest.stream.getAudioTracks())stream.addTrack(t);
   window.__r13Stream=stream;window.__r13Dest=dest;window.__r13Chunks=[];window.__r13Recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp9,opus',videoBitsPerSecond:3500000,audioBitsPerSecond:128000});window.__r13Recorder.ondataavailable=e=>{if(e.data.size)window.__r13Chunks.push(e.data);};window.__r13Recorder.start(1000);
 });
 await until(()=>G(page,g=>g.race.phase==='racing'),20000,'race');
 const t0=Date.now();let last=0,hero=false,short=false,road=false,windowVideoSaved=false;
 while(await hostEval(page,gm=>gm.state.phase==='MINIGAME_PLAYING')){
  await sleep(1000);const status=await G(page,g=>({time:g.race.raceTime,laps:[...g.karts.values()].map(k=>k.lap),distance:g.karts.get(g.order[0]).distance,flight:g.karts.get(g.order[0]).flight,phase:g.race.phase}));if(!status)break;
  if(Date.now()-t0>last+20000){last=Date.now()-t0;console.log('RACE '+JSON.stringify(status));}
  if(status.phase==='ended'&&!windowVideoSaved){
    const b64=await page.evaluate(async()=>{await new Promise(r=>{window.__r13Recorder.onstop=r;window.__r13Recorder.stop();});const blob=new Blob(window.__r13Chunks,{type:window.__r13Recorder.mimeType});const data=await new Promise(r=>{const f=new FileReader();f.onload=()=>r(f.result.split(';base64,')[1]);f.readAsDataURL(blob);});window.__r13Audio.analyser.disconnect(window.__r13Dest);for(const t of window.__r13Stream.getTracks())t.stop();return data;});writeFileSync(`${out}/complete-race.webm`,Buffer.from(b64,'base64'));windowVideoSaved=true;
  }
  if(!short&&status.distance>940&&status.distance<1010&&status.flight==='GLIDE'){await page.screenshot({path:`${out}/short-glide.png`});short=true;}
  if(!road&&status.distance>1200&&status.distance<1600){await page.screenshot({path:`${out}/rainbow-road.png`});road=true;}
  if(Date.now()-t0>310000)throw Error('natural race exceeded timeout');
 }
 const results=await hostEval(page,gm=>gm.state.lastResults?.results),audit=await page.evaluate(()=>window.__audit);
 const valid=audit.frames.filter(f=>f.dt>0),mean=valid.reduce((a,f)=>a+f.dt,0)/valid.length,render=valid.reduce((a,f)=>a+f.render,0)/valid.length;
 const metrics={fps:1000/mean,renderMs:render,samples:valid.length,window:'2–10 race seconds; high, 1280x720, scale=1, five viewports',drawLast:valid.at(-1)?.draw,renderer:audit.renderer};
 writeFileSync(`${out}/natural-race.json`,JSON.stringify({results,audit,metrics,errors,wallSeconds:(Date.now()-t0)/1000},null,2));console.log('RESULT '+JSON.stringify({results,metrics,errors,launches:audit.events.filter(e=>e.text.startsWith('ALI APERTE')).length,landings:audit.events.filter(e=>e.text==='ATTERRAGGIO!').length,falls:audit.events.filter(e=>e.text.startsWith('CADUTA')).length,itemUses:audit.itemUses}));
 assert.equal(results.length,5);assert.ok(results.every(r=>r.stats.some(s=>s.startsWith('tempo '))),'all five real three-lap finishes');assert.ok(audit.events.filter(e=>e.text==='ATTERRAGGIO!').length>=30);assert.equal(audit.badCameras,0);assert.equal(errors.length,0);
 await hostEval(page,gm=>gm.restartMatch());await sleep(800);await page.evaluate(()=>localStorage.removeItem('ricchioni.hostToken'));for(const ph of phones)await ph.ctx.close();
 const cleanup=await page.evaluate(async()=>{
  const url=performance.getEntriesByType('resource').map(e=>e.name).find(n=>/AudioManager.ts/.test(n)),{audio}=await import(url);
  return {created:window.__engineRefs.length,enginesStopped:window.__engineRefs.every(e=>!e.osc&&!e.osc2&&!e.sub&&!e.whine&&!e.noise),voices:audio.stats().voices,finishPanels:document.querySelectorAll('#rainbow-finish').length,canvases:document.querySelectorAll('canvas').length};
 });
 assert.equal(cleanup.created,5);assert.ok(cleanup.enginesStopped);assert.equal(cleanup.finishPanels,0);assert.equal(cleanup.canvases,1);
 writeFileSync(`${out}/audio-cleanup.json`,JSON.stringify(cleanup,null,2));
}finally{await browser.close();}
