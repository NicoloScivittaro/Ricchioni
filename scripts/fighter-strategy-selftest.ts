import assert from 'node:assert/strict';
import {FighterWorld} from '../src/minigames/cornicione/fighterCore';
import {NO_INPUT} from '../src/minigames/cornicione/fighterTypes';
import {ALL_MOVES,GROUND_MOVES,AIR_MOVES,PHYS,STRATEGY_MOVES,STRATEGY} from '../src/minigames/cornicione/fighterData';
import {GoblinAnimator,GOBLIN_MOVES} from '../src/minigames/characters/goblinAnimator';
import {readFileSync} from 'node:fs';
import {Rng} from '../shared/rng';
const mk=()=>{const r=new Rng(17);return new FighterWorld({ids:['a','b','c','d','e'],characters:['goblin','buttafuori','dottore','judoka','ciro'],rng:()=>r.next()});};
const inp=(x:object)=>({...NO_INPUT,...x});
const place=(w:FighterWorld)=>{w.fighters.forEach((f,i)=>{f.x=i===0?0:i===1?1.4:9+i;f.y=0;f.grounded=true;f.support=0;f.vx=f.vy=0;f.facing=i===1?-1:1;f.invuln=f.hitstun=f.landLag=0;f.attack=f.dodge=null;});};
const run=(w:FighterWorld,t:number,inputs:Record<string,any>={})=>{for(let i=0;i<t*180;i++)w.step(1/180,inputs);};
assert.equal(ALL_MOVES.length,14);
const reach=(m:any)=>m.hit.x+m.hit.w/2+PHYS.halfW;
assert.ok(Math.abs(reach(STRATEGY_MOVES.kick)/reach(GROUND_MOVES.sL)-1.35)<1e-8);
assert.ok(Math.abs(reach(STRATEGY_MOVES.airKick)/reach(AIR_MOVES.sAL)-1.35)<1e-8);
assert.ok(STRATEGY_MOVES.kick.bkb>GROUND_MOVES.sL.bkb&&STRATEGY_MOVES.kick.kbs>GROUND_MOVES.sL.kbs);

assert.ok(STRATEGY_MOVES.kick.startup>GROUND_MOVES.sL.startup&&STRATEGY_MOVES.kick.recovery>GROUND_MOVES.sL.recovery);
assert.ok(STRATEGY_MOVES.kick.dmg<=GROUND_MOVES.sL.dmg,'range, not more damage');
{
 const w=mk();place(w);w.fighters[1].x=3.7;w.step(.001,{a:inp({kickPressed:true})});run(w,.12);assert.equal(w.fighters[1].percent,0);run(w,.1);assert.ok(w.fighters[1].percent>0,'longer reach actual collision');
 const punch=mk();place(punch);punch.fighters[1].x=3.7;punch.step(.001,{a:inp({lightPressed:true,mx:1})});run(punch,.25);assert.equal(punch.fighters[1].percent,0,'same spacing defeats the lateral punch, including its lunge');
 const v=mk();place(v);v.fighters[1].x=6;v.step(.001,{a:inp({kickPressed:true})});run(v,.65);assert.ok(v.fighters[0].attack,'miss recovery');run(v,.15);assert.equal(v.fighters[0].attack,null);
}
{
 const w=mk();place(w);w.fighters[0].y=4;w.fighters[0].grounded=false;w.fighters[1].y=3;w.fighters[1].grounded=false;
 w.step(.001,{a:inp({kickPressed:true,my:-1})});assert.equal(w.fighters[0].attack?.move.id,'airDownKick');run(w,.25);assert.ok(w.fighters[1].percent>0);
 const v=mk();place(v);v.fighters[0].x=6;v.fighters[0].y=.3;v.fighters[0].grounded=false;v.fighters[0].vy=-1;v.step(.001,{a:inp({kickPressed:true})});run(v,.1);assert.ok(v.fighters[0].landLag>.25,'aerial whiff landing exposed');
}
{
 const w=mk();place(w);w.step(.001,{a:inp({lightPressed:true}),b:inp({parryPressed:true})});run(w,.08);assert.equal(w.fighters[1].percent,0);assert.ok(w.fighters[0].hitstun>0);assert.ok(w.drainEvents().some(e=>e.t==='parry'&&e.state==='success'));
 const v=mk();place(v);v.step(.001,{b:inp({parryPressed:true})});run(v,.2);v.step(.001,{a:inp({lightPressed:true})});run(v,.07);assert.ok(v.fighters[1].percent>0,'late parry punished');
 const c=mk();place(c);c.step(.001,{b:inp({parryPressed:true})});run(c,.5);c.step(.001,{b:inp({parryPressed:true})});assert.equal(c.fighters[1].parry,null,'cooldown prevents parry spam');
}
// New input edges are consumed once even when the timestep contains several substeps.
{
 const w=mk();place(w);w.step(.8,{a:inp({kickPressed:true})});assert.equal(w.drainEvents().filter(e=>e.t==='attack'&&e.id==='a'&&e.phase==='start').length,1);
 for(const move of Object.values(STRATEGY_MOVES)){
  const animator=new GoblinAnimator();const s=animator.update(0,{speedFrac:0,alive:true,falling:false,dashing:false,stunned:false,attack:{id:move.id,elapsed:move.startup,startup:move.startup,active:move.active,recovery:move.recovery}});
  assert.equal(s.name,GOBLIN_MOVES[move.id],'imported skin uses the matching clip');
 }
}
console.log('PASS: original 14 moves preserved, spacing/whiff/air kick, timed parry/late punishment/cooldown, input edges, animation mapping.');

for(const ns of ['goblin','buttafuori','judoka','ciro']) {
 const clips=JSON.parse(readFileSync(`src/minigames/characters/${ns}Clips.json`,'utf8'));
 for(const id of ['kick','airKick','airDownKick','objectCharge','objectThrow','parry']) {
  const a={id,elapsed:.15,startup:.12,active:.08,recovery:.3};
  const sample=new GoblinAnimator(clips,ns).update(.016,{speedFrac:0,alive:true,falling:false,dashing:false,stunned:false,attack:a});
  assert.equal(sample.name,GOBLIN_MOVES[id].replace('goblin.',ns+'.'));
  assert.ok(Number.isFinite(sample.seconds));assert.equal(a.elapsed,.15);
 }
}
{
 const w=mk();place(w);const defender=w.fighters[1];defender.characterId='judoka';w.abil.newLife(defender);
 w.step(.001,{b:inp({abilityPressed:true})});w.step(.001,{a:inp({kickPressed:true})});run(w,.20);
 assert.ok(defender.stats.abilitySuccess>0,'Carbo ability still counters a melee kick');
}
console.log('PASS: all four imported rigs have kick/charge/throw/parry poses; Carbo melee counter preserved.');
