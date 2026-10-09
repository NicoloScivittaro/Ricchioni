import { AB } from '../../../shared/abilityCatalog';
import type { AbilityStatus } from '../../../shared/abilityCatalog';
import { CC } from './ccTuning';
import { CELL_PX, COLS, DOORS, cellAtPx } from './mapData';
import type { CCAbilityResult, CCPlayer } from './ccTypes';
import type { CasaCarboWorld } from './waterCore';

/**
 * ABILITA' DI CASA CARBO (numeri SOLO da shared/abilityCatalog.ts, game 'casacarbo'). Valgono a PARTITA (cariche dichiarate nel
 * catalogo). Nessuna toglie acqua "gratis": spostano, fermano o informano, e ognuna ha il suo modo di andare storta.
 *   GOBLIN  N'CULO, MO ASCIUGO IO!  onda caricata: sposta tutta l'acqua davanti (nello scarico del bagno = tolta; male = altra stanza)
 *   BOSCHI  TU QUA NON ENTRI!       blocca quasi tutta una porta, fermo; meta' dell'acqua trattenuta rientra tutta insieme dopo
 *   VICTOR  M'HO SVEJATO            vede in privato la prossima raffica (porta e tempo), se arriva entro la finestra
 *   CARBO   NO, ASPETTA!            diga che ferma l'acqua (non le persone); se si accumula troppo, cede
 *   CIRO    PAGO DOMANI             secchio doppio, ma oltre la capienza normale ha pochi secondi per svuotarlo
 */
const G = AB.casacarbo.goblin;
const B = AB.casacarbo.buttafuori;
const V = AB.casacarbo.dottore;
const J = AB.casacarbo.judoka;
const C = AB.casacarbo.ciro;
const M = 40; // px per metro

export const CC_IMPACT = {
  waveMoved: 'acqua spostata con l\'onda',
  waveDrained: 'acqua tolta con l\'onda',
  blocked: 'acqua fermata alla porta',
  intelOk: 'raffiche previste',
  damHeld: 'acqua trattenuta dalla diga',
  damBroken: 'dighe crollate',
  bigOk: 'secchi doppi svuotati',
  bigLost: 'secchi doppi rovesciati'
} as const;

const bump = (p: CCPlayer, key: string, n = 1): void => {
  p.stats.impact[key] = (p.stats.impact[key] ?? 0) + n;
};

export class CCAbilities {
  constructor(
    private w: CasaCarboWorld,
    readonly enabled: boolean
  ) {}

  get ciroMult(): number {
    return C.p.mult;
  }
  get boschiBlock(): number {
    return B.p.block;
  }
  get boschiBacklog(): number {
    return B.p.backlog;
  }
  get boschiRelease(): number {
    return B.p.release;
  }

  init(p: CCPlayer): void {
    const def = AB.casacarbo[p.characterId as keyof typeof AB.casacarbo];
    p.ab.charges = def ? def.charges : 0;
  }

  /** Abilita' che tengono fermo il personaggio (carica del Goblin, Boschi sulla porta). */
  locks(p: CCPlayer): boolean {
    return p.ab.windupT > 0 || p.ab.blockT > 0;
  }

  press(p: CCPlayer, dx: number, dy: number): CCAbilityResult {
    if (!this.enabled) return 'disabled';
    if (this.w.over) return 'notNow';
    const a = p.ab;
    if (p.slipT > 0 || this.locks(p)) return 'busy';
    switch (p.characterId) {
      case 'goblin': {
        if (a.charges <= 0) return 'spent';
        if (a.cooldown > 0) return 'cooldown';
        if (Math.hypot(dx, dy) > 0.2) {
          const l = Math.hypot(dx, dy);
          p.fx = dx / l;
          p.fy = dy / l;
        }
        a.charges--;
        a.cooldown = G.cooldown;
        a.windupT = G.p.windup;
        p.vx = 0;
        p.vy = 0;
        p.stats.abilityUses++;
        this.w.emit({ t: 'ability', id: p.id, a: 'goblin_windup' });
        return 'ok';
      }
      case 'buttafuori': {
        if (a.charges <= 0) return 'spent';
        const door = DOORS.find((d) => Math.hypot(p.x - d.cx, p.y - d.cy) <= B.p.range * M);
        if (!door) return 'notNear';
        a.charges--;
        a.blockT = B.p.duration;
        a.blockDoor = door.id;
        a.blocked = 0;
        p.vx = 0;
        p.vy = 0;
        p.stats.abilityUses++;
        this.w.emit({ t: 'ability', id: p.id, a: 'boschi_block', door: door.id });
        return 'ok';
      }
      case 'dottore': {
        if (a.charges <= 0) return 'spent';
        if (a.intelT > 0) return 'busy';
        a.charges--;
        p.stats.abilityUses++;
        const next = this.w.nextGust(V.p.window);
        if (next) {
          a.intelT = next.ev.at - this.w.time + 1;
          a.intelDoor = next.ev.door ?? null;
          a.intelAt = next.ev.at;
          a.intelEvent = next.index;
          p.stats.abilitySuccess++;
          bump(p, CC_IMPACT.intelOk);
          this.w.emit({ t: 'ability', id: p.id, a: 'victor_intel', door: next.ev.door, at: next.ev.at });
        } else {
          p.stats.abilityFail++;
          this.w.emit({ t: 'ability', id: p.id, a: 'victor_wasted' });
        }
        return 'ok';
      }
      case 'judoka': {
        if (a.charges <= 0) return 'spent';
        if (a.damT > 0) return 'busy';
        const cells = this.damCells(p);
        if (cells.length < 2) return 'notNow';
        a.charges--;
        a.damT = J.p.duration;
        a.damCells = cells;
        a.damHeldMax = 0;
        this.w.blockCells(cells);
        p.stats.abilityUses++;
        this.w.emit({ t: 'ability', id: p.id, a: 'carbo_dam' });
        return 'ok';
      }
      case 'ciro': {
        if (a.charges <= 0) return 'spent';
        if (a.bigBucket) return 'busy';
        a.charges--;
        a.bigBucket = true;
        a.deadlineT = 0;
        p.stats.abilityUses++;
        this.w.emit({ t: 'ability', id: p.id, a: 'ciro_arm' });
        return 'ok';
      }
    }
    return 'notNow';
  }

