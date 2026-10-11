import assert from 'node:assert/strict';
import {NullEngine,Scene} from '@babylonjs/core';
import {ItemManager} from '../src/minigames/kart-race/items';
import {ITEM_IDS,pickKartItem} from '../src/minigames/kart-race/itemCatalog';
import {Rng} from '../shared/rng';
import {buildTrack} from '../src/minigames/kart-race/track';
import {createKartState,type ItemId} from '../src/minigames/kart-race/raceTypes';
import {CharacterAbilities} from '../src/minigames/kart-race/abilities';
import {stepKartPhysics} from '../src/minigames/kart-race/kartPhysics';
import {resolveKartContact} from '../src/minigames/kart-race/kartCollisions';
const engine=new NullEngine(),scene=new Scene(engine),track=buildTrack(),ab=new CharacterAbilities();
const manager=new ItemManager(scene,[],track,new Rng(10),ab,()=>{});
const harness=manager as unknown as {traps:{distance:number;lateral:number;kind:string;life:number}[];projectiles:{distance:number;lateral:number;life:number;kind:string}[];timed:Map<string,unknown>;previous:Map<string,{distance:number;lateral:number}>};
const a=createKartState('a',null,'#fff',''),b=createKartState('b',null,'#fff',''),others=Array.from({length:3},(_,i)=>createKartState('p'+i,null,'#fff','')),ks=[a,b,...others];
const reset=()=>{ks.forEach((k,i)=>Object.assign(k,createKartState(k.playerId,null,'#fff',''),{distance:100+i*10,lateral:0,invulnTimer:0,speed:44,absHeading:track.tangentAngleAt(100+i*10)}));harness.previous.clear();};
const use=(item:ItemId)=>{a.heldItem=item;manager.useItem(a,ks,id=>id==='a'?2:1);};
const update=(dt=.016)=>manager.update(dt,ks,()=>2,5);
assert.equal(ITEM_IDS.length,13);
for(const place of [1,3,5]){
 const counts=new Map<ItemId,number>(),rng=new Rng(20);for(let i=0;i<20000;i++){const item=pickKartItem(rng,place,5);counts.set(item,(counts.get(item)??0)+1);}
 assert.equal(counts.size,13);assert.ok((counts.get('super_turbo')!+counts.get('turbo_difettoso')!)/20000<.13);
 assert.ok(counts.get('turbo')!<10000); // ultimo non ha un risultato garantito
}
reset();use('calamita');update();assert.ok(a.speed>44);assert.equal(a.magnetTarget,'b');assert.ok(a.magnetTimer>0);
b.lateral=6;update();assert.equal(a.magnetTimer,0);assert.equal(a.magnetTarget,null);
reset();b.distance=150;others.forEach(k=>k.distance=200);use('calamita');assert.equal(a.heldItem,'calamita');
reset();use('turbo_difettoso');assert.equal(a.boostPower,48);assert.equal(a.faultyTimer,1.8);
use('paraurti');assert.equal(a.bumperTimer,5);use('mollone');assert.equal(a.jumpVelocity,6.2);
const input={left:false,right:false,up:true,down:false,drift:true,item:false,steer:.1,driftReleased:false};
for(const fps of [30,60,120]){
 reset();use('mollone');use('turbo_difettoso');use('paraurti');let maxY=0;
 for(let i=0;i<fps*6;i++){stepKartPhysics(a,input,1/fps,()=>100,()=>0,false);update(1/fps);maxY=Math.max(maxY,a.jumpHeight);}
 assert.ok(maxY>1.1&&maxY<1.5);assert.equal(a.jumpHeight,0);assert.equal(a.jumpVelocity,0);assert.equal(a.faultyTimer,0);assert.equal(a.bumperTimer,0);assert.equal(harness.timed.size,0);
 assert.ok([a.speed,a.distance,a.lateral,a.slipVelocity].every(Number.isFinite));
}
for(const id of ['olio','buca','raffica'] as const){reset();use(id);const t=harness.traps.at(-1)!;
 assert.equal(t.kind,id);assert.ok(Math.abs(t.lateral)+ (id==='raffica'?2.4:id==='buca'?1.3:1.7)<track.widthAt(t.distance)/2);
 b.distance=t.distance;b.lateral=t.lateral;update();
 if(id==='raffica')assert.ok(Math.abs(b.slipVelocity)>0);else {assert.ok(b.oilTimer>0);assert.equal(b.speed,44);assert.equal(b.stunTimer,0);}
 if(id==='buca')assert.equal(b.jumpVelocity,3);
 b.oilTimer=0;b.jumpHeight=1;harness.previous.clear();update();assert.equal(b.oilTimer,0);
 t.life=0;update();assert.ok(!harness.traps.includes(t));
}
for(const id of ['sfera','piccione'] as const){reset();a.speed=80;b.distance=105;use(id);update(.001);const p=harness.projectiles.at(-1)!;
 // In un passo rapido attraversa il corpo senza fermarsi sul suo centro.
 b.distance=p.distance+3;harness.previous.set(b.playerId,{distance:b.distance,lateral:b.lateral});update(.1);
 assert.ok(!harness.projectiles.includes(p));if(id==='piccione'){assert.ok(b.oilTimer>0);assert.equal(b.speed,44);}else assert.ok(b.stunTimer>0);
}
reset();use('scudo');assert.ok(a.shielded);use('disturbo');assert.ok(b.disturbTimer>0);use('turbo');assert.equal(a.boostPower,18);use('super_turbo');assert.equal(a.boostPower,38);
// Bumper al contatto, nessun effetto quando soltanto vicini.
reset();a.bumperTimer=5;b.distance=a.distance;b.lateral=3;const frame=(k:typeof a)=>({x:k.lateral,y:k.jumpHeight,z:k.distance,trackAngle:0});
assert.equal(resolveKartContact(a,b,frame(a),frame(b)),null);assert.equal(a.speed,44);assert.equal(b.speed,44);
b.lateral=0;b.distance=a.distance+2.6;b.speed=20;assert.ok(resolveKartContact(a,b,frame(a),frame(b)));assert.ok(b.speed>20);assert.ok(a.speed>30);
reset();a.finished=true;use('buca');assert.equal(a.heldItem,'buca');
manager.dispose();assert.equal(harness.timed.size,0);assert.equal(scene.meshes.length,0);
scene.dispose();engine.dispose();console.log('PASS 13 item: distribuzione, sette effetti, magnete e break, salto/landing e scadenze 30/60/120, traiettorie rapide, miscele boost/drift, contatto bumper, fine gara e cleanup.');
