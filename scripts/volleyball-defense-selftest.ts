import assert from 'node:assert/strict';
import {beginDive,canDiveReceive,updateSprint,DEFENSE} from '../src/minigames/volleyball/volleyballDefense';
import {createBall,createVolleyballPlayer,BALL_RADIUS} from '../src/minigames/volleyball/volleyballTypes';
for(const team of ['red','blue'] as const){
 const p=createVolleyballPlayer('a','goblin','#fff','x','A',team,false),b=createBall();
 p.z=team==='red'?-4:4; b.state='flying';b.holderId=null;b.lastTouchId='b';b.z=p.z;b.x=2.8;b.y=1;
 assert.ok(beginDive(p,b,0,0));assert.ok(p.vx>0);assert.ok(canDiveReceive(p,b));
 assert.equal(beginDive(p,b,1,0),false,'cooldown prevents repeated dives');
 b.z=-p.z;assert.equal(canDiveReceive(p,b),false,'own half only');b.z=p.z;
 b.y=BALL_RADIUS-.001;assert.equal(canDiveReceive(p,b),false,'ground contact already lost');
 b.y=2.2;assert.equal(canDiveReceive(p,b),false,'dive cannot intercept high balls');b.y=1;
 b.x=3.2;assert.equal(canDiveReceive(p,b),false,'bounded contact radius');b.x=1;
 b.lastTouchId='a';assert.equal(canDiveReceive(p,b),false,'cannot farm your own hit');b.lastTouchId='b';
 p.diveReceived=true;assert.equal(canDiveReceive(p,b),false,'one receive per dive');
 p.diveReceived=false;p.hitCooldown=.1;assert.equal(canDiveReceive(p,b),false,'respects hit cooldown');
 p.hitCooldown=0;p.diveCooldown=0;p.diveTime=0;p.y=1;assert.equal(beginDive(p,b,1,0),false,'no airborne dive');p.y=0;
 b.state='held';assert.equal(beginDive(p,b,1,0),false,'no dive on serve');
}
for(const hz of [30,60,120]){
 const p=createVolleyballPlayer('a','goblin','#fff','x','A','red',false);
 for(let i=0;i<3*hz;i++)updateSprint(p,true,true,true,1/hz);
 assert.equal(p.sprintEnergy,0);assert.equal(p.sprinting,false);
 for(let i=0;i<hz;i++)updateSprint(p,true,true,true,1/hz);
 assert.equal(p.sprintEnergy,0,'must release to recharge');
 for(let i=0;i<4*hz;i++)updateSprint(p,false,true,true,1/hz);
 assert.equal(p.sprintEnergy,1);updateSprint(p,true,true,false,1/hz);assert.equal(p.sprinting,false,'freeze/holder blocked');
 updateSprint(p,true,false,true,1/hz);assert.equal(p.sprinting,false,'standing still does not consume energy');
 p.diveTime=DEFENSE.diveSeconds;updateSprint(p,true,true,true,1/hz);assert.equal(p.sprinting,false);
}
console.log('PASS: dive ownership, height, radius, cooldown, one contact; sprint depletion/recharge at 30/60/120 Hz.');
