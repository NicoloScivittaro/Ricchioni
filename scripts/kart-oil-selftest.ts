import assert from 'node:assert/strict';
import { createKartState } from '../src/minigames/kart-race/raceTypes';
import { stepKartPhysics } from '../src/minigames/kart-race/kartPhysics';
import { crossesSurface } from '../src/minigames/kart-race/itemSurface';
import { CharacterAbilities } from '../src/minigames/kart-race/abilities';
const input = { left:false,right:false,up:true,down:false,drift:false,item:false,steer:0,driftReleased:false };
for (const fps of [30,60,120]) {
  const make = (oil:number) => Object.assign(createKartState('a',null,'#fff',''), {distance:100,speed:44,oilTimer:oil,invulnTimer:0});
  const straight=make(1.6); for(let i=0;i<fps;i++) stepKartPhysics(straight,input,1/fps,()=>100,()=>0,false);
  assert.equal(straight.speed,44); assert.equal(straight.stunTimer,0); assert.equal(straight.lateral,0);
  const dry=make(0),wet=make(1.6);
  for(let i=0;i<fps*.3;i++){ for(const k of [dry,wet]) stepKartPhysics(k,{...input,steer:.6},1/fps,()=>100,()=>0,false); }
  assert.ok(Math.abs(wet.slipVelocity)>2); assert.ok(wet.lateral<dry.lateral); assert.equal(wet.speed,44);
  for(let i=0;i<fps*4;i++) stepKartPhysics(wet,input,1/fps,()=>100,()=>0,false);
  assert.equal(wet.oilTimer,0); assert.ok(Math.abs(wet.slipVelocity)<.01); assert.ok(Number.isFinite(wet.distance));
}
assert.ok(crossesSurface({distance:0,lateral:0},{distance:10,lateral:0},5,0,3.8,2.7,100));
assert.ok(crossesSurface({distance:98,lateral:0},{distance:102,lateral:0},0,0,3.8,2.7,100));
assert.ok(!crossesSurface({distance:0,lateral:3},{distance:10,lateral:3},5,0,3.8,2.7,100));
const c=Object.assign(createKartState('c','ciro','#fff',''),{invulnTimer:0}),ab=new CharacterAbilities();
ab.setRaceTime(1); assert.equal(ab.onAbilityPress(c,[c],()=>{},()=>0),'ok');
assert.ok(ab.tryDelayHit(c,{oil:1.6},()=>{})); assert.equal(c.oilTimer,0);
ab.update(5,c,[c],false,false,()=>0,()=>{}); assert.equal(c.oilTimer,1.6);
console.log('PASS olio: 30/60/120 FPS, nessuna frenata/stun, inerzia in sterzata, recupero, sweep e cambio giro, bordo evitabile, debito Ciro.');
