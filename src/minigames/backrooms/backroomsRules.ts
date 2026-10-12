import { Rng } from '../../../shared/rng';
import type { PlayerResult } from '../../../shared/types';
import { CELL, generateMaze, center, cellAt, neighbors, route, distances, move, lineOfSight } from './maze';
import type { Maze, Point } from './maze';

export type EscapeMode = 'free' | 'key' | 'puzzle';
export type CreatureKind = 'stalker' | 'runner' | 'imitator';
export type PlayerState = 'exploring' | 'captured' | 'eliminated' | 'escaped';
export interface BackPlayer extends Point {
  id: string; name: string; bot?: boolean; yaw: number; pitch: number; lives: number;
  state: PlayerState; stateTime: number; immunity: number; stamina: number; hiding: boolean;
  visited: Set<number>; escapedAt: number; eliminatedAt: number; dx: number; dz: number;
  running: boolean; lastFoot: number; notice: string; noticeTime: number;
}
export interface Command { x: number; z: number; lookX: number; lookY: number; sprint: boolean; interact: boolean; held: boolean }
export interface Creature extends Point {
  kind: CreatureKind; yaw: number; state: 'patrol' | 'watch' | 'chase' | 'search' | 'rest';
  target: string | null; memory: Point | null; memoryTime: number; destination: number;
  path: number[]; timer: number; repath: number; foot: number; seen: boolean; revealed: boolean;
}
export interface BackEvent { type: 'capture' | 'escape' | 'step' | 'monsterStep' | 'door' | 'task' | 'key' | 'reveal'; player?: string; point: Point; kind?: CreatureKind; power?: number }
export interface BackConfig { duration?: number; mode?: EscapeMode; puzzle?: 'switches' | 'generators'; weights?: [number, number, number]; imitator?: boolean; monsters?: CreatureKind[] }
export interface Prompt { kind: 'exit' | 'key' | 'task' | 'door' | 'hide'; index: number; text: string; point: Point }
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);
export class BackroomsMatch {
  readonly maze: Maze; readonly players: BackPlayer[]; readonly monsters: Creature[];
  readonly mode: EscapeMode; readonly puzzle: 'switches' | 'generators'; readonly duration: number;
  readonly rng: Rng; tasks: number[]; taskProgress: number[]; unlocked: boolean;
  key: Point | null; keyHolder: string | null = null;
  time = 0; intro = 4; ended = false; events: BackEvent[] = []; private commands = new Map<string, Command>();
  private noise: { point: Point; id: string; loud: number; time: number }[] = [];
  private safeCells: Set<number>;
  private spawnPoints = new Map<string, Point>();
  constructor(roster: { id: string; name: string; bot?: boolean }[], seed: number, config: BackConfig = {}) {
    this.rng = new Rng(seed ^ 0x218843); this.maze = generateMaze(seed, roster.length);
    const weights = config.weights ?? [1, 1, 1];
    this.mode = config.mode ?? this.rng.weighted(['free', 'key', 'puzzle'].map((item, i) => ({ item: item as EscapeMode, weight: weights[i] })));
    this.puzzle = config.puzzle ?? this.rng.pick(['switches', 'generators']);
    this.tasks = this.mode === 'puzzle' ? this.maze.tasks.slice(0, this.puzzle === 'switches' ? 3 : 2) : [];
    this.taskProgress = this.tasks.map(() => 0); this.unlocked = this.mode === 'free';
    this.duration = clamp(config.duration ?? 420, 360, 480); this.key = this.mode === 'key' ? center(this.maze, this.maze.key) : null;
    const start = center(this.maze, this.maze.spawn);
    this.players = roster.map((p, i) => {
      const spawn = { x: start.x + (i % 3) * CELL, z: start.z + Math.floor(i / 3) * CELL }; this.spawnPoints.set(p.id, spawn);
      return { ...p, ...spawn,
      yaw: .7, pitch: 0, lives: 2, state: 'exploring', stateTime: 0, immunity: 8, stamina: 1, hiding: false,
      visited: new Set([cellAt(this.maze, spawn)]), escapedAt: Infinity, eliminatedAt: 0, dx: 0, dz: 0, running: false, lastFoot: 0, notice: '', noticeTime: 0 };
    });
    this.safeCells = new Set([...distances(this.maze, this.maze.spawn)].filter(([, d]) => d < 3).map(([c]) => c));
    const types = config.monsters ?? this.rng.shuffle<CreatureKind>(config.imitator ? ['stalker', 'runner', 'imitator'] : ['stalker', 'runner']).slice(0, roster.length < 3 && this.rng.chance(.5) ? 1 : 2);
    this.monsters = types.map((kind, i) => ({ ...center(this.maze, this.maze.monsterSpawns[i % this.maze.monsterSpawns.length]), kind,
      yaw: this.rng.next() * Math.PI * 2, state: 'patrol', target: null, memory: null, memoryTime: 0,
      destination: this.maze.monsterSpawns[i % this.maze.monsterSpawns.length], path: [], timer: 0, repath: 0, foot: 0, seen: false, revealed: kind !== 'imitator' }));
  }
  get remaining(): number { return Math.max(0, this.duration - this.time); }
  command(id: string, cmd: Command): void { this.commands.set(id, cmd); }
  cancel(): void { this.commands.clear(); for (const p of this.players) p.running = false; }
  prompt(p: BackPlayer): Prompt | null {
    if (p.state !== 'exploring') return null;
    if (p.hiding) return { kind: 'hide', index: -1, text: 'ESCI DAL NASCONDIGLIO', point: p };
    const targets: Prompt[] = [{ kind: 'exit', index: 0, text: this.unlocked ? 'APRI · FUGGI' : 'ESAMINA LA PORTA', point: center(this.maze, this.maze.exit) }];
    if (this.key) targets.push({ kind: 'key', index: 0, text: 'RACCOGLI LA CHIAVE', point: this.key });
    this.tasks.forEach((cell, i) => { if (this.taskProgress[i] < 1) targets.push({ kind: 'task', index: i, text: this.puzzle === 'switches' ? 'ATTIVA INTERRUTTORE' : `TIENI · RIPRISTINA GENERATORE ${Math.round(this.taskProgress[i] * 100)}%`, point: center(this.maze, cell) }); });
    this.maze.doors.forEach((door, i) => targets.push({ kind: 'door', index: i, text: door.open ? 'CHIUDI LA PORTA' : 'APRI LA PORTA', point: center(this.maze, door.cell) }));
    this.maze.refuges.forEach((c, i) => targets.push({ kind: 'hide', index: i, text: 'NASCONDITI · RESTA IN SILENZIO', point: center(this.maze, c) }));
    return targets.filter(t => {
      const d = dist(p, t.point); return d < 2.1 && (d < .8 || (Math.sin(p.yaw) * (t.point.x - p.x) + Math.cos(p.yaw) * (t.point.z - p.z)) / d > .5) &&
        (t.kind === 'door' || lineOfSight(this.maze, p, t.point));
    }).sort((a, b) => dist(p, a.point) - dist(p, b.point))[0] ?? null;
  }
  advance(dt: number): void {
    if (this.ended) return;
    for (let left = Math.min(.25, Math.max(0, dt)); left > 1e-8; left -= 1 / 60) this.tick(Math.min(left, 1 / 60));
  }
  private tick(dt: number): void {
    if (this.intro > 0) { this.intro = Math.max(0, this.intro - dt); return; }
    this.time += dt; this.noise = this.noise.filter(n => this.time - n.time < .8);
    for (const p of this.players) {
      p.immunity = Math.max(0, p.immunity - dt); p.noticeTime = Math.max(0, p.noticeTime - dt); p.stateTime += dt;
      if (p.state === 'captured' && p.stateTime > 2.1) {
        const pos = this.spawnPoints.get(p.id)!; p.x = pos.x; p.z = pos.z; p.yaw = .7; p.pitch = 0;
        p.state = 'exploring'; p.stateTime = 0; p.immunity = 7; p.stamina = 1; p.hiding = false;
        this.commands.delete(p.id); this.notify(p, 'ULTIMA POSSIBILITÀ · SEI PROTETTO PER 7s');
      }
      if (p.state !== 'exploring') { p.dx = p.dz = 0; continue; }
      const c = this.commands.get(p.id); p.dx = p.dz = 0; p.running = false;
      if (c) {
        p.yaw += clamp(c.lookX, -1, 1) * dt * 2.25; p.pitch = clamp(p.pitch + clamp(c.lookY, -1, 1) * dt * 1.6, -.95, .95);
        if (!p.hiding) {
          const len = Math.max(1, Math.hypot(c.x, c.z)), moving = Math.hypot(c.x, c.z) > .12;
          p.running = c.sprint && moving && p.stamina > .02;
          const speed = p.running ? 5.8 : 3.25, old = { x: p.x, z: p.z };
          move(this.maze, p, (Math.cos(p.yaw) * c.x + Math.sin(p.yaw) * c.z) / len * speed * dt, (-Math.sin(p.yaw) * c.x + Math.cos(p.yaw) * c.z) / len * speed * dt);
          p.dx = (p.x - old.x) / dt; p.dz = (p.z - old.z) / dt;
          if (dist(old, p) > .001 && this.time - p.lastFoot > (p.running ? .29 : .49)) {
            p.lastFoot = this.time; this.noise.push({ point: { x: p.x, z: p.z }, id: p.id, loud: p.running ? 17 : 4, time: this.time });
            this.events.push({ type: 'step', player: p.id, point: { x: p.x, z: p.z }, power: p.running ? 1 : .5 });
          }
        }
        const prompt = this.prompt(p);
        if (prompt && (c.interact || (c.held && prompt.kind === 'task' && this.puzzle === 'generators'))) this.interact(p, prompt, c, dt);
        c.interact = false; // edge consumed once even when a delayed frame runs several fixed ticks
      }
      p.stamina = clamp(p.stamina + (p.running ? -dt / 7 : dt / 5), 0, 1);
      p.visited.add(cellAt(this.maze, p));
    }
    for (const monster of this.monsters) this.updateMonster(monster, dt);
    if (this.time >= this.duration || this.players.every(p => p.state === 'escaped' || p.state === 'eliminated')) this.ended = true;
  }
  private notify(p: BackPlayer, text: string): void { p.notice = text; p.noticeTime = 4; }
  private interact(p: BackPlayer, t: Prompt, c: Command, dt: number): void {
    if (t.kind === 'hide' && c.interact) { p.hiding = !p.hiding; p.running = false; this.notify(p, p.hiding ? 'TRATTIENI IL RESPIRO · A/✕ PER USCIRE' : 'SEI USCITO'); }
    if (t.kind === 'door' && c.interact) {
      const door = this.maze.doors[t.index], pos = center(this.maze, door.cell);
      const overlaps = (v: Point) => door.horizontal ? Math.abs(v.z - pos.z) < .46 && Math.abs(v.x - pos.x) < CELL / 2 + .32 : Math.abs(v.x - pos.x) < .46 && Math.abs(v.z - pos.z) < CELL / 2 + .32;
      if (door.open && (this.players.some(v => v.state === 'exploring' && overlaps(v)) || this.monsters.some(overlaps))) { this.notify(p, 'PASSAGGIO OCCUPATO'); return; }
      door.open = !door.open; this.events.push({ type: 'door', player: p.id, point: pos });
      this.noise.push({ point: pos, id: p.id, loud: 10, time: this.time });
    }
    if (t.kind === 'key' && c.interact && this.key) { this.keyHolder = p.id; this.key = null; this.notify(p, 'CHIAVE RACCOLTA · TROVA LA PORTA'); this.events.push({ type: 'key', player: p.id, point: p }); }
    if (t.kind === 'task') {
      this.taskProgress[t.index] = this.puzzle === 'switches' ? 1 : Math.min(1, this.taskProgress[t.index] + dt / 2.5);
      if (this.taskProgress[t.index] === 1) { this.events.push({ type: 'task', player: p.id, point: t.point }); this.notify(p, `ALIMENTAZIONE ${this.taskProgress.filter(v => v === 1).length}/${this.tasks.length}`); }
      if (this.taskProgress.every(v => v === 1)) this.unlocked = true;
      this.noise.push({ point: t.point, id: p.id, loud: 16, time: this.time });
    }
    if (t.kind === 'exit' && c.interact) {
      if (!this.unlocked && this.keyHolder === p.id) { this.unlocked = true; this.keyHolder = null; }
      if (this.unlocked) { p.state = 'escaped'; p.stateTime = 0; p.escapedAt = this.time; p.hiding = false; this.events.push({ type: 'escape', player: p.id, point: p }); }
      else this.notify(p, this.mode === 'key' ? 'SERRATURA · SERVE UNA CHIAVE' : this.puzzle === 'switches' ? 'MANCA CORRENTE · TRE INTERRUTTORI' : 'MANCA CORRENTE · DUE GENERATORI');
    }
  }
  canSee(monster: Creature, p: BackPlayer): boolean {
    if (p.state !== 'exploring' || p.hiding || p.immunity > 0) return false;
    const d = dist(monster, p), range = this.maze.dark.has(cellAt(this.maze, p)) && !p.running ? 7 : 14;
    if (d > range) return false;
    return (d < 1.4 || (Math.sin(monster.yaw) * (p.x - monster.x) + Math.cos(monster.yaw) * (p.z - monster.z)) / d > .25) && lineOfSight(this.maze, monster, p);
  }
  private patrolCell(monster: Creature): number {
    const occupied = new Set([this.maze.exit, this.maze.key, ...this.tasks, ...this.safeCells]);
    const choices = this.maze.cells.filter(c => !occupied.has(c) && c !== cellAt(this.maze, monster));
    return this.rng.pick(choices);
  }
  private updateMonster(m: Creature, dt: number): void {
    m.timer += dt; m.repath -= dt; m.foot += dt;
    if (m.state === 'rest') { if (m.timer > 5) { m.state = 'patrol'; m.timer = 0; m.destination = this.patrolCell(m); } else return; }
    if (m.kind === 'imitator' && !m.revealed && this.players.some(p => p.state === 'exploring' && !p.hiding && dist(m, p) < 4 && lineOfSight(this.maze, m, p))) {
      m.revealed = true; this.events.push({ type: 'reveal', point: { x: m.x, z: m.z }, kind: m.kind });
    }
    const visible = this.players.filter(p => this.canSee(m, p)).sort((a, b) => dist(a, m) - dist(b, m))[0];
    if (visible) {
      m.target = visible.id; m.memory = { x: visible.x, z: visible.z }; m.memoryTime = this.time; m.seen = true;
      if (m.kind === 'imitator' && !m.revealed && dist(m, visible) < 4) { m.revealed = true; this.events.push({ type: 'reveal', point: m, kind: m.kind }); }
      if (m.state !== 'chase' && m.state !== 'watch') { m.state = m.kind === 'stalker' ? 'watch' : 'chase'; m.timer = 0; m.path = []; }
      if (m.state === 'watch' && m.timer > 1.6) { m.state = 'chase'; m.timer = 0; }
    } else {
      if (m.state === 'chase' || m.state === 'watch') { m.state = 'search'; m.timer = 0; }
      // A noise carries a snapshot, never a reference to the player's continuing location.
      const sounds = this.noise.filter(n => {
        if ((this.players.find(p => p.id === n.id)?.immunity ?? 0) > 0) return false;
        const d = dist(m, n.point); return d < n.loud * (m.kind === 'runner' ? 1 : .6) && (lineOfSight(this.maze, m, n.point) || d < n.loud * .55);
      }).sort((a, b) => b.time - a.time);
      if (sounds.length && sounds[0].time > m.memoryTime) {
        m.memory = { ...sounds[0].point }; m.memoryTime = sounds[0].time;
        m.seen = m.seen && m.target === sounds[0].id; m.target = sounds[0].id; m.state = 'search';
      }
      if (m.memory && this.time - m.memoryTime > 5) { m.memory = null; m.target = null; m.state = 'patrol'; m.timer = 0; m.path = []; m.destination = this.patrolCell(m); }
    }
    if (m.state === 'watch') { if (m.memory) m.yaw = Math.atan2(m.memory.x - m.x, m.memory.z - m.z); return; }
    if (m.state === 'patrol' && (dist(m, center(this.maze, m.destination)) < .5 || m.timer > 8)) { m.destination = this.patrolCell(m); m.timer = 0; m.path = []; }
    const goal = m.memory ? cellAt(this.maze, m.memory) : m.destination;
    if (m.repath <= 0) {
      const current = cellAt(this.maze, m), waypoint = m.path[0];
      // Finish the current cell-center waypoint before turning: replanning on entry would cut solid corners.
      if (waypoint !== undefined && (waypoint === current || neighbors(this.maze, current).includes(waypoint)) && dist(m, center(this.maze, waypoint)) > .2) {
        m.path = [waypoint, ...route(this.maze, waypoint, goal).slice(1)];
      } else m.path = route(this.maze, current, goal).slice(1);
      m.repath = .45;
    }
    let aim = m.path.length ? center(this.maze, m.path[0]) : m.memory;
    if (aim && dist(m, aim) < .2 && m.path.length) { m.path.shift(); aim = m.path.length ? center(this.maze, m.path[0]) : m.memory; }
    if (aim) {
      for (const door of this.maze.doors) if (!door.open && dist(m, center(this.maze, door.cell)) < 1.7) {
        door.open = true; this.events.push({ type: 'door', point: center(this.maze, door.cell) });
      }
      const d = dist(m, aim); if (d > .03) {
        m.yaw = Math.atan2(aim.x - m.x, aim.z - m.z);
        const speed = m.kind === 'runner' ? (m.state === 'chase' ? 4.8 : 2.45) : m.kind === 'imitator' ? (m.revealed ? 3.9 : 2.4) : (m.state === 'chase' ? 3.45 : 1.35);
        const next = { x: m.x, z: m.z }; move(this.maze, next, (aim.x - m.x) / d * Math.min(d, speed * dt), (aim.z - m.z) / d * Math.min(d, speed * dt));
        const protectedEntry = this.time < 8 && this.safeCells.has(cellAt(this.maze, next)) && !this.safeCells.has(cellAt(this.maze, m));
        // No initial incursion. Later paths can traverse spawn; individual respawn immunity prevents cheap captures.
        if (!protectedEntry) { m.x = next.x; m.z = next.z; }
        else { m.memory = null; m.target = null; m.state = 'rest'; m.timer = 0; }
        if (m.foot > (m.kind === 'runner' ? .33 : .65)) { m.foot = 0; this.events.push({ type: 'monsterStep', point: { x: m.x, z: m.z }, kind: m.kind }); }
      }
    }
    for (const p of this.players) {
      // A recent pursuit can expose a hiding player at the remembered entry point, never elsewhere through walls.
      const exposed = !p.hiding || (m.target === p.id && m.seen && this.time - m.memoryTime < 4 && m.memory && dist(p, m.memory) < .8);
      if (p.state === 'exploring' && p.immunity <= 0 && exposed && dist(m, p) < .7 && lineOfSight(this.maze, m, p)) this.capture(p, m);
    }
  }
  capture(p: BackPlayer, m: Creature): void {
    if (p.state !== 'exploring' || p.immunity > 0) return;
    if (this.keyHolder === p.id) { this.key = { x: p.x, z: p.z }; this.keyHolder = null; }
    p.lives--; p.state = p.lives ? 'captured' : 'eliminated'; p.stateTime = 0; p.hiding = false;
    p.dx = p.dz = 0; p.running = false; p.eliminatedAt = this.time; this.commands.delete(p.id);
    this.events.push({ type: 'capture', player: p.id, point: { x: p.x, z: p.z }, kind: m.kind, power: this.rng.next() });
    m.state = 'rest'; m.timer = 0; m.target = null; m.memory = null; m.path = [];
  }
  results(): PlayerResult[] {
    const sorted = [...this.players].sort((a, b) => {
      const category = (p: BackPlayer) => p.state === 'escaped' ? 0 : p.state === 'eliminated' ? 2 : 1;
      return category(a) - category(b) || (a.state === 'escaped' ? a.escapedAt - b.escapedAt : a.state === 'eliminated' ? b.eliminatedAt - a.eliminatedAt : b.lives - a.lives || b.visited.size - a.visited.size) || this.players.indexOf(a) - this.players.indexOf(b);
    });
    return sorted.map((p, i) => ({ playerId: p.id, placement: i + 1, score: p.state === 'escaped' ? 10000 - Math.floor(p.escapedAt) : p.lives * 1000 + p.visited.size,
      stats: [p.state === 'escaped' ? `Fuga ${p.escapedAt.toFixed(1)}s` : p.state === 'eliminated' ? 'Due catture · eliminato' : `${p.lives} ${p.lives === 1 ? 'vita' : 'vite'} · ${p.visited.size} ${p.visited.size === 1 ? 'zona esplorata' : 'zone esplorate'}`] }));
  }
}

