import {GOLF} from './minigolfTypes';
import type {GolfBall,Course,GolfEvent,Bumper,Point} from './minigolfTypes';
import {supportAt,heightAt,wallAt,floorAt,nearbyImportedWalls} from './minigolfCourses';
import {resolveGolfSolids} from './minigolfSolids';
export const speed=(b:GolfBall):number=>Math.hypot(b.vx,b.vz);
export function createBall(id:string,p:Point,y=0):GolfBall {
 return {id,x:p.x,z:p.z,y:y+GOLF.radius,vx:0,vy:0,vz:0,grounded:true,done:false,safe:{x:p.x,z:p.z},safeY:y,tee:{x:p.x,z:p.z},teeY:y,readyFor:1,stuckFor:0,
  bounceBoost:1,bounceCount:0,lastContact:null,contacts:new Set(),lastMotion:{x:p.x,z:p.z},travel:0};
}
export function restoreBall(b:GolfBall):void {
 Object.assign(b,{...b.safe,y:b.safeY+GOLF.radius,vx:0,vy:0,vz:0,grounded:true,readyFor:0,stuckFor:0,bounceBoost:1,launchCharge:0});
 b.contacts.clear();b.lastMotion={x:b.x,z:b.z};
}
/** Falls restart this hole at the original personal tee; technical unsticks still use safe. */
export function resetBallToTee(b:GolfBall):void {
 b.safe={...b.tee};b.safeY=b.teeY;restoreBall(b);b.travel=0;b.bounceCount=0;b.lastContact=null;
}
/** supportAt has a general-purpose .15m allowance; ball physics uses an explicit ceiling. */
function below(course:Course,p:Point,time:number,ceiling:number){return supportAt(course,p,time,ceiling-.15);}
export function impulse(b:GolfBall,aim:Point,power:number,mult=1):void {
 const charge=Math.max(0,Math.min(1,power)),len=Math.hypot(aim.x,aim.z)||1,v=(GOLF.minSpeed+(GOLF.maxSpeed-GOLF.minSpeed)*Math.max(0,Math.min(1,power)))*mult;
 // A shallow, progressive hop only above 82% charge; boost cannot turn a putter into a launcher.
 const hop=b.grounded?GOLF.maxHopVelocity*Math.pow(Math.max(0,(charge-GOLF.hopThreshold)/(1-GOLF.hopThreshold)),1.5):0;
 const horizontal=Math.sqrt(Math.max(0,v*v-hop*hop));
 b.vx=aim.x/len*horizontal;b.vz=aim.z/len*horizontal;
 b.launchCharge=charge;
 if(hop>0){b.vy=hop;b.grounded=false;}
 b.readyFor=0;b.bounceCount=0;b.contacts.clear();b.travel=0;
}
function cap(b:GolfBall):void {const v=speed(b);if(v>GOLF.maxVelocity){b.vx*=GOLF.maxVelocity/v;b.vz*=GOLF.maxVelocity/v;}}
function nearest(p:Point,a:Point,b:Point):Point {const dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/(dx*dx+dz*dz||1)));return{x:a.x+dx*t,z:a.z+dz*t};}
/** Fixed step, spatial substeps: no body moves more than radius/3, including moving arms. */
export function physicsStep(balls:GolfBall[],course:Course,time:number,dt:number,extras:Bumper[]=[]):GolfEvent[] {
 const events:GolfEvent[]=[],active=balls.filter(b=>!b.done);
 const n=Math.max(1,Math.ceil(dt*(GOLF.maxVelocity+12)/(GOLF.radius/3))),h=dt/n;
 for(let k=0;k<n;k++){
  const t=time+k*h,walls=course.imported?course.walls:course.walls.map(w=>wallAt(w,t)),bumpers=[...course.bumpers,...extras.filter(b=>!b.expires||b.expires>t)];
  for(const b of active){
   if(b.done)continue;
   const current=below(course,b,t,b.y-GOLF.radius+GOLF.surfaceSnap);
   if(b.grounded&&current&&Math.abs(b.y-GOLF.radius-heightAt(current,b))<=GOLF.surfaceSnap){
    b.y=heightAt(current,b)+GOLF.radius;
    const sx=current.slopeX??0,sz=current.slopeZ??0;
    b.vx-=GOLF.gravity*sx*h;b.vz-=GOLF.gravity*sz*h;
    const v=speed(b),drag=GOLF.drag*(current.surface==='sand'?2.5:current.surface==='ice'?.38:1);
    if(v>0){const f=Math.max(0,v-drag*h)/v;b.vx*=f;b.vz*=f;}
    b.vy=sx*b.vx+sz*b.vz;
    if(current.motion){const base=course.floors.find(f=>f.motion===current.motion)!;
     const next=floorAt(base,t+h);b.x+=next.x-current.x;b.z+=next.z-current.z;}
   }else {b.grounded=false;b.vy-=GOLF.gravity*h;}
   const ox=b.x,oz=b.z,oldY=b.y,oldBottom=b.y-GOLF.radius;b.x+=b.vx*h;b.z+=b.vz*h;b.y+=b.vy*h;b.travel+=Math.hypot(b.x-ox,b.z-oz);
   const landing=below(course,b,t+h,Math.max(oldBottom,b.y-GOLF.radius)+GOLF.surfaceSnap);
   // Carry uphill velocity over the crest; strong shots get a bounded arcade lift.
   // Flat putts retain the existing shallow hop and every flight still obeys gravity.
   const uphill=current?(current.slopeX??0)*b.vx+(current.slopeZ??0)*b.vz:0;
   const nextUphill=landing?(landing.slopeX??0)*b.vx+(landing.slopeZ??0)*b.vz:0;
   const launch=b.grounded&&uphill>.6&&(!landing||nextUphill<uphill*.65)&&(b.launchCharge??0)>.6;
   if(launch){b.grounded=false;b.vy=Math.min(8,uphill*1.35+2.6*Math.pow(b.launchCharge??0,2));b.y=Math.max(b.y,oldY)+.002;b.launchCharge=0;}
   if(landing&&!launch){const y=heightAt(landing,b)+GOLF.radius;
    const follows=b.grounded&&Math.abs(b.y-y)<=GOLF.surfaceSnap;
    const crosses=b.vy<=0&&oldBottom>=y-GOLF.radius-.006&&b.y<=y+.006;
    if(follows||crosses){b.y=y;
     if(!b.grounded&&b.vy< -3){b.vy=-b.vy*GOLF.verticalRestitution;b.grounded=false;}
     else{b.grounded=true;b.vy=0;}
    }else b.grounded=false;
   }else b.grounded=false;
   resolveGolfSolids(b,course,t+h,{x:ox,y:oldY,z:oz});
   const contacts=new Set<string>();
   for(const [i,w] of (course.imported?nearbyImportedWalls(course,b):walls.entries())){
    const q=nearest(b,w.a,w.b),dx=b.x-q.x,dz=b.z-q.z,d=Math.hypot(dx,dz),radius=GOLF.radius+w.radius;
    if(d>=radius||b.y+GOLF.radius<w.y||b.y-GOLF.radius>w.y+(w.height??(w.rotation?.45:.7)))continue;
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
   // A shallow lip acts only INSIDE the visible cup, at its own elevation and at putting speed.
   const dx=course.hole.x-b.x,dz=course.hole.z-b.z,dist=Math.hypot(dx,dz);
   if(b.grounded&&Math.abs(b.y-GOLF.radius-course.holeY)<.08&&speed(b)<=GOLF.captureSpeed){
    if(dist<GOLF.cupRadius&&dist>1e-8){
     b.vx+=dx/dist*GOLF.cupLipAccel*h;b.vz+=dz/dist*GOLF.cupLipAccel*h;
     const v=speed(b);if(v>GOLF.captureSpeed){b.vx*=GOLF.captureSpeed/v;b.vz*=GOLF.captureSpeed/v;}
    }
    const q=nearest(course.hole,{x:ox,z:oz},b),opening=GOLF.cupRadius-GOLF.radius;
    if(Math.hypot(q.x-course.hole.x,q.z-course.hole.z)<=opening){
     b.done=true;b.vx=b.vz=b.vy=0;events.push({type:'hole',id:b.id,x:b.x,z:b.z});continue;
    }
   }
   if(b.y< -4||Math.abs(b.x)>32||Math.abs(b.z)>48){events.push({type:'fall',id:b.id,x:b.x,z:b.z});resetBallToTee(b);}

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
  const restingFloor=supportAt(course,b,time+dt),onLip=Math.abs(b.y-GOLF.radius-course.holeY)<.08&&Math.hypot(b.x-course.hole.x,b.z-course.hole.z)<GOLF.cupRadius;
  const slopeForce=GOLF.gravity*Math.hypot(restingFloor?.slopeX??0,restingFloor?.slopeZ??0)+(onLip?GOLF.cupLipAccel:0);
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
export function predict(ball:GolfBall,course:Course,aim:Point,power:number,seconds:number):(Point&{y:number})[] {
 const b=createBall('preview',ball,ball.y-GOLF.radius);impulse(b,aim,power);
 const c={...course,walls:course.walls.filter(w=>!w.rotation),floors:course.floors.filter(f=>!f.motion)};
 const points:(Point&{y:number})[]=[{x:b.x,y:b.y,z:b.z}];
 for(let i=0;i<seconds*60&&!b.done;i++){physicsStep([b],c,0,1/60);if(i%4===0)points.push({x:b.x,y:b.y,z:b.z});if(speed(b)<GOLF.readySpeed||b.y< -1)break;}
 return points;
}
