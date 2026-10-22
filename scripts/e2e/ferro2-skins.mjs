import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {launch} from './lib.mjs';
process.env.GOBLIN_GPU='1';process.env.VIEWPORT='1920x1080';
const browser=await launch(),out='docs/agent-work/ferro-2',result={errors:[]};
try{
 const page=await browser.newPage();page.on('pageerror',e=>result.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')console.log(m.text());});
 await page.goto('http://localhost:5191/tools/ferro/preview.html?humans=1&map=colosseum');await page.waitForFunction(()=>window.ready,{timeout:180000});
 result.skins=await page.evaluate(()=>{const f=window.fixture;f.stop();const d=f.display,s=f.match.state;s.phase='fight';s.warriors.forEach((p,i)=>Object.assign(p,{x:(i-2)*2.3,y:0,z:0,yaw:0,weapon:i===2?'bow':'sword',guard:i===2,charge:i===2?1:0,bowPhase:i===2?'hold':'idle',action:null}));d.root.style.display='none';d.update(s,0);d.overview.setTarget(new (d.overview.target.constructor)(0,1.4,0));d.overview.alpha=Math.PI/2;d.overview.beta=1.35;d.overview.radius=6.5;d.overview.fov=1.1;d.scene.activeCameras=[d.overview];d.render();return [...d.actors.values()].map(a=>a.skinDebug());});
 await page.evaluate(async()=>{const d=window.fixture.display;await d.scene.whenReadyAsync();d.render();await new Promise(requestAnimationFrame);d.render();});
 await page.screenshot({path:out+'/skins-lineup.png'});assert.equal(result.skins.filter(s=>s.character!=='procedural'&&s.ready&&s.bones===65).length,4);
 result.models=await page.evaluate(()=>[...window.fixture.display.actors.values()].map(a=>({character:a.skinDebug().character,variant:a.variant,models:a.held.right.getChildMeshes().map(m=>{m.computeWorldMatrix(true);return{name:m.name,enabled:m.isEnabled(),visible:m.isVisible,visibility:m.visibility,alpha:m.material.alpha,cull:m.material.backFaceCulling,vertices:m.getTotalVertices(),min:m.getBoundingInfo().boundingBox.minimumWorld.asArray(),max:m.getBoundingInfo().boundingBox.maximumWorld.asArray()};})})));
 // The visible skin, never a hidden placeholder, follows the real hand grip in several poses.
 result.poses=await page.evaluate(()=>{const f=window.fixture,d=f.display,s=f.match.state,records=[];for(const weapon of ['sword','spear','bow','shield','blades','hammer','axe'])for(const direction of ['top','left','right']){for(const p of s.warriors)Object.assign(p,{weapon,guardDirection:direction,guard:true,charge:weapon==='bow'?1:0,bowPhase:weapon==='bow'?'hold':'idle',action:weapon==='bow'?null:{kind:'heavy',age:.25,combo:0,yaw:0,direction,serial:50,hits:[]}});d.update(s,.016);for(const a of d.actors.values()){const debug=a.skinDebug();if(debug.character!=='procedural'){const pose=a.lastPose;records.push({character:debug.character,weapon,direction,error:Math.hypot(...debug.hands.right.map((v,i)=>v-pose.right.grip[['x','y','z'][i]])),leftError:Math.hypot(...debug.hands.left.map((v,i)=>v-pose.left.grip[['x','y','z'][i]])),finite:debug.hands.right.every(Number.isFinite)&&debug.hands.left.every(Number.isFinite)});}}}return records;});
 assert.ok(result.poses.every(p=>p.finite&&p.error<.02&&p.leftError<.02));
 assert.deepEqual(result.errors,[]);result.status='passed';console.log(JSON.stringify({skins:result.skins,status:result.status,maxGripError:Math.max(...result.poses.map(p=>p.error))}));
}catch(e){result.failure=String(e);console.error(e);process.exitCode=1;}finally{await browser.close();writeFileSync(out+'/skins-visual.json',JSON.stringify(result,null,2));}



