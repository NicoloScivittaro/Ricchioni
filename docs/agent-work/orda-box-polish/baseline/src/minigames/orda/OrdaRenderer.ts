import {Engine,Scene,UniversalCamera,Vector3,Viewport,Color3,Color4,HemisphericLight,DirectionalLight,Mesh,MeshBuilder,StandardMaterial} from '@babylonjs/core';
import {FpsViewmodel} from '../../controller/fpsViewmodel';
import {scopeSvg,scopeAlpha} from '../../controller/fpsScope';
import {aimFov} from '../../../shared/fpsAim';
import {splitScreenLayout} from '../kart-race/cameraHud';
import type {BackActor} from '../backrooms/backroomsAssets';
import type {EnemyKind,OrdaParticipant,OrdaState,OrdaEvent} from '../../../shared/orda/types';
import {weaponOf} from '../../../shared/orda/match';
import {OrdaAssets} from './ordaAssets';
import {buildDepot,WORLD_LAYER} from './depotWorld';
import {OrdaAudio} from './OrdaAudio';
import {monsterSfx} from '../../monsters/monsterAudio';
import type {MonsterState} from '../../monsters/MonsterAnimator';
import {attackTiming,isSpecial} from '../../../shared/orda/monsterCombat';
import {ZOMBIES,mysteryPrompt}from '../../../shared/orda/zombiesRules';
import {MysteryBoxVisual}from './MysteryBoxVisual';

