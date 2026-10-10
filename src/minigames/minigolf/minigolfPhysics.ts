import {GOLF} from './minigolfTypes';
import type {GolfBall,Course,GolfEvent,Bumper,Point} from './minigolfTypes';
import {supportAt,heightAt,wallAt,floorAt} from './minigolfCourses';
export const speed=(b:GolfBall):number=>Math.hypot(b.vx,b.vz);
export function createBall(id:string,p:Point,y=0):GolfBall {
 return {id,...p,y:y+GOLF.radius,vx:0,vy:0,vz:0,grounded:true,done:false,safe:{...p},safeY:y,readyFor:1,stuckFor:0,
  bounceBoost:1,bounceCount:0,lastContact:null,contacts:new Set(),lastMotion:{...p},travel:0};
}
export function restoreBall(b:GolfBall):void {
 Object.assign(b,{...b.safe,y:b.safeY+GOLF.radius,vx:0,vy:0,vz:0,grounded:true,readyFor:0,stuckFor:0,bounceBoost:1});
 b.contacts.clear();b.lastMotion={x:b.x,z:b.z};
}
export function impulse(b:GolfBall,aim:Point,power:number,mult=1):void {
 const len=Math.hypot(aim.x,aim.z)||1,v=(GOLF.minSpeed+(GOLF.maxSpeed-GOLF.minSpeed)*Math.max(0,Math.min(1,power)))*mult;
 b.vx=aim.x/len*v;b.vz=aim.z/len*v;b.readyFor=0;b.bounceCount=0;b.contacts.clear();b.travel=0;
}
function cap(b:GolfBall):void {const v=speed(b);if(v>GOLF.maxVelocity){b.vx*=GOLF.maxVelocity/v;b.vz*=GOLF.maxVelocity/v;}}
function nearest(p:Point,a:Point,b:Point):Point {const dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/(dx*dx+dz*dz||1)));return{x:a.x+dx*t,z:a.z+dz*t};}
/** Fixed step, spatial substeps: no body moves more than radius/3, including moving arms. */
export function physicsStep(balls:GolfBall[],course:Course,time:number,dt:number,extras:Bumper[]=[]):GolfEvent[] {
 const events:GolfEvent[]=[],active=balls.filter(b=>!b.done);
 const n=Math.max(1,Math.ceil(dt*(GOLF.maxVelocity+12)/(GOLF.radius/3))),h=dt/n;
 for(let k=0;k<n;k++){
  const t=time+k*h,walls=course.walls.map(w=>wallAt(w,t)),bumpers=[...course.bumpers,...extras.filter(b=>!b.expires||b.expires>t)];
  for(const b of active){
   if(b.done)continue;
   const current=supportAt(course,b,t,b.y-GOLF.radius+.3);
   if(b.grounded&&current){
    b.y=heightAt(current,b)+GOLF.radius;
    const sx=current.slopeX??0,sz=current.slopeZ??0;
    b.vx-=GOLF.gravity*sx*h;b.vz-=GOLF.gravity*sz*h;
    const v=speed(b),drag=GOLF.drag*(current.surface==='sand'?2.5:current.surface==='ice'?.38:1);
    if(v>0){const f=Math.max(0,v-drag*h)/v;b.vx*=f;b.vz*=f;}
    b.vy=sx*b.vx+sz*b.vz;
    if(current.motion){const base=course.floors.find(f=>f.motion===current.motion)!;
     const next=floorAt(base,t+h);b.x+=next.x-current.x;b.z+=next.z-current.z;}
   }else {b.grounded=false;b.vy-=GOLF.gravity*h;}
   const ox=b.x,oz=b.z;b.x+=b.vx*h;b.z+=b.vz*h;b.y+=b.vy*h;b.travel+=Math.hypot(b.x-ox,b.z-oz);
   const landing=supportAt(course,b,t+h,b.y-GOLF.radius+.15);
   if(landing){const y=heightAt(landing,b)+GOLF.radius;
    if(b.y<=y+.12&&(b.grounded||b.vy<=0)){b.y=y;b.grounded=true;b.vy=0;}}
   else b.grounded=false;
   const contacts=new Set<string>();
   for(const [i,w] of walls.entries()){
    const q=nearest(b,w.a,w.b),dx=b.x-q.x,dz=b.z-q.z,d=Math.hypot(dx,dz),radius=GOLF.radius+w.radius;
    if(d>=radius||b.y<w.y-.2||b.y>w.y+1.2)continue;
    const key=`w${i}`;contacts.add(key);const nx=d>1e-8?dx/d:-(w.b.z-w.a.z)/(Math.hypot(w.b.x-w.a.x,w.b.z-w.a.z)||1),nz=d>1e-8?dz/d:(w.b.x-w.a.x)/(Math.hypot(w.b.x-w.a.x,w.b.z-w.a.z)||1);
    b.x+=nx*(radius-d+.0001);b.z+=nz*(radius-d+.0001);
    const wx=w.rotation?-w.rotation.speed*(q.z-w.rotation.center.z):0,wz=w.rotation?w.rotation.speed*(q.x-w.rotation.center.x):0;
    const vn=(b.vx-wx)*nx+(b.vz-wz)*nz;
    if(vn<0){const boost=!w.rotation?b.bounceBoost:1;const j=-(1+GOLF.restitution)*vn*boost;
     b.vx+=j*nx;b.vz+=j*nz;if(!w.rotation)b.bounceBoost=1;
     if(!b.contacts.has(key)){b.bounceCount++;events.push({type:'wall',id:b.id,x:b.x,z:b.z,value:-vn});}}
   }
   for(const [i,p] of bumpers.entries()){
    const dx=b.x-p.x,dz=b.z-p.z,d=Math.hypot(dx,dz),r=GOLF.radius+p.radius,key=`b${i}`;
    if(d>=r||Math.abs(b.y-GOLF.radius-p.y)>.7)continue;
    contacts.add(key);const nx=d?dx/d:1,nz=d?dz/d:0;b.x=p.x+nx*(r+.0001);b.z=p.z+nz*(r+.0001);
    const vn=b.vx*nx+b.vz*nz;if(vn<0||!b.contacts.has(key)){
     const j=Math.max(0,-vn)*(1+GOLF.restitution)+(b.contacts.has(key)?0:p.power);b.vx+=j*nx;b.vz+=j*nz;
     if(!b.contacts.has(key))events.push({type:'bumper',id:b.id,x:b.x,z:b.z,value:j});}
   }
   b.contacts=contacts;cap(b);
   if(b.grounded&&Math.abs(b.y-GOLF.radius-course.holeY)<.2&&Math.hypot(b.x-course.hole.x,b.z-course.hole.z)<.5&&speed(b)<=GOLF.captureSpeed){
    b.done=true;b.vx=b.vz=b.vy=0;events.push({type:'hole',id:b.id,x:b.x,z:b.z});continue;}
   if(b.y< -4||Math.abs(b.x)>28||Math.abs(b.z)>28){events.push({type:'fall',id:b.id,x:b.x,z:b.z});restoreBall(b);}
  }
  for(let i=0;i<active.length;i++)for(let j=i+1;j<active.length;j++){
   const a=active[i],b=active[j];if(a.done||b.done||Math.abs(a.y-b.y)>GOLF.radius*1.6)continue;
   const dx=b.x-a.x,dz=b.z-a.z,d=Math.hypot(dx,dz),r=GOLF.radius*2;if(d>=r)continue;
   const nx=d?dx/d:1,nz=d?dz/d:0,correction=(r-d+.0001)/2;
   a.x-=nx*correction;a.z-=nz*correction;b.x+=nx*correction;b.z+=nz*correction;
   const vn=(b.vx-a.vx)*nx+(b.vz-a.vz)*nz;if(vn>=0)continue;
   const impulse=-(1+.86)*vn/2;a.vx-=impulse*nx;a.vz-=impulse*nz;b.vx+=impulse*nx;b.vz+=impulse*nz;
   a.readyFor=b.readyFor=0;
   if(-vn>2)events.push({type:'ball',id:speed(a)>speed(b)?a.id:b.id,other:speed(a)>speed(b)?b.id:a.id,x:a.x,z:a.z,value:-vn});
  }
 }
 for(const b of active){if(b.done)continue;
  const restingFloor=supportAt(course,b,time+dt),slopeForce=GOLF.gravity*Math.hypot(restingFloor?.slopeX??0,restingFloor?.slopeZ??0);
  const friction=GOLF.drag*(restingFloor?.surface==='sand'?2.5:restingFloor?.surface==='ice'?.38:1);
  if(b.grounded&&speed(b)<GOLF.readySpeed&&slopeForce<=friction){b.readyFor+=dt;if(b.readyFor>.18){b.vx=b.vz=0;const f=restingFloor;
   if(f&&!f.motion&&!f.slopeX&&!f.slopeZ&&Math.abs(b.x-f.x)<f.w/2-.5&&Math.abs(b.z-f.z)<f.d/2-.5){b.safe={x:b.x,z:b.z};b.safeY=heightAt(f,b);}}}
  else b.readyFor=0;
  const moved=Math.hypot(b.x-b.lastMotion.x,b.z-b.lastMotion.z);
  b.stuckFor=speed(b)>.3&&moved<.001?b.stuckFor+dt:0;b.lastMotion={x:b.x,z:b.z};
  if(b.stuckFor>2.5||![b.x,b.y,b.z,b.vx,b.vy,b.vz].every(Number.isFinite)){restoreBall(b);events.push({type:'stuck',id:b.id,x:b.x,z:b.z});}
 }
 return events;
}
/** Uses the same static collision solver, deliberately excludes other balls and mobile obstacles. */
export function predict(ball:GolfBall,course:Course,aim:Point,power:number,seconds:number):Point[] {
 const b=createBall('preview',ball,ball.y-GOLF.radius);impulse(b,aim,power);
 const c={...course,walls:course.walls.filter(w=>!w.rotation),floors:course.floors.filter(f=>!f.motion)};
 const points:Point[]=[{x:b.x,z:b.z}];
 for(let i=0;i<seconds*60&&!b.done;i++){physicsStep([b],c,0,1/60);if(i%4===0)points.push({x:b.x,z:b.z});if(speed(b)<GOLF.readySpeed||b.y< -1)break;}
 return points;
}
