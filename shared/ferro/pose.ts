import type{Warrior,V3,Action,AttackSpec,WeaponId,GuardDirection}from'./types';
import{weapon,attackSpec}from'./weapons';
import{clamp}from'./arena';
import{presentationOf}from'../characterPresentation';
import{sampleMotion,motionKey,motionProgress,point}from'./motion';
export interface BladePose{grip:V3;tip:V3}
/** lean/twist/tilt/shove are body layers for the renderer only (radians, metres backwards). */
export interface CombatPose{right:BladePose;left:BladePose;lean:number;draw:number;twist?:number;tilt?:number;shove?:number}
const lerp=(a:V3,b:V3,t:number):V3=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t});
/** Pure local-space grip/tip sampler. Renderer and authoritative hitboxes use this exact path. */
function legacyPose(p:Pick<Warrior,'weapon'|'action'|'guard'|'charge'>,age=p.action?.age??0):CombatPose{
 const w=weapon(p.weapon),idle:BladePose={grip:{x:.48,y:1.22,z:.28},tip:{x:.68,y:1.7+w.length*.7,z:.5}},left:BladePose={grip:{x:-.5,y:1.25,z:.36},tip:{x:-.65,y:1.6,z:.7}};
 if(p.weapon==='blades'){idle.tip={x:.62,y:1.7,z:.95};left.tip={x:-.65,y:1.7,z:.95};}
 if(p.weapon==='spear')idle.tip={x:.5,y:3.55,z:.66};
 if(p.weapon==='bow'){const a=p.action,u=a?clamp((age-weapon('bow').heavy.wind)/weapon('bow').heavy.active,0,1):0,push=a?Math.sin(u*Math.PI)*.35:0;return{right:{grip:{x:.24,y:1.42,z:.5-p.charge*.45+push},tip:{x:.24,y:1.42,z:1.3+push}},left:{grip:{x:-.24,y:1.44,z:.67+push},tip:{x:-.24,y:2.25,z:.67+push}},lean:push*.3,draw:p.charge};}
 if(p.weapon==='shield'){left.grip={x:-.48,y:1.35,z:p.guard?.67:.35};left.tip={x:-.48,y:1.35,z:p.guard?1.05:.6};}
 if(p.guard){idle.grip={x:.18,y:1.5,z:.7};idle.tip={x:-.8,y:2.05,z:1.15};}
 const a=p.action;if(!a)return{right:idle,left,lean:0,draw:0};const s=attackSpec(p.weapon,a),u=clamp((age-s.wind)/s.active,0,1),wind=clamp(age/Math.max(.01,s.wind),0,1),back=clamp((age-s.wind-s.active)/s.recover,0,1);
 let style=s.style;if(p.weapon==='sword'&&a.kind==='light'&&a.combo===2)style='thrust';
 const flip=a.combo%2?-1:1;let grip:V3,tip:V3;
 if(style==='thrust'||style==='bash'){
  const z=age<s.wind?.2-.4*wind:-.2+1.0*Math.sin(u*Math.PI/2);grip={x:.28,y:1.35,z};tip={x:.28,y:1.35,z:z+s.reach-.8};
 }else if(style==='overhead'||style==='wave'){
  const pitch=age<s.wind?-.9*wind:-.9+u*2.6;grip={x:.25,y:1.55,z:.3};tip={x:.25,y:1.55+Math.cos(pitch)*w.length,z:.3+Math.sin(pitch)*w.length};
 }else{
  const t=style==='spin'?-Math.PI+u*Math.PI*2:(-1.14+u*2.28)*flip,reach=s.reach;
  grip={x:.38+Math.sin(t)*.24,y:1.38,z:.35+Math.cos(t)*.28};tip={x:grip.x+Math.sin(t)*w.length,y:1.38+Math.sin(u*Math.PI)*.14,z:grip.z+Math.cos(t)*w.length};
  if(style==='double'){const second=u>.53,v=second?(u-.53)/.47:u/.53,ang=(-1.1+v*2.2)*(second?-1:1);grip={x:(second?-.38:.38)+Math.sin(ang)*.24,y:1.35,z:.35+Math.cos(ang)*.28};tip={x:grip.x+Math.sin(ang)*w.length,y:1.42,z:grip.z+Math.cos(ang)*w.length};if(second){left.grip=grip;left.tip=tip;grip=idle.grip;tip=idle.tip;}}
 }
 const prep=age<s.wind?Math.sin(wind*Math.PI/2):1;
 const right={grip:lerp(lerp(idle.grip,grip,prep),idle.grip,back),tip:lerp(lerp(idle.tip,tip,prep),idle.tip,back)};
 if(p.weapon==='shield'&&style==='bash'){left.grip={x:-.3,y:1.35,z:.6+Math.sin(u*Math.PI)*.35};left.tip={...left.grip,z:left.grip.z+.4};}
 return{right,left,lean:(style==='overhead'?.14:style==='thrust'?.18:0)*Math.sin(u*Math.PI),draw:0};
}
/** Source FBX hand curves, with additive three-way guard and weapon-specific strike layers. */
export function combatPose(p:Pick<Warrior,'weapon'|'action'|'guard'|'charge'>&Partial<Warrior>,age=p.action?.age??0):CombatPose{
 if(p.feint&&p.feint>0&&p.feintAction){const a=combatPose({...p,action:p.feintAction,feint:0},p.feintAction.age),b=combatPose({...p,action:null,feint:0}),t=1-Math.pow(p.feint/.24,2);return{right:{grip:lerp(a.right.grip,b.right.grip,t),tip:lerp(a.right.tip,b.right.tip,t)},left:{grip:lerp(a.left.grip,b.left.grip,t),tip:lerp(a.left.tip,b.left.tip,t)},lean:a.lean*(1-t),draw:0};}
 const old=legacyPose(p,age),w=weapon(p.weapon),full={bowPhase:'idle',bowAge:0,...p} as Warrior;
 const frame=sampleMotion(motionKey(full),motionProgress(full,age));
 const hand=point(frame,'B-hand.R',old.right.grip),left=point(frame,'B-hand.L',old.left.grip),axis=point(frame,'axisR',{x:0,y:1,z:0});
 if(p.weapon==='bow'){
  // Source load/hold/release poses retargeted to the existing character. Release event is at 0.10s.
  const right={grip:hand,tip:{...hand,z:hand.z+.9}},bow={grip:left,tip:{...left,y:left.y+w.length}};
  const pitch=p.pitch??0,c=Math.cos(pitch),s=Math.sin(pitch);for(const blade of [right,bow])for(const key of ['grip','tip']as const){const v=blade[key],y=v.y-1.45,z=v.z;blade[key]={x:v.x,y:1.45+y*c+z*s,z:z*c-y*s};}
  return{right,left:bow,lean:.08,draw:p.charge};
 }
 if(p.action&&['spin','double','wave','bash'].includes(attackSpec(p.weapon,p.action).style))return old;
 const direction=p.action?.direction??p.guardDirection??'top';
 if(p.action){
  const s=attackSpec(p.weapon,p.action),u=clamp((age-s.wind)/s.active,0,1),wind=clamp(age/s.wind,0,1),recover=clamp((age-s.wind-s.active)/s.recover,0,1);
  let tip={x:hand.x+axis.x*w.length,y:hand.y+axis.y*w.length,z:hand.z+axis.z*w.length};
  if(direction==='top'&&p.weapon!=='spear'){
   hand.x*=.35;hand.z+=.3;
   const a=age<s.wind?-.65*wind:-.65+u*2.2;
   tip={x:hand.x,y:hand.y+Math.cos(a)*w.length,z:hand.z+Math.sin(a)*w.length};
  }else if(p.weapon!=='spear'){
   // Additive side retarget: preserve sampled hands/body and bring the edge through the target lane.
   hand.x*=.5;hand.z+=.35;const sign=direction==='left'?-1:1,a=age<s.wind?sign*.95*wind:sign*(.95-u*1.9);
   tip={x:hand.x+Math.sin(a)*w.length,y:hand.y+.15+Math.sin(u*Math.PI)*.18,z:hand.z+Math.cos(a)*w.length};
  }
  if(p.weapon==='spear'){
   const side=direction==='top'?0:direction==='left'?-.3:.3;
   hand.x+=side;hand.z=p.action.kind==='special'?-.9+u*1.4:hand.z+Math.sin(u*Math.PI)*.45;// Side thrusts start from that side and converge on the opponent (the right thrust used to run parallel
   // to the target and could never connect).
   tip={x:direction==='top'?hand.x:side,y:hand.y+(direction==='top'?.25:0),z:hand.z+w.length};
  }
  const from=p.action.from,t=clamp(age/Math.max(.06,s.wind),0,1),blend=t*t*(3-2*t),idle=legacyPose({...p,action:null});
  const right={grip:lerp(hand,idle.right.grip,recover),tip:lerp(tip,idle.right.tip,recover)},other={grip:lerp(left,idle.left.grip,recover),tip:lerp({...left,y:left.y+.45},idle.left.tip,recover)};
  if(from&&t<1){right.grip=lerp(from.right.grip,right.grip,blend);right.tip=lerp(from.right.tip,right.tip,blend);other.grip=lerp(from.left.grip,other.grip,blend);other.tip=lerp(from.left.tip,other.tip,blend);}
  return{right,left:other,lean:Math.sin(u*Math.PI)*.13,draw:0};
 }
 if(p.breakAge&&p.breakAge>0){const reach=Math.sin(Math.min(1,p.breakAge/.58)*Math.PI)*.55;old.left.grip={x:-.22,y:1.38,z:.45+reach};old.left.tip={...old.left.grip,y:1.65};old.right.grip.z+=reach*.3;old.right.tip.z+=reach*.3;return{...old,lean:reach*.3};}
 if(p.guard)return guardPose(p.weapon,direction,left,guardLift(p.characterId));
 // Preserve stance readability between actions; idle source contributes subtle hand and torso movement.
 return{...old,right:{grip:lerp(old.right.grip,hand,.25),tip:old.right.tip}};
}
const unit=(x:number,y:number,z:number):V3=>{const l=Math.hypot(x,y,z)||1;return{x:x/l,y:y/l,z:z/l};};
const along=(grip:V3,dir:V3,length:number):BladePose=>({grip,tip:{x:grip.x+dir.x*length,y:grip.y+dir.y*length,z:grip.z+dir.z*length}});
/** Readable three-way guard: the weapon really moves to the protected side at full length (never shortened).
 * TOP: raised above the head. LEFT/RIGHT: held upright on that side of the body, in the defender's own space. */
