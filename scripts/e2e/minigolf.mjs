import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {launch,createRoomOnHost,addPhone,hostEval,hostSnapshot,sleep} from './lib.mjs';
import {gameEval,startGame,until,installMock,add,remove,tap,btn,stick,XBOX,DS,GENERIC,watchControls} from './padmock.mjs';
const out='docs/agent-work/minigolf';mkdirSync(out,{recursive:true});
const report={errors:[],controls:[],courses:[],resolutions:[]},browser=await launch();
try {
 const {page,code}=await createRoomOnHost(browser,{targetKeyPresses:3});page.on('pageerror',e=>report.errors.push(String(e)));
 const phones=[];for(const [i,name] of ['Niko','Christian','Victor','Carbo','Ciro'].entries()){const p=await addPhone(browser,code,name,i);p.page.on('pageerror',e=>report.errors.push(String(e)));phones.push(p);}
 const ids=await hostEval(page,gm=>gm.state.players.map(p=>p.id));
 await installMock(page);for(const [i,pad] of [XBOX,DS,GENERIC].entries()){await add(page,i,pad);await sleep(250);await page.evaluate(id=>window.__pads.setTarget(id),ids[i]);await tap(page,i,'A');}
 await page.evaluate(()=>window.__pads.setTarget(null));
 await watchControls(page);const G=(fn,arg)=>gameEval(page,'minigolf',fn,arg);await startGame(page,'minigolf');
 await until(()=>G(g=>g.phase==='playing'),50000,'golf via');
 await until(()=>G(g=>[...g.entities.values()].filter(e=>e.goblinDebug()).every(e=>e.goblinDebug().state==='ready')),60000,'native models');
 await phones[0].page.waitForSelector('.cc-controls');assert.ok(await phones[0].page.evaluate(()=>document.body.innerText.includes('RB')));
 assert.ok(await G(g=>g.match.time<3),'controls/intro do not consume 50s hole timer');
 // Aim, charge, cancel and shoot through actual pad adapter -> InputManager -> authority.
 const reset=()=>G(g=>{const p=g.players[0];Object.assign(p.ball,{x:-5,z:11,y:.28,vx:0,vy:0,vz:0,grounded:true,readyFor:1});p.finished=false;p.ball.done=false;p.charging=false;p.charge=0;p.blocked=false;});
 for(const [pad,family] of [[0,'Xbox'],[1,'PlayStation'],[2,'Generic']]){
  await stick(page,pad,1,-1);await sleep(200);
  const projected=await G((g,i)=>{const p=g.players[i],V=g.camera.position.constructor,M=g.scene.getTransformMatrix().constructor,vp=g.camera.viewport.toGlobal(g.engine.getRenderWidth(),g.engine.getRenderHeight());g.scene.render();const project=(x,z)=>V.Project(new V(x,p.ball.y,z),M.Identity(),g.scene.getTransformMatrix(),vp);const a=project(p.ball.x,p.ball.z),b=project(p.ball.x+p.aim.x*2,p.ball.z+p.aim.z*2);return{right:b.x>a.x,up:b.y<a.y};},pad);
  assert.ok(projected.right&&projected.up,'stick up/right must aim up/right on screen');
  const aim=await G((g,i)=>g.players[i].aim,pad);assert.ok(aim.x<-.6&&aim.z<-.6);await stick(page,pad,0,0);report.controls.push(family);
 }
 await reset();await btn(page,0,'A',1);await until(()=>G(g=>g.players[0].charge>.3),5000,'pad charging');
 const before=await G(g=>g.players[0].strokes);await tap(page,0,'B');await btn(page,0,'A',0);await sleep(200);assert.equal(await G(g=>g.players[0].strokes),before);
 await reset();await btn(page,0,'A',1);await sleep(500);await btn(page,0,'A',0);await until(()=>G(g=>g.players[0].strokes===1),5000,'pad release');
 await reset();await btn(page,0,'A',1);await sleep(250);await page.keyboard.press('Escape');const clock=await G(g=>g.match.time);await sleep(350);assert.equal(await G(g=>g.match.time),clock);
 await page.keyboard.press('Escape');await btn(page,0,'A',0);await sleep(250);assert.equal(await G(g=>g.players[0].strokes),1,'pause no ghost shot');
 await reset();await btn(page,0,'A',1);await sleep(300);await remove(page,0);await sleep(500);assert.equal(await G(g=>g.players[0].strokes),1);assert.equal(await G(g=>g.players[0].charging),false);
 await phones[0].page.waitForSelector('#golf-shoot');await add(page,0,XBOX);await sleep(700);await phones[0].page.waitForSelector('.cc-controls');
 // Two actual fingers: joystick and charge are independent; cancellation never becomes a shot.
 await until(()=>phones[3].page.evaluate(()=>!document.querySelector('#golf-shoot')?.disabled),5000,'phone ready');
 const phone=phones[3].page,cdp=await phone.createCDPSession(),points=await phone.evaluate(()=>['.golf-phone-joy','#golf-shoot'].map(q=>{const r=document.querySelector(q).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};}));
 const touches=[{...points[0],id:11},{...points[1],id:12}];await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:touches});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...touches[0],x:touches[0].x+45,y:touches[0].y-30},touches[1]]});await sleep(450);
 assert.ok(await G(g=>g.players[3].charging&&g.players[3].aim.x<-.6));await phone.screenshot({path:`${out}/phone-multitouch.png`});
 const phoneStrokes=await G(g=>g.players[3].strokes);await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await sleep(250);assert.equal(await G(g=>g.players[3].strokes),phoneStrokes);
 await phone.reload({waitUntil:'load'});await phone.waitForSelector('#golf-shoot');await until(()=>phone.evaluate(()=>!document.querySelector('#golf-shoot')?.disabled),6000,'rejoin status');
 // Pause only the fixture's simulation. All geometry/HUD/characters are the production renderer.
 await sleep(5500);await G(g=>g.paused=true);
 const originalCourses=await G(g=>g.match.courses.map(c=>c.id));
 const courses=await page.evaluate(async()=>{const u=performance.getEntriesByType('resource').map(e=>e.name).find(n=>n.includes('/minigolfCourses.ts'));return(await import(u)).COURSES.map(c=>c.id);});
 for(const id of courses){
  const info=await G(async(g,id)=>{
   const u=performance.getEntriesByType('resource').map(e=>e.name).find(n=>n.includes('/minigolfCourses.ts'));
   const c=(await import(u)).COURSES.find(c=>c.id===id);g.match.courses[0]=c;g.match.courseIndex=0;g.match.spawn();g.match.phase='playing';g.courseIndex=-1;g.syncCourse();g.step(.001);
   // step is paused: explicitly draw production presentation without advancing rules.
   g.visuals.update(g.players,c,2,[],.016);g.updateCharacters(.016);g.hud.update(g.match,0);g.scene.render();g.scene.render();
   const camera=g.scene.activeCamera,e=g.engine,V=g.players.length&&g.scene.activeCamera.position.constructor,M=g.scene.getTransformMatrix().constructor,vp=camera.viewport.toGlobal(e.getRenderWidth(),e.getRenderHeight());
   const project=p=>{const v=V.Project(new V(p.x,p.y,p.z),M.Identity(),g.scene.getTransformMatrix(),vp);return{x:v.x/vp.width,y:v.y/vp.height};};
   return{id,balls:g.players.map(p=>project(p.ball)),hole:project({...c.hole,y:c.holeY}),models:[...g.entities.values()].map(e=>e.goblinDebug()?.state??'procedural'),meshes:g.scene.meshes.length};
  },id);
  assert.ok(info.balls.every(p=>p.x>.05&&p.x<.95&&p.y>.23&&p.y<.86));assert.ok(info.hole.y>.22&&info.hole.y<.86);report.courses.push(info);
  await page.screenshot({path:`${out}/course-${id}-1280x720.png`});console.log(`PASS visual ${id}`);
 }
 for(const [width,height] of [[1280,720],[1366,768],[1920,1080],[800,600]]){
  await page.setViewport({width,height});await sleep(350);
  const data=await G(g=>{g.engine.resize();g.fitCamera();g.scene.render();return{width:g.engine.getRenderWidth(),height:g.engine.getRenderHeight(),rows:g.players.map(p=>{const m=g.hud.adt.getControlByName(`golfPlayer:${p.id}`)._currentMeasure;return{x:m.left,w:m.width};})};});
  assert.ok(data.rows.every(r=>r.x>=0&&r.x+r.w<=data.width+1));report.resolutions.push({width,height,...data});await page.screenshot({path:`${out}/five-${width}x${height}.png`});
 }
 await page.setViewport({width:1280,height:720});
 await G(async(g,ids)=>{const u=performance.getEntriesByType('resource').map(e=>e.name).find(n=>n.includes('/minigolfCourses.ts')),C=(await import(u)).COURSES;
  g.match=new g.match.constructor(g.ctx.players,()=>g.ctx.rng.next(),ids.map(id=>C.find(c=>c.id===id)));g.courseIndex=-1;g.syncCourse();for(const p of g.players)p.bot=true;
  g.engine.resize();g.fitCamera();g.paused=false;
 },originalCourses);
 await until(()=>G(g=>g.phase==='playing'),12000,'performance in active play');await sleep(1000);
 await G(g=>{window.__golfFrames=[];const obs=g.scene.onAfterRenderObservable.add(()=>window.__golfFrames.push(performance.now()));
  window.__golfPerfStop=()=>{g.scene.onAfterRenderObservable.remove(obs);const a=window.__golfFrames;return{frames:a.length,fps:(a.length-1)*1000/(a.at(-1)-a[0]),engine:g.engine.getFps(),meshes:g.scene.meshes.length,renderer:g.engine.getGlInfo().renderer};};
 });
 await sleep(6000);report.performance=await page.evaluate(()=>window.__golfPerfStop());
 // Natural three-hole match via bot commands, accelerated simulation, no finish override.
 await G(g=>{for(const p of g.players)p.bot=true;});
 let data;for(let i=0;i<220;i++){
  data=await G(g=>{for(let n=0;n<50&&!g.resultsSent;n++)g.step(.02);return{ended:g.resultsSent,phase:g.phase,course:g.match.courseIndex,stats:g.players.map(p=>({id:p.id,total:p.total,completed:p.completed,records:p.records}))};});
  if(data.ended)break;await sleep(30);
 }
 assert.ok(data.ended);assert.ok(data.stats.every(p=>p.records.length===3));report.round=data;
 await until(async()=>['ROUND_RESULTS','MATCH_END'].includes((await hostSnapshot(page)).phase),15000,'natural results');assert.equal(await hostEval(page,gm=>gm.state.lastResults.results.length),5);
 await hostEval(page,gm=>gm.restartMatch());await until(async()=>(await hostSnapshot(page)).phase==='LOBBY',15000,'lobby');assert.equal(await page.evaluate(()=>document.querySelectorAll('canvas').length),1);assert.deepEqual(report.errors,[]);
 writeFileSync(`${out}/browser.json`,JSON.stringify(report,null,2));console.log('PASS five players mixed Xbox/DS/generic/phone, cancel/hold/release, pause/disconnect/rejoin, six courses, four resolutions, natural results and cleanup.');
}finally{writeFileSync(`${out}/browser-progress.json`,JSON.stringify(report,null,2));await browser.close();}
