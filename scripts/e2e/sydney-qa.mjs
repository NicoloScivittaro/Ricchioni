import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
process.env.HOST_URL='http://localhost:5180/?quality=high';process.env.CTRL_URL='http://localhost:5180/controller.html';
const {launch,createRoomOnHost,addPhone,hostEval,sleep}=await import('./lib.mjs');
const {gameEval,until}=await import('./padmock.mjs');
const out='docs/agent-work/sydney-sprint',browser=await launch(),errors=[],report={};
try{
 const {page,code}=await createRoomOnHost(browser,{targetKeyPresses:3});page.on('pageerror',e=>errors.push(e.message));
 const phones=[];for(let i=0;i<5;i++)phones.push(await addPhone(browser,code,'SYDNEY '+(i+1),i));
 for(const track of ['litorale','arcobaleno','sydney']){await hostEval(page,(gm,id)=>gm.selectMinigame('kart3d',id),track);await until(()=>hostEval(page,(gm,id)=>gm.state.selectedKartTrackId===id,track),5000,'selection '+track);}
 report.selection=['litorale','arcobaleno','sydney'];
 await hostEval(page,gm=>gm.startGame());await until(()=>hostEval(page,gm=>gm.state.phase==='MINIGAME_ROULETTE'),15000,'roulette');await hostEval(page,gm=>gm.skip());await until(()=>hostEval(page,gm=>gm.state.phase==='MINIGAME_MAP_VOTE'),15000,'vote');
 assert.deepEqual(await hostEval(page,gm=>gm.state.mapVote.options.map(m=>m.id)),report.selection);
 for(const phone of phones){await phone.page.waitForSelector('[data-map-id="sydney"]');await phone.page.click('[data-map-id="sydney"]');}
 await until(()=>hostEval(page,gm=>Object.values(gm.state.mapVote?.votes??{}).filter(v=>v==='sydney').length===5),5000,'five votes');
 report.vote={options:report.selection,votes:5};
 const G=(f,a)=>gameEval(page,'kart3d',f,a);
 await until(()=>G(g=>g.race.phase==='racing'&&!!g.sydney),90000,'Sydney race');
 report.map=await hostEval(page,gm=>({mapId:gm.pendingMinigame?.mapId,track:gm.pendingMinigame?.kartTrackId,name:gm.pendingMinigame?.name}));
 await G(g=>{g.soloBots.ids=new Set(g.karts.keys());g.engine.setHardwareScalingLevel(1);g.engine.setHardwareScalingLevel=()=>{};const survey=[1,10,23,31,42];[...g.karts.values()].forEach((k,i)=>{k.distance=g.sydney.atSurvey(survey[i]);k.lateral=0;k.speed=40;k.absHeading=g.trackAngleAt(k.distance);k.heading=0;k.flight='DRIVE';k.jumpHeight=0;});});
 await sleep(2500);
 report.performance=await G(async g=>{
  const times=[],start=performance.now();await new Promise(resolve=>{const frame=t=>{times.push(t);if(t-start<8000)requestAnimationFrame(frame);else resolve();};requestAnimationFrame(frame);});
  const ms=times.slice(1).map((t,i)=>t-times[i]).sort((a,b)=>a-b);
  return {fps:(times.length-1)*1000/(times.at(-1)-times[0]),frameP95:ms[Math.floor(ms.length*.95)],width:g.engine.getRenderWidth(),height:g.engine.getRenderHeight(),scale:g.engine.getHardwareScalingLevel(),viewports:g.scene.activeCameras.length,renderer:g.engine.getGlInfo(),meshes:g.scene.meshes.length,submeshes:g.scene.meshes.reduce((n,m)=>n+(m.subMeshes?.length??0),0),shadow:g.scene.shadowsEnabled};
 });
 assert.equal(report.performance.viewports,5);assert.equal(report.performance.width,1280);assert.equal(report.performance.height,720);assert.equal(report.performance.scale,1);
 await G(g=>{g.paused=true;});
 // Four photographs plus the actual launch. Reuse the real scene and shared materials.
 for(const [name,t,mode] of [['general',0,'overview'],['bridge',30,'landmark'],['opera',8,'landmark'],['driving',37,'kart'],['glide',15,'kart']]){
  await G((g,a)=>{
   const [name,t,mode]=a,id=g.order[0],k=g.karts.get(id),s=g.sydney.atSurvey(t),gap=g.sydney.gaps[0];
   g.cameraManager.applyLayout([id]);g.hud.layout([id]);g.hud.setCountdown('');
   const camera=g.cameraManager.rigs.get(id).camera;camera.maxZ=6000;
   Object.assign(k,{distance:s,lateral:0,speed:44,absHeading:g.trackAngleAt(s),heading:0,flight:name==='glide'?'GLIDE':'DRIVE',jumpHeight:name==='glide'?g.sydney.flightHeightAt(s):0,glideStart:gap.launch,glideEnd:gap.landing,flightTime:2,glideLanding:0});
   for(let i=0;i<100;i++){g.cameraManager.update(1/60,id,k,g.spline);g.wings.get(id).update(1/60,name==='glide',0);}
   g.present(1/60);camera.layerMask=0x000fffff;
   if(mode!=='kart'){
    camera.layerMask=0x000fffff;
    if(name==='general'){camera.position.set(-80,360,300);camera.setTarget(g.spline.positionAt(0).clone().set(-60,5,-100));}
    if(name==='bridge'){camera.position.set(45,105,-75);camera.setTarget(g.spline.positionAt(0).clone().set(-68,22,-135));}
    if(name==='opera'){camera.position.set(280,100,-20);camera.setTarget(g.spline.positionAt(0).clone().set(155,20,-120));}
   }
   g.scene.render();g.scene.render();
  },[name,t,mode]);
  await sleep(120);await page.screenshot({path:`${out}/${name}.png`});
 }
 report.geometry=await G(g=>({technicalVisible:g.scene.meshes.filter(m=>m.name.includes('ShadowCollision')).some(m=>m.isEnabled()),roads:g.scene.meshes.filter(m=>m.name.startsWith('N_Road')).length,accessRamps:g.scene.meshes.filter(m=>m.name==='sydneyStairAccessRamp').length,waterBlue:g.scene.meshes.filter(m=>m.name.includes('Sea01')).every(m=>!m.useVertexColors),checkpoints:g.checkpoints,boxes:g.sydney.boxes.length}));
 assert.equal(report.geometry.technicalVisible,false);assert.equal(report.geometry.accessRamps,2);assert.equal(report.geometry.waterBlue,true);assert.deepEqual(errors,[]);
 await hostEval(page,gm=>gm.restartMatch());await until(()=>hostEval(page,gm=>gm.state.phase==='LOBBY'),15000,'cleanup');
 await page.evaluate(()=>localStorage.removeItem('ricchioni.hostToken'));for(const phone of phones)await phone.ctx.close();
 console.log(JSON.stringify(report));
}finally{writeFileSync(out+'/browser-checks.json',JSON.stringify({...report,errors},null,2));await browser.close();}
