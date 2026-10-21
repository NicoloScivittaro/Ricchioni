import {writeFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {launch,sleep} from './lib.mjs';
process.env.GOBLIN_GPU='1';
const stage=process.env.STAGE||'before',views=Number(process.env.VIEWS||5),out='docs/agent-work/litorale-lag';mkdirSync(out,{recursive:true});
const browser=await launch(),report={stage,views,errors:[]};
try {
 const p=await browser.newPage();p.on('pageerror',e=>report.errors.push(e.message));
 await p.goto(`http://localhost:5191/docs/agent-work/litorale-lag/live.html?quality=high&views=${views}`);
 await p.waitForFunction(()=>window.ready===true,{timeout:120000});
 report.drivers=await p.evaluate(()=>[...g.entities.values()].map(e=>({imported:!!e.goblinDriver,ready:e.goblinDriver?.ready,failed:e.goblinDriver?.failed})));
 report.loading=await p.evaluate(()=>({ms:window.loadMs,controls:window.controls,wheelPasses:g.scene.meshes.filter(m=>m.name==='kartWheel').map(m=>m.subMeshes.length)}));
 await sleep(6000);await p.evaluate(()=>resetPose());await sleep(1800);
 const profiler=process.env.PROFILE==='1'?await p.createCDPSession():null;
 if(profiler){await profiler.send('Profiler.enable');await profiler.send('Profiler.start');}
 report.metrics=await p.evaluate(async()=>{
  const samples={render:[],step:[],frame:[],draws:[]}, originals=[];
  for(const [obj,key] of [[g,'step'],[g.scene,'render']]){const fn=obj[key];originals.push(()=>obj[key]=fn);obj[key]=function(...args){const start=performance.now();try{return fn.apply(this,args);}finally{samples[key].push(performance.now()-start);}};}
  let prev=performance.now();const o=g.scene.onAfterRenderObservable.add(()=>{const now=performance.now();samples.frame.push(now-prev);prev=now;samples.draws.push(g.engine._drawCalls.current);});
  await new Promise(r=>setTimeout(r,6000));g.scene.onAfterRenderObservable.remove(o);originals.forEach(f=>f());
  const stat=a=>{const s=a.slice().sort((a,b)=>a-b);return{mean:a.reduce((x,y)=>x+y,0)/a.length,p95:s[Math.min(s.length-1,Math.floor(s.length*.95))]};};
  return{fps:1000/stat(samples.frame).mean,frame:stat(samples.frame),render:stat(samples.render),step:stat(samples.step),draws:stat(samples.draws),meshes:g.scene.meshes.length,vertices:g.scene.meshes.reduce((n,m)=>n+m.getTotalVertices(),0),top:g.scene.meshes.map(m=>({name:m.name,vertices:m.getTotalVertices(),submeshes:m.subMeshes?.length,thin:m.thinInstanceCount||0})).sort((a,b)=>b.vertices-a.vertices).slice(0,14),scale:g.engine.getHardwareScalingLevel(),width:g.engine.getRenderWidth(),height:g.engine.getRenderHeight(),cameras:g.scene.activeCameras.length,renderer:g.engine.getGlInfo()};
 });
 if(profiler){const {profile}=await profiler.send('Profiler.stop');const total=profile.nodes.reduce((n,x)=>n+(x.hitCount||0),0);report.cpu=profile.nodes.map(n=>({fn:n.callFrame.functionName,url:n.callFrame.url.split('/').at(-1),hits:n.hitCount||0,share:(n.hitCount||0)/total})).sort((a,b)=>b.hits-a.hits).slice(0,25);}
 await p.screenshot({path:`${out}/${stage}-${views}.png`});
 // Diagnostic only: short fixed-scene samples isolate geometry vs GUI, water and imported drivers.
 if(process.env.DIAG==='1')report.diagnostics=await p.evaluate(async()=>{
  const originalStep=g.step;g.step=()=>{};
  const sample=async()=>{const times=[];let prev=performance.now();const o=g.scene.onAfterRenderObservable.add(()=>{const now=performance.now();times.push(now-prev);prev=now;});await new Promise(r=>setTimeout(r,1800));g.scene.onAfterRenderObservable.remove(o);return 1000/(times.reduce((x,y)=>x+y,0)/times.length);};
  const results={};results.base=await sample();
  const test=async(name,meshes)=>{const state=meshes.map(m=>m.isEnabled());meshes.forEach(m=>m.setEnabled(false));await new Promise(r=>setTimeout(r,300));results[name]=await sample();meshes.forEach((m,i)=>m.setEnabled(state[i]));await new Promise(r=>setTimeout(r,300));};
  await test('withoutCoastalDetails',g.scene.meshes.filter(m=>m.name==='coastalDetailBatch'));
  await test('withoutSea',g.scene.meshes.filter(m=>m.name==='sea'));
  const sh=g.scene.shadowsEnabled;g.scene.shadowsEnabled=false;results.withoutShadows=await sample();g.scene.shadowsEnabled=sh;
  const tx=g.scene.textures.filter(t=>t.getClassName()==='AdvancedDynamicTexture');const fg=tx.map(t=>t.layer?.isEnabled);tx.forEach(t=>{if(t.layer)t.layer.isEnabled=false;});results.withoutHud=await sample();tx.forEach((t,i)=>{if(t.layer)t.layer.isEnabled=fg[i];});
  g.step=originalStep;return results;
 });
 assert.deepEqual(report.errors,[]);console.log(JSON.stringify(report));
}finally{writeFileSync(`${out}/${stage}-${views}.json`,JSON.stringify(report,null,2));await browser.close();}
