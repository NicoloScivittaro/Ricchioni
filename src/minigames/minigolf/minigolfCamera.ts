import {FreeCamera,Scene,Vector3} from '@babylonjs/core';
import type {Bumper,Course,GolfPlayer} from './minigolfTypes';
import {heightAt,supportAt,wallAt} from './minigolfCourses';
import {speed} from './minigolfPhysics';
export interface CameraPoint {x:number;y:number;z:number}
/** Swept camera radius against the same course geometry as the balls. */
export function cameraObstructed(p:CameraPoint,c:Course,time:number,extras:Bumper[]):boolean {
 const f=supportAt(c,p,time);if(f&&p.y<heightAt(f,p)+.14)return true;
 for(const base of c.walls){const w=wallAt(base,time);if(p.y<w.y-.14||p.y>w.y+(w.height??(w.rotation?.45:.7))+.14)continue;
  const dx=w.b.x-w.a.x,dz=w.b.z-w.a.z,t=Math.max(0,Math.min(1,((p.x-w.a.x)*dx+(p.z-w.a.z)*dz)/(dx*dx+dz*dz||1)));
  if(Math.hypot(p.x-w.a.x-dx*t,p.z-w.a.z-dz*t)<w.radius+.23)return true;
 }
 return [...c.bumpers,...extras].some(b=>p.y>b.y-.14&&p.y<b.y+1&&Math.hypot(p.x-b.x,p.z-b.z)<b.radius+.18);
}
export function clipCamera(origin:CameraPoint,eye:CameraPoint,c:Course,time:number,extras:Bumper[]):CameraPoint {
 const distance=Math.hypot(eye.x-origin.x,eye.y-origin.y,eye.z-origin.z),steps=Math.max(1,Math.ceil(distance/.06));
 for(let i=1;i<=steps;i++){const t=i/steps,q={x:origin.x+(eye.x-origin.x)*t,y:origin.y+(eye.y-origin.y)*t,z:origin.z+(eye.z-origin.z)*t};
  if(cameraObstructed(q,c,time,extras)){const safe=Math.max(0,(i-2)/steps);return{x:origin.x+(eye.x-origin.x)*safe,y:origin.y+(eye.y-origin.y)*safe,z:origin.z+(eye.z-origin.z)*safe};}
 }return eye;
}
/** Heading is latched at shot time: wall bounces never spin the camera. */
export class MinigolfCamera {
 readonly camera:FreeCamera;orbit=0;pitch=.32;overview=false;heading=Math.PI;
 private playerId='';private wasFollowing=false;private initialized=false;
 private focus=Vector3.Zero();private look=Vector3.Zero();
 constructor(scene:Scene){this.camera=new FreeCamera('golfCamera',new Vector3(0,2,14),scene);this.camera.inputs.clear();this.camera.minZ=.04;this.camera.maxZ=180;this.camera.fov=.9;}
 reset():void{this.playerId='';this.initialized=false;this.overview=false;}
 control(x:number,y:number,overview:boolean,dt:number):void{
  this.orbit+=x*dt*1.8;this.pitch=Math.max(.18,Math.min(.7,this.pitch-y*dt*.5));this.overview=overview;
 }
 update(p:GolfPlayer,c:Course,time:number,extras:Bumper[],following:boolean,dt:number):void {
  const changed=this.playerId!==p.id;if(changed){this.playerId=p.id;this.orbit=0;this.pitch=.32;this.wasFollowing=false;this.overview=false;this.initialized=false;}
  if(!following||!this.wasFollowing)this.heading=Math.atan2(p.aim.x,p.aim.z);
  this.wasFollowing=following;
  const ball=new Vector3(p.ball.x,p.ball.y,p.ball.z),blend=1-Math.exp(-dt*11);
  if(!this.initialized)this.focus.copyFrom(ball);else Vector3.LerpToRef(this.focus,ball,blend,this.focus);
  // Tracking lag is bounded even on fast ramps, so the ball stays in frame.
  if(Vector3.Distance(this.focus,ball)>1)this.focus.copyFrom(ball.add(this.focus.subtract(ball).normalize()));
  let eye:Vector3,target:Vector3;
  if(this.overview){
   // Frame the whole chained course, not a fixed 28 m square.
   const aspect=this.camera.getEngine().getAspectRatio(this.camera),x0=Math.min(...c.floors.map(f=>f.x-f.w/2)),x1=Math.max(...c.floors.map(f=>f.x+f.w/2)),z0=Math.min(...c.floors.map(f=>f.z-f.d/2)),z1=Math.max(...c.floors.map(f=>f.z+f.d/2));
   const radius=Math.max(34,(z1-z0)*1.2,(x1-x0)*1.25/aspect),cx=(x0+x1)/2,cz=(z0+z1)/2;
   eye=new Vector3(cx,radius,z1-3+radius*.4);target=new Vector3(cx,1,cz);}
  else {
   const yaw=this.heading+this.orbit,forward=new Vector3(Math.sin(yaw),0,Math.cos(yaw)),distance=3.35+Math.min(1.8,speed(p.ball)*.085);
   const origin=ball.add(new Vector3(0,.2,0));
   eye=this.focus.subtract(forward.scale(distance));eye.y=this.focus.y+.65+distance*this.pitch;
   const clipped=clipCamera(origin,eye,c,time,extras);eye.set(clipped.x,clipped.y,clipped.z);
   // A clipped boom needs less look-ahead, otherwise the ball drops below the
   // screen beside a curved rail. Keep the normal unobstructed framing intact.
   const room=Math.min(1,Vector3.Distance(eye,ball)/3);
   target=this.focus.add(forward.scale(1.3*room*room));target.y=this.focus.y+.48*room;
   // At a back wall the boom cannot compress into the ball. Lift locally instead.
   if(Vector3.Distance(eye,ball)<1.1){eye=ball.subtract(forward.scale(.03));eye.y=ball.y+3.4;target=ball.add(forward.scale(.6));target.y=ball.y+.2;}
  }
  const transition=1-Math.exp(-dt*(this.overview?9:13));
  if(!this.initialized){this.camera.position.copyFrom(eye);this.look.copyFrom(target);this.initialized=true;}
  else{Vector3.LerpToRef(this.camera.position,eye,transition,this.camera.position);Vector3.LerpToRef(this.look,target,transition,this.look);}
  if(!this.overview){const clipped=clipCamera(ball.add(new Vector3(0,.2,0)),this.camera.position,c,time,extras);this.camera.position.set(clipped.x,clipped.y,clipped.z);
   if(Vector3.Distance(this.camera.position,ball)<.9){this.camera.position.set(ball.x,ball.y+3.4,ball.z);const yaw=this.heading+this.orbit;this.look.set(ball.x+Math.sin(yaw)*.6,ball.y+.2,ball.z+Math.cos(yaw)*.6);}
  }
  this.camera.setTarget(this.look);
 }
}
