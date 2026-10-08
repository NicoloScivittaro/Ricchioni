import { AB } from '../../../shared/abilityCatalog';
import type { AbilityStatus } from '../../../shared/abilityCatalog';
import { KO, PHYS, STAGE, WALL, followMove } from './fighterData';
import type { MoveDef } from './fighterData';
import { freshAbilityState } from './fighterTypes';
import type { AbilityResult, Fighter } from './fighterTypes';
import type { FighterWorld } from './fighterCore';

/**
 * ABILITA' DI BOTTE SUL CORNICIONE. I numeri vengono SOLO da shared/abilityCatalog.ts (game 'cornicione'); qui c'e' la meccanica.
 * Tutte valgono PER VITA (tornano pronte a ogni respawn) e nessuna garantisce un KO, un recupero o l'invulnerabilita' senza
 * controgioco:
 *   GOBLIN      RIMONTA AL 90°     scatto fisico di recupero (non teletrasporto), poi un attacco speciale se rientra
 *   BUTTAFUORI  ULTIMO ACCESSO     sparisce ~1 s e riappare vicino; il punto di ritorno si vede prima
 *   JUDOKA      ANGORA CHE DICI?   postura breve: se lo colpiscono corpo a corpo, afferra e proietta (2 usi)
 *   DOTTORE     TAGLIO PESO        5 s di agilita' aerea, ma i colpi lo lanciano molto piu' lontano
 *   CIRO        BONIFICO           sul punto di morire: premi, il KO e' rinviato, ma si paga se rientri
 */

const G = AB.cornicione.goblin.p;
const B = AB.cornicione.buttafuori.p;
const J = AB.cornicione.judoka.p;
const D = AB.cornicione.dottore.p;
const C = AB.cornicione.ciro.p;

/** Nomi delle metriche d'impatto (stesse stringhe nel report F4). */
export const IMPACT_KEYS = {
  goblinSaves: 'rimonte riuscite',
  goblinFollow: 'attacchi speciali',
  vanishEscapes: 'attacchi evitati',
  vanishUses: 'sparizioni',
  counterTried: 'counter tentati',
  counterOk: 'counter riusciti',
  counterKos: 'KO da counter',
  weightRecoveries: 'recuperi da leggero',
  weightKos: 'KO da leggero',
  bonificoOpened: 'bonifici offerti',
  bonificoUsed: 'bonifici attivati',
  bonificoSaves: 'salvataggi riusciti'
} as const;

const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
const bump = (f: Fighter, key: string, n = 1): void => {
  f.stats.impact[key] = (f.stats.impact[key] ?? 0) + n;
};

export class FighterAbilities {
  constructor(
    private w: FighterWorld,
    readonly enabled: boolean
  ) {}

  /** Stato pulito a inizio vita (inizio partita e respawn). */
  newLife(f: Fighter): void {
    f.ab = freshAbilityState();
    f.ab.charges = f.characterId === 'judoka' ? AB.cornicione.judoka.charges : 1;
  }

  // ------------------------------------------------------------------ pressione del tasto

