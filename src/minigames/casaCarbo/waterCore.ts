import { CC } from './ccTuning';
import { buildGrid, cellAtPx, cellCenterPx, COLS, ROWS, CELL_PX, DOORS, DRAINS, FURNITURE, WALLS, RUG_SPOTS, TV_POINT, spawnPx } from './mapData';
import type { DrainDef, MapGrid, Rect } from './mapData';
import { CC_NO_INPUT, freshCCAbility, freshCCStats } from './ccTypes';
import type { CCEvent, CCEventKind, CCInput, CCPlayer, CCScheduled } from './ccTypes';
import { CCAbilities } from './ccAbilities';
import { contribution } from './scoring';

/**
 * CASA CARBO — SIMULATORE (puro: niente Babylon, niente DOM). Acqua su griglia (celle da 0,5 m), pioggia SOLO dalle due porte,
 * tiracqua, secchi, tre scarichi, contenimento alle porte, scivolate e urti, eventi del temporale, abilita', punteggio di contributo.
 * Il gioco 3D (CasaCarboGame) legge stato ed eventi e disegna; test e bot usano questa stessa classe senza browser.
 *
 * Conservazione: l'acqua non nasce mai dentro casa. Entra solo dalle celle delle due porte (pioggia, raffiche, acqua trattenuta da
 * Boschi che poi rientra) ed esce solo dagli scarichi o quando viene rovesciata fuori casa. Tutto il resto la SPOSTA.
 */

export interface CCWorldOptions {
  ids: string[];
  characters: string[];
  rng: () => number;
  abilities?: boolean;
  duration?: number;
  /** false = nessun evento casuale (test) */
  events?: boolean;
  /** false = niente pioggia (test di conservazione) */
  rain?: boolean;
}

const SUB = 1 / 60;
const dead = (v: number): number => (Math.abs(v) < 0.2 ? 0 : v);
type DoorId = 'front' | 'back';

export class CasaCarboWorld {
  readonly players: CCPlayer[] = [];
  readonly byId = new Map<string, CCPlayer>();
  readonly grid: MapGrid;
  readonly abil: CCAbilities;
  /** acqua per cella */
  readonly h: Float32Array;
  /** celle bloccate per l'acqua in questo momento (diga di Carbo, tappeto spostato) */
  readonly blocked: Uint8Array;
  readonly bathCells: Set<number>;
  events: CCEvent[] = [];
  schedule: CCScheduled[] = [];
  time = 0;
  readonly duration: number;
  over = false;
  phaseName: (typeof CC.rain)[number]['name'] = 'moderata';
  // contabilita' (test di conservazione e telemetria)
  inflowTotal = 0;
  drainedCredited = 0;
  drainedPassive = 0;
  spilledOutside = 0;
  backlog: Record<DoorId, number> = { front: 0, back: 0 };
  private backlogRate: Record<DoorId, number> = { front: 0, back: 0 };
  /** pioggia nominale ultima calcolata per porta (u/s), per HUD */
  doorRate: Record<DoorId, number> = { front: 0, back: 0 };
  clogged = new Set<string>();
  private clogSince = new Map<string, number>();
  rug: { rect: Rect; until: number; cells: number[]; spot: number } | null = null;
  tv: 'none' | 'danger' | 'saved' | 'ruined' = 'none';
  private tvWetT = 0;
  private rainOn: boolean;
  private rng: () => number;
  private pairsA: Int32Array;
  private pairsB: Int32Array;
  private delta: Float32Array;
  private dynRects: Rect[] = [];
  private readonly staticSolids: Rect[] = [...WALLS, ...FURNITURE.map((f) => f.r)];
  private drainBuf = new Map<string, number>();
  emergency: {kind:'tv'|'bedroom'|'door'; until:number; door?:DoorId; baseline:number; progress:number; contributions:Map<string,number>} | null = null;
  private bedroomDone = false;
  private nextEmergencyAt = 0;
  private bedroomBuckets = new Map<string,number>();
  private actionBuf = new Map<string,number>();
  private emergenciesOn = true;
  private lastBump = new Map<string, number>();

  constructor(opts: CCWorldOptions) {
    this.emergenciesOn = opts.events !== false;
    this.rng = opts.rng;
    this.duration = opts.duration ?? CC.duration;
    this.rainOn = opts.rain !== false;
    this.grid = buildGrid();
    const n = COLS * ROWS;
    this.h = new Float32Array(n);
    this.blocked = new Uint8Array(n);
    this.delta = new Float32Array(n);
    this.bathCells = new Set(this.grid.bathDrainCells);
    // coppie di celle vicine che possono scambiarsi acqua (precalcolate una volta)
    const a: number[] = [];
    const b: number[] = [];
    for (let k = 0; k < n; k++) {
      if (!this.grid.floor[k]) continue;
      const i = k % COLS;
      if (i < COLS - 1 && this.grid.floor[k + 1]) {
        a.push(k);
        b.push(k + 1);
      }
      if (k + COLS < n && this.grid.floor[k + COLS]) {
        a.push(k);
        b.push(k + COLS);
      }
    }
    this.pairsA = Int32Array.from(a);
    this.pairsB = Int32Array.from(b);
    this.abil = new CCAbilities(this, opts.abilities !== false);

    const sp = spawnPx(opts.ids.length);
    opts.ids.forEach((id, i) => {
      const p: CCPlayer = {
        id,
        index: i,
        characterId: opts.characters[i] ?? 'goblin',
        x: sp[i].x,
        y: sp[i].y,
        vx: 0,
        vy: 0,
        fx: 0,
        fy: -1,
        bucket: 0,
        dashT: 0,
        dashCd: 0,
        slipT: 0,
        holdT: 0,
        holdKey: '',
        squeegee: false,
        scooping: false,
        containing: null,
        tieBreak: this.rng(),
        ab: freshCCAbility(),
        stats: freshCCStats()
      };
      this.abil.init(p);
      this.players.push(p);
      this.byId.set(id, p);
    });
    if (opts.events !== false) this.makeSchedule();
  }

