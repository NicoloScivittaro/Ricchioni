import {launch,sleep} from './lib.mjs';import{writeFileSync}from'node:fs';
const browser=await launch();try{
 const page=await browser.newPage();page.on('pageerror',e=>console.log(e.stack));await page.goto('http://localhost:5180/');
 const info=await page.evaluate(async()=>{
  const{game:gm}=await import('/src/core/GameManager.ts');gm.game.loop.sleep();gm.game.canvas.style.display='none';
  const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;canvas.style.cssText='position:fixed;inset:0;width:100%;height:100%;z-index:10001';document.body.append(canvas);
  const{inspect}=await import('/scripts/primo-inspector.ts');const g=window.__primoInspect=await inspect(canvas);
  return {meshes:g.meshes.length,renderer:g.engine.getGlInfo(),bounds:g.meshes.filter(m=>m.getTotalVertices()).map(m=>({name:m.name,mat:m.material?.name,min:m.getBoundingInfo().boundingBox.minimumWorld.asArray(),max:m.getBoundingInfo().boundingBox.maximumWorld.asArray()}))};
 });await sleep(500);await page.screenshot({path:'docs/agent-work/primo-karting/general.png'});writeFileSync('docs/agent-work/primo-karting/babylon-inspection.json',JSON.stringify(info,null,2));console.log(JSON.stringify({meshes:info.meshes,renderer:info.renderer}));
}finally{await browser.close();}
