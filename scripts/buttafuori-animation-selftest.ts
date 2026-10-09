import assert from 'node:assert/strict';
import clips from '../src/minigames/characters/buttafuoriClips.json';
import { GoblinAnimator, GOBLIN_MOVES, attackSeconds } from '../src/minigames/characters/goblinAnimator';
import { ALL_MOVES } from '../src/minigames/cornicione/fighterData';

const base = { speedFrac:0, alive:true, falling:false, dashing:false, stunned:false, grounded:true };
let checks=0;
const check=(value:boolean,message:string):void=>{assert.ok(value,message);checks++;};
check(clips.length===55 && new Set(clips.map(c=>c.original)).size===54,'54 source clips plus explicit stomach alias');
check(new Set(clips.map(c=>c.name)).size===clips.length,'semantic names unique');
for(const c of clips){check(c.from>=0&&c.from<c.to&&c.duration>0,`${c.name}: valid range and duration`);}
for(const move of ALL_MOVES){
  const name=GOBLIN_MOVES[move.id].replace('goblin.','buttafuori.');
  const clip=clips.find(c=>c.name===name)!;
  const contact=move.startup+move.active*.35;
  const attack={id:move.id,elapsed:contact,startup:move.startup,active:move.active,recovery:move.recovery};
  const before=JSON.stringify(attack);
  const animator=new GoblinAnimator(clips,'buttafuori'),sample=animator.update(.016,{...base,attack});
  check(sample.name===name,`${move.id}: native clip`);
  check(sample.seconds===attackSeconds(clip,attack),`${move.id}: authored contact follows existing active window`);
  check(sample.duration===move.startup+move.active+move.recovery&&before===JSON.stringify(attack),`${move.id}: timings untouched`);
}
const animator=new GoblinAnimator(clips,'buttafuori');
check(animator.update(.016,base).name==='buttafuori.idle','native idle');
check(animator.update(.016,{...base,speedFrac:1}).name==='buttafuori.run','native run');
check(animator.update(.016,{...base,grounded:false,vy:8}).name==='buttafuori.jump','native ascending jump');
check(animator.update(.016,{...base,grounded:false,vy:-8}).name==='buttafuori.fall','native descending fall');
check(animator.update(.016,{...base,ability:true}).name==='buttafuori.block','focus ability uses native defensive stance');
animator.playAbility(.4);
check(animator.update(.016,base).name==='buttafuori.block','event ability uses same stance');
animator.playHitReaction('stomach');
check(animator.update(.016,base).name==='buttafuori.hitStomach','explicit authored body-reaction alias');
const stomach=clips.find(c=>c.name==='buttafuori.hitStomach')!,body=clips.find(c=>c.name==='buttafuori.hitBodyB')!;
check(stomach.original===body.original,'no fabricated stomach clip');
console.log(`Buttafuori animation: ${checks} checks passed`);
