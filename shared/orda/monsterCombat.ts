import clipData from '../monsterClips.json';
import {floorAt,move,visible,wallDistance} from './arena';
import type {Enemy,EnemyKind,OrdaState,Survivor,OrdaEvent} from './types';
export type SpecialKind='warrok'|'zombiegirl'|'yaku'|'pumpkinhulk';
export const isSpecial=(kind:EnemyKind):kind is SpecialKind=>kind==='warrok'||kind==='zombiegirl'||kind==='yaku'||kind==='pumpkinhulk';
interface Clip{seconds:number;impact?:number;takeoff?:number;landing?:number}
const clips=clipData as Record<SpecialKind,{height:number;clips:Record<string,Clip>}>;
export const specialDeath=(kind:EnemyKind)=>isSpecial(kind)?clips[kind].clips.DEATH.seconds:4.6;
export interface AttackTiming{clip:'ATTACK'|'SWIPE'|'JUMP_ATTACK'|'ROAR'|'TAUNT';rate:number;duration:number;impact:number;window:number;reach:number;cone:number;damage:number;cooldown:number;takeoff:number;landing:number}
/** Timings are in source clip seconds. Rates are locked at action start, including boss phase two. */
export function attackTiming(e:Enemy):AttackTiming{
 const kind=isSpecial(e.kind)?e.kind:'warrok',jump=e.action==='jumpAttack',taunt=e.action==='roar'||e.action==='taunt',heavy=e.action==='heavy';
 const clip=jump?'JUMP_ATTACK':taunt?(kind==='warrok'?'ROAR':'TAUNT'):e.action==='punch'?'ATTACK':'SWIPE';
 const info=clips[kind].clips[clip],baseRate=taunt?1.5:jump?(kind==='yaku'?1.2:1):kind==='zombiegirl'?1.55:kind==='pumpkinhulk'?.85:1.15;
 const rate=e.actionRate??baseRate*(e.rage&&!taunt?1.15:1),impact=(info.impact??(taunt?info.seconds:1.3))/rate;
 return{clip,rate,duration:info.seconds/rate,impact,window:(jump?.22:.16)/rate,reach:jump?1.85:kind==='warrok'?2.15:kind==='pumpkinhulk'?2.5:kind==='yaku'?1.65:1.35,cone:kind==='pumpkinhulk'?1.05:.8,damage:heavy?1.35:jump?1.25:1,cooldown:kind==='zombiegirl'?.25:jump?1.15:heavy?1.1:.55,takeoff:(info.takeoff??.5)/rate,landing:(info.landing??1.6)/rate};
}
const dist=(a:{x:number;z:number},b:{x:number;z:number})=>Math.hypot(a.x-b.x,a.z-b.z);
const angle=(a:number,b:number)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
/** Swept grounded clearance test: no leaps across cover, dock edges, walls or out of the arena. */
export function leapDestination(e:Enemy,target:Survivor):{x:number;z:number}|null{
 const d=dist(e,target),max=e.kind==='yaku'?4.2:3.1,length=Math.min(max,Math.max(0,d-.65));if(d<2.8||d>max+1||Math.abs(target.y-floorAt(e.x,e.z))>.2)return null;
 const yaw=Math.atan2(target.x-e.x,target.z-e.z),dx=Math.sin(yaw),dz=Math.cos(yaw),ground=floorAt(e.x,e.z);let q={x:e.x,z:e.z};
 for(let travel=.1;travel<=length+.05;travel+=.1){const step=Math.min(.1,length-(travel-.1));if(step<=0)break;const next=move(q.x,q.z,dx*step,dz*step,e.radius,ground);if(dist(q,next)<step*.95||Math.abs(floorAt(next.x,next.z)-ground)>.08||wallDistance(q.x,ground+.25,q.z,dx,0,dz,step)<step-.001)return null;q=next;}
 return q;
}
interface Authority{state:OrdaState;damage:(p:Survivor,value:number)=>void;emit:(event:OrdaEvent)=>void}
export function updateMonsterCombat(a:Authority,e:Enemy,target:Survivor|undefined,dt:number):boolean{
 const time=a.state.time,age=time-(e.actionAt??time),busy=['punch','swipe','heavy','jumpAttack','roar','taunt'].includes(e.action);
 if(busy){
  const t=attackTiming(e),taunt=e.action==='roar'||e.action==='taunt';e.windup=Math.max(0,(taunt?t.duration:t.impact)-age);
  if(e.action==='jumpAttack'){
   const progress=Math.max(0,Math.min(1,(age-t.takeoff)/(t.landing-t.takeoff))),previous=Math.max(0,Math.min(1,(age-dt-t.takeoff)/(t.landing-t.takeoff))),start=e.actionOrigin??e;
   if(progress>previous){const dx=(e.aim.x-start.x)*(progress-previous),dz=(e.aim.z-start.z)*(progress-previous),ground=floorAt(e.x,e.z);let remaining=Math.hypot(dx,dz);while(remaining>.0001){const n=Math.min(.08,remaining),q=move(e.x,e.z,dx/Math.max(.001,Math.hypot(dx,dz))*n,dz/Math.max(.001,Math.hypot(dx,dz))*n,e.radius,ground);e.x=q.x;e.z=q.z;remaining-=n;}}
   e.y=floorAt(e.x,e.z)+(progress>0&&progress<1?Math.sin(progress*Math.PI)*(e.kind==='yaku'?1.15:.85):0);
  }
  if(!taunt&&!e.impacted&&age>=t.impact&&age<=t.impact+t.window){
   for(const p of a.state.players)if(p.alive&&dist(e,p)<t.reach&&Math.abs(p.y-e.y)<1.4&&Math.abs(angle(Math.atan2(p.x-e.x,p.z-e.z),e.yaw))<t.cone&&visible(e,p,Math.min(e.y+1.35,e.y+e.height*.6),p.y+1)){
    a.damage(p,e.damage*t.damage);e.impacted=true;a.emit({type:'blast',enemy:e.id,x:p.x,y:p.y+1,z:p.z,value:.18,text:'monster-impact'});break;
   }
  }
  if(age>=t.duration){e.y=floorAt(e.x,e.z);e.action='walk';e.attack=t.cooldown;e.windup=0;e.actionRate=undefined;e.nav=0;}return true;
 }
 if(!target||!visible(e,target,e.y+1.35,target.y+1))return false;
 const d=dist(e,target),facing=Math.abs(angle(Math.atan2(target.x-e.x,target.z-e.z),e.yaw));
 const begin=(action:Enemy['action'])=>{e.action=action;e.actionAt=time;e.actionRate=undefined;e.actionRate=attackTiming(e).rate;e.impacted=false;e.actionOrigin={x:e.x,z:e.z};const timing=attackTiming(e);e.windup=timing.impact;a.emit({type:'windup',enemy:e.id,x:e.x,y:e.y,z:e.z,text:action,value:timing.impact});};
 if(!e.roared&&(e.kind==='warrok'||e.kind==='pumpkinhulk')&&d<15){e.roared=true;e.yaw=Math.atan2(target.x-e.x,target.z-e.z);begin(e.kind==='warrok'?'roar':'taunt');return true;}
 if(e.attack<=0&&d<(e.kind==='pumpkinhulk'?2.4:e.kind==='warrok'?2.05:e.kind==='yaku'?1.55:1.25)&&facing<.7&&Math.abs(target.y-e.y)<1.4){e.attackCount=(e.attackCount??0)+1;begin(e.kind==='warrok'?(e.attackCount%3===0?'heavy':'punch'):e.kind==='pumpkinhulk'?(e.attackCount%2===0?'heavy':'swipe'):'swipe');return true;}
 if((e.kind==='yaku'||e.kind==='warrok')&&e.attack<=0&&time>=(e.jumpReady??0)&&facing<.3){const destination=leapDestination(e,target);if(destination){e.aim=destination;begin('jumpAttack');e.jumpReady=time+(e.kind==='yaku'?8:12);return true;}}
 if(e.kind==='yaku'&&d>6&&d<12&&time>=(e.sprintReady??0)){e.sprintUntil=time+.7;e.sprintReady=time+5;}
 return false;
}
