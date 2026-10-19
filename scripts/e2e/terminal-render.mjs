import assert from 'node:assert/strict';import {writeFileSync} from 'node:fs';
process.env.HOST_URL='http://localhost:5185/?quality=high';process.env.CTRL_URL='http://localhost:5185/controller.html';
const {launch,createRoomOnHost,addPhone,hostEval,sleep}=await import('./lib.mjs');
const {sceneEval,until,installMock,add,tap,trig,stick,XBOX}=await import('./padmock.mjs');
const out='docs/agent-work/terminal-2',report={},errors=[];const browser=await launch();
try{
 const {page,code}=await createRoomOnHost(browser,{targetKeyPresses:3});page.setDefaultTimeout(180000);page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('dialog',d=>d.accept());
 await page.evaluate(()=>performance.setResourceTimingBufferSize(10000));
 const phones=[];for(let i=0;i<5;i++)phones.push(await addPhone(browser,code,'TERMINAL '+(i+1),i));
 const ids=await hostEval(page,gm=>gm.state.players.map(p=>p.id));await installMock(page,5);for(let i=0;i<5;i++)await add(page,i,XBOX);await sleep(400);
 for(let i=0;i<5;i++){await page.evaluate(id=>window.__pads.setTarget(id),ids[i]);await tap(page,i,'A',150);}await page.evaluate(()=>window.__pads.setTarget(null));
 await hostEval(page,gm=>{gm.selectMinigame('fps');gm.startGame();});await until(()=>hostEval(page,gm=>gm.state.phase==='MINIGAME_ROULETTE'),15000,'roulette');await hostEval(page,gm=>gm.skip());
 await until(()=>hostEval(page,gm=>gm.state.phase==='MINIGAME_MAP_VOTE'),15000,'map ballot');report.maps=await hostEval(page,gm=>gm.state.mapVote.options.map(m=>m.id));assert.deepEqual(report.maps,['cantiere','nuketown','terminal']);
 for(const phone of phones){await phone.page.waitForSelector('[data-map-id="terminal"]');await phone.page.click('[data-map-id="terminal"]');}
 const G=(fn,arg)=>sceneEval(page,'fps',fn,arg);
 await until(()=>G(g=>g.roundReady&&g.controlsDone&&g.worldReady&&g.splitScreen?.cams.length===5),180000,'Terminal ready');
 report.load=await G(g=>g.splitScreen.scene.metadata.terminal);console.log('LOAD '+JSON.stringify(report.load));
 await G(g=>{g.controlsDone=false;});
 report.spawn=await G(g=>g.players.map(p=>({x:p.x,y:p.y,z:p.z,clear:g.nuketown.isClear(p.x,p.z,.28,p.y),floor:g.nuketown.floorAt(p.x,p.z,p.y)})));assert.ok(report.spawn.every(p=>p.clear&&p.y===p.floor));
 const previous=JSON.parse(await (await import('node:fs/promises')).readFile(out+'/initial-browser-checks.json','utf8'));
 await G((g,old)=>{window.__terminalAnchors=old.geometry.anchors;window.__terminalPairs={clear:old.geometry.clear,covered:old.geometry.covered};},previous);
 report.alignment=await G(async g=>{
  const transformed=await(await fetch('/src/minigames/fps/BabylonFpsGame.ts')).text();
  const url=transformed.match(/from "([^"]*\/@babylonjs_core\.js[^"]*)"/)?.[1]??performance.getEntriesByType('resource').map(e=>e.name).find(n=>n.includes('/@babylonjs_core.js'));
  const {Ray,Vector3}=await import(url),scene=g.splitScreen.scene,a=g.nuketown;
  const samples=[...a.spawns,window.__terminalAnchors.plane,window.__terminalAnchors.inside];
  const checks=samples.map(p=>{const ray=new Ray(new Vector3(p.x,p.y+.23,p.z),new Vector3(0,-1,0),.6);const hit=scene.pickWithRay(ray,m=>m.name.startsWith('terminalBatch:')||m.name.startsWith('terminalInstances:'));return{p,hit:!!hit?.hit,y:hit?.pickedPoint?.y,error:hit?.pickedPoint?Math.abs(hit.pickedPoint.y-p.y):null};});
  return checks;
 });console.log('ALIGNMENT '+JSON.stringify(report.alignment));assert.ok(report.alignment.every(c=>c.hit&&c.error<.08));
 // One screenshot per requested view. Temporarily use the existing first camera.
 await G(g=>{const r=g.splitScreen;r.setPaused(true);window.__terminalCameras=r.scene.activeCameras.slice();window.__terminalViewport=r.cams[0].camera.viewport.clone();r.scene.activeCameras=[r.cams[0].camera];r.cams[0].camera.viewport.x=0;r.cams[0].camera.viewport.y=0;r.cams[0].camera.viewport.width=1;r.cams[0].camera.viewport.height=1;});
 for(const mode of ['overall','interior','plane']){
  await G((g,mode)=>{const r=g.splitScreen,c=r.cams[0].camera,anchors=window.__terminalAnchors;c.layerMask=0x7fff;c.fov=.95;let eye,target;
   if(mode==='overall'){window.__terminalLOD=[];for(const m of r.scene.meshes){for(const l of m.getLODLevels?.().slice()??[]){window.__terminalLOD.push([m,l.distance,l.mesh]);m.removeLODLevel(l.mesh);}}eye=[85,105,135];target=[-16,3,-1];}
   else {const p=anchors[mode==='plane'?'plane':'inside'];eye=[p.x,p.y+1.5,p.z];target=[p.x+(mode==='plane'?0:10),p.y+1.4,p.z+(mode==='plane'?-18:3)];}
   c.position.set(...eye);c.setTarget(c.position.clone().set(...target));r.scene.render();r.scene.render();
  },mode);await sleep(150);await page.screenshot({path:`${out}/${mode}.png`});if(mode==='overall')await G(g=>{for(const [m,d,l]of window.__terminalLOD)m.addLODLevel(d,l);});
 }
 await G(g=>{const r=g.splitScreen;r.scene.activeCameras=window.__terminalCameras;r.cams[0].camera.viewport=window.__terminalViewport;const index=0,avatar=(1<<5),vm=(1<<20),hud=(1<<15);r.cams[0].camera.layerMask=(0x0fffffff&~(0x1f<<20)&~(0x1f<<15)&~(0x1f<<5)&~(1<<10))|vm|hud;r.cams[0].camera.layerMask&=~avatar;r.setPaused(false);g.controlsDone=true;});
 const hip=await G(g=>g.splitScreen.cams[0].camera.fov);await trig(page,0,'LT',1);await sleep(650);report.ads=await G(g=>({value:g.players[0].ads,fov:g.splitScreen.cams[0].camera.fov}));await trig(page,0,'LT',0);assert.ok(report.ads.value>.85&&report.ads.fov<hip);
 const before=await G(g=>({...g.players[0]}));await stick(page,0,0,-1);await sleep(450);await stick(page,0,0,0);report.humanMovement=await G((g,b)=>Math.hypot(g.players[0].x-b.x,g.players[0].z-b.z),before);
 await G(g=>{g.nuketownBots.ids=new Set(g.players.map(p=>p.id));const r=g.splitScreen;r.engine.setHardwareScalingLevel(1);r.engine.setHardwareScalingLevel=()=>{};window.__terminalStart=g.players.map(p=>({id:p.id,x:p.x,y:p.y,z:p.z}));window.__terminalMatch=null;const finish=g.ctx.finish.bind(g.ctx);g.ctx.finish=res=>{window.__terminalMatch={clock:g.clock,results:res.results,players:g.players.map(p=>({id:p.id,kills:p.kills,deaths:p.deaths,shots:p.shotsFired,hit:p.shotsHit,x:p.x,y:p.y,z:p.z})),clear:g.players.every(p=>!p.alive||g.nuketown.isClear(p.x,p.z,.28,p.y))};finish(res);};});
 await sleep(2000);
 report.performance=await G(async g=>{const r=g.splitScreen,e=r.engine,s=r.scene,times=[],start=performance.now();await new Promise(resolve=>{const frame=t=>{times.push(t);if(t-start<6000)requestAnimationFrame(frame);else resolve();};requestAnimationFrame(frame);});const intervals=times.slice(1).map((t,i)=>t-times[i]).sort((a,b)=>a-b);return{fps:(times.length-1)*1000/(times.at(-1)-times[0]),p95:intervals[Math.floor(intervals.length*.95)],width:e.getRenderWidth(),height:e.getRenderHeight(),scale:e.getHardwareScalingLevel(),views:s.activeCameras.length,renderer:e.getGlInfo(),activeMeshes:s.getActiveMeshes().length,drawCalls:e._drawCalls?.current,world:s.metadata.terminal};});console.log('PERFORMANCE '+JSON.stringify(report.performance));assert.equal(report.performance.views,5);await page.screenshot({path:out+'/five-views.png'});
 await hostEval(page,gm=>gm.restartMatch());await until(()=>hostEval(page,gm=>gm.state.phase==='LOBBY'),15000,'lobby cleanup');report.cleanup=await page.evaluate(()=>document.querySelectorAll('canvas').length===1);assert.ok(report.cleanup);
 assert.deepEqual(errors,[]);
}finally{writeFileSync(out+'/final-render-checks.json',JSON.stringify({...report,errors},null,2));await browser.close();}
