import type{Warrior,V3,Action,AttackSpec}from'./types';
import{weapon,attackSpec}from'./weapons';
import{clamp}from'./arena';
export interface BladePose{grip:V3;tip:V3}
export interface CombatPose{right:BladePose;left:BladePose;lean:number;draw:number}
const lerp=(a:V3,b:V3,t:number):V3=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t});
/** Pure local-space grip/tip sampler. Renderer and authoritative hitboxes use this exact path. */
export function combatPose(p:Pick<Warrior,'weapon'|'action'|'guard'|'charge'>,age=p.action?.age??0):CombatPose{
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
export function worldPoint(p:{x:number;y:number;z:number;yaw:number},v:V3,yaw=p.yaw):V3{return{x:p.x+v.x*Math.cos(yaw)+v.z*Math.sin(yaw),y:p.y+v.y,z:p.z-v.x*Math.sin(yaw)+v.z*Math.cos(yaw)};}
export function activeBlade(p:Warrior,a:Action,s:AttackSpec,age:number):BladePose{
 const pose=combatPose(p,age),local=s.style==='bash'||s.style==='double'&&(age-s.wind)/s.active>.53?pose.left:pose.right;
 let grip=worldPoint(p,local.grip,a.yaw),tip=worldPoint(p,local.tip,a.yaw);
 if(p.weapon==='spear'){const l=Math.hypot(tip.x-grip.x,tip.y-grip.y,tip.z-grip.z)||1;grip={x:tip.x-(tip.x-grip.x)/l*.75,y:tip.y-(tip.y-grip.y)/l*.75,z:tip.z-(tip.z-grip.z)/l*.75};}
 if(p.weapon==='hammer')grip={x:tip.x,y:tip.y+.08,z:tip.z};
 return{grip,tip};
}
