import {MYSTERY_BOX,ZOMBIES,healthFromHits}from './zombiesRules';
import {beginWeaponReload,advanceWeaponReload}from '../fpsReload';
import {WEAPONS} from '../fpsWeapons';
import type {WeaponConfig} from '../fpsWeapons';
import {rayVsAabb} from '../fpsMap';
import {DepotNavigation,STARTS,GATES,SUPPLIES,floorAt,move,visible,wallDistance} from './arena';
import type {Point} from './arena';
import {EMPTY_INPUT} from './types';
import {WARROK} from './warrok';
import {isSpecial,updateMonsterCombat,specialDeath} from './monsterCombat';
import type {EnemyKind,Enemy,OrdaEvent,OrdaInput,OrdaParticipant,OrdaState,Survivor,Bolt} from './types';

export const MAX_ACTIVE=22;
export const ORDA_WEAPONS:readonly WeaponConfig[]=WEAPONS.map(w=>({...w,damage:w.damage*(w.id==='sparapiselli'?1.45:w.id==='pistola'?1.15:1.12),splashDamage:w.splashDamage?65:undefined}));
export const weaponOf=(id:string)=>ORDA_WEAPONS.find(w=>w.id===id)??ORDA_WEAPONS.find(w=>w.id==='pistola')!;
export const ARCHETYPES:Record<EnemyKind,{hp:number;speed:number;damage:number;radius:number;height:number}>={
 infetto:{hp:94,speed:2.05,damage:16,radius:.43,height:1.8},
 corridore:{hp:78,speed:4,damage:13,radius:.4,height:2.15},
 colosso:{hp:470,speed:1.5,damage:37,radius:.62,height:2.65},
 assalitore:{hp:140,speed:2.05,damage:21,radius:.44,height:1.75},
 cacciatore:{hp:205,speed:3.05,damage:23,radius:.45,height:2.52},
 macellaio:{hp:2700,speed:1.85,damage:42,radius:.68,height:3.0},
 warrok:{hp:900,speed:2.65,damage:40,radius:.82,height:3.2},
 zombiegirl:{hp:110,speed:4.2,damage:18,radius:.36,height:1.85},
 yaku:{hp:290,speed:3.25,damage:27,radius:.46,height:2.25},
 pumpkinhulk:{hp:2800,speed:1.6,damage:45,radius:.9,height:3.5}
};
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.z-b.z);
const angle=(a:number,b:number)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
/** Host-only authority. The same fixed steps run at every render rate; phones never simulate damage. */
export class OrdaMatch{
 readonly state:OrdaState;
 readonly nav=new DepotNavigation();
 private events:OrdaEvent[]=[];private nextId=1;private seed:number;private spawnClock=0;private bossDue=false;
 private accumulator=0;private botSerial=0;
 readonly initialCount:number;
 constructor(participants:OrdaParticipant[],seed=12345){
  if(participants.length<2||participants.length>5)throw Error('Orda Finale richiede 2–5 partecipanti.');
  this.seed=seed||1;this.initialCount=participants.length;
  this.state={time:0,wave:0,phase:'countdown',countdown:3,pending:0,players:participants.map((p,i)=>({...p,...STARTS[i],y:0,vy:0,yaw:Math.atan2(-STARTS[i].x,-STARTS[i].z),pitch:0,hp:100,alive:true,kills:0,damage:0,deathAt:-1,points:0,pointsEarned:0,hitsTaken:0,lastDamageAt:-10,lastInteract:0,weapon:'pistola',ammo:12,reserve:96,reload:0,cooldown:0,ads:0,noise:0,moving:0,damageBoost:0,speedBoost:0,shield:0,dash:0,dashCooldown:0,crouch:false,lastFire:0,lastReload:0,lastJump:0,lastDash:0,burst:0,burstTimer:0,botThink:.15+i*.08,botTarget:0,botGoal:null,botPath:[],botNav:0})),enemies:[],bolts:[],supplies:SUPPLIES.map((s,i)=>({...s,id:i,cooldown:0})),box:{phase:'idle',owner:null,weapon:null,started:0,until:0,serial:0},winner:null,notice:'IL DEPOSITO INFETTO · L’ULTIMO VIVO VINCE'};
 }
 private random():number{let t=this.seed+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;}
 private emit(e:OrdaEvent):void{this.events.push(e);}
 drainEvents():OrdaEvent[]{return this.events.splice(0);}
 packet():OrdaState{return{...this.state,box:{...this.state.box},players:this.state.players.map(p=>({...p,botPath:[]})),enemies:this.state.enemies.map(e=>({...e,path:[]})),bolts:this.state.bolts.map(b=>({...b})),supplies:this.state.supplies.map(s=>({...s}))};}
 /** Keep bounded catch-up, with a fixed 1/30s combat clock independent of visual quality. */
 advance(seconds:number,input:(p:Survivor)=>OrdaInput=()=>EMPTY_INPUT):void{
  this.accumulator+=Math.min(.25,Math.max(0,seconds));while(this.accumulator>=1/30){this.accumulator-=1/30;this.step(1/30,input);}
 }
 step(dt:number,input:(p:Survivor)=>OrdaInput=()=>EMPTY_INPUT):void{
  const s=this.state;if(s.phase==='finished')return;s.time+=dt;
  if(s.phase==='countdown'){s.countdown-=dt;if(s.countdown<=0)this.startWave();return;}
  this.updateBox();
  for(const p of s.players)if(p.alive){this.player(p,p.bot?this.botInput(p,dt):input(p),dt);}
  if(s.phase==='fighting'){
   this.spawnClock-=dt;
   if(s.pending>0&&s.enemies.filter(e=>e.hp>0).length<MAX_ACTIVE&&this.spawnClock<=0){this.spawn();this.spawnClock=Math.max(.35,1.07-s.wave*.035);}
   for(const e of s.enemies)if(e.hp>0)this.enemy(e,dt);
   this.projectiles(dt);
   if(!s.enemies.some(e=>e.hp>0)&&s.pending===0){s.phase='intermission';s.countdown=5;s.notice='RESPIRO · RIFORNISCITI';}
  }else if(s.phase==='intermission'){s.countdown-=dt;if(s.countdown<=0)this.startWave();}
  s.enemies=s.enemies.filter(e=>e.hp>0||s.time-(e.deathAt??s.time)<(isSpecial(e.kind)?specialDeath(e.kind)+.2:e.kind==='infetto'||e.kind==='corridore'||e.kind==='colosso'?4.8:.65));
  for(const q of s.supplies)q.cooldown=Math.max(0,q.cooldown-dt);
  this.resolveDeaths();
 }
 startWave():void{
  const s=this.state;s.wave++;s.phase='fighting';s.pending=Math.ceil((3+s.wave*1.65)*this.initialCount*.7);this.bossDue=s.wave%5===0;if(this.bossDue)s.pending++;
  this.spawnClock=.2;s.notice=this.bossDue?(s.wave%10===0?'PUMPKINHULK · IL COLOSSO':'IL MACELLAIO · ATTENTO AI SEGNALI ROSSI'):`ONDATA ${s.wave}`;
  this.emit({type:this.bossDue?'boss':'wave',value:s.wave,text:this.bossDue?s.notice:undefined});
 }
 private spawn():void{
  const s=this.state;
  // Spawn only at actual gates, never on top of a survivor. If all gates are watched, keep the queue.
  // Eight gates at least 14m apart: five survivors cannot block all entrances by camping.
  const gates=GATES.filter(g=>s.players.every(p=>!p.alive||distance(g,p)>5.5));if(!gates.length){this.spawnClock=.5;return;}
  const unseen=gates.filter(g=>!s.players.some(p=>p.alive&&distance(g,p)<28&&Math.abs(angle(Math.atan2(g.x-p.x,g.z-p.z),p.yaw))<.65&&visible(p,g,p.y+1.5,floorAt(g.x,g.z)+1)));
  const choices=unseen.length?unseen:gates;
  const g=choices[Math.floor(this.random()*choices.length)];let kind:EnemyKind='infetto';
  if(this.bossDue){kind=s.wave>=10&&s.wave%10===0?'pumpkinhulk':'macellaio';this.bossDue=false;}else{const r=this.random();if(s.wave>=4&&r<.28)kind='corridore';if(s.wave>=7&&r>=.28&&r<.43)kind='colosso';if(s.wave>=7&&r>=.43&&r<.61)kind='assalitore';if(s.wave>=10&&r>=.61&&r<.79)kind='cacciatore';}
  if(kind!=='macellaio'&&kind!=='pumpkinhulk'&&s.wave>=WARROK.firstWave&&s.enemies.filter(e=>e.kind==='warrok'&&e.hp>0).length<WARROK.maxLiving&&(s.pending%7===0||this.random()<.1))kind='warrok';
  if(kind==='infetto'||kind==='corridore'){const r=this.random();if(s.wave>=3&&r<.3&&s.enemies.filter(e=>e.kind==='zombiegirl'&&e.hp>0).length<5)kind='zombiegirl';else if(s.wave>=8&&r<.5&&s.enemies.filter(e=>e.kind==='yaku'&&e.hp>0).length<3)kind='yaku';}
  const a=ARCHETYPES[kind],hp=a.hp*(1+Math.min(2.5,(s.wave-1)*.11))*(kind==='macellaio'||kind==='pumpkinhulk'?this.initialCount/3:1);
  const id=this.nextId++;
  s.enemies.push({id,kind,...g,y:floorAt(g.x,g.z),yaw:0,hp,maxHp:hp,speed:a.speed*(1+Math.min(.35,(s.wave-1)*.025)),damage:a.damage*(1+Math.min(.65,s.wave*.035)),radius:a.radius,height:a.height,target:null,memory:null,remember:0,path:[],think:(id%7)*.05,nav:0,attack:.5,windup:0,action:'walk',aim:{...g},stuck:0,last:{...g},rage:false});s.pending--;
 }
 private player(p:Survivor,i:OrdaInput,dt:number):void{
  const s=this.state,w=weaponOf(p.weapon);p.noise=Math.max(0,p.noise-dt);p.cooldown=Math.max(0,p.cooldown-dt);p.dashCooldown=Math.max(0,p.dashCooldown-dt);
  for(const k of ['damageBoost','speedBoost','shield','dash'] as const)p[k]=Math.max(0,p[k]-dt);
  p.crouch=i.crouch;p.ads+=((i.aim?1:0)-p.ads)*(1-Math.exp(-dt*14));
  if(i.look){p.yaw=i.look.yaw;p.pitch=clamp(i.look.pitch,-1.3,1.3);}else{p.yaw+=clamp(i.lx*(i.sensitivity??1)*2.6,-5.2,5.2)*dt*(1-p.ads*.56);p.pitch=clamp(p.pitch+i.ly*(i.sensitivity??1)*2*dt*(1-p.ads*.56),-1.3,1.3);}
  let mx=clamp(i.mx,-1,1),my=clamp(i.my,-1,1),mag=Math.hypot(mx,my);if(mag>1){mx/=mag;my/=mag;mag=1;}
  if(i.dash!==p.lastDash){p.lastDash=i.dash;if(p.dashCooldown<=0){p.dash=.18;p.dashCooldown=4;}}
  let speed=(p.crouch?2.5:5.5)*w.movementModifier*(1-p.ads*.38)*(p.speedBoost>0?1.25:1);if(p.dash>0)speed=12;
  const dx=Math.cos(p.yaw)*mx-Math.sin(p.yaw)*my,dz=-Math.sin(p.yaw)*mx-Math.cos(p.yaw)*my;
  const q=move(p.x,p.z,dx*speed*dt,dz*speed*dt,.43,p.y);p.moving=Math.hypot(q.x-p.x,q.z-p.z)/Math.max(.001,dt);p.x=q.x;p.z=q.z;
  if(p.moving>3.5)p.noise=Math.max(p.noise,.3);
  const floor=floorAt(p.x,p.z);
  if(i.jump!==p.lastJump){p.lastJump=i.jump;if(p.y<=floor+.05&&!p.crouch)p.vy=5.2;}
  p.vy-=15*dt;p.y+=p.vy*dt;if(p.y<floor){p.y=floor;p.vy=0;}
  if(w.shellReload&&p.ammo===0&&p.cooldown<=0&&p.reload<=0)this.reload(p);
  if(p.reload>0){if(p.weaponReload){const r=p.weaponReload,n=advanceWeaponReload(w,r,dt);p.ammo+=n;p.reserve-=n;p.reload=Math.max(0,r.duration-r.elapsed);if(p.reload===0)p.weaponReload=undefined;}else{p.reload-=dt;if(p.reload<=0){const n=Math.min(w.magazine-p.ammo,p.reserve);p.ammo+=n;p.reserve-=n;p.reload=0;}}}
  const interaction=i.interact??p.lastInteract;if(interaction!==p.lastInteract){p.lastInteract=interaction;this.interactBox(p);}
  // Square / X is contextual: use the nearby box OR reload, never both.
  if(i.reload!==p.lastReload){p.lastReload=i.reload;if(this.canReachBox(p))this.interactBox(p);else this.reload(p);}
  const pressed=i.press!==p.lastFire;p.lastFire=i.press;
  if(w.fireMode==='burst'&&pressed&&p.cooldown<=0&&p.reload<=0&&p.ammo>0){p.burst=3;p.burstTimer=0;p.cooldown=3/w.fireRate;}
  if(p.burst>0){p.burstTimer-=dt;if(p.burstTimer<=0){this.fire(p);p.burst--;p.burstTimer=w.burstGap??.075;}}
  else if(p.cooldown<=0&&p.reload<=0&&(w.fireMode==='auto'?i.fire:pressed)){if(p.ammo>0){this.fire(p);p.cooldown=1/w.fireRate;}else this.reload(p);}
  for(const supply of s.supplies)if(supply.cooldown<=0&&distance(p,supply)<1.25&&Math.abs(p.y-floorAt(supply.x,supply.z))<.9){
   if(supply.kind==='ammo'){if(p.reserve>=w.magazine*5)continue;p.reserve=w.magazine*6;supply.cooldown=5;this.emit({type:'supply',player:p.id,text:'MUNIZIONI +',value:p.reserve});}
   if(supply.kind==='health'){if(p.hitsTaken===0)continue;p.hitsTaken=Math.max(0,p.hitsTaken-1);p.hp=healthFromHits(p.hitsTaken);supply.cooldown=28;this.emit({type:'supply',player:p.id,text:'+1 COLPO DI RESISTENZA'});}

  }
 }
 /** Explicit proximity interaction, one owner and one debit, with no client-supplied price/weapon. */
 canReachBox(p:Survivor):boolean{
  return p.alive&&Math.hypot(p.x-MYSTERY_BOX.x,p.z-MYSTERY_BOX.z)<=ZOMBIES.interactRange&&Math.abs(p.y-MYSTERY_BOX.y)<.75&&visible(p,{x:MYSTERY_BOX.x,z:MYSTERY_BOX.z-.5},p.y+1.2,.8);
 }
 interactBox(p:Survivor):void{
  const s=this.state,b=s.box;if(s.phase==='finished'||s.phase==='countdown'||!this.canReachBox(p))return;
  if(b.phase==='ready'&&b.owner===p.id&&b.weapon){
   const w=weaponOf(b.weapon);p.weapon=w.id;p.ammo=w.magazine;p.reserve=w.magazine*4;p.reload=0;p.weaponReload=undefined;p.burst=0;p.cooldown=.45;p.ads=0;
   this.emit({type:'equip',player:p.id,weapon:w.id});this.emit({type:'supply',player:p.id,text:w.name});this.closeBox();return;
  }
  if(b.phase!=='idle'){this.emit({type:'box',player:p.id,text:b.owner===p.id?'ESTRAZIONE IN CORSO…':'CASSA OCCUPATA'});return;}
  if(p.points<ZOMBIES.boxCost){this.emit({type:'box',player:p.id,text:`SERVONO ${ZOMBIES.boxCost-p.points} PUNTI`});return;}
  p.points-=ZOMBIES.boxCost;b.phase='rolling';b.owner=p.id;b.weapon=null;b.started=s.time;b.until=s.time+ZOMBIES.rollSeconds;b.serial++;
  this.emit({type:'box',player:p.id,value:-ZOMBIES.boxCost,text:'MYSTERY BOX · −950 PUNTI'});
 }
 private closeBox():void{const b=this.state.box;if(b.phase==='idle'||b.phase==='closing')return;b.phase='closing';b.weapon=null;b.until=this.state.time+ZOMBIES.closeSeconds;}
 private updateBox():void{
  const s=this.state,b=s.box;if(b.phase==='idle')return;
  if(b.phase!=='closing'&&!s.players.some(p=>p.id===b.owner&&p.alive)){this.closeBox();return;}
  if(s.time<b.until)return;
  if(b.phase==='rolling'){
   const owner=s.players.find(p=>p.id===b.owner)!,pool=ORDA_WEAPONS.filter(w=>w.id!==owner.weapon);b.weapon=pool[Math.floor(this.random()*pool.length)].id;b.phase='ready';b.until=s.time+ZOMBIES.claimSeconds;
   this.emit({type:'box',player:owner.id,weapon:b.weapon,text:'ARMA PRONTA · RITIRALA ALLA CASSA'});
  }else if(b.phase==='ready'){this.emit({type:'box',player:b.owner!,text:'ARMA NON RITIRATA · CASSA CHIUSA'});this.closeBox();}
  else{b.phase='idle';b.owner=null;b.weapon=null;b.started=0;b.until=0;}
 }
 private reload(p:Survivor):void{const w=weaponOf(p.weapon);if(!p.alive||p.reload>0||p.ammo>=w.magazine||p.reserve<=0||(w.shellReload&&p.cooldown>0))return;p.weaponReload=w.reloadInsert!==undefined||w.shellReload?beginWeaponReload(w,p.ammo,p.reserve):undefined;p.reload=p.weaponReload?.duration??w.reload;p.burst=0;this.emit({type:'reload',player:p.id,weapon:p.weapon,value:p.reload});}
 private fire(p:Survivor):void{
  if(!p.alive||p.ammo<=0||p.reload>0)return;const w=weaponOf(p.weapon);p.ammo--;p.noise=1.3;
  const oy=p.y+(p.crouch?.95:1.55),damageBy=new Map<Enemy,number>();let first:{dx:number;dy:number;dz:number;range:number}|undefined;
  for(let pellet=0;pellet<(w.pellets??1);pellet++){
   const spread=(w.hipSpread??w.spread)*(1-p.ads*(w.pellets ? .25 : .85)),yaw=p.yaw+(this.random()-.5)*spread*2,pitch=p.pitch+(this.random()-.5)*spread*2;
   const dx=Math.sin(yaw)*Math.cos(pitch),dy=-Math.sin(pitch),dz=Math.cos(yaw)*Math.cos(pitch),dmg=w.damage*(p.damageBoost>0?1.5:1);
   if(w.projectileSpeed)this.state.bolts.push({id:this.nextId++,owner:p.id,hostile:false,x:p.x,y:oy,z:p.z,dx,dy,dz,speed:w.projectileSpeed,damage:dmg,radius:w.splashRadius,life:w.range/w.projectileSpeed});
   let range=wallDistance(p.x,oy,p.z,dx,dy,dz,w.range),hit:Enemy|null=null;
   if(!w.projectileSpeed){for(const e of this.state.enemies)if(e.hp>0){const d=rayVsAabb(p.x,oy,p.z,dx,dy,dz,{x:e.x,z:e.z,w:e.radius*2,d:e.radius*2,h:e.height,base:e.y});if(d!==null&&d>=0&&d<range){range=d;hit=e;}}
    if(hit){const head=oy+dy*range>hit.y+hit.height*.78;damageBy.set(hit,(damageBy.get(hit)??0)+dmg*(head?1.6:1));}
   }
   first??={dx,dy,dz,range};
  }
  for(const[e,damage]of damageBy)this.hurtEnemy(e,damage,p);
  if(first){const{dx,dy,dz,range}=first;this.emit({type:'shot',player:p.id,weapon:p.weapon,x:p.x,y:oy,z:p.z,tx:p.x+dx*range,ty:oy+dy*range,tz:p.z+dz*range});}
 }
 private hurtEnemy(e:Enemy,dmg:number,p:Survivor):void{
  if(e.hp<=0||!p.alive)return;const actual=Math.min(e.hp,dmg);e.hp-=dmg;p.damage+=actual;e.target=p.id;e.memory={x:p.x,z:p.z};e.remember=4;
  e.hitAt=this.state.time;
  if(e.hp<=0){p.kills++;p.points+=ZOMBIES.killPoints;p.pointsEarned+=ZOMBIES.killPoints;this.emit({type:'points',player:p.id,value:ZOMBIES.killPoints,text:'+50 PUNTI'});e.hp=0;e.y=floorAt(e.x,e.z);e.deathAt=this.state.time;e.action='dead';e.actionAt=this.state.time;e.windup=0;e.path=[];e.target=null;}this.emit({type:'hit',player:p.id,enemy:e.id,value:actual,text:e.hp<=0?'ELIMINATO':''});
 }
 /** No friendly fire: this is the only player-damage path, owned by monsters/projectiles. */
 damagePlayer(p:Survivor,damage:number,at=this.state.time):void{
  if(!p.alive||this.state.phase==='finished'||!Number.isFinite(damage)||damage<=0||at-p.lastDamageAt<ZOMBIES.hitGrace)return;
  p.lastDamageAt=at;p.hitsTaken=Math.min(ZOMBIES.maxHits,p.hitsTaken+1);p.hp=healthFromHits(p.hitsTaken);this.emit({type:'hurt',player:p.id,value:100/ZOMBIES.maxHits});
  if(p.hp<=0){if(this.state.box.owner===p.id)this.closeBox();p.alive=false;p.deathAt=at;p.reload=0;p.weaponReload=undefined;p.burst=0;p.moving=0;this.emit({type:'death',player:p.id,text:`${p.name} È STATO ELIMINATO`});this.state.notice=`${p.name} È STATO ELIMINATO`;}
 }
 /** Resolve once after the complete impact batch, never award a dead last survivor midway through a frame. */
 resolveDeaths():void{
  const s=this.state;if(s.phase==='finished')return;const alive=s.players.filter(p=>p.alive);
  if(alive.length>1)return;
  const rank=this.ranking();s.winner=alive[0]?.id??rank[0].id;this.closeBox();s.phase='finished';s.pending=0;s.bolts=[];s.notice=`${s.players.find(p=>p.id===s.winner)!.name} · ULTIMO VIVO`;
  this.emit({type:'win',player:s.winner,text:s.notice});
 }
 ranking():Survivor[]{
  // Actual lethal impact time, monster kills, actual damage, stable ID. Never RNG / array iteration order.
  return [...this.state.players].sort((a,b)=>Number(b.alive)-Number(a.alive)||b.deathAt-a.deathAt||b.kills-a.kills||b.damage-a.damage||a.id.localeCompare(b.id,'en'));
 }
 private perceive(e:Enemy):void{
  const s=this.state,old=s.players.find(p=>p.id===e.target&&p.alive);
  const candidates=s.players.filter(p=>p.alive&&(distance(e,p)<22&&visible(e,p,e.y+e.height*.75,p.y+1.1)||p.noise>0&&distance(e,p)<(p.moving>0&&p.noise<.5?7:17)));
  if(candidates.length){
   const score=(p:Survivor)=>{const assigned=s.enemies.filter(n=>n!==e&&n.hp>0&&n.target===p.id).length;const isolated=Math.min(12,...s.players.filter(q=>q.alive&&q!==p).map(q=>distance(q,p)));return distance(e,p)+assigned*2.4-(p===old?2:0)-(e.kind==='corridore'||e.kind==='cacciatore'?isolated*.4:0);};
   candidates.sort((a,b)=>score(a)-score(b));const p=candidates[0];e.target=p.id;e.memory={x:p.x,z:p.z};e.remember=4.5;
  }else if(!old||e.remember<=0){e.target=null;e.memory=null;}
 }
 private enemy(e:Enemy,dt:number):void{
  const s=this.state;e.attack-=dt;e.think-=dt;e.nav-=dt;e.remember-=dt;
  if(e.think<=0){this.perceive(e);e.think=.22+(e.id%4)*.035;}
  const target=s.players.find(p=>p.id===e.target&&p.alive);
  if(e.kind==='macellaio'||e.kind==='pumpkinhulk')e.rage=e.hp<e.maxHp*.4;
  if(isSpecial(e.kind)&&updateMonsterCombat({state:s,damage:(p,value)=>this.damagePlayer(p,value),emit:event=>this.emit(event)},e,target,dt))return;
  if(e.windup>0){e.windup-=dt;if(e.windup<=0)this.attack(e);return;}
  if(e.action==='charge'){
   const dx=e.aim.x-e.x,dz=e.aim.z-e.z,d=Math.hypot(dx,dz),q=move(e.x,e.z,dx/Math.max(.01,d)*12*dt,dz/Math.max(.01,d)*12*dt,e.radius,e.y),travel=distance(e,q);e.x=q.x;e.z=q.z;e.y=floorAt(e.x,e.z);
   let impacted=false;for(const p of s.players)if(p.alive&&distance(e,p)<1.25&&Math.abs(p.y-e.y)<2){this.damagePlayer(p,e.damage,s.time-dt+dt*.7);impacted=true;}
   if(impacted||d<.5||travel<.03){e.action='walk';e.attack=2.8;}return;
  }
  if(!isSpecial(e.kind)&&target&&e.attack<=0&&visible(e,target,e.y+1.4,target.y+1.1)){
   const d=distance(e,target),height=Math.abs(target.y-e.y);
   if(e.kind==='assalitore'&&d>3&&d<18){this.wind(e,'spit',.85,target);return;}
   if(e.kind==='macellaio'&&d<6){this.wind(e,'slam',1.15,target);return;}
   if(e.kind==='macellaio'&&d>6&&d<16){this.wind(e,'charge',e.rage?.7:1.15,target);return;}
   if(d<e.radius+1.05&&height<1.7){this.wind(e,'melee',e.kind==='colosso'?.85:.45,target);return;}
  }
  let goal=e.memory;
  if(!goal){goal=GATES[(Math.floor(s.time/7)+e.id)%GATES.length];}
  // Flank only the last perceived position, not a wall-hidden live coordinate.
  if((e.kind==='cacciatore'||e.kind==='corridore'||e.kind==='zombiegirl'||e.kind==='yaku')&&e.memory&&distance(e,goal)>6){const side=e.id%2?1:-1,g={x:goal.x+side*3.2,z:goal.z+Math.sin(e.id)*2};if(this.nav.nodes.has(this.nav.nearest(g)))goal=this.nav.nodes.get(this.nav.nearest(g))!;}
  if((e.kind==='cacciatore'||e.kind==='yaku')&&e.memory&&distance(e,e.memory)>7&&visible(e,e.memory)){
   const memory=e.memory,flanks=[{x:-14,z:-5},{x:-8,z:0},{x:8,z:0},{x:14,z:5}].filter(q=>distance(e,q)>2&&!visible(q,memory)&&distance(e,q)+distance(q,memory)<distance(e,memory)*1.7);
   flanks.sort((a,b)=>distance(e,a)-distance(e,b));if(flanks.length)goal=flanks[0];
  }
  if(e.nav<=0){e.path=this.nav.path(e,goal);e.nav=.55+(e.id%5)*.07;}
  while(e.path.length&&distance(e,e.path[0])<.42)e.path.shift();const next=e.path[0];
  if(next){let dx=next.x-e.x,dz=next.z-e.z;
   for(const other of s.enemies)if(other!==e&&other.hp>0){const d=distance(e,other),min=e.radius+other.radius+.15;if(d<min&&d>.01){dx+=(e.x-other.x)/d*(min-d)*2.4;dz+=(e.z-other.z)/d*(min-d)*2.4;}}
   const d=Math.hypot(dx,dz),speed=(e.kind==='warrok'&&!target?WARROK.walk:e.speed)*(e.rage?1.15:1)*(e.kind==='yaku'&&s.time<(e.sprintUntil??0)?1.35:1),q=move(e.x,e.z,dx/Math.max(.01,d)*speed*dt,dz/Math.max(.01,d)*speed*dt,e.radius,e.y);
   e.yaw+=clamp(angle(Math.atan2(dx,dz),e.yaw),-dt*5,dt*5);e.stuck=distance(e,q)<.005?e.stuck+dt:0;e.x=q.x;e.z=q.z;e.y=floorAt(e.x,e.z);
   if(e.stuck>1.4){e.nav=0;e.path=[];e.stuck=0;const neighbors=this.nav.links.get(this.nav.nearest(e))??[];if(neighbors.length){const p=this.nav.nodes.get(neighbors[e.id%neighbors.length])!;e.path=[p];e.nav=.5;}}
  }
 }
 private wind(e:Enemy,action:Enemy['action'],duration:number,target:Survivor):void{e.action=action;e.actionAt=this.state.time;e.windup=duration;e.aim={x:target.x,z:target.z};this.emit({type:'windup',enemy:e.id,x:e.x,y:e.y,z:e.z,text:action,value:duration,tx:target.x,ty:target.y+1,tz:target.z});}
 private attack(e:Enemy):void{
  const s=this.state;
  if(e.action==='spit'){const oy=e.y+1.25,tx=e.aim.x,tz=e.aim.z,ty=floorAt(tx,tz)+1,d=Math.hypot(tx-e.x,ty-oy,tz-e.z);s.bolts.push({id:this.nextId++,owner:String(e.id),hostile:true,x:e.x,y:oy,z:e.z,dx:(tx-e.x)/d,dy:(ty-oy)/d,dz:(tz-e.z)/d,speed:9,damage:e.damage,radius:.22,life:3});e.attack=2.4;e.action='walk';return;}
  if(e.action==='charge'){e.attack=3;return;}
  const slam=e.action==='slam',r=slam?5:e.radius+1.15;
  if(slam)this.emit({type:'blast',enemy:e.id,x:e.x,y:e.y,z:e.z,value:r});
  for(const p of s.players)if(p.alive&&distance(e,p)<r&&Math.abs(p.y-e.y)<(slam?.65:1.7)&&visible(e,p,e.y+1.1,p.y+1))this.damagePlayer(p,e.damage,s.time);
  e.attack=slam?4:e.kind==='colosso'?2:1;e.action='walk';
 }
 private projectiles(dt:number):void{
  const s=this.state;for(const b of s.bolts){if(b.life<=0)continue;const travel=Math.min(b.speed*dt,b.speed*b.life);let d=wallDistance(b.x,b.y,b.z,b.dx,b.dy,b.dz,travel),victim:Enemy|Survivor|null=null;
   const targets=b.hostile?s.players.filter(p=>p.alive):s.enemies.filter(e=>e.hp>0);
   for(const p of targets){const enemy='kind'in p,r=enemy?p.radius:.43,h=enemy?p.height:p.crouch?1.2:1.8,t=rayVsAabb(b.x,b.y,b.z,b.dx,b.dy,b.dz,{x:p.x,z:p.z,w:r*2,d:r*2,h,base:p.y});if(t!==null&&t>=0&&t<d){d=t;victim=p;}}
   b.x+=b.dx*d;b.y+=b.dy*d;b.z+=b.dz*d;b.life-=dt;
   if(victim||d<travel-.001||b.y<=floorAt(b.x,b.z)||b.life<=0){
    if(b.hostile){if(victim)this.damagePlayer(victim as Survivor,b.damage,s.time-dt+d/b.speed);}
    else{const owner=s.players.find(p=>p.id===b.owner);if(owner?.alive){if(victim)this.hurtEnemy(victim as Enemy,b.damage,owner);for(const e of s.enemies)if(e!==victim&&e.hp>0&&distance(b,e)<b.radius&&visible(b,e,b.y,e.y+1))this.hurtEnemy(e,65*(1-distance(b,e)/(b.radius+1)),owner);}}
    this.emit({type:'blast',x:b.x,y:b.y,z:b.z,value:b.hostile?.45:b.radius});b.life=0;
   }
  }s.bolts=s.bolts.filter(b=>b.life>0);
 }
 private botInput(p:Survivor,dt:number):OrdaInput{
  const s=this.state,w=weaponOf(p.weapon);p.botThink-=dt;p.botNav-=dt;
  if(p.botThink<=0){const seen=s.enemies.filter(e=>e.hp>0&&distance(e,p)<23&&visible(p,e,p.y+1.5,e.y+e.height*.55)).sort((a,b)=>distance(a,p)-distance(b,p));p.botTarget=seen[0]?.id??0;p.botThink=.18+(this.botSerial++%5)*.025;
   if(p.reserve<w.magazine||p.hp<55){const goal=s.supplies.filter(q=>q.cooldown<=0&&(p.hp<55?q.kind==='health':q.kind==='ammo')).sort((a,b)=>distance(a,p)-distance(b,p))[0];if(goal)p.botGoal=goal;}
   else if(!p.botGoal||distance(p,p.botGoal)<1.5||this.random()<.045){p.botGoal={x:(this.random()-.5)*35,z:(this.random()-.5)*26};}
  }
  if((p.hitsTaken<2&&p.points>=ZOMBIES.boxCost&&s.box.phase==='idle')||(s.box.owner===p.id&&(s.box.phase==='ready'||s.box.phase==='rolling')))p.botGoal={x:MYSTERY_BOX.x,z:MYSTERY_BOX.z-1.15};
  const target=s.enemies.find(e=>e.id===p.botTarget&&e.hp>0&&visible(p,e,p.y+1.5,e.y+e.height*.55));
  let goal=p.botGoal??{x:0,z:0},desired=p.yaw,pitch=p.pitch;
  if(target){desired=Math.atan2(target.x-p.x,target.z-p.z);pitch=-Math.atan2(target.y+target.height*.57-p.y-1.55,distance(target,p));
   if(distance(target,p)<5){const dx=p.x-target.x,dz=p.z-target.z,d=Math.hypot(dx,dz);goal={x:p.x+dx/Math.max(1,d)*5,z:p.z+dz/Math.max(1,d)*5};}
  }
  if(p.botNav<=0){p.botPath=this.nav.path(p,goal);p.botNav=.65;}
  while(p.botPath.length&&distance(p,p.botPath[0])<.7)p.botPath.shift();const next=p.botPath[0]??p;
  const dx=next.x-p.x,dz=next.z-p.z,d=Math.hypot(dx,dz);if(!target&&d>.2)desired=Math.atan2(dx,dz);
  const turn=angle(desired,p.yaw),pitchError=pitch-p.pitch,canFire=!!target&&Math.abs(turn)<.075&&Math.abs(pitchError)<.07&&p.reload<=0;
  const cycle=Math.floor(s.time*5+(p.id.charCodeAt(0)%4));
  return{...EMPTY_INPUT,interact:this.canReachBox(p)&&((p.points>=ZOMBIES.boxCost&&s.box.phase==='idle')||(s.box.owner===p.id&&s.box.phase==='ready'))?cycle:p.lastInteract,mx:d>.1?(dx*Math.cos(p.yaw)-dz*Math.sin(p.yaw))/d:0,my:d>.1?-(dx*Math.sin(p.yaw)+dz*Math.cos(p.yaw))/d:0,lx:clamp(turn*2,-.8,.8),ly:clamp(pitchError*3,-.8,.8),aim:!!target,fire:canFire,press:canFire?cycle:p.lastFire,reload:p.ammo<=Math.max(2,w.magazine*.12)?cycle:p.lastReload,jump:p.lastJump,dash:target&&distance(target,p)<3?cycle:p.lastDash};
 }
}
