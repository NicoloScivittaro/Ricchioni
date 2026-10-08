import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {launch,HOST_URL} from './lib.mjs';
const browser=await launch();
try {
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(`${HOST_URL}?fighter=1&ciro=new`,{waitUntil:'load'});
  await page.waitForFunction(()=>window.__fighterLab?.game(),{timeout:60000});
  await page.evaluate(()=>window.__fighterLab.restart(2,'all-ciro'));
  await page.waitForFunction(()=>[...window.__fighterLab.game().entities.values()].every(e=>e.goblinDebug()?.state==='ready'),{timeout:60000});
  await page.waitForFunction(()=>window.__fighterLab.game().phase==='playing',{timeout:30000});
  const result=await page.evaluate(async()=>{
    const g=window.__fighterLab.game(),f=g.sim.fighters[0],ent=g.entities.get(f.id);
    const {NO_INPUT}=await import('/src/minigames/cornicione/fighterTypes.ts');
    const {ALL_MOVES}=await import('/src/minigames/cornicione/fighterData.ts');
    g.setPaused(true);for(const x of g.sim.fighters)g.setBot(x.id,false);
    g.hud.clearCountdown();
    Object.assign(f,{x:0,y:0,vx:0,vy:0,grounded:true,support:0,hitstun:0,hitFlash:0,attack:null,dodge:null,hover:0,invuln:0,intang:0,jumps:2,jumpBuf:0,landLag:0,dead:false,inGame:true});
    f.ab.burstT=f.ab.returnT=f.ab.followT=f.ab.vanishT=0;
    const handle=ent.goblinHandle(),skeletonId=handle.skeleton.uniqueId;
    const meshes=handle.meshes.filter(m=>m.getTotalVertices()>0);
    const meshIds=meshes.map(m=>m.uniqueId),materialIds=meshes.map(m=>m.material.uniqueId);
    const physics=()=>JSON.stringify({x:f.x,y:f.y,vx:f.vx,vy:f.vy,jumps:f.jumps,lives:f.lives,grounded:f.grounded,attack:f.attack?.t});
    const samples=[];
    const sample=phase=>{
      const before=physics();g.updateVisuals(.016,performance.now());g.scene.render();
      const d=ent.goblinDebug();
      const currentMeshes=ent.goblinHandle().meshes.filter(m=>m.getTotalVertices()>0);
      samples.push({phase,grounded:f.grounded,vy:f.vy,y:f.y,jumps:f.jumps,legacy:ent.legacyAction,visible:currentMeshes.length>0&&currentMeshes.every(m=>m.isEnabled()&&m.isVisible),sameSkeleton:d.skeletonId===skeletonId,sameMeshes:JSON.stringify(currentMeshes.map(m=>m.uniqueId))===JSON.stringify(meshIds),sameMaterials:JSON.stringify(currentMeshes.map(m=>m.material.uniqueId))===JSON.stringify(materialIds),physicsUnchanged:before===physics(),clips:d.clips,tracks:d.activeTracks,procedural:d.procedural,animator:d.animator,hips:d.hipsNow,rest:d.restHips});
    };
    const step=(input={})=>{g.sim.step(.016,new Map([[f.id,{...NO_INPUT,...input}]]));for(const e of g.sim.drainEvents())g.handle(e);};
    sample('ground');
    step({jumpPressed:true,jumpHeld:true});sample('jump');
    for(let i=0;i<8;i++){step({jumpHeld:true});sample('ascent');}
    step({jumpPressed:true,jumpHeld:true});sample('double-jump');
    for(let i=0;i<180&&!f.grounded;i++){step({jumpHeld:true});sample(f.vy>0?'ascent':'descent');}
    sample('landing');
    for(const id of ['dAL','dAH']){
      const move=ALL_MOVES.find(m=>m.id===id);Object.assign(f,{y:3,vy:-2,grounded:false,support:-1,attack:{move,t:move.startup+move.active*.35,hit:new Set(),phase:1}});
      sample(id);
    }
    for(const move of ALL_MOVES){
      Object.assign(f,{y:move.id.includes('A')?3:0,vy:move.id.includes('A')?-2:0,grounded:!move.id.includes('A'),attack:{move,t:move.startup+move.active*.35,hit:new Set(),phase:1}});
      sample(move.id);
    }
    const skin=meshes.map(m=>{const p=m.getPositionData(true,true);return {vertices:p.length/3,finite:Array.from(p).every(Number.isFinite),bounds:m.getBoundingInfo().boundingBox.extendSize.asArray()};});
    g.camera.camera.radius=10;g.camera.camera.target.set(0,4,0);g.scene.render();
    return {samples,skeletonId,meshIds,materialIds,skin};
  });
  assert.equal(result.samples.find(s=>s.phase==='jump').animator.name,'ciro.jump');
  assert.equal(result.samples.find(s=>s.phase==='descent').animator.name,'ciro.fall');
  assert.ok(result.samples.some(s=>s.phase==='jump'&&!s.grounded&&s.vy>0));
  assert.ok(result.samples.some(s=>s.phase==='double-jump'&&s.jumps===0&&s.vy>0));
  assert.ok(result.samples.some(s=>s.phase==='descent'&&s.vy<0));
  assert.ok(result.samples.some(s=>s.phase==='landing'&&s.grounded));
  for(const s of result.samples){
    assert.equal(s.clips,46);assert.equal(s.tracks,195);assert.equal(s.procedural,false);
    assert.equal(s.legacy,false,`${s.phase}: imported body retained`);assert.equal(s.visible,true,`${s.phase}: visible`);
    assert.ok(s.sameSkeleton&&s.sameMeshes&&s.sameMaterials,`${s.phase}: same rig, mesh and skin`);
    assert.equal(s.physicsUnchanged,true,`${s.phase}: visual update cannot change physics`);
    if(!s.grounded)assert.ok(Math.abs(s.hips[1]-s.rest[1])<1e-4,`${s.phase}: no animated vertical root motion`);
  }
  assert.ok(result.skin.every(s=>s.finite&&s.vertices===29981),'skinned vertices stay finite');
  assert.equal(errors.length,0,errors.join(';'));
  await page.screenshot({path:'e2e-shots/man-character/jump-tripo.png'});
  writeFileSync('docs/agent-work/man-character-pilot/jump.json',JSON.stringify({result,errors},null,2));
  console.log(`Ciro: ${result.samples.length} frames, same Tripo mesh/material/skeleton through jump, double jump, descent, landing and all 14 moves; finite deformed skin; physics untouched: PASS`);
}finally{await browser.close();}
