import{launch,sleep}from'../../scripts/e2e/lib.mjs';
import{writeFileSync}from'node:fs';

const out='docs/agent-work/terminal-conversion';const browser=await launch();
try{
 const page=await browser.newPage(),errors=[],warnings=[];
 page.on('pageerror',e=>errors.push(String(e)));
 page.on('response',r=>{if(r.status()>=400)errors.push(`HTTP ${r.status()} ${r.url()}`);});
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());else if(m.type()==='warning')warnings.push(m.text());});
 await page.goto('http://127.0.0.1:5184/docs/agent-work/terminal-conversion/preview.html',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__terminal?.ready||window.__terminal?.errors?.length,{timeout:180000});
 const state=await page.evaluate(()=>{const a=window.__terminal;return{ready:a.ready,errors:a.errors,meshes:a.importedMeshes,materials:a.importedMaterials,activeVertices:a.scene.getTotalVertices(),presets:a.presets,modelBounds:a.report.sourceBounds};});
 if(!state.ready)throw new Error(JSON.stringify(state));
 for(const name of['airport','plane','stairs']){
  await page.click('#'+name);await sleep(500);await page.screenshot({path:`${out}/${name}.png`});
 }
 await page.click('#fly');const before=await page.evaluate(()=>window.__terminal.scene.activeCamera.position.asArray());await page.keyboard.down('w');await sleep(350);await page.keyboard.up('w');
 const movement=await page.evaluate(()=>{const a=window.__terminal;return{camera:a.scene.activeCamera.name,position:a.scene.activeCamera.position.asArray()};});
 movement.before=before;movement.distance=Math.hypot(...movement.position.map((v,i)=>v-before[i]));
 if(movement.distance<.05)errors.push('Free camera did not move with ordinary keyboard input');
 writeFileSync(out+'/browser-checks.json',JSON.stringify({...state,movement,errors,warnings},null,2));console.log(JSON.stringify({...state,movement,errors,warnings}));
 if(errors.length)throw new Error(errors.join('\n'));
}finally{await browser.close();}
