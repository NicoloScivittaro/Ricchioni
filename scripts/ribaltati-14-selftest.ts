import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {NullEngine,Scene} from '@babylonjs/core';
import {Rng} from '../shared/rng';
import {AB} from '../shared/abilityCatalog';
import {ItemManager} from '../src/minigames/kart-race/items';
import {ITEM_IDS,ITEM_POWER,kartItemWeights,pickKartItem} from '../src/minigames/kart-race/itemCatalog';
import {createKartState,type ItemId,type KartState} from '../src/minigames/kart-race/raceTypes';
import {CharacterAbilities} from '../src/minigames/kart-race/abilities';
import {applyBoost,hitKart,stepKartPhysics,respawnKart} from '../src/minigames/kart-race/kartPhysics';
import {buildTrack,type TrackSpline} from '../src/minigames/kart-race/track';
import {RainbowTrack,stepRainbowKart} from '../src/minigames/kart-race/rainbowTrack';
import {MotionBots} from '../src/minigames/bots/MotionBots';
import {InputManager} from '../src/network/InputManager';
import type {MinigameContext} from '../src/minigames/types';

const checks:string[]=[],measure:unknown[]=[],engine=new NullEngine(),coast=buildTrack(),rainbow=new RainbowTrack();
const throttle={up:true,down:false,left:false,right:false,steer:0,drift:false,driftReleased:false,item:false};
function pass(label:string){checks.push(label);console.log('PASS '+label);}
function fixture(track:TrackSpline=coast){
 const scene=new Scene(engine),ab=new CharacterAbilities(),events:unknown[][]=[];
 const karts=['goblin','buttafuori','judoka','dottore','ciro'].map((cid,i)=>Object.assign(createKartState('p'+i,cid,'#fff',''),{distance:100+i*8,speed:44,invulnTimer:0,abilityMeter:1,absHeading:track.tangentAngleAt(100+i*8)}));
 const manager=new ItemManager(scene,[],track,new Rng(14),ab,()=>{},(...args)=>events.push(args));
 const use=(id:ItemId,index=0)=>{karts[index].heldItem=id;return manager.useItem(karts[index],karts,p=>karts.findIndex(k=>k.playerId===p)+1);};
 const update=(dt:number)=>manager.update(dt,karts,()=>2,5);
 return {scene,ab,events,karts,manager,use,update,close:()=>{manager.dispose();assert.equal(scene.meshes.length,0);scene.dispose();}};
}
// Exact probabilities, not thousands of random draws.
assert.equal(ITEM_IDS.length,15);
const probability=(place:number,gap:number,ids:ItemId[])=>{const rows=kartItemWeights(place,5,gap);return rows.filter(x=>ids.includes(x.item)).reduce((a,x)=>a+x.weight,0)/rows.reduce((a,x)=>a+x.weight,0);};
const strong:ItemId[]=['super_turbo','turbo_difettoso','missile'];
for(const n of [2,3,4,5])for(const gap of [0,20]){const weights=kartItemWeights(n,n,gap);assert.ok(weights.every(x=>x.weight>0&&Number.isFinite(x.weight)));}
assert.ok(probability(5,20,strong)>probability(5,0,strong));assert.ok(probability(5,20,strong)<.4);
assert.deepEqual(kartItemWeights(1,5,0),kartItemWeights(1,5,20));
const seeded=new Rng(14);assert.ok(Array.from({length:32},()=>pickKartItem(seeded,5,5,20)).every(i=>ITEM_IDS.includes(i)));
measure.push({strongItemChance:{leader:probability(1,0,strong),lastClose:probability(5,0,strong),last20sBehind:probability(5,20,strong)}});pass('distribution: rank + real deficit, leader unchanged, no guaranteed rare item');

