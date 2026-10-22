import{incomingDirection}from'./directions';
import{Rng}from'../rng';
import type{Warrior,FerroState,Command,GuardDirection}from'./types';
import{emptyCommand}from'./types';
import{weapon,attackSpec}from'./weapons';
import{contactAge}from'./clash';
import{angle,clamp,distance,visible,route,VENTS}from'./arena';
const DIRECTIONS=['top','left','right']as const;
/** A blow the bot has actually seen start. Decisions on it only apply after the reaction time. */
interface Threat{serial:number;attacker:string;seenAt:number;dir:GuardDirection;plan:'guard'|'parry'|'dodge';release:number;press:number;impact:number}
interface Memory{command:Command;think:number;attack:number;seen:number;aim:{x:number;y:number;z:number;vx:number;vz:number;danger:boolean}|null;target:string|null;path:{x:number;z:number}[];nav:number;side:number;draw:number;selection:number;guardUntil:number;
 skill:number;threat:Threat|null;habits:Map<string,Record<GuardDirection,number>>;stance:number;punish:{serial:number;at:number}|null;feintAt:number;follow:'light'|'break'|null;followAt:number;guess:{dir:GuardDirection;until:number}|null;tired:boolean}
/** Uses perceived positions and delayed decisions, never future input or hidden opponent coordinates.
 * Duelling (Ferro 2.1): reads the attack direction only once the swing has visibly started, reacts after a
 * human delay, sometimes guards the wrong side, may try a parry with imperfect timing, punishes whiffs, uses
 * feints and slowly adapts to a player's favourite direction — which a feint can then exploit. */
