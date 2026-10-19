import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
process.env.HOST_URL='http://localhost:5180/?quality=high';process.env.CTRL_URL='http://localhost:5180/controller.html';
const {launch,createRoomOnHost,addPhone,hostEval,sleep}=await import('./lib.mjs');
const {gameEval,until}=await import('./padmock.mjs');
const browser=await launch(),errors=[],out='docs/agent-work/glide-polish',G=(p,f,a)=>gameEval(p,'kart3d',f,a);
try{
 const {page,code}=await createRoomOnHost(browser,{targetKeyPresses:3});page.on('pageerror',e=>errors.push(e.message));const phones=[];
 for(let i=0;i<5;i++)phones.push(await addPhone(browser,code,'VOLO '+i,i));
 await hostEval(page,gm=>{gm.selectMinigame('kart3d','arcobaleno');gm.startGame();});await until(()=>G(page,g=>g.race.phase==='racing'),90000,'race');
 await G(page,async g=>{
  const timings={last:0},renderScene=g.scene.render.bind(g.scene);g.scene.render=(...args)=>{const t=performance.now();try{return renderScene(...args);}finally{timings.last=performance.now()-t;}};
  g.engine.setHardwareScalingLevel(1);g.engine.setHardwareScalingLevel=()=>{};g.soloBots.ids=new Set(g.karts.keys());
  window.__audit={renderer:g.engine.getGlInfo().renderer,events:[],frames:[],badCameras:0,cameraSamples:0,itemUses:0,airItemUses:0,abilities:0};
  const flash=g.hud.flash.bind(g.hud);g.hud.flash=(id,text,...args)=>{if(/ALI APERTE|ATTERRAGGIO!|CADUTA ·/.test(text))window.__audit.events.push({id,text,t:g.race.raceTime});return flash(id,text,...args);};
  const use=g.items.useItem.bind(g.items);g.items.useItem=(k,...args)=>{const before=k.heldItem,result=use(k,...args);if(before&&!k.heldItem){window.__audit.itemUses++;if(k.flight==='GLIDE')window.__audit.airItemUses++;}return result;};
  const ability=g.abilities.onAbilityPress.bind(g.abilities);g.abilities.onAbilityPress=(...args)=>{const result=ability(...args);if(result==='ok')window.__audit.abilities++;return result;};
  const present=g.present.bind(g);g.present=dt=>{present(dt);if(g.race.raceTime>2&&g.race.raceTime<10)window.__audit.frames.push({dt:g.engine.getDeltaTime(),render:timings.last,draw:g.engine._drawCalls?.current??null,scale:g.engine.getHardwareScalingLevel()});for(const c of g.scene.activeCameras){window.__audit.cameraSamples++;if(!Number.isFinite(c.position.x+c.position.y+c.position.z))window.__audit.badCameras++;}};
 });
 const t0=Date.now();let last=0,hero=false,short=false,road=false;
 while(await hostEval(page,gm=>gm.state.phase==='MINIGAME_PLAYING')){
  await sleep(1000);const status=await G(page,g=>({time:g.race.raceTime,laps:[...g.karts.values()].map(k=>k.lap),distance:g.karts.get(g.order[0]).distance,flight:g.karts.get(g.order[0]).flight}));if(!status)break;
  if(Date.now()-t0>last+20000){last=Date.now()-t0;console.log('RACE '+JSON.stringify(status));}
  if(!hero&&status.time>10&&status.flight==='GLIDE'){
   await G(page,g=>{g.paused=true;const id=g.order[0],k=g.karts.get(id);g.savedPhotoOrder=g.order;g.order=[id];g.cameraManager.applyLayout(g.order);g.hud.layout(g.order);for(let i=0;i<90;i++)g.cameraManager.update(1/60,id,k,g.spline);g.present(1/60);g.scene.render();g.scene.render();});await page.screenshot({path:`${out}/glide-hero.png`});
   await G(page,g=>{g.order=g.savedPhotoOrder;g.cameraManager.applyLayout(g.order);g.hud.layout(g.order);g.paused=false;});hero=true;
  }
  if(!short&&status.distance>940&&status.distance<1010&&status.flight==='GLIDE'){await page.screenshot({path:`${out}/short-glide.png`});short=true;}
  if(!road&&status.distance>1200&&status.distance<1600){await page.screenshot({path:`${out}/rainbow-road.png`});road=true;}
  if(Date.now()-t0>310000)throw Error('natural race exceeded timeout');
 }
 const results=await hostEval(page,gm=>gm.state.lastResults?.results),audit=await page.evaluate(()=>window.__audit);
 const valid=audit.frames.filter(f=>f.dt>0),mean=valid.reduce((a,f)=>a+f.dt,0)/valid.length,render=valid.reduce((a,f)=>a+f.render,0)/valid.length;
 const metrics={fps:1000/mean,renderMs:render,samples:valid.length,window:'2–10 race seconds; high, 1280x720, scale=1, five viewports',drawLast:valid.at(-1)?.draw,renderer:audit.renderer};
 writeFileSync(`${out}/natural-race.json`,JSON.stringify({results,audit,metrics,errors,wallSeconds:(Date.now()-t0)/1000},null,2));console.log('RESULT '+JSON.stringify({results,metrics,errors,launches:audit.events.filter(e=>e.text.startsWith('ALI APERTE')).length,landings:audit.events.filter(e=>e.text==='ATTERRAGGIO!').length,falls:audit.events.filter(e=>e.text.startsWith('CADUTA')).length,itemUses:audit.itemUses}));
 assert.equal(results.length,5);assert.ok(results.some(r=>r.stats.some(s=>s.startsWith('tempo '))),'real three-lap finish');assert.ok(audit.events.filter(e=>e.text==='ATTERRAGGIO!').length>=25);assert.equal(audit.badCameras,0);assert.equal(errors.length,0);
 await hostEval(page,gm=>gm.restartMatch());await sleep(800);await page.evaluate(()=>localStorage.removeItem('ricchioni.hostToken'));for(const ph of phones)await ph.ctx.close();
}finally{await browser.close();}
