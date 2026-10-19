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
 report.geometry=await G(g=>{
  const a=g.nuketown,nav=a.nav;const levels=[Math.min(...nav.map(p=>p.y)),Math.max(...nav.map(p=>p.y))];
  const lower=nav.find(p=>p.y<1.4&&p.x>0&&p.z<-35),plane=nav.filter(p=>p.x>-44&&p.x<-35&&p.z>-66&&p.z<-30&&p.y>4.9&&p.y<5.3).sort((p,q)=>Math.hypot(p.x+39.4,p.z+50)-Math.hypot(q.x+39.4,q.z+50))[0],inside=nav.filter(p=>p.z>0&&p.z<15&&p.y>4.5).sort((p,q)=>Math.abs(p.x+25)-Math.abs(q.x+25))[0];
  // One real multilevel route, authoritative movement along its graph (no warp).
  const start=a.closest(lower),goal=a.closest(plane),data=a.data,parent=new Int32Array(nav.length).fill(-1),queue=[start];parent[start]=start;
  for(let n=0;n<queue.length&&parent[goal]<0;n++)for(const v of data.edges[queue[n]])if(parent[v]<0){parent[v]=queue[n];queue.push(v);}
  const path=[];for(let v=goal;v!==start&&v>=0;v=parent[v])path.push(v);path.push(start);path.reverse();
  let p={...nav[start]},fail=0,up=0;for(const v of path.slice(1)){const q=nav[v],m=a.move(p,q);if(Math.hypot(m.x-q.x,m.z-q.z)>.06||Math.abs(m.y-q.y)>.03)fail++;if(q.y-p.y>.05)up++;p=m;}
  // Find a visible adjacent corridor and a real architectural cover at eye height.
  let clear=null,covered=null;for(let i=0;i<nav.length&&(!clear||!covered);i+=83){const p=nav[i];for(const q of nav.filter((_,j)=>j%127===0)){const d=Math.hypot(p.x-q.x,p.z-q.z);if(d<2.5||d>7||Math.abs(p.y-q.y)>.1)continue;const visible=a.visible(p,q);if(visible&&!clear)clear=[p,q];if(!visible&&!covered){const m=a.move(p,q);if(Math.hypot(m.x-q.x,m.z-q.z)>.5)covered=[p,q];}if(clear&&covered)break;}}
  window.__terminalPairs={clear,covered};window.__terminalAnchors={lower,plane,inside};return{levels,pathNodes:path.length,routeReachable:parent[goal]>=0,routeMovementFailures:fail,uphillSteps:up,clear,covered,anchors:window.__terminalAnchors};
 });console.log('GEOMETRY '+JSON.stringify(report.geometry));assert.ok(report.geometry.routeReachable&&report.geometry.uphillSteps>0);assert.equal(report.geometry.routeMovementFailures,0);assert.ok(report.geometry.clear&&report.geometry.covered);
 report.combat=await G(async g=>{
  const {getWeapon}=await import('/shared/fpsWeapons.ts');const[a,b,...rest]=g.players;const saved=g.players.map(p=>({...p}));for(const p of rest){p.alive=false;p.respawnTimer=1000;}
  const shot=(pair)=>{Object.assign(a,pair[0],{alive:true,spawnProtection:0,weaponId:'laser',magazine:5,reloading:false,ads:1,recoilPitch:0,recoilYaw:0,heat:0,hp:100});Object.assign(b,pair[1],{alive:true,hp:100,spawnProtection:0,guardTime:0,debtTime:0,armTime:0});a.yaw=Math.atan2(b.x-a.x,b.z-a.z);a.pitch=0;g.fireShot(a,getWeapon('laser'));return b.hp;};
  const coveredHp=shot(window.__terminalPairs.covered),exposedHp=shot(window.__terminalPairs.clear);a.spawnProtection=1.5;g.fireShot(a,getWeapon('mitraglia'));const protectionCancelled=a.spawnProtection===0;g.startReload(a,getWeapon('laser'));const reload=a.reloading;
  saved.forEach((p,i)=>Object.assign(g.players[i],p));return{coveredHp,exposedHp,protectionCancelled,reload};
 });assert.equal(report.combat.coveredHp,100);assert.ok(report.combat.exposedHp<100&&report.combat.protectionCancelled&&report.combat.reload);
 // One screenshot per requested view. Temporarily use the existing first camera.
 await G(g=>{const r=g.splitScreen;r.setPaused(true);window.__terminalCameras=r.scene.activeCameras.slice();window.__terminalViewport=r.cams[0].camera.viewport.clone();r.scene.activeCameras=[r.cams[0].camera];r.cams[0].camera.viewport.x=0;r.cams[0].camera.viewport.y=0;r.cams[0].camera.viewport.width=1;r.cams[0].camera.viewport.height=1;});
 for(const mode of ['overall','interior','plane']){
  await G((g,mode)=>{const r=g.splitScreen,c=r.cams[0].camera,anchors=window.__terminalAnchors;c.layerMask=0x7fff;c.fov=.95;let eye,target;
   if(mode==='overall'){window.__terminalLOD=[];for(const m of r.scene.meshes)for(const l of m.getLODLevels?.().slice()??[]){window.__terminalLOD.push([m,l.distance,l.mesh]);m.removeLODLevel(l.mesh);}eye=[85,105,135];target=[-16,3,-1];}
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
 await until(()=>page.evaluate(()=>!!window.__terminalMatch),125000,'normal multiplayer match');report.match=await page.evaluate(()=>window.__terminalMatch);assert.equal(report.match.results.length,5);assert.ok(report.match.clock>95&&report.match.clear);assert.ok(report.match.players.reduce((n,p)=>n+p.kills,0)>0);console.log('MATCH '+JSON.stringify(report.match));
 await hostEval(page,gm=>gm.restartMatch());await until(()=>hostEval(page,gm=>gm.state.phase==='LOBBY'),15000,'lobby cleanup');report.cleanup=await page.evaluate(()=>document.querySelectorAll('canvas').length===1);assert.ok(report.cleanup);
 // Existing maps: one quick load/dispose each through the production renderer.
 report.otherMaps=await page.evaluate(async()=>{const{BabylonFpsGame}=await import('/src/minigames/fps/BabylonFpsGame.ts');const results=[];for(const id of ['cantiere','nuketown']){const canvas=document.createElement('canvas');canvas.style.cssText='width:640px;height:360px';document.body.append(canvas);const r=new BabylonFpsGame(canvas,[{id:'smoke',name:'SMOKE',color:'#ffffff'}],id);await r.ready;r.scene.render();results.push({id,meshes:r.scene.meshes.length,loaded:id==='cantiere'||!!r.scene.metadata.nuketown});r.dispose();canvas.remove();}return results;});assert.ok(report.otherMaps.every(m=>m.loaded));assert.deepEqual(errors,[]);
}finally{writeFileSync(out+'/browser-checks.json',JSON.stringify({...report,errors},null,2));await browser.close();}
