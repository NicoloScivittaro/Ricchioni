import type{Warrior,WeaponId,GuardDirection,V3,Clash,ClashKind}from'./types';
import{combatPose,worldPoint,activeBlade,guardPose,guardLift}from'./pose';
import type{CombatPose,BladePose}from'./pose';
import{HEFT,attackSpec}from'./weapons';
import{clamp,segmentDistance}from'./arena';
/** Shared parametric weapon-contact layer (Ferro 2.1).
 * The combat logic decides block / parry / hit and stores a Clash on both warriors; everything here only
 * shapes how that already-decided result looks. Nothing in this file changes damage, timers or hitboxes. */
export type ContactMaterial='steel'|'shield'|'haft';
export const ZERO:V3={x:0,y:0,z:0};
export const contactMaterial=(defender:WeaponId):ContactMaterial=>defender==='shield'?'shield':defender==='spear'?'haft':'steel';
/** Size of the reaction: heavier weapons and heavy attacks push harder, the shield soaks a little. */
export function clashPower(attacker:WeaponId,defender:WeaponId,heavy:boolean,parry=false):number{return clamp(HEFT[attacker]*(heavy?1.3:1)/(defender==='shield'?1.2:1)*(parry?1.15:1),.4,1.7);}
/** Reaction lengths, ~0.2–0.4 s by weapon. Gameplay locks are untouched: these only bound the visual layer. */
export function clashTime(kind:ClashKind,self:WeaponId,other:WeaponId,heavy:boolean):number{
 if(kind==='block')return .2+.11*HEFT[other]+(heavy?.05:0);
 if(kind==='blocked')return .18+.16*HEFT[self];
 if(kind==='parry')return .3;
 if(kind==='parried')return .34+.05*HEFT[self];
 if(kind==='break')return .4;
 return .26;
}
/** Side of a blow in a warrior's own space: −1 left, +1 right, 0 from above. */
export const sideOf=(dir:GuardDirection):number=>dir==='left'?-1:dir==='right'?1:0;
export function makeClash(kind:ClashKind,self:WeaponId,other:WeaponId,dir:GuardDirection,heavy:boolean,nudge:V3=ZERO,power?:number):Clash{
 const attacker=kind==='blocked'||kind==='parried';
 return{kind,age:0,time:clashTime(kind,self,other,heavy),dir,side:sideOf(dir),power:power??clashPower(attacker?self:other,attacker?other:self,heavy,kind==='parry'||kind==='parried'),other,heavy,nudge};
}
const sub=(a:V3,b:V3):V3=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
const dot=(a:V3,b:V3)=>a.x*b.x+a.y*b.y+a.z*b.z;
const at=(a:V3,d:V3,t:number):V3=>({x:a.x+d.x*t,y:a.y+d.y*t,z:a.z+d.z*t});
/** Closest points between segments a0-a1 and b0-b1. */
export function closest(a0:V3,a1:V3,b0:V3,b1:V3):{a:V3;b:V3}{
 const d1=sub(a1,a0),d2=sub(b1,b0),r=sub(a0,b0),aa=dot(d1,d1),ee=dot(d2,d2),f=dot(d2,r);let s=0,t=0;
 if(aa<1e-9&&ee<1e-9)return{a:a0,b:b0};
 if(aa<1e-9)t=clamp(f/ee,0,1);
 else{const c=dot(d1,r);if(ee<1e-9)s=clamp(-c/aa,0,1);else{const b=dot(d1,d2),den=aa*ee-b*b;s=den>1e-9?clamp((b*f-c*ee)/den,0,1):0;t=(b*s+f)/ee;if(t<0){t=0;s=clamp(-c/aa,0,1);}else if(t>1){t=1;s=clamp((b-c)/aa,0,1);}}}
 return{a:at(a0,d1,s),b:at(b0,d2,t)};
}
/** World delta → a warrior's local space (inverse of worldPoint's rotation). */
export function toLocal(delta:V3,yaw:number):V3{return{x:delta.x*Math.cos(yaw)-delta.z*Math.sin(yaw),y:delta.y,z:delta.x*Math.sin(yaw)+delta.z*Math.cos(yaw)};}
const limit=(v:V3,max:number):V3=>{const l=Math.hypot(v.x,v.y,v.z);return l>max?{x:v.x/l*max,y:v.y/l*max,z:v.z/l*max}:v;};
/** Where the attacking blade meets the defender's guard (weapon or shield face), plus the local nudges that
 * bring both weapons onto that point at the instant of contact. */