  press(f: Fighter, sx: number, sy: number): AbilityResult {
    if (!this.enabled) return 'disabled';
    if (!f.inGame || f.dead) return 'notNow';
    const a = f.ab;
    if (a.vanishT > 0 || a.freezeT > 0 || f.frozenT > 0) return 'busy';
    switch (f.characterId) {
      case 'goblin': {
        if (a.charges <= 0) return 'spent';
        if (f.hitstun > 0) return 'stunned';
        if (f.grounded) return 'notAir';
        if (!this.w.offstage(f)) return 'notOffstage';
        let dx = sx;
        let dy = sy;
        const len = Math.hypot(dx, dy);
        if (len < 0.3) {
          dx = -Math.sign(f.x || 1) * 0.8; // senza stick: verso il palco
          dy = 0.6;
        } else {
          dx /= len;
          dy /= len;
        }
        if (dy < 0.35) dy = 0.35; // e' una RIMONTA: sempre un po' in diagonale verso l'alto
        const n = Math.hypot(dx, dy);
        dx /= n;
        dy /= n;
        f.attack = null;
        f.dodge = null;
        f.fastFall = false;
        f.vx = dx * G.burst;
        f.vy = dy * G.burst;
        if (Math.abs(dx) > 0.2) f.facing = dx > 0 ? 1 : -1;
        a.burstT = G.burstTime;
        a.returnT = G.returnWindow;
        a.charges = 0;
        f.recovering = true;
        f.stats.abilityUses++;
        this.w.emit({ t: 'ability', id: f.id, a: 'goblin_burst' });
        return 'ok';
      }
      case 'buttafuori': {
        if (a.charges <= 0) return 'spent';
        if (f.hitstun > 0) return 'stunned';
        f.attack = null;
        f.dodge = null;
        f.fastFall = false;
        a.charges = 0;
        a.vanishT = B.vanish;
        a.vanishTotal = B.vanish;
        this.aimVanish(f, sx, sy);
        f.vx = 0;
        f.vy = 0;
        f.stats.abilityUses++;
        bump(f, IMPACT_KEYS.vanishUses);
        this.w.emit({ t: 'ability', id: f.id, a: 'vanish', x: f.x, y: f.y });
        return 'ok';
      }
      case 'judoka': {
        if (a.charges <= 0) return 'spent';
        if (f.hitstun > 0) return 'stunned';
        if (a.stanceT > 0 || a.whiffT > 0) return 'busy';
        if (f.attack || f.dodge || f.landLag > 0) return 'busy';
        a.charges--;
        a.stanceT = J.window;
        f.vx *= 0.3;
        f.stats.abilityUses++;
        bump(f, IMPACT_KEYS.counterTried);
        this.w.emit({ t: 'ability', id: f.id, a: 'counter_arm' });
        return 'ok';
      }
      case 'dottore': {
        if (a.charges <= 0) return 'spent';
        if (f.hitstun > 0) return 'stunned';
        a.charges = 0;
        a.weightT = D.duration;
        f.stats.abilityUses++;
        this.w.emit({ t: 'ability', id: f.id, a: 'weight_on' });
        return 'ok';
      }
      case 'ciro': {
        if (a.windowT > 0) {
          a.windowT = 0;
          a.charges = 0;
          a.pendingT = C.pending;
          // rientra di qualche metro dal bordo e riavere gli strumenti di recupero: e' "l'ultima possibilita'"
          if (a.pendingHow === 'side') f.x -= Math.sign(f.x) * 6;
          else if (a.pendingHow === 'top') f.y -= 5;
          else f.y += 6;
          f.x = clamp(f.x, KO.minX + 1, KO.maxX - 1);
          f.y = clamp(f.y, KO.minY + 1, KO.maxY - 1);
          f.vx = 0;
          f.vy = 0;
          f.hitstun = 0;
          f.jumps = PHYS.jumps;
          f.airDodgeUsed = false;
          f.recoveryUsed = false;
          f.wallCharges = WALL.charges;
          f.recovering = true;
          f.stats.abilityUses++;
          bump(f, IMPACT_KEYS.bonificoUsed);
          this.w.emit({ t: 'ability', id: f.id, a: 'bonifico_yes', x: f.x, y: f.y });
          return 'ok';
        }
        return a.charges <= 0 ? 'spent' : 'notNow'; // non si "compra" in anticipo: scatta solo quando stai per morire
      }
    }
    return 'notNow';
  }

  // ------------------------------------------------------------------ Buttafuori: dove riappare

  private aimVanish(f: Fighter, sx: number, sy: number): void {
    const a = f.ab;
    let dx = sx;
    let dy = sy;
    const len = Math.hypot(dx, dy);
    if (len < 0.3) {
      dx = f.facing;
      dy = 0;
    } else {
      dx /= len;
      dy /= len;
    }
    let tx = clamp(f.x + dx * B.dist, KO.minX + 3, KO.maxX - 3);
    let ty = clamp(f.y + dy * B.dist, KO.minY + 3, KO.maxY - 3);
    // mai dentro la palazzina
    if (ty < 0 && Math.abs(tx) < STAGE.mainX + PHYS.halfW + 0.05) {
      if (Math.abs(tx) <= STAGE.mainX + 0.35 && f.y >= -0.05) ty = 0;
      else tx = (tx >= 0 ? 1 : -1) * (STAGE.mainX + PHYS.halfW + 0.1);
    }
    a.targetX = tx;
    a.targetY = ty;
  }

  // ------------------------------------------------------------------ passo

