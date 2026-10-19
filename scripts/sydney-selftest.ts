import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {NullEngine,Scene} from '@babylonjs/core';
import {SydneyTrack} from '../src/minigames/kart-race/sydneyTrack';
import {RainbowTrack,stepRainbowKart} from '../src/minigames/kart-race/rainbowTrack';
import {buildTrack} from '../src/minigames/kart-race/track';
import {createKartState} from '../src/minigames/kart-race/raceTypes';
import {respawnKart} from '../src/minigames/kart-race/kartPhysics';
import {RaceManager} from '../src/minigames/kart-race/race';
import {CharacterAbilities} from '../src/minigames/kart-race/abilities';
import {ItemManager} from '../src/minigames/kart-race/items';
import {ITEM_IDS} from '../src/minigames/kart-race/itemCatalog';
import {resolveKartContact} from '../src/minigames/kart-race/kartCollisions';
import {InputManager} from '../src/network/InputManager';
import {MotionBots} from '../src/minigames/bots/MotionBots';
import type {MinigameContext} from '../src/minigames/types';
import {Rng} from '../shared/rng';
import {normalizeKartTrack,kartTrackName} from '../shared/kartTracks';
import {mapsFor} from '../shared/minigameMaps';

const out='docs/agent-work/sydney-sprint',track=new SydneyTrack(),engine=new NullEngine(),scene=new Scene(engine),input=new InputManager();
const characters=['goblin','buttafuori','judoka','dottore','ciro'];
const karts=characters.map((cid,i)=>Object.assign(createKartState('s'+i,cid,'#fff',''),{distance:-1-Math.floor(i/2)*3.6,lateral:i%2?-2.3:2.3,absHeading:track.tangentAngleAt(-1-Math.floor(i/2)*3.6)}));
const ctx={input,players:karts.map(k=>({id:k.playerId,bot:true}))} as unknown as MinigameContext,bots=new MotionBots(ctx,319),abilities=new CharacterAbilities();
const items=new ItemManager(scene,track.boxes,track,new Rng(319),abilities,()=>{}),events:string[]=[],race=new RaceManager(track.checkpoints,track.totalLength,230,d=>track.tangentAngleAt(d),ev=>events.push(ev.type));
let launches=0,landings=0,falls=0,itemUses=0,abilityUses=0,wallFrames=0;
assert.deepEqual(mapsFor('kart3d').map(m=>m.id),['litorale','arcobaleno','sydney']);
for(const id of ['litorale','arcobaleno','sydney']){assert.equal(normalizeKartTrack(id),id);assert.ok(kartTrackName(normalizeKartTrack(id)));}
assert.ok(buildTrack().totalLength>1000);assert.ok(new RainbowTrack().totalLength>2000);
assert.equal(ITEM_IDS.length,15);assert.ok(track.boxes.length>=8);
assert.ok(track.checkpoints.every(s=>track.hasRoadAt(s)));
for(const s of track.checkpoints){const k=createKartState('r','goblin','#fff','');k.lastValidCheckpointS=s;k.distance=s+25;k.lateral=40;k.absHeading=10;respawnKart(k,d=>track.tangentAngleAt(d));assert.equal(k.distance,s);assert.equal(k.lateral,0);assert.equal(k.absHeading,track.tangentAngleAt(s));}
// Human input still changes trajectory; a large outward command is stopped by the visible race fence.
const k=createKartState('human','goblin','#fff','');k.distance=60;k.speed=44;k.absHeading=track.tangentAngleAt(k.distance);
const command={left:false,right:false,up:true,down:false,drift:false,item:false,steer:.6,driftReleased:false};
for(let i=0;i<40;i++)stepRainbowKart(k,command,1/120,track,false,()=>{},true);
assert.ok(Math.abs(k.lateral)>.5);
for(let i=0;i<240;i++)stepRainbowKart(k,command,1/120,track,false,()=>{},true);
assert.ok(Math.abs(k.lateral)<=track.widthAt(k.distance)/2+.55);
// All held items use the unchanged manager on Sydney. Theft gets an actual inventory target.
for(const item of ITEM_IDS){const a=createKartState('a','goblin','#fff',''),b=createKartState('b','ciro','#fff','');a.distance=30;b.distance=38;a.speed=b.speed=40;a.heldItem=item;b.heldItem='turbo';assert.equal(items.useItem(a,[a,b],()=>2),true,`item ${item}`);items.update(5,[a,b],()=>2,2);}
// One complete five-bot race using normal inputs, timers, CP/laps, items and powers.
const dt=1/120;
for(let frame=0;frame<234*120&&race.phase!=='ended';frame++){
 race.update(dt,karts,id=>input.get(id).pressed('up'));
 if(race.phase==='racing'){
  abilities.setRaceTime(race.raceTime);bots.kart(dt,karts,track);
  for(const k of karts){if(k.finished)continue;const pin=input.get(k.playerId);
   if(pin.justPressed('item')&&k.heldItem&&items.useItem(k,karts,id=>race.rankOf(karts,id)))itemUses++;
   if(pin.justPressed('ability')&&abilities.onAbilityPress(k,karts,()=>{},d=>track.tangentAngleAt(d))==='ok')abilityUses++;
   const stunned=k.stunTimer>0,respawning=k.respawnTimer>0;
   stepRainbowKart(k,{left:pin.pressed('left'),right:pin.pressed('right'),up:pin.pressed('up'),down:pin.pressed('down'),drift:pin.pressed('drift'),item:false,steer:pin.axis('steer').x,driftReleased:pin.justReleased('drift')},dt,track,false,event=>{if(event==='launch')launches++;if(event==='land')landings++;if(event==='fall')falls++;},true);
   abilities.update(dt,k,karts,!stunned&&k.stunTimer>0,!respawning&&k.respawnTimer>0,d=>track.tangentAngleAt(d),()=>{});
   if(k.wallContact)wallFrames++;assert.ok(Number.isFinite(k.distance+k.lateral+k.speed));
  }
  const frame=(k:typeof karts[number])=>{const p=track.worldPoint(k.distance,k.lateral,k.jumpHeight);return {x:p.x,y:p.y,z:p.z,trackAngle:track.tangentAngleAt(k.distance)};};
  for(let i=0;i<karts.length;i++)for(let j=i+1;j<karts.length;j++)resolveKartContact(karts[i],karts[j],frame(karts[i]),frame(karts[j]));
  items.update(dt,karts,id=>race.rankOf(karts,id),5);
 }
 input.update();
}
const report={length:track.totalLength,widthMin:Math.min(...Array.from({length:600},(_,i)=>track.widthAt(i*track.totalLength/600))),gap:track.gaps,checkpoints:track.checkpoints,boxes:track.boxes.length,raceTime:race.raceTime,launches,landings,falls,itemUses,abilityUses,wallFrames,karts:karts.map(k=>({id:k.playerId,lap:k.lap,finish:k.finishTime,distance:k.distance,placement:k.placement})),checks:['three-track selection','15 items valid on Sydney','visible corridor collision','human steering changes trajectory','checkpoint and heading respawn','one full five-bot race']};
writeFileSync(out+'/checks.json',JSON.stringify(report,null,2));
const probes=[];for(let s=0;s<track.totalLength;s+=2){probes.push({s,p:track.positionAt(s).asArray(),r:track.rightAt(s).asArray(),width:track.widthAt(s),air:!track.hasRoadAt(s)});}
writeFileSync(out+'/route-probes.json',JSON.stringify(probes));
console.log(JSON.stringify(report));
assert.ok(karts.every(k=>k.lap===3),'all five bots must really finish all three laps, not time out');assert.ok(landings>=15);assert.ok(itemUses>5);assert.ok(abilityUses>0);items.dispose();scene.dispose();engine.dispose();
