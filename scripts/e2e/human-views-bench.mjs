import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {launch,sleep} from './lib.mjs';
process.env.GOBLIN_GPU='1';process.env.VIEWPORT='1920x1080';
const label=process.env.VIEWS_LABEL??'before',humans=Number(process.env.VIEWS_HUMANS??5),out='docs/agent-work/human-views',browser=await launch(),result={label,humans,errors:[]};
try {
 const page=await browser.newPage();page.on('pageerror',e=>result.errors.push(e.message));
 await page.goto(`http://localhost:5191/tools/orda/graphics-preview.html?humans=${humans}`);
 await page.waitForFunction(()=>window.ready,{timeout:120000});
 // Keep exactly the same framebuffer when comparing one and five cameras.
 await page.evaluate(()=>window.fixture.display.engine.setHardwareScalingLevel(1.15));await sleep(2800);
 result.hardware=await page.evaluate(()=>{const f=window.fixture,d=f.display,gl=d.engine._gl,e=gl.getExtension('WEBGL_debug_renderer_info');return{gpu:e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):null,width:d.engine.getRenderWidth(),height:d.engine.getRenderHeight(),scale:d.engine.getHardwareScalingLevel(),views:d.scene.activeCameras.length,enemies:f.match.state.enemies.length,participants:f.match.state.players.length};});
 result.sample=await page.evaluate(async()=>{const f=window.fixture;f.reset();const first=f.frame,start=performance.now();await new Promise(resolve=>{function tick(t){if(t-start<6000)requestAnimationFrame(tick);else resolve();}requestAnimationFrame(tick);});const elapsed=performance.now()-start,mean=k=>f.costs.reduce((a,s)=>a+s[k],0)/f.costs.length;return{fps:(f.frame-first)*1000/elapsed,seconds:elapsed/1000,updateMs:mean('update'),renderCpuMs:mean('render'),drawCalls:mean('draws'),activeIndices:mean('active'),meshes:f.display.scene.meshes.length};});
 assert.equal(result.hardware.participants,5);assert.equal(result.hardware.enemies,22);assert.equal(result.hardware.views,label==='before'?5:humans);assert.deepEqual(result.errors,[]);
 if(label!=='before')await page.screenshot({path:`${out}/orda-${humans}.png`});result.status='passed';console.log(JSON.stringify(result));await page.evaluate(()=>window.fixture.dispose());
}catch(e){result.failure=String(e);process.exitCode=1;console.error(e);}finally{await browser.close();writeFileSync(`${out}/${label}-${humans}.json`,JSON.stringify(result,null,2));}
