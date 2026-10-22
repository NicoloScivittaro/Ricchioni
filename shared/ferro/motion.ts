import data from'./motion.json';
import type{Warrior,V3}from'./types';
import{attackSpec}from'./weapons';
import{clamp}from'./arena';
type Frame=Record<string,number[]>;
const clips=data as Record<string,{duration:number;frames:Frame[]}>;
export function sampleMotion(key:string,t:number,loop=false):Frame{
 const c=clips[key]??clips.idle,u=loop?((t%c.duration)+c.duration)%c.duration/c.duration:clamp(t,0,1),at=u*(c.frames.length-1),i=Math.floor(at),a=c.frames[i],b=c.frames[Math.min(i+1,c.frames.length-1)],v=at-i,result:Frame={};
 for(const k in a)result[k]=a[k].map((x,j)=>x+(b[k][j]-x)*v);return result;
}
export function motionKey(p:Pick<Warrior,'weapon'|'action'|'bowPhase'|'charge'>):string{
 if(p.weapon==='bow')return p.bowPhase==='load'?'bowLoad':p.bowPhase==='hold'?'bowHold':p.bowPhase==='release'||p.bowPhase==='recovery'?'bowRelease':'bowIdle';
 if(!p.action)return'idle';if(p.weapon==='spear')return'polearm';if(p.weapon==='hammer'||p.weapon==='axe')return'attack2H';if(p.weapon==='shield'&&p.action.kind==='special')return'shield';return p.action.direction==='right'?'attackR':'attackL';
}
/** Retimed source attack: original windup / blade contact / recovery match the shared damage window. */
export function motionProgress(p:Pick<Warrior,'weapon'|'action'|'bowAge'|'bowPhase'|'charge'>,age=p.action?.age??0):number{
 if(p.weapon==='bow'){if(p.bowPhase==='load')return clamp(p.charge/.28,0,1);if(p.bowPhase==='hold')return .5;if(p.bowPhase==='release'||p.bowPhase==='recovery')return clamp(p.bowAge/.8,0,1);return 0;}
 if(!p.action)return 0;const s=attackSpec(p.weapon,p.action);return age<s.wind?age/s.wind*.34:age<s.wind+s.active?.34+(age-s.wind)/s.active*.33:.67+clamp((age-s.wind-s.active)/s.recover,0,1)*.33;
}
export function motionFrame(p:Warrior,age=p.action?.age??0,time=0):Frame{
 if(!p.alive)return sampleMotion('death',Math.min(1,(time-p.deadAt)/1.1));
 if(p.hurt>0&&!p.action&&p.clash?.kind!=='block')return sampleMotion('hurt',1-p.hurt/.22);
 if(!p.action&&p.weapon!=='bow'&&Math.hypot(p.vx,p.vz)>1){const lateral=p.vx*Math.cos(p.yaw)-p.vz*Math.sin(p.yaw);return sampleMotion(Math.abs(lateral)>1?(lateral>0?'strafeR':'strafeL'):'run',time,true);}
 return sampleMotion(motionKey(p),motionProgress(p,age));
}
export const point=(f:Frame,k:string,fallback:V3):V3=>f[k]?{x:f[k][0],y:f[k][1],z:f[k][2]}:{...fallback};
