import assert from 'node:assert/strict';
import { resolveKartContact } from '../src/minigames/kart-race/kartCollisions';
import { createKartState } from '../src/minigames/kart-race/raceTypes';
import { stepKartPhysics,respawnKart } from '../src/minigames/kart-race/kartPhysics';
import { CharacterAbilities } from '../src/minigames/kart-race/abilities';
const kart=(id:string,d=100,l=0,s=44)=>Object.assign(createKartState(id,null,'#fff',''),{distance:d,lateral:l,speed:s,invulnTimer:0});
const frame=(k:ReturnType<typeof kart>)=>({x:k.lateral,y:0,z:k.distance,trackAngle:0});
const contact=(a:ReturnType<typeof kart>,b:ReturnType<typeof kart>)=>resolveKartContact(a,b,frame(a),frame(b));
{
 const a=kart('a'),b=kart('b',100,3);
 for(let i=0;i<120;i++)assert.equal(contact(a,b),null);
 assert.equal(a.speed,44);assert.equal(b.speed,44);
 console.log('PASS vicinanza 3 m: zero contatti/penalità, mentre il vecchio volume largo 3,4 m la considerava collisione');
}
{
 const a=kart('a'),b=kart('b',100,1.98);
 assert.ok(contact(a,b));
 for(let i=0;i<120;i++)contact(a,b);
 assert.equal(a.speed,44);assert.equal(b.speed,44);assert.ok(b.lateral-a.lateral>=2);
 console.log('PASS contatto leggero a velocità uguale: separazione, nessuna frenata per frame');
}
{
 const a=kart('a'),b=kart('b',102.7,0,25);
 const hit=contact(a,b)!;assert.ok(hit.closingSpeed>18);assert.ok(b.speed>25&&a.speed<44);assert.ok(a.speed>25);
 assert.ok(Math.abs(a.speed+b.speed-69)<.001);
 console.log('PASS tamponamento: trasferimento di impulso alla vettura davanti, nessun arresto');
}
{
 const a=kart('a'),b=kart('b',100,1.95);a.heading=.2;b.heading=-.2;
 assert.ok(contact(a,b));assert.ok(Math.abs(a.slipVelocity)+Math.abs(b.slipVelocity)>0);assert.ok(a.speed>30&&b.speed>30);
 assert.ok(Math.abs(a.collisionYawVelocity)+Math.abs(b.collisionYawVelocity)>0);
 console.log('PASS urto laterale: scivolata/imbardata determinate da direzione e velocità');
}
{
 const a=kart('a',100,0,70),b=kart('b',102.6,0,0);b.characterId='buttafuori';b.abilityCharges=1;
 assert.ok(contact(a,b));assert.ok(a.speed>=40&&b.speed>0);assert.ok(a.stunTimer>=1&&b.stunTimer>=1);
 const abilities=new CharacterAbilities();abilities.reactToCrash(b,true,false,()=>0,()=>{});assert.ok(b.recoverWindow>0);
 assert.ok([a,b].every(k=>Math.abs(k.slipVelocity)<=14&&Math.abs(k.collisionYawVelocity)<=3));
 console.log('PASS urto violento: impulso limitato, perdita di controllo breve e finestra BOSCHI conservata');
}
{
 const a=kart('a'),b=kart('b',840,1.8);assert.ok(resolveKartContact(a,b,frame(a),{...frame(b),z:100}));
 const c=kart('c'),d=kart('d',100,1.8);assert.equal(resolveKartContact(c,d,frame(c),{...frame(d),y:4}),null);
 console.log('PASS collisione reale tra giri diversi, nessuna collisione fra quote separate');
}
const throttle={left:false,right:false,up:true,down:false,drift:false,item:false,steer:0,driftReleased:false};
{
 const grid=Array.from({length:5},(_,i)=>kart(`grid${i}`,-Math.floor(i/2)*3.6-1,(i%2===0?-1:1)*2.3,0));
 for(const k of grid)stepKartPhysics(k,throttle,.05,()=>8,()=>0,false);
 assert.ok(grid.every(k=>k.distance<0));assert.ok(grid[0].distance-grid[2].distance>3);
 console.log('PASS partenza: cinque kart mantengono le file dietro lo zero, nessun ammasso sulla linea');
}
for(const fps of [30,60,120]){
 const k=kart(`wall${fps}`,100,7.55);k.heading=.1;k.absHeading=.1;
 let minimum=44;
 for(let i=0;i<fps*2;i++){stepKartPhysics(k,throttle,1/fps,()=>8,()=>0,false);minimum=Math.min(minimum,k.speed);}
 assert.ok(minimum>42,`muro sfiorato a ${fps} FPS: ${minimum}`);
 assert.ok(k.distance>180);assert.ok(k.lateral<=8);assert.ok(Number.isFinite(k.speed));
 k.slipVelocity=10;k.collisionYawVelocity=2;k.wallContact=true;respawnKart(k,()=>0);
 assert.deepEqual([k.slipVelocity,k.collisionYawVelocity,k.wallContact],[0,0,false]);
}
console.log('PASS muro a 30/60/120 FPS: strisciata senza freno esponenziale; respawn azzera gli impulsi');
