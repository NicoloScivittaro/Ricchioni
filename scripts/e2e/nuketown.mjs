import assert from 'node:assert/strict';
import{writeFileSync}from'node:fs';
process.env.HOST_URL='http://localhost:5180/?quality=high';process.env.CTRL_URL='http://localhost:5180/controller.html';
const{launch,createRoomOnHost,addPhone,hostEval,sleep}=await import('./lib.mjs');
const{sceneEval,until,installMock,add,tap,trig,stick,XBOX,DS}=await import('./padmock.mjs');
const browser=await launch(),out='docs/agent-work/nuketown',report={},errors=[],renderOnly=process.env.NUKE_RENDER_ONLY==='1';
try{
  const{page,code}=await createRoomOnHost(browser,{targetKeyPresses:3});page.on('dialog',d=>d.accept());page.on('pageerror',e=>errors.push(e.message));
  const assets=[];page.on('response',r=>{if(r.url().endsWith('.glb'))assets.push(r.url());});
  const phones=[];for(let i=0;i<5;i++)phones.push(await addPhone(browser,code,'NUKE '+(i+1),i));
  assert.ok(!assets.some(a=>a.includes('nuketown')));
  const ids=await hostEval(page,gm=>gm.state.players.map(p=>p.id));
  await installMock(page,5);for(let i=0;i<5;i++)await add(page,i,i%2?DS:XBOX);await sleep(500);
  for(let i=0;i<5;i++){await page.evaluate(id=>window.__pads.setTarget(id),ids[i]);await tap(page,i,'A',150);}
  await page.evaluate(()=>window.__pads.setTarget(null));
  await hostEval(page,gm=>{gm.selectMinigame('fps');gm.startGame();});
  await until(()=>hostEval(page,gm=>gm.state.phase==='MINIGAME_ROULETTE'),15000,'roulette');await hostEval(page,gm=>gm.skip());
  await until(()=>hostEval(page,gm=>gm.state.phase==='MINIGAME_MAP_VOTE'),15000,'map ballot');
  report.maps=await hostEval(page,gm=>gm.state.mapVote.options.map(m=>m.id));assert.deepEqual(report.maps,['cantiere','nuketown']);
  for(const phone of phones){await phone.page.waitForSelector('[data-map-id="nuketown"]');await phone.page.click('[data-map-id="nuketown"]');}
  await until(()=>hostEval(page,gm=>Object.values(gm.state.mapVote?.votes??{}).filter(v=>v==='nuketown').length===5),6000,'five votes');report.votes=5;
  const G=(fn,arg)=>sceneEval(page,'fps',fn,arg);
  await until(()=>G(g=>g.roundReady&&g.controlsDone&&g.worldReady&&g.splitScreen?.cams.length===5),100000,'Nuketown 5 cameras ready');
  report.phoneCompanions=await Promise.all(phones.map(ph=>ph.page.evaluate(()=>({canvas:document.querySelectorAll('canvas').length,text:document.getElementById('app')?.innerText.slice(0,150)}))));
  // Paired pads intentionally use companion cards. Also exercise the real phone
  // FPS renderer separately without adding five extra GPU scenes to the sample.
  report.phoneScene=await phones[0].page.evaluate(async()=>{
    const{FpsClient}=await import('/src/controller/fpsClient.ts');
    const container=document.createElement('div');container.style.cssText='position:fixed;inset:0';document.body.append(container);
    const client=new FpsClient(container,'phone-probe',()=>{},()=>null,'nuketown');
    const start=performance.now();while(!client.scene.metadata?.nuketown&&performance.now()-start<30000)await new Promise(r=>setTimeout(r,100));
    const info=client.scene.metadata?.nuketown??null;client.dispose();container.remove();return info;
  });assert.equal(report.phoneScene?.sourceMeshes,1374);
  report.spawns=await G(g=>g.players.map(p=>({x:p.x,y:p.y,z:p.z,clear:g.nuketown.isClear(p.x,p.z)})));assert.ok(report.spawns.every(p=>p.clear));
  if(!renderOnly){
  report.combat=await G(async g=>{
    const{getWeapon}=await import('/shared/fpsWeapons.ts');
    const[a,b,...rest]=g.players;for(const p of rest){p.alive=false;p.respawnTimer=1000;}
    for(const p of [a,b])Object.assign(p,{alive:true,hp:100,spawnProtection:0,guardTime:0,debtTime:0,armTime:0});
    const weapon=getWeapon('laser');Object.assign(a,{x:-6.5,y:.245,z:-16,yaw:Math.PI/2,pitch:0,weaponId:'laser',magazine:5,reloading:false,ads:1,recoilPitch:0,recoilYaw:0,heat:0});Object.assign(b,{x:-3.5,y:.245,z:-16});
    g.fireShot(a,weapon);const coveredHp=b.hp;
    const before={x:a.x,z:a.z};Object.assign(a,g.nuketown.move(before,{x:0,z:-16}));const wallStopped=a.x<-5.3;
    Object.assign(a,{x:-12,y:.09,z:-30,yaw:0,pitch:0,ads:1,recoilPitch:0,recoilYaw:0,heat:0,magazine:5,reloading:false});Object.assign(b,{x:-12,y:.09,z:-27,hp:100});
    g.fireShot(a,weapon);const exposedHp=b.hp;
    a.spawnProtection=1.5;g.fireShot(a,getWeapon('mitraglia'));const protectionCancelled=a.spawnProtection===0;
    g.startReload(a,weapon);const reload=a.reloading&&a.reloadTimer===weapon.reload;
    for(let i=0;i<g.players.length;i++){const p=g.players[i],s=g.nuketown.spawns[i];Object.assign(p,{...s,alive:true,hp:100,spawnProtection:1.5,respawnTimer:0,guardTime:0,wallTime:0,stunTime:0,lockTime:0,debtTime:0,armTime:0});g.equipNext(p);p.yaw=Math.atan2(-p.x,-p.z);}
    return{coveredHp,exposedHp,wallStopped,protectionCancelled,reload,ads:a.ads};
  });
  assert.equal(report.combat.coveredHp,100);assert.equal(report.combat.exposedHp,45);assert.ok(report.combat.wallStopped&&report.combat.protectionCancelled&&report.combat.reload);
  }
  const hip=await G(g=>g.splitScreen.cams[0].camera.fov);
  await trig(page,0,'LT',1);await sleep(650);
  report.ads=await G(g=>({amount:g.players[0].ads,fov:g.splitScreen.cams[0].camera.fov}));
  assert.ok(report.ads.amount>.9&&report.ads.fov<hip);await trig(page,0,'LT',0);
  const start=await G(g=>({x:g.players[0].x,z:g.players[0].z}));await stick(page,0,0,-1);await sleep(450);await stick(page,0,0,0);
  report.humanMovement=await G((g,start)=>({distance:Math.hypot(g.players[0].x-start.x,g.players[0].z-start.z),clear:g.nuketown.isClear(g.players[0].x,g.players[0].z,.699)}),start);assert.ok(report.humanMovement.distance>.2&&report.humanMovement.clear);
  await G(g=>{g.nuketownBots.ids=new Set(g.players.map(p=>p.id));g.splitScreen.engine.setHardwareScalingLevel(1);g.splitScreen.engine.setHardwareScalingLevel=()=>{};});
  await sleep(1800);
  report.performance=await G(async g=>{
    const renderer=g.splitScreen,engine=renderer.engine,scene=renderer.scene,times=[],start=performance.now();
    await new Promise(resolve=>{const frame=t=>{times.push(t);if(t-start<8000)requestAnimationFrame(frame);else resolve();};requestAnimationFrame(frame);});
    const intervals=times.slice(1).map((t,i)=>t-times[i]).sort((a,b)=>a-b);
    return{fps:(times.length-1)*1000/(times.at(-1)-times[0]),p95:intervals[Math.floor(intervals.length*.95)],width:engine.getRenderWidth(),height:engine.getRenderHeight(),scale:engine.getHardwareScalingLevel(),views:scene.activeCameras.length,renderer:engine.getGlInfo(),world:scene.metadata.nuketown,meshes:scene.meshes.length,shadows:scene.shadowsEnabled};
  });console.log('PERFORMANCE '+JSON.stringify(report.performance));
  assert.equal(report.performance.views,5);assert.equal(report.performance.scale,1);
  await page.screenshot({path:out+'/five-views.png'});
  if(!renderOnly){
  // Continue the unshortened match. No fabricated score or direct finish call.
  await G(g=>{window.__nukeEnd=null;const finish=g.ctx.finish.bind(g.ctx);g.ctx.finish=r=>{window.__nukeEnd={clock:g.clock,results:r.results,players:g.players.map(p=>({kills:p.kills,deaths:p.deaths,shots:p.shotsFired,hit:p.shotsHit,x:p.x,z:p.z})),clear:g.players.every(p=>!p.alive||g.nuketown.isClear(p.x,p.z,.699))};finish(r);};});
  await until(()=>page.evaluate(()=>!!window.__nukeEnd),125000,'complete normal match');report.match=await page.evaluate(()=>window.__nukeEnd);
  assert.equal(report.match.results.length,5);assert.ok(report.match.clock>=95);assert.ok(report.match.players.reduce((s,p)=>s+p.kills,0)>3);assert.ok(report.match.clear);
  console.log('MATCH '+JSON.stringify(report.match));
  }
  await hostEval(page,gm=>gm.restartMatch());await until(()=>hostEval(page,gm=>gm.state.phase==='LOBBY'),15000,'cleanup lobby');
  report.cleanup=await page.evaluate(()=>document.querySelectorAll('canvas').length===1);assert.ok(report.cleanup);
  assert.deepEqual(errors,[]);
}finally{writeFileSync(out+(renderOnly?'/render-checks.json':'/browser-checks.json'),JSON.stringify({...report,errors},null,2));await browser.close();}