export function contactPoints(blade:BladePose,attackYaw:number,q:Warrior):{point:V3;attacker:V3;defender:V3}{
 const pose=combatPose(q),guard=q.weapon==='shield'?{grip:pose.left.grip,tip:pose.left.grip}:pose.right,d0=worldPoint(q,guard.grip,q.yaw),d1=worldPoint(q,guard.tip,q.yaw);
 const c=closest(blade.grip,blade.tip,d0,d1),point={x:(c.a.x+c.b.x)/2,y:(c.a.y+c.b.y)/2,z:(c.a.z+c.b.z)/2};
 return{point,attacker:limit(toLocal(sub(point,c.a),attackYaw),.32),defender:limit(toLocal(sub(point,c.b),q.yaw),.32)};
}
/** Age at which a started swing would first reach a body standing where it is now — the same capsule test as
 * the melee resolver. What a watching player reads from the motion; never future input. null: it will miss. */
export function contactAge(p:Warrior,q:Pick<Warrior,'x'|'y'|'z'>):number|null{
 const a=p.action;if(!a)return null;const spec=attackSpec(p.weapon,a);if(spec.style==='wave')return spec.wind;
 for(let age=Math.max(a.age,spec.wind);age<=spec.wind+spec.active+1e-6;age+=1/60){const blade=activeBlade(p,a,spec,age);for(const y of[.35,.8,1.25,1.7])if(segmentDistance({x:q.x,y:q.y+y,z:q.z},blade.grip,blade.tip)<.43+spec.width)return age;}
 return null;
}
const smooth=(a:number,b:number,x:number)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
/** Fast attack, longer release: the shape of every contact reaction. */
const impulse=(u:number,rise=.1)=>u<rise?Math.sin(u/rise*Math.PI/2):Math.pow(1-(u-rise)/(1-rise),2);
const lerp=(a:V3,b:V3,t:number):V3=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t});
const blend=(a:BladePose,b:BladePose,t:number):BladePose=>({grip:lerp(a.grip,b.grip,t),tip:lerp(a.tip,b.tip,t)});
const shift=(b:BladePose,grip:V3,tip:V3,k:number):BladePose=>({grip:at(b.grip,grip,k),tip:at(b.tip,tip,k)});
const both=(b:BladePose,v:V3,k:number)=>shift(b,v,v,k);
/** Render-only layer applied on top of combatPose. Hitboxes never read it. */
export function clashPose(pose:CombatPose,p:Warrior):CombatPose{
 const c=p.clash;let out:CombatPose={...pose,right:{...pose.right},left:{...pose.left}};
 const a=p.action;
 if(a?.blocked&&a.blocked.window<0){
  // The blade stopped on the guard: hold the contact pose, rebound, then settle into stance while the
  // (unchanged) attack recovery runs out. No further damage can come from this swing.
  const since=Math.max(0,a.age-a.blocked.age),time=c?.kind==='blocked'?c.time:.18+.16*HEFT[p.weapon],u=clamp(since/time,0,1),frozen=combatPose(p,a.blocked.age),rest=combatPose({...p,action:null,guard:false}),settle=smooth(.3,1,u);
  const s=a.direction==='left'?-1:a.direction==='right'?1:0,top=s===0,amp=(1.3-.45*HEFT[p.weapon])*(c?.power??1),k=impulse(u)*amp,n=c?.kind==='blocked'?Math.pow(1-clamp(u/.32,0,1),2):0,nudge=c?.nudge??ZERO;
  const right=blend(frozen.right,rest.right,settle),left=blend(frozen.left,rest.left,settle);
  out={...out,right:both(shift(right,{x:s*.06,y:.05,z:-.1},{x:s*.3,y:top?.32:.12,z:-.3},k),nudge,n),left,lean:-.12*k,twist:s*.1*k};
  return out;
 }
 if(!c)return out;
 const u=clamp(c.age/c.time,0,1),s=c.side,top=c.dir==='top',k=impulse(u),n=Math.pow(1-clamp(u/.3,0,1),2),pw=c.power;
 if(c.kind==='blocked'){
  // Multi-window or spinning attacks keep their timeline: only a recoil on top of it.
  const amp=(1.3-.45*HEFT[p.weapon])*pw*k;out.right=both(shift(out.right,{x:s*.05,y:.04,z:-.08},{x:s*.22,y:top?.24:.1,z:-.24},amp),c.nudge,n);out.lean-=.08*amp;
 }else if(c.kind==='block'){
  // The old rules still give a blocked hit a brief stagger (guard flag drops): the weapon stays in guard meanwhile.
  if(!p.guard)out={...guardPose(p.weapon,p.guardDirection,out.left.grip,guardLift(p.characterId)),lean:out.lean};
  const g={x:-s*.05,y:top?-.08:0,z:-.09},t={x:-s*.17,y:top?-.18:-.04,z:-.15};
  if(p.weapon==='shield'){out.left={grip:at(at(out.left.grip,{x:-s*.04,y:top?-.07:0,z:-.17},pw*k),c.nudge,n),tip:at(at(out.left.tip,{x:-s*.03,y:top?-.12:0,z:-.2},pw*k),c.nudge,n)};out.right=shift(out.right,g,g,.4*pw*k);}
  else out.right=both(shift(out.right,g,t,pw*k),c.nudge,n);
  out={...out,lean:out.lean-.1*pw*k,tilt:-s*.09*pw*k,shove:.06*pw*k};
 }else if(c.kind==='parry'){
  // Decisive outward sweep that carries the attacker's weapon off line, then back to guard.
  const w=Math.sin(u*Math.PI),g={x:s*.08,y:.07,z:.18},t={x:s*.46+(top?-.12:0),y:top?.3:.22,z:.28};
  if(p.weapon==='shield'){out.left={grip:at(at(out.left.grip,{x:s*.12,y:.06,z:.3},w),c.nudge,n),tip:at(at(out.left.tip,{x:s*.3,y:.12,z:.3},w),c.nudge,n)};}
  else out.right=both(shift(out.right,g,t,w),c.nudge,n);
  out={...out,lean:out.lean+.08*w,twist:s*.2*w};
 }else if(c.kind==='parried'){
  // Weapon thrown off line and body staggered back: readable from distance without any text.
  const env=impulse(u,.15),g=top?{x:0,y:.2,z:-.26}:{x:s*.16,y:.1,z:-.3},t=top?{x:-.18,y:.58,z:-.75}:{x:s*.72,y:.36,z:-.55};
  out.right=both(shift(out.right,g,t,env*pw),c.nudge,n);out.left=shift(out.left,{x:-.05,y:.08,z:-.12},{x:-.05,y:.08,z:-.12},env);
  out={...out,lean:out.lean-.3*env,twist:s*.26*env,shove:.14*env};
 }else if(c.kind==='hurt'){
  const g={x:-s*.06,y:-.08,z:-.06},t={x:-s*.14,y:-.12,z:-.08};
  out.right=shift(out.right,g,t,k);out={...out,lean:out.lean-(top?.26:.16)*k,tilt:-s*.24*k,shove:.11*k};
 }else if(c.kind==='break'){
  const env=impulse(u,.12);out.right=shift(out.right,{x:-s*.06,y:-.16,z:-.12},{x:-s*.3,y:-.48,z:-.1},env);
  if(p.weapon==='shield')out.left=shift(out.left,{x:-s*.05,y:-.2,z:-.15},{x:-s*.05,y:-.3,z:-.1},env);
  out={...out,lean:out.lean-.22*env,tilt:-s*.12*env,shove:.12*env};
 }
 return out;
}