  // ------------------------------------------------------------------ utilita'

  emit(e: CCEvent): void {
    this.events.push(e);
  }
  drainEvents(): CCEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }
  private uniform(a: number, b: number): number {
    return a + (b - a) * this.rng();
  }
  doorDef(id: DoorId): (typeof DOORS)[number] {
    return DOORS.find((d) => d.id === id)!;
  }
  /** Fattore pioggia per numero di giocatori. */
  get rainFactor(): number {
    return CC.rainBase + CC.rainPerPlayer * this.players.length;
  }
  bucketCap(p: CCPlayer): number {
    return CC.bucketCap * (p.ab.bigBucket ? this.abil.ciroMult : 1);
  }
  waterAt(x: number, y: number): number {
    const k = cellAtPx(x, y);
    return k >= 0 ? this.h[k] : 0;
  }
  waterOnFloor(): number {
    let s = 0;
    for (let k = 0; k < this.h.length; k++) s += this.h[k];
    return s;
  }
  waterInBuckets(): number {
    return this.players.reduce((a, p) => a + p.bucket, 0);
  }
  /** % di pavimento interno asciutto (0..1). */
  dryFraction(): number {
    let dry = 0;
    for (const k of this.grid.interiorCells) if (this.h[k] < CC.dry) dry++;
    return dry / this.grid.interiorCells.length;
  }
  isInside(x: number, y: number): boolean {
    const k = cellAtPx(x, y);
    return k >= 0 && this.grid.floor[k] === 1;
  }

  // ------------------------------------------------------------------ eventi programmati

  private makeSchedule(): void {
    const E = CC.events;
    const s: CCScheduled[] = [];
    s.push({ kind: 'pioggia', at: this.uniform(...E.pioggia.window), announced: false, started: false, ended: false });
    for (const w of E.raffica.windows) s.push({ kind: 'raffica', at: this.uniform(w[0], w[1]), door: this.rng() < 0.5 ? 'front' : 'back', announced: false, started: false, ended: false });
    s.push({ kind: 'tappeto', at: this.uniform(...E.tappeto.window), rug: Math.floor(this.rng() * RUG_SPOTS.length), announced: false, started: false, ended: false });
    const drains: ('bagno' | 'lavello' | 'tombino')[] = ['bagno', 'lavello', 'tombino'];
    s.push({ kind: 'intasato', at: this.uniform(...E.intasato.window), drain: drains[Math.floor(this.rng() * 3)], announced: false, started: false, ended: false });
    s.sort((a, b) => a.at - b.at);
    this.schedule = s;
  }

  /** Prossima raffica o pioggia intensificata fra ora e ora+window (per Victor). */
  nextGust(within: number): { index: number; ev: CCScheduled } | null {
    let best: { index: number; ev: CCScheduled } | null = null;
    this.schedule.forEach((ev, index) => {
      if ((ev.kind === 'raffica' || ev.kind === 'pioggia') && !ev.started && ev.at > this.time && ev.at <= this.time + within) {
        if (!best || ev.at < best.ev.at) best = { index, ev };
      }
    });
    return best;
  }

  private durationOf(ev: CCScheduled): number {
    const E = CC.events;
    return ev.kind === 'pioggia' ? E.pioggia.duration : ev.kind === 'raffica' ? E.raffica.duration : ev.kind === 'tappeto' ? E.tappeto.duration : ev.kind === 'intasato' ? E.intasato.autoClear : 0;
  }

  private updateSchedule(): void {
    for (const ev of this.schedule) {
      if (!ev.announced && ev.kind === 'raffica' && this.time >= ev.at - CC.events.announce && (this.emergency || this.time < this.nextEmergencyAt)) {
        ev.at = Math.max(this.emergency?.until ?? 0, this.nextEmergencyAt) + CC.events.announce + 1;
      }
      if (!ev.announced && (ev.kind === 'raffica' || ev.kind === 'pioggia') && this.time >= ev.at - CC.events.announce) {
        ev.announced = true;
        if(ev.kind==='raffica') this.startEmergency('door',ev.at+CC.events.raffica.duration,0,ev.door);
        this.emit({ t: 'announce', kind: ev.kind, door: ev.door, at: ev.at });
      }
      if (!ev.started && this.time >= ev.at) {
        ev.started = true;
        ev.announced = true;
        if (ev.kind === 'tappeto' && ev.rug !== undefined) this.placeRug(ev.rug, ev.at + this.durationOf(ev));
        if (ev.kind === 'intasato' && ev.drain) {
          this.clogged.add(ev.drain);
          this.clogSince.set(ev.drain, this.time);
        }
        this.emit({ t: 'eventStart', kind: ev.kind, door: ev.door, drain: ev.drain, rug: ev.rug });
      }
      if (ev.started && !ev.ended && this.time >= ev.at + this.durationOf(ev)) {
        ev.ended = true;
        if (ev.kind === 'tappeto') this.clearRug();
        if (ev.kind === 'intasato' && ev.drain && this.clogged.has(ev.drain)) this.clogged.delete(ev.drain);
        this.emit({ t: 'eventEnd', kind: ev.kind, door: ev.door, drain: ev.drain, rug: ev.rug });
      }
    }
  }

  private activeMult(kind: CCEventKind, door?: DoorId): boolean {
    return this.schedule.some((ev) => ev.kind === kind && ev.started && !ev.ended && (door === undefined || ev.door === door));
  }

  private placeRug(spot: number, until: number): void {
    const rect = RUG_SPOTS[spot];
    const cells: number[] = [];
    for (let y = rect[1] + CELL_PX / 2; y < rect[3]; y += CELL_PX) {
      for (let x = rect[0] + CELL_PX / 2; x < rect[2]; x += CELL_PX) {
        const k = cellAtPx(x, y);
        if (k >= 0 && this.grid.floor[k]) cells.push(k);
      }
    }
    this.blockCells(cells);
    this.rug = { rect, until, cells, spot };
    this.dynRects.push(rect);
  }

  clearRug(by?: CCPlayer): void {
    if (!this.rug) return;
    this.unblockCells(this.rug.cells);
    this.dynRects = this.dynRects.filter((r) => r !== this.rug!.rect);
    this.rug = null;
    if (by) this.emit({ t: 'rugCleared', id: by.id });
    const ev = this.schedule.find((e) => e.kind === 'tappeto' && e.started && !e.ended);
    if (ev && by) {
      ev.ended = true;
      this.emit({ t: 'eventEnd', kind: 'tappeto', rug: ev.rug });
    }
  }

  /** Blocca delle celle all'acqua: l'acqua che c'era si sposta nella cella libera vicina (nessuna perdita, nessuna creazione). */
  blockCells(cells: number[]): void {
    for (const k of cells) this.blocked[k] = 1;
    for (const k of cells) {
      if (this.h[k] <= 0) continue;
      const nb = [k - 1, k + 1, k - COLS, k + COLS].find((q) => q >= 0 && q < this.h.length && this.grid.floor[q] && !this.blocked[q]);
      if (nb !== undefined) {
        this.h[nb] += this.h[k];
        this.h[k] = 0;
      }
    }
  }
  unblockCells(cells: number[]): void {
    for (const k of cells) this.blocked[k] = 0;
  }

  // ------------------------------------------------------------------ passo

  step(dt: number, inputs: Record<string, CCInput> | Map<string, CCInput>): void {
    if (this.over) return;
    const get = (id: string): CCInput => (inputs instanceof Map ? inputs.get(id) : inputs[id]) ?? CC_NO_INPUT;
    const n = Math.max(1, Math.ceil(dt / SUB - 1e-9));
    const sub = dt / n;
    for (let i = 0; i < n && !this.over; i++) {
      this.time += sub;
      this.updatePhase();
      this.updateSchedule();
      for (const p of this.players) {
        const raw = get(p.id);
        const inp = i === 0 ? raw : { ...raw, bucketPressed: false, dashPressed: false, abilityPressed: false };
        this.stepPlayer(p, inp, sub);
      }
      this.collidePlayers();
      this.rain(sub);
      this.diffuse(sub);
      this.bathPassive(sub);
      this.updateTv(sub);
      this.updateEmergency();
      this.flushActions(false);
      this.autoUnclog();
      this.flushDrainEvents(false);
      if (this.time >= this.duration) this.finish();
    }
  }

  private updatePhase(): void {
    let cur: (typeof CC.rain)[number] = CC.rain[0];
    for (const r of CC.rain) if (this.time >= r.from) cur = r;
    if (cur.name !== this.phaseName) {
      this.phaseName = cur.name;
      this.emit({ t: 'phase', name: cur.name });
    }
  }

  private finish(): void {
    if (this.over) return;
    this.flushDrainEvents(true);
    this.flushActions(true);
    if(this.emergency)this.endEmergency(false);
    this.over = true;
    const dry = this.dryFraction();
    this.emit({ t: 'end', dry, saved: dry >= CC.saveThreshold });
  }

  // ------------------------------------------------------------------ pioggia (unica sorgente)

  /** Pioggia nominale di una porta (u/s) adesso, prima di contenimento e abilita'. */
  nominalRain(door: DoorId): number {
    if (!this.rainOn) return 0;
    let rate: number = CC.rain[0].rate;
    for (const r of CC.rain) if (this.time >= r.from) rate = r.rate;
    rate *= this.rainFactor;
    if (this.activeMult('pioggia')) rate *= CC.events.pioggia.mult;
    if (this.activeMult('raffica', door)) rate += (CC.events.raffica.amount / CC.events.raffica.duration) * (this.rainFactor / 1.1);
    return rate;
  }

  private rain(dt: number): void {
    for (const d of DOORS) {
      const door = d.id;
      const nominal = this.nominalRain(door) * dt;
      this.doorRate[door] = nominal / dt;
      const containers = this.players.filter((p) => p.containing === door);
      const boschi = this.players.find((p) => p.ab.blockT > 0 && p.ab.blockDoor === door);
      let enter = nominal;
      if (boschi) {
        const held = nominal * this.abil.boschiBlock;
        enter = nominal - held;
        const back = held * this.abil.boschiBacklog;
        this.backlog[door] += back;
        boschi.ab.blocked += held;
        this.creditStopped(boschi, held - back);
      } else if (containers.length) {
        const red = Math.min(CC.containMax, CC.containPer * containers.length);
        const stopped = nominal * red;
        enter = nominal - stopped;
        for (const p of containers) this.creditStopped(p, stopped / containers.length);
      }
      // acqua trattenuta da Boschi che rientra tutta insieme
      if (!boschi && this.backlog[door] > 0) {
        if (this.backlogRate[door] <= 0) this.backlogRate[door] = this.backlog[door] / this.abil.boschiRelease;
        const r = Math.min(this.backlog[door], this.backlogRate[door] * dt);
        this.backlog[door] -= r;
        enter += r;
        if (this.backlog[door] <= 1e-9) {
          this.backlog[door] = 0;
          this.backlogRate[door] = 0;
        }
      }
      if (enter <= 0) continue;
      const cells = this.grid.doorCells[door].filter((k) => !this.blocked[k]);
      if (!cells.length) continue;
      for (const k of cells) this.h[k] += enter / cells.length;
      this.inflowTotal += enter;
    }
  }

  private creditStopped(p: CCPlayer, units: number): void {
    p.stats.stopped += units;
    if(this.emergency?.kind==='door' && this.emergency.door===(p.containing ?? p.ab.blockDoor)) this.addEmergency(p.id,units);
  }

  // ------------------------------------------------------------------ acqua: livellamento e scarico passivo

  private diffuse(dt: number): void {
    const K = Math.min(0.24, CC.spread * dt);
    const h = this.h;
    const d = this.delta;
    d.fill(0);
    const A = this.pairsA;
    const B = this.pairsB;
    const bl = this.blocked;
    const st = CC.sticky;
    for (let q = 0; q < A.length; q++) {
      const a = A[q];
      const b = B[q];
      if (bl[a] || bl[b]) continue;
      const diff = h[a] - h[b];
      if (diff > 0) {
        if (h[a] <= st) continue;
        const f = diff * K;
        d[a] -= f;
        d[b] += f;
      } else if (diff < 0) {
        if (h[b] <= st) continue;
        const f = -diff * K;
        d[b] -= f;
        d[a] += f;
      }
    }
    for (let k = 0; k < h.length; k++) if (d[k] !== 0) h[k] = Math.max(0, h[k] + d[k]);
  }

  private bathPassive(dt: number): void {
    if (this.clogged.has('bagno')) return;
    const cells = this.grid.bathDrainCells;
    let budget = CC.bathPassive * dt;
    for (const k of cells) {
      if (budget <= 0) break;
      const take = Math.min(this.h[k], budget / cells.length + 1e-12, budget);
      this.h[k] -= take;
      budget -= take;
      this.drainedPassive += take;
    }
  }

  // ------------------------------------------------------------------ giocatori

  private stepPlayer(p: CCPlayer, inp: CCInput, dt: number): void {
    p.dashCd = Math.max(0, p.dashCd - dt);
    const sx = dead(inp.mx);
    const sy = -dead(inp.my); // stick su = verso il giardino anteriore = y del disegno che cala
    const len = Math.hypot(sx, sy);
    const dx = len > 1 ? sx / len : sx;
    const dy = len > 1 ? sy / len : sy;
    if (inp.abilityPressed) this.emit({ t: 'abilityPress', id: p.id, res: this.abil.press(p, dx, dy) });
    this.abil.update(p, dt);
    const locked = this.abil.locks(p);

    // scivolata: niente controllo, si continua a scivolare
    if (p.slipT > 0) {
      p.slipT -= dt;
      p.vx *= Math.exp(-1.6 * dt);
      p.vy *= Math.exp(-1.6 * dt);
      this.move(p, dt);
      p.squeegee = false;
      p.scooping = false;
      this.setContaining(p, null);
      return;
    }
    if (len > 0.2 && !locked) {
      p.fx = dx / Math.max(1e-6, Math.hypot(dx, dy));
      p.fy = dy / Math.max(1e-6, Math.hypot(dx, dy));
    } else if (len > 0.2 && p.ab.windupT > 0) {
      p.fx = dx / Math.hypot(dx, dy);
      p.fy = dy / Math.hypot(dx, dy);
    }

    // scatto
    if (inp.dashPressed && p.dashCd <= 0 && !locked) {
      p.dashT = CC.dashTime;
      p.dashCd = CC.dashCooldown;
      p.vx = p.fx * CC.dashSpeed;
      p.vy = p.fy * CC.dashSpeed;
      this.emit({ t: 'dash', id: p.id });
      if (p.bucket > 0.01) this.spill(p, CC.dashSpill, 'dash');
    }

    // velocita'
    const capN = CC.bucketCap;
    const fill = Math.min(1.6, p.bucket / capN);
    const slow = 1 - (1 - CC.bucketSlow) * Math.min(1, fill);
    const want = (inp.squeegeeHeld ? CC.squeegeeSpeed : 1) * slow * (fill > 1 ? 0.85 : 1) * CC.speed;
    if (p.dashT > 0) {
      p.dashT -= dt;
    } else if (locked) {
      p.vx = 0;
      p.vy = 0;
    } else {
      const tx = dx * want;
      const ty = dy * want;
      const ax = tx - p.vx;
      const ay = ty - p.vy;
      const al = Math.hypot(ax, ay);
      const maxA = CC.accel * dt;
      if (al > maxA) {
        p.vx += (ax / al) * maxA;
        p.vy += (ay / al) * maxA;
      } else {
        p.vx = tx;
        p.vy = ty;
      }
    }
    this.move(p, dt);

    // tiracqua
    p.squeegee = inp.squeegeeHeld && !locked && p.dashT <= 0;
    if (p.squeegee) this.blade(p, dt);

    // secchio
    const near = this.nearestDrain(p, CC.emptyRadius, false);
    if (inp.bucketPressed && near && p.bucket > 0.05 && !locked) {
      if (this.clogged.has(near.id)) this.emit({ t: 'drainFull', id: p.id, drain: near.id });
      else this.emptyBucket(p, near);
      p.scooping = false;
    } else p.scooping = inp.bucketHeld && !locked && !(near && p.bucket > 0.05) && p.bucket < this.bucketCap(p) - 1e-6;
    if (p.scooping) this.scoop(p, dt);

    // interazione: porte, scarichi intasati, TV, tappeto
    this.interact(p, inp.interactHeld && !locked && Math.hypot(p.vx, p.vy) < 60, dt);

    // scivolata
    const speed = Math.hypot(p.vx, p.vy);
    if ((speed > CC.slipSpeed || p.dashT > 0) && !locked) {
      const w = this.waterAt(p.x, p.y);
      if (w > CC.slipDepth) {
        const chance = CC.slipChance * (w - CC.slipDepth) * (p.dashT > 0 ? 2 : 1) * dt;
        if (this.rng() < chance) {
          p.slipT = CC.slipTime;
          p.dashT = 0;
          p.stats.slips++;
          this.emit({ t: 'slip', id: p.id });
          if (p.bucket > 0.01) this.spill(p, CC.slipSpill, 'slip');
        }
      }
    }
  }

  private setContaining(p: CCPlayer, door: DoorId | null): void {
    if (p.containing === door) return;
    if (p.containing) this.emit({ t: 'contain', id: p.id, door: p.containing, on: false });
    p.containing = door;
    if (door) this.emit({ t: 'contain', id: p.id, door, on: true });
  }

  private interact(p: CCPlayer, holding: boolean, dt: number): void {
    if (!holding) {
      p.holdT = 0;
      p.holdKey = '';
      this.setContaining(p, null);
      return;
    }
    // 1) scarico intasato
    for (const d of DRAINS) {
      if (this.clogged.has(d.id) && Math.hypot(p.x - d.cx, p.y - d.cy) <= CC.interactRadius) {
        this.setContaining(p, null);
        this.hold(p, `unclog:${d.id}`, dt);
        if (p.holdT >= CC.unclogTime) {
          this.clogged.delete(d.id);
          p.stats.unclogged++;
          p.holdT = 0;
          this.emit({ t: 'unclog', id: p.id, drain: d.id });
          const ev = this.schedule.find((e) => e.kind === 'intasato' && e.drain === d.id && e.started && !e.ended);
          if (ev) {
            ev.ended = true;
            this.emit({ t: 'eventEnd', kind: 'intasato', drain: d.id });
          }
        }
        return;
      }
    }
    // 2) TV in pericolo
    if (this.tv === 'danger' && Math.hypot(p.x - TV_POINT.cx, p.y - TV_POINT.cy) <= CC.interactRadius + 10) {
      this.setContaining(p, null);
      this.hold(p, 'tv', dt);
      if(this.emergency?.kind==='tv')this.addEmergency(p.id,dt);
      if (p.holdT >= CC.tvTime) {
        this.tv = 'saved';
        p.stats.tvSaved++;
        this.endEmergency(true,p.id);
        this.emit({ t: 'tv', state: 'saved', by: p.id });
      }
      return;
    }
    // 3) tappeto spostato
    if (this.rug && this.distToRect(p.x, p.y, this.rug.rect) <= CC.radius + 22) {
      this.setContaining(p, null);
      this.hold(p, 'rug', dt);
      if (p.holdT >= CC.rugTime) this.clearRug(p);
      return;
    }
    // 4) porta: contenimento (non serve tenere un tempo minimo)
    for (const d of DOORS) {
      if (Math.hypot(p.x - d.cx, p.y - d.cy) <= CC.containRadius) {
        p.holdKey = `door:${d.id}`;
        this.setContaining(p, d.id);
        return;
      }
    }
    this.setContaining(p, null);
    p.holdT = 0;
    p.holdKey = '';
  }

  private hold(p: CCPlayer, key: string, dt: number): void {
    if (p.holdKey !== key) {
      p.holdKey = key;
      p.holdT = 0;
    }
    p.holdT += dt;
  }

  // ------------------------------------------------------------------ tiracqua e secchio

  private bladeCells(p: CCPlayer, near: number, far: number, half: number): { k: number; fwd: number }[] {
    const out: { k: number; fwd: number }[] = [];
    const r = far + CELL_PX;
    const lx = -p.fy;
    const ly = p.fx;
    for (let y = p.y - r; y <= p.y + r; y += CELL_PX) {
      for (let x = p.x - r; x <= p.x + r; x += CELL_PX) {
        const k = cellAtPx(x, y);
        if (k < 0 || !this.grid.floor[k] || this.blocked[k]) continue;
        const c = cellCenterPx(k);
        const rx = c.x - p.x;
        const ry = c.y - p.y;
        const fwd = rx * p.fx + ry * p.fy;
        const lat = rx * lx + ry * ly;
        if (fwd >= near && fwd <= far && Math.abs(lat) <= half && !out.some((o) => o.k === k)) out.push({ k, fwd });
      }
    }
    out.sort((a, b) => b.fwd - a.fwd); // prima il davanti: l'acqua non viene spostata due volte nello stesso passo
    return out;
  }

  private blade(p: CCPlayer, dt: number): void {
    const frac = Math.min(0.9, CC.bladeRate * dt);
    let moved=0;
    for (const { k } of this.bladeCells(p, CC.bladeNear, CC.bladeFar, CC.bladeHalf)) {
      const m = this.h[k] * frac;
      if (m < 1e-6) continue;
      const c = cellCenterPx(k);
      const t = cellAtPx(c.x + p.fx * CC.bladePush, c.y + p.fy * CC.bladePush);
      if (t < 0 || t === k) continue;
      if (this.bathCells.has(t) && !this.clogged.has('bagno')) {
        this.h[k] -= m;
        this.credit(p, 'bagno', m, 'squeegee');
        moved+=m;
        if(this.emergency?.kind==='bedroom' && this.inBedroom(k))this.addEmergency(p.id,m);
      } else if (this.grid.floor[t] && !this.blocked[t]) {
        this.h[k] -= m;
        this.h[t] += m;
        moved+=m;
      }
    }
    this.bufferAction(p.id,'push',moved);
  }

  /** Sposta TUTTA l'acqua di un'area davanti al giocatore fino in fondo (onda del Goblin). Restituisce l'acqua spostata. */
  wave(p: CCPlayer, length: number, width: number): number {
    const cells = this.bladeCells(p, 0, length, width / 2);
    let total = 0;
    for (const { k } of cells) {
      total += this.h[k];
      this.h[k] = 0;
    }
    if (total <= 0) return 0;
    // la massa d'acqua viaggia in avanti finche' non sbatte: se incontra lo scarico del bagno ci finisce dentro
    let lx = p.x;
    let ly = p.y;
    let last = cellAtPx(p.x, p.y);
    for (let d = CELL_PX; d <= length + CELL_PX * 2; d += CELL_PX / 2) {
      const x = p.x + p.fx * d;
      const y = p.y + p.fy * d;
      const k = cellAtPx(x, y);
      if (k < 0 || !this.grid.floor[k] || this.blocked[k]) break;
      if (this.bathCells.has(k) && !this.clogged.has('bagno')) {
        this.credit(p, 'bagno', total, 'ability');
        return total;
      }
      last = k;
      lx = x;
      ly = y;
    }
    // si deposita contro l'ostacolo, un po' allargata
    const lxp = -p.fy;
    const lyp = p.fx;
    const spots = [last, cellAtPx(lx + lxp * CELL_PX, ly + lyp * CELL_PX), cellAtPx(lx - lxp * CELL_PX, ly - lyp * CELL_PX)].filter((k) => k >= 0 && this.grid.floor[k] && !this.blocked[k]);
    const where = spots.length ? spots : [last];
    for (const k of where) this.h[k] += total / where.length;
    return total;
  }

  private scoop(p: CCPlayer, dt: number): void {
    const cap = this.bucketCap(p);
    let want = Math.min(cap - p.bucket, CC.scoopRate * dt);
    if (want <= 0) return;
    const cells: number[] = [];
    let avail = 0;
    const r = CC.scoopRadius;
    for (let y = p.y - r; y <= p.y + r; y += CELL_PX) {
      for (let x = p.x - r; x <= p.x + r; x += CELL_PX) {
        const k = cellAtPx(x, y);
        if (k < 0 || !this.grid.floor[k] || this.blocked[k] || cells.includes(k)) continue;
        const c = cellCenterPx(k);
        if (Math.hypot(c.x - p.x, c.y - p.y) > r + CELL_PX * 0.5) continue;
        cells.push(k);
        avail += this.h[k];
      }
    }
    if (avail <= 1e-6) return;
    want = Math.min(want, avail);
    for (const k of cells) {
      const take = (this.h[k] / avail) * want;
      this.h[k] -= take;
      if(this.emergency?.kind==='bedroom' && this.inBedroom(k))this.bedroomBuckets.set(p.id,(this.bedroomBuckets.get(p.id)??0)+take);
    }
    p.bucket += want;
    this.bufferAction(p.id,'scoop',want);
  }

  nearestDrain(p: { x: number; y: number }, radius: number, squeegeeOnly: boolean): DrainDef | null {
    let best: DrainDef | null = null;
    let bd = radius;
    for (const d of DRAINS) {
      if (squeegeeOnly && !d.squeegee) continue;
      const dist = Math.hypot(p.x - d.cx, p.y - d.cy);
      if (dist <= bd && this.reachableDirect(p.x,p.y,d.cx,d.cy)) {
        bd = dist;
        best = d;
      }
    }
    return best;
  }

  private emptyBucket(p: CCPlayer, d: DrainDef): void {
    const amount = p.bucket;
    if(this.emergency?.kind==='bedroom')this.addEmergency(p.id,this.bedroomBuckets.get(p.id)??0);
    this.bedroomBuckets.delete(p.id);
    p.bucket = 0;
    this.credit(p, d.id, amount, 'bucket');
    this.flushDrainEvents(true);
    this.abil.onBucketEmptied(p, amount);
  }

  credit(p: CCPlayer, drain: string, amount: number, via: 'bucket' | 'squeegee' | 'ability'): void {
    if (amount <= 0) return;
    if (via === 'bucket') p.stats.drainedBucket += amount;
    else if (via === 'squeegee') p.stats.drainedSqueegee += amount;
    else p.stats.drainedAbility += amount;
    this.drainedCredited += amount;
    const key = `${p.id}|${drain}|${via}`;
    this.drainBuf.set(key, (this.drainBuf.get(key) ?? 0) + amount);
  }

  /** Gli scarichi del tiracqua arrivano a gocce: un evento ogni ~unita' (non uno per passo). */
  private flushDrainEvents(all: boolean): void {
    for (const [key, amount] of this.drainBuf) {
      if (!all && amount < 1) continue;
      const [id, drain, via] = key.split('|');
      this.emit({ t: 'drain', id, drain, amount, via: via as 'bucket' | 'squeegee' | 'ability' });
      this.drainBuf.delete(key);
    }
  }

  /** Rovescia una parte del secchio per terra intorno al giocatore (fuori casa l'acqua finisce in giardino: persa, zero punti). */
  spill(p: CCPlayer, fraction: number, why: 'dash' | 'slip' | 'bump' | 'deadline'): void {
    const amount = p.bucket * fraction;
    if (amount <= 0) return;
    p.bucket -= amount;
    this.bedroomBuckets.set(p.id,(this.bedroomBuckets.get(p.id)??0)*(1-fraction));
    p.stats.spilled += amount;
    const cells: number[] = [];
    for (let y = p.y - 30; y <= p.y + 30; y += CELL_PX) {
      for (let x = p.x - 30; x <= p.x + 30; x += CELL_PX) {
        const k = cellAtPx(x, y);
        if (k >= 0 && this.grid.floor[k] && !this.blocked[k] && !cells.includes(k)) cells.push(k);
      }
    }
    if (cells.length) for (const k of cells) this.h[k] += amount / cells.length;
    else this.spilledOutside += amount;
    this.emit({ t: 'spill', id: p.id, amount, why });
  }

  // ------------------------------------------------------------------ collisioni

  private distToRect(x: number, y: number, r: Rect): number {
    const cx = Math.max(r[0], Math.min(r[2], x));
    const cy = Math.max(r[1], Math.min(r[3], y));
    return Math.hypot(x - cx, y - cy);
  }

  private move(p: CCPlayer, dt: number): void {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    const R = CC.radius;
    const solids = this.dynRects.length ? [...this.staticSolids, ...this.dynRects] : this.staticSolids;
    for (let it = 0; it < 2; it++) {
      for (const r of solids) {
        const cx = Math.max(r[0], Math.min(r[2], p.x));
        const cy = Math.max(r[1], Math.min(r[3], p.y));
        const dx = p.x - cx;
        const dy = p.y - cy;
        const d = Math.hypot(dx, dy);
        if (d >= R) continue;
        if (d > 1e-6) {
          p.x = cx + (dx / d) * R;
          p.y = cy + (dy / d) * R;
          const vn = (p.vx * dx + p.vy * dy) / d;
          if (vn < 0) {
            p.vx -= (vn * dx) / d;
            p.vy -= (vn * dy) / d;
          }
        } else {
          // centro dentro il rettangolo: esce dal lato piu' vicino
          const opts = [
            { d: p.x - r[0], x: r[0] - R, y: p.y },
            { d: r[2] - p.x, x: r[2] + R, y: p.y },
            { d: p.y - r[1], x: p.x, y: r[1] - R },
            { d: r[3] - p.y, x: p.x, y: r[3] + R }
          ].sort((a, b) => a.d - b.d)[0];
          p.x = opts.x;
          p.y = opts.y;
        }
      }
    }
    p.x = Math.max(85 + R, Math.min(1390 - R, p.x));
    p.y = Math.max(60 + R, Math.min(880 - R, p.y));
  }

  private collidePlayers(): void {
    const R = CC.radius;
    for (let i = 0; i < this.players.length; i++) {
      for (let j = i + 1; j < this.players.length; j++) {
        const a = this.players[i];
        const b = this.players[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d >= R * 2) continue;
        const nx = d>1e-6 ? dx / d : 1;
        const ny = d>1e-6 ? dy / d : 0;
        const push = (R * 2 - d) / 2;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
        const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
        // Transfer closing momentum once; parallel contact does not repeatedly brake or spill.
        if (rel > 20) {
          const impulse = Math.min(160, rel * 0.5);
          a.vx -= nx * impulse; a.vy -= ny * impulse;
          b.vx += nx * impulse; b.vy += ny * impulse;
        }
        if (rel > CC.bumpSpeed) {
          for (const q of [a, b]) {
            if (q.bucket > 0.01 && this.time - (this.lastBump.get(q.id) ?? -9) >= CC.bumpCooldown) {
              this.lastBump.set(q.id, this.time);
              this.spill(q, CC.bumpSpill, 'bump');
            }
          }
        }
      }
    }
  }

  // ------------------------------------------------------------------ TV e scarichi

  private tvMean(): number {
    let s = 0;
    for (const k of this.grid.tvCells) s += this.h[k];
    return s / Math.max(1, this.grid.tvCells.length);
  }

  private updateTv(dt: number): void {
    const T = CC.events.tv;
    if (this.tv === 'none') {
      if (!this.emergency && this.time >= this.nextEmergencyAt && this.time >= T.after && this.tvMean() > T.depth) {
        this.tv = 'danger';
        this.startEmergency('tv',this.time+T.ruinAfter,0);
        this.emit({ t: 'tv', state: 'danger' });
      }
    } else if (this.tv === 'danger') {
      // obiettivo a tempo: chi non la sposta entro ruinAfter secondi se la ritrova rovinata
      this.tvWetT += dt;
      if (this.tvWetT >= T.ruinAfter) {
        this.tv = 'ruined';
        this.endEmergency(false);
        this.emit({ t: 'tv', state: 'ruined' });
      }
    }
  }

  private autoUnclog(): void {
    for (const id of [...this.clogged]) {
      const since = this.clogSince.get(id) ?? this.time;
      if (this.time - since >= CC.events.intasato.autoClear) this.clogged.delete(id);
    }
  }

  private reachableDirect(x:number,y:number,tx:number,ty:number):boolean {
    const n=Math.max(1,Math.ceil(Math.hypot(tx-x,ty-y)/8));
    for(let i=1;i<n;i++) for(const r of [...this.staticSolids,...this.dynRects])
      if(this.distToRect(x+(tx-x)*i/n,y+(ty-y)*i/n,r)<CC.radius)return false;
    return true;
  }
  private inBedroom(k:number):boolean {const c=cellCenterPx(k);return c.x>=85&&c.x<778&&c.y>=175&&c.y<392;}
  bedroomWater():number {let sum=0;for(const k of this.grid.interiorCells)if(this.inBedroom(k))sum+=this.h[k];return sum;}
  private bedroomDepth():number {let n=0;for(const k of this.grid.interiorCells)if(this.inBedroom(k))n++;return this.bedroomWater()/Math.max(1,n);}
  private startEmergency(kind:'tv'|'bedroom'|'door',until:number,baseline:number,door?:DoorId):void {
    if(this.emergency)return;
    this.emergency={kind,until,baseline,door,progress:0,contributions:new Map()};
    this.bedroomBuckets.clear();
    this.emit({t:'emergency',kind,state:'start',door});
  }
  private addEmergency(id:string,amount:number):void {
    if(this.emergency && amount>0)this.emergency.contributions.set(id,(this.emergency.contributions.get(id)??0)+amount);
  }
  private endEmergency(won:boolean,tvWinner?:string):void {
    const e=this.emergency;if(!e)return;
    const rewards:Record<string,number>={};
    const entries=[...e.contributions].filter(([id])=>id!==tvWinner);
    const sum=entries.reduce((a,[,v])=>a+v,0);
    const pool=e.kind==='tv'?CC.emergency.tvAssistPool:e.kind==='bedroom'?CC.emergency.bedroomPool:CC.emergency.doorPool;
    if(won && sum>0)for(const [id,v] of entries){const p=this.byId.get(id);if(p){const bonus=pool*v/sum;p.stats.emergencyBonus+=bonus;rewards[id]=bonus;}}
    this.emit({t:'emergency',kind:e.kind,state:won?'won':'lost',door:e.door,rewards});
    this.emergency=null;this.nextEmergencyAt=this.time+4;this.bedroomBuckets.clear();
  }
  private updateEmergency():void {
    const e=this.emergency;
    if(e){
      if(e.kind==='bedroom'){
        e.progress=Math.max(0,Math.min(1,(e.baseline-this.bedroomWater())/(e.baseline*.35)));
        // Only water permanently drained earns a bonus; moving it back and forth does not.
        if(e.progress>=1 && e.contributions.size>0){this.endEmergency(true);return;}
      } else if(e.kind==='door')e.progress=Math.min(1,[...e.contributions.values()].reduce((a,v)=>a+v,0)/(CC.events.raffica.amount*.3));
      else e.progress=Math.max(0,...this.players.map(p=>p.holdKey==='tv'?p.holdT/CC.tvTime:0));
      if(this.time>=e.until)this.endEmergency(e.kind==='door'&&e.progress>=1);
    } else if(this.emergenciesOn && !this.bedroomDone && this.time>=20 && this.time>=this.nextEmergencyAt && this.bedroomDepth()>=CC.emergency.bedroomDepth){
      this.bedroomDone=true;this.startEmergency('bedroom',this.time+CC.emergency.bedroomDuration,this.bedroomWater());
    }
  }
  private bufferAction(id:string,via:'push'|'scoop',amount:number):void {if(amount>0){const k=id+'|'+via;this.actionBuf.set(k,(this.actionBuf.get(k)??0)+amount);}}
  private flushActions(all:boolean):void {
    for(const [key,amount] of this.actionBuf)if(all||amount>=.35){const [id,via]=key.split('|');this.emit({t:'waterAction',id,via:via as 'push'|'scoop',amount});this.actionBuf.delete(key);}
  }

  // ------------------------------------------------------------------ risultati

  contribution(p: CCPlayer): number {
    return contribution(p.stats);
  }

  /** Classifica finale: contributo, poi acqua eliminata, poi spareggio fisso estratto a inizio partita. */
  ranking(): CCPlayer[] {
    const drained = (p: CCPlayer): number => p.stats.drainedBucket + p.stats.drainedSqueegee + p.stats.drainedAbility;
    return [...this.players].sort((a, b) => this.contribution(b) - this.contribution(a) || drained(b) - drained(a) || a.tieBreak - b.tieBreak);
  }

  get timeLeft(): number {
    return Math.max(0, this.duration - this.time);
  }
}

export { DRAINS, DOORS };
