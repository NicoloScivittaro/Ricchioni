import assert from 'node:assert/strict';
import { generateMaze, distances, center, canStand, route, lineOfSight, move, cellAt } from '../src/minigames/backrooms/maze';
import { BackroomsMatch, BackroomsBots } from '../src/minigames/backrooms/backroomsRules';
import type { Command } from '../src/minigames/backrooms/backroomsRules';
let checks = 0;
function test(name: string, fn: () => void) { fn(); checks++; console.log('PASS', name); }
const roster = (n = 5) => Array.from({ length: n }, (_, i) => ({ id: String(i), name: `P${i}`, bot: true }));
const empty: Command = { x: 0, z: 0, lookX: 0, lookY: 0, sprint: false, interact: false, held: false };
const advance = (m: BackroomsMatch, seconds: number) => { for (let i = 0; i < seconds * 60; i++) m.advance(1 / 60); };
test('1000 seed × 2–5: connected maze, all objectives, protected spawn, reproducibility, distinct topology', () => {
  const topologies = new Set<string>();
  for (let seed = 1; seed <= 1000; seed++) for (const n of [2, 3, 4, 5]) {
    const m = generateMaze(seed, n), d = distances(m, m.spawn);
    assert.equal(d.size, m.cells.length);
    for (const c of [m.exit, m.key, ...m.tasks, ...m.refuges, ...m.monsterSpawns]) { assert.ok(d.has(c)); assert.ok(canStand(m, center(m, c), .32, true)); }
    assert.ok(m.monsterSpawns.every(c => d.get(c)! >= 14));
    assert.deepEqual(m.floor, generateMaze(seed, n).floor);
    if (n === 5) topologies.add(Array.from(m.floor).join(''));
  }
  assert.equal(topologies.size, 1000);
});
test('wall sweep, closed-door collision + LOS, opening restores passage, navigation along corridor', () => {
  let m = generateMaze(2); for (let seed = 3; !m.doors.length; seed++) m = generateMaze(seed);
  const door = m.doors[0], p = center(m, door.cell), a = { x: p.x, z: p.z }, b = { x: p.x, z: p.z };
  if (door.horizontal) { a.z -= 1; b.z += 1; } else { a.x -= 1; b.x += 1; }
  assert.equal(lineOfSight(m, a, b), false); const q = { ...a }; move(m, q, b.x - a.x, b.z - a.z); assert.ok(Math.hypot(q.x - b.x, q.z - b.z) > .4);
  door.open = true; assert.equal(lineOfSight(m, a, b), true); move(m, q, b.x - q.x, b.z - q.z); assert.ok(Math.hypot(q.x - b.x, q.z - b.z) < .01);
  const path = route(m, m.spawn, m.exit); assert.ok(path.length > 5); const moving = center(m, m.spawn);
  m.doors.forEach(d => d.open = true);
  for (const c of path.slice(1)) { const target = center(m, c); move(m, moving, target.x - moving.x, target.z - moving.z); assert.ok(Math.hypot(moving.x - target.x, moving.z - target.z) < .01); }
});
test('two captures, snapshot key drop, pickup by another, respawn immunity and no third capture', () => {
  const m = new BackroomsMatch(roster(2), 42, { mode: 'key', monsters: ['stalker'] }); m.intro = 0;
  const p = m.players[0], other = m.players[1]; Object.assign(p, center(m.maze, m.maze.key)); p.immunity = 0; m.key = null; m.keyHolder = p.id;
  const capture = { x: p.x, z: p.z }; m.capture(p, m.monsters[0]); assert.deepEqual(m.key, capture); assert.equal(p.lives, 1); assert.equal(p.state, 'captured');
  Object.assign(other, capture); m.command(other.id, { ...empty, interact: true }); m.advance(1 / 60); assert.equal(m.keyHolder, other.id);
  advance(m, 2.2); assert.equal(p.state, 'exploring'); assert.ok(p.immunity > 6); assert.equal(cellAt(m.maze, p), m.maze.spawn);
  m.capture(p, m.monsters[0]); assert.equal(p.lives, 1); p.immunity = 0; m.capture(p, m.monsters[0]); assert.equal(p.state, 'eliminated'); assert.equal(p.lives, 0);
  m.command(p.id, { ...empty, z: 1 }); const old = { x: p.x, z: p.z }; advance(m, 1); assert.deepEqual({ x: p.x, z: p.z }, old); m.capture(p, m.monsters[0]); assert.equal(p.lives, 0);
});
test('spawn has temporary grace, not permanent invulnerability; a real pursuit can capture an AFK player after grace', () => {
  const m = new BackroomsMatch(roster(2), 25, { monsters: ['runner'] }); m.intro = 0; m.time = 20;
  const p = m.players[0], c = m.monsters[0]; p.immunity = 0; Object.assign(c, { x: p.x, z: p.z + 1.2, yaw: Math.PI });
  assert.ok(m.canSee(c, p)); advance(m, .5); assert.equal(p.lives, 1); assert.equal(p.state, 'captured');
  advance(m, 2.2); assert.equal(p.state, 'exploring'); assert.ok(p.immunity > 6); assert.equal(m.canSee(c, p), false);
});
test('five spawn slots are clear, separated, retained on respawn; patrol paths can traverse spawn after initial grace', () => {
  const m = new BackroomsMatch(roster(), 12, { monsters: ['runner'] });
  const starts = m.players.map(p => ({ x: p.x, z: p.z }));
  for (const p of m.players) assert.ok(canStand(m.maze, p));
  for (let i = 0; i < starts.length; i++) for (let j = i + 1; j < starts.length; j++) assert.ok(Math.hypot(starts[i].x - starts[j].x, starts[i].z - starts[j].z) >= 3.19);
  m.intro = 0; m.time = 20; const p = m.players[4]; p.immunity = 0; Object.assign(p, center(m.maze, m.maze.exit)); m.capture(p, m.monsters[0]); advance(m, 2.2); assert.deepEqual({ x: p.x, z: p.z }, starts[4]);
  m.players.forEach(p => p.hiding = true); const c = m.monsters[0], d = distances(m.maze, m.maze.spawn), cell = [...d].find(([, distance]) => distance === 3)![0];
  Object.assign(c, { ...center(m.maze, cell), destination: m.maze.spawn, state: 'patrol', memory: null, target: null, timer: 0, path: [] });
  advance(m, 2); assert.ok(d.get(cellAt(m.maze, c))! < 3);
});
for (const puzzle of ['switches', 'generators'] as const) test(`solvable puzzle ${puzzle}, elapsed hold, exit remains locked until complete`, () => {
  const m = new BackroomsMatch(roster(2), 18, { mode: 'puzzle', puzzle, monsters: [] }); m.intro = 0; const p = m.players[0];
  assert.equal(m.unlocked, false);
  for (const c of m.tasks) { Object.assign(p, center(m.maze, c)); m.command(p.id, { ...empty, interact: true, held: true }); advance(m, puzzle === 'generators' ? 2.6 : .1); }
  assert.ok(m.unlocked); assert.ok(m.taskProgress.every(v => v === 1));
  Object.assign(p, center(m.maze, m.maze.exit)); m.command(p.id, { ...empty, interact: true }); m.advance(.02); assert.equal(p.state, 'escaped');
});
for (const kind of ['stalker', 'runner'] as const) test(`${kind}: sees FOV, walls hide target, finite memory, non-omniscient pursuit`, () => {
  const m = new BackroomsMatch(roster(2), 5, { monsters: [kind] }); m.intro = 0; m.maze.doors.forEach(d => d.open = true);
  const monster = m.monsters[0], p = m.players[0]; p.immunity = 0; const c = m.maze.monsterSpawns[0], ns = route(m.maze, c, m.maze.exit);
  Object.assign(monster, center(m.maze, c)); Object.assign(p, center(m.maze, ns[1] ?? c)); monster.yaw = Math.atan2(p.x - monster.x, p.z - monster.z);
  assert.ok(m.canSee(monster, p)); m.advance(.02); assert.equal(monster.target, p.id); const remembered = { ...monster.memory! };
  Object.assign(p, center(m.maze, m.maze.spawn)); p.hiding = true; advance(m, .2); assert.deepEqual(monster.memory, remembered); assert.equal(monster.state, 'search');
  advance(m, m.senses[kind].search + .1); assert.equal(monster.target, null); assert.equal(monster.memory, null);
});
test('rank: escape order, living before eliminated, lives then explored when no escape, timeout', () => {
  const m = new BackroomsMatch(roster(), 8, { monsters: [] }); m.intro = 0;
  Object.assign(m.players[0], { state: 'escaped', escapedAt: 9 }); Object.assign(m.players[1], { state: 'escaped', escapedAt: 5 });
  Object.assign(m.players[2], { state: 'eliminated', lives: 0 }); m.players[3].lives = 1;
  assert.deepEqual(m.results().map(p => p.playerId), ['1', '0', '4', '3', '2']); advance(m, 421); assert.equal(m.ended, true);
});
test('hiding without witnessed entry prevents capture; sprint makes noise with a finite position snapshot', () => {
  const m = new BackroomsMatch(roster(2), 23, { monsters: ['runner'] }); m.intro = 0; m.maze.doors.forEach(d => d.open = true);
  const p = m.players[0], monster = m.monsters[0]; Object.assign(p, center(m.maze, m.maze.monsterSpawns[0])); p.immunity = 0; p.hiding = true;
  monster.x = p.x + .45; monster.z = p.z; monster.state = 'watch'; monster.timer = 0;
  advance(m, .3); assert.equal(p.lives, 2); assert.equal(m.canSee(monster, p), false);
  p.hiding = false; const path = route(m.maze, m.maze.monsterSpawns[0], m.maze.exit); Object.assign(p, center(m.maze, path[2]));
  monster.yaw = Math.atan2(monster.x - p.x, monster.z - p.z); monster.state = 'patrol';
  m.command(p.id, { ...empty, z: 1, sprint: true }); advance(m, .5); assert.ok(monster.noiseArea); assert.equal(monster.target, null); const remembered = { ...monster.noiseArea! };
  m.cancel(); Object.assign(p, center(m.maze, m.maze.spawn)); p.hiding = true; advance(m, .9); assert.notDeepEqual(monster.noiseArea, { x: p.x, z: p.z });
  assert.ok(remembered.x !== p.x || remembered.z !== p.z); advance(m, 5.2); assert.equal(monster.target, null);
});
test('Imitator stays disguised at distance, reveals only near a visible player, then uses normal capture rules', () => {
  const m = new BackroomsMatch(roster(2), 13, { monsters: ['imitator'] }); m.intro = 0; m.maze.doors.forEach(d => d.open = true);
  const c = m.monsters[0], p = m.players[0]; assert.equal(c.revealed, false);
  advance(m, .1); assert.equal(c.revealed, false); Object.assign(p, { x: c.x, z: c.z + 1 }); p.immunity = 0; p.hiding = false;
  c.yaw = 0; advance(m, .02); assert.equal(c.revealed, true); assert.ok(m.events.some(e => e.type === 'reveal'));
  m.capture(p, c); assert.equal(p.lives, 1);
});
for (const kind of ['stalker', 'runner'] as const) test(`${kind} actually traverses multiple corridor turns without cutting solid corners`, () => {
  const m = new BackroomsMatch(roster(2), 11, { monsters: [kind] }); m.intro = 0; m.players.forEach(p => p.hiding = true);
  const monster = m.monsters[0], path = route(m.maze, cellAt(m.maze, monster), m.maze.exit), goal = center(m.maze, path[Math.min(6, path.length - 1)]);
  Object.assign(monster, { state: 'search', memory: goal, memoryTime: 100, target: null });
  advance(m, 22); assert.ok(Math.hypot(monster.x - goal.x, monster.z - goal.z) < .3, JSON.stringify({monster,goal}));
});
for (const mode of ['free', 'key', 'puzzle'] as const) for (const n of [2, 3, 4, 5]) test(`${n} players ${mode}: every bot can escape with no creature interference`, () => {
  const m = new BackroomsMatch(roster(n), 204, { mode, monsters: [] }), bots = new BackroomsBots();
  for (let i = 0; i < 430 * 60 && !m.ended; i++) { for (const p of m.players) m.command(p.id, bots.command(p, m)); m.advance(1 / 60); }
  assert.ok(m.players.every(p => p.state === 'escaped'), JSON.stringify(m.players.map(p => ({ visited: p.visited.size, state: p.state }))));
});
// Milestone 4 acceptance before enabling the Imitator in integration.
for (const n of [2, 3, 4, 5]) for (const mode of ['free', 'key', 'puzzle'] as const) test(`${n} players ${mode}: real bot locomotion, natural finite finish, valid ranking`, () => {
  const m = new BackroomsMatch(roster(n), n * 100 + mode.length, { mode, monsters: ['stalker', 'runner'] }), bots = new BackroomsBots();
  for (let i = 0; i < 430 * 60 && !m.ended; i++) { for (const p of m.players) m.command(p.id, bots.command(p, m)); m.advance(1 / 60); }
  assert.ok(m.ended); assert.equal(m.results().length, n); assert.ok(m.players.every(p => p.visited.size > 1));
  console.log('  escaped', m.players.filter(p => p.state === 'escaped').length, 'at', m.time.toFixed(1));
});
console.log(`Backrooms: ${checks} test groups passed`);
