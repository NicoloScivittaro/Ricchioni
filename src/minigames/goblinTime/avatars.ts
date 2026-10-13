import { Color4, DynamicTexture, Engine, FreeCamera, HemisphericLight, Scene, Vector3 } from '@babylonjs/core';
import { ArenaEntity } from '../arena/arenaEntity';
import type { VisualSubject } from '../arena/arenaEntity';
import { presentationOf } from '../../../shared/characterPresentation';
import type { PublicState, Seat } from '../../../shared/goblinTime/types';
/** Riusa i rig procedurali e le animazioni esistenti per le miniature del tavolo. Nessun GLB pesante o dato privato. */
export class GoblinAvatars {
  private canvas=document.createElement('canvas');private engine:Engine;private scene:Scene;
  private actors=new Map<string,{entity:ArenaEntity;pose:VisualSubject}>();private paused=false;private resize:()=>void;
  constructor(hostCanvas:HTMLCanvasElement,seats:Seat[]) {
    this.canvas.id='goblin-avatars';this.canvas.style.cssText='position:fixed;pointer-events:none;z-index:3;';document.body.appendChild(this.canvas);
    this.engine=new Engine(this.canvas,true,{preserveDrawingBuffer:false,stencil:true,alpha:true});this.scene=new Scene(this.engine);this.scene.clearColor=new Color4(0,0,0,0);
    const camera=new FreeCamera('goblinTableFaces',new Vector3(0,0,-20),this.scene);camera.setTarget(Vector3.Zero());camera.mode=FreeCamera.ORTHOGRAPHIC_CAMERA;camera.orthoLeft=-6.4;camera.orthoRight=6.4;camera.orthoTop=3.6;camera.orthoBottom=-3.6;
    const light=new HemisphericLight('goblinFaceLight',new Vector3(-.4,1,-1),this.scene);light.intensity=1.15;
    const dot=new DynamicTexture('goblinDot',32,this.scene,false);const ctx=dot.getContext();ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(16,16,14,0,Math.PI*2);ctx.fill();dot.update();
    for(const seat of seats){const p=presentationOf(seat.characterId);const entity=new ArenaEntity(this.scene,dot,p?.accent??'#aaa',seat.characterId,p?.icon??'',seat.name,null,{nameplate:false,context:'gallery',goblinMode:'old',judokaMode:'old',buttafuoriMode:'old',ciroMode:'old'});entity.setSizeMul(.32);
      this.actors.set(seat.id,{entity,pose:{x:0,y:0,z:0,vx:0,vz:0,facing:Math.PI,alive:true,falling:false,spin:0,dashing:false,stunTime:0,hitFlash:0,grounded:true}});
    }
    this.resize=()=>{const r=hostCanvas.getBoundingClientRect();Object.assign(this.canvas.style,{left:`${r.left}px`,top:`${r.top}px`,width:`${r.width}px`,height:`${r.height}px`});this.engine.setSize(Math.max(1,Math.round(r.width)),Math.max(1,Math.round(r.height)));};window.addEventListener('resize',this.resize);this.resize();
    this.engine.runRenderLoop(()=>{if(this.paused)return;const dt=Math.min(.05,this.engine.getDeltaTime()/1000);for(const {entity,pose}of this.actors.values())entity.updateVisual(pose,dt,performance.now());this.scene.render();});
  }
  update(s:PublicState,positions:Map<string,{x:number;y:number}>):void {this.paused=s.paused;this.canvas.style.visibility=s.paused||s.phase==='finished'?'hidden':'visible';for(const p of s.players){const actor=this.actors.get(p.id),pos=positions.get(p.id);if(actor&&pos){actor.pose.x=(pos.x-65-640)/100;actor.pose.y=(360-(pos.y+5))/100;}}}
  animate(e:PublicState['log'][number]):void {const actor=e.from?this.actors.get(e.from):null;if(!actor)return;if(e.kind==='ability')actor.entity.playAbility();else if(e.kind==='declare')actor.entity.celebrate(2);else if(e.kind==='play')actor.entity.playPickup();}
  dispose():void {window.removeEventListener('resize',this.resize);this.engine.stopRenderLoop();for(const a of this.actors.values())a.entity.dispose();this.scene.dispose();this.engine.dispose();this.canvas.remove();}
}
