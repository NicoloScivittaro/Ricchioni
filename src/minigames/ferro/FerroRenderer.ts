import{Engine,Scene,UniversalCamera,ArcRotateCamera,Vector3,Color3,Color4,HemisphericLight,DirectionalLight,Viewport,Mesh,MeshBuilder,TransformNode,DynamicTexture,StandardMaterial,Matrix}from'@babylonjs/core';
import type{PlayerSnapshot}from'../../../shared/types';
import type{FerroState,FerroEvent,Warrior,V3,ArenaId,GuardDirection}from'../../../shared/ferro/types';
import{WEAPONS,weapon,activeWindow,attackSpec,TRAITS,FERRO_RULES}from'../../../shared/ferro/weapons';
import{weaponArt}from'../../../shared/ferro/art';
import{RADIUS,wallDistance,clamp}from'../../../shared/ferro/arena';
import{worldPoint,activeBlade}from'../../../shared/ferro/pose';
import{humanViewPlayers,splitScreenLayout}from'../../core/playerViews';
import{FerroActor}from'./FerroActor';
import{loadFerroAssets,SWORD_MODELS,SHIELD_MODELS,AXE_NAMES}from'./FerroAssets';
import{arenaRadius,floorAt}from'../../../shared/ferro/terrain';
import{incomingDirection}from'../../../shared/ferro/directions';
import{distance,visible,angle}from'../../../shared/ferro/arena';
import{FerroWorld}from'./FerroWorld';
import{FerroAudio}from'./FerroAudio';
import{cloneFerroModel,alignSegment,ferroMaterial}from'./FerroWeapons';
import{prepareVisuals}from'../../core/visualAssets';
import{GuardIndicator}from'./FerroGuard';
import type{GuardFlash}from'./FerroGuard';
import{contactMaterial,contactAge}from'../../../shared/ferro/clash';
import'./FerroRenderer.css';
interface Rig{id:string;subject?:string;camera:UniversalCamera;position:Vector3;look:Vector3;initialized:boolean;panel:HTMLDivElement;hp:HTMLElement;stamina:HTMLElement;numbers:HTMLElement;meta:HTMLElement;clock:HTMLElement;special:HTMLElement;message:HTMLElement;reticle:HTMLElement;charge:HTMLElement;chargeBar:HTMLElement;flash:HTMLElement;hit:HTMLElement;hitTime:number;note:string;noteTime:number;guide:Mesh;targetMark?:Mesh;occluding?:boolean;me:GuardIndicator;foe:GuardIndicator;meHint:HTMLElement;rect:{x:number;y:number;w:number;h:number};shake:number;}
interface SelectPanel{root:HTMLDivElement;name:HTMLElement;ready:HTMLElement;art:HTMLElement;title:HTMLElement;role:HTMLElement;description:HTMLElement;special:HTMLElement;stats:HTMLElement;buttons:HTMLButtonElement[];confirm:HTMLButtonElement;weapon:string;}
interface Fx{mesh:Mesh;life:number;max:number;kind:'dust'|'spark'|'wave'|'flash';vx:number;vy:number;vz:number;size:number}
export class FerroRenderer{
 readonly engine:Engine;readonly scene:Scene;readonly ready:Promise<void>;private world:FerroWorld;private actors=new Map<string,FerroActor>();private rigs:Rig[]=[];private selection=new Map<string,SelectPanel>();private root:HTMLDivElement;private selectRoot:HTMLDivElement;private title:HTMLDivElement;private scoreboard:HTMLDivElement;private feed:HTMLDivElement;private audio:FerroAudio;private overview:ArcRotateCamera;private shadows=new Map<string,Mesh>();private labels=new Map<string,Mesh>();private arrows:{root:TransformNode;id:number}[]=[];private fx:Fx[]=[];private bladeTrails=new Map<string,Mesh>();private disposed=false;private paused=false;private hudTime=0;private phase='';private token=-1;private feedAge=0;private lastScore='';private resizeFn=()=>this.engine.resize();
 constructor(private canvas:HTMLCanvasElement,private participants:PlayerSnapshot[],choose:(id:string,index:number)=>void,confirm:(id:string)=>void,private mapId:ArenaId='colosseum',private cosmetic?:(id:string)=>void){
  const humans=humanViewPlayers(participants),rects=splitScreenLayout(humans.length);this.engine=new Engine(canvas,true,{preserveDrawingBuffer:false,stencil:false,powerPreference:'high-performance'});this.engine.setHardwareScalingLevel(mapId==='geonosis'&&humans.length>=3?1.2:1);
  this.scene=new Scene(this.engine);this.scene.clearColor=new Color4(.19,.25,.3,1);this.scene.ambientColor=new Color3(.22,.25,.25);this.scene.fogMode=Scene.FOGMODE_LINEAR;this.scene.fogStart=34;this.scene.fogEnd=80;this.scene.fogColor=new Color3(.28,.33,.35);this.scene.skipPointerMovePicking=true;this.scene.skipPointerDownPicking=true;this.scene.skipPointerUpPicking=true;
  const fill=new HemisphericLight('ferro-sky',Vector3.Up(),this.scene);fill.intensity=.8;fill.diffuse=new Color3(.72,.84,1);fill.groundColor=new Color3(.35,.31,.26);const sun=new DirectionalLight('ferro-sun',new Vector3(.45,-1,.35),this.scene);sun.diffuse=new Color3(1,.85,.64);sun.intensity=1.15;
  this.world=new FerroWorld(this.scene,mapId);this.audio=new FerroAudio(humans.map(p=>p.id));this.overview=new ArcRotateCamera('ferro-colosseum',-Math.PI/2,1.08,31,new Vector3(0,1.3,0),this.scene);this.overview.inputs.clear();this.overview.radius=mapId==='colosseum'?31:mapId==='hell'?44:51;this.overview.maxZ=200;this.overview.minZ=.1;this.overview.layerMask=1;
  this.root=document.createElement('div');this.root.id='ferro-overlay';this.root.className='ferro-overlay'+(humans.length>=3?' ferro-small':'');document.body.appendChild(this.root);
  this.title=document.createElement('div');this.title.className='ferro-title';this.title.innerHTML='FERRO E FURIA<small>HONOR & STEEL · '+(mapId==='hell'?'HELL ARENA':mapId==='geonosis'?'GEONOSIS ARENA':'COLOSSEO DEL FERRO')+'</small>';this.root.appendChild(this.title);
  this.selectRoot=document.createElement('div');this.selectRoot.className='ferro-selection';this.root.appendChild(this.selectRoot);const footer=document.createElement('div');footer.className='ferro-select-footer';footer.textContent='LS / D-PAD: SCEGLI · A / ✕: CONFERMA · STESSA ARMA CONSENTITA';this.selectRoot.appendChild(footer);
  this.scoreboard=document.createElement('div');this.scoreboard.className='ferro-scoreboard';this.scoreboard.style.display='none';this.root.appendChild(this.scoreboard);this.feed=document.createElement('div');this.feed.className='ferro-feed';this.root.appendChild(this.feed);
  for(const p of participants){const actor=new FerroActor(this.scene,p);actor.root.getChildMeshes().forEach(m=>m.layerMask=1);this.actors.set(p.id,actor);const shadow=MeshBuilder.CreateGround('warrior-contact:'+p.id,{width:1.6,height:1.6},this.scene);shadow.material=this.world.shadowMaterial;shadow.layerMask=1;shadow.isPickable=false;this.shadows.set(p.id,shadow);this.labels.set(p.id,this.label(p,actor));}
  humans.forEach((p,i)=>{
   const r=rects[i],camera=new UniversalCamera('ferro:'+p.id,Vector3.Zero(),this.scene);camera.inputs.clear();camera.minZ=.07;camera.maxZ=180;camera.fov=.95;camera.viewport=new Viewport(r.x,r.y,r.w,r.h);camera.layerMask=1|(1<<(20+i));
   const panel=document.createElement('div');panel.className='ferro-view';panel.dataset.player=p.id;panel.style.cssText=`left:${r.x*100}%;top:${(1-r.y-r.h)*100}%;width:${r.w*100}%;height:${r.h*100}%;--player:${p.color}`;panel.innerHTML='<div class="ferro-hud"><b class="ferro-name"></b><span class="ferro-meta"></span><div class="ferro-bar"><i></i></div><div class="ferro-bar stamina"><i></i></div><div class="ferro-health-numbers"></div></div><div class="ferro-clock"></div><div class="ferro-special"></div><div class="ferro-message"></div><div class="ferro-reticle">+</div><div class="ferro-charge"><i></i></div><div class="ferro-hit-flash"></div><div class="ferro-hit-confirm">×</div><div class="ferro-threat"></div><div class="ferro-tenacity"><i></i></div><div class="ferro-input-hint">LT: AGGANCIA · RS: GUARDIA · R3: BERSAGLIO<br>RB: LEGGERO · RT: PESANTE · B: FINTA · X: PRESA</div>';panel.querySelector('.ferro-name')!.textContent=p.displayName;this.root.appendChild(panel);const node=(s:string)=>panel.querySelector<HTMLElement>(s)!;
   const guide=MeshBuilder.CreateLines('bow-aim:'+p.id,{points:Array.from({length:13},()=>Vector3.Zero()),updatable:true},this.scene);guide.color=new Color3(.85,.79,.58);guide.alpha=.6;guide.layerMask=1<<(20+i);guide.isPickable=false;guide.setEnabled(false);
   const me=new GuardIndicator('me'),foe=new GuardIndicator('foe'),meHint=document.createElement('small');me.root.appendChild(meHint);panel.append(me.root,foe.root);
   this.rigs.push({me,foe,meHint,rect:{x:r.x,y:r.y,w:r.w,h:r.h},shake:0,id:p.id,camera,position:Vector3.Zero(),look:Vector3.Zero(),initialized:false,panel,hp:node('.ferro-bar i'),stamina:node('.ferro-bar.stamina i'),numbers:node('.ferro-health-numbers'),meta:node('.ferro-meta'),clock:node('.ferro-clock'),special:node('.ferro-special'),message:node('.ferro-message'),reticle:node('.ferro-reticle'),charge:node('.ferro-charge'),chargeBar:node('.ferro-charge i'),flash:node('.ferro-hit-flash'),hit:node('.ferro-hit-confirm'),hitTime:0,note:'',noteTime:0,guide});
   const menu=this.selectPanel(p);menu.root.querySelector('.ferro-cosmetic')?.addEventListener('click',()=>this.cosmetic?.(p.id));menu.root.style.cssText=`left:calc(${r.x*100}% + 5px);top:calc(${(1-r.y-r.h)*100}% + 5px);width:calc(${r.w*100}% - 10px);height:calc(${r.h*100}% - 10px);--player:${p.color}`;menu.buttons.forEach((b,index)=>b.addEventListener('click',()=>choose(p.id,index)));menu.confirm.addEventListener('click',()=>confirm(p.id));this.selection.set(p.id,menu);this.selectRoot.appendChild(menu.root);
  });
  this.scene.onBeforeCameraRenderObservable.add(camera=>{const rig=this.rigs.find(r=>r.camera===camera);for(const[id,actor]of this.actors){const p=actor.root.position,d=Math.hypot(camera.position.x-p.x,camera.position.y-p.y-1.5,camera.position.z-p.z);actor.setCameraFade(rig?.subject===id&&d<3.8?.16:rig?.subject===id&&rig.occluding?.38:1);}for(const[id,label]of this.labels)label.isVisible=rig?.subject!==id;});
  window.addEventListener('resize',this.resizeFn);this.engine.resize();this.scene.activeCameras=[this.overview];this.ready=Promise.all([loadFerroAssets(this.scene,mapId),...[...this.actors.values()].map(actor=>actor.ready)]).then(async()=>{if(this.disposed)return;this.pools();await prepareVisuals(this.scene);});
 }
 private label(p:PlayerSnapshot,actor:FerroActor):Mesh{
  const texture=new DynamicTexture('ferro-name:'+p.id,{width:256,height:48},this.scene,false),c=texture.getContext()as CanvasRenderingContext2D;c.fillStyle='#10212bd9';c.fillRect(0,0,256,48);c.fillStyle=p.color;c.fillRect(0,0,4,48);c.fillStyle='#e6e7d9';c.textAlign='center';c.font='bold 23px Arial';c.fillText(p.displayName.slice(0,18),128,32);texture.hasAlpha=true;texture.update();const material=new StandardMaterial('ferro-name:'+p.id,this.scene);material.diffuseTexture=texture;material.useAlphaFromDiffuseTexture=true;material.disableLighting=true;material.emissiveColor=Color3.White();material.freeze();const plane=MeshBuilder.CreatePlane('ferro-name:'+p.id,{width:1.9,height:.36},this.scene);plane.material=material;plane.parent=actor.root;plane.position.y=actor.rig.topY+.35;plane.billboardMode=Mesh.BILLBOARDMODE_ALL;plane.layerMask=1;plane.isPickable=false;return plane;
 }
 private selectPanel(p:PlayerSnapshot):SelectPanel{
  const root=document.createElement('div');root.className='ferro-select-panel';root.dataset.player=p.id;root.innerHTML=`<div class="ferro-seat"><span></span><small></small></div><div class="ferro-select-main"><div class="ferro-select-art"></div><div><h2 class="ferro-weapon-title"></h2><small class="ferro-weapon-role"></small><div class="ferro-stats"></div></div></div><p class="ferro-description"></p><div class="ferro-special-info"></div><div class="ferro-choices">${WEAPONS.map((w,i)=>`<button data-weapon="${i}" title="${w.name}">${weaponArt(w.id)}${w.name}</button>`).join('')}</div><button class="ferro-cosmetic">Y / △ · CAMBIA MODELLO</button><button class="ferro-confirm">A / ✕ · CONFERMA</button>`;const node=(s:string)=>root.querySelector<HTMLElement>(s)!;node('.ferro-seat span').textContent=p.displayName;
  return{root,name:node('.ferro-seat span'),ready:node('.ferro-seat small'),art:node('.ferro-select-art'),title:node('.ferro-weapon-title'),role:node('.ferro-weapon-role'),description:node('.ferro-description'),special:node('.ferro-special-info'),stats:node('.ferro-stats'),buttons:[...root.querySelectorAll<HTMLButtonElement>('[data-weapon]')],confirm:root.querySelector('.ferro-confirm')!,weapon:''};
 }
 private pools():void{
  for(let i=0;i<64;i++){const root=new TransformNode('ferro-arrow-pool',this.scene);cloneFerroModel(this.scene,'arrow',root).forEach(m=>m.layerMask=1);root.setEnabled(false);this.arrows.push({root,id:-1});}
  const spark=new StandardMaterial('ferro-spark',this.scene);spark.disableLighting=true;spark.emissiveColor=new Color3(1,.84,.5);spark.freeze();
  const glow=new DynamicTexture('ferro-flash',{width:64,height:64},this.scene,false),g=glow.getContext()as CanvasRenderingContext2D,radial=g.createRadialGradient(32,32,0,32,32,32);radial.addColorStop(0,'rgba(255,255,244,1)');radial.addColorStop(.22,'rgba(255,226,150,.9)');radial.addColorStop(.55,'rgba(255,170,70,.32)');radial.addColorStop(1,'rgba(255,140,40,0)');g.fillStyle=radial;g.fillRect(0,0,64,64);glow.hasAlpha=true;glow.update();
  const flash=new StandardMaterial('ferro-flash',this.scene);flash.disableLighting=true;flash.emissiveTexture=glow;flash.opacityTexture=glow;flash.alphaMode=Engine.ALPHA_ADD;flash.backFaceCulling=false;flash.freeze();
  for(let i=0;i<66;i++){const kind=i<16?'dust':i<56?'spark':i<60?'wave':'flash',mesh=kind==='wave'?MeshBuilder.CreateTorus('hammer-shockwave',{diameter:1,thickness:.035,tessellation:32},this.scene):kind==='flash'?MeshBuilder.CreatePlane('ferro-contact-flash',{size:1},this.scene):kind==='spark'?MeshBuilder.CreateBox('ferro-spark',{width:.022,height:.022,depth:.16},this.scene):MeshBuilder.CreateBox('ferro-impact-pool',{size:.12},this.scene);mesh.material=kind==='spark'?spark:kind==='flash'?flash:ferroMaterial(this.scene,'fx-'+kind,kind==='dust'?'#b9a78b':'#e5b079',kind!=='dust');if(kind==='flash')mesh.billboardMode=Mesh.BILLBOARDMODE_ALL;mesh.layerMask=1;mesh.isPickable=false;mesh.setEnabled(false);this.fx.push({mesh,life:0,max:0,kind,vx:0,vy:0,vz:0,size:1});}
  for(const p of this.participants){const mesh=MeshBuilder.CreateBox('ferro-blade-trail',{width:.035,height:.035,depth:1},this.scene);mesh.material=ferroMaterial(this.scene,'trail','#d4c89e',true);mesh.layerMask=1;mesh.visibility=.45;mesh.isPickable=false;mesh.setEnabled(false);this.bladeTrails.set(p.id,mesh);}
 }
 setPaused(value:boolean):void{this.paused=value;this.audio.setPaused(value);}
 /** Covered warm draw of every viewport. No simulation time or inputs advance here. */
 async warm(state:FerroState):Promise<void>{
  if(this.disposed)return;const preview={...state,phase:'fight' as const};this.update(preview,0);await prepareVisuals(this.scene);if(this.disposed)return;this.render();
  // Complete the first GPU submission before revealing play (once per scene, never per frame).
  const gl=this.canvas.getContext('webgl2')??this.canvas.getContext('webgl');gl?.finish();
  this.update(state,0);this.render();
 }
 show(value:boolean):void{this.root.style.display=value?'':'none';}
 update(s:FerroState,dt:number,events:FerroEvent[]=[]):void{
  if(this.disposed||this.paused)return;this.world.update(s);const selection=s.phase==='selection';this.selectRoot.style.display=selection?'':'none';this.title.style.display=selection?'':'none';
  if(this.phase!==s.phase||this.token!==s.selectionToken){if(s.phase==='countdown')for(const r of this.rigs)r.initialized=false;this.phase=s.phase;this.token=s.selectionToken;}
  for(const p of s.warriors){this.actors.get(p.id)?.update(p,s.time,dt,(s.phase==='roundEnd'&&p.id===s.roundWinner)||(s.phase==='finished'&&p.id===s.winner));const shadow=this.shadows.get(p.id)!;shadow.setEnabled(p.alive&&p.eligible);shadow.position.set(p.x,floorAt(s.mapId,p.x,p.z)+.025,p.z);shadow.scaling.setAll(Math.max(.55,1-p.y*.17));const label=this.labels.get(p.id)!;label.setEnabled(p.alive&&p.eligible);
   const trail=this.bladeTrails.get(p.id)!;if(p.action&&!(p.action.blocked&&p.action.blocked.window<0)&&activeWindow(attackSpec(p.weapon,p.action),p.action.age)>=0&&p.weapon!=='bow'){const b=activeBlade(p,p.action,attackSpec(p.weapon,p.action),p.action.age),mid={x:(b.tip.x+b.grip.x)/2,y:(b.tip.y+b.grip.y)/2,z:(b.tip.z+b.grip.z)/2};trail.setEnabled(true);trail.position.set(mid.x,mid.y,mid.z);trail.lookAt(new Vector3(b.tip.x,b.tip.y,b.tip.z));trail.scaling.z=Math.hypot(b.tip.x-b.grip.x,b.tip.y-b.grip.y,b.tip.z-b.grip.z);}else trail.setEnabled(false);
  }
  if(selection){this.overview.alpha=-Math.PI/2+Math.sin(s.time*.08)*.18;this.scene.activeCameras=[this.overview];}else{this.scene.activeCameras=this.rigs.map(r=>r.camera);for(const r of this.rigs)this.camera(r,s,dt);}
  this.guards(s);
  for(const r of this.rigs)r.panel.style.display=selection?'none':'';
  this.hudTime+=dt;if(this.hudTime>=1/15||dt===0){this.hudTime=0;this.hud(s);}
  this.projectiles(s);for(const e of events)this.event(e,s);this.effects(dt);this.audio.update(s,events);this.feedAge=Math.max(0,this.feedAge-dt);if(!this.feedAge)this.feed.textContent='';
 }
 private camera(r:Rig,s:FerroState,dt:number):void{
  const own=s.warriors.find(p=>p.id===r.id)!;let p=own;if(!own.alive||!own.eligible)p=s.warriors.find(p=>p.alive&&p.eligible&&!p.bot)??own;r.subject=p.id;
  const aim=p.weapon==='bow'&&p.guard&&p.alive,back=aim?4.8:p.target?5.4:6.2,side=aim?2.1:p.target?3.0:1.85,forward=new Vector3(Math.sin(p.yaw),0,Math.cos(p.yaw)),right=new Vector3(Math.cos(p.yaw),0,-Math.sin(p.yaw)),origin=new Vector3(p.x,p.y+1.5,p.z),desired=origin.subtract(forward.scale(back)).add(right.scale(side)).add(new Vector3(0,aim?.55:1.55,0)),target=origin.add(forward.scale(aim?11:7));target.y+=(aim?Math.tan(p.pitch)*11:Math.tan(p.pitch)*2);
  const locked=s.warriors.find(q=>q.id===p.target&&q.alive);if(locked){target.set((p.x+locked.x)*.5,p.y+1.35,(p.z+locked.z)*.5);}
  const lerp=1-Math.exp(-dt*9);if(!r.initialized){r.position.copyFrom(desired);r.look.copyFrom(target);r.initialized=true;}else{Vector3.LerpToRef(r.position,desired,lerp,r.position);Vector3.LerpToRef(r.look,target,lerp,r.look);}
  const delta=r.position.subtract(origin),length=delta.length(),direction=delta.scale(1/Math.max(.001,length));let clip=wallDistance(origin,direction,length,.22,s.mapId);for(let i=1;i<=30;i++){const q=origin.add(direction.scale(length*i/30));if(s.mapId==='colosseum'&&Math.hypot(q.x,q.z)>15.8&&q.y<3.1){clip=Math.min(clip,length*(i-1)/30);break;}}
  r.camera.position.copyFrom(origin.add(direction.scale(Math.max(.35,clip-.08))));const feedback=r.look.clone();if(r.hitTime>0)feedback.y+=Math.sin(s.time*80)*r.hitTime*.22;
  // Short contact jolt for both duellists (block / parry / hit). Purely the camera: the game never pauses.
  if(r.shake>0){feedback.y+=Math.sin(s.time*97)*r.shake;feedback.x+=Math.cos(s.time*83)*r.shake*.7;r.shake=Math.max(0,r.shake-dt*.9);}r.camera.setTarget(feedback);r.camera.fov+=( (aim?.72:.95)-r.camera.fov)*(1-Math.exp(-dt*7));
  // Locked duel: a big body (the Dottore) must not hide the opponent and the clash from its own camera.
  r.occluding=false;if(locked){const eye=r.camera.position,goal=new Vector3(locked.x,locked.y+1.4,locked.z),chest=new Vector3(p.x,p.y+1.5,p.z),ray=goal.subtract(eye),t=Math.max(0,Math.min(1,Vector3.Dot(chest.subtract(eye),ray)/Math.max(1e-6,ray.lengthSquared())));r.occluding=Vector3.Distance(eye.add(ray.scale(t)),chest)<.95;}
  const show=own.alive&&own.weapon==='bow'&&(own.guard||own.charge>.02);r.guide.setEnabled(show);if(show)this.bowGuide(r,own,s.mapId);
 }
 private bowGuide(r:Rig,p:Warrior,mapId:ArenaId):void{
  const speed=17+clamp(p.charge/1.2,0,1)*17,dx=Math.sin(p.yaw)*Math.cos(p.pitch),dy=Math.sin(p.pitch),dz=Math.cos(p.yaw)*Math.cos(p.pitch),start={x:p.x+dx*.85,y:p.y+1.45+dy*.85,z:p.z+dz*.85},points:Vector3[]=[];let stopped=false,previous=new Vector3(start.x,start.y,start.z);
  for(let i=0;i<13;i++){const t=i*.035,q=new Vector3(start.x+dx*speed*t,start.y+(dy*speed+1)*t-4.9*t*t,start.z+dz*speed*t);if(i){const v=q.subtract(previous),length=v.length(),d=v.scale(1/Math.max(.0001,length)),hit=wallDistance(previous,d,length,0,mapId);if(hit<length||q.y<floorAt(mapId,q.x,q.z)+.08)stopped=true;if(hit<length)q.copyFrom(previous.add(d.scale(hit)));}if(stopped)q.copyFrom(previous);points.push(q);previous=q;}
  MeshBuilder.CreateLines('bow-aim',{points,instance:r.guide as any});
 }
 private hud(s:FerroState):void{
  for(const r of this.rigs){const p=s.warriors.find(p=>p.id===r.id)!,w=weapon(p.weapon),menu=this.selection.get(p.id)!;
   if(s.phase==='selection'){
    menu.ready.textContent=!p.eligible?'OSSERVI LO SPAREGGIO':p.ready?'PRONTO':`${Math.ceil(Math.max(0,s.phaseLeft))}s · ${p.points} PT`;
    if(menu.weapon!==p.weapon){menu.weapon=p.weapon;menu.art.innerHTML=weaponArt(p.weapon);menu.title.textContent=w.name;menu.title.style.color=w.color;menu.role.textContent=w.title;menu.description.textContent=w.description;menu.special.replaceChildren();const b=document.createElement('b');b.textContent=w.specialName;const span=document.createElement('span');span.textContent=w.specialHint;menu.special.append(b,span);for(const[mark,text,color]of[['+',TRAITS[p.weapon].strength,'#9fd6a4'],['−',TRAITS[p.weapon].weakness,'#e49a8a']]){const line=document.createElement('span');line.style.color=color;line.textContent=mark+' '+text;menu.special.appendChild(line);}
     const stats=[['DANNO',w.id==='bow'?45:w.heavy.damage,55],['VELOCITÀ',w.speed,5],['PORTATA',w.id==='bow'?35:w.light.reach, w.id==='bow'?35:4],['DIFESA',Math.round(w.defence*100),100]];menu.stats.innerHTML=stats.map(([name,value,max])=>`<label>${name}<span>${value}${name==='DIFESA'?'%':''}</span><div><i style="width:${Number(value)/Number(max)*100}%"></i></div></label>`).join('');
    }
    const skin=menu.root.querySelector<HTMLElement>('.ferro-cosmetic')!;skin.style.display=p.weapon==='sword'||p.weapon==='shield'||p.weapon==='axe'?'':'none';skin.textContent='Y / △ · '+(p.weapon==='shield'?SHIELD_MODELS[p.variant%2]:p.weapon==='axe'?AXE_NAMES[p.variant%3]:SWORD_MODELS[p.variant%4]).toUpperCase();
    menu.buttons.forEach((button,i)=>{button.classList.toggle('selected',WEAPONS[i].id===p.weapon);button.disabled=!p.eligible;});menu.confirm.classList.toggle('ready',p.ready);menu.confirm.disabled=p.ready||!p.eligible;menu.confirm.textContent=!p.eligible?'OSSERVI LO SPAREGGIO':p.ready?'PRONTO · ATTENDI GLI ALTRI':'A / ✕ · CONFERMA '+w.name;continue;
   }
   r.hp.style.width=Math.max(0,p.hp)+'%';r.stamina.style.width=p.stamina+'%';r.numbers.textContent=`VITA ${Math.ceil(p.hp)} / 100 · STAMINA ${Math.floor(p.stamina)}`;r.meta.textContent=w.name+(p.weapon==='bow'?` · ${p.arrows} FRECCE`:'');
   const sudden=s.phase==='fight'&&s.ringRadius<arenaRadius(s.mapId)-.01,timer=s.phase==='countdown'?Math.ceil(s.phaseLeft):Math.ceil(Math.max(0,(s.duel==='none'?s.roundSeconds:35)-s.fightTime));r.clock.innerHTML=`${s.duel==='final'?'SPAREGGIO':`ROUND ${s.round} / 3`}<b>${sudden?'⚠':Math.max(0,timer)}</b>${sudden?'CERCHIO IN CHIUSURA':p.points+' PT'}`;
   r.special.textContent=w.specialName+'\n'+(p.specialCd>0?`${p.specialCd.toFixed(1)}s · RICARICA`:p.weapon==='sword'&&p.riposte<=0?'ESEGUI UN PARRY':p.piercing?'FRECCIA PRONTA':'LB / L1 · PRONTA');r.reticle.style.display=p.weapon==='bow'&&p.alive?'block':'none';r.charge.style.display=p.weapon==='bow'&&p.charge>0?'block':'none';r.chargeBar.style.width=(p.charge/1.2*100)+'%';r.flash.style.opacity=String(p.hurt*(p.clash?.kind==='block'?.25:2.2));
   const incoming=s.warriors.filter(q=>q!==p&&q.alive&&q.action&&distance(p,q)<5&&visible({x:p.x,y:p.y+1.3,z:p.z},{x:q.x,y:q.y+1.3,z:q.z},s.mapId));
   const hint=p.counterUntil>s.time?'X / □ · CONTRASTA':p.target||p.action?'':'LT · GUARDIA';if(r.meHint.textContent!==hint)r.meHint.textContent=hint;
   r.panel.querySelector<HTMLElement>('.ferro-threat')!.textContent=incoming.filter(q=>q.id!==p.target).map(q=>angle(Math.atan2(q.x-p.x,q.z-p.z)-p.yaw)<0?'◀':'▶').join(' ');
   const tenacity=r.panel.querySelector<HTMLElement>('.ferro-tenacity')!;tenacity.classList.toggle('active',p.resistance>0);(tenacity.firstElementChild as HTMLElement).style.width=(p.resistance>0?100:p.pressure)+'%';
   if(!r.targetMark){r.targetMark=MeshBuilder.CreateTorus('lock-target:'+p.id,{diameter:1.2,thickness:.035,tessellation:24},this.scene);r.targetMark.material=ferroMaterial(this.scene,'target-ring','#f4d58e');r.targetMark.layerMask=r.guide.layerMask;r.targetMark.isPickable=false;}
   const target=s.warriors.find(q=>q.id===p.target&&q.alive);r.targetMark.setEnabled(!!target);if(target)r.targetMark.position.set(target.x,target.y+.07,target.z);
   r.message.textContent=s.phase==='countdown'?`${s.duel==='round'?'DUELLO · DOPPIA ELIMINAZIONE\n':''}${Math.max(1,Math.ceil(s.phaseLeft))}`:s.phase==='finished'?'':!p.alive?'ELIMINATO · OSSERVI GLI ALTRI':r.noteTime>0?r.note:s.flame==='warning'?'⚠ GETTI DI FIAMME · GUARDA I CERCHI':'';
  }
  const score=s.phase==='roundEnd'||s.phase==='finished';this.scoreboard.style.display=score?'':'none';if(score){const key=s.phase+':'+s.history.length+':'+s.winner;if(this.lastScore!==key){this.lastScore=key;this.scoreboard.replaceChildren();const h=document.createElement('h2');h.textContent=s.notice;this.scoreboard.appendChild(h);const sorted=[...s.warriors].sort((a,b)=>Number(b.id===s.winner)-Number(a.id===s.winner)||b.points-a.points);let rank=0;for(const[i,p]of sorted.entries()){const row=document.createElement('div');row.className='ferro-score-row';if(i===0||p.points!==sorted[i-1].points||sorted[i-1].id===s.winner)rank=i+1;for(const text of[String(rank),p.name,`${p.kills} KO`,`${p.points} PT`]){const cell=document.createElement('span');cell.textContent=text;row.appendChild(cell);}this.scoreboard.appendChild(row);}const note=document.createElement('p');note.textContent=s.phase==='roundEnd'?s.round<3?'PROSSIMO ROUND · PUOI CAMBIARE ARMA':'VERIFICA DELLA CLASSIFICA · PARITÀ: SPAREGGIO':'FERRO E FURIA · L’ULTIMO GUERRIERO';this.scoreboard.appendChild(note);}}
 }
 private projectiles(s:FerroState):void{
  for(let i=0;i<this.arrows.length;i++){const entry=this.arrows[i],a=s.arrows[i];entry.root.setEnabled(!!a);if(!a){entry.id=-1;continue;}entry.id=a.id;alignSegment(entry.root,a,{x:a.x+a.vx,y:a.y+a.vy,z:a.z+a.vz},Math.hypot(a.vx,a.vy,a.vz)||1);entry.root.scaling.setAll(1);}
 }
 /** Defender-space guard direction → the side of the attacker's own indicator it appears on (mirrors face to face). */
 private seenFrom(viewer:Warrior,other:Warrior,dir:GuardDirection):GuardDirection{if(dir==='top')return'top';return incomingDirection(viewer,other,{direction:'left',yaw:viewer.yaw})===dir?'left':'right';}
 /** Per-frame guard indicators: mine (guard, most urgent incoming blow, parry window) and my opponent's guard
  * above their head, mirrored into my attacking space. Uses only what is visible on screen. */
 private guards(s:FerroState):void{
  const fight=s.phase==='fight'||s.phase==='countdown',cw=this.canvas.clientWidth||innerWidth,ch=this.canvas.clientHeight||innerHeight;
  for(const r of this.rigs){
   const p=s.warriors.find(p=>p.id===r.id)!,melee=fight&&p.alive&&p.eligible&&p.weapon!=='bow';r.me.root.style.display=melee?'':'none';if(!melee){r.foe.place(0,0,false);continue;}
   let incoming:{dir:GuardDirection;progress:number;heavy:boolean;window:boolean}|null=null,soonest=Infinity;
   for(const q of s.warriors){const a=q.action;if(q===p||!q.alive||!a||a.blocked||a.hits.some(k=>k.startsWith(p.id+':')))continue;const spec=attackSpec(q.weapon,a);if(distance(p,q)>spec.reach+1.3||Math.abs(angle(Math.atan2(p.x-q.x,p.z-q.z)-a.yaw))>1.15)continue;
    // Only blows that would actually reach me; the parry window is the last 130 ms before the predicted contact.
    const contact=contactAge(q,p);if(contact===null)continue;const left=contact-a.age;if(left< -.02||left>=soonest)continue;
    soonest=left;incoming={dir:incomingDirection(q,p,a),progress:Math.min(1,a.age/Math.max(.01,contact)),heavy:a.kind!=='light',window:left<=FERRO_RULES.parryWindow*TRAITS[p.weapon].parry};}
   r.me.set({guard:p.action?null:p.guardDirection,incoming,attacking:p.action?.direction??null});r.me.root.classList.toggle('idle',!p.guard&&!p.action&&!incoming);
   const foe=s.warriors.find(q=>q.id===p.target&&q.alive)??s.warriors.filter(q=>q!==p&&q.alive&&q.eligible&&distance(p,q)<7&&Math.abs(angle(Math.atan2(q.x-p.x,q.z-p.z)-p.yaw))<.8).sort((a,b)=>distance(p,a)-distance(p,b))[0];
   if(!foe||foe.weapon==='bow'){r.foe.place(0,0,false);continue;}
   const world=new Vector3(foe.x,foe.y+(this.actors.get(foe.id)?.rig.topY??2.2)+.9,foe.z),view=Vector3.TransformCoordinates(world,r.camera.getViewMatrix());if(view.z<.3){r.foe.place(0,0,false);continue;}
   const ndc=Vector3.TransformCoordinates(world,r.camera.getTransformationMatrix());
   r.foe.set({guard:foe.action?null:this.seenFrom(p,foe,foe.guardDirection),incoming:null,attacking:foe.action?incomingDirection(foe,p,foe.action):null});r.foe.root.classList.toggle('idle',!foe.guard&&!foe.action);
   r.foe.place((ndc.x+1)/2*r.rect.w*cw,(1-ndc.y)/2*r.rect.h*ch,Math.abs(ndc.x)<1.05&&Math.abs(ndc.y)<1.05);
  }
 }
 /** Contact effects from the logic's result: steel rings and sparks, shields thud and splinter, hammers shake. */
 private spawn(kind:Fx['kind'],x:number,y:number,z:number,n:number,speed:number,life:number,size=1):void{
  for(let i=0;i<n;i++){const f=this.fx.find(f=>f.life<=0&&f.kind===kind);if(!f)return;const a=Math.random()*Math.PI*2,u=Math.random()*2-1,h=Math.sqrt(1-u*u),v=speed*(.55+Math.random()*.45);
   f.life=f.max=life*(kind==='spark'?.7+Math.random()*.6:1);f.size=size;f.mesh.position.set(x,y,z);f.vx=Math.cos(a)*h*v;f.vy=Math.abs(u)*v*.7+speed*.2;f.vz=Math.sin(a)*h*v;f.mesh.scaling.setAll(kind==='flash'?size*.3:1);f.mesh.visibility=1;f.mesh.setEnabled(true);}
 }
 private contact(e:FerroEvent,s:FerroState):void{
  const defender=s.warriors.find(p=>p.id===e.player),attacker=s.warriors.find(p=>p.id===e.target);if(!defender)return;
  const x=e.x??defender.x,y=e.y??defender.y+1.3,z=e.z??defender.z,power=(e.value??80)/100,material=contactMaterial(defender.weapon),heavy=e.weapon==='hammer'||e.weapon==='axe';
  if(e.kind==='parry'){this.spawn('spark',x,y,z,20,7.5,.34);this.spawn('flash',x,y,z,1,0,.22,1.35);this.spawn('wave',x,y,z,1,0,.3,.3);}
  else if(e.kind==='block'){
   if(material==='shield'){this.spawn('spark',x,y,z,heavy?6:3,4,.24);this.spawn('dust',x,y,z,heavy?8:5,3.2,.38);this.spawn('flash',x,y,z,1,0,.14,.45*power);if(e.weapon==='hammer')this.spawn('wave',x,y-.2,z,1,0,.32,.28);}
   else{this.spawn('spark',x,y,z,Math.round((material==='haft'?5:10)*Math.min(1.4,power)),5.2,.26);this.spawn('flash',x,y,z,1,0,.15,.65*power);if(heavy)this.spawn('dust',x,y,z,3,2.5,.3);}
  }else if(e.kind==='break'){this.spawn('spark',x,y,z,7,5,.3);this.spawn('dust',x,y,z,7,3.5,.4);this.spawn('flash',x,y,z,1,0,.18,.7);}
  const flash:GuardFlash=e.kind==='parry'?'parry':e.kind==='break'?'break':'block',dir=e.dir??'top';
  const own=this.rigs.find(r=>r.id===e.player),their=this.rigs.find(r=>r.id===e.target);
  if(own){own.me.flash(dir,flash);own.shake=Math.max(own.shake,e.kind==='parry'?.06:e.kind==='break'?.1:.035*power);}
  if(their&&attacker){their.foe.flash(this.seenFrom(attacker,defender,dir),flash);their.shake=Math.max(their.shake,e.kind==='parry'?.12:.05*power);}
 }
 private event(e:FerroEvent,s:FerroState):void{
  // A blocked blow still reports its reduced damage as 'hit': it must read as a block, never as a landed hit.
  const r=this.rigs.find(r=>r.id===e.player),guarded=e.kind==='hit'&&s.warriors.find(p=>p.id===e.target)?.clash?.kind==='block';if(e.kind==='hit'&&r&&!guarded)r.hitTime=.17;
  if(e.kind==='parry'||e.kind==='break'||e.kind==='counter'||e.kind==='guardBreak'){if(r){r.note=e.kind==='parry'?'PARRY PERFETTO · CONTRATTACCA':e.kind==='counter'?'PRESA CONTRASTATA':e.kind==='guardBreak'?'PRESA · X / □ PER CONTRASTARE':'GUARDIA SPEZZATA';r.noteTime=e.kind==='parry'?.9:.55;}}
  if(e.kind==='parry'||e.kind==='block'||e.kind==='break')this.contact(e,s);
  if(e.kind==='hit'&&!guarded){const hurt=this.rigs.find(r=>r.id===e.target);if(hurt){hurt.me.flash(e.dir??'top','hit');hurt.shake=Math.max(hurt.shake,.07);}}
  if(e.kind==='elimination'){this.feed.textContent=e.text??'';this.feedAge=3;}
  if(e.kind==='arrowImpact'||e.kind==='hit'&&!guarded){for(let i=0;i<4;i++){const f=this.fx.find(f=>f.life<=0&&f.kind==='dust');if(!f)break;f.life=f.max=.35;f.size=1;f.mesh.visibility=1;f.mesh.position.set(e.x??0,e.y??1,e.z??0);f.vx=Math.sin(i*2.3+s.time)*3;f.vy=2+i*.2;f.vz=Math.cos(i*2.3+s.time)*3;f.mesh.setEnabled(true);}}
  if(e.kind==='special'&&e.weapon==='hammer'&&e.value===1){const actor=s.warriors.find(p=>p.id===e.player);if(actor){const f=this.fx.find(f=>f.kind==='wave'&&f.life<=0);if(f){f.life=f.max=.45;f.size=1;f.mesh.visibility=1;f.mesh.position.set(actor.x,.09,actor.z);f.mesh.setEnabled(true);}}}
 }
 private effects(dt:number):void{for(const r of this.rigs){r.hitTime=Math.max(0,r.hitTime-dt);r.noteTime=Math.max(0,r.noteTime-dt);r.hit.style.opacity=r.hitTime>0?'1':'0';}for(const f of this.fx){if(f.life<=0)continue;f.life-=dt;f.mesh.setEnabled(f.life>0);const t=1-Math.max(0,f.life/f.max);f.mesh.visibility=1-t;
   if(f.kind==='wave'){const size=(t*6+.2)*f.size;f.mesh.scaling.set(size,1,size);}
   else if(f.kind==='flash')f.mesh.scaling.setAll(f.size*(.35+t*.9));
   else{f.vy-=(f.kind==='spark'?9.8:8)*dt;f.mesh.position.addInPlaceFromFloats(f.vx*dt,f.vy*dt,f.vz*dt);if(f.kind==='spark'){const p=f.mesh.position;f.mesh.lookAt(new Vector3(p.x+f.vx,p.y+f.vy,p.z+f.vz));}}}}
 render():void{if(!this.disposed&&!this.paused)this.scene.render();}
 stats():Record<string,unknown>{return{fps:this.engine.getFps(),views:this.scene.activeCameras?.length??0,width:this.engine.getRenderWidth(),height:this.engine.getRenderHeight(),meshes:this.scene.meshes.length,actors:this.actors.size,arrows:this.arrows.filter(a=>a.id>=0).length};}
 dispose():void{if(this.disposed)return;this.disposed=true;this.engine.stopRenderLoop();window.removeEventListener('resize',this.resizeFn);this.audio.dispose();for(const a of this.actors.values())a.dispose();this.root.remove();this.scene.dispose();this.engine.dispose();}
}
