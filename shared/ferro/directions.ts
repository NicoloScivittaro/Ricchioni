import type{Warrior,GuardDirection,Action}from'./types';
import{angle,distance,visible}from'./arena';
import type{FerroState}from'./types';
/** Left/right are expressed in the attacker's local space. Face-to-face they mirror. */
export function incomingDirection(attacker:Pick<Warrior,'yaw'>,defender:Pick<Warrior,'yaw'>,action:Pick<Action,'direction'|'yaw'>):GuardDirection{
 const direction=action.direction??'top';if(direction==='top')return'top';
 const side=direction==='right'?1:-1,dot=Math.cos(action.yaw-defender.yaw)*side;
 return dot>=0?'right':'left';
}
export function targets(p:Warrior,s:FerroState):Warrior[]{return s.warriors.filter(q=>q!==p&&q.alive&&q.eligible&&distance(p,q)<=14&&Math.abs(q.y-p.y)<4&&visible({x:p.x,y:p.y+1.6,z:p.z},{x:q.x,y:q.y+1.3,z:q.z},s.mapId)).sort((a,b)=>Math.atan2(a.x-p.x,a.z-p.z)-Math.atan2(b.x-p.x,b.z-p.z));}
export function closestTarget(p:Warrior,list:Warrior[]):Warrior|undefined{return [...list].sort((a,b)=>Math.abs(angle(Math.atan2(a.x-p.x,a.z-p.z)-p.yaw))-Math.abs(angle(Math.atan2(b.x-p.x,b.z-p.z)-p.yaw))||distance(p,a)-distance(p,b))[0];}
