import assert from 'node:assert/strict';
import {FighterWorld} from '../src/minigames/cornicione/fighterCore';
import {NO_INPUT} from '../src/minigames/cornicione/fighterTypes';
import {GROUND_MOVES,STRATEGY_MOVES,PHYS} from '../src/minigames/cornicione/fighterData';
import {GoblinAnimator,attackSeconds,GOBLIN_CLIPS,GOBLIN_MOVES} from '../src/minigames/characters/goblinAnimator';
import {blastVisible} from '../shared/fpsCover';
import {circleVsAabb,rayVsAabb} from '../shared/fpsMap';
import {sweptContact} from '../shared/arenaCombat';
const chars=['goblin','buttafuori','judoka','dottore','ciro'];
const world=(c='goblin')=>{const w=new FighterWorld({ids:['a','b'],characters:[c,'ciro'],rng:()=>.5});w.contactDebug=true;w.fighters.forEach((f,i)=>{f.x=i?1.4:0;f.y=0;f.facing=i?-1:1;f.invuln=f.intang=f.hitstun=0;});return w;};
for(const fps of [30,60,120])for(const c of chars){
 const w=world(c),a=w.fighters[0],b=w.fighters[1],m=GROUND_MOVES.nL;
 w.step(.001,{a:{...NO_INPUT,lightPressed:true}});assert.equal(b.percent,0);
 w.step(m.startup-.002,{});assert.equal(b.percent,0,'no wind-up hit');
 for(let n=0;n<Math.ceil(.3*fps);n++)w.step(1/fps,{});
 assert.equal(w.contacts.length,1,'one hit per move');assert.equal(b.percent,m.dmg);
 const miss=world(c);miss.fighters[1].x=12;miss.fighters[0].attack={move:m,t:m.startup+m.active,phase:2,hit:new Set()};miss.fighters[1].x=1.4;miss.step(1/fps,{});assert.equal(miss.fighters[1].percent,0,'no recovery attack');
 const immune=world(c);immune.fighters[1].intang=1;immune.fighters[0].attack={move:m,t:m.startup,phase:1,hit:new Set()};immune.step(1/fps,{});assert.equal(immune.fighters[1].percent,0);
 const swift=world(c);swift.fighters[0].attack={move:m,t:m.startup,phase:1,hit:new Set()};swift.fighters[1].x=4;swift.fighters[1].hitstun=1;swift.fighters[1].vx=-800;swift.step(1/fps,{});assert.ok(swift.fighters[1].percent>0,'moving hurtbox crosses melee volume');
}
for(const m of [GROUND_MOVES.nL,GROUND_MOVES.sH,STRATEGY_MOVES.kick,STRATEGY_MOVES.airKick]){
 const spec=GOBLIN_CLIPS.find(c=>c.name===GOBLIN_MOVES[m.id])!,a={id:m.id,elapsed:m.startup,startup:m.startup,active:m.active,recovery:m.recovery};
 assert.ok(Math.abs(attackSeconds(spec,a)-spec.contact!)<1e-9);assert.equal(attackSeconds(spec,{...a,elapsed:m.startup+m.active*.99}),spec.contact,'contact pose holds while offensive volume exists');
 const sample=new GoblinAnimator().update(.001,{speedFrac:0,alive:true,falling:false,dashing:false,stunned:false,attack:a});assert.equal(sample.contactTime,m.startup);
}
const wall={x:0,z:0,w:.3,d:6,h:3};
assert.ok(!blastVisible({x:-1,y:1,z:0},{x:1,z:0},[wall]),'wall blocks splash');assert.ok(blastVisible({x:-1,y:1,z:0},{x:-2,z:0},[wall]));
assert.ok(blastVisible({x:-1,y:1.2,z:0},{x:1,z:0},[{...wall,h:.3}]),'exposed upper body above low cover');
assert.ok(!blastVisible({x:-.151,y:1,z:0},{x:1,z:0},[wall]),'impact outside front face cannot damage rear');
const push=circleVsAabb(0,0,.4,wall);assert.ok(push && Math.abs(push.x)>.4,'body embedded in solid exits nearest side');
assert.ok(rayVsAabb(-3,1,0,1,0,0,wall)!<rayVsAabb(-3,1,0,1,0,0,{x:2,z:0,w:.8,d:.8,h:1.8})!);
for(const fps of [30,60,120]){assert.ok(sweptContact(-2,0,2,0,400/fps,0,1.5)!==null);assert.equal(sweptContact(-2,3,2,0,400/fps,0,1.5),null);}
const reach=(m:any)=>m.hit.x+m.hit.w/2+PHYS.halfW;assert.ok(Math.abs(reach(STRATEGY_MOVES.kick)/reach(GROUND_MOVES.sL)-1.35)<1e-9);
console.log('PASS collision audit: five equal hurtboxes, 30/60/120, startup/active/recovery/single hit/dodge, moving melee, native contact pose, cover splash/rays/embedded bodies; strategic kick reach preserved.');
