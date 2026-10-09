import assert from 'node:assert/strict';
import { GameSession } from '../server/GameSession';
import { PlayerSession } from '../server/PlayerSession';
import { Rng } from '../shared/rng';
import { InputManager } from '../src/network/InputManager';
import { PartyBots } from '../src/minigames/bots/PartyBots';
import { MotionBots } from '../src/minigames/bots/MotionBots';
import { QuizRoundManager } from '../src/minigames/quiz/QuizRoundManager';
import { buildTrack, buildCheckpoints } from '../src/minigames/kart-race/track';
import { createKartState } from '../src/minigames/kart-race/raceTypes';
import { stepKartPhysics } from '../src/minigames/kart-race/kartPhysics';
import { RaceManager } from '../src/minigames/kart-race/race';
import { FPS_MAP, resolveCollisions } from '../shared/fpsMap';
import type { MinigameContext } from '../src/minigames/types';

const human = (id = 'human', character = 'goblin'): PlayerSession => {
  const p = new PlayerSession(id, id, `token:${id}`); p.characterId = character; p.ready = true; p.attach(`socket:${id}`); return p;
};
for (let seats = 2; seats <= 5; seats++) {
  const s = new GameSession('TEST', seats, 60, 'host');
  assert.equal(s.allReady(), false); s.startGame(); assert.equal(s.phase, 'LOBBY');
  const p = human(); s.addPlayer(p); s.charactersLocked.push(p.characterId!);
  p.ready = false; s.startGame(); assert.equal(s.players.length, 1); assert.equal(s.phase, 'LOBBY');
  p.ready = true; p.connected = false; s.startGame(); assert.equal(s.phase, 'LOBBY');
  p.connected = true; s.selectMinigame('quiz'); s.startGame();
  assert.equal(s.players.length, seats); assert.equal(s.players.filter((p) => p.bot).length, seats - 1);
  assert.equal(new Set(s.players.map((p) => p.characterId)).size, seats);
  assert.ok(s.players.filter((p) => p.bot).every((p) => !p.connectionId && !p.reconnectToken && p.ready && p.connected));
  assert.equal(s.lastSelectedPayload!.players.filter((p) => p.bot).length, seats - 1);
  s.startGame(); assert.equal(s.players.length, seats);
  s.setGamepads(Object.fromEntries(s.players.map((p) => [p.id, 'Xbox'])));
  assert.ok(s.playersPublic().filter((p) => p.bot).every((p) => !p.pad));
  s.skip(); s.skip(); assert.equal(s.phase, 'MINIGAME_PLAYING');
  s.finishMinigame(s.players.map((p, i) => ({ playerId: p.id, placement: i + 1, score: seats - i })), s.minigameSeq);
  assert.equal(s.lastResults!.results.length, seats); assert.ok(s.players.every((p) => p.score > 0));
  const scores = s.players.map((p) => p.score); s.finishMinigame([]); assert.deepEqual(s.players.map((p) => p.score), scores);
  s.restartMatch(); assert.equal(s.players.length, 1); assert.deepEqual(s.charactersLocked, ['goblin']); assert.equal(p.score, 0); assert.equal(p.ready, false);
  p.ready = true; s.startGame(); assert.equal(s.players.length, seats); s.resetToLobby();
}
{
  const s = new GameSession('MULTI', 5, 60, 'host'); s.addPlayer(human()); s.addPlayer(human('friend', 'ciro'));
  s.players[1].detach(); assert.equal(s.allReady(), false); s.startGame(); assert.equal(s.players.length, 2);
  s.players[1].attach('friend:socket'); s.startGame(); assert.equal(s.players.length, 2); assert.ok(s.players.every((p) => !p.bot)); s.resetToLobby();
}
console.log('PASS server: solo 2–5 seats, readiness/offline, unique characters, payload, normal scoring, no duplicates, restart, multiplayer');