  update(f: Fighter, dt: number): void {
    const a = f.ab;
    if (!f.inGame) return;
    if (f.dead) return;
    // Goblin
    if (a.burstT > 0) {
      a.burstT -= dt;
      if (a.burstT <= 0) {
        a.burstT = 0;
        f.vx *= 0.5;
        f.vy *= 0.5;
      }
    }
    if (a.returnT > 0) {
      a.returnT -= dt;
      if (a.returnT <= 0) {
        a.returnT = 0;
        f.stats.abilityFail++;
        this.w.emit({ t: 'ability', id: f.id, a: 'goblin_wasted' });
      }
    }
    if (a.followT > 0) a.followT = Math.max(0, a.followT - dt);
    // Buttafuori
    a.lockDodge = Math.max(0, a.lockDodge - dt);
    if (a.vanishT > 0) {
      const before = a.vanishT;
      a.vanishT -= dt;
      if (before > B.telegraph && a.vanishT <= B.telegraph) this.w.emit({ t: 'ability', id: f.id, a: 'telegraph', x: a.targetX, y: a.targetY });
      if (before > B.telegraph) this.aimVanishLive(f);
      if (a.vanishT <= 0) {
        a.vanishT = 0;
        f.x = a.targetX;
        f.y = a.targetY;
        f.vx = 0;
        f.vy = 0;
        f.grounded = false;
        f.support = -1;
        f.coyote = 0;
        a.lockDodge = B.lockDodge;
        f.stats.abilitySuccess++;
        this.w.emit({ t: 'ability', id: f.id, a: 'reappear', x: f.x, y: f.y });
      }
    }
    // Judoka
    if (a.freezeT > 0) {
      a.freezeT -= dt;
      if (a.freezeT <= 0) {
        a.freezeT = 0;
        this.throwNow(f);
      }
    } else if (a.stanceT > 0) {
      a.stanceT -= dt;
      if (a.stanceT <= 0) {
        a.stanceT = 0;
        a.whiffT = J.whiff;
        f.stats.abilityFail++;
        this.w.emit({ t: 'ability', id: f.id, a: 'counter_whiff' });
      }
    } else if (a.whiffT > 0) a.whiffT = Math.max(0, a.whiffT - dt);
    // Dottore
    if (a.weightT > 0) {
      a.weightT -= dt;
      if (a.weightT <= 0) {
        a.weightT = 0;
        this.w.emit({ t: 'ability', id: f.id, a: 'weight_off' });
      }
    }
    // Ciro
    if (a.windowT > 0) {
      a.windowT -= dt;
      if (a.windowT <= 0) {
        a.windowT = 0;
        this.w.emit({ t: 'ability', id: f.id, a: 'bonifico_declined' });
        this.w.knockOut(f, a.pendingHow);
        return;
      }
    }
    if (a.pendingT > 0) {
      a.pendingT -= dt;
      if (a.pendingT <= 0) {
        a.pendingT = 0;
        f.stats.abilityFail++;
        this.w.emit({ t: 'ability', id: f.id, a: 'bonifico_fail' });
        this.w.knockOut(f, f.y > 0 ? 'top' : Math.abs(f.x) > STAGE.mainX ? 'side' : 'bottom');
      }
    }
  }

  /** Durante la sparizione lo stick puo' ancora cambiare il punto di ritorno (finche' non inizia il segnale). */
  private aimVanishLive(f: Fighter): void {
    const s = f.lastStick;
    if (Math.hypot(s.x, s.y) < 0.3) return;
    // il punto di partenza e' dove e' sparito
    const ox = f.x;
    const oy = f.y;
    const len = Math.hypot(s.x, s.y);
    let tx = clamp(ox + (s.x / len) * B.dist, KO.minX + 3, KO.maxX - 3);
    let ty = clamp(oy + (s.y / len) * B.dist, KO.minY + 3, KO.maxY - 3);
    if (ty < 0 && Math.abs(tx) < STAGE.mainX + PHYS.halfW + 0.05) {
      if (Math.abs(tx) <= STAGE.mainX + 0.35 && oy >= -0.05) ty = 0;
      else tx = (tx >= 0 ? 1 : -1) * (STAGE.mainX + PHYS.halfW + 0.1);
    }
    f.ab.targetX = tx;
    f.ab.targetY = ty;
  }

  // ------------------------------------------------------------------ Judoka: la proiezione

