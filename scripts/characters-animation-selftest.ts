import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CasaCarboWorld } from '../src/minigames/casaCarbo/waterCore';
import { CasaCarboAnimation, hasCasaCarboAnimations } from '../src/minigames/casaCarbo/casaCarboAnimation';
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
    const attack={id:move.id,elapsed:move.startup+move.active*.35,startup:move.startup,active:move.active,recovery:move.recovery};
    const snapshot=JSON.stringify(attack),name=GOBLIN_MOVES[move.id].replace('goblin.',`${ns}.`);
    const spec=clips.find(c=>c.name===name)!;
    const sample=new GoblinAnimator(clips,ns).update(.016,{...base,attack});
    check(sample.name===name && sample.seconds===attackSeconds(spec,attack),`${ns} ${move.id}: unchanged native contact`);
    check(JSON.stringify(attack)===snapshot && sample.duration===move.startup+move.active+move.recovery,`${ns} ${move.id}: simulation timings unchanged`);
  }
}
check(!hasCasaCarboAnimations('dottore')&&!hasCasaCarboAnimations(null),'unsupported/unselected characters keep their existing render');
for(const [ns,clips] of [['goblin',goblin],['buttafuori',boschi],['judoka',carbo],['ciro',ciro]] as const) {
  const world=new CasaCarboWorld({ids:[ns],characters:[ns],rng:()=>.5});
  const p=world.players[0],selector=new CasaCarboAnimation(ns);
  const expect=(name:string|null,dt=.016):void=>{
    const player=JSON.stringify(p),water=Array.from(world.h),pose=selector.update(dt,p);
    assert.equal(pose?.name??null,name?`${ns}.${name}`:null,`${ns}: gesture`);checks++;
    check(player===JSON.stringify(p)&&water.every((v,i)=>v===world.h[i]),`${ns}: cosmetic update does not mutate player/water`);
    if(pose)check(clips.some(c=>c.name===pose.name),`${ns}: gesture exists in this asset`);
  };
  Object.assign(p,{vx:0,vy:0,bucket:0,dashT:0,slipT:0,scooping:false,squeegee:false,containing:null});expect(null);
  Object.assign(p,{vx:100,bucket:3});expect('bucketWalk');
  p.squeegee=true;expect('squeegee');p.scooping=true;expect('scoopB');
  p.containing='front';expect(ns==='goblin'?'block':'floodBlock');p.containing=null;
  selector.emptyBucket();expect('bucketEmpty');
  p.slipT=.6;expect('fallBackward');p.slipT=0;expect('getUp');
  p.dashT=.1;expect(null);p.dashT=0;expect('scoopB');
  p.scooping=p.squeegee=false;p.bucket=0;expect(null);
  if(ns==='buttafuori') { p.ab.blockT=2;expect('floodBlock');p.ab.blockT=0;expect(null); }
  if(ns==='judoka') { selector.buildBarrier();expect('floodBarrier');expect(null,1.01); }
  if(ns==='goblin') {
    p.ab.windupT=.2;p.scooping=true;expect(null);p.ab.windupT=0;
    selector.showExistingAbility(.4);expect(null);expect('scoopB',.41);
  }
  const animator=new GoblinAnimator(clips,ns),fall=clips.find(c=>c.name===`${ns}.fallBackward`)!;
  animator.overrideClip(fall.name,.6,false);
  for(let i=0;i<6;i++)animator.update(.1,base);
  check(Math.abs(animator.last!.seconds-fall.to)<.0001,`${ns}: full native fall fits existing slip duration`);
  animator.overrideClip(null);check(animator.update(.016,base).name===`${ns}.idle`,`${ns}: normal animator restored`);
}
console.log(`Character animation update: ${checks} checks passed`);
