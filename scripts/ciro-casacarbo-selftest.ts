import assert from 'node:assert/strict';
import { CasaCarboWorld } from '../src/minigames/casaCarbo/waterCore';
import { CiroCasaCarboAnimation } from '../src/minigames/casaCarbo/ciroCasaCarboAnimation';
import { GoblinAnimator } from '../src/minigames/characters/goblinAnimator';
import clips from '../src/minigames/characters/ciroClips.json';
import { CC } from '../src/minigames/casaCarbo/ccTuning';
const world=new CasaCarboWorld({ids:['ciro'],characters:['ciro'],rng:()=>.5});
const p=world.players[0],selector=new CiroCasaCarboAnimation();
let checks=0;
function expect(name:string|null):void {
  const before=JSON.stringify(p),pose=selector.update(.016,p);
  assert.equal(pose?.name??null,name?`ciro.${name}`:null);checks++;
  assert.equal(JSON.stringify(p),before,'visual selector never mutates player state');checks++;
  if(pose) { assert.ok(clips.some(c=>c.name===pose.name),'gesture exists in the native GLB manifest');checks++; }
}
Object.assign(p,{vx:0,vy:0,bucket:0,dashT:0,slipT:0,scooping:false,squeegee:false,containing:null});expect(null);
Object.assign(p,{vx:100,bucket:3});expect('bucketWalk');
p.squeegee=true;expect('squeegee');p.scooping=true;expect('scoopB');
p.containing='front';expect('floodBlock');p.containing=null;
selector.emptyBucket();expect('bucketEmpty');
p.slipT=CC.slipTime;expect('fallBackward');p.slipT=0;expect('getUp');
p.dashT=.1;expect(null);p.dashT=0;expect('scoopB');
p.scooping=p.squeegee=false;p.bucket=0;expect(null);
const animator=new GoblinAnimator(clips,'ciro');
const state={speedFrac:0,alive:true,falling:false,dashing:false,stunned:false,grounded:true};
animator.overrideClip('ciro.fallBackward',CC.slipTime,false);
const spec=clips.find(c=>c.name==='ciro.fallBackward')!;
for(let i=0;i<6;i++)animator.update(.1,state);
assert.ok(Math.abs(animator.last!.seconds-spec.to)<.0001,'native gesture fits existing slip time without a 2x preview speed limit');checks++;
animator.overrideClip(null);assert.equal(animator.update(.016,state).name,'ciro.idle');checks++;
console.log(`Ciro Casa Carbo render: ${checks} checks passed`);
