import {GOLF} from './minigolfTypes';
import type {GolfPlayer,Course} from './minigolfTypes';
import type {GolfCommand} from './minigolfRules';
import {speed} from './minigolfPhysics';
/** Waypoints + imperfect distance estimate, no access to future balls/mobile obstacles. */
export class MinigolfBot {
 private states=new Map<string,{course:string;waypoint:number;wait:number;power:number;error:number}>();
 constructor(private next:()=>number){}
 command(p:GolfPlayer,c:Course,dt:number):GolfCommand {
  let s=this.states.get(p.id);
  if(!s||s.course!==c.id){s={course:c.id,waypoint:0,wait:.3+this.next()*.65,power:.3,error:0};this.states.set(p.id,s);}
  const b=p.ball;let target=c.waypoints[s.waypoint]??c.hole;
  if(Math.hypot(b.x-target.x,b.z-target.z)<2&&s.waypoint<c.waypoints.length-1)target=c.waypoints[++s.waypoint];
  // A fall can return to a checkpoint behind us: choose the nearest earlier waypoint when clearly displaced.
  if(Math.hypot(b.x-target.x,b.z-target.z)>12&&s.waypoint>0){s.waypoint=0;target=c.waypoints[0];}
  const dx=target.x-b.x,dz=target.z-b.z,distance=Math.hypot(dx,dz),angle=Math.atan2(dx,dz)+s.error;
  const cmd:GolfCommand={aim:{x:Math.sin(angle),z:Math.cos(angle)},pressed:false,released:false,held:false,cancel:false,ability:false,version:0};
  if(p.finished)return cmd;
  if(p.characterId==='judoka'&&!p.used&&speed(b)>5&&Math.hypot(b.x-c.hole.x,b.z-c.hole.z)<3)cmd.ability=true;
  if(speed(b)>GOLF.readySpeed||!b.grounded)return cmd;
  if(p.charging){cmd.held=p.charge<s.power;cmd.released=!cmd.held;return cmd;}
  s.wait-=dt;if(s.wait>0)return cmd;
  s.wait=.5+this.next()*.5;s.error=(this.next()-.5)*.055;
  const required=Math.sqrt(2*GOLF.drag*Math.max(.5,distance));
  s.power=Math.max(.025,Math.min(.9,(required-GOLF.minSpeed)/(GOLF.maxSpeed-GOLF.minSpeed)+(this.next()-.5)*.035));
  cmd.pressed=true;cmd.held=true;
  if(!p.used&&this.next()<.35&&p.characterId!=='judoka')cmd.ability=true;
  return cmd;
 }
}
