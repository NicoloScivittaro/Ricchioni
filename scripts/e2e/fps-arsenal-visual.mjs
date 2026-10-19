import assert from 'node:assert/strict';import {writeFileSync} from 'node:fs';import {launch,sleep} from './lib.mjs';
const browser=await launch(),out='docs/agent-work/fps-arsenal',report={},errors=[];
try{
 const page=await browser.newPage();page.setDefaultTimeout(120000);page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('http://localhost:5186/docs/agent-work/fps-weapons/preview.html?quality=high');await page.waitForFunction(()=>window.__weapons?.ready,{timeout:120000});await page.screenshot({path:out+'/six-models.png'});
 report.models=await page.evaluate(async()=>{const a=window.__weapons,{WEAPONS}=await import('/shared/fpsWeapons.ts');const result=[];for(const w of WEAPONS){await a.choose(w.id);a.vm.ads=0;for(let i=0;i<60;i++)a.vm.update(1/60,0,0,0,0,false);result.push({id:w.id,loaded:!!a.vm.current.imported,meshes:a.vm.current.imported?.getChildMeshes().length});}a.engine.stopRenderLoop();a.scene.dispose();a.engine.dispose();document.body.innerHTML='';return result;});assert.equal(report.models.length,6);assert.ok(report.models.every(m=>m.loaded&&m.meshes>0));
 report.views=[];
 for(const count of [1,2,5]){
  const result=await page.evaluate(async count=>{
   window.__arsenalTV?.dispose();document.body.innerHTML='<canvas id="view" style="position:fixed;inset:0;width:100%;height:100%"></canvas>';
   const {BabylonFpsGame}=await import('/src/minigames/fps/BabylonFpsGame.ts');const r=window.__arsenalTV=new BabylonFpsGame(document.querySelector('canvas'),Array.from({length:count},(_,i)=>({id:'p'+i,name:'CECCHINO '+(i+1),color:'#8cdaa0'})),'cantiere');await r.ready;
   const snaps=window.__arsenalSnaps=Array.from({length:count},(_,i)=>({id:'p'+i,name:'CECCHINO '+(i+1),color:'#8cdaa0',x:-20+i*2,z:-20,y:0,yaw:.14,pitch:.07,hp:100,maxHp:100,alive:true,kills:0,weaponId:'laser',magazine:5,reloading:false,ads:1,recoilPitch:0,recoilYaw:0,heat:0,moving:0}));
   r.update(1/60,snaps);await Promise.all(r.cams.map(c=>c.vm.whenReady()));for(let i=0;i<90;i++)r.update(1/60,snaps);await r.scene.whenReadyAsync();
   const scoped=r.cams.map(c=>({scope:r.hud.get(c.playerId).scope.alpha,zoom:Math.tan(1.05/2)/Math.tan(c.camera.fov/2),hidden:!c.vm.current.root.isEnabled()}));
   const s=snaps[0];s.reloading=true;r.update(1/60,snaps);const reload=r.hud.get('p0').scope.alpha;s.reloading=false;s.alive=false;r.update(1/60,snaps);const death=r.hud.get('p0').scope.alpha;s.alive=true;r.update(1/60,snaps);r.setPaused(true);const pause=r.hud.get('p0').scope.alpha;r.setPaused(false);
   s.weaponId='pistola';r.update(1/60,snaps);const swapped=r.hud.get('p0').scope.alpha;s.weaponId='laser';r.update(1/60,snaps);await r.cams[0].vm.whenReady();r.scene.render();return{count,scoped,reload,death,pause,swapped};
  },count);
  assert.ok(result.scoped.every(s=>s.scope===1&&Math.abs(s.zoom-4)<1e-6&&s.hidden));assert.equal(result.reload,0);assert.equal(result.death,0);assert.equal(result.pause,0);assert.equal(result.swapped,0);report.views.push(result);await sleep(300);await page.screenshot({path:out+'/scope-'+count+'.png'});
 }
 await page.setViewport({width:390,height:844});
 report.phone=await page.evaluate(async()=>{
  window.__arsenalTV.dispose();document.body.innerHTML='<div id="phone" style="position:fixed;inset:0"></div>';
  const{FpsClient}=await import('/src/controller/fpsClient.ts');const c=window.__arsenalPhone=new FpsClient(document.querySelector('#phone'),'phone',()=>{},()=>null,'cantiere');c.engine.stopRenderLoop();
  const ps=window.__phoneSnapshot={id:'phone',name:'PHONE',color:'#8cdaa0',x:-20,z:-20,y:0,hp:100,alive:true,kills:3,weaponId:'laser',magazine:5,reloading:false,firing:false,ads:1};c.updateState({matchTime:10,players:[ps]});await c.vm.whenReady();for(let i=0;i<90;i++)c.tick(1/60);c.scene.render();
  const scope={alpha:c.scopeEl.style.opacity,hidden:!c.vm.current.root.isEnabled(),zoom:Math.tan(.8/2)/Math.tan(c.camera.fov/2),src:decodeURIComponent(c.scopeEl.src).includes('390 844')};
  ps.weaponId='pistola';ps.ads=0;ps.magazine=12;c.updateState({matchTime:10,players:[ps]});await c.vm.whenReady();c.fireCooldown=0;const before=c.mag;c.setFirePressed(true);for(let i=0;i<60;i++)c.tick(1/60);const held=before-c.mag;c.setFirePressed(false);
  c.mag=12;c.fireCooldown=0;for(let j=0;j<6;j++){c.setFirePressed(true);c.setFirePressed(false);for(let i=0;i<10;i++)c.tick(1/60);}const tapped=12-c.mag;
  c.mag=12;c.fireCooldown=.06;c.setFirePressed(true);c.setFirePressed(false);c.setPaused(true);c.setPaused(false);for(let i=0;i<30;i++)c.tick(1/60);const cancel=12-c.mag;
  ps.weaponId='laser';ps.ads=1;ps.magazine=5;c.updateState({matchTime:10,players:[ps]});await c.vm.whenReady();for(let i=0;i<90;i++)c.tick(1/60);c.scene.render();return{scope,held,tapped,cancel};
 });assert.equal(report.phone.scope.alpha,'1');assert.ok(report.phone.scope.hidden&&report.phone.scope.src&&Math.abs(report.phone.scope.zoom-4)<1e-6);assert.equal(report.phone.held,1);assert.equal(report.phone.tapped,6);assert.equal(report.phone.cancel,0);await sleep(200);await page.screenshot({path:out+'/scope-phone.png'});
 await page.setViewport({width:844,height:390});await sleep(250);
 report.resize=await page.evaluate(()=>{const c=window.__arsenalPhone;c.tick(1/60);c.scene.render();return{correct:decodeURIComponent(c.scopeEl.src).includes('844 390'),alpha:c.scopeEl.style.opacity};});assert.ok(report.resize.correct);assert.equal(report.resize.alpha,'1');await page.screenshot({path:out+'/scope-phone-landscape.png'});
 await page.setViewport({width:1280,height:720});await page.evaluate(async()=>{const c=window.__arsenalPhone;window.__phoneSnapshot.weaponId='bombarda';window.__phoneSnapshot.magazine=20;window.__phoneSnapshot.ads=0;c.updateState({matchTime:10,players:[window.__phoneSnapshot]});await c.vm.whenReady();for(let i=0;i<90;i++)c.tick(1/60);c.yaw=0;c.pitch=0;c.selfSpeed=0;for(let i=0;i<90;i++)c.tick(1/60);await c.scene.whenReadyAsync();c.scene.render();for(let i=0;i<7;i++)c.energyBolt({id:i,ox:-20+i*.08,oy:1.5,oz:-14+i*2,dx:0,dy:0,dz:1,speed:55,range:60});c.vm.fire();c.scene.render();});await page.screenshot({path:out+'/ray-gun.png'});
 assert.deepEqual(errors,[]);console.log(JSON.stringify(report));
}finally{writeFileSync(out+'/visual-checks.json',JSON.stringify({...report,errors},null,2));await browser.close();}
