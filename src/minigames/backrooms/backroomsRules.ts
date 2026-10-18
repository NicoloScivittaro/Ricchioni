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
export interface Command { x: number; z: number; lookX: number; lookY: number; sprint: boolean; interact: boolean; held: boolean; presses?: number }
export interface Creature extends Point {
  kind: CreatureKind; yaw: number; state: 'patrol' | 'suspicious' | 'investigate' | 'watch' | 'chase' | 'search' | 'return' | 'rest';
  target: string | null; memory: Point | null; memoryTime: number; destination: number;
  noiseArea: (Point & { radius: number }) | null; noiseTime: number; witness: string | null; reason: string;
  path: number[]; timer: number; repath: number; foot: number; seen: boolean; revealed: boolean;
}
export interface BackEvent { type: 'capture' | 'escape' | 'step' | 'monsterStep' | 'door' | 'task' | 'key' | 'reveal' | 'generator'; player?: string; point: Point; kind?: CreatureKind; power?: number }
export interface BackConfig { duration?: number; mode?: EscapeMode; puzzle?: 'switches' | 'generators'; weights?: [number, number, number]; imitator?: boolean; monsters?: CreatureKind[]; senses?: Partial<Record<CreatureKind, Partial<Senses>>> }
export interface Prompt { kind: 'exit' | 'key' | 'task' | 'door' | 'hide'; index: number; text: string; point: Point }
export interface Senses { fov: number; range: number; darkRange: number; reaction: number; search: number; hearing: number; walk: number; chase: number }
export const CREATURE_SENSES: Record<CreatureKind, Senses> = {
  stalker: { fov: 105, range: 18, darkRange: 9, reaction: .7, search: 9, hearing: .95, walk: 2, chase: 4.6 },
  runner: { fov: 105, range: 18, darkRange: 9, reaction: .08, search: 8, hearing: 1.35, walk: 3, chase: 6.1 },
  imitator: { fov: 105, range: 16, darkRange: 8, reaction: .2, search: 8, hearing: 1.05, walk: 2.8, chase: 5.3 }
};
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
  readonly senses: Record<CreatureKind, Senses>;
  private spawnPoints = new Map<string, Point>();
  private promptTargets:(Omit<Prompt,'text'>&{y:number})[]=[];
  private promptDoorMazes:Maze[]=[];
  constructor(roster: { id: string; name: string; bot?: boolean }[], seed: number, config: BackConfig = {}) {
    this.senses = Object.fromEntries(Object.entries(CREATURE_SENSES).map(([k, v]) => [k, { ...v, ...config.senses?.[k as CreatureKind] }])) as Record<CreatureKind, Senses>;
    this.rng = new Rng(seed ^ 0x218843); this.maze = generateMaze(seed, roster.length);
    const weights = config.weights ?? [1, 1, 1];
    this.mode = config.mode ?? this.rng.weighted(['free', 'key', 'puzzle'].map((item, i) => ({ item: item as EscapeMode, weight: weights[i] })));
    this.puzzle = config.puzzle ?? this.rng.pick(['switches', 'generators']);
    this.tasks = this.mode === 'puzzle' ? this.maze.tasks.slice(0, this.puzzle === 'switches' ? 3 : 2) : [];
    this.taskProgress = this.tasks.map(() => 0); this.unlocked = this.mode === 'free';
    this.duration = clamp(config.duration ?? 420, 360, 480); this.key = this.mode === 'key' ? center(this.maze, this.maze.key) : null;
    const exit=center(this.maze,this.maze.exit);
    this.promptTargets=[{kind:'exit',index:0,point:{x:exit.x,z:exit.z+.55},y:1.25},
      ...this.tasks.map((cell,index)=>{const p=center(this.maze,cell);return{kind:'task' as const,index,point:{x:p.x,z:p.z+.24},y:.9};}),
      ...this.maze.doors.map((door,index)=>({kind:'door' as const,index,point:center(this.maze,door.cell),y:1.3})),
      ...this.maze.refuges.map((cell,index)=>{const p=center(this.maze,cell);return{kind:'hide' as const,index,point:{x:p.x+.9,z:p.z+.38},y:1.35};})];
    // Le porte sono gli stessi oggetti mutabili: aprirle/chiuderle resta visibile anche alle viste senza la porta bersaglio.
    this.promptDoorMazes=this.maze.doors.map((_,index)=>({...this.maze,doors:this.maze.doors.filter((_,i)=>i!==index)}));
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
      noiseArea: null, noiseTime: -Infinity, witness: null, reason: 'spawn',
      destination: this.maze.monsterSpawns[i % this.maze.monsterSpawns.length], path: [], timer: 0, repath: 0, foot: 0, seen: false, revealed: kind !== 'imitator' }));
  }
  get remaining(): number { return Math.max(0, this.duration - this.time); }
  command(id: string, cmd: Command): void {
    const pending = this.commands.get(id)?.presses ?? 0;
    this.commands.set(id, { ...cmd, presses: Math.min(16, pending + (cmd.presses ?? Number(cmd.interact))) });
  }
  cancel(): void { this.commands.clear(); for (const p of this.players) p.running = false; }
  prompt(p: BackPlayer): Prompt | null {
    if (p.state !== 'exploring') return null;
    if (p.hiding) return { kind: 'hide', index: -1, text: 'ESCI DAL NASCONDIGLIO', point: p };
    const sy=Math.sin(p.yaw),cy=Math.cos(p.yaw),cp=Math.cos(p.pitch),sp=Math.sin(p.pitch);
    let best:typeof this.promptTargets[number]|null=null,bestScore=-Infinity;
    const consider=(t:typeof this.promptTargets[number])=>{
      const dx=t.point.x-p.x,dz=t.point.z-p.z,dy=t.y-1.58,d=Math.hypot(dx,dz);if(d>=2.4)return;
      const alignment=(sy*cp*dx+cy*cp*dz-sp*dy)/Math.max(.01,Math.hypot(d,dy));if(d>=.8&&alignment<.45)return;
      const score=alignment*2-d*.15;if(!Number.isFinite(score)||score<=bestScore)return;
      if(lineOfSight(t.kind==='door'?this.promptDoorMazes[t.index]:this.maze,p,t.point)){best=t;bestScore=score;}
    };
    consider(this.promptTargets[0]);if(this.key)consider({kind:'key',index:0,point:this.key,y:.65});
    for(let i=1;i<this.promptTargets.length;i++){const t=this.promptTargets[i];if(t.kind!=='task'||this.taskProgress[t.index]<1)consider(t);}
    if(!best)return null;const t=best as typeof this.promptTargets[number];
    const text=t.kind==='exit'?(this.unlocked||this.keyHolder===p.id?'APRI · FUGGI':this.mode==='key'?'PORTA BLOCCATA · SERVE UNA CHIAVE':'PORTA BLOCCATA · MANCA CORRENTE'):
      t.kind==='key'?'RACCOGLI LA CHIAVE':t.kind==='task'?(this.puzzle==='switches'?'ATTIVA INTERRUTTORE':`TIENI PREMUTO · ATTIVA GENERATORE ${Math.round(this.taskProgress[t.index]*100)}%`):
      t.kind==='door'?(this.maze.doors[t.index].open?'CHIUDI LA PORTA':'APRI LA PORTA'):'NASCONDITI · RESTA IN SILENZIO';
    return {...t,text};
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
        c.interact = (c.presses ?? 0) > 0;
        const prompt = this.prompt(p);
        if (prompt && (c.interact || (c.held && prompt.kind === 'task' && this.puzzle === 'generators'))) this.interact(p, prompt, c, dt);
        if (c.interact && !prompt) this.notify(p, 'AVVICINATI E GUARDA L’OGGETTO');
        c.presses = Math.max(0, (c.presses ?? 0) - 1); c.interact = false;
      }
      p.stamina = clamp(p.stamina + (p.running ? -dt / 7 : dt / 5), 0, 1);
      p.visited.add(cellAt(this.maze, p));
    }
    for (const monster of this.monsters) this.updateMonster(monster, dt);
    if (this.time >= this.duration || this.players.every(p => p.state === 'escaped' || p.state === 'eliminated')) this.ended = true;
  }
  private notify(p: BackPlayer, text: string): void { p.notice = text; p.noticeTime = 4; }
  private interact(p: BackPlayer, t: Prompt, c: Command, dt: number): void {
    if (t.kind === 'hide' && c.interact) {
      if (!p.hiding) for (const m of this.monsters) if (m.state !== 'rest' && this.canSee(m, p)) {
        m.target = p.id; m.memory = { x: p.x, z: p.z }; m.memoryTime = this.time; m.seen = true; m.witness = p.id;
        this.transition(m, 'search', 'witnessed hiding');
      }
      p.hiding = !p.hiding; p.running = false; this.notify(p, p.hiding ? 'TRATTIENI IL RESPIRO · A/✕ PER USCIRE' : 'SEI USCITO'); }
    if (t.kind === 'door' && c.interact) {
      const door = this.maze.doors[t.index], pos = center(this.maze, door.cell);
      const overlaps = (v: Point) => door.horizontal ? Math.abs(v.z - pos.z) < .46 && Math.abs(v.x - pos.x) < CELL / 2 + .32 : Math.abs(v.x - pos.x) < .46 && Math.abs(v.z - pos.z) < CELL / 2 + .32;
      if (door.open && (this.players.some(v => v.state === 'exploring' && overlaps(v)) || this.monsters.some(overlaps))) { this.notify(p, 'PASSAGGIO OCCUPATO'); return; }
      door.open = !door.open; this.events.push({ type: 'door', player: p.id, point: pos });
      this.noise.push({ point: pos, id: p.id, loud: 10, time: this.time });
    }
    if (t.kind === 'key' && c.interact && this.key) { this.keyHolder = p.id; this.key = null; this.notify(p, 'CHIAVE RACCOLTA · TROVA LA PORTA'); this.events.push({ type: 'key', player: p.id, point: p }); }
    if (t.kind === 'task') {
      if (this.puzzle === 'generators' && this.time - p.lastFoot > .28) {
        p.lastFoot = this.time; this.events.push({ type: 'generator', player: p.id, point: t.point, power: this.taskProgress[t.index] });
      }
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
  perception(monster: Creature, p: BackPlayer): { visible: boolean; los: boolean; reason: string } {
    const los = lineOfSight(this.maze, monster, p), senses = this.senses[monster.kind];
    if (p.state !== 'exploring' || p.hiding || p.immunity > 0) return { visible: false, los, reason: p.hiding ? 'hidden' : 'inactive/protected' };
    const d = dist(monster, p), range = this.maze.dark.has(cellAt(this.maze, p)) && !p.running ? senses.darkRange : senses.range;
    if (d > range) return { visible: false, los, reason: 'range/light' };
    const dot = (Math.sin(monster.yaw) * (p.x - monster.x) + Math.cos(monster.yaw) * (p.z - monster.z)) / Math.max(.00001, d);
    if (dot < Math.cos(senses.fov * Math.PI / 360)) return { visible: false, los, reason: 'outside FOV' };
    return { visible: los, los, reason: los ? 'visual acquisition' : 'occluded' };
  }
  canSee(monster: Creature, p: BackPlayer): boolean { return this.perception(monster, p).visible; }
  private transition(m: Creature, state: Creature['state'], reason: string): void {
    if (m.state === state) return;
    m.state = state; m.reason = reason; m.timer = 0; m.path = []; m.repath = 0;
  }
  private forget(m: Creature): void { m.target = null; m.memory = null; m.seen = false; m.witness = null; }
  private patrolCell(monster: Creature): number {
    const occupied = new Set([this.maze.exit, this.maze.key, ...this.tasks, ...this.safeCells]);
    const choices = this.maze.cells.filter(c => !occupied.has(c) && c !== cellAt(this.maze, monster));
    return this.rng.pick(choices);
  }
  private updateMonster(m: Creature, dt: number): void {
    m.timer += dt; m.repath -= dt; m.foot += dt;
    const senses = this.senses[m.kind];
    if (m.state === 'rest') { if (m.timer > 5) this.transition(m, 'return', 'rest complete'); else return; }
    const seen = this.players.filter(p => this.canSee(m, p));
    // Keep a still-visible target: a closer bystander cannot steal a pursuit every frame.
    const visible = seen.find(p => p.id === m.target) ?? seen.sort((a, b) => dist(a, m) - dist(b, m))[0];
    if (visible) {
      m.target = visible.id; m.memory = { x: visible.x, z: visible.z }; m.memoryTime = this.time; m.seen = true; m.witness = null;
      if (m.kind === 'imitator' && !m.revealed && dist(m, visible) < 4) { m.revealed = true; this.events.push({ type: 'reveal', point: { x: m.x, z: m.z }, kind: m.kind }); }
      if (m.state !== 'chase' && m.state !== 'watch') this.transition(m, 'watch', 'visual acquisition');
      if (m.state === 'watch' && m.timer >= senses.reaction) this.transition(m, 'chase', 'visual reaction complete');
    } else {
      if (m.state === 'chase' || m.state === 'watch') this.transition(m, 'search', 'visual contact lost');
      if (m.state === 'search' && this.time - m.memoryTime > senses.search) { this.forget(m); this.transition(m, 'return', 'visual search expired'); }
      // Hearing is independent from last sight: never gives a player target or overwrites a visual snapshot.
      const sound = this.noise.filter(n => (this.players.find(p => p.id === n.id)?.immunity ?? 0) <= 0 &&
        n.time > m.noiseTime && dist(m, n.point) < n.loud * senses.hearing * (lineOfSight(this.maze, m, n.point) ? 1 : .55)).sort((a, b) => b.time - a.time)[0];
      if (sound) {
        m.noiseTime = sound.time;
        const cell = cellAt(this.maze, sound.point), region = this.rng.pick([cell, ...neighbors(this.maze, cell)]);
        m.noiseArea = { ...center(this.maze, region), radius: CELL };
        if (m.state !== 'search' && m.state !== 'investigate' && m.state !== 'suspicious') {
          this.forget(m); this.transition(m, 'suspicious', 'heard approximate noise area');
        }
      }
    }
    if (m.state === 'return') {
      if (m.timer < .4) return;
      this.forget(m); m.noiseArea = null; m.destination = this.patrolCell(m); this.transition(m, 'patrol', 'resume patrol');
    }
    if (m.state === 'suspicious') {
      if (m.noiseArea) { const desired = Math.atan2(m.noiseArea.x - m.x, m.noiseArea.z - m.z), error = Math.atan2(Math.sin(desired - m.yaw), Math.cos(desired - m.yaw)); m.yaw += clamp(error, -dt * 2, dt * 2); }
      if (m.timer > .45) this.transition(m, 'investigate', 'inspect noise area'); else return;
    }
    if (m.state === 'investigate' && (!m.noiseArea || dist(m, m.noiseArea) < .4 || m.timer > 6)) { this.transition(m, 'return', 'noise investigation complete'); return; }
    if (m.state === 'watch') { if (m.memory) m.yaw = Math.atan2(m.memory.x - m.x, m.memory.z - m.z); return; }
    if (m.state === 'patrol' && (dist(m, center(this.maze, m.destination)) < .5 || m.timer > 8)) { m.destination = this.patrolCell(m); m.timer = 0; m.path = []; }
    const destination = m.state === 'investigate' ? m.noiseArea : m.memory;
    const goal = destination ? cellAt(this.maze, destination) : m.destination;
    if (m.repath <= 0) {
      const current = cellAt(this.maze, m), waypoint = m.path[0];
      // Finish the current cell-center waypoint before turning: replanning on entry would cut solid corners.
      if (waypoint !== undefined && (waypoint === current || neighbors(this.maze, current).includes(waypoint)) && dist(m, center(this.maze, waypoint)) > .2) {
        m.path = [waypoint, ...route(this.maze, waypoint, goal).slice(1)];
      } else m.path = route(this.maze, current, goal).slice(1);
      m.repath = .45;
    }
    let aim = m.path.length ? center(this.maze, m.path[0]) : destination;
    if (aim && dist(m, aim) < .2 && m.path.length) { m.path.shift(); aim = m.path.length ? center(this.maze, m.path[0]) : destination; }
    if (aim) {
      for (const door of this.maze.doors) if (!door.open && dist(m, center(this.maze, door.cell)) < 1.7) {
        door.open = true; this.events.push({ type: 'door', point: center(this.maze, door.cell) });
      }
      const d = dist(m, aim); if (d > .03) {
        m.yaw = Math.atan2(aim.x - m.x, aim.z - m.z);
        const speed = m.state === 'chase' ? senses.chase : senses.walk;
        const next = { x: m.x, z: m.z }; move(this.maze, next, (aim.x - m.x) / d * Math.min(d, speed * dt), (aim.z - m.z) / d * Math.min(d, speed * dt));
        const protectedEntry = this.time < 8 && this.safeCells.has(cellAt(this.maze, next)) && !this.safeCells.has(cellAt(this.maze, m));
        // No initial incursion. Later paths can traverse spawn; individual respawn immunity prevents cheap captures.
        if (!protectedEntry) { m.x = next.x; m.z = next.z; }
        else { this.forget(m); this.transition(m, 'rest', 'initial spawn grace'); }
        if (m.foot > (m.kind === 'runner' ? .33 : .65)) { m.foot = 0; this.events.push({ type: 'monsterStep', point: { x: m.x, z: m.z }, kind: m.kind }); }
      }
    }
    for (const p of this.players) {
      // A recent pursuit can expose a hiding player at the remembered entry point, never elsewhere through walls.
      const exposed = m.target === p.id && m.seen && (visible?.id === p.id || (p.hiding && m.witness === p.id && this.time - m.memoryTime < 4 && m.memory && dist(p, m.memory) < .8));
      if ((m.state === 'chase' || m.state === 'search') && p.state === 'exploring' && p.immunity <= 0 && exposed && dist(m, p) < .9 && lineOfSight(this.maze, m, p)) { this.capture(p, m); break; }
    }
  }
  capture(p: BackPlayer, m: Creature): void {
    if (p.state !== 'exploring' || p.immunity > 0) return;
    if (this.keyHolder === p.id) { this.key = { x: p.x, z: p.z }; this.keyHolder = null; }
    p.lives--; p.state = p.lives ? 'captured' : 'eliminated'; p.stateTime = 0; p.hiding = false;
    p.dx = p.dz = 0; p.running = false; p.eliminatedAt = this.time; this.commands.delete(p.id);
    this.events.push({ type: 'capture', player: p.id, point: { x: p.x, z: p.z }, kind: m.kind, power: this.rng.next() });
    this.forget(m); m.noiseArea = null; this.transition(m, 'rest', 'actual contact capture');
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