interface Rig{id:string;cam:UniversalCamera;vm:FpsViewmodel;panel:HTMLDivElement;identity:HTMLElement;stats:HTMLElement;ammo:HTMLElement;bar:HTMLElement;wallet:HTMLElement;boxPrompt:HTMLElement;boss:HTMLElement;bossFill:HTMLElement;center:HTMLElement;scope:HTMLImageElement;flash:HTMLElement;hit:HTMLElement;weapon:string;hurt:number;hitTime:number;message:string;messageTime:number}
interface Visual{kind:EnemyKind;actor:BackActor;lastX:number;lastZ:number;lastAt:number;speed?:number}
/** One shared scene and actual viewport cameras. Dead viewports become cheap opaque cards. */
export class OrdaRenderer{
 readonly engine:Engine;readonly scene:Scene;readonly ready:Promise<void>;
 private assets:OrdaAssets;private rigs:Rig[]=[];private actors=new Map<number,Visual>();private free:Visual[]=[];
 private playerActors=new Map<string,BackActor>();private root:HTMLDivElement;private sound=new OrdaAudio();private ids:Set<string>;
 private deathAges=new Map<string,number>();private deadPhone=false;
 private audience:OrdaState|null=null;
 private disposed=false;private hudAt=0;private animateAt=0;private fixture:StandardMaterial[]=[];private paused=false;
 private bolts:Mesh[]=[];private tells:Mesh[]=[];private fx:{mesh:Mesh;life:number;max:number;kind:'trace'|'blast'}[]=[];
 private mat=new Map<string,StandardMaterial>();private resizeFn=()=>this.resize();
 private box:MysteryBoxVisual;
 constructor(private canvas:HTMLCanvasElement,participants:OrdaParticipant[],viewIds:string[],private phone=false){
  this.ids=new Set(viewIds);this.engine=new Engine(canvas,false,{preserveDrawingBuffer:true,stencil:false,powerPreference:'high-performance'});
  // A fixed explicit resolution budget, never an adaptive physics/gameplay quality setting.
  this.engine.setHardwareScalingLevel(phone?Math.max(1,window.devicePixelRatio/1.5):viewIds.length>=4?1.15:1);
  this.scene=new Scene(this.engine);this.scene.clearColor=new Color4(.045,.065,.07,1);this.scene.ambientColor=new Color3(.22,.24,.23);
  this.scene.fogMode=Scene.FOGMODE_LINEAR;this.scene.fogStart=26;this.scene.fogEnd=64;this.scene.fogColor=new Color3(.065,.09,.09);
  this.scene.metadata={terminalWeaponLighting:true};
  const hemi=new HemisphericLight('depotFill',new Vector3(0,1,0),this.scene);hemi.intensity=.85;hemi.groundColor=new Color3(.27,.3,.31);
  const sun=new DirectionalLight('depotWindowLight',new Vector3(.35,-1,.4),this.scene);sun.intensity=.7;sun.diffuse=new Color3(.86,.94,.9);
  this.fixture=buildDepot(this.scene).fixtures;this.assets=new OrdaAssets(this.scene);this.box=new MysteryBoxVisual(this.scene);
  this.root=document.createElement('div');this.root.className=phone?'orda-overlay orda-overlay-phone':'orda-overlay';this.root.style.cssText=`position:${phone?'absolute':'fixed'};inset:0;pointer-events:none;z-index:10001;font-family:Arial,sans-serif;color:#e8eadf`;
  (phone?canvas.parentElement!:document.body).appendChild(this.root);
  this.installStyle();const rects=splitScreenLayout(viewIds.length);
  viewIds.forEach((id,i)=>{const vp=rects[i],cam=new UniversalCamera('orda:'+id,new Vector3(0,1.55,-10),this.scene);cam.minZ=.035;cam.maxZ=75;cam.fov=1.05;cam.viewport=new Viewport(vp.x,vp.y,vp.w,vp.h);cam.layerMask=WORLD_LAYER|(1<<(15+i));
   participants.forEach((p,k)=>{if(p.id!==id)cam.layerMask|=1<<(5+k);});
   const vm=new FpsViewmodel(this.scene,cam,false,1<<(15+i));vm.equip('pistola');
   const panel=document.createElement('div');panel.className='orda-view';panel.style.cssText=`left:${vp.x*100}%;top:${(1-vp.y-vp.h)*100}%;width:${vp.w*100}%;height:${vp.h*100}%;--player:${participants.find(p=>p.id===id)?.color??'#8bc7be'}`;
   // Static template only. All participant names and game strings are assigned through textContent.
   panel.innerHTML='<div class="orda-top"><b class="orda-id"></b><span class="orda-stats"></span><div class="orda-health"><i></i></div><div class="orda-wallet"></div><div class="orda-boss">IL MACELLAIO<div><i></i></div></div></div><div class="orda-cross">+</div><img class="orda-scope" alt="Ottica del cecchino"><div class="orda-hurt"></div><div class="orda-hit">×</div><div class="orda-center"></div><div class="orda-ammo"></div><div class="orda-box-prompt"></div>';
   this.root.appendChild(panel);const rig:Rig={id,cam,vm,panel,identity:panel.querySelector('.orda-id')!,stats:panel.querySelector('.orda-stats')!,ammo:panel.querySelector('.orda-ammo')!,bar:panel.querySelector('.orda-health i')!,wallet:panel.querySelector('.orda-wallet')!,boxPrompt:panel.querySelector('.orda-box-prompt')!,boss:panel.querySelector('.orda-boss')!,bossFill:panel.querySelector('.orda-boss i')!,center:panel.querySelector('.orda-center')!,scope:panel.querySelector('.orda-scope')!,flash:panel.querySelector('.orda-hurt')!,hit:panel.querySelector('.orda-hit')!,weapon:'pistola',hurt:0,hitTime:0,message:'',messageTime:0};
   rig.boss=panel.querySelector('.orda-boss')!;rig.bossFill=panel.querySelector('.orda-boss i')!;this.rigs.push(rig);
  });
  this.scene.activeCameras=this.rigs.map(r=>r.cam);window.addEventListener('resize',this.resizeFn);this.resize();
  this.ready=this.boot(participants);
 }
 private installStyle():void{
  if(document.getElementById('orda-style'))return;const s=document.createElement('style');s.id='orda-style';s.textContent=`
  .orda-view{position:absolute;box-sizing:border-box;border:1px solid #c4d1ca24;overflow:hidden;font-size:clamp(10px,1vw,16px)}
  .orda-top{position:absolute;top:12px;left:12px;right:12px;background:linear-gradient(90deg,#111f24ed,#111f2444);border-left:3px solid var(--player);padding:8px 10px;text-shadow:0 1px 2px #000}
  .orda-id{display:block;font-size:1.12em;letter-spacing:.06em;color:var(--player);margin-bottom:3px}.orda-stats{display:block;font-size:.85em;letter-spacing:.03em;color:#d5dfd7}
  .orda-health{width:105px;height:4px;background:#4a3b34;margin-top:6px}.orda-health i{display:block;height:100%;background:var(--player);transition:width .12s}
  .orda-wallet{color:#e0bb73;font-size:.9em;font-weight:900;margin-top:5px}.orda-wallet.ready{color:#b8ec9b}.orda-box-prompt{display:none;position:absolute;bottom:14px;left:12px;max-width:58%;padding:8px 11px;white-space:pre-line;background:#182124e8;border-left:3px solid #d3ad5e;color:#f1dfb3;font-weight:800;font-size:.9em;text-shadow:0 1px 2px #000}
  .orda-boss{display:none;font-size:.75em;letter-spacing:.14em;color:#f0aa85;margin-top:9px;max-width:240px}.orda-boss div{height:5px;background:#733d353d;margin-top:4px}.orda-boss i{display:block;height:100%;background:#d96649;transition:width .15s}
  .orda-cross{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font:25px monospace;color:#f1f2e5cc;text-shadow:0 0 3px #000}
  .orda-ammo{position:absolute;right:13px;bottom:13px;white-space:pre-line;text-align:right;background:#102126cf;border-right:3px solid #c4a064;padding:8px 12px;line-height:1.5;font-weight:bold;text-shadow:0 1px 3px #000}
  .orda-center{position:absolute;left:8%;right:8%;top:31%;text-align:center;white-space:pre-line;font-weight:900;color:#ead5a6;font-size:1.15em;text-shadow:0 2px 8px #000}
  .orda-scope{position:absolute;inset:0;width:100%;height:100%;opacity:0}.orda-hurt{position:absolute;inset:0;opacity:0;box-shadow:inset 0 0 90px #e84235}
  .orda-hit{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font:30px Arial;color:#f8e0bd;opacity:0}
  .orda-view.dead{background:linear-gradient(145deg,#0f181e,#1e302f)}.orda-view.dead .orda-cross,.orda-view.dead .orda-ammo,.orda-view.dead .orda-health{display:none}
  .orda-view.dead .orda-center{top:35%;font-size:1.4em}.orda-view.dead .orda-top{background:none}
  .orda-overlay-phone .orda-ammo{bottom:195px}.orda-overlay-phone .orda-box-prompt{bottom:195px;max-width:55%}
  @media(max-width:700px){.orda-box-prompt{bottom:200px;left:8px;max-width:85%}.orda-view{font-size:11px}.orda-top{top:8px;left:7px;right:7px}.orda-ammo{bottom:130px;right:8px;padding:5px 8px}.orda-center{top:30%}}
  `;document.head.appendChild(s);
 }
 private async boot(participants:OrdaParticipant[]):Promise<void>{
  await Promise.all([this.assets.load(),this.box.ready]);if(this.disposed)return;
  participants.forEach((p,i)=>{const actor=this.assets.actor('player','survivor:'+p.id,p.color,p.name);actor.showLabel(true);for(const m of actor.root.getChildMeshes())m.layerMask=1<<(5+i);this.playerActors.set(p.id,actor);});
  // Warm every archetype before countdown; pools retain at most six idle actors.
  for(const kind of ['infetto','corridore','colosso','assalitore','cacciatore','macellaio','warrok','zombiegirl','yaku','pumpkinhulk'] as EnemyKind[]){const actor=this.assets.actor(kind,'warm:'+kind);for(const m of actor.root.getChildMeshes())m.layerMask=WORLD_LAYER;actor.root.setEnabled(false);this.free.push({kind,actor,lastX:0,lastZ:0,lastAt:0});}
  for(let i=0;i<44;i++){const m=MeshBuilder.CreateSphere('orda-pooled-projectile',{diameter:.26,segments:5},this.scene);m.material=this.material(i%2?'enemyBolt':'rayBolt',i%2?'#ffad69':'#71ff58');m.layerMask=WORLD_LAYER;m.setEnabled(false);this.bolts.push(m);}
  for(let i=0;i<22;i++){const m=MeshBuilder.CreateTorus('enemy-warning',{diameter:1,thickness:.045,tessellation:20},this.scene);m.material=this.material('warning','#ff8b5f');m.layerMask=WORLD_LAYER;m.setEnabled(false);this.tells.push(m);}
  for(let i=0;i<24;i++){const m=MeshBuilder.CreateBox('shot-trace',{width:.018,height:.018,depth:1},this.scene);m.material=this.material('trace','#efdc9c');m.layerMask=WORLD_LAYER;m.setEnabled(false);this.fx.push({mesh:m,life:0,max:0,kind:'trace'});}
  for(let i=0;i<8;i++){const m=MeshBuilder.CreateTorus('impact-ring',{diameter:1,thickness:.06,tessellation:18},this.scene);m.material=this.material('blast','#de9f6c');m.layerMask=WORLD_LAYER;m.setEnabled(false);this.fx.push({mesh:m,life:0,max:0,kind:'blast'});}
  await Promise.all(this.rigs.map(r=>r.vm.whenReady()));if(this.disposed)return;this.lightWeapons();
  await this.scene.whenReadyAsync();if(this.disposed)return;this.sound.start();
 }
 private material(id:string,color:string):StandardMaterial{let m=this.mat.get(id);if(!m){m=new StandardMaterial('ordaFX:'+id,this.scene);m.disableLighting=true;m.emissiveColor=Color3.FromHexString(color);m.diffuseColor=m.emissiveColor;m.freeze();this.mat.set(id,m);}return m;}
 private lightWeapons():void{
  // Scene-local texture fill: no change to Sparatoria materials, placement, recoil or imported geometry.
  for(const m of this.scene.materials)if(m instanceof StandardMaterial&&m.name.startsWith('weapon:')&&!m.disableLighting){m.unfreeze();if(!m.emissiveTexture)m.emissiveTexture=m.diffuseTexture;m.emissiveColor.r=Math.max(.14,m.emissiveColor.r);m.emissiveColor.g=Math.max(.15,m.emissiveColor.g);m.emissiveColor.b=Math.max(.16,m.emissiveColor.b);m.useEmissiveAsIllumination=true;m.freeze();}
 }
 private resize():void{this.engine.resize();for(const r of this.rigs){const v=r.cam.viewport,w=this.canvas.clientWidth*v.width,h=this.canvas.clientHeight*v.height;r.vm.aspect=w/Math.max(1,h);r.scope.src=scopeSvg(w,h);}}
 setPaused(value:boolean):void{this.paused=value;this.sound.paused(value);}
 show(value:boolean):void{this.root.style.display=value?'':'none';}
 update(s:OrdaState,dt:number,events:OrdaEvent[]=[]):void{
  if(this.disposed)return;
  this.audience=s;
  this.box.update(s);
  if(this.phone&&!s.players.some(p=>this.ids.has(p.id)&&p.alive)){
   if(!this.deadPhone){for(const e of events)if(e.type==='death'||e.type==='win')this.sound.event(e,this.ids);this.sound.paused(true);this.deadPhone=true;}
   this.scene.activeCameras=[];this.hud(s);return;
  }
  for(const e of events)this.event(e);
  const now=performance.now()/1000,elapsed=Math.min(.15,now-this.animateAt),animate=elapsed>(this.phone?1/20:1/30);if(animate)this.animateAt=now;
  const liveIds=new Set(s.enemies.map(e=>e.id));for(const[id,v]of this.actors)if(!liveIds.has(id)){v.actor.root.setEnabled(false);this.actors.delete(id);if(this.free.length<6)this.free.push(v);else v.actor.dispose();}
  let tell=0;
  for(const e of s.enemies){let v=this.actors.get(e.id);if(!v){const idx=this.free.findIndex(v=>v.kind===e.kind);v=idx>=0?this.free.splice(idx,1)[0]:{kind:e.kind,actor:this.assets.actor(e.kind,'enemy:'+e.id),lastX:e.x,lastZ:e.z,lastAt:s.time};v.actor.resetAnimation(e.id);v.lastX=e.x;v.lastZ=e.z;v.lastAt=s.time;v.speed=0;for(const m of v.actor.root.getChildMeshes())m.layerMask=WORLD_LAYER;v.actor.root.setEnabled(true);const actor=v.actor;if(actor.animator)actor.animator.onCue=cue=>{if(!this.paused){const d=Math.min(...(this.audience?.players??[]).filter(p=>this.ids.has(p.id)&&p.alive).map(p=>Math.hypot(p.x-actor.root.position.x,p.z-actor.root.position.z)));monsterSfx(cue,d,actor.animator?.profile.audio==='heavy');}};this.actors.set(e.id,v);}
   if(animate){if(s.time>v.lastAt)v.speed=Math.min(7,Math.hypot(e.x-v.lastX,e.z-v.lastZ)/Math.max(.001,s.time-v.lastAt));const speed=v.speed??0,running=e.kind==='corridore'||e.action==='charge'||isSpecial(e.kind)&&!!e.target&&e.kind!=='pumpkinhulk';
    let state:MonsterState=e.hp<=0?'DEATH':e.action==='roar'?'ROAR':e.action==='jump'?'JUMP':e.action==='punch'||e.windup>0?'ATTACK':speed>.12?(running?'RUN':'WALK'):'BREATHING_IDLE';
    let age=e.hp<=0?s.time-(e.deathAt??s.time):['roar','jump','punch'].includes(e.action)?s.time-(e.actionAt??s.time):e.windup>0?s.time-(e.actionAt??s.time):undefined;
    if(e.hp>0&&isSpecial(e.kind)&&['punch','swipe','heavy','jumpAttack','roar','taunt'].includes(e.action)){const t=attackTiming(e);state=t.clip;age=(s.time-(e.actionAt??s.time))*t.rate;}
    // Existing humanoids keep their original damage/cooldown timing; stretch only the visual preparation.
    if(e.hp>0&&e.kind!=='warrok'&&e.action==='melee'&&e.windup>0&&v.actor.animator){const impact=v.actor.animator.profile.events.impactSeconds;age=Math.min(impact,(s.time-(e.actionAt??s.time))*impact/(e.kind==='colosso'?.85:.45));}
    v.actor.setAnimation(state,age);v.actor.update(e.x,e.z,e.yaw,speed,running,s.time,elapsed,e.windup>0);v.actor.root.position.y=e.y;
    if(!v.actor.animator&&e.hp<=0)v.actor.body.rotation.z=Math.min(1,(s.time-(e.deathAt??s.time))/.5)*1.4;
    if(e.hp>0&&e.hitAt!==undefined){const hit=Math.max(0,1-(s.time-e.hitAt)/.18);v.actor.body.rotation.x-=hit*.08;}
    v.lastX=e.x;v.lastZ=e.z;v.lastAt=s.time;}
   if(e.windup>0&&tell<this.tells.length){const m=this.tells[tell++];m.setEnabled(true);m.position.set(e.x,e.y+.08,e.z);const radius=e.action==='slam'?5:e.action==='charge'?2:isSpecial(e.kind)?attackTiming(e).reach:1.15;m.scaling.set(radius*2,1,radius*2);m.rotation.y=0;
    if(e.action==='jumpAttack'){m.position.set(e.aim.x,0.08,e.aim.z);}
    if(e.action==='charge'){m.position.x=(e.x+e.aim.x)/2;m.position.z=(e.z+e.aim.z)/2;m.rotation.y=Math.atan2(e.aim.x-e.x,e.aim.z-e.z);m.scaling.set(1.8,1,Math.hypot(e.aim.x-e.x,e.aim.z-e.z));}
   }
  }
  while(tell<this.tells.length)this.tells[tell++].setEnabled(false);
  s.players.forEach(p=>{const actor=this.playerActors.get(p.id);if(!actor)return;if(!p.alive){const age=(this.deathAges.get(p.id)??0)+dt;this.deathAges.set(p.id,age);actor.root.setEnabled(age<.6);actor.root.rotation.z=-Math.min(1,age/.45)*Math.PI/2;return;}actor.root.setEnabled(true);if(animate){actor.update(p.x,p.z,p.yaw,p.moving,p.moving>6,s.time,1/30,false,false);actor.root.position.y=p.y;}});
  for(let i=0;i<this.bolts.length;i++){const b=s.bolts[i],m=this.bolts[i];m.setEnabled(!!b);if(b){m.position.set(b.x,b.y,b.z);m.material=this.mat.get(b.hostile?'enemyBolt':'rayBolt')!;m.scaling.setAll(b.hostile?1.4:.7);}}
  const active:UniversalCamera[]=[];
  for(const r of this.rigs){const p=s.players.find(p=>p.id===r.id);if(!p)continue;
   if(p.alive){active.push(r.cam);r.cam.position.set(p.x,p.y+(p.crouch?.95:1.55),p.z);r.cam.rotation.set(p.pitch+r.vm.cameraKickPitch,p.yaw+r.vm.cameraKickYaw,r.vm.cameraKickRoll);r.cam.fov=aimFov(1.05,p.ads,weaponOf(p.weapon).scopeZoom??1.35);
    if(r.weapon!==p.weapon){r.weapon=p.weapon;r.vm.equip(p.weapon);void r.vm.whenReady().then(()=>{if(!this.disposed)this.lightWeapons();});}r.vm.ads=p.reload>0?0:p.ads;r.vm.reloadInfo=p.weaponReload;r.vm.update(this.paused?0:dt,Math.min(1,p.moving/5.5),0,0,p.reload>0?Math.max(.001,1-p.reload/(p.weaponReload?.duration??weaponOf(p.weapon).reload)):0,p.dash>0);
   }
   r.hurt=Math.max(0,r.hurt-dt*2.5);r.hitTime=Math.max(0,r.hitTime-dt);r.messageTime=Math.max(0,r.messageTime-dt);r.flash.style.opacity=String(r.hurt);r.hit.style.opacity=r.hitTime>0?'1':'0';r.scope.style.opacity=String(scopeAlpha(p.weapon==='laser',p.ads,p.alive,p.reload>0));
  }
  this.scene.activeCameras=active;
  if(now-this.hudAt>1/15){this.hudAt=now;this.hud(s);}
  for(const f of this.fx){if(f.life<=0)continue;f.life-=dt;f.mesh.setEnabled(f.life>0);if(f.kind==='blast')f.mesh.scaling.setAll((1-f.life/f.max)*f.max*18+.3);}
  // Gentle global fixture dip, no per-lamp lights, no fullscreen flickering filter.
  for(const m of this.fixture)m.emissiveColor.setAll(.6+(Math.sin(s.time*1.3)> .995?.07:.3));
  if(!this.paused)this.sound.update(s);
 }
 private hud(s:OrdaState):void{
  const survivors=s.players.filter(p=>p.alive).length,boss=s.enemies.find(e=>(e.kind==='macellaio'||e.kind==='pumpkinhulk')&&e.hp>0);
  for(const r of this.rigs){const p=s.players.find(p=>p.id===r.id);if(!p)continue;r.panel.classList.toggle('dead',!p.alive);
   r.identity.textContent=`${p.name}${p.bot?' · BOT':''} · ${Math.max(0,ZOMBIES.maxHits-p.hitsTaken)}/${ZOMBIES.maxHits} COLPI`;
   r.wallet.textContent=`${p.points} PUNTI · CASSA ${ZOMBIES.boxCost}`;r.wallet.classList.toggle('ready',p.points>=ZOMBIES.boxCost);
   r.boxPrompt.textContent=mysteryPrompt(s,p).replaceAll('R1 / RB',this.phone?'CASSA':'R1 / RB');r.boxPrompt.style.display=r.boxPrompt.textContent?'block':'none';
   r.bar.style.width=`${p.hp}%`;r.stats.textContent=`ONDATA ${s.wave||1} · ${s.enemies.filter(e=>e.hp>0).length+s.pending} MOSTRI · ${survivors} VIVI · ${p.kills} UCC.${boss?` · BOSS ${Math.ceil(boss.hp)}/${Math.ceil(boss.maxHp)}`:''}`;
   r.boss.style.display=boss?'block':'none';if(boss){r.boss.childNodes[0].textContent=boss.kind==='pumpkinhulk'?'PUMPKINHULK · IL COLOSSO':'IL MACELLAIO';r.bossFill.style.width=`${Math.max(0,boss.hp/boss.maxHp*100)}%`;}
   const buff=p.damageBoost>0?'DANNI ×1.5':p.speedBoost>0?'VELOCITÀ +':p.shield>0?'PROTEZIONE 40%':'';
   r.ammo.textContent=`${weaponOf(p.weapon).name}\n${p.ammo} / ${p.reserve}${p.reload>0?' · RICARICA':p.ammo===0?' · RICARICA!':''}${buff?'\n'+buff:''}`;
   if(s.phase==='finished')r.center.textContent=s.winner===p.id?'ULTIMO VIVO\nHAI VINTO':`${s.players.find(p=>p.id===s.winner)?.name} VINCE\n${p.kills} mostri eliminati`;
   else if(!p.alive)r.center.textContent=`ELIMINATO\n${p.kills} mostri · ${Math.floor(p.damage)} danni\n${survivors} superstiti in lotta`;
   else if(s.phase==='countdown')r.center.textContent=`ORDA FINALE\n${Math.max(1,Math.ceil(s.countdown))}\nL’ULTIMO VIVO VINCE`;
   else if(s.phase==='intermission')r.center.textContent=`RIFORNISCITI · ${Math.ceil(s.countdown)}s`;
   else if(r.messageTime>0)r.center.textContent=r.message;
   else r.center.textContent=survivors===2&&s.time%12<2?'ULTIMI DUE!':'';
  }
 }
 private event(e:OrdaEvent):void{
  if(this.paused)return;this.sound.event(e,this.ids);const r=this.rigs.find(r=>r.id===e.player);
  if(e.text==='punch-impact'||e.text==='monster-impact')monsterSfx('impact',0,true);
  if(e.type==='shot'){r?.vm.fire();if(e.weapon!=='bombarda'){const f=this.fx.find(f=>f.kind==='trace'&&f.life<=0);if(f&&e.x!==undefined&&e.tx!==undefined){const from=new Vector3(e.x,e.y!,e.z!),to=new Vector3(e.tx,e.ty!,e.tz!);f.mesh.position.copyFrom(Vector3.Center(from,to));f.mesh.lookAt(to);f.mesh.scaling.z=Vector3.Distance(from,to);f.life=f.max=.055;f.mesh.setEnabled(true);}}}
  if(e.type==='hit'&&r){r.hitTime=.12;if(e.text){r.message='+50 PUNTI · ELIMINATO';r.messageTime=.6;}}
  if(e.type==='hurt'&&r)r.hurt=.75;
  if((e.type==='supply'||e.type==='box')&&r){r.message=e.text??'';r.messageTime=2;}
  if(e.type==='wave'||e.type==='boss'||e.type==='death')for(const rig of this.rigs){rig.message=e.text??(e.type==='boss'?'IL MACELLAIO È ARRIVATO':`ONDATA ${e.value}`);rig.messageTime=2;}
  if(e.type==='blast'){const f=this.fx.find(f=>f.kind==='blast'&&f.life<=0);if(f){f.mesh.position.set(e.x!,Math.max(.08,e.y??.08),e.z!);f.life=f.max=.3;f.mesh.setEnabled(true);}}
 }
 render():void{if(!this.disposed&&this.scene.activeCameras?.length)this.scene.render();}
 stats():Record<string,unknown>{return{fps:this.engine.getFps(),width:this.engine.getRenderWidth(),height:this.engine.getRenderHeight(),scale:this.engine.getHardwareScalingLevel(),views:this.scene.activeCameras?.length??0,actors:this.actors.size,idleActors:this.free.length,meshes:this.scene.meshes.length};}
 dispose():void{if(this.disposed)return;this.disposed=true;window.removeEventListener('resize',this.resizeFn);this.sound.dispose();this.box.dispose();for(const r of this.rigs)r.vm.dispose();for(const v of [...this.actors.values(),...this.free])v.actor.dispose();for(const a of this.playerActors.values())a.dispose();this.assets.dispose();this.scene.dispose();this.engine.dispose();this.root.remove();}
}