function context(): MinigameContext {
  const players = [false, true, true, true].map((bot, i) => ({ bot, id: `p${i}`, displayName: `P${i}`, characterId: ['goblin','buttafuori','judoka','ciro'][i], name: `P${i}`, roleTitle: '', avatar: '', color: '#ffffff', quote: '', score: 0 }));
  return { players, playerIds: players.map((p) => p.id), input: new InputManager(), rng: new Rng(47), durationSec: 150, modifier: null, modifiers: new Map(), consume: () => false, sendPrivate: () => {}, signal: () => {}, vibrate: () => {}, finish: () => {} };
}
{
  const ctx = context(), bot = new PartyBots(ctx, 124), manager = new QuizRoundManager(ctx, () => {});
  let answers = 0;
  for (let t = 0; t < 500 && !manager.finished; t += 0.05) {
    const q = manager.currentQuestion(); bot.quiz(0.05, manager.phase, `${manager.questionIndex}:${q.id}`, q.difficulty, q.correctAnswerIndex);
    if (manager.phase === 'question') manager.submitAnswer('p0', (q.correctAnswerIndex + 1) % 4);
    for (const p of ctx.players.filter((p) => p.bot)) for (let i = 0; i < 4; i++) if (ctx.input.get(p.id).justPressed(`answer${'ABCD'[i]}`)) { answers++; manager.submitAnswer(p.id, i); }
    manager.update(0.05); ctx.input.update();
  }
  assert.equal(manager.finished, true); assert.equal(manager.questionIndex, 9); assert.equal(answers, 30);
  const results = manager.buildResults(); assert.equal(results.length, 4); assert.ok(results.some((r) => r.playerId !== 'p0' && r.score > 0)); assert.ok(results.filter((r) => r.playerId !== 'p0').every((r) => r.score < 55));
  assert.equal(ctx.input.get('p0').justPressed('answerA'), false);
  console.log('PASS quiz: 10 complete questions, 30 delayed bot responses, imperfect scores, no human input');
}
{
  const ctx = context(), bots = new PartyBots(ctx, 124); let count = 0;
  for (let i = 0; i < 100; i++) { bots.reaction(0.01, 'waiting', 1); for (const p of ctx.players) assert.equal(ctx.input.get(p.id).justPressed('action'), false); ctx.input.update(); }
  for (let i = 0; i < 100; i++) { bots.reaction(0.01, 'via', 1); for (const p of ctx.players) if (ctx.input.get(p.id).justPressed('action')) count++; ctx.input.update(); }
  assert.equal(count, 3); bots.reaction(0, 'via', 1); assert.equal(ctx.input.get('p1').justPressed('action'), false);
  const ps = ctx.players.map((snap) => ({ snap, alive: true, resolved: false, inputIndex: 0, pausedUntil: 0 }));
  bots.memory(0.01, 'observe', 0, [2, 1, 3], ps, 0);
  for (let i = 0; i < 500; i++) { bots.memory(0.01, 'repeat', 0, [], ps, 10); for (const p of ps) for (let c = 0; c < 4; c++) if (ctx.input.get(p.snap.id).justPressed(`c${c}`)) { assert.equal(c, [2, 1, 3][p.inputIndex]); p.inputIndex++; p.resolved = p.inputIndex === 3; } ctx.input.update(); }
  assert.ok(ps.filter((p) => p.snap.bot).every((p) => p.resolved)); assert.equal(ps[0].inputIndex, 0);
  for (let i = 0; i < 1000; i++) { bots.cultura(0.01, 'bluff', 0, ['fake1','fake2','fake3'], [], new Map()); ctx.input.update(); }
  assert.deepEqual(ctx.players.filter((p) => p.bot).map((p) => ctx.input.get(p.id).text('bluff')), ['fake1','fake2','fake3']);
  const opts = [{ownerId:'p1',isCorrect:false},{ownerId:'p2',isCorrect:false},{ownerId:'p3',isCorrect:false},{ownerId:null,isCorrect:true}];
  for (let i = 0; i < 600; i++) bots.cultura(0.01, 'vote', 0, [], opts, new Map());
  for (const p of ctx.players.filter((p) => p.bot)) { const vote = Number(ctx.input.get(p.id).text('vote')); assert.ok(Number.isInteger(vote)); assert.notEqual(opts[vote].ownerId, p.id); }
  console.log('PASS reaction, memory and cultura: no false start, observed tiles, completed sequences, unique bluffs, valid votes');
}
{
  const ctx = context(), bot = new MotionBots(ctx, 5), spline = buildTrack(), kart = createKartState('p1', 'buttafuori', '#fff', '');
  kart.distance = -1; kart.absHeading = spline.tangentAngleAt(kart.distance);
  const race = new RaceManager(buildCheckpoints(spline), spline.totalLength, 150, (d) => spline.tangentAngleAt(d), () => {});
  let road = 0, frames = 0;
  for (let t = 0; t < 160 && race.phase !== 'ended'; t += 1/60) {
    race.update(1/60, [kart], (id) => ctx.input.get(id).pressed('up'));
    if (race.phase === 'racing') {
      bot.kart(1/60, [kart], spline); const input = ctx.input.get('p1');
      stepKartPhysics(kart, {left:false,right:false,up:input.pressed('up'),down:input.pressed('down'),drift:input.pressed('drift'),item:false,steer:input.axis('steer').x,driftReleased:input.justReleased('drift')}, 1/60, (d) => spline.widthAt(d)/2, (d) => spline.tangentAngleAt(d), false);
      frames++; if (!kart.offRoad) road++;
    } ctx.input.update();
  }
  console.log('Kart simulation', {lap:kart.lap, distance:kart.distance, finished:kart.finished, onRoad:road/frames, time:race.raceTime});
  assert.ok(kart.finished && kart.lap >= 3, 'bot completes actual track with actual physics'); assert.ok(road/frames > 0.9);
}
{
  const ctx = context(), bots = new MotionBots(ctx, 22);
  const players = [{id:'p0',x:20,z:20,yaw:0,pitch:0,alive:true,magazine:10,spawnProtection:0},{id:'p1',x:-20,z:-20,yaw:0,pitch:0,alive:true,magazine:10,spawnProtection:0}];
  let fires = 0;
  for (let i = 0; i < 1800; i++) {
    bots.fps(1/60, players); const p=players[1], inp=ctx.input.get('p1'), mv=inp.axis('move');
    const ax=-mv.y*Math.sin(p.yaw)+mv.x*Math.cos(p.yaw),az=-mv.y*Math.cos(p.yaw)-mv.x*Math.sin(p.yaw);
    p.yaw=inp.axis('look').x; const next=resolveCollisions(p.x+ax*9/60,p.z+az*9/60,.7,FPS_MAP.obstacles); p.x=next.x; p.z=next.z;
    if(inp.pressed('fire'))fires++;ctx.input.update();
  }
  console.log('FPS navigation',players[1],{fires}); assert.ok(fires>20, 'routes around containers to a visible opponent and fires'); assert.ok(Math.hypot(players[1].x+20,players[1].z+20)>20);
  assert.equal(ctx.input.get('p0').pressed('fire'),false);
}
{
  const ctx = context(); ctx.modifier = { id: 'controlli_invertiti' } as MinigameContext['modifier'];
  const bots = new MotionBots(ctx, 7);
  const p = { id:'p1',x:5,z:4,alive:true,hasBall:false,truckBalls:[] } as unknown as import('../src/minigames/dodgeball/dodgeballTypes').DodgeballPlayer;
  const b = {x:0,z:0,state:'free'} as import('../src/minigames/dodgeball/dodgeballTypes').Ball;
  bots.dodgeball(.05,[p],[b]);
  assert.ok(ctx.input.get('p1').axis('move').x > 0 && ctx.input.get('p1').axis('move').y < 0, 'bot compensates inverted movement controls');
  const p2 = { id:'p0',x:2,z:0,yaw:0,pitch:0,alive:true,magazine:10,spawnProtection:0 };
  const p1 = { id:'p1',x:-2,z:0,yaw:Math.PI/2,pitch:0,alive:true,magazine:10,spawnProtection:0 };
  for(let i=0;i<20;i++){bots.fps(.05,[p1,p2]);assert.equal(ctx.input.get('p1').pressed('fire'),false,'no firing through central container');ctx.input.update();}
}
console.log('SOLO BOTS SELFTEST PASS');