// Five distinct abilities: useful speed/recovery or real defensive/offensive effect, finite cooldowns.
for(const cid of ['goblin','dottore','buttafuori','judoka','ciro']){
 const a=new CharacterAbilities(),k=Object.assign(createKartState('a',cid,'#fff',''),{abilityMeter:1,speed:44,invulnTimer:0});
 if(cid==='buttafuori'){hitKart(k,1.3);a.reactToCrash(k,true,false,()=>0,()=>{});}
 assert.equal(a.onAbilityPress(k,[k],()=>{}),'ok');
 if(cid==='ciro'){assert.ok(a.tryDelayHit(k,{stun:1.4},()=>{}));assert.ok(k.boostTimer>0);}
 assert.ok(k.abilityCooldown>=20);const cd=k.abilityCooldown;assert.notEqual(a.onAbilityPress(k,[k],()=>{}),'ok');assert.equal(k.abilityCooldown,cd);
 let max=k.speed;for(let i=0;i<600;i++){a.setRaceTime(i/60);a.update(1/60,k,[k],false,false,()=>0,()=>{});stepKartPhysics(k,throttle,1/60,()=>100,()=>0,false);max=Math.max(max,k.speed);}
 assert.ok(!k.abilityActive&&!k.debtPending&&k.boostTimer===0);
 if(cid==='goblin')assert.ok(max>59&&max<60);
 if(cid==='dottore')assert.ok(max>56&&max<57);
 a.setRaceTime(40);a.update(30,k,[k],false,false,()=>0,()=>{});a.setRaceTime(60);a.update(20,k,[k],false,false,()=>0,()=>{});assert.equal(a.status(k).state,'READY');
 measure.push({cid,maxSpeed:max,metresIn10s:k.distance,cooldown:AB.kart3d[cid].cooldown});
}
pass('five abilities: distinct effects, measurable boosts, finite duration and recharge');
{
 const f=fixture(),[a,b]=f.karts;a.heldItem='scudo';f.manager.useItem(a,f.karts,()=>1);
 const h=f.manager as any;assert.equal(h.applyEffect(a,{stun:1.4}),false);assert.equal(a.stunTimer,0);assert.equal(a.shielded,false);assert.ok(a.boostTimer>0);assert.equal(a.boostPower,28);
 a.invulnTimer=0;assert.equal(h.applyEffect(a,{stun:1}),true);assert.equal(a.boostTimer,0);const speed=a.speed;assert.equal(h.applyEffect(a,{stun:1}),false);assert.equal(a.speed,speed);
 b.abilityMeter=1;b.characterId='judoka';f.ab.onAbilityPress(b,f.karts,()=>{});a.invulnTimer=0;applyBoost(a,48,3);assert.ok(f.ab.truckContact(b,a,1,()=>{}));assert.equal(a.boostTimer,0);assert.equal(a.speedCapMultiplier,.52);assert.equal(f.ab.truckContact(b,a,1,()=>{}),false);
 f.close();pass('shield perfect counter, attack breaks boost, truck tangible and anti-chain guard');
}
for(const item of ITEM_IDS){const f=fixture();if(item==='furto')f.karts[1].heldItem='turbo';assert.equal(f.use(item),true,`valid use ${item}`);if(item==='furto')assert.equal(f.karts[0].heldItem,null);f.close();}
pass('all fifteen catalog items activate in their intended valid situation');
{
 const f=fixture(),[a,b]=f.karts;b.heldItem='super_turbo';assert.ok(f.use('furto'));assert.equal(a.heldItem,null);f.update(.3);assert.equal(b.heldItem,'super_turbo');f.update(.41);assert.equal(a.heldItem,'super_turbo');assert.equal(b.heldItem,null);assert.ok(f.events.some(e=>e[4]===true));f.close();
 const g=fixture();g.karts[1].heldItem='scudo';g.use('furto');g.manager.useItem(g.karts[1],g.karts,()=>2);g.update(.71);assert.equal(g.karts[0].heldItem,null);assert.equal(g.karts[1].heldItem,null);assert.equal(g.karts[1].shielded,true);g.close();
 const h=fixture();h.karts[1].heldItem='turbo';h.karts[1].shielded=true;h.use('furto');h.update(.71);assert.equal(h.karts[0].heldItem,null);assert.equal(h.karts[1].heldItem,'turbo');assert.equal(h.karts[1].shielded,false);h.close();
 pass('theft: visible delay, atomic transfer, target can use or shield item, no duplication');
}
{
 const f=fixture(),[a,b]=f.karts;f.karts.slice(2).forEach(k=>k.distance=500);b.distance=a.distance+25;f.use('missile');f.update(.4);assert.equal(b.stunTimer,0);f.update(.41);assert.equal(b.stunTimer,0);
 for(let i=0;i<90&&b.stunTimer===0;i++)f.update(1/60);assert.ok(b.stunTimer>0);assert.equal((f.manager as any).projectiles.length,0);f.close();
 const g=fixture();g.karts.slice(2).forEach(k=>k.distance=500);g.karts[1].distance=125;g.karts[1].shielded=true;g.use('missile');for(let i=0;i<120;i++)g.update(1/60);assert.equal(g.karts[1].stunTimer,0);assert.equal(g.karts[1].shielded,false);g.close();
 const h=fixture();h.karts.slice(1).forEach(k=>k.distance=500);assert.equal(h.use('missile'),false);assert.equal(h.karts[0].heldItem,'missile');assert.equal(h.use('disturbo'),false);assert.equal(h.karts[0].heldItem,'disturbo');h.close();
 pass('missile: warning precedes finite homing, shield counters, out-of-range attacks retain inventory');
}
{
 const f=fixture(),[a,b]=f.karts;f.use('mollone');let landed=false;for(let i=0;i<100;i++){stepKartPhysics(a,throttle,1/60,()=>100,()=>0,false);if(a.jumpHeight===0&&a.boostTimer>0)landed=true;}assert.ok(landed);assert.equal(a.springLandingBoost,false);
 f.use('raffica');const trap=(f.manager as any).traps.at(-1);b.distance=trap.distance;b.lateral=trap.lateral;b.invulnTimer=0;b.shielded=true;f.update(.016);assert.equal(b.slipVelocity,0);f.update(.2);assert.equal(b.slipVelocity,0);assert.equal(b.shielded,false);
 f.close();pass('spring grants landing boost; wind respects a shield throughout the same crossing');
}
// Actual gaps: every special power and both new items preserve position/checkpoints at activation.
for(const gap of rainbow.gaps){
 for(const cid of ['goblin','dottore','judoka','buttafuori','ciro']){
  const a=new CharacterAbilities(),k=Object.assign(createKartState('air',cid,'#fff',''),{distance:gap.launch+2,flight:'GLIDE' as const,glideStart:gap.launch,glideEnd:gap.landing,jumpHeight:rainbow.flightHeightAt(gap.launch+2),speed:44,abilityMeter:1,invulnTimer:0,recoverWindow:cid==='buttafuori'?2:0,lastValidCheckpointS:gap.launch-12});
  const d=k.distance,cp=k.lastValidCheckpointS,h=k.jumpHeight;assert.equal(a.onAbilityPress(k,[k],()=>{},s=>rainbow.tangentAngleAt(s)),'ok');assert.equal(k.distance,d);assert.equal(k.jumpHeight,h);assert.equal(k.lastValidCheckpointS,cp);
  let land=0;for(let i=0;i<1200&&k.flight==='GLIDE';i++){a.update(1/60,k,[k],false,false,s=>rainbow.tangentAngleAt(s),()=>{});stepRainbowKart(k,throttle,1/60,rainbow,false,e=>{if(e==='land')land++;});}assert.equal(land,1);assert.equal(k.flight,'DRIVE');
 }
 const f=fixture(rainbow),[a,b]=f.karts;for(const [k,offset] of [[a,3],[b,10]] as [KartState,number][]){Object.assign(k,{flight:'GLIDE',distance:gap.launch+offset,glideStart:gap.launch,glideEnd:gap.landing,jumpHeight:rainbow.flightHeightAt(gap.launch+offset)});}
 f.karts.slice(2).forEach(k=>k.distance=gap.landing+100);b.heldItem='turbo';assert.ok(f.use('furto'));f.update(.71);assert.equal(a.heldItem,'turbo');assert.equal(b.heldItem,null);
 assert.equal(f.use('olio'),false);assert.equal(a.heldItem,'olio');assert.equal(f.use('mollone'),false);assert.equal(a.heldItem,'mollone');
 assert.ok(f.use('missile'));const old=a.distance;for(let i=0;i<120;i++)f.update(1/60);assert.equal(a.distance,old);assert.ok(b.stunTimer>0&&b.stunTimer<=.4&&b.speed>=32);assert.ok(b.jumpHeight>0);f.close();
}
pass('both real glides: five powers land, inventory retained when invalid, attacks bounded, no checkpoint/height teleport');