export class FerroBots{
 private memories=new Map<string,Memory>();private rng=new Rng(0x6f3a);
 read(p:Warrior,s:FerroState,dt:number):Command{
  let m=this.memories.get(p.id);if(!m){m={command:emptyCommand(),think:0,attack:.4,seen:-99,aim:null,target:null,path:[],nav:0,side:this.rng.next()<.5?-1:1,draw:0,selection:-1,guardUntil:0,skill:.5+this.rng.next()*.22,threat:null,habits:new Map(),stance:0,punish:null,feintAt:0,follow:null,followAt:0,guess:null,tired:false};this.memories.set(p.id,m);}
  const c=m.command;c.mx=c.my=c.lx=c.ly=0;c.guard=c.sprint=false;c.guardDirection=undefined;
  if(s.phase==='selection'){
   if(!p.eligible)return c;if(m.selection!==s.selectionToken){m.selection=s.selectionToken;const own=s.warriors.indexOf(p),index=(own*2+s.round+s.selectionToken)%7;c.edges.choices[index]++;m.draw=0;c.light=false;}
   if(!p.ready&&s.phaseLeft<17)c.edges.dodge++;return c;
  }
  if(s.phase!=='fight'||!p.alive||!p.eligible){c.light=false;m.threat=null;return c;}
  m.think-=dt;m.attack-=dt;m.nav-=dt;
  if(m.think<=0){m.think=.23+this.rng.next()*.15;
   const candidates=s.warriors.filter(q=>q!==p&&q.alive&&q.eligible&&visible({x:p.x,y:p.y+1.6,z:p.z},{x:q.x,y:q.y+1.2,z:q.z},s.mapId)).sort((a,b)=>distance(a,p)-distance(b,p));const q=candidates[0];
   if(q){m.aim={x:q.x,y:q.y,z:q.z,vx:q.vx,vz:q.vz,danger:!!q.action&&q.action.age>.12};m.target=q.id;m.seen=s.time;}
   if(s.time-m.seen>3){m.aim=null;m.target=null;}
   if(p.counterUntil>s.time&&this.rng.next()<.6)c.edges.guardBreak++;
   if(q&&q.guard&&!q.action&&distance(p,q)<1.4&&this.rng.next()<.2)c.edges.guardBreak++;
   if(p.specialCd<=0&&p.stamina>30&&m.aim&&distance(p,m.aim)<(p.weapon==='bow'?16:3.4)&&this.rng.next()<.22)c.edges.special++;
  }
  const w=weapon(p.weapon),aim=m.aim,patrol={x:Math.sin(s.time*.15+s.warriors.indexOf(p))*8,z:Math.cos(s.time*.15+s.warriors.indexOf(p))*8},target=aim??patrol,d=distance(p,target),preferred=p.weapon==='bow'?9:w.light.reach*(m.tired?1.6:.78);
  const foe=s.warriors.find(q=>q.id===m!.target&&q.alive);
  // Baseline: hold a guard while an opponent is close; the stance follows what this bot has learned.
  // Guarding drains stamina (existing rule): a tired bot lowers it and backs off until it recovers.
  // Hysteresis: below 30 it stops pressing and recovers, above 60 it fights again (no guard-break spiral).
  if(p.stamina<30)m.tired=true;else if(p.stamina>60)m.tired=false;const tired=m.tired;c.guard=s.time<m.guardUntil||p.weapon!=='bow'&&!tired&&!!aim&&s.time-m.seen<.6&&distance(p,aim)<4.5;
  if(p.weapon!=='bow'){c.guardDirection=this.stance(p,m,foe,s);this.defend(p,s,m,c);}
  if(aim){const lead=p.weapon==='bow'?Math.min(.35,d/32):0,desired=Math.atan2(aim.x+aim.vx*lead-p.x,aim.z+aim.vz*lead-p.z);c.look={yaw:p.yaw+clamp(angle(desired-p.yaw),-2.4*dt,2.4*dt),pitch:p.weapon==='bow'?clamp(Math.atan2(aim.y+1.1-(p.y+1.45),Math.max(.1,d))+.5*9.8*d/(30*30),-.4,.5):0};}
  let goal={x:target.x,z:target.z};if(aim&&d>1e-4){const dx=(p.x-target.x)/d,dz=(p.z-target.z)/d;goal={x:target.x+dx*preferred-dz*m.side*1.1,z:target.z+dz*preferred+dx*m.side*1.1};}
  if(Math.hypot(p.x,p.z)>s.ringRadius-1.5&&s.fightTime>70)goal={x:0,z:0};
  if(s.flame!=='off'){const vent=VENTS.find(v=>distance(v,p)<2);if(vent)goal={x:p.x+(p.x-vent.x)*3+.8,z:p.z+(p.z-vent.z)*3};}
  if(m.nav<=0){m.nav=.45+this.rng.next()*.15;m.path=visible({x:p.x,y:p.y+.4,z:p.z},{...goal,y:p.y+.4},s.mapId)?[]:route(p,goal,s.mapId);}
  while(m.path.length&&distance(p,m.path[0])<.6)m.path.shift();const next=m.path[0]??goal,dx=next.x-p.x,dz=next.z-p.z,l=Math.hypot(dx,dz),factor=l>.35?Math.min(1,l/1.1):0;
  if(l>.001){c.mx=(dx*Math.cos(p.yaw)-dz*Math.sin(p.yaw))/l*factor;c.my=-(dx*Math.sin(p.yaw)+dz*Math.cos(p.yaw))/l*factor;}c.sprint=l>6&&p.stamina>55;
  if(p.weapon==='sword'&&p.riposte>0)c.edges.special++;
  if(aim&&s.time-m.seen<.5&&Math.abs(angle(Math.atan2(aim.x-p.x,aim.z-p.z)-p.yaw))<.25){
   if(p.weapon==='bow'&&d>3&&d<22){c.guard=true;m.draw+=dt;c.light=m.draw<.85+((s.warriors.indexOf(p)%3)*.1);if(!c.light&&m.draw>1.4)m.draw=0;}
   else if(p.weapon!=='bow')this.offend(p,s,m,c,foe,d);
   else if(m.attack<=0&&d<w.light.reach+.25&&p.stamina>12){m.attack=.35+this.rng.next()*.45;c.edges.heavy++;}
  }else{c.light=false;m.draw=0;}
  return c;
 }
 /** Idle stance: the learned favourite direction of this opponent, otherwise an occasional shift. */
 private stance(p:Warrior,m:Memory,foe:Warrior|undefined,s:FerroState):GuardDirection{
  if(m.guess&&s.time<m.guess.until)return m.guess.dir;
 const habit=foe?m.habits.get(foe.id):undefined,total=habit?habit.top+habit.left+habit.right:0;
  if(habit&&total>=3){const best=DIRECTIONS.reduce((a,b)=>habit[b]>habit[a]?b:a);if(habit[best]/total>.45)return best;}
  if(s.time>m.stance){m.stance=s.time+1.6+this.rng.next()*2.2;return DIRECTIONS[Math.floor(this.rng.next()*3)];}
  return p.guardDirection;
 }
 /** Reacts to blows it has seen start: guard (sometimes the wrong side), a timed parry attempt, or a dodge. */
 private defend(p:Warrior,s:FerroState,m:Memory,c:Command):void{
  const now=s.time;
  const q=s.warriors.filter(q=>q!==p&&q.alive&&q.action&&!q.action.blocked&&q.action.age<attackSpec(q.weapon,q.action).wind&&distance(p,q)<attackSpec(q.weapon,q.action).reach+1.2&&Math.abs(angle(Math.atan2(p.x-q.x,p.z-q.z)-q.action.yaw))<1.1&&visible({x:p.x,y:p.y+1.3,z:p.z},{x:q.x,y:q.y+1.3,z:q.z},s.mapId)).sort((a,b)=>distance(p,a)-distance(p,b))[0];
  if(q&&q.action&&m.threat?.serial!==q.action.serial){
   const a=q.action,spec=attackSpec(q.weapon,a),real=incomingDirection(q,p,a),impact=now-a.age+(contactAge(q,p)??spec.wind),reaction=.17+this.rng.next()*.17;
   const habit=m.habits.get(q.id)??{top:0,left:0,right:0};habit[real]++;m.habits.set(q.id,habit);
   const read=this.rng.next()<m.skill+(a.kind==='heavy'?.15:0)-(spec.wind<.2?.15:0),wrong=DIRECTIONS.filter(d=>d!==real);
   const dir=read?real:wrong[Math.floor(this.rng.next()*2)];
   let plan:Threat['plan']='guard';const roll=this.rng.next();
   if(roll<.08&&p.dodgeCd<=0&&p.stamina>30)plan='dodge';else if(roll<.1+m.skill*.5)plan='parry';
   // Parry attempt: let go of the guard as soon as the blow is read, then a fresh press aimed ~70 ms before the
   // blade lands (±80 ms human spread). The existing 0.16 s re-guard delay applies, so slow reads end up late.
   const release=now+reaction,press=Math.max(impact-(.07+(this.rng.next()-.5)*.16),release+.17);
   if(plan==='parry'&&press>impact-.01)plan='guard'; // too slow a read: keep the guard instead of dropping it
   m.threat={serial:a.serial,attacker:q.id,seenAt:now+reaction,dir,plan,release,press,impact};
  }
  const t=m.threat;if(!t)return;
  const attacker=s.warriors.find(w=>w.id===t.attacker),live=attacker?.action?.serial===t.serial;
  if(!live&&(now>t.seenAt+.12||attacker?.feintAction?.serial===t.serial)){
   // Feint or cancel noticed late: whatever it did (a dropped guard) stays open. Sometimes it guesses the mix-up.
   if(attacker?.feintAction?.serial===t.serial&&this.rng.next()<.4)m.guess={dir:(['left','right']as const)[Math.floor(this.rng.next()*2)],until:now+.9};
   m.threat=null;return;}
  if(now<t.seenAt)return;
  c.guardDirection=t.dir;
  if(t.plan==='dodge'){if(now<t.impact-.08)c.edges.dodge++;t.plan='guard';}
  else if(t.plan==='parry')c.guard=!(now>=t.release&&now<t.press);
  else c.guard=true;
  if(now>t.impact+.35)m.threat=null;
 }
 /** Offence: punish whiffs, follow parries, attack the side the opponent is not covering, feint sometimes. */
 private offend(p:Warrior,s:FerroState,m:Memory,c:Command,foe:Warrior|undefined,d:number):void{
  const w=weapon(p.weapon),now=s.time;
  if(m.feintAt&&now>=m.feintAt){m.feintAt=0;if(p.action?.kind==='heavy'){c.edges.feint++;m.followAt=now+.25;}else m.follow=null;}
  if(m.follow&&now>=m.followAt&&!p.action&&m.followAt>0){
   if(m.follow==='break'&&foe&&distance(p,foe)<1.4)c.edges.guardBreak++;else{c.guardDirection=this.open(p,foe,true);c.edges.light++;}
   m.follow=null;m.followAt=0;m.attack=.5;return;
  }
  // A blow that whiffed leaves its owner recovering: punish it after a perception delay.
  if(foe?.action&&!foe.action.hits.length&&foe.action.age>attackSpec(foe.weapon,foe.action).wind+attackSpec(foe.weapon,foe.action).active&&d<w.light.reach+.15){
   if(m.punish?.serial!==foe.action.serial)m.punish={serial:foe.action.serial,at:now+.16+this.rng.next()*.12};
   if(now>=m.punish.at&&!p.action&&p.stamina>w.light.cost){c.guardDirection=this.open(p,foe,false);c.edges.light++;m.attack=.4;m.punish.at=Infinity;return;}
  }
  if(p.riposte>0&&!p.action&&d<w.light.reach){c.guardDirection=this.open(p,foe,false);c.edges[p.weapon==='sword'?'special':'light']++;return;}
  if(m.tired||m.attack>0||d>=w.light.reach+.25||p.stamina<=12||m.threat&&now<m.threat.impact+.1)return;
  m.attack=.6+this.rng.next()*.6;c.guardDirection=this.open(p,foe,this.rng.next()<m.skill*.85);
  if(this.rng.next()<.32&&p.stamina>w.heavy.cost+8){c.edges.heavy++;if(this.rng.next()<.3){m.feintAt=now+w.heavy.wind*.45;m.follow=this.rng.next()<.5?'light':'break';m.followAt=0;}}
  else c.edges.light++;
 }
 /** Attack direction in the bot's own space that lands on a side the opponent is not guarding (when it reads it). */
 private open(p:Warrior,foe:Warrior|undefined,read:boolean):GuardDirection{
  const options=DIRECTIONS.filter(d=>!read||!foe||!foe.guard||incomingDirection(p,foe,{direction:d,yaw:p.yaw})!==foe.guardDirection);
  return options[Math.floor(this.rng.next()*options.length)]??'top';
 }
}
