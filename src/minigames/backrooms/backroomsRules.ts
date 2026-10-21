import { Rng } from '../../../shared/rng';
import type { PlayerResult } from '../../../shared/types';
import { CELL, generateMaze, center, cellAt, neighbors, route, distances, move, lineOfSight, canStand } from './maze';
import type { Maze, Point } from './maze';
import { LEVELS } from './levels';
import type { BackLevel, LevelId } from './levels';
import {MONSTER_PRESSURE as PRESSURE} from './monsterPressure';

export type EscapeMode = 'free' | 'key' | 'puzzle';
export type CreatureKind = 'bacteria' | 'partygoer' | 'stalker' | 'runner' | 'imitator' | 'hound' | 'watcher' | 'smiler' | 'howler';
export type PlayerState = 'exploring' | 'captured' | 'eliminated' | 'escaped';
export interface BackPlayer extends Point {
  id: string; name: string; bot?: boolean; yaw: number; pitch: number; lives: number;
  state: PlayerState; stateTime: number; immunity: number; stamina: number; exhausted?:boolean; hiding: boolean;
  visited: Set<number>; escapedAt: number; eliminatedAt: number; dx: number; dz: number;
  flashlight:boolean; lampPresses:number; running: boolean; lastFoot: number; notice: string; noticeTime: number;
}
export interface Command { x: number; z: number; lookX: number; lookY: number; sprint: boolean; interact: boolean; held: boolean; presses?: number; flashlightPresses?:number }
export interface Creature extends Point {
  kind: CreatureKind; yaw: number; activeAt:number; repelUntil:number; lightResistUntil:number; cueAt:number; state: 'patrol' | 'suspicious' | 'investigate' | 'watch' | 'chase' | 'search' | 'return' | 'rest' | 'lure' | 'recoil';
  target: string | null; memory: Point | null; memoryTime: number; destination: number;
  noiseArea: (Point & { radius: number }) | null; noiseTime: number; witness: string | null; reason: string;
  path: number[]; timer: number; repath: number; foot: number; seen: boolean; revealed: boolean;
  observedMotion: Point; searchCells: number[]; searched: number[]; searchPause: number;
  patrolHistory: number[]; stuckTime: number; repelFrom: Point | null;
}
export interface BackEvent { type: 'capture' | 'escape' | 'step' | 'monsterStep' | 'door' | 'task' | 'key' | 'reveal' | 'generator' | 'howl' | 'lure' | 'repel' | 'torch' | 'respawn' | 'alert'; player?: string; point: Point; kind?: CreatureKind; power?: number }
export interface BackConfig { level?: LevelId; duration?: number; mode?: EscapeMode; puzzle?: 'switches' | 'generators'; weights?: [number, number, number]; imitator?: boolean; monsters?: CreatureKind[]; senses?: Partial<Record<CreatureKind, Partial<Senses>>> }
export interface Prompt { kind: 'exit' | 'key' | 'task' | 'door' | 'hide'; index: number; text: string; point: Point }
export interface Senses { fov: number; range: number; darkRange: number; reaction: number; search: number; hearing: number; walk: number; chase: number }
export const CREATURE_SENSES: Record<CreatureKind, Senses> = {
  bacteria:{fov:100,range:18,darkRange:9,reaction:.35,search:10,hearing:1.6,walk:1.9,chase:5.2},
  partygoer:{fov:95,range:6,darkRange:5,reaction:.85,search:4,hearing:.7,walk:1.1,chase:6.4},
  stalker: { fov: 105, range: 18, darkRange: 9, reaction: .7, search: 9, hearing: .95, walk: 2, chase: 4.6 },
  runner: { fov: 105, range: 18, darkRange: 9, reaction: .08, search: 8, hearing: 1.35, walk: 3, chase: 6.1 },
  imitator: { fov: 105, range: 16, darkRange: 8, reaction: .2, search: 8, hearing: 1.05, walk: 2.8, chase: 5.3 },
  // Livello 1: il segugio è quasi cieco ma sente tutto; l'osservatore vede lontanissimo ma reagisce piano.
  hound: { fov: 70, range: 9, darkRange: 9, reaction: .1, search: 10, hearing: 2.1, walk: 2.7, chase: 6.4 },
  watcher: { fov: 150, range: 26, darkRange: 14, reaction: .9, search: 12, hearing: .5, walk: 1.7, chase: 4.7 },
  // Livello 2: il sorridente vede meglio al buio che alla luce; l'urlatore chiama gli altri quando ti trova.
  smiler: { fov: 105, range: 8, darkRange: 22, reaction: .25, search: 8, hearing: .8, walk: 2.4, chase: 5.7 },
  howler: { fov: 115, range: 15, darkRange: 8, reaction: .45, search: 9, hearing: 1.6, walk: 2.5, chase: 5.2 }
};
/** A howler's cry carries this far: every creature within earshot converges on the spot. */
const HOWL_LOUDNESS = 60;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);
export class BackroomsMatch {
  readonly maze: Maze; readonly players: BackPlayer[]; readonly monsters: Creature[];
  readonly level: BackLevel; readonly mode: EscapeMode; readonly puzzle: 'switches' | 'generators'; readonly duration: number;
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
    this.senses = Object.fromEntries(Object.entries(CREATURE_SENSES).map(([k, v]) => [k, { ...v,walk:v.walk*PRESSURE.walk,chase:Math.min(PRESSURE.maxChase,v.chase*PRESSURE.chase),reaction:Math.max(.08,v.reaction*PRESSURE.reactionScale),hearing:v.hearing*PRESSURE.hearing,search:v.search+PRESSURE.searchSeconds, ...config.senses?.[k as CreatureKind] }])) as Record<CreatureKind, Senses>;
    this.rng = new Rng(seed ^ 0x218843); this.maze = generateMaze(seed, roster.length); this.level = LEVELS[config.level ?? 'lobby'];
    // Darker levels add shadow on a separate stream, so the lobby keeps the exact same seed behaviour.
    if (this.level.extraDark > 0) {
      const shade = new Rng(seed ^ 0x1e7e1), d = distances(this.maze, this.maze.spawn);
      for (const c of this.maze.cells) if (d.get(c)! > 5 && !this.maze.dark.has(c) && shade.chance(this.level.extraDark)) this.maze.dark.add(c);
    }
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
      visited: new Set([cellAt(this.maze, spawn)]), escapedAt: Infinity, eliminatedAt: 0, dx: 0, dz: 0, flashlight:true,lampPresses:0,running: false, lastFoot: 0, notice: '', noticeTime: 0 };
    });
    this.safeCells = new Set([...distances(this.maze, this.maze.spawn)].filter(([, d]) => d < 3).map(([c]) => c));
    const pool = this.level.id === 'lobby' && !config.imitator ? this.level.monsters.filter(k => k !== 'imitator') : this.level.monsters;
    const fresh=pool.filter(k=>['bacteria','partygoer','smiler'].includes(k)),first=fresh.length?this.rng.pick(fresh):this.rng.pick(pool);
    const types=config.monsters??[first,...this.rng.shuffle(pool.filter(k=>k!==first)).slice(0,roster.length>=4?2:1)];
    this.monsters = types.map((kind, i) => ({ ...center(this.maze, this.maze.monsterSpawns[i % this.maze.monsterSpawns.length]), kind,
      activeAt:!config.monsters&&i>=2?75:0,repelUntil:0,lightResistUntil:0,cueAt:0,yaw: this.rng.next() * Math.PI * 2, state: 'patrol', target: null, memory: null, memoryTime: 0,
      noiseArea: null, noiseTime: -Infinity, witness: null, reason: 'spawn',
      destination: this.maze.monsterSpawns[i % this.maze.monsterSpawns.length], path: [], timer: 0, repath: 0, foot: 0, seen: false, revealed: kind !== 'imitator',
      observedMotion:{x:0,z:0},searchCells:[],searched:[],searchPause:0,patrolHistory:[],stuckTime:0,repelFrom:null }));
  }
  get remaining(): number { return Math.max(0, this.duration - this.time); }
  command(id: string, cmd: Command): void {
    const pending = this.commands.get(id)?.presses ?? 0,lamps=this.commands.get(id)?.flashlightPresses??0;
    this.commands.set(id, { ...cmd,flashlightPresses:Math.min(8,lamps+(cmd.flashlightPresses??0)), presses: Math.min(16, pending + (cmd.presses ?? Number(cmd.interact))) });
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
      if (p.state === 'captured' && p.stateTime >= 7) {
        const original=this.spawnPoints.get(p.id)!,candidates=[original,...[...this.safeCells].map(c=>center(this.maze,c))];
        const pos=candidates.find(v=>this.monsters.every(m=>dist(v,m)>CELL*2))??original; p.x = pos.x; p.z = pos.z; p.yaw = .7; p.pitch = 0;
        p.state = 'exploring'; p.stateTime = 0; p.immunity = 7; p.stamina = 1; p.exhausted=false; p.hiding = false;
        this.commands.delete(p.id); this.notify(p, 'ULTIMA POSSIBILITÀ · SEI PROTETTO PER 7s');this.events.push({type:'respawn',player:p.id,point:{x:p.x,z:p.z}});
      }
      if (p.state !== 'exploring') { p.dx = p.dz = 0; continue; }
      const c = this.commands.get(p.id); p.dx = p.dz = 0; p.running = false;
      if (c) {
        if((c.flashlightPresses??0)>0){if(c.flashlightPresses!%2)p.flashlight=!p.flashlight;c.flashlightPresses=0;this.events.push({type:'torch',player:p.id,point:{x:p.x,z:p.z}});}
        p.yaw += clamp(c.lookX, -1, 1) * dt * 2.25; p.pitch = clamp(p.pitch + clamp(c.lookY, -1, 1) * dt * 1.6, -.95, .95);
        if (!p.hiding) {
          const len = Math.max(1, Math.hypot(c.x, c.z)), moving = Math.hypot(c.x, c.z) > .12;
          if(p.exhausted&&p.stamina>=.3)p.exhausted=false;
          p.running = c.sprint && moving && !p.exhausted && p.stamina > .02;
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
      p.stamina = clamp(p.stamina + (p.running ? -dt / 4 : dt / 5), 0, 1);
      if(p.running&&p.stamina<=.02)p.exhausted=true;
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
    if (t.kind === 'key' && c.interact && this.key) { this.keyHolder = p.id; this.key = null; this.notify(p, 'CHIAVE RACCOLTA · TROVA LA PORTA');for(const ally of this.players)if(ally!==p&&ally.state==='exploring')this.notify(ally,`${p.name} HA TROVATO LA CHIAVE`); this.events.push({ type: 'key', player: p.id, point: p }); }
    if (t.kind === 'task') {
      if (this.puzzle === 'generators' && this.time - p.lastFoot > .28) {
        p.lastFoot = this.time; this.events.push({ type: 'generator', player: p.id, point: t.point, power: this.taskProgress[t.index] });
      }
      this.taskProgress[t.index] = this.puzzle === 'switches' ? 1 : Math.min(1, this.taskProgress[t.index] + dt / 2.5);
      if (this.taskProgress[t.index] === 1) { this.events.push({ type: 'task', player: p.id, point: t.point }); for(const ally of this.players)if(ally.state==='exploring')this.notify(ally,`ALIMENTAZIONE ${this.taskProgress.filter(v => v === 1).length}/${this.tasks.length} · ${p.name}`); }
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
    // Running in the dark makes you as visible as in light — or more, for creatures that hunt in darkness.
    const d = dist(monster, p), inDark = this.maze.dark.has(cellAt(this.maze, p));
    const range = !inDark||p.flashlight ? senses.range : p.running ? Math.max(senses.range, senses.darkRange) : senses.darkRange;
    if (d > range) return { visible: false, los, reason: 'range/light' };
    const dot = (Math.sin(monster.yaw) * (p.x - monster.x) + Math.cos(monster.yaw) * (p.z - monster.z)) / Math.max(.00001, d);
    if (dot < Math.cos(senses.fov * Math.PI / 360)) return { visible: false, los, reason: 'outside FOV' };
    return { visible: los, los, reason: los ? 'visual acquisition' : 'occluded' };
  }
  beamHits(p:BackPlayer,m:Point):boolean {
    const dx=m.x-p.x,dz=m.z-p.z,dy=1.45-1.58,d=Math.hypot(dx,dy,dz);
    if(d>9||d<.05||!lineOfSight(this.maze,p,m))return false;
    return (Math.sin(p.yaw)*Math.cos(p.pitch)*dx-Math.sin(p.pitch)*dy+Math.cos(p.yaw)*Math.cos(p.pitch)*dz)/d>Math.cos(.35);
  }
  canSee(monster: Creature, p: BackPlayer): boolean { return this.perception(monster, p).visible; }
  private transition(m: Creature, state: Creature['state'], reason: string): void {
    if (m.state === state) return;
    if(state==='chase')this.events.push({type:'alert',point:{x:m.x,z:m.z},kind:m.kind});
    m.state = state; m.reason = reason; m.timer = 0; m.path = []; m.repath = 0;
    m.stuckTime=0;
    if(state==='search')this.planSearch(m);
  }
  private forget(m: Creature): void {
    m.target = null; m.memory = null; m.seen = false; m.witness = null;
    m.observedMotion={x:0,z:0};m.searchCells=[];m.searched=[];m.searchPause=0;
  }
  private planSearch(m:Creature):void {
    m.searched=[];m.searchPause=0;m.searchCells=[];
    if(!m.memory)return;
    const anchor=cellAt(this.maze,m.memory),local=distances(this.maze,anchor);
    const speed=Math.hypot(m.observedMotion.x,m.observedMotion.z);
    // This direction was observed before LOS was lost. Hidden player positions are never consulted.
    const score=(c:number)=>{const p=center(this.maze,c),d=Math.hypot(p.x-m.memory!.x,p.z-m.memory!.z);
      const ahead=speed>.1?(m.observedMotion.x*(p.x-m.memory!.x)+m.observedMotion.z*(p.z-m.memory!.z))/Math.max(.1,speed*d):0;
      return ahead*2-(local.get(c)??99)*.35;};
    m.searchCells=[anchor,...[...local].filter(([c,d])=>c!==anchor&&d<=3).map(([c])=>c).sort((a,b)=>score(b)-score(a)).slice(0,7)];
  }
  private pursuitPoint(m:Creature,p:BackPlayer):Point {
    const lead=m.kind==='runner'?.5:m.kind==='bacteria'?.4:.22;
    const speed=Math.hypot(m.observedMotion.x,m.observedMotion.z),factor=lead*Math.min(1,5.8/Math.max(.01,speed));
    const point={x:p.x+m.observedMotion.x*factor,z:p.z+m.observedMotion.z*factor};
    return canStand(this.maze,point)&&lineOfSight(this.maze,p,point)&&lineOfSight(this.maze,m,point)?point:{x:p.x,z:p.z};
  }
  private patrolCell(monster: Creature): number {
    const occupied = new Set([this.maze.exit, this.maze.key, ...this.tasks, ...this.safeCells]);
    const current=cellAt(this.maze,monster),near=distances(this.maze,current);
    monster.patrolHistory.push(current);monster.patrolHistory=monster.patrolHistory.slice(-5);
    const all=this.maze.cells.filter(c=>!occupied.has(c)&&c!==current),rooms=(this.maze.rooms??[]).filter(r=>r.kind==='party');
    const preferred=monster.kind==='partygoer'?all.filter(c=>rooms.some(r=>c%this.maze.size>=r.x&&c%this.maze.size<r.x+r.w&&Math.floor(c/this.maze.size)>=r.z&&Math.floor(c/this.maze.size)<r.z+r.h)):[];
    const choices=preferred.length?preferred:all,others=new Set(this.monsters.filter(m=>m!==monster&&this.time>=m.activeAt).map(m=>m.destination));
    const scored=choices.map(c=>({c,score:this.rng.next()*2-Math.abs((near.get(c)??99)-6)*.25-(monster.patrolHistory.includes(c)?5:0)-(others.has(c)?4:0)+(monster.kind==='smiler'&&this.maze.dark.has(c)?3:0)}));
    scored.sort((a,b)=>b.score-a.score);return scored[0]?.c??current;
  }
  private updateMonster(m: Creature, dt: number): void {
    if(this.time<m.activeAt)return;
    m.timer += dt; m.repath -= dt; m.foot += dt;
    const senses = this.senses[m.kind];
    if(m.kind==='smiler'){
     if(this.time<m.repelUntil){
      m.state='recoil';
      if(m.repelFrom){const dx=m.x-m.repelFrom.x,dz=m.z-m.repelFrom.z,d=Math.hypot(dx,dz);
       if(d>.05){move(this.maze,m,dx/d*1.3*dt,dz/d*1.3*dt);m.yaw=Math.atan2(-dx,-dz);}}
      return;
     }
     if(m.state==='recoil')this.transition(m,'search','light recoil ended');
     const lamp=this.players.find(p=>p.state==='exploring'&&p.flashlight&&!p.hiding&&this.beamHits(p,m));
     if(lamp&&this.time>=m.lightResistUntil){m.repelFrom={x:lamp.x,z:lamp.z};m.repelUntil=this.time+1.35;m.lightResistUntil=this.time+10;this.transition(m,'recoil','focused flashlight');this.events.push({type:'repel',player:lamp.id,point:{x:m.x,z:m.z},kind:m.kind});return;}
    }
    if(m.kind==='partygoer'){
     const cell=cellAt(this.maze,m),partyRoom=(this.maze.rooms??[]).some(r=>r.kind==='party'&&cell%this.maze.size>=r.x&&cell%this.maze.size<r.x+r.w&&Math.floor(cell/this.maze.size)>=r.z&&Math.floor(cell/this.maze.size)<r.z+r.h);
     if(m.state==='patrol'&&((partyRoom&&m.timer>1.5)||(m.timer>9&&neighbors(this.maze,cell).length>=3)))this.transition(m,'lure','waiting by the balloon');
     if(m.state==='lure'){if(this.time>=m.cueAt){m.cueAt=this.time+7;this.events.push({type:'lure',point:{x:m.x,z:m.z},kind:m.kind});}if(m.timer>11)this.transition(m,'patrol','move to another room');}
     if(m.state==='chase'&&m.timer>PRESSURE.partyBurst){this.forget(m);this.transition(m,'rest','burst exhausted');return;}
    }
    if (m.state === 'rest') { if (m.timer > PRESSURE.rest) this.transition(m, 'return', 'rest complete'); else return; }
    const seen = this.players.filter(p => this.canSee(m, p));
    // Keep a still-visible target: a closer bystander cannot steal a pursuit every frame.
    const visible = seen.find(p => p.id === m.target) ?? seen.sort((a, b) => dist(a, m) - dist(b, m))[0];
    if (visible) {
      m.target = visible.id; m.memory = { x: visible.x, z: visible.z }; m.memoryTime = this.time; m.seen = true; m.witness = null;
      m.observedMotion={x:visible.dx,z:visible.dz};m.searchCells=[];m.searched=[];m.searchPause=0;
      if (m.kind === 'imitator' && !m.revealed && dist(m, visible) < 4) { m.revealed = true; this.events.push({ type: 'reveal', point: { x: m.x, z: m.z }, kind: m.kind }); }
      if (m.state !== 'chase' && m.state !== 'watch') this.transition(m, 'watch', 'visual acquisition');
      if (m.state === 'watch' && m.timer >= senses.reaction) {
        this.transition(m, 'chase', 'visual reaction complete');
        if (m.kind === 'howler') {
          this.noise.push({ point: { x: visible.x, z: visible.z }, id: visible.id, loud: HOWL_LOUDNESS, time: this.time });
          this.events.push({ type: 'howl', point: { x: m.x, z: m.z }, kind: m.kind });
        }
      }
    } else {
      if (m.state === 'chase' || m.state === 'watch') this.transition(m, 'search', 'visual contact lost');
      if (m.state === 'search' && this.time - m.memoryTime > senses.search) { this.forget(m); this.transition(m, 'return', 'visual search expired'); }
      // Hearing is independent from last sight: never gives a player target or overwrites a visual snapshot.
      const sounds=this.noise.filter(n=>(this.players.find(p=>p.id===n.id)?.immunity??0)<=0&&n.time>m.noiseTime)
        .map(n=>({n,strength:n.loud*senses.hearing*(lineOfSight(this.maze,m,n.point)?1:.55)/Math.max(1,dist(m,n.point))}));
      const sound=sounds.filter(o=>o.strength>1).sort((a,b)=>b.strength-a.strength||b.n.time-a.n.time)[0]?.n;
      if (sound) {
        // Consume the whole audible batch, so its weaker newer cue cannot win on the next frame.
        m.noiseTime = Math.max(sound.time,...sounds.map(o=>o.n.time));
        const cell = cellAt(this.maze, sound.point), region = this.rng.pick([cell, ...neighbors(this.maze, cell)]);
        m.noiseArea = { ...center(this.maze, region), radius: CELL };
        if(m.state==='search'&&!m.searched.includes(region)){
          m.searchCells=[region,...m.searchCells.filter(c=>c!==region)];m.path=[];m.repath=0;m.searchPause=0;
        }
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
    if (m.state === 'lure')return;
    if (m.state === 'watch') { if (m.memory) m.yaw = Math.atan2(m.memory.x - m.x, m.memory.z - m.z); return; }
    if(m.state==='search'){
      const cell=m.searchCells[0];
      if(cell===undefined){this.forget(m);this.transition(m,'return','nearby branches checked');return;}
      if(dist(m,center(this.maze,cell))<.45){
        m.searchPause+=dt;m.yaw+=dt*2.8;
        if(m.searchPause<.65)return;
        m.searched.push(cell);m.searchCells.shift();m.searchPause=0;m.path=[];m.repath=0;
        return;
      }
    }
    if (m.state === 'patrol' && (dist(m, center(this.maze, m.destination)) < .5 || m.timer > (m.kind==='partygoer'?18:8))) { m.destination = this.patrolCell(m); m.timer = 0; m.path = []; }
    const destination = m.state === 'investigate' ? m.noiseArea : m.state==='search'?center(this.maze,m.searchCells[0]):visible&&m.state==='chase'?this.pursuitPoint(m,visible):m.memory;
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
        const last=this.players.filter(p=>p.state==='exploring').length<=1;const dark=m.kind==='smiler'&&this.maze.dark.has(cellAt(this.maze,m));
        const speed=(m.state==='chase'?senses.chase:senses.walk)*(last?.9:1)*(dark?1.08:1);
        const next = { x: m.x, z: m.z }; move(this.maze, next, (aim.x - m.x) / d * Math.min(d, speed * dt), (aim.z - m.z) / d * Math.min(d, speed * dt));
        const traveled=dist(m,next);
        const protectedEntry = this.time < 8 && this.safeCells.has(cellAt(this.maze, next)) && !this.safeCells.has(cellAt(this.maze, m));
        // No initial incursion. Later paths can traverse spawn; individual respawn immunity prevents cheap captures.
        if (!protectedEntry) { m.x = next.x; m.z = next.z; }
        else { this.forget(m); this.transition(m, 'rest', 'initial spawn grace'); }
        if(!protectedEntry&&speed>0&&d>.2){
          m.stuckTime=traveled<speed*dt*.1?m.stuckTime+dt:0;
          if(m.stuckTime>.8){const current=cellAt(this.maze,m);m.path=[current,...route(this.maze,current,goal).slice(1)];m.repath=.45;m.stuckTime=0;}
        }
        if (m.foot > (m.kind === 'runner' || m.kind === 'hound' ? .3 : m.kind === 'watcher' ? .8 : .65)) { m.foot = 0; this.events.push({ type: 'monsterStep', point: { x: m.x, z: m.z }, kind: m.kind }); }
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
