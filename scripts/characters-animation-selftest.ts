import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GoblinAnimator, GOBLIN_MOVES, attackSeconds } from '../src/minigames/characters/goblinAnimator';
import { ALL_MOVES } from '../src/minigames/cornicione/fighterData';
import goblin from '../src/minigames/characters/goblinClips.json';
import boschi from '../src/minigames/characters/buttafuoriClips.json';
import carbo from '../src/minigames/characters/judokaClips.json';
import ciro from '../src/minigames/characters/ciroClips.json';
const out='docs/agent-work/characters-animation-update';
let checks=0;
function check(value:boolean,message:string):void { assert.ok(value,message);checks++; }
const base={speedFrac:0,alive:true,falling:false,dashing:false,stunned:false,grounded:true};
for(const [ns,clips,count] of [['goblin',goblin,52],['buttafuori',boschi,54],['judoka',carbo,49]] as const) {
  const before=JSON.parse(readFileSync(`${out}/${ns}/previous-clips.json`,'utf8'));
  for(const prev of before) {
    const curr=clips.find(c=>c.name===prev.name)!;
    check(!!curr,`${ns}: old semantic ${prev.name} remains`);
    const {index:oldIndex,...oldContract}=prev,{index:newIndex,...newContract}=curr;
    assert.deepEqual(newContract,oldContract,`${prev.name}: only source index may change`);checks++;
  }
  check(new Set(clips.map(c=>c.index)).size===count,`${ns}: every native clip previewable`);
  for(const move of ALL_MOVES) {
    const attack={id:move.id,elapsed:move.startup,startup:move.startup,active:move.active,recovery:move.recovery};
    const snapshot=JSON.stringify(attack),name=GOBLIN_MOVES[move.id].replace('goblin.',`${ns}.`);
    const spec=clips.find(c=>c.name===name)!;
    const sample=new GoblinAnimator(clips,ns).update(.016,{...base,attack});
    check(sample.name===name && sample.seconds===attackSeconds(spec,attack),`${ns} ${move.id}: unchanged native contact`);
    check(JSON.stringify(attack)===snapshot && sample.duration===move.startup+move.active+move.recovery,`${ns} ${move.id}: simulation timings unchanged`);
  }
}
console.log(`Character animation update: ${checks} checks passed`);
