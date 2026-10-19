import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {NullEngine,Scene} from '@babylonjs/core';
import {Rng} from '../shared/rng';
import {ItemManager} from '../src/minigames/kart-race/items';
import {CharacterAbilities} from '../src/minigames/kart-race/abilities';
import {createKartState} from '../src/minigames/kart-race/raceTypes';
import {RainbowTrack} from '../src/minigames/kart-race/rainbowTrack';
import {buildTrack} from '../src/minigames/kart-race/track';
import {resolveKartContact} from '../src/minigames/kart-race/kartCollisions';
const engine=new NullEngine(),checks:string[]=[];
{
 const scene=new Scene(engine),track=new RainbowTrack(),ab=new CharacterAbilities(),k=createKartState('a',null,'#fff','');k.heldItem='mollone';k.distance=100;
 const items=new ItemManager(scene,[],track,new Rng(1),ab,()=>{});assert.ok(items.useItem(k,[k],()=>1));k.heldItem='mollone';assert.equal(items.useItem(k,[k],()=>1),false);assert.equal(k.heldItem,'mollone');
 Object.assign(k,{flight:'GLIDE',jumpHeight:3,jumpVelocity:0});items.update(.016,[k],()=>1,1);assert.equal(k.boostTimer,0);
 Object.assign(k,{flight:'DRIVE',jumpHeight:0});items.update(.016,[k],()=>1,1);assert.equal(k.boostPower,24);assert.equal(k.springLandingBoost,false);
 k.boostTimer=.4;items.update(.016,[k],()=>1,1);assert.equal(k.boostTimer,.4);items.dispose();scene.dispose();checks.push('spring carried into a glide grants exactly one landing burst');
}
{
 const scene=new Scene(engine),track=buildTrack(),ab=new CharacterAbilities(),a=createKartState('a',null,'#fff',''),b=createKartState('b',null,'#fff','');Object.assign(a,{distance:100,speed:44,invulnTimer:0,heldItem:'furto'});Object.assign(b,{distance:180,speed:44,invulnTimer:0});
 const items=new ItemManager(scene,[],track,new Rng(2),ab,()=>{});assert.equal(items.useItem(a,[a,b],()=>2),false);assert.equal(a.heldItem,'furto');
 a.heldItem='missile';assert.ok(items.useItem(a,[a,b],()=>2));let hitAt:number|null=null;
 for(let i=0;i<240;i++){a.distance+=44/60;b.distance+=44/60;items.update(1/60,[a,b],()=>2,2);if(b.stunTimer>0){hitAt=(i+1)/60;break;}}
 assert.ok(hitAt!==null&&hitAt>.8&&hitAt<4.8);items.dispose();scene.dispose();checks.push('moving missile: full warning, finite catch-up, absent theft target keeps item');
}
{
 function collision(bumper:boolean){const a=createKartState('a',null,'#fff',''),b=createKartState('b',null,'#fff','');Object.assign(a,{speed:50,invulnTimer:0,bumperTimer:bumper?6.5:0});Object.assign(b,{distance:2.6,speed:20,invulnTimer:0});const frame=(k:typeof a)=>({x:k.lateral,y:0,z:k.distance,trackAngle:0});assert.ok(resolveKartContact(a,b,frame(a),frame(b)));return {source:a.speed,target:b.speed};}
 const plain=collision(false),strong=collision(true);assert.ok(strong.source>plain.source&&strong.target>plain.target);checks.push('bumper: real contact solver transfers more momentum and protects its user');
}
{
 const scene=new Scene(engine),track=buildTrack(),ab=new CharacterAbilities(),a=createKartState('a',null,'#fff',''),b=createKartState('b',null,'#fff','');Object.assign(a,{distance:100,speed:44,heldItem:'calamita'});Object.assign(b,{distance:110,jumpHeight:.7});
 const items=new ItemManager(scene,[],track,new Rng(3),ab,()=>{});assert.equal(items.useItem(a,[a,b],()=>2),false);assert.equal(a.heldItem,'calamita');
 b.jumpHeight=0;a.stunTimer=.3;assert.equal(items.useItem(a,[a,b],()=>2),false);assert.equal(a.heldItem,'calamita');items.dispose();scene.dispose();checks.push('magnet keeps its charge when an existing jump or stun prevents traction');
}
engine.dispose();writeFileSync('docs/agent-work/ribaltati-1-4/edge-checks.json',JSON.stringify({checks},null,2));console.log('PASS '+checks.join('; '));
