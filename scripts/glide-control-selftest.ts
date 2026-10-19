import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {RainbowTrack,stepRainbowKart} from '../src/minigames/kart-race/rainbowTrack';
import {createKartState} from '../src/minigames/kart-race/raceTypes';
import {glideLift,predictGlideLanding,GLIDE} from '../src/minigames/kart-race/glideDynamics';
import {MotionBots} from '../src/minigames/bots/MotionBots';
import {InputManager} from '../src/network/InputManager';
import type {MinigameContext} from '../src/minigames/types';
const track=new RainbowTrack(),input={up:true,down:false,left:false,right:false,steer:0,drift:false,driftReleased:false,item:false},rows:any[]=[];
for(const h of [3.5,18]){
 assert.equal(glideLift(0,h),0);assert.ok(glideLift(1,h)<1e-10);assert.equal(glideLift(.5,h),h);
 assert.ok(glideLift(.00001,h)/.00001<.01,'soft vertical departure');assert.ok(glideLift(.99999,h)/.00001<.01,'soft vertical arrival');
}
for(const hz of [30,60,120]){
 const gap=track.gaps[0],k=createKartState('human','goblin','#fff','');
 Object.assign(k,{flight:'GLIDE',distance:gap.launch+130,glideStart:gap.launch,glideEnd:gap.landing,speed:44,heading:0,absHeading:track.tangentAngleAt(gap.launch+130)});
 for(let i=0;i<Math.round(.4*hz);i++)stepRainbowKart(k,{...input,steer:.35},1/hz,track,false,()=>{});
 assert.ok(k.heading>.03&&k.heading<.09,'small stick gives a proportional, bounded heading');
 const forecast=predictGlideLanding(k),atRelease=k.lateral,headingAtRelease=k.heading;
 for(let i=0;i<Math.round(1.2*hz);i++)stepRainbowKart(k,input,1/hz,track,false,()=>{});
 assert.ok(Math.abs(k.heading)<.002&&Math.abs(k.glideYawVelocity)<.012,'release settles without oscillation');assert.ok(k.lateral>atRelease,'remaining inertia is not erased');assert.ok(k.lateral>.6,'release does not centre the lane');
 let landed=0;for(let i=0;i<hz*12&&k.flight==='GLIDE';i++)stepRainbowKart(k,input,1/hz,track,false,e=>{if(e==='land')landed++;});
 assert.equal(landed,1);assert.ok(k.glideLanding>0,'explicit suspension/camera landing pulse');assert.ok(Math.abs(k.lateral-forecast)<.22,'release marker predicts the actual lateral touchdown');assert.equal(k.boostTimer,0,'landing gives no free turbo');
 rows.push({hz,atRelease,headingAtRelease,forecast,touchdown:k.lateral,error:Math.abs(k.lateral-forecast)});
}
// Alignment after real lateral/yaw/bumper-like impulses, including the short gap.
for(const gap of track.gaps)for(const lateral of [-4,4])for(const hz of [30,60,120]){
 const k=createKartState('bot','goblin','#fff','');Object.assign(k,{flight:'GLIDE',distance:gap.launch+.1,glideStart:gap.launch,glideEnd:gap.landing,lateral,speed:40,heading:0,absHeading:track.tangentAngleAt(gap.launch+.1),slipVelocity:Math.sign(lateral)*2});
 const im=new InputManager(),bots=new MotionBots({players:[{id:'bot',bot:true}],input:im,modifier:null} as unknown as MinigameContext);
 for(let i=0;i<hz*20&&k.flight==='GLIDE';i++){bots.kart(1/hz,[k],track);stepRainbowKart(k,{...input,steer:im.get('bot').axis('steer').x},1/hz,track,false,()=>{});im.update();}
 assert.equal(k.flight,'DRIVE','perturbed bot still lands using input, not a teleport');rows.push({gap:gap.name,hz,lateral,touchdown:k.lateral});
}
assert.ok(Math.max(...rows.slice(0,3).map(r=>r.touchdown))-Math.min(...rows.slice(0,3).map(r=>r.touchdown))<.22,'consistent control at30/60/120Hz');
writeFileSync('docs/agent-work/glide-polish/control-checks.json',JSON.stringify({config:GLIDE,rows},null,2));console.log('PASS lift endpoints, proportional steering, stable release, real lateral inertia, prediction, no free boost,12 perturbed bot landings,30/60/120Hz.');
