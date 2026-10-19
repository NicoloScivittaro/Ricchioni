import {writeFileSync} from 'node:fs';
import {launch,sleep} from './lib.mjs';
const browser=await launch();
try{
 const page=await browser.newPage();page.on('pageerror',e=>console.log('PAGEERROR '+e.stack));
 await page.goto('http://localhost:5180/?quality=high');
 const info=await page.evaluate(async()=>{
  const [{BabylonKartGame},{InputManager},{Rng},{game:gm}]=await Promise.all([import('/src/minigames/kart-race/BabylonKartGame.ts'),import('/src/network/InputManager.ts'),import('/shared/rng.ts'),import('/src/core/GameManager.ts')]);
  gm.game.loop.sleep();gm.game.canvas.style.display='none';
  const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;canvas.style.cssText='position:fixed;inset:0;width:100%;height:100%;z-index:10001';document.body.append(canvas);
  const players=['goblin','buttafuori','judoka','dottore','ciro'].map((characterId,i)=>({id:'s'+i,characterId,displayName:characterId,color:['#62c9ff','#ef668f','#e8b558','#64dbad','#af8df1'][i],avatar:'',bot:false,score:0,connected:true,ready:true}));
  const game=window.__sydneyGame=new BabylonKartGame(canvas,{kartTrackId:'sydney',players,playerIds:players.map(p=>p.id),input:new InputManager(),rng:new Rng(319),durationSec:230,modifier:null,modifiers:new Map(),consume:()=>false,sendPrivate:()=>{},vibrate:()=>{},signal:()=>{},finish:r=>window.__result=r});
  game.paused=true;await game.ready;await game.scene.whenReadyAsync();
  game.hud.setCountdown('');game.cameraManager.applyLayout(['s0']);game.hud.layout(['s0']);const cam=game.cameraManager.rigs.get('s0').camera;cam.layerMask=0x000fffff;cam.position.set(-100,420,350);cam.maxZ=6000;cam.setTarget(game.spline.positionAt(0).clone().set(-70,0,-100));game.scene.render();game.scene.render();
  return {length:game.spline.totalLength,gap:game.sydney.gaps,checkpoints:game.checkpoints,meshes:game.scene.meshes.length,asset:game.scene.meshes.filter(m=>m.name.startsWith('N_Road')).map(m=>({name:m.name,min:m.getBoundingInfo().boundingBox.minimumWorld.asArray(),max:m.getBoundingInfo().boundingBox.maximumWorld.asArray(),sub:m.subMeshes.length})),renderer:game.engine.getGlInfo()};
 });
 await sleep(500);await page.screenshot({path:'docs/agent-work/sydney-sprint/general.png'});console.log(JSON.stringify(info));writeFileSync('docs/agent-work/sydney-sprint/inspection.json',JSON.stringify(info,null,2));
}finally{await browser.close();}
