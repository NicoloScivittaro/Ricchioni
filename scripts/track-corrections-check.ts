import assert from 'node:assert/strict';
import {writeFileSync,readFileSync} from 'node:fs';
import {PrimoTrack,guidePrimoBots} from '../src/minigames/kart-race/primoTrack';
import {createKartState} from '../src/minigames/kart-race/raceTypes';
import {stepKartPhysics} from '../src/minigames/kart-race/kartPhysics';
import {InputManager} from '../src/network/InputManager';
import {RaceManager} from '../src/minigames/kart-race/race';
import type {MinigameContext} from '../src/minigames/types';

const track=new PrimoTrack(),input=new InputManager(),k=createKartState('driver','goblin','#fff','');
k.absHeading=track.tangentAngleAt(0);
const ctx={input,players:[{id:k.playerId,bot:true}]}as unknown as MinigameContext;
const events:string[]=[],race=new RaceManager(track.checkpoints,track.totalLength,200,d=>track.tangentAngleAt(d),e=>events.push(e.type),16);race.phase='racing';
const candidate=JSON.parse(readFileSync('docs/agent-work/track-corrections/primo-before.json','utf8')).selected;
const probe=createKartState('probe','goblin','#fff','');Object.assign(probe,{distance:candidate.s,lateral:candidate.lateral+1.5,absHeading:track.tangentAngleAt(candidate.s)});
const before={distance:candidate.s,lateral:candidate.lateral};track.physical.resolve(track,probe,before);
assert.ok(probe.lateral>candidate.lateral+1.4,'open source asphalt no longer clamps against the former ribbon');
assert.equal(track.physical.blocked(track.worldPoint(probe.distance,probe.lateral),probe.absHeading),false);
const solid=createKartState('solid','goblin','#fff','');Object.assign(solid,{distance:0,lateral:60,absHeading:track.tangentAngleAt(0)});
track.physical.resolve(track,solid,{distance:0,lateral:0});assert.ok(solid.wallContact&&solid.lateral<30,'visible barrier still stops a swept kart');
assert.ok(track.checkpoints.every(s=>!track.physical.blocked(track.worldPoint(s,0),track.tangentAngleAt(s))));
let wallFrames=0,badContacts=0,maxProjection=0;const dt=1/120;
while(race.phase!=='ended'&&race.raceTime<180){
  guidePrimoBots(track,ctx,[k]);const p=input.get(k.playerId),from={distance:k.distance,lateral:k.lateral};
  const snapshot={left:false,right:false,up:p.pressed('up'),down:p.pressed('down'),drift:p.pressed('drift'),driftReleased:p.justReleased('drift'),item:false,steer:p.axis('steer').x};
  stepKartPhysics(k,snapshot,dt,d=>track.physical.floorHalfWidth(track,d,k.lateral),d=>track.tangentAngleAt(d),false,{grip:1,speed:1,barriers:false});
  track.physical.resolve(track,k,from);if(k.wallContact)wallFrames++;
  const world=track.worldPoint(k.distance,k.lateral);if(track.physical.blocked(world,k.absHeading))badContacts++;
  maxProjection=Math.max(maxProjection,Math.abs(k.distance-from.distance));race.update(dt,[k],()=>snapshot.up);input.update();
}
assert.equal(k.lap,3,'three physical laps, no forced timeout finish');assert.ok(k.distance>=track.totalLength*3);assert.ok(badContacts<5);
const report={track:'primo',laps:k.lap,time:k.finishTime,checkpoints:track.checkpoints.length,checkpointEvents:events.filter(e=>e==='checkpoint_clean').length,wallFrames,badContacts,maxProjection,formerInvisibleBoundaryOpened:true,physicalSegments:track.physical.data.segments.length};
writeFileSync('docs/agent-work/track-corrections/primo-checks.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