  private throwNow(j: Fighter): void {
    const a = j.ab;
    const victim = a.throwVictim ? this.w.byId.get(a.throwVictim) : undefined;
    a.throwVictim = null;
    j.frozenT = 0;
    j.intang = Math.max(j.intang, 0.3);
    if (!victim || !victim.inGame || victim.dead) return;
    victim.frozenT = 0;
    const s = j.lastStick;
    // lo stick sceglie: sinistra, destra o giu'. Senza stick (o in alto) la proiezione va da dove arrivava il colpo.
    let dirX = Math.sign(victim.x - j.x) || j.facing;
    let angle = 38;
    if (s.y < -0.55) {
      angle = -78;
    } else if (Math.abs(s.x) > 0.3) {
      dirX = s.x > 0 ? 1 : -1;
    }
    this.w.launch(victim, a.throwSpeed, angle, dirX, j, 'counter', J.throwDmg);
    j.facing = dirX > 0 ? 1 : -1;
  }

  // ------------------------------------------------------------------ agganci col simulatore

  /** Il bersaglio sta per subire un colpo: true = il colpo si annulla (contrattacco). */
  interceptHit(attacker: Fighter, victim: Fighter, _move: MoveDef, incoming: number): boolean {
    const a = victim.ab;
    if (!this.enabled || victim.characterId !== 'judoka' || a.stanceT <= 0) return false;
    a.stanceT = 0;
    a.freezeT = J.freeze;
    a.throwVictim = attacker.id;
    a.throwSpeed = Math.min(J.throwCap, J.throwBase + incoming * J.throwScale);
    victim.frozenT = J.freeze + 0.02;
    victim.intang = Math.max(victim.intang, J.freeze + 0.4);
    this.w.interrupt(attacker);
    attacker.frozenT = J.freeze + 0.02;
    attacker.vx = 0;
    attacker.vy = 0;
    victim.stats.abilitySuccess++;
    bump(victim, IMPACT_KEYS.counterOk);
    this.w.emit({ t: 'ability', id: victim.id, a: 'counter_hit', x: attacker.x, y: attacker.y, extra: a.throwSpeed });
    return true;
  }

  /** L'attacco ha mancato un bersaglio sparito. */
  onEscape(v: Fighter): void {
    bump(v, IMPACT_KEYS.vanishEscapes);
  }

  /** Il giocatore sta per uscire dai limiti: true = la finestra del bonifico lo trattiene. */
  interceptKo(f: Fighter, how: 'side' | 'top' | 'bottom'): boolean {
    if (!this.enabled || f.characterId !== 'ciro') return false;
    const a = f.ab;
    if (a.charges <= 0 || a.windowSpent || a.windowT > 0 || a.pendingT > 0) return false;
    a.windowT = C.window;
    a.windowSpent = true;
    a.pendingHow = how;
    f.x = clamp(f.x, KO.minX + 0.4, KO.maxX - 0.4);
    f.y = clamp(f.y, KO.minY + 0.4, KO.maxY - 0.4);
    f.vx = 0;
    f.vy = 0;
    bump(f, IMPACT_KEYS.bonificoOpened);
    this.w.emit({ t: 'ability', id: f.id, a: 'bonifico_open', x: f.x, y: f.y });
    return true;
  }

  /** Atterraggio o parete: rimonta del Goblin e pagamento del debito di Ciro. */
  onTouchStage(f: Fighter): void {
    const a = f.ab;
    if (a.returnT > 0) {
      a.returnT = 0;
      a.followT = G.followWindow;
      f.stats.abilitySuccess++;
      bump(f, IMPACT_KEYS.goblinSaves);
      this.w.emit({ t: 'ability', id: f.id, a: 'goblin_return' });
    }
    if (a.pendingT > 0 && (f.grounded || f.wallSide !== 0)) {
      a.pendingT = 0;
      f.percent += C.debt;
      f.stats.dmgTaken += C.debt;
      f.stats.abilitySuccess++;
      bump(f, IMPACT_KEYS.bonificoSaves);
      this.w.emit({ t: 'ability', id: f.id, a: 'bonifico_paid', extra: C.debt });
    }
  }

  /** Rientrato dopo essere stato fuori dal palco. */
  onRecovered(f: Fighter): void {
    if (f.ab.weightT > 0) {
      bump(f, IMPACT_KEYS.weightRecoveries);
      f.stats.abilitySuccess++;
    }
  }

  /** Colpito (o afferrato): cio' che era in corso si interrompe. */
  onInterrupted(f: Fighter): void {
    if (f.ab.burstT > 0) f.ab.burstT = 0;
  }

