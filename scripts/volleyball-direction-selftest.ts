import assert from 'node:assert/strict';
import {volleyShot,volleyNetContact} from '../src/minigames/volleyball/volleyballShot';
import {BALL_GRAVITY,BALL_RADIUS,createBall,clampBallSpeed} from '../src/minigames/volleyball/volleyballTypes';
import type {Team} from '../src/minigames/volleyball/volleyballTypes';
for(const team of ['red','blue'] as Team[]){
 const dir=team==='red'?1:-1,ball={x:0,z:-dir*5.5};
 const left=volleyShot(ball,team,{x:-1,y:0},false,true),right=volleyShot(ball,team,{x:1,y:0},false,true),neutral=volleyShot(ball,team,{x:0,y:0},false,true),flat=volleyShot(ball,team,{x:0,y:-1},false,true),lob=volleyShot(ball,team,{x:0,y:1},true,true);
 assert.ok(left.dx<0&&right.dx>0);assert.ok([left,right,neutral,flat,lob].every(s=>s.dz*dir>0));
 assert.equal(neutral.speed,5.8);assert.equal(neutral.vy,8);assert.ok(flat.speed>neutral.speed&&flat.vy<neutral.vy);assert.equal(lob.style,'lob');assert.ok(!lob.smash&&lob.vy>neutral.vy&&lob.speed<neutral.speed);
 const good=volleyShot(ball,team,{x:0,y:0},true,true),late=volleyShot(ball,team,{x:0,y:0},true,false);assert.ok(good.speed>late.speed);
 assert.ok(volleyShot(ball,team,{x:0,y:1},true,true,true).smash,'il muro resta un muro anche con stick giù');
 for(const fps of [30,60,120])for(const [name,stick,smash] of [['left',{x:-1,y:0},false],['right',{x:1,y:0},false],['neutral',{x:0,y:0},false],['flat',{x:0,y:-1},false],['lob',{x:0,y:1},false],['smash',{x:.5,y:-1},true]] as const){
  const b=createBall();b.x=0;b.z=-dir*(smash?1.2:5.5);b.y=smash?3.2:1.7;
  const s=volleyShot(b,team,stick,smash,true);b.vx=s.dx*s.speed;b.vz=s.dz*s.speed;b.vy=s.vy;clampBallSpeed(b);
  let hitNet=false,crossed=false,time=0;
  while(b.y>BALL_RADIUS&&time<4){const prev={x:b.x,y:b.y,z:b.z};b.vy-=BALL_GRAVITY/fps;b.x+=b.vx/fps;b.y+=b.vy/fps;b.z+=b.vz/fps;hitNet||=!!volleyNetContact(prev,b);crossed||=prev.z*b.z<=0;time+=1/fps;}
  assert.ok(!hitNet,`${team} ${name} ${fps} deve superare la rete`);assert.ok(crossed&&b.z*dir>0);assert.ok(Math.abs(b.x)<12&&Math.abs(b.z)<8);
  if(name==='left')assert.ok(b.x<0);if(name==='right')assert.ok(b.x>0);if(name==='smash')assert.ok(time>.4,'finestra di difesa esiste');
 }
}
assert.ok(volleyNetContact({x:0,y:2.5,z:-2},{x:1,y:3,z:1}),'sfera che sfiora la rete: altezza al contatto, non fine frame');
assert.ok(!volleyNetContact({x:0,y:3.4,z:-2},{x:1,y:3.2,z:1}));
assert.ok(volleyNetContact({x:0,y:2,z:.8},{x:0,y:2,z:-1})?.side===1);
console.log('PASS Pallavolo: due squadre, sx/dx/neutro/teso/lob/smash, timing, muro, traiettorie e rete 30/60/120 FPS.');
