import {AB} from '../../../shared/abilityCatalog';
import type {AbilityStatus} from '../../../shared/abilityCatalog';
import type {Course,GolfPlayer,Bumper} from './minigolfTypes';
import {GOLF} from './minigolfTypes';
import {heightAt,supportAt} from './minigolfCourses';
import {speed} from './minigolfPhysics';
export function activateAbility(p:GolfPlayer,c:Course,time:number,extras:Bumper[]):string|null {
 if(p.finished)return 'BUCA FINITA';if(p.used)return 'ESAURITA';
 const b=p.ball;
 switch(p.characterId){
  case 'goblin':if(!b.grounded||speed(b)>GOLF.readySpeed)return 'ASPETTA LA PALLA';p.armed='bounce';break;
  case 'ciro':if(!b.grounded||speed(b)>GOLF.readySpeed)return 'ASPETTA LA PALLA';p.armed='power';break;
  case 'dottore':p.prediction=AB.minigolf.dottore.p.duration;break;
  case 'judoka':if(speed(b)<.5)return 'SERVE MOVIMENTO';b.vx*=AB.minigolf.judoka.p.speedFactor;b.vz*=AB.minigolf.judoka.p.speedFactor;break;
  case 'buttafuori':{
   if(!b.grounded||speed(b)>GOLF.readySpeed)return 'ASPETTA LA PALLA';
   const a=AB.minigolf.buttafuori.p,q={x:b.x+p.aim.x*a.offset,z:b.z+p.aim.z*a.offset},f=supportAt(c,q,time),rad=a.radius+GOLF.radius;
   if(!f||f.motion||Math.abs(q.x-f.x)>f.w/2-rad||Math.abs(q.z-f.z)>f.d/2-rad||Math.hypot(q.x-c.hole.x,q.z-c.hole.z)<a.holeClear||Math.hypot(q.x-c.spawn.x,q.z-c.spawn.z)<a.spawnClear
    ||extras.some(e=>Math.hypot(e.x-q.x,e.z-q.z)<e.radius+a.radius+.2)||c.bumpers.some(e=>Math.hypot(e.x-q.x,e.z-q.z)<e.radius+a.radius+.2))return 'ZONA NON VALIDA';
   if(c.walls.some(w=>{const dx=w.b.x-w.a.x,dz=w.b.z-w.a.z,t=Math.max(0,Math.min(1,((q.x-w.a.x)*dx+(q.z-w.a.z)*dz)/(dx*dx+dz*dz||1)));return Math.hypot(q.x-w.a.x-dx*t,q.z-w.a.z-dz*t)<rad+w.radius;}))return 'ZONA NON VALIDA';
   extras.push({...q,y:heightAt(f,q),radius:a.radius,power:a.power,expires:time+a.duration,owner:p.id});break;
  }
  default:return 'NON DISPONIBILE';
 }
 p.used=true;return null;
}
export function abilityStatus(p:GolfPlayer,time:number,extras:Bumper[]):AbilityStatus {
 if(p.finished)return {state:'SPENT',charges:0,note:'BUCA FINITA'};
 if(p.armed)return {state:'ACTIVE',note:'TIRO ARMATO',charges:0};
 if(p.debt>0)return {state:'ACTIVE',remaining:p.debt,note:`DEBITO ${p.debt.toFixed(1)}s`,charges:0};
 if(p.prediction>0)return {state:'ACTIVE',remaining:p.prediction,charges:0};
 const bumper=extras.find(b=>b.owner===p.id&&(b.expires??0)>time);
 if(bumper)return {state:'ACTIVE',remaining:bumper.expires!-time,charges:0};
 return {state:p.used?'SPENT':'READY',charges:p.used?0:1};
}
