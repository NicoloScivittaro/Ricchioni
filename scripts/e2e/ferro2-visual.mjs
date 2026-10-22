import assert from'node:assert/strict';
import{writeFileSync}from'node:fs';
import{launch,sleep}from'./lib.mjs';
process.env.GOBLIN_GPU='1';process.env.VIEWPORT='1920x1080';
const out='docs/agent-work/ferro-2',result={errors:[],maps:[]},browser=await launch();
try{
 const page=await browser.newPage();page.on('pageerror',e=>result.errors.push(e.message));
 for(const map of (process.env.FERRO_MAPS??'hell,geonosis').split(',')){
  await page.goto(`http://localhost:5191/tools/ferro/preview.html?humans=5&mode=combat&map=${map}`);await page.waitForFunction(()=>window.ready,{timeout:120000});await page.waitForFunction(()=>window.fixture.frames>=90,{timeout:30000});
  const sample=await page.evaluate(async()=>{const f=window.fixture,d=f.display,gl=d.engine._gl,ext=gl.getExtension('WEBGL_debug_renderer_info');f.reset();const first=f.frames,start=performance.now();await new Promise(resolve=>{function tick(t){if(t-start<6000)requestAnimationFrame(tick);else resolve();}requestAnimationFrame(tick);});const elapsed=performance.now()-start,mean=k=>f.costs.reduce((n,c)=>n+c[k],0)/f.costs.length;return{map:f.match.state.mapId,sampledFps:(f.frames-first)*1000/elapsed,seconds:elapsed/1000,gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):null,...d.stats(),simulationMs:mean('simulation'),presentationMs:mean('presentation'),renderMs:mean('render'),alive:f.match.state.warriors.filter(p=>p.alive).length};});
  assert.equal(sample.views,5);assert.equal(sample.alive,5);result.maps.push(sample);console.log(JSON.stringify(sample));
  await page.evaluate(()=>{const f=window.fixture;f.stop();f.display.update(f.match.state,.01);f.display.render();});await page.screenshot({path:`${out}/${map}-five.png`});
  await page.evaluate(()=>{const d=window.fixture.display;d.root.style.display='none';d.overview.beta=window.fixture.match.state.mapId==='geonosis'?.28:.78;d.overview.alpha=-1.1;d.scene.activeCameras=[d.overview];d.render();});await page.screenshot({path:`${out}/${map}-arena.png`});
 }
 // Same scene: verify every imported weapon and model variation is actually equipped.
 result.models=await page.evaluate(async()=>{const f=window.fixture,d=f.display,s=f.match.state,p=s.warriors[0],items=[];for(const weapon of ['sword','shield','spear','bow','blades','hammer','axe'])for(let variant=0;variant<(weapon==='sword'?4:weapon==='shield'?2:1);variant++){Object.assign(p,{weapon,variant,action:null,charge:weapon==='bow'?.8:0,bowPhase:weapon==='bow'?'hold':'idle',guard:true});d.update(s,.1);const actor=d.actors.get(p.id);items.push({weapon,variant,meshes:actor.root.getChildMeshes().filter(m=>m.name.startsWith('ferro-model:')).length});}await d.scene.whenReadyAsync();return items;});assert.ok(result.models.every(m=>m.meshes>0));
 // Compact duel frame with the three-way HUD, actual models and lock target.
 await page.goto('http://localhost:5191/tools/ferro/preview.html?humans=2');await page.waitForFunction(()=>window.ready,{timeout:120000});
 await page.evaluate(()=>{const f=window.fixture;f.stop();const s=f.match.state;s.phase='fight';s.warriors.forEach((p,i)=>Object.assign(p,{alive:i<2,eligible:i<2,hp:100}));Object.assign(s.warriors[0],{x:0,z:0,yaw:0,weapon:'sword',variant:2,guard:true,target:s.warriors[1].id,guardDirection:'right'});Object.assign(s.warriors[1],{x:0,z:2.6,yaw:Math.PI,weapon:'shield',variant:0,guard:false,action:{kind:'heavy',age:.25,combo:0,yaw:Math.PI,direction:'left',serial:50,hits:[]}});f.display.update(s,.1);f.display.render();});await page.screenshot({path:out+'/guard-duel.png'});
 await page.evaluate(async()=>{const f=window.fixture,s=f.match.state,p=s.warriors[0];Object.assign(p,{weapon:'bow',charge:1,bowPhase:'hold',bowAge:0,target:null,guard:true});s.warriors[1].action=null;f.display.update(s,.1);await f.display.scene.whenReadyAsync();f.display.render();});await page.screenshot({path:out+'/bow-duel.png'});
 assert.deepEqual(result.errors,[]);result.status='passed';
}catch(e){result.failure=String(e);console.error(e);process.exitCode=1;}finally{await browser.close();writeFileSync(out+'/visual.json',JSON.stringify(result,null,2));}
