import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {launch,createRoomOnHost,addPhone,sleep} from './lib.mjs';
import {gameEval,startGame,until} from './padmock.mjs';
const out='docs/agent-work/soccer-labels',report={errors:[],fixtures:[]};
mkdirSync(out,{recursive:true});
const browser=await launch();
try {
 const {page,code}=await createRoomOnHost(browser,{targetKeyPresses:3});
 page.on('pageerror',e=>report.errors.push(String(e)));
 for(const [i,name] of ['Niko','Carbo','Christian','Boschi','GoblinMbriacone'].entries())await addPhone(browser,code,name,i);
 const G=(fn,arg)=>gameEval(page,'soccer',fn,arg);
 await startGame(page,'soccer');
 await until(()=>G(g=>g.phase==='playing'),45000,'soccer playing');
 await until(()=>G(g=>[...g.entities.values()].filter(e=>e.goblinDebug?.()).every(e=>e.goblinDebug().state==='ready')),60000,'native skins');
 await sleep(2200); // Let the VIA announcement finish before capturing the field.
 await G(g=>{g.paused=true;g.ctx.input.reset();});
 for(const [width,height] of [[1280,720],[1366,768],[1920,1080],[800,600]]) {
  await page.setViewport({width,height});await sleep(350);
  for(const [fixture,cx,zoom] of [['centre',0,1],['zoom',0,1.4],['left-goal',-12.7,1],['right-goal',12.7,1]]) {
   const data=await G((g,arg)=>{
    const [cx,zoom]=arg;
    for(const [i,p] of g.players.entries()) {
     const a=i*Math.PI*2/5;
     Object.assign(p,{x:cx+Math.cos(a)*2,z:Math.sin(a)*2,vx:0,vz:0,y:0,hasBall:false,charging:false,chargeTime:0});
     g.entities.get(p.id).updateVisual(p,0,performance.now());
    }
    Object.assign(g.ball,{x:cx,z:0,vx:0,vz:0,ownerId:null,freeGrace:100});g.ballMesh.position.set(cx,.55,0);
    g.readability.update(g.players,g.ball,true,'#22d3ee');
    g.scene.activeCamera.radius=30;
    g.camera.update(1,g.players,g.ball,performance.now()+1000);g.scene.activeCamera.radius*=zoom;
    g.scene.render();g.scene.render();
    const state=JSON.stringify([g.players,g.ball]);
    const snapshot=()=>[...g.readability.players.entries()].map(([id,v])=>({id,name:v.name.text,color:v.name.color,visible:v.box.isVisible,
     x:v.box._currentMeasure.left,y:v.box._currentMeasure.top,w:v.box._currentMeasure.width,h:v.box._currentMeasure.height,
     font:v.name.fontSize,background:v.box.background,dx:v.box.linkOffsetX,dy:v.box.linkOffsetY}));
    const labels=snapshot(),counts=[g.scene.meshes.length,g.hud.adt.getDescendants().length];
    for(let i=0;i<20;i++){g.readability.update(g.players,g.ball,true,'#22d3ee');g.scene.render();}
    const V=g.ballMesh.position.constructor,M=g.ballMesh.getWorldMatrix().constructor;
    const e=g.engine,c=g.scene.activeCamera,vp=c.viewport.toGlobal(e.getRenderWidth(),e.getRenderHeight());
    const project=(x,y,z)=>{const p=V.Project(new V(x,y,z),M.Identity(),g.scene.getTransformMatrix(),vp);return{x:p.x,y:p.y};};
    const rect=points=>{const xs=points.map(p=>p.x),ys=points.map(p=>p.y);return{x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys)};};
    const protectedRects=[rect([-1,1].flatMap(x=>[-1,1].flatMap(y=>[-1,1].map(z=>project(cx+x*.67,.55+y*.55,z*.67))))),
     ...[-1,1].map(side=>rect([0,2.2].flatMap(d=>[0,2.5].flatMap(y=>[-3,3].map(z=>project(side*(16+d),y,z)))))),
     ...g.players.map(p=>rect([-.95,.95].flatMap(dx=>[.1,3.05].map(y=>project(p.x+dx,y,p.z)))))];
    return{labels,protectedRects,scale:e.getRenderHeight()/720,radius:c.radius,stable:JSON.stringify(labels)===JSON.stringify(snapshot()),
     unchanged:state===JSON.stringify([g.players,g.ball]),noAllocations:JSON.stringify(counts)===JSON.stringify([g.scene.meshes.length,g.hud.adt.getDescendants().length]),
     giantBallLabel:!!g.hud.adt.getControlByName('soccerBallLabel')};
   },[cx,zoom]);
   report.fixtures.push({width,height,fixture,...data});
   writeFileSync(`${out}/visual-browser.json`,JSON.stringify(report,null,2));
   await page.screenshot({path:`${out}/${fixture}-${width}x${height}.png`});
   const overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
   assert.equal(data.labels.length,5);assert.ok(data.stable&&data.unchanged&&data.noAllocations);
   assert.equal(data.giantBallLabel,false);
   for(const [i,l] of data.labels.entries()) {
    assert.ok(l.visible,`${fixture} ${width}: all five names visible`);
    assert.ok(l.w/data.scale<=107&&l.h/data.scale<=23,`compact measure ${JSON.stringify(l)} scale ${data.scale}`);
    assert.equal(l.background,'transparent');assert.ok(!/ROSSI|BLU|PALLA/.test(l.name));
    assert.ok(data.labels.slice(i+1).every(b=>!overlap(l,b)),`${fixture}: labels overlap`);
    assert.ok(data.protectedRects.every(r=>!overlap(l,r)),`${fixture}: label covers action`);
   }
   console.log(`PASS ${fixture} ${width}x${height}`);
  }
 }
 assert.deepEqual(report.errors,[]);
 writeFileSync(`${out}/visual-browser.json`,JSON.stringify(report,null,2));
 console.log('PASS five players, four resolutions, zoom, both goals, no overlaps/occlusion/gameplay writes/control allocations.');
} finally {await browser.close();}
