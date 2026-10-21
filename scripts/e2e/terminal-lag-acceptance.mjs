import {launch,sleep} from './lib.mjs';import {writeFileSync} from 'node:fs';import assert from 'node:assert/strict';
process.env.GOBLIN_GPU='1';process.env.VIEWPORT='1920x1080';const out='docs/agent-work/terminal-lag',b=await launch(),report={errors:[]};
try{const p=await b.newPage();p.on('pageerror',e=>report.errors.push(e.message));p.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});await p.goto('http://localhost:5191/docs/agent-work/terminal-lag/live.html?quality=high');await p.waitForFunction(()=>window.ready===true,{timeout:180000});await sleep(4000);
report.paired=await p.evaluate(async()=>{
 const layouts=await(await fetch('/assets/fps/terminal/atlas.json')).json(),materials=g.scene.materials.filter(m=>m.getClassName()==='ShaderMaterial'&&m.name.startsWith('terminal'));
 const optimized=g.scene.getActiveMeshCandidates,base=()=>g.scene.selectionOctree.select(g.scene.frustumPlanes);
 const rects=materials.map(m=>{const l=layouts[Number(m.name.split('-').at(-1))],grid=l.grid??1,stride=(l.size??1)+l.padding*2,size=l.size??1;const values=l.rects??Array.from({length:64},(_,i)=>[(i%grid+l.padding/stride)/grid,(Math.floor(i/grid)+l.padding/stride)/grid,size/stride/grid,size/stride/grid]);return Array.from({length:64},(_,i)=>values[i]??[0,0,0,0]).flat();});
 window.mode=enabled=>{g.scene.getActiveMeshCandidates=enabled?optimized:base;materials.forEach((m,i)=>{if(enabled)delete m._vectors4Arrays.tileRects;else m.setArray4('tileRects',rects[i]);});};
 const results=[];
 for(const enabled of [false,true,false,true]){
  mode(enabled);await new Promise(r=>setTimeout(r,500));const frame=[],render=[],draws=[];let previous=performance.now(),uploads=0,candidates=0;
  const select=g.scene.getActiveMeshCandidates;g.scene.getActiveMeshCandidates=()=>{const a=select();candidates+=a.length;return a;};
  const gl=g.engine._gl,uniform=gl.uniform4fv;gl.uniform4fv=function(...args){uploads++;return uniform.apply(this,args);};
  const original=g.scene.render;g.scene.render=function(...args){const t=performance.now();try{return original.apply(this,args);}finally{render.push(performance.now()-t);}};
  const observer=g.scene.onAfterRenderObservable.add(()=>{const t=performance.now();frame.push(t-previous);previous=t;draws.push(g.engine._drawCalls.current);});
  await new Promise(r=>setTimeout(r,3500));g.scene.onAfterRenderObservable.remove(observer);g.scene.render=original;gl.uniform4fv=uniform;g.scene.getActiveMeshCandidates=select;
  const mean=a=>a.reduce((s,n)=>s+n,0)/a.length;results.push({optimized:enabled,fps:1000/mean(frame),renderMs:mean(render),draws:mean(draws),uniform4UploadsPerFrame:uploads/frame.length,candidatesPerFrame:candidates/frame.length});
 }
 mode(true);return{samples:results,width:g.engine.getRenderWidth(),height:g.engine.getRenderHeight(),scale:g.engine.getHardwareScalingLevel(),views:g.cams.length,renderer:g.engine.getGlInfo()};
});
// Verify visibility equivalence while turning all cameras: no geometry, model,
// or effect can disappear merely because it was filtered before evaluation.
report.visibility=await p.evaluate(()=>{const result=[];g.setPaused(true);for(let turn=0;turn<4;turn++){snaps.forEach(s=>s.yaw+=Math.PI/2);g.update(0,snaps);mode(false);g.scene.render();const before=g.cams.map(c=>new Set(c.camera.getActiveMeshes().data.slice(0,c.camera.getActiveMeshes().length).map(m=>m.uniqueId)));mode(true);g.scene.render();const after=g.cams.map(c=>new Set(c.camera.getActiveMeshes().data.slice(0,c.camera.getActiveMeshes().length).map(m=>m.uniqueId)));result.push(before.every((set,i)=>set.size===after[i].size&&[...set].every(id=>after[i].has(id))));}return result;});assert.ok(report.visibility.every(Boolean));
await p.screenshot({path:out+'/final.png'});
report.feedback=await p.evaluate(async()=>{const r={};for(const weaponId of ['mitraglia','pistola','sparapiselli','raffica','laser','bombarda']){snaps[0].weaponId=weaponId;g.update(0,snaps);r[weaponId]=await g.cams[0].vm.whenReady();g.scene.render();}snaps[0].weaponId='laser';g.update(0,snaps);await g.cams[0].vm.whenReady();snaps[0].ads=1;g.update(.016,snaps);const h=g.hud.get('p0');r.scope=h.scope.alpha>0;snaps[0].reloading=true;snaps[0].sweetFrom=.45;snaps[0].reloadFrac=.7;g.update(.016,snaps);r.reload=h.reloadBar.isVisible;g.onSignal('p0',{type:'hit',kill:false,dmg:30});g.onSignal('p0',{type:'damaged',amount:20,direction:1});g.update(.016,snaps);r.hit=h.hitmarker.alpha>0;r.damage=h.vignette.alpha>0;snaps[0].alive=false;g.update(.016,snaps);r.death=h.deathShade.alpha===1;snaps[0].alive=true;snaps[0].reloading=false;snaps[0].ads=0;g.update(.016,snaps);g.scene.render();r.respawn=h.deathShade.alpha===0;return r;});assert.ok(Object.values(report.feedback).every(Boolean));
assert.deepEqual(report.errors,[]);report.status='passed';console.log(JSON.stringify(report));
}finally{writeFileSync(out+'/acceptance.json',JSON.stringify(report,null,2));await b.close();}

