import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {RainbowTrack,stepRainbowKart} from '../src/minigames/kart-race/rainbowTrack';
import {createKartState} from '../src/minigames/kart-race/raceTypes';
import {RaceManager} from '../src/minigames/kart-race/race';
import {MotionBots} from '../src/minigames/bots/MotionBots';
import {InputManager} from '../src/network/InputManager';
import {Rng} from '../shared/rng';
import type {MinigameContext} from '../src/minigames/types';
import {resolveKartContact} from '../src/minigames/kart-race/kartCollisions';
import {hitKart,respawnKart} from '../src/minigames/kart-race/kartPhysics';
const track=new RainbowTrack(),L=track.totalLength,angle=(s:number)=>track.tangentAngleAt(s),races:any[]=[];
const neutral={up:true,down:false,left:false,right:false,steer:0,drift:false,driftReleased:false,item:false};
const kart=(id='a')=>createKartState(id,'goblin','#fff','a');
assert.ok(L>2000&&L<2300);assert.equal(track.gaps.length,2);
for(const cp of track.checkpoints)assert.ok(track.hasRoadAt(cp));
for(const gap of track.gaps){
 const k=kart();Object.assign(k,{distance:gap.launch-.05,speed:42,absHeading:angle(gap.launch),drifting:true,driftCharge:2});let launches=0,land=0;
 stepRainbowKart(k,neutral,1/120,track,false,e=>{if(e==='launch')launches++;});assert.equal(k.flight,'GLIDE');assert.equal(k.drifting,false);assert.equal(k.driftCharge,0);assert.equal(launches,1);
 const control={...k};
 for(let i=0;i<24;i++)stepRainbowKart(k,{...neutral,steer:.65,drift:true},1/120,track,false,()=>{});
 for(let i=0;i<24;i++)stepRainbowKart(control,{...neutral,steer:-.65},1/120,track,false,()=>{});assert.ok(k.lateral>control.lateral+.1,'actual lateral control');assert.ok(!k.drifting,'no airborne drift');assert.ok(k.jumpHeight>0);
 // Repeat using the actual bot controller to land, also after a mid-air stun.
 Object.assign(k,{lateral:0,absHeading:angle(k.distance),heading:0});hitKart(k,.4);
 const input=new InputManager(),ctx={players:[{id:k.playerId,bot:true}],input,modifier:null} as unknown as MinigameContext,bots=new MotionBots(ctx);
 for(let i=0;i<2400&&k.flight==='GLIDE';i++){
  bots.kart(1/120,[k],track);const p=input.get(k.playerId);stepRainbowKart(k,{...neutral,up:p.pressed('up'),down:p.pressed('down'),steer:p.axis('steer').x},1/120,track,false,e=>{if(e==='land')land++;});input.update();
 }
 if(k.flight!=='DRIVE')console.log('BOT LAND FAILURE',JSON.stringify({gap,k}));assert.equal(k.flight,'DRIVE','bot lands after item hit');assert.equal(land,1);assert.equal(k.jumpHeight,0);
 const miss=kart();Object.assign(miss,{distance:gap.landing-.05,speed:42,absHeading:angle(gap.landing),flight:'GLIDE',glideStart:gap.launch,glideEnd:gap.landing,lateral:12,lastValidCheckpointS:gap.launch-12});
 stepRainbowKart(miss,neutral,1/120,track,false,()=>{});assert.equal(miss.flight,'FALL');const d=miss.distance;
 for(let i=0;i<120;i++)stepRainbowKart(miss,neutral,1/120,track,false,()=>{});
 assert.ok(miss.jumpHeight<0&&miss.respawnTimer>0,'visible fall then penalty');assert.equal(miss.distance,d,'no false progress while falling');const recovery=new RaceManager(track.checkpoints,L,230,angle,()=>{});recovery.phase='racing';for(let i=0;i<140&&miss.flight==='FALL';i++){recovery.update(1/120,[miss],()=>false);if(miss.flight==='FALL')stepRainbowKart(miss,neutral,1/120,track,false,()=>{});}assert.equal(miss.flight,'DRIVE');assert.equal(miss.distance,gap.launch-12);
}
for(const n of [2,3,4,5])for(const seed of [11,32]){
 const input=new InputManager(),players=Array.from({length:n},(_,i)=>({id:'bot'+i,bot:true})),ctx={players,input,modifier:null,rng:new Rng(seed)} as unknown as MinigameContext,bots=new MotionBots(ctx,seed);
 const ks=players.map((p,i)=>Object.assign(kart(p.id),{distance:-1-Math.floor(i/2)*3.6,lateral:(i%2?2.3:-2.3)+(ctx.rng.next()-.5)*.5,absHeading:angle(-1-Math.floor(i/2)*3.6)}));
 const race=new RaceManager(track.checkpoints,L,230,angle,()=>{});let launches=0,landings=0,falls=0,frames=0;
 while(race.phase!=='ended'&&frames++<240*120){
  race.update(1/120,ks,()=>false);if(race.phase!=='racing')continue;bots.kart(1/120,ks,track);
  for(const k of ks){if(k.finished)continue;const p=input.get(k.playerId);stepRainbowKart(k,{...neutral,up:p.pressed('up'),down:p.pressed('down'),drift:p.pressed('drift'),driftReleased:p.justReleased('drift'),steer:p.axis('steer').x},1/120,track,false,e=>{if(e==='launch')launches++;if(e==='land')landings++;if(e==='fall')falls++;});assert.ok(Number.isFinite(k.distance+k.lateral+k.jumpHeight));}
  for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){if(ks[i].flight==='FALL'||ks[j].flight==='FALL')continue;const frame=(k:typeof ks[0])=>{const p=track.worldPoint(k.distance,k.lateral);return {x:p.x,y:p.y+k.jumpHeight,z:p.z,trackAngle:angle(k.distance)};};resolveKartContact(ks[i],ks[j],frame(ks[i]),frame(ks[j]));}
  input.update();
 }
 const row={n,seed,time:race.raceTime,completed:ks.filter(k=>k.lap===3).length,launches,landings,falls,progress:ks.map(k=>({lap:k.lap,distance:k.distance,flight:k.flight}))};console.log(JSON.stringify(row));races.push(row);
 assert.ok(ks.every(k=>k.lap===3),'all bots complete three laps before cap/grace');assert.ok(landings>=n*6);assert.ok(race.raceTime<230);
}
writeFileSync('docs/agent-work/glide-polish/physics-races.json',JSON.stringify({length:L,gaps:track.gaps,checkpoints:track.checkpoints,races},null,2));
console.log('PASS: both launches, real steering, no drift, item stun, bot landing, missed landing/fall/respawn and eight complete 2–5 kart races.');
