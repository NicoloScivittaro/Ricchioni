import assert from'node:assert/strict';
import{writeFileSync}from'node:fs';
import{launch,sleep}from'./lib.mjs';
process.env.GOBLIN_GPU='1';process.env.VIEWPORT='1920x1080';
const browser=await launch(),out='docs/agent-work/ferro-furia',result={errors:[]};
try{
 const page=await browser.newPage();page.on('pageerror',e=>result.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')console.log(m.text().slice(0,300));});
 await page.goto('http://localhost:5191/tools/ferro/preview.html?humans=5');await page.waitForFunction(()=>window.ready,{timeout:120000});await sleep(500);
 result.selection=await page.evaluate(()=>{const f=window.fixture;f.stop();f.match.state.phaseLeft=16;f.display.update(f.match.state,.1);f.display.render();return{panels:document.querySelectorAll('.ferro-select-panel').length,choices:document.querySelectorAll('.ferro-choices button').length,actors:f.display.stats()};});assert.equal(result.selection.panels,5);assert.equal(result.selection.choices,35);
 await page.screenshot({path:out+'/selection.png'});
 await page.evaluate(()=>{const f=window.fixture,d=f.display;d.root.style.display='none';d.overview.alpha=-1.1;d.overview.beta=.76;d.overview.radius=37;d.scene.activeCameras=[d.overview];d.render();});await page.screenshot({path:out+'/arena.png'});
 result.models=await page.evaluate(async()=>{const f=window.fixture,d=f.display,s=f.match.state,{WEAPONS}=await import('/shared/ferro/weapons.ts');for(const w of WEAPONS){s.warriors[0].weapon=w.id;d.update(s,.05);}await d.scene.whenReadyAsync();return WEAPONS.map(w=>({id:w.id,meshes:d.scene.meshes.filter(m=>m.name==='ferro-template:'+w.id).length}));});assert.ok(result.models.every(m=>m.meshes>0));
 await page.goto('http://localhost:5191/tools/ferro/preview.html?humans=5&mode=combat');await page.waitForFunction(()=>window.ready,{timeout:120000});await sleep(2200);
 result.hardware=await page.evaluate(()=>{const f=window.fixture,d=f.display,gl=d.engine._gl,ext=gl.getExtension('WEBGL_debug_renderer_info');return{gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):null,views:d.scene.activeCameras.length,width:d.engine.getRenderWidth(),height:d.engine.getRenderHeight(),actors:d.stats().actors};});assert.equal(result.hardware.views,5);assert.equal(result.hardware.actors,5);
 result.sample=await page.evaluate(async()=>{const f=window.fixture;f.reset();const first=f.frames,start=performance.now();await new Promise(resolve=>{function tick(t){if(t-start<6000)requestAnimationFrame(tick);else resolve();}requestAnimationFrame(tick);});const elapsed=performance.now()-start,mean=k=>f.costs.reduce((n,c)=>n+c[k],0)/f.costs.length;return{fps:(f.frames-first)*1000/elapsed,seconds:elapsed/1000,simulationMs:mean('simulation'),presentationMs:mean('presentation'),renderMs:mean('render'),drawCounterCumulative:mean('draws'),warriors:f.match.state.warriors.map(p=>({id:p.id,alive:p.alive,weapon:p.weapon})),arrows:f.match.state.arrows.length};});
 assert.deepEqual(result.errors,[]);result.status='passed';console.log(JSON.stringify(result));await page.evaluate(()=>window.fixture.dispose());
}catch(e){result.failure=String(e);console.error(e);process.exitCode=1;}finally{await browser.close();writeFileSync(out+'/visual.json',JSON.stringify(result,null,2));}
