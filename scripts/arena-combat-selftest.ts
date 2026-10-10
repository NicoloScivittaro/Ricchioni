import assert from 'node:assert/strict';
import { MotionBots } from '../src/minigames/bots/MotionBots';
import { InputManager } from '../src/network/InputManager';
import type { MinigameContext } from '../src/minigames/types';
import { ARENA_COMBAT as C, shoulderValues, instabilityMultiplier, recoverInstability, sweptContact, instabilityStage } from '../shared/arenaCombat';
import { PAD_PROFILES } from '../src/input/profiles';
import { createArenaPlayer } from '../src/minigames/arena/arenaTypes';
import { GoblinAnimator } from '../src/minigames/characters/goblinAnimator';
import goblin from '../src/minigames/characters/goblinClips.json';
import boschi from '../src/minigames/characters/buttafuoriClips.json';
import carbo from '../src/minigames/characters/judokaClips.json';
import ciro from '../src/minigames/characters/ciroClips.json';
assert.equal(PAD_PROFILES.arena.buttons.find(b=>b.from==='LEFT')?.control,'attack');
assert.equal(PAD_PROFILES.arena.buttons.find(b=>b.from==='PRIMARY')?.control,'dash');
assert.equal(PAD_PROFILES.arena.buttons.find(b=>b.from==='SECONDARY')?.control,'ability');
assert.ok(shoulderValues(1).power>shoulderValues(.2).power);
assert.deepEqual(shoulderValues(4),shoulderValues(1));
assert.ok(shoulderValues(1).speed*shoulderValues(1).time>9,'full miss travels far enough to risk the edge');
assert.equal(instabilityMultiplier(0),1); assert.equal(instabilityMultiplier(100),2.2);
assert.equal(instabilityMultiplier(1000),2.2);
assert.equal(recoverInstability(70,0,2.5,.1),70);
assert.ok(Math.abs(recoverInstability(70,0,2.55,.1)-(70-.05*C.recoveryRate))<1e-9);
for(const fps of [30,60,120]) {
  let meter=70;for(let i=1;i<=fps*6;i++)meter=recoverInstability(meter,0,i/fps,1/fps);
  assert.ok(Math.abs(meter-21)<.00001,'recovery independent of simulation rate');
}
assert.equal(recoverInstability(2,0,20,1),0);
assert.deepEqual([0,35,70].map(instabilityStage),['STABILE','SBILANCIATO','CRITICO']);
assert.equal(sweptContact(-4,0,0,0,8,0,2),.25);
assert.equal(sweptContact(-4,4,0,0,8,0,2),null);
assert.equal(sweptContact(0,0,1,0,0,0,2),0);
assert.equal(sweptContact(-4,0,0,0,-8,0,2),null);
for(const id of ['goblin','buttafuori','judoka','ciro','dottore']) {
  const p=createArenaPlayer(id,id,'#fff','x',id);
  assert.equal(p.instability,0);assert.equal(p.attackCooldown,0);assert.equal(p.shoulderTime,0);
}
for(const [ns,clips] of [['goblin',goblin],['buttafuori',boschi],['judoka',carbo],['ciro',ciro]] as const) {
  const a=new GoblinAnimator(clips,ns),base={speedFrac:.3,alive:true,falling:false,dashing:false,stunned:false};
  assert.equal(a.update(.016,{...base,arenaCharge:.7}).name,`${ns}.block`);
  assert.equal(a.update(.016,{...base,dashing:true}).name,`${ns}.dash`);
  assert.equal(a.update(.016,{...base,arenaCharge:.7,stunned:true}).name,`${ns}.knockback`);
}
const input=new InputManager();
const bot=createArenaPlayer('bot','goblin','#fff','x','Bot'), rival=createArenaPlayer('human','ciro','#fff','x','Human');
rival.x=4;
const ctx={input,players:[{id:'bot',bot:true},{id:'human',bot:false}],modifier:null} as unknown as MinigameContext;
const brains=new MotionBots(ctx,123),actors=[bot,rival];
for(let i=0;i<200&&!input.get('bot').pressed('attack');i++){brains.arena(.02,actors,14);input.update();}
assert.ok(input.get('bot').pressed('attack'),'bot chooses a held shoulder at medium range');
bot.charging=true;bot.chargeTime=.7;brains.arena(.02,actors,14);
assert.equal(input.get('bot').pressed('attack'),false,'bot releases the charge');
bot.charging=false;bot.stunTime=.5;input.get('bot').setDown('attack');brains.arena(.02,actors,14);
assert.equal(input.get('bot').pressed('attack'),false,'stunned bot re-arms rather than retaining a stale hold');
bot.stunTime=0;input.update();
for(let i=0;i<200&&!input.get('bot').pressed('attack');i++){brains.arena(.02,actors,14);input.update();}
assert.ok(input.get('bot').pressed('attack'),'bot can charge again after interruption');
console.log('PASS Arena combat: common tuning, bindings, recovery 30/60/120 Hz, swept contact, five players and four native rigs.');
