import assert from 'node:assert/strict';
import { FighterWorld } from '../src/minigames/cornicione/fighterCore';
import { FighterBot } from '../src/minigames/cornicione/fighterBot';
import { NO_INPUT } from '../src/minigames/cornicione/fighterTypes';
import type { FighterInput, FighterProjectile } from '../src/minigames/cornicione/fighterTypes';
import { OBJECT_THROW, OBJECT_MOVE, PHYS, STAGE } from '../src/minigames/cornicione/fighterData';
import { Rng } from '../shared/rng';
const chars=['ciro','judoka','buttafuori','goblin','dottore'];
const input=(x:Partial<FighterInput>)=>({...NO_INPUT,...x});
const mk=(character='goblin')=>{const rng=new Rng(7);const w=new FighterWorld({ids:['a','b'],characters:[character,'ciro'],rng:()=>rng.next()});w.fighters[0].x=-10;w.fighters[1].x=10;return w;};
const run=(w:FighterWorld,t:number,i:Partial<FighterInput>={},fps=180)=>{for(let n=0;n<Math.round(t*fps);n++)w.step(1/fps,{a:input(i)});};
const shoot=(w:FighterWorld,charge=0,aim:Partial<FighterInput>={})=>{
 w.step(1/180,{a:input({...aim,throwPressed:true,throwHeld:true})});
 run(w,charge,{...aim,throwHeld:true});w.step(1/180,{a:input({...aim,throwReleased:true})});run(w,.13);
 const e=w.drainEvents().find(e=>e.t==='objectThrow');assert.ok(e?.t==='objectThrow');return e.projectile;
};
const projectile=(w:FighterWorld,x:number,y:number,dx=1,dy=0):FighterProjectile=>{
 const p={id:1,owner:'a',characterId:w.fighters[0].characterId,x,y,dx,dy,speed:30,age:0,life:.85,charge:1};w.projectiles.push(p);return p;
};
// Character cosmetic differences never alter flight, hitbox or damage.
for(const charge of [0,1]) {
 const shots=chars.map(c=>shoot(mk(c),charge));
 for(const p of shots){assert.ok(Math.abs(p.speed-(charge?30:18))<1e-8);assert.ok(Math.abs(p.life-(charge?.85:.55))<1e-8);assert.ok(Math.abs(p.charge-charge)<1e-8);}
 assert.equal(OBJECT_THROW.cooldown,6);assert.equal(OBJECT_MOVE.dmg,4);
}
for(const fps of [30,60,90,180]) {
 const w=mk();w.step(1/fps,{a:input({throwPressed:true,throwReleased:true})});run(w,.15,{},fps);
 assert.equal(w.drainEvents().filter(e=>e.t==='objectThrow').length,1,'tap + substeps = one object');
 assert.ok(w.fighters[0].throwCd>5.8);
 w.step(.8,{a:input({throwPressed:true,throwReleased:true})});assert.equal(w.drainEvents().filter(e=>e.t==='objectThrow').length,0,'cooldown');
}
{
 const w=mk();const p=shoot(w,0,{mx:-.8,my:.6});assert.ok(p.dx<0&&p.dy>0);assert.ok(Math.abs(Math.hypot(p.dx,p.dy)-1)<1e-8);
 const a=mk();a.fighters[0].facing=-1;assert.equal(shoot(a).dx,-1,'neutral faces actor');
 const b=mk();b.fighters[0].grounded=false;b.fighters[0].y=10;b.fighters[0].jumps=0;
 const before=b.fighters[0].recoveryUsed;assert.ok(shoot(b,0,{mx:1,my:-.5}).dy<0);assert.equal(b.fighters[0].recoveryUsed,before);assert.equal(b.fighters[0].jumps,0);
}
// Genuine releases only; cancellation/stun/defence must not secretly launch.
for(const how of ['lost','cancel','interrupt','pause','dodge','heavy','ko']) {
 const w=mk();w.step(.01,{a:input({throwPressed:true,throwHeld:true})});run(w,.2,{throwHeld:true});
 if(how==='interrupt')w.interrupt(w.fighters[0]);
 else if(how==='pause')w.cancelObjectThrows();
 else if(how==='ko')w.knockOut(w.fighters[0],'side');
 else w.step(.01,{a:input(how==='cancel'?{throwCancelled:true,throwReleased:true}:how==='dodge'?{throwHeld:true,dodgePressed:true}:how==='heavy'?{throwHeld:true,heavyPressed:true}:{})});
 run(w,.3,{throwReleased:true});assert.equal(w.projectiles.length,0,how);assert.equal(w.fighters[0].throwCd,0,how);
}
{
 const w=mk();w.step(.01,{a:input({throwPressed:true,throwReleased:true})});w.step(.02,{});
 assert.ok(w.fighters[0].objectThrow && w.fighters[0].objectThrow.releaseT!==null);w.step(.01,{a:input({throwCancelled:true})});run(w,.2);assert.equal(w.projectiles.length,0,'cancel device even in release wind-up');assert.equal(w.fighters[0].throwCd,0);
 const ready=mk();shoot(ready);run(ready,5.7);ready.step(.01,{a:input({throwPressed:true,throwReleased:true})});assert.equal(ready.fighters[0].objectThrow,null,'still cooling');run(ready,.4);assert.equal(ready.fighters[0].throwCd,0);shoot(ready);assert.ok(ready.fighters[0].throwCd>5.8,'ready after six seconds');
 const respawn=mk();shoot(respawn);const remaining=respawn.fighters[0].throwCd;respawn.knockOut(respawn.fighters[0],'side');run(respawn,2.3);
 assert.ok(!respawn.fighters[0].dead);assert.ok(Math.abs(respawn.fighters[0].throwCd-(remaining-2.3))<1e-7,'cooldown advances during respawn instead of restarting/pausing');
}
{
 const w=mk();w.step(.01,{a:input({throwPressed:true,throwHeld:true})});run(w,2,{throwHeld:true});assert.equal(w.fighters[0].objectThrow?.charge,1);assert.equal(w.projectiles.length,0,'no auto-fire');
}
// Swept collision resolves closest target once; parry is flight-facing, not owner-facing.
for(const c of chars) {
 const w=mk(c);const v=w.fighters[1];v.x=0;projectile(w,-1,1.2);w.fighters[0].facing=-1;
 w.step(.03,{});assert.equal(v.percent,4);assert.ok(v.vx>0);assert.equal(w.projectiles.length,0);
 assert.equal(v.lastHitBy,'a');assert.equal(w.fighters[0].stats.dmgDealt,4);run(w,.1);assert.equal(v.percent,4);
}
{
 const w=mk();const v=w.fighters[1];v.x=0;v.facing=-1;v.parry={t:.04};projectile(w,-1,1.2);
 w.step(.01,{});assert.equal(v.percent,0);assert.equal(w.projectiles.length,0);assert.equal(w.fighters[0].hitstun,0,'no remote stun');assert.ok(w.drainEvents().some(e=>e.t==='objectImpact'&&e.reason==='parry'));
 const late=mk();late.fighters[1].x=0;late.fighters[1].parry={t:.2};projectile(late,-1,1.2);late.step(.01,{});assert.equal(late.fighters[1].percent,4);
 const back=mk();back.fighters[1].x=0;back.fighters[1].facing=1;back.fighters[1].parry={t:.04};projectile(back,-1,1.2);back.step(.01,{});assert.equal(back.fighters[1].percent,4);
}
{
 const w=mk();w.fighters[1].x=0;w.fighters[1].intang=.3;projectile(w,-1,1.2);w.step(.1,{});assert.equal(w.fighters[1].percent,0);assert.equal(w.projectiles.length,1,'dodge passes through');
 w.fighters[1].intang=0;run(w,1);assert.equal(w.projectiles.length,0,'expiry leaves no ground object');
 const inv=mk();inv.fighters[1].x=0;inv.fighters[1].invuln=.3;projectile(inv,-1,1.2);inv.step(.1,{});assert.equal(inv.fighters[1].percent,0);
 const wall=mk();projectile(wall,STAGE.mainX+1,-1,-1);wall.step(.1,{});assert.equal(wall.projectiles.length,0);assert.ok(wall.drainEvents().some(e=>e.t==='objectImpact'&&e.reason==='wall'));
 const own=mk();projectile(own,-10,1);own.step(.01,{});assert.equal(own.fighters[0].percent,0,'self excluded');own.knockOut(own.fighters[0],'side');assert.equal(own.projectiles.length,0);
}
{
 const w=mk();const p=shoot(w,1);const x=w.projectiles[0].x;run(w,1);assert.equal(w.projectiles.length,0);assert.ok(p.speed*p.life>24);assert.ok(x>-10);
 const three=new FighterWorld({ids:['a','b','c'],characters:chars.slice(0,3),rng:()=>.5});three.fighters.forEach((f,i)=>{f.x=i===0?-10:i===1?0:1;f.y=0;});projectile(three,-1,1);three.step(.2,{});assert.equal(three.fighters[1].percent,4);assert.equal(three.fighters[2].percent,0);
 const end=mk();projectile(end,-10,1);end.knockOut(end.fighters[1],'side');end.fighters[1].inGame=false;end.step(.01,{});assert.equal(end.phase,'over');assert.equal(end.projectiles.length,0);
}
// The bot uses the same charge/release controls, with a real finite match.
{
 const w=mk();const rng=new Rng(32);const bots=w.fighters.map(f=>new FighterBot(f.id,()=>rng.next()));let thrown=0,kicks=0;
 for(let n=0;n<160*60&&w.phase!=='over';n++) {w.step(1/60,Object.fromEntries(bots.map(b=>[b.id,b.input(w,1/60)])));for(const e of w.drainEvents()){if(e.t==='objectThrow')thrown++;if(e.t==='attack'&&e.move.kind==='kick')kicks++;}}
 assert.equal(w.phase,'over');assert.ok(thrown>0);assert.ok(kicks>0);assert.ok(w.fighters.every(f=>[f.x,f.y,f.vx,f.vy,f.percent].every(Number.isFinite)));console.log({botThrows:thrown,botKicks:kicks,matchSeconds:w.time});
}
console.log('PASS: equal five skins; tap/charge/aim/air/cooldown; cancellation; swept first hit/parry/dodge/invulnerability/roof/expiry/KO/end; bots and finite match.');
