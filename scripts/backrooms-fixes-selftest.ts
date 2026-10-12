import assert from 'node:assert/strict';
import { PlayerInput } from '../src/network/PlayerInput';
import { BackroomsInteractionInput } from '../src/minigames/backrooms/backroomsInput';
import { BackroomsMatch, type CreatureKind, type Command } from '../src/minigames/backrooms/backroomsRules';
import { freshMazeSeed, topologySignature, generateMaze, center, lineOfSight, distances } from '../src/minigames/backrooms/maze';
const empty: Command = { x: 0, z: 0, lookX: 0, lookY: 0, sprint: false, interact: false, held: false };
let count = 0;
const test = (name: string, f: () => void) => { f(); count++; console.log('PASS', name); };
const advance = (m: BackroomsMatch, sec: number) => { for (let i = 0; i < sec * 60; i++) m.advance(1 / 60); };
function fixture(kind: CreatureKind) {
  const m = new BackroomsMatch([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], 2, { monsters: [kind] });
  m.intro = 0; m.time = 20; m.maze.doors.forEach(d => d.open = true);
  const c = m.monsters[0], p = m.players[0]; m.players[1].hiding = true;
  Object.assign(c, { x: 8, z: 8, yaw: 0, timer: 0, destination: m.maze.spawn });
  Object.assign(p, { x: 8, z: 10.5, immunity: 0 }); return { m, c, p };
}
test('input: brief tap survives clearFrame; next tap without neutral frame; held and repeated substeps; cancellation and new input', () => {
  const cursor = new BackroomsInteractionInput(), input = new PlayerInput(); cursor.sync('a', input);
  input.tap('interact'); input.clearFrame(); assert.equal(cursor.read('a', input), 1); assert.equal(cursor.read('a', input), 0);
  input.tap('interact'); assert.equal(cursor.read('a', input), 1);
  input.setDown('interact'); assert.equal(cursor.read('a', input), 1); assert.equal(cursor.read('a', input), 0);
  input.setUp('interact'); input.tap('interact'); input.tap('interact'); assert.equal(cursor.read('a', input), 2);
  input.tap('interact'); input.cancelAll(); assert.equal(cursor.read('a', input), 0);
  input.cancelAll(); input.tap('interact'); assert.equal(cursor.read('a', input), 1);
  const replaced = new PlayerInput(); replaced.tap('interact'); assert.equal(cursor.read('a', replaced), 1);
});
test('two taps in one slow frame toggle door twice; hold never toggles again; blocked closure explains cause', () => {
  const { m, p } = fixture('runner'); m.monsters.length = 0; const d = m.maze.doors[0], pos = center(m.maze, d.cell);
  Object.assign(p, { x: pos.x - (d.horizontal ? 0 : 1), z: pos.z - (d.horizontal ? 1 : 0), yaw: d.horizontal ? 0 : Math.PI / 2, pitch: 0 }); d.open = false;
  assert.equal(m.prompt(p)?.kind, 'door'); m.command(p.id, { ...empty, interact: true, presses: 2 }); m.advance(.25); assert.equal(d.open, false);
  m.command(p.id, { ...empty, interact: true, held: true }); m.advance(.25); assert.equal(d.open, true); advance(m, 1); assert.equal(d.open, true);
  Object.assign(p, pos); m.command(p.id, { ...empty, interact: true }); m.advance(.02); assert.equal(d.open, true); assert.match(p.notice, /OCCUPATO/);
});
test('locked exit is explained before press; out-of-range action gives feedback', () => {
  const { m, p } = fixture('runner'); m.monsters.length = 0; m.unlocked = false;
  Object.assign(p, center(m.maze, m.maze.exit)); assert.match(m.prompt(p)!.text, /BLOCCATA/);
  Object.assign(p, center(m.maze, m.maze.spawn)); p.yaw = Math.PI; m.command(p.id, { ...empty, interact: true }); m.advance(.02); assert.match(p.notice, /GUARDA/);
});
for (const kind of ['stalker', 'runner', 'imitator'] as const) {
  test(`${kind}: no 360-degree proximity sight, standing/walking behind, 105-degree cone boundary and light range`, () => {
    const { m, c, p } = fixture(kind); p.z = 7.5; assert.equal(m.canSee(c, p), false); m.advance(.016); assert.equal(c.target, null); assert.equal(p.lives, 2);
    c.yaw = 0; for (let i = 0; i < 6; i++) { p.x = 8 + i * .03; assert.equal(m.canSee(c, p), false); }
    p.x = c.x + Math.sin(54 * Math.PI / 180); p.z = c.z + Math.cos(54 * Math.PI / 180); assert.equal(m.canSee(c, p), false);
    p.x = c.x + Math.sin(50 * Math.PI / 180); p.z = c.z + Math.cos(50 * Math.PI / 180); assert.equal(m.canSee(c, p), true);
  });
  test(`${kind}: real front acquisition, latency, last seen snapshot, unobserved movement/noise cannot overwrite, finite search and reacquisition`, () => {
    const { m, c, p } = fixture(kind); assert.ok(m.canSee(c, p)); m.advance(.016); assert.equal(c.target, p.id); assert.equal(c.state, 'watch');
    advance(m, m.senses[kind].reaction + .05); assert.equal(c.state, 'chase'); const snapshot = { ...c.memory! };
    const occluded = m.maze.cells.find(cell => !lineOfSight(m.maze, c, center(m.maze, cell)))!;
    Object.assign(p, center(m.maze, occluded)); m.advance(.016); assert.equal(c.state, 'search'); assert.deepEqual(c.memory, snapshot);
    p.x += .1; (m as any).noise.push({ point: { x: p.x, z: p.z }, id: p.id, loud: 100, time: m.time }); m.advance(.016);
    assert.deepEqual(c.memory, snapshot); assert.notDeepEqual(c.memory, { x: p.x, z: p.z });
    p.hiding = true; advance(m, m.senses[kind].search + .1); assert.equal(c.target, null); assert.equal(c.memory, null);
    Object.assign(c, { x: 8, z: 8, yaw: 0 }); Object.assign(p, { x: 8, z: 10.5, hiding: false }); m.advance(.016); assert.equal(c.target, p.id);
  });
  test(`${kind}: dim rooms shorten visual range, sprint exposes player, immunity suppresses acquisition`, () => {
    const { m, c, p } = fixture(kind);
    let pair: [number, number] | undefined;
    for (const a of m.maze.cells) {
      const b = m.maze.cells.find(b => { const x=center(m.maze,a), y=center(m.maze,b), d=Math.hypot(x.x-y.x,x.z-y.z); return d>8 && d<13 && lineOfSight(m.maze,x,y); });
      if (b !== undefined) { pair=[a,b]; break; }
    }
    assert.ok(pair); Object.assign(c,center(m.maze,pair[0])); Object.assign(p,center(m.maze,pair[1])); c.yaw=Math.atan2(p.x-c.x,p.z-c.z);
    m.maze.dark.add(pair[1]); assert.equal(m.canSee(c,p),false); p.running=true; assert.equal(m.canSee(c,p),true);
    p.immunity=1; assert.equal(m.canSee(c,p),false);
  });
  test(`${kind}: noise behind = suspicious/investigate approximate area, no exact target or visual memory`, () => {
    const { m, c, p } = fixture(kind); p.z = 7;
    (m as any).noise.push({ point: { x: p.x, z: p.z }, id: p.id, loud: 17, time: m.time + .001 }); m.advance(.016);
    assert.equal(c.state, 'suspicious'); assert.equal(c.target, null); assert.equal(c.memory, null); assert.equal(c.seen, false); assert.equal(c.noiseArea!.radius, 3.2);
    const area = { ...c.noiseArea! }; assert.notDeepEqual({ x: area.x, z: area.z }, { x: p.x, z: p.z });
    p.hiding = true; advance(m, .5); assert.equal(c.state, 'investigate'); assert.equal(c.target, null);
    Object.assign(p, center(m.maze, m.maze.exit)); advance(m, .3); assert.deepEqual(c.noiseArea, area); assert.equal(c.target, null);
    advance(m, 7); assert.equal(c.noiseArea, null); assert.equal(c.target, null);
  });
  test(`${kind}: wall and closed door block sight AND contact capture; open door restores sight`, () => {
    const { m, c, p } = fixture(kind); const d = m.maze.doors[0], a = center(m.maze, d.cell);
    Object.assign(c, { x: a.x - (d.horizontal ? 0 : .25), z: a.z - (d.horizontal ? .25 : 0), yaw: d.horizontal ? 0 : Math.PI / 2 });
    Object.assign(p, { x: a.x + (d.horizontal ? 0 : .25), z: a.z + (d.horizontal ? .25 : 0) });
    d.open = false; assert.equal(m.canSee(c, p), false);
    Object.assign(c, { state: 'chase', target: p.id, seen: true, memory: { x: p.x, z: p.z }, memoryTime: m.time });
    m.advance(.001); assert.equal(p.lives, 2); assert.equal(c.state, 'search'); // AI can open a door physically, but cannot capture unseen through it.
    d.open = true; assert.ok(m.canSee(c, p)); advance(m,m.senses[kind].reaction+.08); assert.equal(p.lives, 1);
    const hiddenCell = m.maze.cells.find(cell => !lineOfSight(m.maze, c, center(m.maze, cell)))!;
    Object.assign(p, { ...center(m.maze, hiddenCell), state: 'exploring', immunity: 0 }); c.yaw = Math.atan2(p.x-c.x,p.z-c.z); assert.equal(m.canSee(c,p),false);
  });
  test(`${kind}: hide entry really witnessed through interaction; unseen hiding remains unknown; stable visible target in multiplayer`, () => {
    const { m, c, p } = fixture(kind); const h = center(m.maze, m.maze.refuges[0]);
    Object.assign(p, { ...h, yaw: Math.atan2(.9,.38), immunity: 0 }); Object.assign(c, { x: p.x, z: p.z - 1.2, yaw: 0 });
    assert.equal(m.prompt(p)?.kind, 'hide'); m.command(p.id, { ...empty, interact: true }); m.advance(.016);
    assert.equal(p.hiding, true); assert.equal(c.witness,p.id); assert.equal(c.target,p.id); advance(m,1.2); assert.equal(p.lives,1);
    const f = fixture(kind); f.p.hiding = true; f.c.z=f.p.z-.4; advance(f.m,.2); assert.equal(f.p.lives,2); assert.equal(f.c.target,null);
    const g=fixture(kind); g.m.advance(.016); const other=g.m.players[1]; Object.assign(other,{x:8,z:9.5,hiding:false,immunity:0}); g.m.advance(.016); assert.equal(g.c.target,g.p.id);
  });
}
test('1000 consecutive new matches per 2–5 count: fresh seed/topology, replay deterministic, objective reachability, respawn retains same maze', () => {
  for (const n of [2,3,4,5]) {
    let previous=-1, signature='';
    for(let i=0;i<1000;i++) {
      // Force duplicate initial numeric seed, so the production guard actually has to regenerate.
      const seed=freshMazeSeed(i%2 ? previous : i+1,n,previous,signature), maze=generateMaze(seed,n), topo=topologySignature(maze);
      assert.notEqual(seed,previous); assert.notEqual(topo,signature); assert.deepEqual(maze,generateMaze(seed,n));
      const reachable=distances(maze,maze.spawn); for(const c of [maze.exit,maze.key,...maze.tasks,...maze.refuges])assert.ok(reachable.has(c));
      assert.equal(reachable.size,maze.cells.length); previous=seed;signature=topo;
    }
  }
  const {m,p,c}=fixture('runner'), maze=m.maze, before=topologySignature(maze);m.capture(p,c);advance(m,2.2);assert.equal(m.maze,maze);assert.equal(topologySignature(m.maze),before);
});
console.log(`Backrooms fixes: ${count} test groups passed`);
