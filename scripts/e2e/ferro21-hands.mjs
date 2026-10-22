// Ferro 2.1: hand close-ups on the real skins — the fist must close around the calibrated handle.
import assert from'node:assert/strict';
import{writeFileSync,mkdirSync}from'node:fs';
import{launch}from'./lib.mjs';
process.env.GOBLIN_GPU??='1';process.env.VIEWPORT??='900x700';
const out=process.env.OUT??'docs/agent-work/ferro-21',browser=await launch(),result={errors:[],gaps:[]};mkdirSync(out,{recursive:true});
try{
 const page=await browser.newPage();page.on('pageerror',e=>result.errors.push(e.message));
 await page.goto('http://localhost:5191/tools/ferro/preview.html?humans=1&cast=goblin,buttafuori,judoka,ciro,dottore',{timeout:240000});await page.waitForFunction(()=>window.ready,{timeout:180000});
 for(const[weapon,variant,pose,actor]of[['sword',3,'idle',1],['sword',3,'top',1],['sword',0,'left',0],['axe',1,'right',3],['axe',2,'idle',2],['spear',0,'right',0]]){
  const gap=await page.evaluate(async(weapon,variant,pose,index)=>{const f=window.fixture;f.stop();const d=f.display,s=f.match.state;d.root.style.display='none';s.phase='fight';
   s.warriors.forEach((p,i)=>Object.assign(p,{x:(i-2)*2.2,y:0,z:0,yaw:Math.PI,weapon,variant,guard:pose!=='idle',guardDirection:pose==='idle'?'top':pose,action:null,vx:0,vz:0}));
   for(let i=0;i<45;i++)d.update(s,1/60);const a=[...d.actors.values()][index],hand=a.skin.joints.get('mixamorig:RightHand').node,idx=a.skin.joints.get('mixamorig:RightHandIndex1').node,pinky=a.skin.joints.get('mixamorig:RightHandPinky1').node;
   const V=d.overview.target.constructor,wpos=node=>{const chain=[];let n=node;while(n){chain.unshift(n);n=n.parent;}for(const c of chain)c.computeWorldMatrix(true);return node.getAbsolutePosition().clone();},k=wpos(idx).add(wpos(pinky)).scale(.5),tipM=wpos(a.skin.joints.get('mixamorig:RightHandMiddle3').node);for(const l of d.labels.values())l.setEnabled(false);
   d.overview.setTarget(k.clone());d.overview.alpha=-Math.PI/2+.5;d.overview.beta=1.25;d.overview.radius=.95;d.overview.fov=.8;d.scene.activeCameras=[d.overview];await d.scene.whenReadyAsync();d.render();
   // Distance from the knuckle midpoint to the weapon axis (handle centre line).
   const held=a.held.right,o=wpos(held),dir=held.getDirection(new V(0,1,0)),gapOf=x=>{const rel=x.subtract(o),along=V.Dot(rel,dir);return[rel.subtract(dir.scale(along)).length(),along];},[off,along]=gapOf(k),[tipOff]=gapOf(tipM);return{weapon,variant,pose,character:a.skinDebug().character,axisGap:+off.toFixed(3),alongHandle:+along.toFixed(3),fingertipGap:+tipOff.toFixed(3)};},weapon,variant,pose,actor);
  result.gaps.push(gap);await page.screenshot({path:`${out}/hand-${weapon}${variant}-${pose}.png`});
 }
 console.log(JSON.stringify(result.gaps));assert.ok(result.gaps.every(g=>g.axisGap<.06&&Math.abs(g.alongHandle)<.08&&g.fingertipGap<.1),'fist closed on the handle');assert.deepEqual(result.errors,[]);result.status='passed';
}catch(e){result.failure=String(e);console.error(e);process.exitCode=1;}finally{await browser.close();writeFileSync(out+'/hands.json',JSON.stringify(result,null,1));}
