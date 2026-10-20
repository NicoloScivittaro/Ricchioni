import {GOLF} from './minigolfTypes';
import type {GolfPlayer,Course} from './minigolfTypes';
import type {GolfCommand} from './minigolfRules';
import {speed} from './minigolfPhysics';
import {supportAt,heightAt} from './minigolfCourses';
function clearRoute(c:Course,a:{x:number;z:number},b:{x:number;z:number}):boolean {
 const start=supportAt(c,a,0);if(!start)return false;
 const n=Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.2);let previous=heightAt(start,a);
 for(let i=1;i<=n;i++){const q={x:a.x+(b.x-a.x)*i/n,z:a.z+(b.z-a.z)*i/n},f=supportAt(c,q,0);if(!f)return false;
  const y=heightAt(f,q);if(y-previous>.16)return false;previous=y;
  if(c.bumpers.some(p=>Math.hypot(q.x-p.x,q.z-p.z)<p.radius+GOLF.radius+.12))return false;
  for(const w of c.walls.filter(w=>!w.rotation)){const dx=w.b.x-w.a.x,dz=w.b.z-w.a.z,t=Math.max(0,Math.min(1,((q.x-w.a.x)*dx+(q.z-w.a.z)*dz)/(dx*dx+dz*dz||1)));
   if(y+GOLF.radius*2>=w.y&&y<=w.y+(w.height??.7)&&Math.hypot(q.x-w.a.x-dx*t,q.z-w.a.z-dz*t)<GOLF.radius+w.radius+.12)return false;}
 }return true;
}
/** Waypoints + imperfect distance estimate, no access to future balls/mobile obstacles. */
export class MinigolfBot {
 private states=new Map<string,{course:string;waypoint:number;wait:number;power:number;error:number}>();
 constructor(private next:()=>number){}
 command(p:GolfPlayer,c:Course,dt:number):GolfCommand {
  let s=this.states.get(p.id);
  if(!s||s.course!==c.id){s={course:c.id,waypoint:0,wait:.3+this.next()*.65,power:.3,error:0};this.states.set(p.id,s);}
  const b=p.ball;let target=c.waypoints[s.waypoint]??c.hole;
  if(Math.hypot(b.x-target.x,b.z-target.z)<2&&s.waypoint<c.waypoints.length-1)target=c.waypoints[++s.waypoint];
  // Skip redundant stops along a clear supported route; never predict moving arms or opponent balls.
  if(b.grounded&&speed(b)<GOLF.readySpeed&&supportAt(c,b,0))for(let i=c.waypoints.length-1;i>s.waypoint;i--){if(clearRoute(c,b,c.waypoints[i])){s.waypoint=i;target=c.waypoints[i];break;}}
  // A fall returns to the tee behind us: choose the nearest earlier waypoint when clearly displaced.
  if(Math.hypot(b.x-target.x,b.z-target.z)>12&&s.waypoint>0&&!clearRoute(c,b,target)){s.waypoint=0;target=c.waypoints[0];}
  const dx=target.x-b.x,dz=target.z-b.z,distance=Math.hypot(dx,dz),angle=Math.atan2(dx,dz)+s.error;
  const cmd:GolfCommand={aim:{x:Math.sin(angle),z:Math.cos(angle)},pressed:false,released:false,held:false,cancel:false,ability:false,version:0};
  if(p.finished)return cmd;
  if(p.characterId==='judoka'&&!p.used&&speed(b)>5&&Math.hypot(b.x-c.hole.x,b.z-c.hole.z)<3)cmd.ability=true;
  if(speed(b)>GOLF.readySpeed||!b.grounded)return cmd;
  if(p.charging){cmd.held=p.charge<s.power;cmd.released=!cmd.held;return cmd;}
  s.wait-=dt;if(s.wait>0)return cmd;
  s.wait=.5+this.next()*.5;s.error=(this.next()-.5)*.055;
  let energy=2*GOLF.drag*Math.max(.5,distance);
  if(c.imported){
   // A ramp needs gravitational potential as well as rolling distance. Sample only
   // the chosen visible line, without revealing future opponent/moving-obstacle states.
   for(let i=1;i<=32;i++){const t=i/32,q={x:b.x+dx*t,z:b.z+dz*t},f=supportAt(c,q,0);
    if(f)energy=Math.max(energy,2*GOLF.drag*distance*t+2*GOLF.gravity*(heightAt(f,q)-(b.y-GOLF.radius)));}
  }
  const required=Math.sqrt(energy);
  s.power=Math.max(.025,Math.min(.9,(required-GOLF.minSpeed)/(GOLF.maxSpeed-GOLF.minSpeed)+(this.next()-.5)*.035));
  cmd.pressed=true;cmd.held=true;
  if(!p.used&&this.next()<.35&&p.characterId!=='judoka')cmd.ability=true;
  return cmd;
 }
}
