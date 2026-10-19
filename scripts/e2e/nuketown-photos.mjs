import{writeFileSync}from'node:fs';import assert from'node:assert/strict';
import{launch,sleep}from'./lib.mjs';
const browser=await launch(),out='docs/agent-work/nuketown';
try{
  const page=await browser.newPage();await page.goto('http://localhost:5180/?quality=high');
  await page.waitForFunction(()=>performance.getEntriesByType('resource').some(e=>e.name.includes('GameManager.ts')));
  const geometry=await page.evaluate(async()=>{
    const url=performance.getEntriesByType('resource').map(e=>e.name).find(n=>n.includes('GameManager.ts'));
    const{game:gm}=await import(url);while(!gm.game)await new Promise(r=>setTimeout(r,100));gm.game.loop.sleep();gm.game.canvas.style.display='none';
    const[{BabylonFpsGame},{NuketownArena}]=await Promise.all([import('/src/minigames/fps/BabylonFpsGame.ts'),import('/src/minigames/fps/nuketownArena.ts')]);
    const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;canvas.style.cssText='position:fixed;inset:0;width:100%;height:100%;z-index:10001';document.body.append(canvas);
    const r=window.__nukeRenderer=new BabylonFpsGame(canvas,[{id:'p0',name:'GOBLIN',color:'#54d5f0',characterId:'goblin'}],'nuketown');await r.ready;await r.scene.whenReadyAsync();
    r.engine.setHardwareScalingLevel(1);r.engine.setHardwareScalingLevel=()=>{};r.setPaused(true);
    const arena=window.__nukeArena=new NuketownArena();
    const snapshots=window.__nukeSnapshots=['goblin','buttafuori','judoka','dottore','ciro'].map((characterId,i)=>({id:'p'+i,name:characterId.toUpperCase(),displayName:characterId.toUpperCase(),characterId,color:['#54d5f0','#ff9866','#c29aff','#82e3b7','#f6d365'][i],x:[6,6,4,-12,-2][i],z:[-9,-3,-1,0,6][i],y:arena.floorAt([6,6,4,-12,-2][i],[-9,-3,-1,0,6][i])??0,yaw:i===0?0:Math.PI,pitch:0,hp:100,maxHp:100,alive:true,kills:i,weaponId:'mitraglia',magazine:30,reloading:false,ads:0,recoilPitch:0,recoilYaw:0,heat:0,moving:0}));
    r.update(1/60,snapshots.map((s,i)=>i===0?{...s,spawnProtection:1.5}:s));
    if(r.hud.get('p0').centerText.text!=='PROTETTO')throw new Error('spawn banner must fit small viewports');
    r.update(1/60,snapshots);
    const meshes=r.scene.meshes.filter(m=>m.name.startsWith('nuketownBatch:'));
    const bounds=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];for(const m of meshes){const b=m.getBoundingInfo().boundingBox;const lo=b.minimumWorld.asArray(),hi=b.maximumWorld.asArray();for(let i=0;i<3;i++){bounds[i]=Math.min(bounds[i],lo[i]);bounds[i+3]=Math.max(bounds[i+3],hi[i]);}}
    return{...r.scene.metadata.nuketown,bounds};
  });assert.equal(geometry.importedPrimitives,1374);assert.equal(geometry.triangles,16488);assert.ok(Math.abs(geometry.bounds[5]-40.74366)<.01);
  for(const mode of ['general','central','combat']){
    await page.evaluate(mode=>{
      const r=window.__nukeRenderer,cam=r.cams[0].camera;
      if(mode==='general'||mode==='central'){
        cam.fov=mode==='general'?.65:1.05;cam.layerMask=0x00007fff;cam.position.set(...(mode==='general'?[43,63,83]:[18,18,14]));cam.setTarget(cam.position.clone().set(-3,mode==='general'?0:1,mode==='general'?0:-2));
      }else{
        cam.fov=1.05;cam.layerMask=r.cams[0].camera.__originalMask??((0x0fffffff&~(0x1f<<20)&~(0x1f<<15)&~(0x1f<<5)&~(1<<10))|(1<<20)|(1<<15)|(1<<5));
        r.update(1/60,window.__nukeSnapshots);
        r.notifyShot('p0','mitraglia',[{ox:6,oy:1.59,oz:-9,ex:6,ey:1.25,ez:-3}]);
      }
      r.scene.render();r.scene.render();
    },mode);await sleep(100);await page.screenshot({path:`${out}/${mode}.png`});
  }
  writeFileSync(out+'/render-alignment.json',JSON.stringify(geometry,null,2));console.log(JSON.stringify(geometry));
}finally{await browser.close();}
