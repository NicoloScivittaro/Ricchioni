import {Engine,Scene,ArcRotateCamera,HemisphericLight,DirectionalLight,ShadowGenerator,Vector3,Color4,Color3,MeshBuilder,StandardMaterial,DynamicTexture,TransformNode} from '@babylonjs/core';
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
 private camera:ArcRotateCamera;private bots:MinigolfBot;private disposed=false;private paused=false;
 private controlsReady=false;private courseIndex=-1;private resultsSent=false;private resultTime=1.8;
 private signals=new Map<string,string>();private lastFeed=-Infinity;private clock=0;
 private onResize=()=>{this.engine.resize();this.fitCamera();};
 constructor(canvas:HTMLCanvasElement,private ctx:MinigameContext){
  const opts=engineOptions();this.engine=new Engine(canvas,opts.antialias,opts);this.scene=new Scene(this.engine);
  this.scene.clearColor=new Color4(.12,.22,.30,1);this.scene.ambientColor=new Color3(.24,.24,.24);
  this.camera=new ArcRotateCamera('golfCamera',Math.PI/2,.58,64,new Vector3(0,1,0),this.scene);this.camera.inputs.clear();this.camera.fov=.75;
  new HemisphericLight('golfSky',new Vector3(0,1,0),this.scene).intensity=.75;
  const sun=new DirectionalLight('golfSun',new Vector3(-.4,-1,.4),this.scene);sun.position.set(8,25,-12);sun.intensity=.85;
  const shadows=new ShadowGenerator(1024,sun);shadows.useBlurExponentialShadowMap=true;shadows.blurKernel=8;
  const dot=new DynamicTexture('golfDot',16,this.scene,false),d=dot.getContext();d.fillStyle='#ffffff';d.fillRect(0,0,16,16);dot.update();
  this.match=new MinigolfMatch(ctx.players,()=>ctx.rng.next());this.bots=new MinigolfBot(()=>ctx.rng.next());
  this.hud=new MinigolfHud(this.scene,this.match);this.visuals=new MinigolfVisuals(this.scene,this.match.players,shadows);
  abilityHub.begin('minigolf',ctx);
  const metal=new StandardMaterial('golfClubMetal',this.scene);metal.diffuseColor=Color3.FromHexString('#e2edf6');metal.specularColor=Color3.White();
  for(const [i,p] of this.match.players.entries()){
   const snap=ctx.players[i],e=new ArenaEntity(this.scene,dot,p.color,p.characterId,snap.avatar,p.name,null,{nameplate:false});
   e.setSizeMul(.85);this.entities.set(p.id,e);e.root.getChildMeshes().forEach(m=>shadows.addShadowCaster(m));
   const grip=new TransformNode(`golfClub:${p.id}`,this.scene),shaft=MeshBuilder.CreateCylinder('clubShaft',{height:1.05,diameter:.04},this.scene);shaft.parent=grip;shaft.position.y=-.525;shaft.material=metal;
   const head=MeshBuilder.CreateBox('putterHead',{width:.38,height:.14,depth:.17},this.scene);head.parent=grip;head.position.set(.11,-1.03,0);head.material=metal;this.clubs.set(p.id,grip);
  }
  const sea=MeshBuilder.CreateGround('sea',{width:100,height:100},this.scene),seaMat=new StandardMaterial('golfSea',this.scene);sea.position.y=-2.8;seaMat.diffuseColor=Color3.FromHexString('#207e9b').toLinearSpace();seaMat.specularColor=Color3.FromHexString('#5fabc3').toLinearSpace();sea.material=seaMat;
  // Decorations live outside the collision course: a little seaside club house and lights.
  const decor=new StandardMaterial('golfDecor',this.scene);decor.diffuseColor=Color3.FromHexString('#edbe78');
  for(const x of [-15,15])for(const z of [-12,0,12]){const pole=MeshBuilder.CreateCylinder('golfLamp',{height:3,diameter:.1},this.scene);pole.position.set(x,-.3,z);pole.material=metal;const top=MeshBuilder.CreateSphere('golfLampGlow',{diameter:.5,segments:8},this.scene);top.position.set(x,1.3,z);top.material=decor;}
  this.syncCourse();applyQuality(this.engine,this.scene);this.fitCamera();
  this.engine.runRenderLoop(guardLoop(()=>{if(this.disposed||this.paused)return;runSteps(this.engine.getDeltaTime(),dt=>this.step(dt));this.scene.render();}));
  window.addEventListener('resize',this.onResize);
  void (ctx.showControls?.()??Promise.resolve()).then(()=>{if(this.disposed)return;this.controlsReady=true;ctx.input.reset();this.match.cancelAll();});
 }
 get phase():string{return this.match.phase;}
 get players():GolfPlayer[]{return this.match.players;}
 setPaused(on:boolean):void{this.paused=on;this.match.cancelAll();for(const p of this.players)this.ctx.input.cancelPlayer(p.id);}
 private fitCamera():void{
  const aspect=this.engine.getAspectRatio(this.camera),tan=Math.tan(this.camera.fov/2),sin=Math.sin(this.camera.beta),cos=Math.cos(this.camera.beta);
  let radius=30;for(const x of [-11.5,11.5])for(const z of [-14.5,14.5])for(const y of [0,3.6]){
   const yy=y-1,depth=cos*yy+sin*z;radius=Math.max(radius,Math.abs(x)/(tan*aspect*.89)+depth,Math.abs(sin*yy-cos*z)/(tan*.73)+depth);}
  this.camera.radius=radius;
 }
 private syncCourse():void {if(this.courseIndex===this.match.courseIndex)return;this.courseIndex=this.match.courseIndex;this.visuals.build(this.match.course);this.signals.clear();this.ctx.input.reset();}
 step(dt:number):void{
  if(this.disposed||this.paused)return;this.clock+=dt;
  if(this.controlsReady&&!this.resultsSent){
   for(const p of this.players){
    const input=this.ctx.input.get(p.id),aim=input.axis('aim');
    // Camera at +Z looks toward -Z: screen-right is world -X. Bots use world coordinates.
    const command=p.bot?this.bots.command(p,this.match.course,dt):{aim:{x:-aim.x,z:aim.y},pressed:input.justPressed('shoot'),held:input.pressed('shoot'),released:input.justReleased('shoot'),cancel:input.justPressed('cancel'),ability:input.justPressed('ability'),version:input.cancellationVersion};
    this.match.command(p,command,dt);
   }
   this.match.advance(dt);this.syncCourse();
  }
  for(const e of this.match.events)this.event(e);this.match.events=[];
  this.visuals.update(this.players,this.match.course,this.match.time,this.match.extras,dt);
  this.updateCharacters(dt);this.hud.update(this.match,dt);
  if(!this.controlsReady)this.hud.adt.getControlByName('golfPhase')!.isVisible=false;
  else this.hud.adt.getControlByName('golfPhase')!.isVisible=true;
  for(const p of this.players){
   abilityHub.setStatus(p.id,abilityStatus(p,this.match.time,this.match.extras));
   const available=this.controlsReady&&this.phase==='playing'&&!p.finished;
   const key=`${Math.floor(this.clock)}|${this.courseIndex}|${available}|${p.finished}|${p.strokes}|${p.charging}|${Math.floor(p.charge*20)}|${p.ball.readyFor>=.18}`;
   if(this.signals.get(p.id)!==key){this.signals.set(p.id,key);this.ctx.signal(p.id,{type:'minigolfStatus',available,ready:p.ball.readyFor>=.18,charge:p.charging?p.charge:null,strokes:p.strokes,total:p.total,hole:this.courseIndex+1,finished:p.finished,ability:abilityStatus(p,this.match.time,this.match.extras)});
    this.ctx.sendPrivate(p.id,{type:'ability',game:'minigolf',status:abilityStatus(p,this.match.time,this.match.extras)});}
  }
  setGameIntensity(this.match.remaining<8?2:1);
  if(this.phase==='ended'&&!this.resultsSent){this.resultTime-=dt;if(this.resultTime<=0){this.resultsSent=true;this.ctx.finish({results:this.match.results()});}}
  this.ctx.input.update();
 }
 private updateCharacters(dt:number):void{
  for(const [i,p] of this.players.entries()){
   const e=this.entities.get(p.id)!,b=p.ball,ready=!p.finished&&b.grounded&&speed(b)<GOLF.readySpeed;
   const x=ready?b.x-p.aim.z*.95:-13,z=ready?b.z+p.aim.x*.95:9-i*2.2,y=ready?b.y-GOLF.radius:0;
   e.updateVisual({x,y,z,vx:0,vz:0,facing:Math.atan2(p.aim.x,p.aim.z),alive:true,falling:false,spin:0,dashing:false,stunTime:0,hitFlash:0},dt,performance.now());
   const swing=Math.max(0,(this.swings.get(p.id)??0)-dt);this.swings.set(p.id,swing);
   e.root.rotation.x=p.charging?.12+p.charge*.1:swing>0?Math.sin(swing*12)*.12:0;
   e.root.computeWorldMatrix(true);const hand=e.rightHandPosition(),club=this.clubs.get(p.id)!;club.position.copyFrom(hand);
   club.rotation.set(0,Math.atan2(p.aim.x,p.aim.z),p.charging?-.4-p.charge*.6:swing>0?Math.sin(swing*12)*1.15:.15);
   club.setEnabled(ready||swing>0);
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
  if(ev.type==='fall')text=`${name}: AO', MA DOVE L'HAI MANNATA?! · +1`;
  if(ev.type==='ball')text="N'CULO, TE L'HO LEVATA!";
  if(ev.type==='wall'&&p!.ball.bounceCount===3)text='MA CHE È, UN FLIPPER?!';
  if(ev.type==='limit')text=`${name}: CAMBIA SPORT, VA'! · ${p!.strokes} COLPI`;
  if(ev.type==='penalty')text=`${name}: IL DEBITO È ARRIVATO · +${ev.value}`;
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
