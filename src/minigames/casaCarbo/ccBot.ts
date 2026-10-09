import { CC } from './ccTuning';
import { COLS, ROWS, DOORS, DRAINS, FURNITURE, TV_POINT, WALLS, cellAtPx, cellCenterPx } from './mapData';
import { CC_NO_INPUT } from './ccTypes';
import type { CCInput, CCPlayer } from './ccTypes';
import type { CasaCarboWorld } from './waterCore';

/**
 * BOT di Casa Carbo per solitaria e simulazioni. Ruoli semplici: SECCHIO (raccoglie la
 * pozza piu' grossa e la porta allo scarico piu' vicino), TIRACQUA (spinge l'acqua verso lo scarico del bagno seguendo la discesa),
 * PORTA (contiene l'ingresso). Reagiscono agli eventi (scarico intasato, TV) e usano l'abilita' in momenti plausibili.
 */
export type BotRole = 'bucket' | 'squeegee' | 'door';

const N = COLS * ROWS;

/** Celle in cui il CORPO ci sta davvero (centro abbastanza lontano da muri e mobili): i bot camminano solo su queste. */
let roomy: Uint8Array | null = null;
function roomyGrid(w: CasaCarboWorld): Uint8Array {
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

function bfs(w: CasaCarboWorld, sources: number[], floorOnly: boolean): Int32Array {
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
  const ok = (k: number): boolean => (floorOnly ? w.grid.floor[k] === 1 && !w.blocked[k] && room[k] === 1 : room[k] === 1);
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

export class CCBot {
  private plan = 0;
  private target = -1;
  private pushDir: { x: number; y: number } | null = null;
  private walkField: Int32Array | null = null;
  private static drainField: Map<string, Int32Array> = new Map();
  private static bathField: Int32Array | null = null;
  private static fieldOwner: CasaCarboWorld | null = null;
  private pressedOnce = false;
  private pushT = 0;
  private abilityAt: number;

  constructor(
    readonly id: string,
    private rnd: () => number,
    public role: BotRole,
    private skill = 0.7
  ) {
    this.abilityAt = 20 + rnd() * 50;
  }

  private fields(w: CasaCarboWorld): void {
    if (CCBot.fieldOwner === w) return;
    CCBot.fieldOwner = w;
    CCBot.drainField = new Map();
    for (const d of DRAINS) CCBot.drainField.set(d.id, bfs(w, [cellAtPx(d.cx, d.cy), cellAtPx(d.cx, d.cy - 30), cellAtPx(d.cx, d.cy + 30)].filter((k) => k >= 0 && w.grid.walk[k]), false));
    CCBot.bathField = bfs(w, w.grid.bathDrainCells, true);
  }

  /** Passo verso una cella seguendo un campo di distanze che parte DA quella cella. */
  private stepToward(w: CasaCarboWorld, p: CCPlayer, field: Int32Array): { x: number; y: number } {
    let here = cellAtPx(p.x, p.y);
    if (here < 0) return { x: 0, y: 0 };
    if (field[here] < 0) {
      // il centro del corpo e' in una cella "stretta" (vicino a un muro): riparti dalla cella buona piu' vicina
      let best = -1;
      for (const off of [-1, 1, -COLS, COLS, -COLS - 1, -COLS + 1, COLS - 1, COLS + 1]) {
        const m = here + off;
        if (m < 0 || m >= N || field[m] < 0) continue;
        if (best < 0 || field[m] < field[best]) best = m;
      }
      if (best < 0) return { x: 0, y: 0 };
      here = best;
      const c0 = cellCenterPx(here);
      const l0 = Math.hypot(c0.x - p.x, c0.y - p.y);
      if (l0 > 6) return { x: (c0.x - p.x) / l0, y: (c0.y - p.y) / l0 };
    }
    // una cella avanti lungo la discesa; se e' bloccato da un po' (spigolo di una porta) prova di lato
    let k = here;
    for (let s = 0; s < 1; s++) {
      const i = k % COLS;
      let best = k;
      for (const m of [i > 0 ? k - 1 : -1, i < COLS - 1 ? k + 1 : -1, k - COLS, k + COLS]) {
        if (m < 0 || m >= N || field[m] < 0) continue;
        if (field[m] < field[best]) best = m;
      }
      if (best === k) break;
      k = best;
    }
    const c = cellCenterPx(k);
    let dx = c.x - p.x;
    let dy = c.y - p.y;
    const l = Math.hypot(dx, dy) || 1;
    dx /= l;
    dy /= l;
    // incastrato: quasi fermo da piu' di mezzo secondo -> spinta laterale
    const moved = Math.hypot(p.x - this.lastX, p.y - this.lastY);
    this.lastX = p.x;
    this.lastY = p.y;
    if (moved < 0.6) this.stuck += 1 / 30;
    else this.stuck = 0;
    if (this.stuck > 0.5) {
      const side = this.rnd() < 0.5 ? 1 : -1;
      return { x: dx * 0.4 - dy * side, y: dy * 0.4 + dx * side };
    }
    return { x: dx, y: dy };
  }
  private lastX = 0;
  private lastY = 0;
  private stuck = 0;

  /** Converte una direzione del disegno (y in basso) nell'input dello stick (y SU positiva). */
  private stick(out: CCInput, d: { x: number; y: number }): void {
    out.mx = d.x;
    out.my = -d.y;
  }

  input(w: CasaCarboWorld, dt: number): CCInput {
    const p = w.byId.get(this.id);
    if (!p || w.over) return CC_NO_INPUT;
    this.fields(w);
    const out: CCInput = { ...CC_NO_INPUT };
    this.plan -= dt;

    // abilita'
    if (w.time >= this.abilityAt && p.ab.charges > 0) {
      const use = this.wantAbility(w, p);
      if (use) {
        out.abilityPressed = true;
        this.abilityAt = w.time + 12 + this.rnd() * 20;
      }
    }

    // eventi: TV e scarichi intasati (il piu' vicino ci va)
    const tvNear = w.tv === 'danger' && this.closestTo(w, TV_POINT.cx, TV_POINT.cy) === p;
    if (tvNear) return this.goAndHold(w, p, out, TV_POINT.cx, TV_POINT.cy, 'interact');
    for (const d of DRAINS) {
      if (w.clogged.has(d.id) && this.closestTo(w, d.cx, d.cy) === p) return this.goAndHold(w, p, out, d.cx, d.cy, 'interact');
    }

    if (this.role === 'door') return this.door(w, p, out);
    if (this.role === 'squeegee') return this.squeegee(w, p, out, dt);
    return this.bucket(w, p, out);
  }

  private closestTo(w: CasaCarboWorld, x: number, y: number): CCPlayer | null {
    let best: CCPlayer | null = null;
    let bd = Infinity;
    for (const q of w.players) {
      const d = Math.hypot(q.x - x, q.y - y);
      if (d < bd) {
        bd = d;
        best = q;
      }
    }
    return best;
  }

  private goAndHold(w: CasaCarboWorld, p: CCPlayer, out: CCInput, x: number, y: number, what: 'interact'): CCInput {
    const d = Math.hypot(p.x - x, p.y - y);
    if (d > CC.interactRadius - 12) {
      const field = bfs(w, [cellAtPx(x, y), cellAtPx(x - 30, y), cellAtPx(x + 30, y), cellAtPx(x, y + 30), cellAtPx(x, y - 30)].filter((k) => k >= 0 && w.grid.walk[k]), false);
      this.stick(out, this.stepToward(w, p, field));
    } else if (what === 'interact') out.interactHeld = true;
    return out;
  }

  private wantAbility(w: CasaCarboWorld, p: CCPlayer): boolean {
    switch (p.characterId) {
      case 'goblin':
        return p.squeegee && w.waterAt(p.x + p.fx * 40, p.y + p.fy * 40) > 0.4 && this.rnd() < this.skill;
      case 'buttafuori':
        return p.containing !== null && (w.phaseName === 'picco' || w.phaseName === 'raffiche');
      case 'dottore':
        return w.time > 55 && w.time < 95;
      case 'judoka':
        return w.phaseName !== 'moderata' && DOORS.some((d) => Math.hypot(p.x - d.cx, p.y - d.cy) < 110);
      case 'ciro':
        return p.bucket < 0.5 && !p.ab.bigBucket;
    }
    return false;
  }

  private door(w: CasaCarboWorld, p: CCPlayer, out: CCInput): CCInput {
    const idx = w.players.indexOf(p);
    const d = DOORS[idx % 2 === 0 ? 0 : 1];
    const ix = d.cx;
    const iy = d.cy + (d.inward === -1 ? 30 : -30);
    if (Math.hypot(p.x - ix, p.y - iy) > 40) {
      const field = bfs(w, [cellAtPx(ix, iy)].filter((k) => k >= 0), false);
      this.stick(out, this.stepToward(w, p, field));
    } else out.interactHeld = true;
    return out;
  }

  private bucket(w: CasaCarboWorld, p: CCPlayer, out: CCInput): CCInput {
    const cap = w.bucketCap(p);
    const full = p.bucket >= cap * 0.92 || (p.ab.deadlineT > 0 && p.ab.deadlineT < 3);
    const nothing = this.target < 0 && this.plan > 0;
    const worthIt = p.bucket >= cap * 0.6 || (nothing && p.bucket > 0.5);
    if (full || (worthIt && (this.target < 0 || w.h[this.target] < CC.dry || nothing))) {
      // allo scarico piu' vicino (per percorso)
      const here = cellAtPx(p.x, p.y);
      let best: { id: string; d: number } | null = null;
      for (const dr of DRAINS) {
        if (w.clogged.has(dr.id)) continue;
        const f = CCBot.drainField.get(dr.id)!;
        const dd = here >= 0 ? f[here] : -1;
        if (dd >= 0 && (!best || dd < best.d)) best = { id: dr.id, d: dd };
      }
      if (!best) return out;
      const dr = DRAINS.find((x) => x.id === best!.id)!;
      if (Math.hypot(p.x - dr.cx, p.y - dr.cy) <= CC.emptyRadius - 8) {
        if (!this.pressedOnce) {
          out.bucketPressed = true;
          out.bucketHeld = true;
          this.pressedOnce = true;
        } else this.pressedOnce = false;
        this.target = -1;
        return out;
      }
      this.pressedOnce = false;
      this.stick(out, this.stepToward(w, p, CCBot.drainField.get(best.id)!));
      return out;
    }
    if (this.plan <= 0 || this.target < 0 || w.h[this.target] < CC.dry) {
      this.plan = 0.6;
      this.walkField = bfs(w, [cellAtPx(p.x, p.y)], false);
      let best = -1;
      let score = 0;
      for (const k of w.grid.interiorCells) {
        if (w.h[k] < CC.dry * 1.4 || this.walkField[k] < 0) continue;
        const s = w.h[k] - this.walkField[k] * 0.01;
        if (s > score) {
          score = s;
          best = k;
        }
      }
      this.target = best;
    }
    if (this.target < 0) return out;
    const c = cellCenterPx(this.target);
    if (Math.hypot(p.x - c.x, p.y - c.y) < 26) {
      out.bucketHeld = true;
      return out;
    }
    const field = bfs(w, [this.target], false);
    this.stick(out, this.stepToward(w, p, field));
    if (w.waterAt(p.x, p.y) > CC.dry * 1.5) out.bucketHeld = true;
    return out;
  }

  private squeegee(w: CasaCarboWorld, p: CCPlayer, out: CCInput, dt = 1 / 30): CCInput {
    const bath = CCBot.bathField!;
    const here = cellAtPx(p.x, p.y);
    // sta spingendo: continua in discesa verso lo scarico finche' davanti c'e' acqua
    if (this.pushDir && here >= 0 && bath[here] >= 0) {
      this.pushT -= dt;
      const ahead = w.waterAt(p.x + p.fx * 30, p.y + p.fy * 30) + w.waterAt(p.x + p.fx * 50, p.y + p.fy * 50);
      if ((ahead > CC.dry || this.pushT > 0) && bath[here] > 0) {
        const d = this.stepToward(w, p, bath);
        this.stick(out, d);
        out.squeegeeHeld = true;
        return out;
      }
      this.pushDir = null;
    }
    if (this.plan <= 0 || this.target < 0 || w.h[this.target] < CC.dry) {
      this.plan = 0.8;
      let best = -1;
      let score = 0;
      this.walkField = bfs(w, [cellAtPx(p.x, p.y)], false);
      for (const k of w.grid.interiorCells) {
        if (w.h[k] < CC.dry * 1.4 || bath[k] < 0 || this.walkField[k] < 0) continue;
        const s = w.h[k] / (1 + bath[k] * 0.03) - this.walkField[k] * 0.004;
        if (s > score) {
          score = s;
          best = k;
        }
      }
      this.target = best;
    }
    if (this.target < 0) return out;
    // punto di partenza: una cella "a monte" della pozza (piu' lontana dallo scarico)
    let up = this.target;
    for (let s = 0; s < 2; s++) {
      const i = up % COLS;
      let nb = up;
      for (const m of [i > 0 ? up - 1 : -1, i < COLS - 1 ? up + 1 : -1, up - COLS, up + COLS]) {
        if (m < 0 || m >= N || bath[m] < 0 || !w.grid.walk[m]) continue;
        if (bath[m] > bath[nb]) nb = m;
      }
      up = nb;
    }
    const c = cellCenterPx(up);
    if (Math.hypot(p.x - c.x, p.y - c.y) < 24) {
      this.pushDir = { x: 0, y: 0 };
      this.pushT = 1.6;
      this.stick(out, this.stepToward(w, p, bath));
      out.squeegeeHeld = true;
      return out;
    }
    const field = bfs(w, [up], false);
    this.stick(out, this.stepToward(w, p, field));
    return out;
  }
}

/** Ruoli di default per numero di giocatori. */
export function botRoles(n: number): BotRole[] {
  const base: BotRole[] = ['bucket', 'squeegee', 'door', 'bucket', 'squeegee'];
  return base.slice(0, n);
}