/** Bodies are 2.0–2.5 m tall (same proportions as the character rig): a top guard must clear each head. */
export function guardLift(characterId?:string|null):number{const b=presentationOf(characterId)?.body;return b?Math.max(0,.62*b.height-b.crouch*.5+.95*b.height+.816*b.head-2.12):0;}
export function guardPose(id:WeaponId,direction:GuardDirection,free:V3={x:-.42,y:1.2,z:.3},lift=0):CombatPose{
 const pose=shapeGuard(id,direction,free);if(direction!=='top'||!lift)return pose;
 const up=(b:BladePose):BladePose=>({grip:{...b.grip,y:b.grip.y+lift},tip:{...b.tip,y:b.tip.y+lift}});
 return{...pose,right:up(pose.right),left:id==='shield'||id==='blades'||id==='axe'||id==='hammer'||id==='spear'?up(pose.left):pose.left};
}
function shapeGuard(id:WeaponId,direction:GuardDirection,free:V3):CombatPose{
 const length=weapon(id).length,top=direction==='top',side=direction==='left'?-1:1,twist=top?0:-side*.2;
 if(id==='blades'){
  const r=top?along({x:.22,y:1.92,z:.44},unit(-1,.3,.38),length):along({x:side<0?-.04:.4,y:1.3,z:.5},unit(side*.32,1,.3),length);
  const l=top?along({x:-.22,y:1.88,z:.46},unit(1,.3,.38),length):along({x:side<0?-.4:.04,y:1.24,z:.46},unit(side*.46,1,.2),length);
  return{right:r,left:l,lean:top?-.05:0,draw:0,twist};
 }
 if(id==='shield'){
  const n=top?unit(0,.8,1):unit(side*.5,0,1),g=top?{x:-.04,y:1.8,z:.5}:{x:side<0?-.42:.14,y:1.34,z:.6};
  return{right:along({x:.4,y:1.12,z:.18},unit(.12,.82,.56),length),left:{grip:g,tip:{x:g.x+n.x*.38,y:g.y+n.y*.38,z:g.z+n.z*.38}},lean:top?-.04:0,draw:0,twist:twist*.6};
 }
 let grip:V3,dir:V3;
 if(id==='axe'||id==='hammer'){grip=top?{x:.44,y:1.86,z:.42}:{x:side<0?.06:.42,y:1.0,z:.42};dir=top?unit(-1,.35,.15):unit(side*.52,1,.25);}
 else if(id==='spear'){grip=top?{x:.36,y:1.68,z:.12}:{x:side<0?.14:.36,y:1.05,z:.32};dir=top?unit(-.55,.35,.75):unit(side*.5,.85,.48);}
 else{grip=top?{x:.34,y:2.02,z:.4}:{x:side<0?-.12:.4,y:1.21,z:.47};dir=top?unit(-.9,.16,.42):unit(side*.4,1,.17);}
 const right=along(grip,dir,length),two=id==='axe'||id==='hammer'||id==='spear';
 return{right,left:two?along({x:grip.x+dir.x*.45,y:grip.y+dir.y*.45,z:grip.z+dir.z*.45},dir,.3):{grip:free,tip:{...free,y:free.y+.4}},lean:top?-.05:.02,draw:0,twist};
}
export function worldPoint(p:{x:number;y:number;z:number;yaw:number},v:V3,yaw=p.yaw):V3{return{x:p.x+v.x*Math.cos(yaw)+v.z*Math.sin(yaw),y:p.y+v.y,z:p.z-v.x*Math.sin(yaw)+v.z*Math.cos(yaw)};}
export function activeBlade(p:Warrior,a:Action,s:AttackSpec,age:number):BladePose{
 const pose=combatPose(p,age),local=s.style==='bash'||s.style==='double'&&(age-s.wind)/s.active>.53?pose.left:pose.right;
 let grip=worldPoint(p,local.grip,a.yaw),tip=worldPoint(p,local.tip,a.yaw);
 if(p.weapon==='spear'){const l=Math.hypot(tip.x-grip.x,tip.y-grip.y,tip.z-grip.z)||1;grip={x:tip.x-(tip.x-grip.x)/l*.75,y:tip.y-(tip.y-grip.y)/l*.75,z:tip.z-(tip.z-grip.z)/l*.75};}
 if(p.weapon==='hammer')grip={x:tip.x,y:tip.y+.08,z:tip.z};
 return{grip,tip};
}
