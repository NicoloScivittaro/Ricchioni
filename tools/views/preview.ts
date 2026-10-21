import {humanViewPlayers} from '../../src/core/playerViews';
import {Rng} from '../../shared/rng';
import {InputManager} from '../../src/network/InputManager';
import type {MinigameContext} from '../../src/minigames/types';
const query=new URLSearchParams(location.search),count=Number(query.get('humans')??3),kind=query.get('game')??'backrooms',slots=[0,2,4,1,3].slice(0,count);
const players=['Niko','Boschi','Goblin','Carbo','Bona'].map((name,i)=>({id:'view'+i,bot:!slots.includes(i),name,displayName:name,color:['#f6c977','#86d4d2','#acb6f2','#ef9aa2','#bce09e'][i],characterId:null,roleTitle:'',avatar:'',quote:'',score:0}));
const ctx:MinigameContext={players,playerIds:players.map(p=>p.id),rng:new Rng(8492),input:new InputManager(),durationSec:180,modifier:null,modifiers:new Map(),consume:()=>false,sendPrivate:()=>{},vibrate:()=>{},signal:()=>{},finish:()=>{},showControls:async()=>{}};
const canvas=document.querySelector('canvas')!;let game:any;
if(kind==='backrooms'){
 const {BabylonBackroomsGame}=await import('../../src/minigames/backrooms/BabylonBackroomsGame');ctx.mapId='lobby';game=new BabylonBackroomsGame(canvas,ctx);await game.ready;game.engine.stopRenderLoop();game.step(.016);game.setPaused(true);game.scene.render();
}else if(kind==='fps'){
 const {BabylonFpsGame}=await import('../../src/minigames/fps/BabylonFpsGame');game=new BabylonFpsGame(canvas,humanViewPlayers(players).map(p=>({...p,name:p.displayName})));
 await game.ready;const snapshots=players.map((p,i)=>({...p,x:(i-2)*3,z:-10,y:0,yaw:0,pitch:0,hp:100,maxHp:100,alive:true,kills:0,weaponId:'pistola',magazine:12,reloading:false,ads:0,recoilPitch:0,recoilYaw:0,heat:0,moving:0}));game.update(.016,snapshots);await Promise.all(game.cams.map((r:any)=>r.vm.whenReady()));for(let i=0;i<30;i++)game.update(.025,snapshots);game.setPaused(true);game.scene.render();
}else if(kind==='kart'){
 const {BabylonKartGame}=await import('../../src/minigames/kart-race/BabylonKartGame');game=new BabylonKartGame(canvas,ctx);await game.ready;game.setPaused(true);game.present(.016);game.scene.render();
}else throw Error('Unknown fixture game');
await game.scene.whenReadyAsync();game.scene.render();
(window as any).fixture={game,ctx,humans:humanViewPlayers(players).map(p=>p.id),kind,dispose:()=>game.dispose()};(window as any).ready=true;
