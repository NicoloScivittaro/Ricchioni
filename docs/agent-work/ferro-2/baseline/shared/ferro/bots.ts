import{Rng}from'../rng';
import type{Warrior,FerroState,Command}from'./types';
import{emptyCommand}from'./types';
import{weapon,WEAPONS}from'./weapons';
import{angle,clamp,distance,visible,route,VENTS}from'./arena';
interface Memory{command:Command;think:number;attack:number;seen:number;aim:{x:number;y:number;z:number;vx:number;vz:number;danger:boolean}|null;target:string|null;path:{x:number;z:number}[];nav:number;side:number;draw:number;selection:number;guardUntil:number}
/** Uses perceived positions and delayed decisions, never future input or hidden opponent coordinates. */
export class FerroBots{
 private memories=new Map<string,Memory>();private rng=new Rng(0x6f3a);
 read(p:Warrior,s:FerroState,dt:number):Command{
  let m=this.memories.get(p.id);if(!m){m={command:emptyCommand(),think:0,attack:.4,seen:-99,aim:null,target:null,path:[],nav:0,side:this.rng.next()<.5?-1:1,draw:0,selection:-1,guardUntil:0};this.memories.set(p.id,m);}
  const c=m.command;c.mx=c.my=c.lx=c.ly=0;c.guard=c.sprint=false;
  if(s.phase==='selection'){
   if(!p.eligible)return c;if(m.selection!==s.selectionToken){m.selection=s.selectionToken;const own=s.warriors.indexOf(p),index=(own*2+s.round+s.selectionToken)%7;c.edges.choices[index]++;m.draw=0;c.light=false;}
   if(!p.ready&&s.phaseLeft<17)c.edges.dodge++;return c;
  }
  if(s.phase!=='fight'||!p.alive||!p.eligible){c.light=false;return c;}
  m.think-=dt;m.attack-=dt;m.nav-=dt;
  if(m.think<=0){m.think=.23+this.rng.next()*.15;
   const candidates=s.warriors.filter(q=>q!==p&&q.alive&&q.eligible&&visible({x:p.x,y:p.y+1.6,z:p.z},{x:q.x,y:q.y+1.2,z:q.z})).sort((a,b)=>distance(a,p)-distance(b,p));const q=candidates[0];
   if(q){m.aim={x:q.x,y:q.y,z:q.z,vx:q.vx,vz:q.vz,danger:!!q.action&&q.action.age>.12};m.target=q.id;m.seen=s.time;}
   if(s.time-m.seen>3){m.aim=null;m.target=null;}
   if(m.aim&&s.time-m.seen<.45&&distance(p,m.aim)<3.5&&m.aim.danger){if(this.rng.next()<.4&&p.stamina>20)m.guardUntil=s.time+.33;if(this.rng.next()<.16&&p.dodgeCd<=0)c.edges.dodge++;}
   if(p.specialCd<=0&&p.stamina>30&&m.aim&&distance(p,m.aim)<(p.weapon==='bow'?16:3.4)&&this.rng.next()<.27)c.edges.special++;
  }
  c.guard=s.time<m.guardUntil;const w=weapon(p.weapon),aim=m.aim,patrol={x:Math.sin(s.time*.15+s.warriors.indexOf(p))*8,z:Math.cos(s.time*.15+s.warriors.indexOf(p))*8},target=aim??patrol,d=distance(p,target),preferred=p.weapon==='bow'?9:p.weapon==='spear'?2.55:p.weapon==='blades'?1.35:1.75;
  if(aim){const lead=p.weapon==='bow'?Math.min(.35,d/32):0,desired=Math.atan2(aim.x+aim.vx*lead-p.x,aim.z+aim.vz*lead-p.z);c.look={yaw:p.yaw+clamp(angle(desired-p.yaw),-2.4*dt,2.4*dt),pitch:p.weapon==='bow'?clamp(Math.atan2(aim.y+1.1-(p.y+1.45),Math.max(.1,d))+.5*9.8*d/(30*30),-.4,.5):0};}
  let goal={x:target.x,z:target.z};if(aim&&d>1e-4){const dx=(p.x-target.x)/d,dz=(p.z-target.z)/d;goal={x:target.x+dx*preferred-dz*m.side*1.1,z:target.z+dz*preferred+dx*m.side*1.1};}
  if(Math.hypot(p.x,p.z)>s.ringRadius-1.5&&s.fightTime>70)goal={x:0,z:0};
  if(s.flame!=='off'){const vent=VENTS.find(v=>distance(v,p)<2);if(vent)goal={x:p.x+(p.x-vent.x)*3+.8,z:p.z+(p.z-vent.z)*3};}
  if(m.nav<=0){m.nav=.45+this.rng.next()*.15;m.path=visible({x:p.x,y:.4,z:p.z},{...goal,y:.4})?[]:route(p,goal);}
  while(m.path.length&&distance(p,m.path[0])<.6)m.path.shift();const next=m.path[0]??goal,dx=next.x-p.x,dz=next.z-p.z,l=Math.hypot(dx,dz),factor=l>.35?Math.min(1,l/1.1):0;
  if(l>.001){c.mx=(dx*Math.cos(p.yaw)-dz*Math.sin(p.yaw))/l*factor;c.my=-(dx*Math.sin(p.yaw)+dz*Math.cos(p.yaw))/l*factor;}c.sprint=l>6&&p.stamina>55;
  if(p.weapon==='sword'&&p.riposte>0)c.edges.special++;
  if(aim&&s.time-m.seen<.5&&Math.abs(angle(Math.atan2(aim.x-p.x,aim.z-p.z)-p.yaw))<.25){
   if(p.weapon==='bow'&&d>3&&d<22){c.guard=true;m.draw+=dt;c.light=m.draw<.85+((s.warriors.indexOf(p)%3)*.1);if(!c.light&&m.draw>1.4)m.draw=0;}
   else if(m.attack<=0&&d<w.light.reach+.25&&p.stamina>12){m.attack=.35+this.rng.next()*.45;if(p.weapon==='bow'||this.rng.next()<.28)c.edges.heavy++;else c.edges.light++;}
  }else{c.light=false;m.draw=0;}
  return c;
 }
}