/** Same locomotion/interaction rules as humans; navigation does not teleport or grant immunity. */
export class BackroomsBots {
  private goals = new Map<string, number>(); private known = new Map<string, Set<number>>();
  private waypoints = new Map<string, number>(); private previousGoals = new Map<string, number>();
  command(p: BackPlayer, match: BackroomsMatch): Command {
    const neutral: Command = { x: 0, z: 0, lookX: 0, lookY: 0, sprint: false, interact: false, held: false };
    if (p.state !== 'exploring') return neutral;
    const m = match.maze, known = this.known.get(p.id) ?? new Set<number>(); this.known.set(p.id, known);
    for (const c of [m.exit, ...(match.key ? [cellAt(m, match.key)] : []), ...match.tasks]) if (dist(p, center(m, c)) < 8 && lineOfSight(m, p, center(m, c))) known.add(c);
    const prompt = match.prompt(p);
    if (prompt && ['door', 'task', 'key', 'exit'].includes(prompt.kind) && !(prompt.kind === 'door' && m.doors[prompt.index].open) && !(prompt.kind === 'exit' && !match.unlocked && match.keyHolder !== p.id)) return { ...neutral, interact: true, held: true };
    let goal = this.goals.get(p.id);
    const keyCell = match.key ? cellAt(m, match.key) : -1;
    const objectives = [
      ...(known.has(m.exit) && (match.unlocked || match.keyHolder === p.id) ? [m.exit] : []),
      ...(keyCell >= 0 && known.has(keyCell) ? [keyCell] : []),
      ...match.tasks.filter((c, i) => known.has(c) && match.taskProgress[i] < 1)
    ];
    if (objectives.length) goal = objectives[0];
    if (goal === undefined || (!objectives.length && p.visited.has(goal) && dist(p, center(m, goal)) < .25)) {
      const d = distances(m, cellAt(m, p)); const unvisited = [...d].filter(([c]) => !p.visited.has(c)).sort((a, b) => a[1] - b[1]);
      goal = unvisited[0]?.[0] ?? m.exit; this.goals.set(p.id, goal);
    }
    let waypoint = this.waypoints.get(p.id);
    if (this.previousGoals.get(p.id) !== goal || waypoint === undefined || dist(p, center(m, waypoint)) > CELL * 2) {
      waypoint = cellAt(m, p); this.previousGoals.set(p.id, goal);
    }
    if (dist(p, center(m, waypoint)) < .13) waypoint = route(m, waypoint, goal)[1] ?? goal;
    this.waypoints.set(p.id, waypoint);
    const target = center(m, waypoint);
    const yaw = Math.atan2(target.x - p.x, target.z - p.z), error = Math.atan2(Math.sin(yaw - p.yaw), Math.cos(yaw - p.yaw));
    neutral.lookX = clamp(error * 2, -1, 1);
    const d = Math.max(.01, dist(p, target)), worldX = (target.x - p.x) / d, worldZ = (target.z - p.z) / d;
    neutral.x = Math.cos(p.yaw) * worldX - Math.sin(p.yaw) * worldZ;
    neutral.z = Math.sin(p.yaw) * worldX + Math.cos(p.yaw) * worldZ;
    // Close doors/objectives are faced before interaction, rather than activating through walls.
    const nearby = [...m.doors.filter(d => !d.open).map(d => center(m, d.cell)), ...objectives.map(c => center(m, c))].find(v => dist(p, v) < 1.9);
    if (nearby) { const e = Math.atan2(nearby.x - p.x, nearby.z - p.z) - p.yaw; neutral.lookX = clamp(Math.atan2(Math.sin(e), Math.cos(e)) * 3, -1, 1); }
    neutral.sprint = match.monsters.some(v => dist(v, p) < 6 && lineOfSight(m, v, p)) && p.stamina > .25;
    return neutral;
  }
}
