import {Engine,Scene,ArcRotateCamera,HemisphericLight,DirectionalLight,Vector3,Color3,Color4,MeshBuilder,StandardMaterial,DynamicTexture,Mesh} from '@babylonjs/core';
import {GEO_QUESTIONS,CATEGORY_NAMES} from '../../../shared/geofallQuestions';
import type {GeoAnswer} from '../../../shared/geofallQuestions';
import {abilityHub} from '../../core/abilityHub';
import {abilityFor,stateLabel} from '../../../shared/abilityCatalog';
import {geoAbilityStatus} from './geofallAbilities';
import type {PlayerInput} from '../../network/PlayerInput';
import {Rng} from '../../../shared/rng';
import type {MinigameContext} from '../types';
import {GeofallMatch,GEO,tileCenter} from './geofallRules';
import {GeofallBots} from './geofallBot';
import {ArenaEntity} from '../arena/arenaEntity';
import {readMove} from '../moveInput';
import {audio} from '../../core/AudioManager';
import {applyQuality,engineOptions} from '../../core/quality';
import {guardLoop} from '../../core/loopGuard';
import {runSteps} from '../../core/frameClock';
import {setGameIntensity} from '../../core/musicDirector';
const COLORS=['#ffe2a6','#a7e8fa','#dec0ff','#bef4cd','#ffb8ca','#ffb8ca','#bef4cd','#dec0ff','#a7e8fa','#ffe2a6'];
export class BabylonGeofallGame {
 readonly engine:Engine;readonly scene:Scene;readonly camera:ArcRotateCamera;readonly match:GeofallMatch;readonly ready:Promise<void>;
 readonly entities=new Map<string,ArenaEntity>();readonly tiles:Mesh[]=[];readonly textures:DynamicTexture[]=[];
 private images=new Map<string,HTMLImageElement>();private bots:GeofallBots;private hud:HTMLDivElement;private title:HTMLElement;private question:HTMLElement;private timer:HTMLElement;private hint:HTMLElement;private cards:HTMLElement[]=[];
 private labels=new Map<string,Mesh>();private paused=false;private disposed=false;private controlsReady=false;private shownRound=0;private shownPhase='';private seconds=-1;private sent=false;private endTime=2;private signals=new Map<string,string>();
 private presses=new Map<string,{input:PlayerInput;serial:number;cancel:number}>();
 private cardsObserver:ResizeObserver;
 private onResize=()=>{this.engine.resize();this.fitCamera();};
 constructor(canvas:HTMLCanvasElement,private ctx:MinigameContext){
  abilityHub.begin('geofall',ctx);
  const opts=engineOptions();this.engine=new Engine(canvas,opts.antialias,opts);this.scene=new Scene(this.engine);this.scene.clearColor=new Color4(.035,.075,.16,1);
  this.camera=new ArcRotateCamera('geofallCamera',-Math.PI/2,.52,37,new Vector3(0,0,-1),this.scene);this.camera.inputs.clear();this.camera.fov=.75;this.camera.minZ=.1;this.camera.maxZ=150;
  new HemisphericLight('geoSky',new Vector3(0,1,0),this.scene).intensity=.9;new DirectionalLight('geoSun',new Vector3(-.4,-1,.3),this.scene).intensity=.5;
  this.match=new GeofallMatch(ctx.players.map(p=>({id:p.id,name:p.displayName,color:p.color,characterId:p.characterId,bot:p.bot})),ctx.rng);this.bots=new GeofallBots(new Rng(ctx.rng.int(1,0x7fffffff)));
  for(let i=0;i<10;i++){
   const center=tileCenter(i),tile=MeshBuilder.CreateBox(`geofallTile${i}`,{width:5,depth:5,height:.4},this.scene);tile.position.set(center.x,-.2,center.z);
   const side=new StandardMaterial(`tileSide${i}`,this.scene);side.diffuseColor=Color3.FromHexString(COLORS[i]);tile.material=side;this.tiles.push(tile);
   const top=MeshBuilder.CreateGround(`answer${i}`,{width:4.93,height:4.93},this.scene);top.parent=tile;top.position.y=.205;
   const texture=new DynamicTexture(`answerTexture${i}`,{width:512,height:512},this.scene,false),mat=new StandardMaterial(`answerMaterial${i}`,this.scene);texture.wrapU=texture.wrapV=0;mat.diffuseTexture=texture;mat.emissiveColor=new Color3(.85,.85,.85);mat.disableLighting=true;mat.specularColor=Color3.Black();top.material=mat;this.textures.push(texture);
  }
  const spawn=MeshBuilder.CreateBox('geoNeutralSpawn',{width:12,depth:3,height:.4},this.scene);spawn.position.set(0,-.2,-6.5);const sm=new StandardMaterial('spawnMat',this.scene);sm.diffuseColor=Color3.FromHexString('#24496b');spawn.material=sm;
  const dot=new DynamicTexture('geoDot',16,this.scene,false);dot.getContext().fillStyle='white';dot.getContext().fillRect(0,0,16,16);dot.update();
  for(const snap of ctx.players){const e=new ArenaEntity(this.scene,dot,snap.color,snap.characterId,snap.avatar,snap.displayName,null,{context:'arena',nameplate:false});e.setSizeMul(.8);this.entities.set(snap.id,e);
   const tex=new DynamicTexture('geoName',{width:256,height:64},this.scene,false);tex.hasAlpha=true;const c=tex.getContext() as CanvasRenderingContext2D;c.font='bold 30px Arial';c.textAlign='center';c.lineWidth=5;c.strokeStyle='#081424';c.strokeText(snap.displayName.slice(0,16),128,42);c.fillStyle=snap.color;c.fillText(snap.displayName.slice(0,16),128,42);tex.update();
   const mat=new StandardMaterial('geoNameMat',this.scene);mat.diffuseTexture=tex;mat.useAlphaFromDiffuseTexture=true;mat.disableLighting=true;mat.emissiveColor=Color3.White();const label=MeshBuilder.CreatePlane('geoName',{width:2,height:.5},this.scene);label.material=mat;label.billboardMode=Mesh.BILLBOARDMODE_ALL;this.labels.set(snap.id,label);
   const ring=MeshBuilder.CreateTorus('geoPlayerRing',{diameter:1.3,thickness:.055,tessellation:32},this.scene);ring.parent=e.root;ring.scaling.setAll(1/.8);ring.position.y=.08;const rm=new StandardMaterial('geoRingMat',this.scene);rm.diffuseColor=Color3.FromHexString(snap.color);rm.emissiveColor=rm.diffuseColor;rm.disableLighting=true;ring.material=rm;
  }
  const globe=MeshBuilder.CreateSphere('worldBelow',{diameter:12,segments:16},this.scene);globe.position.set(0,-24,1);const gm=new StandardMaterial('worldMat',this.scene);gm.diffuseColor=Color3.FromHexString('#214e8b');gm.wireframe=true;globe.material=gm;
  this.hud=document.createElement('div');this.hud.id='geofall-hud';this.hud.style.cssText='position:fixed;inset:0;z-index:10001;pointer-events:none;font-family:Arial,sans-serif;color:white;';
  this.hud.innerHTML='<style>body:has(#geofall-hud) #pad-alert{left:12px;top:110px;transform:none;max-width:250px;white-space:normal;font:700 13px/1.3 Arial;padding:8px}body:has(#geofall-hud) #pad-toasts{left:auto;right:12px;top:110px;transform:none;max-width:250px}body:has(#geofall-hud) #pad-toasts>div{font:700 13px/1.3 Arial;padding:8px;max-width:100%}#geofall-hud .geo-top{position:absolute;top:12px;left:4%;right:4%;text-align:center;text-shadow:0 2px 5px #000}#geofall-hud .geo-category{font-size:14px;font-weight:800;letter-spacing:2px;color:#67e8f9}#geofall-hud .geo-question{font-size:clamp(17px,2.1vw,28px);font-weight:900;margin:5px 0}#geofall-hud .geo-timer{font-size:24px;font-weight:900;color:#fbbf24}#geofall-hud .geo-bottom{position:absolute;bottom:12px;left:3%;right:3%;display:flex;gap:6px}#geofall-hud .geo-card{flex:1;min-width:0;text-align:center;padding:7px 3px;border-radius:10px;background:#091628de;border:1px solid var(--player);font-size:14px;font-weight:bold}#geofall-hud .geo-hearts{font-size:20px;color:#fb7185;margin:3px 0}#geofall-hud .geo-hint{position:absolute;bottom:124px;left:5%;right:5%;text-align:center;font-size:15px;font-weight:800;text-shadow:0 2px 5px #000}@media(max-height:620px){#geofall-hud .geo-top{top:6px}#geofall-hud .geo-question{margin:2px 0}#geofall-hud .geo-card{font-size:12px;padding:3px}#geofall-hud .geo-hearts{font-size:16px}#geofall-hud .geo-hint{bottom:102px;font-size:12px}}</style><div class="geo-top"><div class="geo-category"></div><div class="geo-question"></div><div class="geo-timer"></div></div><div class="geo-hint"></div><div class="geo-bottom"></div>';
  document.body.appendChild(this.hud);this.title=this.hud.querySelector('.geo-category')!;this.question=this.hud.querySelector('.geo-question')!;this.timer=this.hud.querySelector('.geo-timer')!;this.hint=this.hud.querySelector('.geo-hint')!;
  const bottom=this.hud.querySelector('.geo-bottom')!;for(const p of this.match.players){const card=document.createElement('div');card.className='geo-card';card.style.setProperty('--player',p.color);card.innerHTML='<div class="geo-name"></div><div class="geo-hearts"></div><div class="geo-push"></div><div class="geo-ability" style="font-size:11px;color:#d9c7ff;line-height:1.3;margin-top:3px"></div>';card.querySelector('.geo-name')!.textContent=p.name;bottom.appendChild(card);this.cards.push(card);}
  this.cardsObserver=new ResizeObserver(entries=>{this.hint.style.bottom=`${Math.max(102,entries[0].contentRect.height+24)}px`;});this.cardsObserver.observe(bottom);
  applyQuality(this.engine,this.scene);this.fitCamera();window.addEventListener('resize',this.onResize);this.ready=this.initialize();
  this.engine.runRenderLoop(guardLoop(()=>{if(this.disposed||this.paused)return;runSteps(this.engine.getDeltaTime(),dt=>this.step(dt));this.ctx.input.update();this.scene.render();}));
 }
 private async initialize():Promise<void>{
  const urls=[...new Set(GEO_QUESTIONS.flatMap(q=>[q.correct,...q.wrong].map(a=>a.image).filter((v):v is string=>!!v)))];
  await Promise.all(urls.map(async url=>{const image=new Image();image.src=url;await image.decode();if(this.disposed)return;this.images.set(url,image);}));
  if(this.disposed)return;this.paintAnswers();await(this.ctx.showControls?.()??Promise.resolve());if(this.disposed)return;this.ctx.input.reset();this.match.cancel();this.controlsReady=true;
 }
 private fitCamera():void{const aspect=this.engine.getAspectRatio(this.camera);this.camera.radius=Math.max(27,26/aspect);}
 setPaused(on:boolean):void{this.paused=on;this.match.cancel();for(const p of this.match.players)this.ctx.input.cancelPlayer(p.id);}
 private paintAnswers():void{this.match.answers.forEach((a,i)=>this.paint(a,i));this.shownRound=this.match.round;}
 private paint(a:GeoAnswer,i:number):void{
  const t=this.textures[i],c=t.getContext() as CanvasRenderingContext2D;c.clearRect(0,0,512,512);c.fillStyle=COLORS[i];c.fillRect(0,0,512,512);c.strokeStyle='#ffffff';c.lineWidth=8;c.strokeRect(6,6,500,500);
  c.fillStyle='#17314d';c.font='bold 42px Arial';c.textAlign='left';c.fillText(String(i+1),22,42);
  const image=a.image?this.images.get(a.image):null;if(image){const scale=Math.min(438/image.naturalWidth,330/image.naturalHeight),w=image.naturalWidth*scale,h=image.naturalHeight*scale;c.drawImage(image,(512-w)/2,76+(330-h)/2,w,h);}
  const showText=!['bandiere','sagome'].includes(this.match.question.category);
  if(showText){const words=a.label.split(' '),lines:string[]=[];let line='';c.font=`bold ${image?42:58}px Arial`;for(const word of words){const next=line?line+' '+word:word;if(c.measureText(next).width>460&&line){lines.push(line);line=word;}else line=next;}if(line)lines.push(line);c.textAlign='center';c.fillStyle='#102940';lines.forEach((line,n)=>c.fillText(line,256,(image?440:230)+n*(image?44:65)));}
  t.update();
 }
 step(dt:number):void{
  if(this.disposed||this.paused)return;
  if(this.controlsReady&&this.match.phase!=='ended'){
   const commands=this.match.players.map(p=>{
    const input=this.ctx.input.get(p.id),m=readMove(input),old=this.presses.get(p.id),serial=input.pressCount('ability');
    const base=!old||old.input!==input||old.cancel!==input.cancellationVersion?input.pressCountAtCancellation('ability'):old.serial;
    this.presses.set(p.id,{input,serial,cancel:input.cancellationVersion});
    const cmd=p.bot?this.bots.command(p,this.match,dt):{x:m.x+Number(input.pressed('right'))-Number(input.pressed('left')),z:m.z+Number(input.pressed('up'))-Number(input.pressed('down')),push:input.justPressed('push'),ability:serial>base};
    return{p,input,cmd};
   });
   for(const {p,cmd} of commands)if(Math.hypot(cmd.x,cmd.z)>.1)p.facing=Math.atan2(cmd.x,cmd.z);
   // All defensive abilities start before this frame's attacks, independent of roster order.
   for(const {p,cmd} of commands)if(cmd.ability){const failed=this.match.activate(p.id);if(failed)abilityHub.failed(p.id,failed);}
   for(const {p,input,cmd} of commands)this.match.command(p.id,cmd.x,cmd.z,cmd.push,input.cancellationVersion);
   this.match.advance(dt);
  }
  if(this.shownRound!==this.match.round&&this.images.size){this.paintAnswers();this.ctx.input.reset();this.seconds=-1;}
  const m=this.match,fallProgress=m.phase==='collapse'?1-m.phaseTime/GEO.collapse:m.phase==='rebuild'?m.phaseTime/GEO.rebuild:0;
  this.tiles.forEach((tile,i)=>{tile.position.y=-.2-(i!==m.correctIndex&&['collapse','rebuild'].includes(m.phase)?fallProgress*fallProgress*9:0);});
  for(const p of m.players){const e=this.entities.get(p.id)!,fall=p.lost&&['collapse','rebuild'].includes(m.phase),visible=p.lives>0||fall;e.root.setEnabled(visible);
   e.updateVisual({x:p.x,y:fall?-fallProgress*fallProgress*8:0,z:p.z,vx:p.dx*GEO.speed+p.vx,vz:p.dz*GEO.speed+p.vz,facing:p.facing,alive:visible,falling:fall,spin:0,dashing:p.dash>0,stunTime:p.stun,hitFlash:p.hit},dt,m.time*1000);
   const label=this.labels.get(p.id)!;label.setEnabled(visible&&!fall);label.position.set(p.x,1.9,p.z);
  }
  const phaseChanged=this.shownPhase!==m.phase;this.shownPhase=m.phase;
  if(phaseChanged&&m.phase==='collapse'){audio.fall();for(const p of m.players)if(p.lost)this.ctx.vibrate(p.id,90);}
  for(const ev of m.events){if(ev.type==='ability'){abilityHub.activated(ev.id!);this.entities.get(ev.id!)?.playAbility(abilityFor('geofall',m.players.find(p=>p.id===ev.id)?.characterId)?.name??'ABILITÀ');audio.select();}if(ev.type==='blocked')abilityHub.succeeded(ev.id!,'pushBlocked');if(ev.type==='confusionWarning')this.ctx.vibrate(ev.id!,70);if(ev.type==='hit')audio.thump(.6);if(ev.type==='win'){audio.announcer('WINNER');this.entities.get(ev.id!)?.celebrate(2);}}
  m.events=[];
  const sec=Math.ceil(m.remaining);if(this.controlsReady&&m.phase==='answer'&&sec!==this.seconds){this.seconds=sec;if(sec<=3&&sec>0)audio.countdown(sec);}
  setGameIntensity(m.phase==='answer'&&m.remaining<=3?2:1);
  this.title.textContent=`GEOFALL · ROUND ${m.round} · ${CATEGORY_NAMES[m.question.category]}${m.tie?' · SPAREGGIO':m.alive.length===2?' · DUELLO FINALE':''}`;
  this.question.textContent=m.phase==='ended'?`${m.players.find(p=>p.id===m.winner)?.name} · IL MONDO È TUO!`:m.question.prompt;
  this.timer.textContent=!this.controlsReady?'PREPARATEVI':m.phase==='answer'?`${m.remaining.toFixed(1)} s`:m.phase==='intro'?'LEGGI E PREPARATI':m.phase==='collapse'?`CORRETTA: ${m.correctIndex+1} · ${m.question.correct.label}`:m.phase==='rebuild'?'IL MONDO SI RICOSTRUISCE':'ULTIMO SOPRAVVISSUTO';this.timer.style.color=m.phase==='answer'&&m.remaining<=3?'#fb7185':'#fbbf24';
  this.hint.textContent=m.phase==='answer'?'STICK SINISTRO / TELEFONO: MUOVITI · A/✕: UNA SPINTA · RB/R1: ABILITÀ · NON RESTARE NELLO SPAWN':m.phase==='collapse'?'POSIZIONI BLOCCATE ALLA SCADENZA · NOVE CASELLE CROLLANO INSIEME':m.tie?'ULTIMI PARI: UNA VITA · NUOVA DOMANDA':'TRE VITE · DIECI RISPOSTE · UNA SOLA CORRETTA';
  m.players.forEach((p,i)=>{const c=this.cards[i];c.style.opacity=p.lives<=0?'.55':'1';c.querySelector('.geo-hearts')!.textContent='♥'.repeat(p.lives)+'♡'.repeat(3-p.lives);c.querySelector('.geo-push')!.textContent=p.lives<=0?'SPETTATORE':m.phase==='collapse'&&p.lost?'−1 VITA':p.pushUsed?'SPINTA USATA':'SPINTA PRONTA';
   const ab=geoAbilityStatus(p,m.phase),definition=abilityFor('geofall',p.characterId);abilityHub.setStatus(p.id,ab);
   c.querySelector('.geo-ability')!.textContent=p.confusionWarning>0?'⚠ TRA POCO COMANDI INVERTITI':p.confusion>0?'↔ COMANDI INVERTITI':`${definition?.name??'ABILITÀ'} · ${stateLabel(ab)}`;
   const phoneAbility={...ab,...(ab.remaining!==undefined?{remaining:Math.ceil(ab.remaining*5)/5}:{})};
   const status={type:'geofallStatus',ability:phoneAbility,abilityName:definition?.name??'ABILITÀ',confusion:p.confusion>0,confusionWarning:p.confusionWarning>0,round:m.round,lives:p.lives,available:this.controlsReady&&m.phase==='answer'&&p.lives>0,pushReady:!p.pushUsed,phase:m.phase,tie:m.tie,seconds:Math.ceil(m.remaining)};const key=JSON.stringify(status);if(this.signals.get(p.id)!==key){this.signals.set(p.id,key);this.ctx.signal(p.id,status);}});
  if(m.phase==='ended'&&!this.sent&&this.controlsReady){this.endTime-=dt;if(this.endTime<=0){this.sent=true;this.ctx.finish({results:m.results()});}}
 }
 dispose():void{if(this.disposed)return;this.disposed=true;this.cardsObserver.disconnect();window.removeEventListener('resize',this.onResize);this.engine.stopRenderLoop();abilityHub.end();this.entities.forEach(e=>e.dispose());this.hud.remove();this.images.clear();this.scene.dispose();this.engine.dispose();}
}