  /** Vita persa: nessuno stato dell'abilita' sopravvive. */
  onKo(f: Fighter): void {
    const s = f.ab;
    s.burstT = s.returnT = s.followT = s.vanishT = s.stanceT = s.whiffT = s.freezeT = s.windowT = s.pendingT = 0;
    s.throwVictim = null;
  }

  // ------------------------------------------------------------------ modificatori continui (Dottore)

  private light(f: Fighter): boolean {
    return this.enabled && f.ab.weightT > 0;
  }
  kbMult(f: Fighter): number {
    return this.light(f) ? D.knock : 1;
  }
  gravityMult(f: Fighter): number {
    return this.light(f) ? D.gravity : 1;
  }
  airAccelMult(f: Fighter): number {
    return this.light(f) ? D.airAccel : 1;
  }
  airSpeedMult(f: Fighter): number {
    return this.light(f) ? D.airSpeed : 1;
  }
  jumpMult(f: Fighter): number {
    return this.light(f) ? D.jump : 1;
  }

  /** Il personaggio e' bloccato da un'abilita' (postura, scoperto dopo un counter a vuoto, presa). */
  locks(f: Fighter): boolean {
    return f.ab.stanceT > 0 || f.ab.whiffT > 0 || f.ab.freezeT > 0;
  }

  /** Goblin: dopo la rimonta il prossimo attacco AEREO e' quello speciale. */
  followMoveFor(f: Fighter, air: boolean): MoveDef | null {
    if (!this.enabled || f.characterId !== 'goblin' || f.ab.followT <= 0 || !air) return null;
    f.ab.followT = 0;
    f.stats.abilitySuccess++;
    bump(f, IMPACT_KEYS.goblinFollow);
    this.w.emit({ t: 'ability', id: f.id, a: 'goblin_follow' });
    return followMove(G.followDmg);
  }

  // ------------------------------------------------------------------ stato per HUD e telefono

  status(f: Fighter): AbilityStatus {
    const a = f.ab;
    const s1 = (n: number): string => n.toFixed(1).replace('.', ',');
    if (!f.inGame) return { state: 'SPENT', note: 'ELIMINATO' };
    if (f.dead) return { state: 'COOLDOWN', remaining: Math.max(0, f.respawnT), note: 'RESPAWN' };
    if (!this.enabled) return { state: 'SPENT', note: 'ABILITÀ OFF' };
    switch (f.characterId) {
      case 'goblin':
        if (a.burstT > 0) return { state: 'ACTIVE', note: 'RIMONTA!' };
        if (a.returnT > 0) return { state: 'ACTIVE', remaining: a.returnT, note: `RIENTRA! ${s1(a.returnT)} s` };
        if (a.followT > 0) return { state: 'ACTIVE', remaining: a.followT, note: `SPECIALE ${s1(a.followT)} s` };
        return a.charges > 0 ? { state: 'READY', note: f.grounded || !this.w.offstage(f) ? 'PRONTA' : 'PRONTA · RB ORA' } : { state: 'SPENT' };
      case 'buttafuori':
        if (a.vanishT > 0) return { state: 'ACTIVE', remaining: a.vanishT, note: `ASSENTE ${s1(a.vanishT)} s` };
        return a.charges > 0 ? { state: 'READY' } : { state: 'SPENT' };
      case 'judoka':
        if (a.stanceT > 0 || a.freezeT > 0) return { state: 'ACTIVE', remaining: a.stanceT, note: 'POSTURA!' };
        if (a.whiffT > 0) return { state: 'COOLDOWN', remaining: a.whiffT, note: 'SCOPERTO' };
        return a.charges > 0 ? { state: 'READY', charges: a.charges, note: `PRONTA ${a.charges}/${AB.cornicione.judoka.charges}` } : { state: 'SPENT' };
      case 'dottore':
        if (a.weightT > 0) return { state: 'ACTIVE', remaining: a.weightT };
        return a.charges > 0 ? { state: 'READY' } : { state: 'SPENT' };
      case 'ciro':
        if (a.windowT > 0) return { state: 'ACTIVE', remaining: a.windowT, note: 'BONIFICO? RB' };
        if (a.pendingT > 0) return { state: 'ACTIVE', remaining: a.pendingT, note: `DEBITO ${s1(a.pendingT)}s` };
        return a.charges > 0 ? { state: 'READY' } : { state: 'SPENT' };
    }
    return { state: 'SPENT' };
  }
}
