import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {createKartState} from '../src/minigames/kart-race/raceTypes';
import {CharacterAbilities} from '../src/minigames/kart-race/abilities';
import {stepKartPhysics,hitKart,applyBoost} from '../src/minigames/kart-race/kartPhysics';
import {RainbowTrack,stepRainbowKart} from '../src/minigames/kart-race/rainbowTrack';
import {predictGlideLanding} from '../src/minigames/kart-race/glideDynamics';
import {resolveKartContact} from '../src/minigames/kart-race/kartCollisions';
import {RaceManager} from '../src/minigames/kart-race/race';
import {AB} from '../shared/abilityCatalog';
const checks:string[]=[],measure:any[]=[];const ok=(v:unknown,m:string)=>{assert.ok(v,m);checks.push(m);};
const input={up:true,down:false,left:false,right:false,steer:0,drift:false,driftReleased:false,item:false},track=new RainbowTrack();
for(const hz of [30,60,120])for(const cid of ['goblin','dottore','judoka','buttafuori','ciro']){
 const a=new CharacterAbilities(),k=createKartState('p',cid,'#fff','');Object.assign(k,{abilityMeter:1,speed:44,invulnTimer:0});
 if(cid==='buttafuori'){hitKart(k,1.3);a.reactToCrash(k,true,false,()=>0,()=>{});}
 if(cid==='ciro'){a.onAbilityPress(k,[k],()=>{});a.tryDelayHit(k,{stun:1.3},()=>{});}
 else ok(a.onAbilityPress(k,[k],()=>{})==='ok',`${cid} activation ${hz}`);
 const cd=k.abilityCooldown;ok(cd>=18,`${cid} finite cooldown ${hz}`);
 const before=k.abilityCharges;for(let i=0;i<20;i++)a.onAbilityPress(k,[k],()=>{});ok(k.abilityCharges===before,`${cid} no press stacking ${hz}`);
 for(let i=0;i<hz*30;i++){a.setRaceTime(i/hz);a.update(1/hz,k,[k],false,false,()=>0,()=>{});stepKartPhysics(k,input,1/hz,()=>100,()=>0,false,{grip:1,speed:1,barriers:false});}
 ok(!k.abilityActive&&!k.truckMode&&!k.lightMode&&k.abilitySpeedFactor===1,`${cid} all timed effects end ${hz}`);
 ok(a.status(k).state==='READY',`${cid} can recharge during ordinary driving ${hz}`);
}
// Every character on both real gaps, at each frame rate; no changes to checkpoint or progress from activation.
for(const hz of [30,60,120])for(const gap of track.gaps)for(const cid of ['goblin','dottore','judoka','buttafuori','ciro']){
 const a=new CharacterAbilities(),k=createKartState('p',cid,'#fff','');Object.assign(k,{distance:gap.launch+2,glideStart:gap.launch,glideEnd:gap.landing,flight:'GLIDE',speed:44,abilityMeter:1,invulnTimer:0,lastValidCheckpointS:gap.launch-12,jumpHeight:track.flightHeightAt(gap.launch+2)});
 const d=k.distance,cp=k.lastValidCheckpointS,h=k.jumpHeight;
 if(cid==='buttafuori')Object.assign(k,{stunTimer:.3,slipVelocity:2,lateral:3});
 const result=a.onAbilityPress(k,[k],()=>{},d=>track.tangentAngleAt(d));
 if(cid==='ciro')a.tryDelayHit(k,{bounce:5,stun:.5},()=>{});
 ok(result==='ok'&&k.distance===d&&k.lastValidCheckpointS===cp&&k.jumpHeight===h,`${cid} no teleport/height reset on ${gap.name} ${hz}`);
 let land=0;for(let i=0;i<hz*20&&k.flight==='GLIDE';i++){a.setRaceTime(i/hz);a.update(1/hz,k,[k],false,false,d=>track.tangentAngleAt(d),()=>{});stepRainbowKart(k,input,1/hz,track,false,e=>{if(e==='land')land++;});}
 ok(land===1&&k.flight==='DRIVE',`${cid} finite flight and correct landing ${gap.name} ${hz}`);
}
{
 const a=new CharacterAbilities(),g=createKartState('g','goblin','#fff','');g.abilityMeter=1;a.onAbilityPress(g,[g],()=>{});const power=g.boostPower,time=g.boostTimer;
 applyBoost(g,26,1.5);ok(g.boostPower===power&&g.boostTimer===time,'drift and special turbo use max, never additive stacking');applyBoost(g,38,2.4);ok(g.boostPower===38,'stronger inventory turbo remains useful');
 const d=createKartState('d','dottore','#fff','');d.abilityMeter=1;a.onAbilityPress(d,[d],()=>{});d.drifting=true;d.driftCharge=0;d.speed=44;stepKartPhysics(d,{...input,drift:true,steer:.1},.1,()=>100,()=>0,false);ok(d.driftCharge>=.19,'Dottore really doubles drift charge');
}
{
 const a=new CharacterAbilities(),truck=createKartState('t','judoka','#fff',''),v=createKartState('v','goblin','#fff','');Object.assign(truck,{abilityMeter:1,invulnTimer:0});Object.assign(v,{speed:62,invulnTimer:0});a.onAbilityPress(truck,[truck,v],()=>{});
 const before=v.lateral;ok(a.truckContact(truck,v,1,()=>{}),'truck hits reachable rival');for(let i=0;i<120;i++){a.setRaceTime(i/120);a.truckContact(truck,v,1,()=>{});}
 ok(v.lateral===before&&v.slipVelocity===AB.kart3d.judoka.p.shove,'one impulse per pair; no frame-by-frame teleport');
 let loss=0;const plain=createKartState('p',null,'#fff','');plain.speed=62;
 for(let i=0;i<600;i++){a.update(1/60,v,[v],false,false,()=>0,()=>{});stepKartPhysics(v,input,1/60,()=>100,()=>0,false,{grip:1,speed:1,barriers:false});stepKartPhysics(plain,input,1/60,()=>100,()=>0,false,{grip:1,speed:1,barriers:false});loss=plain.distance-v.distance;}
 ok(loss>15&&loss<60,'offensive slowdown produces a finite meaningful pass opportunity');measure.push({kind:'truck',lostMetres:loss,shove:AB.kart3d.judoka.p.shove});
 truck.invulnTimer=0;let blocks=0;ok(a.blockHit(truck,()=>blocks++),'truck absorbs one offensive object');truck.invulnTimer=0;ok(!a.blockHit(truck,()=>blocks++),'truck armor is not permanent');ok(blocks===1,'blocked hit feedback emitted once');
 const frame=(x:number,z:number)=>({x,y:0,z,trackAngle:0});truck.speed=62;v.speed=30;truck.heading=v.heading=0;const speed=truck.speed;resolveKartContact(truck,v,frame(0,0),frame(0,2.5));ok(truck.speed===speed,'truck keeps momentum in actual collision solver');
}
{
 const a=new CharacterAbilities(),k=createKartState('b','buttafuori','#fff','');Object.assign(k,{distance:400,lastValidCheckpointS:200,stunTimer:1.3,invulnTimer:0,speed:20});a.reactToCrash(k,true,false,()=>0,()=>{});a.onAbilityPress(k,[k],()=>{});ok(k.distance===400&&k.lastValidCheckpointS===200&&k.stunTimer===0,'road recovery stays at real location');
 const fall=createKartState('f','buttafuori','#fff','');Object.assign(fall,{flight:'FALL',distance:400,lastValidCheckpointS:200,respawnTimer:.5,recoverWindow:1});a.onAbilityPress(fall,[fall],()=>{});ok(fall.distance===200&&fall.flight==='DRIVE','fall recovery uses only last valid checkpoint');
}
{
 const a=new CharacterAbilities(),k=createKartState('c','ciro','#fff','');Object.assign(k,{speed:62,invulnTimer:0});hitKart(k,1.3);a.noteHit(k,{stun:1.3,bounce:5},62);a.onAbilityPress(k,[k],()=>{});ok(k.speed===62&&k.debtPending&&k.stunTimer===0,'Ciro recovers actual pre-hit speed');
 a.update(8.01,k,[k],false,false,()=>0,()=>{});ok(!k.debtPending&&k.stunTimer<=.781&&k.stunTimer>.7,'debt still paid at reduced finite intensity');
 k.invulnTimer=0;hitKart(k,1);const s=k.speed;ok(!hitKart(k,1)&&k.speed===s,'post-hit protection prevents repeated multiplicative slowing');
}
for(const boost of [false,true])for(const gap of track.gaps){
 const k=createKartState('p','goblin','#fff','');Object.assign(k,{distance:gap.launch+3,flight:'GLIDE',glideStart:gap.launch,glideEnd:gap.landing,heading:.08,glideYawVelocity:.1,lateral:0,speed:44});if(boost)applyBoost(k,32,2.2);
 const predicted=predictGlideLanding(k);while(k.flight==='GLIDE')stepRainbowKart(k,input,1/120,track,false,()=>{});
 const error=Math.abs(predicted-k.lateral);console.log({prediction:gap.name,boost,predicted,actual:k.lateral,error});ok(error<.55,`prediction includes ${boost?'boost':'cruise'} on ${gap.name}`);measure.push({gap:gap.name,boost,predicted,actual:k.lateral,error});
}
{
 const k=createKartState('p','goblin','#fff','');Object.assign(k,{flight:'FALL',distance:track.totalLength*4,lastValidCheckpointS:10,nextCheckpoint:1});const r=new RaceManager(track.checkpoints,track.totalLength,230,d=>track.tangentAngleAt(d),()=>{});r.phase='racing';r.update(.01,[k],()=>false);ok(k.lap===0&&k.lastValidCheckpointS===10,'fall cannot advance laps/checkpoints');
}
{
 const a=new CharacterAbilities(),batch=['goblin','dottore','judoka','buttafuori','ciro'].map((c,i)=>createKartState('s'+i,c,'#fff',''));
 for(const k of batch){k.abilityMeter=1;k.recoverWindow=k.characterId==='buttafuori'?2:0;}
 const activations=batch.map(k=>a.onAbilityPress(k,batch,()=>{}));a.tryDelayHit(batch[4],{disturb:1},()=>{});
 ok(activations.every(x=>x==='ok')&&batch.every(k=>k.abilityCooldown>=18),'five simultaneous activations keep independent cooldowns');
 for(let i=0;i<1800;i++)for(const k of batch){a.setRaceTime(i/60);a.update(1/60,k,batch,false,false,()=>0,()=>{});stepKartPhysics(k,input,1/60,()=>100,()=>0,false,{grip:1,speed:1,barriers:false});}
 ok(batch.every(k=>Number.isFinite(k.distance+k.speed+k.lateral)&&!k.abilityActive&&!k.debtPending),'simultaneous effects end without nonfinite speed or debt');
}
writeFileSync('docs/agent-work/rainbow-1-3/after/ability-checks.json',JSON.stringify({checks,measure,passed:checks.length},null,2));console.log(`PASS ${checks.length} ability and safety checks.`);
