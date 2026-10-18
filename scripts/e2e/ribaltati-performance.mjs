import assert from 'node:assert/strict';
import {writeFileSync,mkdirSync} from 'node:fs';
process.env.HOST_URL='http://localhost:5178/?quality=high';process.env.CTRL_URL='http://localhost:5178/controller.html';
const {launch,createRoomOnHost,addPhone,hostEval,sleep}=await import('./lib.mjs');
const {gameEval,until}=await import('./padmock.mjs');
const phase=process.env.PERF_PHASE??'before',out='docs/agent-work/ribaltati-2';mkdirSync(out,{recursive:true});
const browser=await launch(),errors=[],report={phase};
try{
 const {page,code}=await createRoomOnHost(browser,{targetKeyPresses:3});page.on('pageerror',e=>errors.push(e.message));
 const phones=[];for(let i=0;i<Number(process.env.PERF_HUMANS??5);i++)phones.push(await addPhone(browser,code,'PERF '+i,i));
 await hostEval(page,gm=>{gm.selectMinigame('kart3d');gm.startGame();});
 const G=(fn,arg)=>gameEval(page,'kart3d',fn,arg);
 await until(()=>G(g=>g.race.phase==='racing'),90000,'racing');await sleep(5000);
 await G(g=>{g.soloBots.ids=new Set([...g.karts.keys()]);g.engine.setHardwareScalingLevel(1);g.engine.setHardwareScalingLevel=()=>{};
 [...g.karts.values()].forEach((k,i)=>{k.distance=g.spline.totalLength*(.035+i*.19);k.lateral=0;k.speed=35;k.absHeading=g.spline.tangentAngleAt(k.distance);k.heading=0;});});await sleep(1500);
 report.metrics=await G(async g=>{
  const data={step:[],render:[]};const wrap=(o,key)=>{const f=o[key];o[key]=function(...a){const t=performance.now();try{return f.apply(this,a);}finally{data[key].push(performance.now()-t);}};};wrap(g,'step');wrap(g.scene,'render');
  const frames=[],start=performance.now();await new Promise(resolve=>{const f=t=>{frames.push(t);if(t-start<8000)requestAnimationFrame(f);else resolve();};requestAnimationFrame(f);});
  const stat=a=>{const s=a.slice().sort((a,b)=>a-b);return{mean:a.reduce((x,v)=>x+v,0)/a.length,p95:s[Math.floor(s.length*.95)]};};
  return{players:g.karts.size,viewports:g.scene.activeCameras.length,fps:(frames.length-1)*1000/(frames.at(-1)-frames[0]),step:stat(data.step),render:stat(data.render),meshes:g.scene.meshes.length,active:g.scene.getActiveMeshes().length,draw:g.scene.getEngine()._drawCalls.current,materials:g.scene.materials.length,scale:g.engine.getHardwareScalingLevel(),shadows:g.scene.shadowsEnabled,width:g.engine.getRenderWidth(),height:g.engine.getRenderHeight(),length:g.spline.totalLength,renderer:g.engine.getGlInfo()};
 });
 await page.screenshot({path:`${out}/${phase}-5view.png`});
 await G(g=>{g.paused=true;const id=g.order[0];g.cameraManager.applyLayout([id]);g.hud.layout([id]);const k=g.karts.get(id);k.distance=g.spline.totalLength*.035;k.lateral=0;k.heading=0;k.jumpHeight=0;g.entities.get(id).updateVisual(k,g.spline);g.hud.update(id,k,5,3,[.55,1.2,2.1],0);g.hud.setSector?.(id,'LUNGOMARE · BELVEDERE',0);g.hud.flash(id,'','#fff',0);g.hud.updateMinimap([...g.karts.values()],g.spline);for(let i=0;i<120;i++)g.cameraManager.update(1/60,id,k,g.spline);g.scene.render();});
 await page.screenshot({path:`${out}/${phase}-start.png`});
 await hostEval(page,gm=>gm.restartMatch());await until(()=>hostEval(page,gm=>gm.state.phase==='LOBBY'),20000,'lobby');assert.equal(await page.evaluate(()=>document.querySelectorAll('canvas').length),1);assert.deepEqual(errors,[]);console.log(JSON.stringify(report));
}finally{writeFileSync(`${out}/${phase}-performance.json`,JSON.stringify({...report,errors},null,2));await browser.close();}
