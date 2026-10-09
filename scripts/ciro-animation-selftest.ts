import assert from 'node:assert/strict';
import clips from '../src/minigames/characters/ciroClips.json';
import { GoblinAnimator, GOBLIN_MOVES, attackSeconds } from '../src/minigames/characters/goblinAnimator';
import { ALL_MOVES } from '../src/minigames/cornicione/fighterData';

const base = { speedFrac:0, alive:true, falling:false, dashing:false, stunned:false, grounded:true };
let checks=0;
const check=(value:boolean,message:string):void=>{assert.ok(value,message);checks++;};
check(clips.length===59 && new Set(clips.map(c=>c.original)).size===59,'59 distinct original clips');
check(new Set(clips.map(c=>c.name)).size===clips.length,'semantic names unique');
for(const c of clips){check(c.from>=0&&c.from<c.to&&c.duration>0,`${c.name}: valid range and duration`);}
for(const move of ALL_MOVES){
  const name=GOBLIN_MOVES[move.id].replace('goblin.','ciro.');
  const clip=clips.find(c=>c.name===name)!;
  const contact=move.startup+move.active*.35;
  const attack={id:move.id,elapsed:contact,startup:move.startup,active:move.active,recovery:move.recovery};
  const before=JSON.stringify(attack);
  const animator=new GoblinAnimator(clips,'ciro'),sample=animator.update(.016,{...base,attack});
  check(sample.name===name,`${move.id}: native clip`);
  check(sample.seconds===attackSeconds(clip,attack),`${move.id}: authored contact follows existing active window`);
  check(sample.duration===move.startup+move.active+move.recovery&&before===JSON.stringify(attack),`${move.id}: timings untouched`);
}
const animator=new GoblinAnimator(clips,'ciro');
check(animator.update(.016,base).name==='ciro.idle','native idle');
check(animator.update(.016,{...base,speedFrac:1}).name==='ciro.run','native run');
check(animator.update(.016,{...base,grounded:false,vy:8}).name==='ciro.jump','native ascending jump');
check(animator.update(.016,{...base,grounded:false,vy:-8}).name==='ciro.fall','native descending fall');
check(animator.update(.016,{...base,ability:true}).name==='ciro.uppercut','existing ability presentation uses native uppercut');
animator.playAbility(.4);
check(animator.update(.016,base).name==='ciro.uppercut','event ability uses same authored pose');
animator.playHitReaction('stomach');
check(animator.update(.016,base).name==='ciro.hitStomach','dedicated authored stomach reaction');
const stomach=clips.find(c=>c.name==='ciro.hitStomach')!;
check(stomach.original==='hit_to_stomach.001','real stomach clip, no alias');
console.log(`Ciro animation: ${checks} checks passed`);
