// Ferro 2.1: close-up of every weapon model in the hands of the real skins (idle, three guards, light, heavy, run).
import assert from'node:assert/strict';
import{writeFileSync,mkdirSync}from'node:fs';
import{launch}from'./lib.mjs';
process.env.GOBLIN_GPU??='1';process.env.VIEWPORT??='1600x900';
const out=process.env.OUT??'docs/agent-work/ferro-21',browser=await launch(),result={errors:[],shots:[]};mkdirSync(out,{recursive:true});
const only=process.env.ONLY?.split(',');
try{
 const page=await browser.newPage();page.on('pageerror',e=>result.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')console.log(m.text());});
 await page.goto('http://localhost:5191/tools/ferro/preview.html?humans=1&map=colosseum',{timeout:240000});await page.waitForFunction(()=>window.ready,{timeout:180000});
 await page.evaluate(()=>{const f=window.fixture;f.stop();const d=f.display;d.root.style.display='none';});
 const cases=[['sword',0],['sword',1],['sword',2],['sword',3],['shield',0],['shield',1],['axe',0],['axe',1],['axe',2],['hammer',0],['spear',0],['blades',0]].filter(([w])=>!only||only.includes(w));
 const poses=['idle','top','left','right','light','heavy','run'];
 for(const[weapon,variant]of cases){
  const shot=await page.evaluate(async(weapon,variant,poses)=>{
   const f=window.fixture,d=f.display,s=f.match.state;s.phase='fight';const records=[];
   s.warriors.forEach((p,i)=>Object.assign(p,{x:(i-2)*1.7,y:0,z:0,yaw:Math.PI,alive:true,eligible:true,weapon,variant,guard:false,action:null,charge:0,bowPhase:'idle',vx:0,vz:0,clash:null,hurt:0,feint:0,deflect:0}));
   const frames=[];
   for(const pose of poses){
    for(const p of s.warriors){Object.assign(p,{guard:['top','left','right'].includes(pose),guardDirection:['top','left','right'].includes(pose)?pose:'top',vx:0,vz:0,action:null});
     if(pose==='light'||pose==='heavy'){const spec=window.fixture.match.constructor&&null;p.action={kind:pose,age:pose==='light'?.2:.5,combo:0,yaw:p.yaw,direction:'right',serial:1,hits:[]};}
     if(pose==='run'){p.vz=-4.5;}}
    for(let i=0;i<45;i++)d.update(s,1/60);
    for(const a of d.actors.values()){const g=a.gripDebug?.();if(g)records.push({pose,...g});}
    frames.push(pose);
   }
   return{records};
  },weapon,variant,poses);
  result.shots.push({weapon,variant,...shot});
  // Pictures: one strip per weapon with three of the five warriors, at idle, top, left, right, heavy.
  for(const pose of ['idle','top','left','right','heavy']){
   await page.evaluate(async(pose,weapon,variant)=>{const f=window.fixture,d=f.display,s=f.match.state;for(const p of s.warriors){Object.assign(p,{weapon,variant,guard:['top','left','right'].includes(pose),guardDirection:['top','left','right'].includes(pose)?pose:'top',action:pose==='heavy'?{kind:'heavy',age:.3,combo:0,yaw:p.yaw,direction:'top',serial:1,hits:[]}:null,vx:0,vz:0});}
    for(let i=0;i<45;i++)d.update(s,1/60);const V=d.overview.target.constructor;d.overview.setTarget(new V(0,1.45,0));d.overview.alpha=-Math.PI/2;d.overview.beta=1.42;d.overview.radius=5.2;d.overview.fov=.9;d.scene.activeCameras=[d.overview];await d.scene.whenReadyAsync();d.render();},pose,weapon,variant);
   const path=`${out}/grip-${weapon}${variant}-${pose}.png`;await page.screenshot({path,clip:{x:100,y:140,width:1400,height:620}});
  }
 }
 assert.deepEqual(result.errors,[]);result.status='passed';
}catch(e){result.failure=String(e);console.error(e);process.exitCode=1;}finally{await browser.close();writeFileSync(out+'/grip.json',JSON.stringify(result,null,2));}
