import {launch} from './lib.mjs';import {writeFileSync} from 'node:fs';
const browser=await launch();try{const page=await browser.newPage();await page.goto('http://localhost:5186/docs/agent-work/fps-weapons/preview.html');await page.waitForFunction(()=>window.__weapons?.ready,{timeout:120000});
const report=await page.evaluate(async()=>{
 const old=window.__weapons;old.engine.stopRenderLoop();old.scene.dispose();old.engine.dispose();document.body.innerHTML='<canvas style="position:fixed;inset:0;width:100%;height:100%"></canvas>';
 const {BabylonFpsGame}=await import('/src/minigames/fps/BabylonFpsGame.ts'),{TerminalArena}=await import('/src/minigames/fps/terminalArena.ts');
 const core=performance.getEntriesByType('resource').map(r=>r.name).find(n=>n.includes('/@babylonjs_core.js')), {Ray,Vector3}=await import(core);
 const arena=await TerminalArena.load(),r=new BabylonFpsGame(document.querySelector('canvas'),[{id:'p',name:'TEST',color:'#fff'}],'terminal');await r.ready;r.engine.stopRenderLoop();
 const meshes=r.scene.meshes.filter(m=>m.name.startsWith('terminalBatch:')||m.name.startsWith('terminalInstances:'));for(const m of meshes)m.thinInstanceEnablePicking=true;
 const check=p=>{const ray=new Ray(new Vector3(p.x,p.y+.18,p.z),new Vector3(0,-1,0),.65),hit=r.scene.pickWithRay(ray,m=>meshes.includes(m),false);return{...p,collisionFloor:p.y+.18-arena.ray(p.x,p.y+.18,p.z,0,-1,0,.65),hit:hit?.hit,floor:hit?.pickedPoint?.y,delta:hit?.hit?Math.abs(hit.pickedPoint.y-p.y):null,mesh:hit?.pickedMesh?.name};};
 const spawns=arena.spawns.map(check);const cabin=[-42,-45,-50.1,-54.9,-57,-59.9].map(z=>{const y=arena.floorAt(-39.3,z,5.14);return check({x:-39.3,y:y??5.14,z});});r.dispose();return{spawns,cabin};
});writeFileSync('docs/agent-work/terminal-2-1/floor-checks.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));}finally{await browser.close();}