  /** Celle della diga: una linea perpendicolare allo sguardo, davanti al personaggio (solo pavimento di casa). */
  damCells(p: CCPlayer): number[] {
    const cx = p.x + p.fx * J.p.distance * M;
    const cy = p.y + p.fy * J.p.distance * M;
    const lx = -p.fy;
    const ly = p.fx;
    const half = (J.p.length * M) / 2;
    const out: number[] = [];
    for (let s = -half; s <= half + 0.01; s += CELL_PX / 2) {
      const k = cellAtPx(cx + lx * s, cy + ly * s);
      if (k >= 0 && this.w.grid.floor[k] && !this.w.blocked[k] && !out.includes(k)) out.push(k);
    }
    return out;
  }

  private zoneCache = new WeakMap<number[], number[]>();
  private damZone(cells: number[]): number[] {
    const hit = this.zoneCache.get(cells);
    if (hit) return hit;
    const set = new Set<number>();
    const grid = this.w.grid;
    for (const k of cells) {
      for (let dj = -2; dj <= 2; dj++) {
        for (let di = -2; di <= 2; di++) {
          const q = k + dj * COLS + di;
          if (q >= 0 && q < this.w.h.length && grid.floor[q] && !cells.includes(q)) set.add(q);
        }
      }
    }
    const out = [...set];
    this.zoneCache.set(cells, out);
    return out;
  }

  update(p: CCPlayer, dt: number): void {
    const a = p.ab;
    if (a.cooldown > 0) a.cooldown = Math.max(0, a.cooldown - dt);
    // Goblin: fine della carica = onda
    if (a.windupT > 0) {
      a.windupT -= dt;
      if (a.windupT <= 0) {
        a.windupT = 0;
        const before = p.stats.drainedAbility;
        const moved = this.w.wave(p, G.p.length * M, G.p.width * M);
        const drained = p.stats.drainedAbility - before;
        // chi sta davanti viene spinto via dall'onda
        for (const o of this.w.players) {
          if (o === p) continue;
          const rx = o.x - p.x;
          const ry = o.y - p.y;
          const fwd = rx * p.fx + ry * p.fy;
          const lat = Math.abs(-rx * p.fy + ry * p.fx);
          if (fwd > 0 && fwd <= G.p.length * M && lat <= (G.p.width * M) / 2 + CC.radius) {
            o.vx += p.fx * G.p.push * M;
            o.vy += p.fy * G.p.push * M;
            o.dashT = Math.max(o.dashT, 0.12);
          }
        }
        bump(p, CC_IMPACT.waveMoved, Math.round(moved * 10) / 10);
        if (drained > 0) bump(p, CC_IMPACT.waveDrained, Math.round(drained * 10) / 10);
        if (moved >= 3) p.stats.abilitySuccess++;
        else p.stats.abilityFail++;
        this.w.emit({ t: 'ability', id: p.id, a: 'goblin_wave', amount: moved });
      }
    }
    // Boschi: fine del blocco
    if (a.blockT > 0) {
      a.blockT -= dt;
      if (a.blockT <= 0) {
        a.blockT = 0;
        const door = a.blockDoor ?? undefined;
        const net = a.blocked * (1 - B.p.backlog);
        bump(p, CC_IMPACT.blocked, Math.round(net * 10) / 10);
        if (net > 1) p.stats.abilitySuccess++;
        else p.stats.abilityFail++;
        this.w.emit({ t: 'ability', id: p.id, a: 'boschi_release', door, amount: a.blocked * B.p.backlog });
        a.blockDoor = null;
      }
    }
    // Victor: l'avviso resta finche' la raffica arriva
    if (a.intelT > 0) {
      a.intelT -= dt;
      if (a.intelT <= 0) {
        a.intelT = 0;
        a.intelDoor = null;
      }
    }
    // Carbo: diga che regge o cede
    if (a.damT > 0) {
      a.damT -= dt;
      // pressione = acqua appoggiata alla diga (celle entro due passi, da entrambi i lati)
      let pressure = 0;
      for (const q of this.damZone(a.damCells)) pressure += this.w.h[q];
      a.damHeldMax = Math.max(a.damHeldMax, pressure);
      if (pressure > J.p.capacity) {
        this.w.unblockCells(a.damCells);
        a.damCells = [];
        a.damT = 0;
        p.stats.abilityFail++;
        bump(p, CC_IMPACT.damBroken);
        this.w.emit({ t: 'ability', id: p.id, a: 'carbo_break', amount: pressure });
      } else if (a.damT <= 0) {
        this.w.unblockCells(a.damCells);
        a.damCells = [];
        a.damT = 0;
        if (a.damHeldMax >= 2) p.stats.abilitySuccess++;
        bump(p, CC_IMPACT.damHeld, Math.round(a.damHeldMax * 10) / 10);
        this.w.emit({ t: 'ability', id: p.id, a: 'carbo_end' });
      }
    }
    // Ciro: oltre la capienza normale parte il conto alla rovescia
    if (a.bigBucket && p.bucket > CC.bucketCap + 1e-6) {
      if (a.deadlineT <= 0) a.deadlineT = C.p.deadline;
      a.deadlineT -= dt;
      if (a.deadlineT <= 0) {
        a.deadlineT = 0;
        a.bigBucket = false;
        this.w.spill(p, C.p.loss, 'deadline');
        p.stats.abilityFail++;
        bump(p, CC_IMPACT.bigLost);
        this.w.emit({ t: 'ability', id: p.id, a: 'ciro_lost' });
      }
    }
  }

