import assert from 'node:assert/strict';
import{writeFileSync}from'node:fs';
import{SydneyTrack,guideSydneyBots}from'../src/minigames/kart-race/sydneyTrack';
import{createKartState}from'../src/minigames/kart-race/raceTypes';
import{stepRainbowKart}from'../src/minigames/kart-race/rainbowTrack';
import{MotionBots}from'../src/minigames/bots/MotionBots';
import{InputManager}from'../src/network/InputManager';
import{RaceManager}from'../src/minigames/kart-race/race';
import type{MinigameContext}from'../src/minigames/types';
const t=new SydneyTrack(),input=new InputManager(),k=createKartState('driver','goblin','#fff','');k.absHeading=t.tangentAngleAt(0);
const ctx={input,players:[{id:k.playerId,bot:true}],modifier:null}as unknown as MinigameContext,bots=new MotionBots(ctx,37);
const events:string[]=[],flight:string[]=[],race=new RaceManager(t.checkpoints,t.totalLength,220,d=>t.tangentAngleAt(d),e=>events.push(e.type));race.phase='racing';
let wallFrames=0,badContacts=0,maxStep=0,maxLateral=0,firstWall:any=null;const dt=1/120;
while(race.phase!=='ended'&&race.raceTime<210){
 race.update(dt,[k],()=>input.get(k.playerId).pressed('up'));if(k.finished)break;
 bots.kart(dt,[k],t);guideSydneyBots(t,ctx,[k]);const p=input.get(k.playerId),from={distance:k.distance,lateral:k.lateral,jumpHeight:k.jumpHeight};
 const snapshot={left:false,right:false,up:p.pressed('up'),down:p.pressed('down'),drift:p.pressed('drift'),driftReleased:p.justReleased('drift'),item:false,steer:p.axis('steer').x};
 stepRainbowKart(k,snapshot,dt,t,false,e=>flight.push(e),true);t.physical.resolve(t,k,from);
 if(k.wallContact){wallFrames++;firstWall??={s:k.distance,lat:k.lateral,y:k.jumpHeight,speed:k.speed};}
 if(t.physical.blocked(t.worldPoint(k.distance,k.lateral,k.jumpHeight),k.absHeading))badContacts++;
 maxStep=Math.max(maxStep,Math.abs(k.distance-from.distance));maxLateral=Math.max(maxLateral,Math.abs(k.lateral));input.update();
 if(wallFrames>1200)break;
}
const report={track:'sydney',laps:k.lap,time:k.finishTime,raceTime:race.raceTime,distance:k.distance,checkpoints:t.checkpoints.length,checkpointEvents:events.filter(e=>e==='checkpoint_clean').length,flight,wallFrames,badContacts,maxStep,maxLateral,firstWall,physicalTriangles:t.physical.data.triangles?.length};
writeFileSync('docs/agent-work/track-corrections/sydney-checks.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
assert.equal(k.lap,3,'three real physical laps');assert.equal(flight.filter(e=>e==='launch').length,3);assert.equal(flight.filter(e=>e==='land').length,3);assert.equal(flight.includes('fall'),false);assert.equal(badContacts,0);
assert.ok(t.checkpoints.every(s=>t.hasRoadAt(s)&&!t.physical.blocked(t.worldPoint(s,0),t.tangentAngleAt(s))),'checkpoint and respawn centres clear');
