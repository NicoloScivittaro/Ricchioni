import {buildGolfClub} from './minigolfArt';
import {selectCourses} from './minigolfCourses';
import {Engine,Scene,FreeCamera,HemisphericLight,DirectionalLight,ShadowGenerator,Vector3,Color4,Color3,MeshBuilder,StandardMaterial,DynamicTexture,TransformNode} from '@babylonjs/core';
import {MinigolfCamera} from './minigolfCamera';
import type {MinigameContext} from '../types';
import {MinigolfMatch} from './minigolfRules';
import {MinigolfBot} from './minigolfBot';
import {MinigolfHud} from './minigolfHud';
import {MinigolfVisuals} from './minigolfVisuals';
import {GOLF} from './minigolfTypes';
import type {GolfPlayer,GolfEvent} from './minigolfTypes';
import {speed} from './minigolfPhysics';
import {abilityStatus} from './minigolfAbilities';
import {abilityHub} from '../../core/abilityHub';
import {audio} from '../../core/AudioManager';
import {applyQuality,engineOptions} from '../../core/quality';
import {guardLoop,safely} from '../../core/loopGuard';
import {runSteps} from '../../core/frameClock';
import {setGameIntensity} from '../../core/musicDirector';
import {ArenaEntity} from '../arena/arenaEntity';
export class BabylonMinigolfGame {
 readonly engine:Engine;readonly scene:Scene;readonly match:MinigolfMatch;
 readonly hud:MinigolfHud;readonly visuals:MinigolfVisuals;
 readonly entities=new Map<string,ArenaEntity>();
 private clubs=new Map<string,TransformNode>();private swings=new Map<string,number>();
 readonly camera:FreeCamera;readonly cameraRig:MinigolfCamera;private bots:MinigolfBot;private disposed=false;private paused=false;
 private controlsReady=false;private courseIndex=-1;private courseId='';private resultsSent=false;private resultTime=8;
 private signals=new Map<string,string>();private lastFeed=-Infinity;private clock=0;private turn=-1;private drag={x:0,y:0};private cameraCancelVersion=-1;
 private characterElapsed=0;
 private onResize=()=>{this.engine.resize();};
 constructor(canvas:HTMLCanvasElement,private ctx:MinigameContext){
  const opts=engineOptions();this.engine=new Engine(canvas,opts.antialias,opts);this.scene=new Scene(this.engine);
  this.scene.skipPointerMovePicking=true; // Le mosse arrivano da InputManager, non dal picking delle mesh.
  this.scene.clearColor=new Color4(.73,.84,.88,1);this.scene.ambientColor=new Color3(.035,.045,.045);
  this.cameraRig=new MinigolfCamera(this.scene);this.camera=this.cameraRig.camera;
  const sky=new HemisphericLight('golfSky',new Vector3(0,1,0),this.scene);sky.intensity=.68;sky.groundColor=new Color3(.24,.28,.23);sky.diffuse=new Color3(.88,.95,1);
  const sun=new DirectionalLight('golfSun',new Vector3(-.4,-1,.4),this.scene);sun.position.set(8,25,-12);sun.intensity=1.05;sun.diffuse=new Color3(1,.94,.81);sun.shadowMinZ=1;sun.shadowMaxZ=110;sun.autoCalcShadowZBounds=true;
  const shadows=new ShadowGenerator(1024,sun);shadows.usePercentageCloserFiltering=true;shadows.filteringQuality=ShadowGenerator.QUALITY_MEDIUM;shadows.bias=.0008;shadows.normalBias=.025;shadows.setDarkness(.2);
  const dot=new DynamicTexture('golfDot',16,this.scene,false),d=dot.getContext();d.fillStyle='#ffffff';d.fillRect(0,0,16,16);dot.update();
  this.match=new MinigolfMatch(ctx.players,()=>ctx.rng.next(),ctx.mapId?selectCourses(()=>ctx.rng.next(),undefined,ctx.mapId):undefined);this.bots=new MinigolfBot(()=>ctx.rng.next());
  this.hud=new MinigolfHud(this.scene,this.match);this.visuals=new MinigolfVisuals(this.scene,this.match.players,shadows);
  abilityHub.begin('minigolf',ctx);
  const metal=new StandardMaterial('golfClubMetal',this.scene);metal.diffuseColor=Color3.FromHexString('#e2edf6');metal.specularColor=Color3.White();
  for(const [i,p] of this.match.players.entries()){
   const snap=ctx.players[i],e=new ArenaEntity(this.scene,dot,p.color,p.characterId,snap.avatar,p.name,null,{nameplate:false});
   e.setSizeMul(.85);this.entities.set(p.id,e);e.root.getChildMeshes().forEach(m=>shadows.addShadowCaster(m));
   const grip=new TransformNode(`golfClub:${p.id}`,this.scene),shaft=MeshBuilder.CreateCylinder('clubShaft',{height:1.05,diameter:.04},this.scene);shaft.parent=grip;shaft.position.y=-.525;shaft.material=metal;
   const head=MeshBuilder.CreateBox('putterHead',{width:.38,height:.14,depth:.17},this.scene);head.parent=grip;head.position.set(.11,-1.03,0);head.material=metal;this.clubs.set(p.id,grip);
  }
  buildGolfClub(this.scene);
  this.syncCourse();applyQuality(this.engine,this.scene);
  this.engine.runRenderLoop(guardLoop(()=>{if(this.disposed||this.paused)return;runSteps(this.engine.getDeltaTime(),dt=>this.step(dt));this.scene.render();}));
  window.addEventListener('resize',this.onResize);
  void (ctx.showControls?.()??Promise.resolve()).then(()=>{if(this.disposed)return;this.controlsReady=true;ctx.input.reset();this.match.cancelAll();});
 }
 get phase():string{return this.match.phase;}
 get players():GolfPlayer[]{return this.match.players;}
 setPaused(on:boolean):void{this.paused=on;this.match.cancelAll();for(const p of this.players)this.ctx.input.cancelPlayer(p.id);}
 private syncCourse():void {if(this.courseIndex===this.match.courseIndex&&this.courseId===this.match.course.id)return;this.courseIndex=this.match.courseIndex;this.courseId=this.match.course.id;this.visuals.build(this.match.course);this.signals.clear();this.ctx.input.reset();this.cameraRig.reset();this.drag={x:0,y:0};this.cameraCancelVersion=-1;}
 step(dt:number):void{
  if(this.disposed||this.paused)return;this.clock+=dt;
  if(this.controlsReady&&!this.resultsSent){
   for(const p of this.players){
    const input=this.ctx.input.get(p.id),aim=input.axis('aim');
    const yaw=Math.atan2(p.aim.x,p.aim.z)+aim.x*dt*(aim.y<-.5?.65:1.7);
    const command=p.bot&&p===this.match.active?this.bots.command(p,this.match.course,dt):{aim:{x:Math.sin(yaw),z:Math.cos(yaw)},pressed:input.justPressed('shoot'),held:input.pressed('shoot'),released:input.justReleased('shoot'),cancel:input.justPressed('cancel'),ability:input.justPressed('ability'),version:input.cancellationVersion};
    this.match.command(p,command,dt);
    if(p===this.match.active&&!p.bot){const orbit=input.axis('camera');this.cameraRig.control(orbit.x,orbit.y,input.pressed('overview'),dt);
     const drag=input.axis('cameraDrag'),wrap=(n:number)=>(n+3)%2-1;
     if(this.cameraCancelVersion!==input.cancellationVersion){this.drag={...drag};this.cameraCancelVersion=input.cancellationVersion;}
     this.cameraRig.orbit+=wrap(drag.x-this.drag.x)*Math.PI;this.cameraRig.pitch=Math.max(.18,Math.min(.7,this.cameraRig.pitch-wrap(drag.y-this.drag.y)*.6));this.drag={...drag};
    }
   }
   this.match.advance(dt);this.syncCourse();
   if(this.turn!==this.match.turn){this.turn=this.match.turn;this.drag={x:0,y:0};for(const p of this.players)this.ctx.input.cancelPlayer(p.id);this.signals.clear();this.hud.feedback(`TOCCA A ${this.match.active.name}`,this.match.active.color);}
  }
  for(const e of this.match.events)this.event(e);this.match.events=[];
  this.visuals.update(this.players,this.match.course,this.match.time,this.match.extras,dt,this.match.active.id,this.match.aiming);
  this.cameraRig.update(this.match.active,this.match.course,this.match.time,this.match.extras,this.match.stage==='rolling',dt);
  this.updateCharacters(dt);this.hud.update(this.match,dt);
  if(!this.controlsReady)this.hud.adt.getControlByName('golfPhase')!.isVisible=false;
  else this.hud.adt.getControlByName('golfPhase')!.isVisible=true;
  for(const p of this.players){
   abilityHub.setStatus(p.id,abilityStatus(p,this.match.time,this.match.extras));
   const available=this.controlsReady&&this.phase==='playing'&&!p.finished&&p===this.match.active&&this.match.stage!=='switch';
   const ready=available&&this.match.aiming&&p.ball.readyFor>=.18;
   const key=`${Math.floor(this.clock)}|${this.match.turn}|${this.match.stage}|${Math.floor(this.match.aimRemaining*5)}|${available}|${p.finished}|${p.strokes}|${p.charging}|${Math.floor(p.charge*20)}|${ready}`;
   if(this.signals.get(p.id)!==key){this.signals.set(p.id,key);
    this.ctx.signal(p.id,{type:'minigolfStatus',available,ready,charge:p.charging?p.charge:null,strokes:p.strokes,total:p.total+(p.finished||this.match.playoff?0:p.strokes),hole:this.match.holeNumber,holes:this.match.courses.length,seconds:Math.ceil(this.match.remaining),phase:this.phase,playoff:this.match.playoff,finished:p.finished,records:p.records,ability:abilityStatus(p,this.match.time,this.match.extras),activeName:this.match.active.name,stage:this.match.stage,aimSeconds:this.match.aimRemaining,maxStrokes:this.match.course.maxStrokes,rank:this.match.rankOf(p),course:this.match.course.name,par:this.match.course.par,distance:Math.hypot(p.ball.x-this.match.course.hole.x,p.ball.z-this.match.course.hole.z)});
    this.ctx.sendPrivate(p.id,{type:'ability',game:'minigolf',status:abilityStatus(p,this.match.time,this.match.extras)});}
  }
  setGameIntensity(this.match.remaining<8?2:1);
  if(this.phase==='ended'&&!this.resultsSent){this.resultTime-=dt;if(this.resultTime<=0){this.resultsSent=true;this.ctx.finish({results:this.match.results()});}}
  this.ctx.input.update();
 }
 private updateCharacters(dt:number):void{
  this.characterElapsed+=dt;
  const visible=this.phase==='intro'||this.phase==='ended',animate=visible||this.characterElapsed>=.25;
  const visualDt=this.characterElapsed;if(animate)this.characterElapsed=0;
  for(const [i,p] of this.players.entries()){
   const e=this.entities.get(p.id)!,club=this.clubs.get(p.id)!;
   if(e.root.isEnabled()!==visible)e.root.setEnabled(visible);
   const swing=Math.max(0,(this.swings.get(p.id)??0)-dt);this.swings.set(p.id,swing);
   if(!visible){if(club.isEnabled())club.setEnabled(false);if(!animate)continue;}
   const b=p.ball,ready=!p.finished&&b.grounded&&speed(b)<GOLF.readySpeed;
   const x=ready?b.x-p.aim.z*.95:-13,z=ready?b.z+p.aim.x*.95:9-i*2.2,y=ready?b.y-GOLF.radius:0;
   // I personaggi nascosti avanzano i timer senza animare tutti i rig a ogni fotogramma.
   e.updateVisual({x,y,z,vx:0,vz:0,facing:Math.atan2(p.aim.x,p.aim.z),alive:true,falling:false,spin:0,dashing:false,stunTime:0,hitFlash:0},visualDt,performance.now());
   if(!visible)continue;
   e.root.rotation.x=p.charging?.12+p.charge*.1:swing>0?Math.sin(swing*12)*.12:0;
   e.root.computeWorldMatrix(true);const hand=e.rightHandPosition();club.position.copyFrom(hand);
   club.rotation.set(0,Math.atan2(p.aim.x,p.aim.z),p.charging?-.4-p.charge*.6:swing>0?Math.sin(swing*12)*1.15:.15);
   club.setEnabled((this.phase==='intro'||this.phase==='ended')&&(ready||swing>0));
  }
 }
 private event(ev:GolfEvent):void{
  const p=this.players.find(p=>p.id===ev.id);this.visuals.event(ev,this.players);if(!p&&ev.type!=='last')return;
  const pan=Math.max(-.8,Math.min(.8,ev.x/14));
  if(ev.type==='shot'){audio.playTone(420,.065,'triangle',.06);this.swings.set(ev.id,.45);this.ctx.vibrate(ev.id,35);}
  if(ev.type==='wall'||ev.type==='bumper'||ev.type==='ball')audio.bounce(Math.min(1.2,(ev.value??1)/8),pan);
  if(ev.type==='hole'){audio.playTone(660,.13,'triangle',.07);audio.playTone(880,.2,'sine',.05);this.entities.get(ev.id)?.celebrate(2);this.ctx.vibrate(ev.id,100);}
  if(ev.type==='fall'||ev.type==='penalty')audio.playTone(160,.16,'triangle',.05);
  if(ev.type==='fall'||ev.type==='limit')this.entities.get(ev.id)?.playDefeat(1.4);
  if(ev.type==='ability'){if(ev.other){abilityHub.failed(ev.id,ev.other);return;}abilityHub.activated(ev.id);this.entities.get(ev.id)?.playAbility();}
  if(this.clock-this.lastFeed<1.2&&ev.type!=='hole')return;
  const name=p?.name??'';let text='';
  if(ev.type==='hole')text=p!.holeShots===1&&p!.penalties===0?`${name}: MA CHE CULO! · HOLE IN ONE`:`${name}: IMBUCATA · ${p!.strokes} COLPI`;
  if(ev.type==='fall')text=ev.value?`${name}: FUORI PISTA · TORNA ALLA PARTENZA · +1`:`${name}: BOCCIATA FUORI · PARTENZA, SENZA PENALITÀ`;
  if(ev.type==='ball')text="N'CULO, TE L'HO LEVATA!";
  if(ev.type==='wall'&&p!.ball.bounceCount===3)text='MA CHE È, UN FLIPPER?!';
  if(ev.type==='limit')text=`${name}: CAMBIA SPORT, VA'! · ${p!.strokes} COLPI`;
  if(ev.type==='penalty')text=ev.other?`${name}: ${ev.other}`:`${name}: IL DEBITO È ARRIVATO · +${ev.value}`;
  if(ev.type==='stuck')text=`${name}: PALLINA SBLOCCATA · NESSUNA PENALITÀ`;
  if(ev.type==='last')text='DAJE CHE FINISCE ER TEMPO!';
  if(text){this.hud.feedback(text);this.lastFeed=this.clock;}
 }
 dispose():void {
  if(this.disposed)return;this.disposed=true;this.match.cancelAll();window.removeEventListener('resize',this.onResize);abilityHub.end();
  safely('golf entities',()=>this.entities.forEach(e=>e.dispose()));safely('golf clubs',()=>this.clubs.forEach(c=>c.dispose()));
  safely('golf visuals',()=>this.visuals.dispose());safely('golf HUD',()=>this.hud.dispose());this.engine.stopRenderLoop();this.scene.dispose();this.engine.dispose();
 }
}
