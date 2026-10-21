import { Rng } from '../../../shared/rng';

export const CELL = 3.2;
export interface Point { x: number; z: number }
export interface MazeDoor { cell: number; horizontal: boolean; open: boolean }
export interface Maze {
  seed: number; size: number; floor: Uint8Array; cells: number[];
  spawn: number; exit: number; key: number; tasks: number[]; refuges: number[];
  rooms?: {x:number;z:number;w:number;h:number;kind:'office'|'party'|'dark'}[];
  doors: MazeDoor[]; dark: Set<number>; monsterSpawns: number[];
}
/** Exact topology, not a hash of props/seed: changing decoration cannot pass this guard. */
export function topologySignature(m: Maze): string { return `${m.size}:${Array.from(m.floor).join('')}`; }
export function freshMazeSeed(seed: number, players: number, previousSeed: number, previousTopology: string): number {
  for (let tries = 0; tries < 1024; tries++, seed = (seed + 1) >>> 0) {
    if (seed !== previousSeed && topologySignature(generateMaze(seed, players)) !== previousTopology) return seed;
  }
  throw new Error('Backrooms: impossibile generare una nuova topologia');
}
const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
export function center(m: Maze, cell: number): Point {
  return { x: (cell % m.size + .5) * CELL, z: (Math.floor(cell / m.size) + .5) * CELL };
}
export function cellAt(m: Maze, p: Point): number {
  const x = Math.floor(p.x / CELL), z = Math.floor(p.z / CELL);
  return x < 0 || z < 0 || x >= m.size || z >= m.size ? -1 : z * m.size + x;
}
export function neighbors(m: Maze, cell: number): number[] {
  const x = cell % m.size, z = Math.floor(cell / m.size);
  return dirs.map(([dx, dz]) => [x + dx, z + dz]).filter(([a, b]) => a >= 0 && b >= 0 && a < m.size && b < m.size && m.floor[b * m.size + a]).map(([a, b]) => b * m.size + a);
}
export function distances(m: Maze, start: number): Map<number, number> {
  const result = new Map<number, number>([[start, 0]]), queue = [start];
  for (let i = 0; i < queue.length; i++) for (const n of neighbors(m, queue[i])) {
    if (!result.has(n)) { result.set(n, result.get(queue[i])! + 1); queue.push(n); }
  }
  return result;
}
/** Doors are traversable navigation edges: players/creatures open them physically on approach. */
export function route(m: Maze, start: number, end: number): number[] {
  if (start < 0 || end < 0 || !m.floor[start] || !m.floor[end]) return [];
  const prev = new Map<number, number>([[start, -1]]), queue = [start];
  for (let i = 0; i < queue.length && !prev.has(end); i++) for (const n of neighbors(m, queue[i])) {
    if (!prev.has(n)) { prev.set(n, queue[i]); queue.push(n); }
  }
  if (!prev.has(end)) return [];
  const path = [end]; while (path[0] !== start) path.unshift(prev.get(path[0])!);
  return path;
}
export function generateMaze(seed: number, players = 5): Maze {
  const rng = new Rng(seed), size = players >= 4 ? 21 : 17, floor = new Uint8Array(size * size);
  const spawn = size + 1, m: Maze = { seed, size, floor, cells: [], spawn, exit: 0, key: 0, tasks: [], refuges: [], doors: [], dark: new Set(), monsterSpawns: [], rooms: [] };
  const stack = [spawn]; floor[spawn] = 1;
  while (stack.length) {
    const c = stack[stack.length - 1], x = c % size, z = Math.floor(c / size);
    const options = rng.shuffle(dirs).filter(([dx, dz]) => x + dx * 2 > 0 && z + dz * 2 > 0 && x + dx * 2 < size - 1 && z + dz * 2 < size - 1 && !floor[c + dx * 2 + dz * size * 2]);
    if (!options.length) { stack.pop(); continue; }
    const [dx, dz] = options[0], next = c + dx * 2 + dz * size * 2;
    floor[c + dx + dz * size] = floor[next] = 1; stack.push(next);
  }
  // Rooms join the maze instead of floating disconnected from it. Repeated sizes retain disorientation.
  for (let i = 0; i < (players >= 4 ? 8 : 6); i++) {
    const x = rng.int(1, (size - 4) / 2) * 2 - 1, z = rng.int(1, (size - 4) / 2) * 2 - 1;
    const w = rng.pick([3,4,5]), h = rng.pick([2,3,4]);
    m.rooms!.push({x,z,w:Math.min(w,size-1-x),h:Math.min(h,size-1-z),kind:i%3===0?'dark':i%3===1?'party':'office'});
    for (let b = z; b < Math.min(size - 1, z + h); b++) for (let a = x; a < Math.min(size - 1, x + w); a++) floor[b * size + a] = 1;
  }
  for (let z = 1; z <= 3; z++) for (let x = 1; x <= 3; x++) floor[z * size + x] = 1;
  for (let z = 2; z < size - 2; z++) for (let x = 2; x < size - 2; x++) {
    const c = z * size + x;
    if (!floor[c] && rng.chance(.13) && ((floor[c - 1] && floor[c + 1]) || (floor[c - size] && floor[c + size]))) floor[c] = 1;
  }
  // Straight service halls complement the DFS turns; all start in an existing odd cell.
  for(let i=0;i<2;i++){const x=rng.int(1,(size-3)/2)*2-1,z=rng.int(1,(size-3)/2)*2-1;
   for(let k=0;k<rng.int(5,9);k++){const a=Math.min(size-2,x+(i?0:k)),b=Math.min(size-2,z+(i?k:0));floor[b*size+a]=1;}}
  m.cells = Array.from(floor.keys()).filter(c => floor[c]);
  const d = distances(m, spawn), ordered = [...m.cells].sort((a, b) => d.get(b)! - d.get(a)!);
  m.exit = rng.pick(ordered.slice(0, Math.max(4, Math.floor(ordered.length * .12))));
  const far = rng.shuffle(m.cells.filter(c => d.get(c)! > 8 && c !== m.exit));
  m.key = far[0]; m.tasks = far.slice(1, 4);
  m.monsterSpawns = far.filter(c => d.get(c)! >= 14 && c !== m.key && !m.tasks.includes(c)).slice(0, 3);
  m.refuges = rng.shuffle(m.cells.filter(c => d.get(c)! > 4 && neighbors(m, c).length <= 2 && c !== m.exit && c !== m.key && !m.tasks.includes(c))).slice(0, 9);
  for (const c of m.cells) {
    if (d.get(c)! > 5 && rng.chance(.25)) m.dark.add(c);
    const ns = neighbors(m, c);
    if (d.get(c)! > 5 && ns.length === 2 && ![m.exit, m.key, ...m.tasks, ...m.refuges, ...m.monsterSpawns].includes(c)) {
      const horizontal = ns.includes(c - size) && ns.includes(c + size), vertical = ns.includes(c - 1) && ns.includes(c + 1);
      if ((horizontal || vertical) && rng.chance(.07) && m.doors.every(v => Math.abs(v.cell - c) > 2)) m.doors.push({ cell: c, horizontal, open: false });
    }
  }
  for(const r of m.rooms??[])if(r.kind==='dark')for(let z=r.z;z<r.z+r.h;z++)for(let x=r.x;x<r.x+r.w;x++)if(d.get(z*size+x)!>5)m.dark.add(z*size+x);
  if ([m.exit,m.key,...m.tasks,...m.monsterSpawns].some(c=>!d.has(c)))throw new Error('Backrooms: objective disconnected');
  if (d.size !== m.cells.length || !m.monsterSpawns.length) throw new Error(`Backrooms: seed ${seed} non valido`);
  return m;
}
export function canStand(m: Maze, p: Point, radius = .32, ignoreDoors = false): boolean {
  for (const [dx, dz] of [[-radius, -radius], [radius, -radius], [-radius, radius], [radius, radius], [0, 0]]) {
    const c = cellAt(m, { x: p.x + dx, z: p.z + dz }); if (c < 0 || !m.floor[c]) return false;
  }
  if (!ignoreDoors) for (const door of m.doors) {
    if (door.open) continue; const c = center(m, door.cell);
    if (door.horizontal ? Math.abs(p.z - c.z) < radius + .12 && Math.abs(p.x - c.x) < CELL / 2 : Math.abs(p.x - c.x) < radius + .12 && Math.abs(p.z - c.z) < CELL / 2) return false;
  }
  return true;
}
export function move(m: Maze, p: Point, dx: number, dz: number, radius = .32): void {
  // Swept subdivision prevents crossing a wall even during a delayed browser frame.
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / .12));
  for (let i = 0; i < steps; i++) {
    if (canStand(m, { x: p.x + dx / steps, z: p.z }, radius)) p.x += dx / steps;
    if (canStand(m, { x: p.x, z: p.z + dz / steps }, radius)) p.z += dz / steps;
  }
}
export function lineOfSight(m: Maze, a: Point, b: Point): boolean {
  const count = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / .13);
  for (let i = 1; i <= count; i++) if (!canStand(m, { x: a.x + (b.x - a.x) * i / count, z: a.z + (b.z - a.z) * i / count }, .01)) return false;
  return true;
}