// One short multiplayer simulation per track, through ordinary bot input and real physics.
for(const track of [coast,rainbow]){
 const f=fixture(track),input=new InputManager(),ctx={input,players:f.karts.map(k=>({id:k.playerId,bot:true}))} as unknown as MinigameContext;
 const bots=new MotionBots(ctx,14);let uses=0,landings=0;
 const start:ItemId[]=['super_turbo','scudo','missile','furto','paraurti'];f.karts.forEach((k,i)=>k.heldItem=start[i]);
 for(let i=0;i<60*15;i++){
  f.ab.setRaceTime(i/60);bots.kart(1/60,f.karts,track);
  for(const k of f.karts){const pin=input.get(k.playerId);if(pin.justPressed('item')&&f.manager.useItem(k,f.karts,()=>2))uses++;
   if(pin.justPressed('ability'))f.ab.onAbilityPress(k,f.karts,()=>{},d=>track.tangentAngleAt(d));
   const commands={...throttle,up:pin.pressed('up'),down:pin.pressed('down'),steer:pin.axis('steer').x,drift:pin.pressed('drift'),driftReleased:pin.justReleased('drift')};
   if(track===rainbow)stepRainbowKart(k,commands,1/60,rainbow,false,e=>{if(e==='land')landings++;});else stepKartPhysics(k,commands,1/60,d=>track.widthAt(d)/2,d=>track.tangentAngleAt(d),false);
   if(k.respawnTimer<=0&&k.flight==='FALL'&&k.flightTime>2)respawnKart(k,d=>track.tangentAngleAt(d));
   f.ab.update(1/60,k,f.karts,false,false,d=>track.tangentAngleAt(d),()=>{});
   assert.ok(Number.isFinite(k.distance+k.speed+k.lateral));assert.ok(k.boostPower<=56&&k.boostTimer<=4.2);assert.ok(k.abilityCooldown>=0);
  }
  f.update(1/60);input.update();
 }
 assert.ok(uses>0);if(track===rainbow)assert.ok(landings>0);
 measure.push({simulation:track===rainbow?'arcobaleno':'litorale',seconds:15,players:5,itemUses:uses,landings});f.close();
}
pass('two brief 15s / five-player simulations: real tracks, bot commands, finite effects and cleanup');
const extreme=createKartState('x',null,'#fff','');applyBoost(extreme,999,999);assert.equal(extreme.boostPower,56);assert.equal(extreme.boostTimer,4.2);pass('boost stacking has explicit power/duration limits');
engine.dispose();writeFileSync('docs/agent-work/ribaltati-1-4/checks.json',JSON.stringify({checks,measure},null,2));console.log('ESSENTIAL CHECKS COMPLETE');
