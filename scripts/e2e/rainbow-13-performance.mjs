import assert from 'node:assert/strict';
import {writeFileSync,mkdirSync} from 'node:fs';
process.env.HOST_URL='http://localhost:5180/?quality=high';process.env.CTRL_URL='http://localhost:5180/controller.html';
const {launch,createRoomOnHost,addPhone,hostEval,sleep}=await import('./lib.mjs');
const {gameEval,until}=await import('./padmock.mjs');
const phase=process.env.PERF_PHASE??'arcobaleno',out=`docs/agent-work/rainbow-1-3/${process.env.R13_STAGE??'after'}`;mkdirSync(out,{recursive:true});
const browser=await launch(),errors=[],report={phase};
try{
 const {page,code}=await createRoomOnHost(browser,{targetKeyPresses:3});page.on('pageerror',e=>errors.push(e.message));
 const phones=[];for(let i=0;i<Number(process.env.PERF_HUMANS??5);i++)phones.push(await addPhone(browser,code,'PERF '+i,i));
 await page.evaluate(id=>window.__trackVariant=id,phase);
 await hostEval(page,gm=>{gm.selectMinigame('kart3d',window.__trackVariant);gm.startGame();});
 const G=(fn,arg)=>gameEval(page,'kart3d',fn,arg);
 await page.evaluate(cfg=>{window.__perfNoGlow=cfg.mode==='noglow';window.__perfProfile=cfg.profile;},{mode:process.env.PERF_MODE,profile:!!process.env.PERF_PROFILE});
 await until(()=>G(g=>g.race.phase==='racing'),90000,'racing');await sleep(5000);
 await G(g=>{g.soloBots.ids=new Set([...g.karts.keys()]);if(window.__perfNoGlow)for(const layer of [...g.scene.effectLayers])layer.dispose();g.engine.setHardwareScalingLevel(1);g.engine.setHardwareScalingLevel=()=>{};
 [...g.karts.values()].forEach((k,i)=>{k.distance=g.spline.totalLength*(.035+i*.19);k.lateral=0;k.speed=35;k.absHeading=g.spline.tangentAngleAt(k.distance);k.heading=0;});});await sleep(1500);
 report.metrics=await G(async g=>{
  let shadowPasses=0;if(window.__perfProfile)for(const light of g.scene.lights){const map=light.getShadowGenerator()?.getShadowMap();map?.onBeforeRenderObservable.add(()=>shadowPasses++);}
  const draws={};if(window.__perfProfile)for(const m of g.scene.meshes)m.onBeforeDrawObservable.add(()=>{draws[m.name]=(draws[m.name]??0)+1;});
  const data={step:[],render:[]};const wrap=(o,key)=>{const f=o[key];o[key]=function(...a){const t=performance.now();try{return f.apply(this,a);}finally{data[key].push(performance.now()-t);}};};wrap(g,'step');wrap(g.scene,'render');
  const frames=[],start=performance.now();await new Promise(resolve=>{const f=t=>{frames.push(t);if(t-start<8000)requestAnimationFrame(f);else resolve();};requestAnimationFrame(f);});
  const stat=a=>{const s=a.slice().sort((a,b)=>a-b);return{mean:a.reduce((x,v)=>x+v,0)/a.length,p95:s[Math.floor(s.length*.95)]};};
  return{variant:{cosmos:g.scene.meshes.some(m=>m.name==='rainbowCosmosSky'),abilityCooldown:'abilityCooldown' in [...g.karts.values()][0]},frameTime:stat(frames.slice(1).map((t,i)=>t-frames[i])),shadowPasses,topDraws:Object.entries(draws).sort((a,b)=>b[1]-a[1]).slice(0,18),players:g.karts.size,viewports:g.scene.activeCameras.length,fps:(frames.length-1)*1000/(frames.at(-1)-frames[0]),step:stat(data.step),render:stat(data.render),meshes:g.scene.meshes.length,active:g.scene.getActiveMeshes().length,draw:g.scene.getEngine()._drawCalls.current,materials:g.scene.materials.length,scale:g.engine.getHardwareScalingLevel(),shadows:g.scene.shadowsEnabled,width:g.engine.getRenderWidth(),height:g.engine.getRenderHeight(),length:g.spline.totalLength,renderer:g.engine.getGlInfo()};
 });
 await hostEval(page,gm=>gm.restartMatch());await until(()=>hostEval(page,gm=>gm.state.phase==='LOBBY'),20000,'lobby');
 await page.evaluate(()=>localStorage.removeItem('ricchioni.hostToken'));for(const phone of phones)await phone.ctx.close();
 assert.deepEqual(errors,[]);console.log(JSON.stringify(report));
}finally{writeFileSync(`${out}/${phase}-performance.json`,JSON.stringify({...report,errors},null,2));await browser.close();}

