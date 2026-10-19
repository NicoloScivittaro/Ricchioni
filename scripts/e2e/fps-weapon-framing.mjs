import assert from'node:assert/strict';import{writeFileSync}from'node:fs';import{launch,sleep}from'./lib.mjs';
const browser=await launch(),out='docs/agent-work/fps-weapons',report={},errors=[];let requests=[];
try{
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.url().includes('/assets/fps/weapons/'))requests.push(r.url());});
 await page.goto('http://localhost:5186/docs/agent-work/fps-weapons/preview.html');await page.waitForFunction(()=>window.__weapons?.ready,{timeout:120000});await page.screenshot({path:out+'/models.png'});
 report.models=await page.evaluate(async()=>{
  const{WEAPONS}=await import('/shared/fpsWeapons.ts');const{FpsViewmodel}=await import('/src/controller/fpsViewmodel.ts');const api=window.__weapons;api.vms=[];
  const checks=[];for(let i=0;i<WEAPONS.length;i++){const c=api.cameras[i];c.position.set(0,0,0);c.rotation.set(0,0,0);c.fov=1.05;c.layerMask=1<<(15+i);const vm=new FpsViewmodel(api.scene,c,false,1<<(15+i));vm.aspect=(1280/4)/(640/2);vm.scale=1;vm.equip(WEAPONS[i].id);const loaded=await vm.whenReady();for(let n=0;n<90;n++)vm.update(1/60,0,0,0,0,false);api.vms.push(vm);checks.push({id:WEAPONS[i].id,loaded,meshes:vm.current.imported?.getChildMeshes().filter(m=>m.getTotalVertices()).length,mask:vm.current.imported?.getChildMeshes().every(m=>m.layerMask===(1<<(15+i)))});}
  api.scene.activeCameras=api.cameras;api.scene.render();return checks;
 });assert.ok(report.models.length===7&&report.models.every(m=>m.loaded&&m.meshes>0&&m.mask));await page.screenshot({path:out+'/first-person.png'});
 report.ads=await page.evaluate(()=>{const api=window.__weapons;return api.vms.map((vm,i)=>{vm.ads=1;for(let n=0;n<30;n++)vm.update(1/60,0,0,0,0,false);vm.current.root.computeWorldMatrix(true);vm.current.muzzle.computeWorldMatrix(true);const p=vm.current.muzzle.getAbsolutePosition().asArray();let top=-Infinity;for(const mesh of vm.current.imported.getChildMeshes()){if(!mesh.getTotalVertices())continue;mesh.computeWorldMatrix(true);top=Math.max(top,mesh.getBoundingInfo().boundingBox.maximumWorld.y);}vm.fire();vm.update(1/60,0,0,0,.5,false);return{id:vm.weaponId,modelTop:top,muzzle:p,flash:vm.flash.isVisible,recoil:vm.z,ready:!!vm.current.imported};});});
 assert.ok(report.ads.every(a=>Math.abs(a.muzzle[0])<.005&&a.modelTop<.005&&a.flash&&a.recoil<0));
 // Settled ADS screenshot, without the reload pose used for the animation check.
 await page.evaluate(()=>{const a=window.__weapons;for(const vm of a.vms)for(let n=0;n<120;n++)vm.update(1/60,0,0,0,0,false);a.scene.render();});await page.screenshot({path:out+'/ads.png'});
 requests=[];
 report.views=[];for(const count of [1,2,3,4,5]){
 report.split=await page.evaluate(async(count)=>{
  if(window.__weaponSplit){window.__weaponSplit.dispose();document.querySelectorAll('canvas').forEach(c=>c.remove());}
  else {window.__weapons.engine.stopRenderLoop();window.__weapons.scene.dispose();window.__weapons.engine.dispose();document.querySelector('#stage').style.display='none';document.querySelector('header').style.display='none';}
  const{BabylonFpsGame}=await import('/src/minigames/fps/BabylonFpsGame.ts');const canvas=document.createElement('canvas');canvas.style.cssText='position:fixed;inset:0;width:100%;height:100%';document.body.append(canvas);
  const r=window.__weaponSplit=new BabylonFpsGame(canvas,Array.from({length:count},(_,i)=>({id:'p'+i,name:'GIOCATORE '+(i+1),color:['#45d3e8','#fd9577','#a78bfa','#a3e635','#fbbf24'][i]})),'cantiere');await r.ready;
  const snaps=window.__weaponSnapshots=Array.from({length:count},(_,i)=>({id:'p'+i,name:'GIOCATORE '+(i+1),color:'#62d5de',x:-12+i*5,z:-15,y:0,yaw:0,pitch:0,hp:100,maxHp:100,alive:true,kills:0,weaponId:'raffica',magazine:24,reloading:false,ads:0,recoilPitch:0,recoilYaw:0,heat:0,moving:0}));r.update(1/60,snaps);await Promise.all(r.cams.map(c=>c.vm.whenReady()));await new Promise(resolve=>setTimeout(resolve,150));r.update(1/60,snaps);await r.scene.whenReadyAsync();for(let n=0;n<60;n++)r.update(1/60,snaps);
  return{views:r.scene.activeCameras.length,models:r.cams.map(c=>({loaded:!!c.vm.current.imported,ownMask:c.vm.current.imported?.getChildMeshes().every(m=>m.layerMask===(1<<(15+c.index))),ownAvatarHidden:(c.camera.layerMask&(1<<(10+c.index)))===0})),remoteLoaded:[...r.avatars.values()].every(a=>!!a.weapon.visual)};
 },count);assert.equal(report.split.views,count);assert.ok(report.split.models.every(m=>m.loaded&&m.ownMask&&m.ownAvatarHidden)&&report.split.remoteLoaded);report.views.push(report.split);
 await sleep(300);await page.screenshot({path:out+'/framing-'+count+'-views.png'});}
 await page.setViewport({width:390,height:844});
 report.phone=await page.evaluate(async()=>{
  window.__weaponSplit.dispose();const{FpsClient}=await import('/src/controller/fpsClient.ts');const box=document.createElement('div');box.style.cssText='position:fixed;inset:0';document.body.append(box);const client=window.__weaponPhone=new FpsClient(box,'phone',()=>{},()=>null,'cantiere');client.vm.equip('pistola');const loaded=await client.vm.whenReady();for(let n=0;n<90;n++)client.vm.update(1/60,0,0,0,0,false);client.vm.fire();const result={loaded,model:client.vm.current.imported?.name,flash:client.vm.flash.isVisible};return result;
 });assert.ok(report.phone.loaded&&report.phone.flash);await sleep(500);await page.screenshot({path:out+'/framing-phone.png'});assert.deepEqual(errors,[]);console.log(JSON.stringify(report));
}finally{writeFileSync(out+'/framing-checks.json',JSON.stringify({...report,errors},null,2));await browser.close();}