  onBucketEmptied(p: CCPlayer, amount: number): void {
    const a = p.ab;
    if (!a.bigBucket) return;
    if (amount > CC.bucketCap + 1e-6) {
      a.bigBucket = false;
      a.deadlineT = 0;
      p.stats.abilitySuccess++;
      bump(p, CC_IMPACT.bigOk);
      this.w.emit({ t: 'ability', id: p.id, a: 'ciro_paid', amount });
    }
  }

  /** Stato per HUD e telefono. `privateView` = telefono del giocatore: solo li' l'avviso di Victor dice porta e tempo. */
  status(p: CCPlayer, privateView = true): AbilityStatus {
    if (!this.enabled) return { state: 'SPENT', note: 'ABILITÀ OFF' };
    const a = p.ab;
    const s1 = (n: number): string => n.toFixed(1).replace('.', ',');
    const left = (): AbilityStatus => (a.charges > 0 ? { state: 'READY', charges: a.charges, note: a.charges > 1 ? `PRONTA ${a.charges}` : 'PRONTA' } : { state: 'SPENT' });
    switch (p.characterId) {
      case 'goblin':
        if (a.windupT > 0) return { state: 'CHARGING', meter: 1 - a.windupT / G.p.windup, note: 'CARICA...' };
        if (a.cooldown > 0 && a.charges > 0) return { state: 'COOLDOWN', remaining: a.cooldown };
        return left();
      case 'buttafuori':
        if (a.blockT > 0) return { state: 'ACTIVE', remaining: a.blockT, note: `PORTA CHIUSA ${s1(a.blockT)} s` };
        return a.charges > 0 ? { state: 'READY', note: 'PRONTA · VAI A UNA PORTA' } : { state: 'SPENT' };
      case 'dottore':
        if (a.intelT > 0) {
          if (!privateView) return { state: 'ACTIVE', note: 'HA UNA SOFFIATA' };
          const where = a.intelDoor === 'front' ? 'PORTA DAVANTI' : a.intelDoor === 'back' ? 'PORTA DIETRO' : 'TUTTE E DUE';
          return { state: 'ACTIVE', remaining: Math.max(0, a.intelAt - this.w.time), note: `RAFFICA: ${where} TRA ${Math.max(0, Math.ceil(a.intelAt - this.w.time))} s` };
        }
        return left();
      case 'judoka':
        if (a.damT > 0) return { state: 'ACTIVE', remaining: a.damT, note: `DIGA ${s1(a.damT)} s` };
        return left();
      case 'ciro':
        if (a.deadlineT > 0) return { state: 'ACTIVE', remaining: a.deadlineT, note: `SVUOTA! ${s1(a.deadlineT)} s` };
        if (a.bigBucket) return { state: 'ACTIVE', note: 'SECCHIO DOPPIO' };
        return left();
    }
    return { state: 'SPENT' };
  }
}
