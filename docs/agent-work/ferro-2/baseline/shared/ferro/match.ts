import type{Command,Warrior,FerroState,FerroEvent,WeaponId,Arrow,V3,Action}from'./types';
import{emptyCommand,emptyEdges}from'./types';
import{FERRO_RULES as RULES,WEAPONS,weapon,attackSpec,attackLength,activeWindow}from'./weapons';
import{SOLIDS,VENTS,RADIUS,clamp,angle,distance,move,visible,segmentDistance,rayBox,wallDistance}from'./arena';
import{activeBlade}from'./pose';
export interface Participant{id:string;name:string;color:string;characterId?:string|null;bot?:boolean}
interface Impact{source:Warrior|null;target:Warrior;damage:number;point:V3;action?:Action;piercing?:boolean;arrow?:Arrow;stun?:number}
export class FerroMatch{
 readonly state:FerroState;private accumulator=0;private serial=1;private events:FerroEvent[]=[];private roundDuel=false;
 constructor(roster:readonly Participant[],options:{roundSeconds?:number}={}){
  if(roster.length<2||roster.length>5||new Set(roster.map(p=>p.id)).size!==roster.length)throw Error('Ferro e Furia richiede 2–5 partecipanti distinti');
  const warriors:Warrior[]=roster.map((p,i)=>({...p,characterId:p.characterId??null,bot:!!p.bot,x:0,y:0,z:0,vx:0,vz:0,vy:0,yaw:0,pitch:0,hp:100,stamina:100,alive:true,weapon:WEAPONS[i%7].id,ready:false,eligible:true,points:0,kills:0,roundKills:0,roundPlace:0,damage:0,action:null,combo:-1,comboUntil:0,cooldown:0,specialCd:0,riposte:0,guard:false,guardAt:-99,guardReadyAt:0,guardFatigue:0,stun:0,lastStun:-99,hurt:0,dodge:0,dodgeX:0,dodgeZ:0,dodgeCd:0,charge:0,piercing:false,arrows:10,arrowRegen:0,deadAt:0,lastSource:null,lastHit:-99,last:emptyEdges(),wasLight:false,navTime:0,navRepeat:0}));
  this.state={phase:'selection',time:0,phaseLeft:RULES.selectionSeconds,round:1,fightTime:0,roundSeconds:clamp(options.roundSeconds??90,10,180),warriors,arrows:[],history:[],winner:null,roundWinner:null,duel:'none',contenders:[],ringRadius:RADIUS,flame:'off',flameAge:0,notice:'SCEGLI IL TUO FERRO',selectionToken:1};this.spawn(warriors);
 }
 drainEvents():FerroEvent[]{return this.events.splice(0);}
 packet():FerroState{return structuredClone(this.state);}
 private emit(e:FerroEvent):void{this.events.push(e);if(this.events.length>100)this.events.shift();}
 cancel(id:string,edges=emptyEdges()):void{const p=this.state.warriors.find(p=>p.id===id);if(!p)return;p.charge=0;p.wasLight=false;p.guard=false;p.last={...edges,choices:[...edges.choices]};}
 advance(dt:number,commands:(p:Warrior)=>Command=()=>emptyCommand()):void{
  this.accumulator+=clamp(Number.isFinite(dt)?dt:0,0,.25);while(this.accumulator+1e-9>=1/120){this.step(1/120,commands);this.accumulator-=1/120;}
 }
 step(dt:number,commands:(p:Warrior)=>Command=()=>emptyCommand()):void{
  const s=this.state;if(s.phase==='finished')return;s.time+=dt;const inputs=new Map(s.warriors.map(p=>[p.id,commands(p)]));
  if(s.phase==='selection'){
   s.phaseLeft-=dt;for(const p of s.warriors){const c=inputs.get(p.id)!;if(p.eligible)this.select(p,c,dt);this.remember(p,c);}
   const eligible=s.warriors.filter(p=>p.eligible);if(s.phaseLeft<=0||s.phaseLeft<RULES.selectionSeconds-1.2&&eligible.every(p=>p.ready)){this.spawn(eligible);s.phase='countdown';s.phaseLeft=3;s.notice=s.duel==='final'?'SPAREGGIO · SOLO UNO PUÒ VINCERE':`ROUND ${s.round} DI 3`;}
   return;
  }
  if(s.phase==='countdown'){s.phaseLeft-=dt;for(const p of s.warriors)this.remember(p,inputs.get(p.id)!);if(s.phaseLeft<=0){s.phase='fight';s.fightTime=0;s.notice='FERRO E FURIA!';this.emit({kind:'round',text:s.notice});}return;}
  if(s.phase==='roundEnd'){
   s.phaseLeft-=dt;if(s.phaseLeft<=0){if(s.round<3){s.round++;this.selection();}else this.finishOrDuel();}return;
  }
  s.fightTime+=dt;const duration=s.duel==='none'?s.roundSeconds:35,over=Math.max(0,s.fightTime-duration);s.ringRadius=over>0?Math.max(3.8,RADIUS-over*.43):RADIUS;
  const cycle=s.fightTime%24;s.flame=cycle>18&&cycle<20?'warning':cycle>=20&&cycle<23?'active':'off';s.flameAge=cycle;
  const impacts:Impact[]=[];
  for(const p of s.warriors){const c=inputs.get(p.id)!;if(p.alive&&p.eligible)this.control(p,c,dt);this.remember(p,c);}
  this.separate();
  for(const p of s.warriors)if(p.alive&&p.action)this.melee(p,dt,impacts);
  this.arrows(dt,impacts);
  for(const p of s.warriors)if(p.alive){
   if(distance(p,{x:0,z:0})>s.ringRadius)impacts.push({source:null,target:p,damage:dt*(14+over*.22),point:{x:p.x,y:1,z:p.z}});
   if(s.flame==='active'&&p.y<1&&VENTS.some(v=>distance(v,p)<1.25))impacts.push({source:null,target:p,damage:dt*17,point:{x:p.x,y:.1,z:p.z}});
  }
  this.resolve(impacts);
  for(const p of s.warriors)if(p.action&&p.action.age>=attackLength(attackSpec(p.weapon,p.action)))p.action=null;
  this.checkRound();
 }
 private remember(p:Warrior,c:Command):void{p.last={...c.edges,choices:[...c.edges.choices]};p.wasLight=c.cancel?false:c.light;}
 private select(p:Warrior,c:Command,dt:number):void{
  if(c.cancel)return;const index=WEAPONS.findIndex(w=>w.id===p.weapon);let next=index;
  for(let i=0;i<7;i++)if(c.edges.choices[i]!==p.last.choices[i])next=i;
  p.navTime-=dt;const direction=Math.abs(c.mx)>.55?Math.sign(c.mx):0;
  if(!direction)p.navRepeat=0;
  if(direction&&(p.navRepeat!==direction||p.navTime<=0)){next=(index+direction+7)%7;p.navTime=p.navRepeat===direction?.23:.38;p.navRepeat=direction;}
  if(c.edges.prev!==p.last.prev)next=(index+6)%7;if(c.edges.next!==p.last.next)next=(index+1)%7;
  if(next!==index){p.weapon=WEAPONS[next].id;p.ready=false;}
  if(c.edges.dodge!==p.last.dodge)p.ready=true;
 }
 private control(p:Warrior,c:Command,dt:number):void{
  const s=this.state,w=weapon(p.weapon);if(c.cancel){p.charge=0;p.wasLight=false;p.guard=false;this.remember(p,c);}
  p.cooldown=Math.max(0,p.cooldown-dt);p.specialCd=Math.max(0,p.specialCd-dt);p.riposte=Math.max(0,p.riposte-dt);p.stun=Math.max(0,p.stun-dt);p.hurt=Math.max(0,p.hurt-dt);p.dodgeCd=Math.max(0,p.dodgeCd-dt);p.dodge=Math.max(0,p.dodge-dt);
  if(c.look){p.yaw=angle(c.look.yaw);p.pitch=clamp(c.look.pitch,-.55,.65);}else{p.yaw=angle(p.yaw+c.lx*2.7*dt);p.pitch=clamp(p.pitch-c.ly*1.7*dt,-.55,.65);}
  const desired=c.guard&&!p.action&&p.dodge<=0&&p.stun<=0&&p.stamina>1;
  if(desired&&!p.guard){p.guardAt=s.time>=p.guardReadyAt?s.time:-99;p.stamina=Math.max(0,p.stamina-3);}
  if(!desired&&p.guard)p.guardReadyAt=s.time+.16;p.guard=desired;
  const edge=(key:'light'|'heavy'|'dodge'|'special'|'jump')=>!c.cancel&&c.edges[key]!==p.last[key];
  if(edge('dodge')&&p.stun<=0&&p.dodgeCd<=0&&!p.action&&p.stamina>=22){const v=this.direction(p,c),l=Math.hypot(v.x,v.z);p.dodgeX=l>.1?v.x/l:-Math.sin(p.yaw);p.dodgeZ=l>.1?v.z/l:-Math.cos(p.yaw);p.dodge=.36;p.dodgeCd=.8;p.stamina-=22;p.charge=0;p.guard=false;}
  if(edge('jump')&&p.y<.001&&p.stun<=0&&!p.action&&p.stamina>=8){p.vy=5.4;p.stamina-=8;}
  if(p.stun<=0&&p.dodge<=0&&!p.action&&p.cooldown<=0){
   if(edge('special')&&p.specialCd<=0&&p.stamina>=w.special.cost&&(p.weapon!=='sword'||p.riposte>0)){
    p.stamina-=w.special.cost;p.specialCd=w.cooldown;p.guard=false;
    if(p.weapon==='bow'){p.piercing=true;this.emit({kind:'special',player:p.id,weapon:p.weapon,text:'FRECCIA PERFORANTE PRONTA'});}else{this.start(p,'special');p.riposte=0;}
   }else if(p.weapon==='bow'){
    if(!c.cancel&&c.light&&p.arrows>0){p.charge=Math.min(1.2,p.charge+dt);}
    if(!c.cancel&&!c.light&&p.wasLight&&p.charge>.06){this.shoot(p);p.charge=0;p.cooldown=.45;}
    if(edge('heavy')&&p.stamina>=w.heavy.cost){p.charge=0;p.guard=false;p.stamina-=w.heavy.cost;this.start(p,'heavy');}
   }else if(!p.guard){const kind=edge('heavy')?'heavy':edge('light')?'light':null;if(kind&&p.stamina>=w[kind].cost){p.stamina-=w[kind].cost;this.start(p,kind);}}
  }
  if(p.stun>0||p.dodge>0)p.charge=0;
  if(p.guard){p.stamina=Math.max(0,p.stamina-dt*7);if(p.stamina<=0){p.guard=false;p.guardReadyAt=s.time+.6;}}
  else if(!p.action&&p.dodge<=0&&p.stun<=0)p.stamina=Math.min(100,p.stamina+dt*24);
  p.arrowRegen+=dt;if(p.arrowRegen>=2.6){p.arrowRegen%=2.6;p.arrows=Math.min(10,p.arrows+1);}
  const d=this.direction(p,c),l=Math.max(1,Math.hypot(d.x,d.z));let speed=4.6*w.mobility*(c.sprint&&p.stamina>4?1.34:1)*(p.guard?.62:1)*(p.charge>0?.63:1)*(p.action?.57:1)*(p.stun>0?.15:1);
  if(c.sprint&&Math.hypot(c.mx,c.my)>.3&&p.stamina>4&&!p.guard)p.stamina=Math.max(0,p.stamina-dt*9);
  p.vx=d.x/l*speed;p.vz=d.z/l*speed;
  if(p.dodge>0){p.vx=p.dodgeX*9;p.vz=p.dodgeZ*9;}
  if(p.action){const spec=attackSpec(p.weapon,p.action);p.action.age+=dt;const t=p.action.age-spec.wind;if(spec.dash&&t>=-.07&&t<spec.active){p.vx=Math.sin(p.action.yaw)*spec.dash;p.vz=Math.cos(p.action.yaw)*spec.dash;}}
  const q=move(p.x,p.z,p.vx*dt,p.vz*dt);p.x=q.x;p.z=q.z;p.vy-=20*dt;p.y=Math.max(0,p.y+p.vy*dt);if(!p.y)p.vy=0;
 }
 private direction(p:Warrior,c:Command):{x:number;z:number}{return{x:c.mx*Math.cos(p.yaw)-c.my*Math.sin(p.yaw),z:-c.mx*Math.sin(p.yaw)-c.my*Math.cos(p.yaw)};}
 private start(p:Warrior,kind:'light'|'heavy'|'special'):void{
  const s=this.state;p.combo=kind==='light'&&s.time<p.comboUntil?(p.combo+1)%3:0;
  p.action={kind,age:0,combo:p.combo,yaw:p.yaw,hits:[],serial:this.serial++};p.cooldown=attackLength(attackSpec(p.weapon,p.action));p.comboUntil=s.time+p.cooldown+.5;
  this.emit({kind:kind==='special'?'special':'attack',player:p.id,weapon:p.weapon,x:p.x,y:p.y+1,z:p.z});
 }
 private separate():void{
  const ps=this.state.warriors.filter(p=>p.alive&&p.eligible);for(let i=0;i<ps.length;i++)for(let j=i+1;j<ps.length;j++){const a=ps[i],b=ps[j],dx=b.x-a.x,dz=b.z-a.z,d=Math.hypot(dx,dz);if(d>=.88||Math.abs(a.y-b.y)>1.6)continue;const push=(.88-d)/2,nx=d>1e-5?dx/d:1,nz=d>1e-5?dz/d:0;Object.assign(a,move(a.x,a.z,-nx*push,-nz*push));Object.assign(b,move(b.x,b.z,nx*push,nz*push));}
 }
 private melee(p:Warrior,dt:number,impacts:Impact[]):void{
  const a=p.action!,spec=attackSpec(p.weapon,a),start=Math.max(0,a.age-dt);
  if(spec.style==='wave'&&a.age>=spec.wind&&start<spec.wind)this.emit({kind:'special',player:p.id,weapon:p.weapon,value:1,x:p.x,y:.05,z:p.z});
  for(const q of this.state.warriors){if(q===p||!q.alive||!q.eligible||distance(p,q)>spec.reach+1)continue;
   for(let sample=0;sample<=4;sample++){const age=start+(a.age-start)*sample/4,index=activeWindow(spec,age),key=q.id+':'+index;if(index<0||a.hits.includes(key))continue;
    let hit=false,point:V3={x:q.x,y:q.y+1.2,z:q.z};
    if(spec.style==='wave')hit=q.y<.65&&distance(p,q)<spec.reach*clamp((age-spec.wind)/spec.active+.15,0,1)&&visible({x:p.x,y:.35,z:p.z},{x:q.x,y:.35,z:q.z});
    else{const blade=activeBlade(p,a,spec,age);for(const y of [.35,.8,1.25,1.7]){const body={x:q.x,y:q.y+y,z:q.z};if(segmentDistance(body,blade.grip,blade.tip)<.43+spec.width){hit=true;point=body;break;}}}
    if(!hit||!visible({x:p.x,y:p.y+1.25,z:p.z},point))continue;
    a.hits.push(key);const close=p.weapon==='spear'&&distance(p,q)<1.2?.45:1,combo=p.weapon==='sword'&&a.kind==='light'?a.combo*2:0;
    impacts.push({source:p,target:q,damage:(spec.damage+combo)*close,point,action:a,stun:spec.style==='wave'||spec.style==='bash'?.22:spec.damage>=40?.24:.12});break;
   }
  }
 }
 private shoot(p:Warrior):void{
  if(p.arrows<=0)return;const strength=clamp(p.charge/1.2,0,1),speed=17+strength*17,dx=Math.sin(p.yaw)*Math.cos(p.pitch),dy=Math.sin(p.pitch),dz=Math.cos(p.yaw)*Math.cos(p.pitch);
  const start={x:p.x,y:p.y+1.45,z:p.z},safe=wallDistance(start,{x:dx,y:dy,z:dz},.85);
  p.arrows--;this.state.arrows.push({id:this.serial++,owner:p.id,x:start.x+dx*safe,y:start.y+dy*safe,z:start.z+dz*safe,vx:dx*speed,vy:dy*speed+1.0,vz:dz*speed,damage:18+strength*27,life:3,stuck:false,piercing:p.piercing,hit:[]});p.piercing=false;
  this.emit({kind:'arrow',player:p.id,weapon:'bow',x:p.x,y:p.y+1.4,z:p.z});
 }
 private arrows(dt:number,impacts:Impact[]):void{
  const s=this.state;for(const a of s.arrows){a.life-=dt;if(a.stuck)continue;a.vy-=RULES.arrowGravity*dt;const delta={x:a.vx*dt,y:a.vy*dt,z:a.vz*dt},l=Math.hypot(delta.x,delta.y,delta.z),d={x:delta.x/l,y:delta.y/l,z:delta.z/l};let wall=wallDistance(a,d,l,.045);
   if(d.y<0)wall=Math.min(wall,Math.max(0,(.09-a.y)/d.y));const hits:{p:Warrior;t:number}[]=[];
   for(const p of s.warriors){if(!p.alive||p.id===a.owner||a.hit.includes(p.id))continue;const t=rayBox({x:a.x,y:a.y-p.y,z:a.z},d,{x:p.x,z:p.z,w:.85,d:.85,h:1.95,kind:'cover'},.06);if(t!==null&&t<=wall)hits.push({p,t});}
   hits.sort((a,b)=>a.t-b.t);let travel=wall;
   for(const{p,t}of hits){a.hit.push(p.id);const point={x:a.x+d.x*t,y:a.y+d.y*t,z:a.z+d.z*t};impacts.push({source:s.warriors.find(p=>p.id===a.owner)??null,target:p,damage:a.damage*Math.pow(.8,a.hit.length-1),point,piercing:a.piercing,arrow:a,stun:.1});if(!a.piercing||a.hit.length>=3){travel=t;a.stuck=true;a.life=.18;break;}}
   a.x+=d.x*travel;a.y+=d.y*travel;a.z+=d.z*travel;if(!a.stuck&&(wall<l-.0001||Math.hypot(a.x,a.z)>RADIUS-.1)){a.stuck=true;a.life=1.7;this.emit({kind:'arrowImpact',player:a.owner,x:a.x,y:a.y,z:a.z});}
  }s.arrows=s.arrows.filter(a=>a.life>0).slice(-64);
 }
 private resolve(impacts:Impact[]):void{
  const s=this.state,damage=new Map<Warrior,{total:number;source:Warrior|null;stun:number}>(),invalid=new Set<number>(),deflected=new Set<number>();
  // A fresh frontal parry cancels that swing before any of its damage is applied.
  for(const hit of impacts){const q=hit.target,p=hit.source;if(!p||!q.guard||q.weapon==='bow'||q.stamina<6||q.stun>0||s.time-q.guardAt>RULES.parryWindow||!this.front(q,p))continue;
   q.riposte=1.1;q.stamina=Math.max(0,q.stamina-6);p.stun=Math.max(p.stun,.27);p.charge=0;if(hit.action){invalid.add(hit.action.serial);p.action=null;}if(hit.arrow){deflected.add(hit.arrow.id);hit.arrow.stuck=true;hit.arrow.life=.1;}
   this.emit({kind:'parry',player:q.id,target:p.id,x:hit.point.x,y:hit.point.y,z:hit.point.z});hit.damage=0;
  }
  for(const hit of impacts){const q=hit.target,p=hit.source;if(hit.damage<=0||hit.action&&invalid.has(hit.action.serial)||hit.arrow&&deflected.has(hit.arrow.id))continue;
   const dodgeAge=RULES.dodgeSeconds-q.dodge;if(q.dodge>0&&dodgeAge>=.06&&dodgeAge<=.22)continue;let amount=hit.damage;
   if(p&&q.guard&&q.weapon!=='bow'&&this.front(q,p)&&q.stun<=0){const cost=amount*.65+4;if(q.stamina>=cost){q.stamina-=cost;amount*=1-weapon(q.weapon).defence*(hit.piercing?.45:1);this.emit({kind:'block',player:q.id,target:p.id,x:q.x,y:q.y+1.4,z:q.z});}else{q.stamina=0;q.guard=false;q.guardReadyAt=s.time+.65;hit.stun=.3;this.emit({kind:'break',player:q.id,x:q.x,y:q.y+1,z:q.z});}}
   const old=damage.get(q);damage.set(q,{total:(old?.total??0)+amount,source:p??old?.source??null,stun:Math.max(old?.stun??0,hit.stun??0)});
   if(p)this.emit({kind:'hit',player:p.id,target:q.id,value:Math.round(amount),x:hit.point.x,y:hit.point.y,z:hit.point.z});
  }
  const dead:Warrior[]=[];
  for(const[q,hit]of damage){if(!q.alive)continue;const actual=Math.min(q.hp,hit.total);q.hp=Math.max(0,q.hp-hit.total);if(hit.source){hit.source.damage+=actual;q.lastSource=hit.source.id;q.lastHit=s.time;}q.hurt=.22;
   if(hit.stun>0&&s.time-q.lastStun>.65){q.stun=Math.max(q.stun,hit.stun);q.lastStun=s.time;q.action=null;q.charge=0;}
   if(q.hp<=0){q.alive=false;q.deadAt=s.time;q.action=null;q.charge=0;q.guard=false;dead.push(q);}
  }
  for(const q of dead){const killer=s.warriors.find(p=>p.id===q.lastSource&&s.time-q.lastHit<3);if(killer&&killer!==q){killer.kills++;killer.roundKills++;}this.emit({kind:'elimination',player:killer?.id,target:q.id,text:killer?`${killer.name} HA ELIMINATO ${q.name}!`:`${q.name} È CADUTO!`,x:q.x,y:.2,z:q.z});}
  if(dead.length){const live=s.warriors.filter(p=>p.alive&&p.eligible).length;for(const q of dead)q.roundPlace=live+1;}
 }
 private front(q:Warrior,p:Warrior):boolean{return Math.abs(angle(Math.atan2(p.x-q.x,p.z-q.z)-q.yaw))<(q.weapon==='shield'?1.1:.9);}
 private spawn(ps:Warrior[]):void{
  ps.forEach((p,i)=>{const a=i/ps.length*Math.PI*2+Math.PI/6,r=this.state.duel==='none'?12:3;Object.assign(p,{x:Math.sin(a)*r,z:Math.cos(a)*r,y:0,vy:0,vx:0,vz:0,yaw:angle(a+Math.PI),pitch:0,hp:100,stamina:100,alive:true,action:null,cooldown:0,specialCd:0,guard:false,guardAt:-99,guardReadyAt:0,stun:0,lastStun:-99,dodge:0,dodgeCd:0,charge:0,piercing:false,arrows:10,arrowRegen:0,riposte:0,roundPlace:0});});this.state.arrows=[];
 }
 private checkRound():void{
  const s=this.state,eligible=s.warriors.filter(p=>p.eligible),live=eligible.filter(p=>p.alive);if(live.length>1)return;
  if(live.length===0){const latest=Math.max(...eligible.map(p=>p.deadAt)),last=eligible.filter(p=>Math.abs(p.deadAt-latest)<1e-6);s.contenders=last.map(p=>p.id);for(const p of s.warriors)p.eligible=s.contenders.includes(p.id);if(s.duel!=='final')s.duel='round';this.roundDuel=true;this.spawn(last);s.phase='countdown';s.phaseLeft=3;s.notice='DOPPIA ELIMINAZIONE · DUELLO DI SPAREGGIO';return;}
  const winner=live[0];winner.roundPlace=1;s.roundWinner=winner.id;
  if(s.duel==='final'){s.winner=winner.id;s.phase='finished';s.notice=`ULTIMO GUERRIERO: ${winner.name}!`;this.emit({kind:'win',player:winner.id,text:s.notice});return;}
  const scores=s.warriors.map(p=>{const place=p.roundPlace||2,points=(s.warriors.length-place)*12+(p.id===winner.id?12:0)+Math.min(p.roundKills,this.state.warriors.length-1)*2;p.points+=points;return{id:p.id,place,kills:p.roundKills,points};});s.history.push({round:s.round,winner:winner.id,scores});s.phase='roundEnd';s.phaseLeft=4;s.notice=`ULTIMO GUERRIERO: ${winner.name}!`;this.emit({kind:'win',player:winner.id,text:s.notice});
 }
 private selection():void{const s=this.state;s.phase='selection';s.phaseLeft=18;s.duel='none';s.contenders=[];s.roundWinner=null;s.ringRadius=RADIUS;s.flame='off';s.selectionToken++;this.roundDuel=false;for(const p of s.warriors){p.eligible=true;p.ready=false;p.roundKills=0;p.roundPlace=0;p.action=null;p.charge=0;}s.notice=`ROUND ${s.round} · CAMBIA ARMA`;
 }
 private finishOrDuel():void{
  const s=this.state,top=Math.max(...s.warriors.map(p=>p.points)),tied=s.warriors.filter(p=>p.points===top);if(tied.length===1){s.winner=tied[0].id;s.phase='finished';s.notice=`ULTIMO GUERRIERO: ${tied[0].name}!`;return;}
  s.duel='final';s.phase='selection';s.phaseLeft=18;s.contenders=tied.map(p=>p.id);s.selectionToken++;s.notice='PARITÀ IN TESTA · SPAREGGIO';for(const p of s.warriors){p.eligible=s.contenders.includes(p.id);p.ready=false;p.alive=p.eligible;p.action=null;p.charge=0;}
 }
 ranking():{playerId:string;placement:number;score:number;stats:string[]}[]{
  const s=this.state,sorted=[...s.warriors].sort((a,b)=>Number(b.id===s.winner)-Number(a.id===s.winner)||b.points-a.points);let place=1;
  return sorted.map((p,i)=>{if(i>0&&(sorted[i-1].points!==p.points||sorted[i-1].id===s.winner))place=i+1;return{playerId:p.id,placement:place,score:p.points,stats:[`${p.points} punti`,`${p.kills} eliminazioni`,`${s.history.filter(r=>r.winner===p.id).length} round vinti`]};});
 }
}
