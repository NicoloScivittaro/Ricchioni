import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {launch,HOST_URL,sleep} from './lib.mjs';
const browser=await launch();
try {
  const page=await browser.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(`${HOST_URL}?debug=1`,{waitUntil:'load'});
  await page.evaluate(async()=>{
    const {GoblinVisualInstance}=await import('/src/minigames/characters/goblinVisual.ts');
    const url=performance.getEntriesByType('resource').map(e=>e.name).find(n=>/\/@babylonjs_core\.js\?/.test(n));
    const {Engine,Scene,ArcRotateCamera,HemisphericLight,Vector3,TransformNode,Color4}=await import(url);
    const clips=await (await fetch('/docs/agent-work/man-character-pilot/clips.json')).json();
    const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;canvas.style.cssText='position:fixed;inset:0;width:100%;height:100%;z-index:999999';document.body.append(canvas);
    const engine=new Engine(canvas,true,{preserveDrawingBuffer:true}),scene=new Scene(engine);
    scene.clearColor=new Color4(.42,.46,.54,1);
    new ArcRotateCamera('camera',-Math.PI/2,1.32,4,new Vector3(0,1,0),scene);
    new HemisphericLight('light',Vector3.Up(),scene).intensity=1;
    const root=new TransformNode('man',scene);root.rotation.y=Math.PI;
    const model=new GoblinVisualInstance(scene,root,{height:2,profile:{namespace:'man',url:'/models/man-tripo/man.glb',clips}});
    window.__man={engine,scene,model,clips};
    engine.runRenderLoop(()=>scene.render());
  });
  await page.waitForFunction(()=>window.__man.model.ready,{timeout:60000});
  const report=await page.evaluate(()=>{
    const {model,clips,scene}=window.__man;
    const state={speedFrac:0,alive:true,falling:false,dashing:false,stunned:false,grounded:true};
    const rows=[];
    for(const clip of clips){
      model.preview(clip.name,1,false);
      for(let i=0;i<12;i++)model.update(.05,state);
      scene.render();
      const skin=model.meshes.filter(m=>m.getTotalVertices()>0).map(m=>{const data=m.getPositionData(true,true);return {finite:Array.from(data).every(Number.isFinite),vertices:data.length/3};});
      rows.push({name:clip.name,debug:model.debug(),skin});
    }
    const materials=model.meshes.filter(m=>m.material).map(m=>({class:m.material.getClassName(),textures:m.material.getActiveTextures().map(t=>({size:t.getSize(),ready:t.isReady()})),pickable:m.isPickable}));
    return {rows,materials,autoplay:scene.animationGroups.some(g=>g.isPlaying)};
  });
  assert.equal(report.rows.length,46);
  for(const row of report.rows){assert.equal(row.debug.bones,65);assert.equal(row.debug.clips,46);assert.equal(row.debug.activeTracks,195);assert.ok(row.skin.every(s=>s.finite&&s.vertices===29981));}
  assert.equal(report.autoplay,false);
  assert.ok(report.materials.every(m=>!m.pickable&&m.textures.length===3&&m.textures.every(t=>t.ready&&t.size.width===4096)));
  for(const name of ['idle','run','jump','heavy','victory']){
    await page.evaluate(n=>{const q=window.__man;q.model.preview(`man.${n}`,1,false);for(let i=0;i<12;i++)q.model.update(.05,{speedFrac:0,alive:true,falling:false,dashing:false,stunned:false});q.scene.render();},name);
    await sleep(350);
    await page.screenshot({path:`e2e-shots/man-character/asset-${name}.png`});
  }
  const counters=await page.evaluate(async()=>{window.__man.model.dispose();window.__man.engine.dispose();return (await import('/src/minigames/characters/goblinVisual.ts')).goblinVisualCounters();});
  assert.equal(counters.liveInstances,0);assert.equal(errors.length,0,errors.join(';'));
  writeFileSync('docs/agent-work/man-character-pilot/asset-render.json',JSON.stringify({report,counters,errors},null,2));
  console.log('GLB: all 46 native clips, finite deformed skin, 65 bones, original 3 PBR maps, no autoplay, disposal: PASS');
}finally{await browser.close();}
