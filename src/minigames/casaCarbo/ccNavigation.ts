import { CC } from './ccTuning';
import { COLS, ROWS, DRAINS, FURNITURE, WALLS, cellAtPx, cellCenterPx } from './mapData';
import type { CasaCarboWorld } from './waterCore';
const N = COLS * ROWS;

/** Celle in cui il CORPO ci sta davvero (centro abbastanza lontano da muri e mobili): i bot camminano solo su queste. */
let roomy: Uint8Array | null = null;
export function roomyGrid(w: CasaCarboWorld): Uint8Array {
  if (roomy) return roomy;
  const g = new Uint8Array(N);
  const solids = [...WALLS, ...FURNITURE.map((f) => f.r)];
  for (let k = 0; k < N; k++) {
    if (!w.grid.walk[k]) continue;
    const c = cellCenterPx(k);
    let ok = true;
    for (const r of solids) {
      const cx = Math.max(r[0], Math.min(r[2], c.x));
      const cy = Math.max(r[1], Math.min(r[3], c.y));
      if (Math.hypot(c.x - cx, c.y - cy) < CC.radius + 1) {
        ok = false;
        break;
      }
    }
    if (ok) g[k] = 1;
  }
  roomy = g;
  return g;
}

/** solo test/diagnostica */
export const __roomy = (): Uint8Array | null => roomy;

export function bfs(w: CasaCarboWorld, sources: number[], floorOnly: boolean): Int32Array {
  const room = roomyGrid(w);
  const dist = new Int32Array(N).fill(-1);
  const q = new Int32Array(N);
  let head = 0;
  let tail = 0;
  for (const s of sources) {
    if (s < 0) continue;
    dist[s] = 0;
    q[tail++] = s;
  }
  const ok = (k: number): boolean => (floorOnly ? w.grid.floor[k] === 1 && !w.blocked[k] && room[k] === 1 : room[k] === 1 && !w.rug?.cells.includes(k));
  while (head < tail) {
    const k = q[head++];
    const i = k % COLS;
    const nb = [i > 0 ? k - 1 : -1, i < COLS - 1 ? k + 1 : -1, k - COLS, k + COLS];
    for (const m of nb) {
      if (m < 0 || m >= N || dist[m] >= 0 || !ok(m)) continue;
      dist[m] = dist[k] + 1;
      q[tail++] = m;
    }
  }
  return dist;
}


let owner: CasaCarboWorld | null = null;
let rug: unknown;
let fields = new Map<string, Int32Array>();
/** Next waypoint on the shortest walkable path; never chooses a clogged/unreachable drain. */
export function drainRoute(w: CasaCarboWorld, p: {x:number;y:number}): {id:string;x:number;y:number;steps:number} | null {
 if (owner !== w || rug !== w.rug) {
  owner=w; rug=w.rug; fields=new Map();
  for(const d of DRAINS) {
   const seeds:number[]=[];
   for(let k=0;k<N;k++){const c=cellCenterPx(k);if(roomyGrid(w)[k] && Math.hypot(c.x-d.cx,c.y-d.cy)<CC.emptyRadius-8) seeds.push(k);}
   fields.set(d.id,bfs(w,seeds,false));
  }
 }
 const here=cellAtPx(p.x,p.y); if(here<0)return null;
 let best:{id:string;x:number;y:number;steps:number}|null=null;
 for(const d of DRAINS){
  if(w.clogged.has(d.id))continue;
  const f=fields.get(d.id)!;
  const i=here%COLS;
  const candidates=[here,i>0?here-1:-1,i<COLS-1?here+1:-1,here-COLS,here+COLS].filter(k=>k>=0&&k<N&&f[k]>=0);
  if(!candidates.length)continue;
  const next=candidates.sort((a,b)=>f[a]-f[b])[0];
  if(best && best.steps<=f[next])continue;
  const c=f[next]===0?{x:d.cx,y:d.cy}:cellCenterPx(next);
  best={id:d.id,...c,steps:f[next]};
 }
 return best;
}
