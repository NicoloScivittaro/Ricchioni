import { PHYS, DODGE, WALL, RECOVERY, DMG, KO, MATCH, STAGE, STICK, spawnPoints, pickMove } from './fighterData';
import type { MoveDef, MoveDir } from './fighterData';
import { NO_INPUT, freshAbilityState } from './fighterTypes';
import type { Fighter, FighterEvent, FighterInput, FighterStats, MatchPhase } from './fighterTypes';
import { FighterAbilities } from './fighterAbilities';

/**
 * BOTTE SUL CORNICIONE — SIMULATORE (puro: niente Babylon, niente DOM). Qui sta TUTTO il gameplay: movimento, salti, schivata,
 * attacchi, danno percentuale, lancio, stordimento, parete, KO, respawn, fine partita. Il gioco 3D (BabylonCornicioneGame) legge lo
 * stato e gli eventi e disegna; i test e i bot (scripts/fighter-*.ts) usano questa stessa classe senza browser.
 *
 * Passo fisso interno: step(dt) si spezza in sotto-passi da <= SUB secondi, quindi il comportamento NON dipende dagli FPS.
 */

export interface WorldOptions {
  ids: string[];
  characters: string[];
  rng: () => number;
  /** false = le abilita' non fanno nulla (simulazioni ON/OFF) */
  abilities?: boolean;
  timeLimit?: number;
}

const SUB = 1 / 90;
const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
const approach = (v: number, target: number, maxDelta: number): number => (v < target ? Math.min(target, v + maxDelta) : Math.max(target, v - maxDelta));
const dead = (v: number): number => (Math.abs(v) < STICK.dead ? 0 : v);

function freshStats(): FighterStats {
  return { kos: 0, deaths: 0, dmgDealt: 0, dmgTaken: 0, deathPercents: [], recoveryAttempts: 0, recoveriesOk: 0, edgeKos: 0, maxCombo: 0, abilityUses: 0, abilitySuccess: 0, abilityFail: 0, impact: {} };
}

export class FighterWorld {
  readonly fighters: Fighter[] = [];
  readonly byId = new Map<string, Fighter>();
  readonly abil: FighterAbilities;
  events: FighterEvent[] = [];
  time = 0;
  phase: MatchPhase = 'fight';
  readonly timeLimit: number;
  suddenT = 0;
  endReason: 'lastStanding' | 'timeout' | 'suddenDeath' | null = null;
  /** ordine di eliminazione (primo = primo eliminato) */
  eliminationOrder: string[] = [];
  private suddenGroup: string[] = [];
  private suddenRest: string[] = [];
  private rng: () => number;

  constructor(opts: WorldOptions) {
    this.rng = opts.rng;
    this.timeLimit = opts.timeLimit ?? MATCH.timeLimit;
    this.abil = new FighterAbilities(this, opts.abilities !== false);
    const n = opts.ids.length;
    const spawn = spawnPoints(n);
    opts.ids.forEach((id, i) => {
      const f: Fighter = {
        id,
        index: i,
        characterId: opts.characters[i],
        x: spawn[i].x,
        y: spawn[i].y,
        vx: 0,
        vy: 0,
        facing: spawn[i].x > 0 ? -1 : spawn[i].x < 0 ? 1 : i % 2 === 0 ? 1 : -1,
        percent: 0,
        lives: KO.lives,
        inGame: true,
        dead: false,
        respawnT: 0,
        eliminatedAt: -1,
        grounded: true,
        support: spawn[i].y > 0 ? (spawn[i].y > 5 ? 3 : spawn[i].x < 0 ? 1 : 2) : 0,
        coyote: 0,
        jumps: PHYS.jumps,
        jumpRising: false,
        fastFall: false,
        dropT: 0,
        dropHold: 0,
        jumpBuf: 0,
        lightBuf: 0,
        heavyBuf: 0,
        dodgeBuf: 0,
        attack: null,
        dodge: null,
        dodgeCd: 0,
        airDodgeUsed: false,
        landLag: 0,
        recoveryUsed: false,
        wallCharges: WALL.charges,
        wallSide: 0,
        clingT: 0,
        hitstun: 0,
        hitstunTotal: 0,
        hitFlash: 0,
        invuln: 0,
        intang: 0,
        hover: 0,
        comboCount: 0,
        comboT: 0,
        comboBreak: false,
        lastHitBy: null,
        lastHitAt: -99,
        lastHitVia: '',
        frozenT: 0,
        tieBreak: this.rng(),
        recentHits: [],
        lastStick: { x: 0, y: 0 },
        recovering: false,
        offstageSince: -1,
        ab: freshAbilityState(),
        stats: freshStats()
      };
      this.fighters.push(f);
      this.byId.set(id, f);
      this.abil.newLife(f);
    });
  }

  // ------------------------------------------------------------------ utilita'

  emit(e: FighterEvent): void {
    this.events.push(e);
  }

  drainEvents(): FighterEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  /** Fuori dal palco: in aria e oltre il bordo della palazzina o sotto il piano. */
  offstage(f: Fighter): boolean {
    return !f.grounded && (Math.abs(f.x) > STAGE.mainX + 0.2 || f.y < -0.3);
  }

  livingCount(): number {
    return this.fighters.filter((f) => f.inGame).length;
  }

  /** Il bersaglio e' colpibile ora? */
  hittable(f: Fighter): boolean {
    return f.inGame && !f.dead && f.invuln <= 0 && f.intang <= 0 && f.ab.vanishT <= 0 && f.ab.windowT <= 0 && f.frozenT <= 0;
  }

  // ------------------------------------------------------------------ passo

  step(dt: number, inputs: Record<string, FighterInput> | Map<string, FighterInput>): void {
    if (this.phase === 'over') return;
    const get = (id: string): FighterInput => (inputs instanceof Map ? inputs.get(id) : inputs[id]) ?? NO_INPUT;
    const n = Math.max(1, Math.ceil(dt / SUB - 1e-9));
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      this.sub(h, get, i === 0);
      if ((this.phase as MatchPhase) === 'over') return;
    }
  }

  private sub(dt: number, get: (id: string) => FighterInput, first: boolean): void {
    this.time += dt;
    for (const f of this.fighters) {
      const raw = get(f.id);
      const inp: FighterInput = first ? raw : { ...raw, jumpPressed: false, lightPressed: false, heavyPressed: false, dodgePressed: false, abilityPressed: false };
      this.stepFighter(f, inp, dt);
    }
    this.resolveHits();
    this.checkEnd(dt);
  }

  // ------------------------------------------------------------------ un personaggio

  private stepFighter(f: Fighter, inp: FighterInput, dt: number): void {
    if (!f.inGame) return;
    if (f.dead) {
      f.respawnT -= dt;
      if (f.respawnT <= 0 && f.lives > 0) this.respawn(f);
      return;
    }
    // timer comuni
    f.jumpBuf = Math.max(0, f.jumpBuf - dt);
    f.lightBuf = Math.max(0, f.lightBuf - dt);
    f.heavyBuf = Math.max(0, f.heavyBuf - dt);
    f.dodgeBuf = Math.max(0, f.dodgeBuf - dt);
    f.invuln = Math.max(0, f.invuln - dt);
    f.intang = Math.max(0, f.intang - dt);
    f.dodgeCd = Math.max(0, f.dodgeCd - dt);
    f.hitFlash = Math.max(0, f.hitFlash - dt);
    f.dropT = Math.max(0, f.dropT - dt);
    f.comboT = Math.max(0, f.comboT - dt);
    if (f.comboT <= 0 && f.hitstun <= 0) f.comboCount = 0;
    if (f.coyote > 0) {
      f.coyote -= dt;
      if (f.coyote <= 0) f.jumps = Math.min(f.jumps, PHYS.jumps - 1);
    }

    const sx = dead(inp.mx);
    const sy = dead(inp.my);
    f.lastStick.x = sx;
    f.lastStick.y = sy;
    if (inp.jumpPressed) f.jumpBuf = PHYS.buffer;
    if (inp.lightPressed) f.lightBuf = PHYS.buffer;
    if (inp.heavyPressed) f.heavyBuf = PHYS.buffer;
    if (inp.dodgePressed) f.dodgeBuf = PHYS.buffer;

    // abilita': timer, finestre, pressione
    if (inp.abilityPressed) this.emit({ t: 'abilityPress', id: f.id, res: this.abil.press(f, sx, sy) });
    this.abil.update(f, dt);
    if (!f.inGame || f.dead) return;

    // fermi del tutto: scomparso (Buttafuori), presa (Judoka), finestra del bonifico (Ciro)
    if (f.ab.vanishT > 0 || f.ab.windowT > 0) return;
    if (f.frozenT > 0) {
      f.frozenT -= dt;
      return;
    }

    const prevX = f.x;
    const prevY = f.y;
    if (f.hitstun > 0) {
      f.hitstun -= dt;
      this.physicsStun(f, sx, sy, dt);
      if (f.hitstun <= 0) {
        f.hitstun = 0;
        if (f.comboBreak) {
          f.intang = Math.max(f.intang, DMG.comboBreakIntangible);
          f.comboBreak = false;
        }
      }
    } else {
      this.actions(f, inp, sx, sy, dt);
      this.physicsFree(f, inp, sx, sy, dt);
    }
    this.collide(f, prevX, prevY, sx);
    this.checkKo(f);
  }

  // ------------------------------------------------------------------ azioni

  private actions(f: Fighter, inp: FighterInput, sx: number, sy: number, dt: number): void {
    const locked = this.abil.locks(f);
    if (f.attack) this.progressAttack(f, dt, sx);
    if (f.dodge) this.progressDodge(f, dt);
    if (f.landLag > 0) f.landLag = Math.max(0, f.landLag - dt);
    if (f.hover > 0) {
      f.hover -= dt;
      if (f.jumpBuf > 0 || f.lightBuf > 0 || f.heavyBuf > 0 || f.dodgeBuf > 0) f.hover = 0;
    }
    const free = !f.attack && !f.dodge && f.landLag <= 0 && !locked;
    if (free && Math.abs(sx) > 0.3) f.facing = sx > 0 ? 1 : -1;

    // discesa dalla piattaforma: ↓ tenuto
    if (f.grounded && f.support > 0 && sy < -STICK.drop && free) {
      f.dropHold += dt;
      if (f.dropHold >= 0.16) {
        f.dropT = 0.3;
        f.grounded = false;
        f.support = -1;
        f.coyote = 0;
        f.y -= 0.04;
        f.dropHold = 0;
      }
    } else f.dropHold = 0;

    if (!free) return;
    if (f.jumpBuf > 0 && this.tryJump(f, sx)) f.jumpBuf = 0;
    if (f.dodgeBuf > 0 && f.ab.lockDodge <= 0 && this.tryDodge(f, sx, sy)) f.dodgeBuf = 0;
    else if (f.heavyBuf > 0 && this.tryAttack(f, 'heavy', sx, sy)) f.heavyBuf = 0;
    else if (f.lightBuf > 0 && this.tryAttack(f, 'light', sx, sy)) f.lightBuf = 0;
  }

  private tryJump(f: Fighter, sx: number): boolean {
    const jm = this.abil.jumpMult(f);
    // salto dalla parete
    if (f.wallSide !== 0 && !f.grounded) {
      const away = -f.wallSide;
      f.vy = WALL.jumpV * jm;
      f.vx = away * WALL.jumpAway;
      f.facing = away as 1 | -1;
      f.wallSide = 0;
      f.clingT = 0;
      f.jumpRising = false;
      this.emit({ t: 'wallJump', id: f.id });
      return true;
    }
    if (f.grounded || f.coyote > 0) {
      f.vy = PHYS.jumpV * jm;
      f.grounded = false;
      f.support = -1;
      f.coyote = 0;
      f.jumps = PHYS.jumps - 1;
      f.jumpRising = true;
      f.fastFall = false;
      this.emit({ t: 'jump', id: f.id, double: false });
      return true;
    }
    if (f.jumps > 0) {
      f.jumps--;
      f.vy = PHYS.doubleJumpV * jm;
      f.vx = Math.abs(sx) > 0.3 ? sx * PHYS.airSpeed * 0.9 * this.abil.airSpeedMult(f) : f.vx * 0.6;
      f.jumpRising = false;
      f.fastFall = false;
      this.markRecovering(f);
      this.emit({ t: 'jump', id: f.id, double: true });
      return true;
    }
    return false;
  }

  private tryDodge(f: Fighter, sx: number, sy: number): boolean {
    if (f.dodgeCd > 0) return false;
    if (f.grounded) {
      f.dodge = { air: false, t: 0, dx: Math.abs(sx) > 0.3 ? Math.sign(sx) : 0, dy: 0 };
      f.intang = Math.max(f.intang, DODGE.ground.intangible);
      f.dodgeCd = DODGE.ground.cooldown;
      this.emit({ t: 'dodge', id: f.id, air: false });
      return true;
    }
    if (f.airDodgeUsed) return false;
    const len = Math.hypot(sx, sy);
    f.dodge = { air: true, t: 0, dx: len > 0.3 ? sx / len : 0, dy: len > 0.3 ? sy / len : 0 };
    f.intang = Math.max(f.intang, DODGE.air.intangible);
    f.dodgeCd = DODGE.air.cooldown;
    f.airDodgeUsed = true;
    f.fastFall = false;
    this.markRecovering(f);
    this.emit({ t: 'dodge', id: f.id, air: true });
    return true;
  }

  private progressDodge(f: Fighter, dt: number): void {
    const d = f.dodge!;
    d.t += dt;
    if (d.air) {
      f.vx = d.dx * DODGE.air.speed;
      f.vy = d.dy * DODGE.air.speed;
      if (d.t >= DODGE.air.time) {
        f.vx *= 0.4;
        f.vy *= 0.4;
        f.dodge = null;
      }
    } else {
      const k = d.t < DODGE.ground.time * 0.6 ? 1 : 0.4;
      f.vx = d.dx * DODGE.ground.speed * k;
      if (d.t >= DODGE.ground.time) {
        f.dodge = null;
        f.landLag = Math.max(f.landLag, DODGE.ground.end);
      }
    }
  }

  private dirOf(sx: number, sy: number): MoveDir {
    const ax = Math.abs(sx);
    const ay = Math.abs(sy);
    if (sy > STICK.dir && ay >= ax * 0.8) return 'u';
    if (sy < -STICK.dir && ay >= ax * 0.8) return 'd';
    if (ax > STICK.side) return 's';
    return 'n';
  }

  private tryAttack(f: Fighter, kind: 'light' | 'heavy', sx: number, sy: number): boolean {
    const air = !f.grounded;
    const dir = this.dirOf(sx, sy);
    if (dir === 's') f.facing = sx > 0 ? 1 : -1;
    let move: MoveDef = pickMove(air, kind, dir);
    const special = this.abil.followMoveFor(f, air);
    if (special) move = special;
    if (move.kind === 'recovery') {
      if (f.recoveryUsed) {
        this.emit({ t: 'noRecovery', id: f.id });
        return true;
      }
      f.recoveryUsed = true;
      f.stats.recoveryAttempts++;
      this.markRecovering(f);
    }
    f.attack = { move, t: 0, hit: new Set(), phase: 0 };
    f.dropHold = 0;
    if (f.invuln > 0) f.invuln = 0;
    f.hover = 0;
    if (move.lunge && f.grounded) f.vx = f.facing * move.lunge;
    this.emit({ t: 'attack', id: f.id, move, phase: 'start' });
    return true;
  }

  private progressAttack(f: Fighter, dt: number, sx: number): void {
    const a = f.attack!;
    const m = a.move;
    a.t += dt;
    if (a.phase === 0 && a.t >= m.startup) {
      a.phase = 1;
      if (m.kind === 'recovery') {
        f.vy = RECOVERY.boost * this.abil.jumpMult(f);
        f.vx += sx * 3;
        f.jumpRising = false;
        f.fastFall = false;
        this.emit({ t: 'recoveryAttack', id: f.id });
      }
      if (m.lunge && !f.grounded && m.kind === 'follow') f.vx = f.facing * 9;
      this.emit({ t: 'attack', id: f.id, move: m, phase: 'active' });
    }
    if (a.phase === 1 && a.t >= m.startup + m.active) a.phase = 2;
    if (a.t >= m.startup + m.active + m.recovery) f.attack = null;
  }

  private markRecovering(f: Fighter): void {
    if (this.offstage(f)) f.recovering = true;
  }

  // ------------------------------------------------------------------ fisica

  private physicsFree(f: Fighter, inp: FighterInput, sx: number, sy: number, dt: number): void {
    const locked = this.abil.locks(f);
    if (f.hover > 0) {
      f.vy = 0;
      f.vx = approach(f.vx, sx * 5, 40 * dt);
      f.x += f.vx * dt;
      return;
    }
    if (f.ab.burstT > 0) {
      // scatto del Goblin: nessuna gravita', velocita' mantenuta
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      return;
    }
    if (f.dodge && f.dodge.air) {
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      return;
    }
    const canSteer = !locked && f.landLag <= 0 && !f.dodge;
    if (f.grounded) {
      if (canSteer && !f.attack) f.vx = approach(f.vx, sx * PHYS.runSpeed, PHYS.groundAccel * dt);
      else if (!f.dodge) f.vx = approach(f.vx, 0, PHYS.groundFriction * dt);
      f.vy = 0;
    } else {
      const k = f.attack ? 0.55 : 1;
      const cap = PHYS.airSpeed * this.abil.airSpeedMult(f);
      if ((canSteer || f.attack) && !locked) {
        const target = sx * cap * k;
        if (Math.abs(f.vx) > cap + 0.01 && Math.sign(f.vx) === Math.sign(sx || f.vx)) f.vx *= Math.exp(-PHYS.airDrag * dt);
        else f.vx = approach(f.vx, target, PHYS.airAccel * this.abil.airAccelMult(f) * k * dt);
      } else if (Math.abs(f.vx) > cap) f.vx *= Math.exp(-PHYS.airDrag * dt);
      f.vy -= PHYS.gravity * this.abil.gravityMult(f) * dt;
      if (f.wallSide !== 0) {
        f.vx = 0;
        f.vy = Math.max(f.vy, -WALL.slideSpeed);
        f.clingT -= dt;
        const towards = sx * f.wallSide > 0.3;
        if (f.clingT <= 0 || !towards) {
          f.wallSide = 0;
        }
      } else if (!f.attack && !f.dodge && sy < -STICK.fastFall && f.vy <= 1) {
        f.fastFall = true;
      }
      if (f.fastFall && !f.attack) f.vy = Math.min(f.vy, -PHYS.fastFall);
      else if (f.vy < -PHYS.maxFall) f.vy = -PHYS.maxFall;
      // salto corto: tasto rilasciato mentre sale
      if (f.jumpRising && !inp.jumpHeld && f.vy > 8) {
        f.vy *= PHYS.shortHopCut;
        f.jumpRising = false;
      }
      if (f.vy <= 0) f.jumpRising = false;
    }
    f.x += f.vx * dt;
    f.y += f.vy * dt;
  }

  private physicsStun(f: Fighter, sx: number, sy: number, dt: number): void {
    if (f.grounded) {
      f.vx = approach(f.vx, 0, PHYS.groundFriction * 0.5 * dt);
      f.vy = 0;
    } else {
      const drag = Math.exp(-DMG.launchDrag * dt);
      f.vx *= drag;
      f.vy *= drag;
      f.vy -= PHYS.gravity * DMG.launchGravity * dt;
      // DI: una piccola spinta dello stick, mai abbastanza da annullare il lancio
      f.vx += sx * DMG.diDuring * dt;
      f.vy += sy * DMG.diDuring * 0.5 * dt;
    }
    f.x += f.vx * dt;
    f.y += f.vy * dt;
  }

  // ------------------------------------------------------------------ collisioni col palco

  private land(f: Fighter, y: number, support: number, impactVy: number): void {
    f.y = y;
    f.vy = 0;
    f.grounded = true;
    f.support = support;
    f.jumps = PHYS.jumps;
    f.airDodgeUsed = false;
    f.wallCharges = WALL.charges;
    f.recoveryUsed = false;
    f.fastFall = false;
    f.coyote = 0;
    f.wallSide = 0;
    f.jumpRising = false;
    f.dropHold = 0;
    if (f.dodge?.air) f.dodge = null;
    if (f.attack?.move.air) {
      f.landLag = Math.max(f.landLag, f.attack.move.landLag ?? 0.1);
      f.attack = null;
    }
    this.emit({ t: 'land', id: f.id, hard: impactVy < -14 });
    this.afterTouch(f);
  }

  /** Dopo un contatto con il palco (atterraggio o parete): chiude il "recupero" e avvisa le abilita'. */
  private afterTouch(f: Fighter): void {
    this.abil.onTouchStage(f);
    if (f.recovering && f.hitstun <= 0 && f.grounded) {
      f.recovering = false;
      f.stats.recoveriesOk++;
      this.abil.onRecovered(f);
      this.emit({ t: 'recovered', id: f.id });
    }
  }

  private collide(f: Fighter, prevX: number, prevY: number, sx: number): void {
    const hw = PHYS.halfW;
    const X = STAGE.mainX;
    const wasGrounded = f.grounded;

    if (f.grounded) {
      // ancora sul sostegno?
      if (f.support === 0) {
        if (Math.abs(f.x) > X + 0.35) this.leaveGround(f);
      } else {
        const p = STAGE.platforms.find((q) => q.id === f.support);
        if (!p || f.x + hw * 0.6 <= p.x0 || f.x - hw * 0.6 >= p.x1) this.leaveGround(f);
      }
      if (f.grounded && f.hitstun > 0 && f.vy > 0) this.leaveGround(f, false);
    }

    if (!f.grounded) {
      let landed = false;
      const impactVy = f.vy;
      if (f.vy <= 0) {
        if (prevY >= -0.02 && f.y <= 0 && Math.abs(f.x) <= X + 0.35) {
          landed = this.touchDown(f, 0, 0, impactVy);
        }
        if (!landed && f.dropT <= 0) {
          for (const p of STAGE.platforms) {
            if (prevY >= p.y - 0.02 && f.y <= p.y && f.x + hw * 0.6 > p.x0 && f.x - hw * 0.6 < p.x1) {
              landed = this.touchDown(f, p.y, p.id, impactVy);
              break;
            }
          }
        }
      }
      // pareti della palazzina
      if (!landed && f.y < -0.001 && Math.abs(f.x) < X + hw) {
        const side = Math.abs(prevX) >= X + hw - 1e-6 ? Math.sign(prevX) : f.x >= 0 ? 1 : -1;
        const hitV = f.vx * side < -6 && f.hitstun > 0;
        f.x = side * (X + hw);
        if (f.vx * side < 0) f.vx = hitV ? -f.vx * 0.45 : 0;
        if (hitV) this.emit({ t: 'bounce', id: f.id });
        // attacco alla parete (recovery): serve tenere lo stick verso la parete, cadere o salire piano
        if (f.hitstun <= 0 && f.wallSide === 0 && f.wallCharges > 0 && sx * -side > 0.3 && f.vy <= 3 && !f.dodge && !f.attack && f.ab.burstT <= 0) {
          f.wallSide = (-side) as -1 | 1;
          f.wallCharges--;
          f.clingT = WALL.clingTime;
          f.recoveryUsed = false;
          f.vx = 0;
          f.vy = Math.max(f.vy, -WALL.slideSpeed);
          f.fastFall = false;
          this.markRecovering(f);
          this.emit({ t: 'wall', id: f.id, side: side as -1 | 1 });
          this.abil.onTouchStage(f);
        }
      } else if (f.wallSide !== 0 && !(f.y < -0.001 && Math.abs(Math.abs(f.x) - (X + hw)) < WALL.reach + 0.05)) {
        f.wallSide = 0; // lascia la parete (salito sopra, spinto via)
      }
    }
    void wasGrounded;
  }

  private leaveGround(f: Fighter, coyote = true): void {
    f.grounded = false;
    f.support = -1;
    if (coyote && f.hitstun <= 0 && !f.jumpRising) f.coyote = PHYS.coyote;
    else f.jumps = Math.min(f.jumps, PHYS.jumps - 1);
  }

  /** true = atterrato; false = rimbalzo (colpito con forza verso il basso). */
  private touchDown(f: Fighter, y: number, support: number, impactVy: number): boolean {
    if (f.hitstun > 0 && impactVy < -8) {
      f.y = y;
      f.vy = -impactVy * DMG.bounce;
      f.vx *= 0.8;
      f.grounded = false;
      this.emit({ t: 'bounce', id: f.id });
      return true;
    }
    this.land(f, y, support, impactVy);
    return true;
  }

  // ------------------------------------------------------------------ colpi

  private resolveHits(): void {
    for (const a of this.fighters) {
      if (!a.inGame || a.dead || !a.attack || a.attack.phase !== 1) continue;
      const m = a.attack.move;
      for (const v of this.fighters) {
        if (v === a || !v.inGame || v.dead || a.attack.hit.has(v.id)) continue;
        if (!this.overlaps(a, m, v)) continue;
        if (v.ab.vanishT > 0) {
          a.attack.hit.add(v.id);
          this.abil.onEscape(v);
          continue;
        }
        if (!this.hittable(v)) continue;
        a.attack.hit.add(v.id);
        this.applyHit(a, v, m);
        if (!a.attack) break;
      }
    }
  }

  private overlaps(a: Fighter, m: MoveDef, v: Fighter): boolean {
    const hw = PHYS.halfW;
    const test = (dir: 1 | -1): boolean => {
      const cx = a.x + dir * m.hit.x;
      const cy = a.y + m.hit.y;
      return Math.abs(cx - v.x) < m.hit.w / 2 + hw && cy + m.hit.h / 2 > v.y && cy - m.hit.h / 2 < v.y + PHYS.height;
    };
    if (m.twoSided) return test(1) || test(-1);
    return test(a.facing);
  }

  /** Velocita' di lancio del colpo su questo bersaglio (a percentuale GIA' aggiornata). */
  launchSpeed(m: MoveDef, percentAfter: number, victim: Fighter): number {
    return (m.bkb + m.kbs * percentAfter) * this.abil.kbMult(victim);
  }

  private staleMul(a: Fighter, v: Fighter, m: MoveDef): number {
    const n = v.recentHits.filter((h) => h.attacker === a.id && h.move === m.id).length;
    return Math.max(DMG.staleMin, 1 - DMG.staleStep * n);
  }

  private applyHit(a: Fighter, v: Fighter, m: MoveDef): void {
    const stale = this.staleMul(a, v, m);
    const dmg = m.dmg * stale;
    // contrattacco / altre intercettazioni (il colpo si annulla)
    const incoming = this.launchSpeed(m, v.percent + dmg, v);
    if (this.abil.interceptHit(a, v, m, incoming)) return;

    v.percent += dmg;
    a.stats.dmgDealt += dmg;
    v.stats.dmgTaken += dmg;
    const speed = this.launchSpeed(m, v.percent, v);
    const dirX = m.twoSided ? (v.x === a.x ? a.facing : Math.sign(v.x - a.x)) : a.facing;
    const ang = (m.angle * Math.PI) / 180;
    let lx = Math.cos(ang) * dirX * speed;
    let ly = Math.sin(ang) * speed;
    if (v.grounded) {
      if (ly < 0) ly = Math.abs(ly) * 0.4;
      ly = Math.max(ly, 3);
    }
    // DI: la componente PERPENDICOLARE alla direzione di lancio, mai quella parallela
    const len = Math.hypot(lx, ly) || 1;
    const ux = lx / len;
    const uy = ly / len;
    const dot = v.lastStick.x * ux + v.lastStick.y * uy;
    lx += (v.lastStick.x - dot * ux) * speed * DMG.di;
    ly += (v.lastStick.y - dot * uy) * speed * DMG.di;

    // combo: ogni colpo successivo stordisce meno
    if (v.comboT > 0 || v.hitstun > 0) v.comboCount++;
    else v.comboCount = 1;
    const comboScale = Math.max(DMG.comboHitstunFloor, 1 - DMG.comboHitstunDecay * (v.comboCount - 1));
    const stun = clamp((DMG.hitstunBase + speed * DMG.hitstunPerSpeed) * (m.stun ?? 1) * comboScale, DMG.hitstunMin, DMG.hitstunMax);
    if (v.comboCount >= DMG.comboBreakHits) v.comboBreak = true;
    v.comboT = stun + DMG.comboWindow;
    a.stats.maxCombo = Math.max(a.stats.maxCombo, v.comboCount);

    // il bersaglio perde tutto quello che stava facendo
    this.interrupt(v);
    v.vx = lx;
    v.vy = ly;
    if (ly > 0) {
      v.grounded = false;
      v.support = -1;
      v.jumps = Math.min(v.jumps, PHYS.jumps - 1);
      v.coyote = 0;
    }
    v.hitstun = stun;
    v.hitstunTotal = stun;
    v.hitFlash = 0.14;
    v.lastHitBy = a.id;
    v.lastHitAt = this.time;
    v.lastHitVia = '';
    v.recentHits.push({ attacker: a.id, move: m.id });
    if (v.recentHits.length > DMG.staleMemory) v.recentHits.shift();
    this.emit({ t: 'hit', attacker: a.id, victim: v.id, move: m.id, dmg, speed, impact: m.impact, x: v.x, y: v.y + PHYS.height * 0.55, dx: lx / len, dy: ly / len, percent: v.percent, combo: v.comboCount, ko: false });
  }

  /** Cancella le azioni in corso (colpito, afferrato...). */
  interrupt(v: Fighter): void {
    v.attack = null;
    v.dodge = null;
    v.landLag = 0;
    v.wallSide = 0;
    v.fastFall = false;
    v.jumpRising = false;
    v.hover = 0;
    this.abil.onInterrupted(v);
  }

  /** Lancio diretto (usato dalle abilita': lancio del Judoka). */
  launch(v: Fighter, speed: number, angleDeg: number, dirX: number, by: Fighter | null, via: string, dmg: number): void {
    v.percent += dmg;
    if (by) {
      by.stats.dmgDealt += dmg;
      v.lastHitBy = by.id;
      v.lastHitAt = this.time;
    }
    v.stats.dmgTaken += dmg;
    v.lastHitVia = via;
    const ang = (angleDeg * Math.PI) / 180;
    let lx = Math.cos(ang) * dirX * speed;
    let ly = Math.sin(ang) * speed;
    if (v.grounded) {
      if (ly < 0) ly = Math.abs(ly) * 0.5;
      ly = Math.max(ly, 3);
    }
    this.interrupt(v);
    v.vx = lx;
    v.vy = ly;
    if (ly > 0) {
      v.grounded = false;
      v.support = -1;
      v.jumps = Math.min(v.jumps, PHYS.jumps - 1);
    }
    const stun = clamp(DMG.hitstunBase + speed * DMG.hitstunPerSpeed, DMG.hitstunMin, DMG.hitstunMax);
    v.hitstun = stun;
    v.hitstunTotal = stun;
    v.hitFlash = 0.16;
    v.comboCount = 1;
    v.comboT = stun + DMG.comboWindow;
    const len = Math.hypot(lx, ly) || 1;
    this.emit({ t: 'hit', attacker: by?.id ?? null, victim: v.id, move: via, dmg, speed, impact: 'HEAVY', x: v.x, y: v.y + PHYS.height * 0.55, dx: lx / len, dy: ly / len, percent: v.percent, combo: 1, ko: false, via });
  }

  // ------------------------------------------------------------------ KO e respawn

  private checkKo(f: Fighter): void {
    if (!f.inGame || f.dead) return;
    const how = f.x < KO.minX || f.x > KO.maxX ? 'side' : f.y > KO.maxY ? 'top' : f.y < KO.minY ? 'bottom' : null;
    if (!how) return;
    if (this.abil.interceptKo(f, how)) return;
    this.knockOut(f, how);
  }

  knockOut(f: Fighter, how: 'side' | 'top' | 'bottom'): void {
    if (f.dead || !f.inGame) return;
    const creditor = f.lastHitBy && this.time - f.lastHitAt <= KO.creditWindow ? this.byId.get(f.lastHitBy) ?? null : null;
    const by = creditor && creditor.id !== f.id ? creditor : null;
    const edge = !!by && (f.recovering || this.offstage(f));
    f.lives--;
    f.stats.deaths++;
    f.stats.deathPercents.push(Math.round(f.percent));
    if (f.ab.weightT > 0) f.stats.impact.koWhileLight = (f.stats.impact.koWhileLight ?? 0) + 1;
    if (by) {
      by.stats.kos++;
      if (edge) by.stats.edgeKos++;
      if (f.lastHitVia === 'counter') by.stats.impact.counterKos = (by.stats.impact.counterKos ?? 0) + 1;
    }
    const eliminated = f.lives <= 0;
    this.emit({ t: 'ko', victim: f.id, by: by?.id ?? null, how, percent: f.percent, x: clamp(f.x, KO.minX, KO.maxX), y: clamp(f.y, KO.minY, KO.maxY), lives: f.lives, eliminated, edge });
    this.interrupt(f);
    f.dead = true;
    f.respawnT = KO.respawnDelay;
    f.vx = 0;
    f.vy = 0;
    f.hitstun = 0;
    f.frozenT = 0;
    f.comboCount = 0;
    f.recovering = false;
    if (eliminated) {
      f.inGame = false;
      f.eliminatedAt = this.time;
      this.eliminationOrder.push(f.id);
    }
    this.abil.onKo(f);
  }

  private respawn(f: Fighter): void {
    const n = this.fighters.length;
    const sp = spawnPoints(n)[f.index];
    f.dead = false;
    f.x = sp.x * 0.35;
    f.y = KO.respawnY;
    f.vx = 0;
    f.vy = 0;
    f.facing = f.x > 0 ? -1 : 1;
    f.percent = 0;
    f.grounded = false;
    f.support = -1;
    f.jumps = PHYS.jumps;
    f.airDodgeUsed = false;
    f.recoveryUsed = false;
    f.wallCharges = WALL.charges;
    f.wallSide = 0;
    f.invuln = KO.respawnInvuln;
    f.hover = KO.respawnHover;
    f.intang = 0;
    f.hitstun = 0;
    f.dodgeCd = 0;
    f.comboCount = 0;
    f.recentHits = [];
    f.lastHitBy = null;
    f.recovering = false;
    this.abil.newLife(f);
    this.emit({ t: 'respawn', id: f.id });
  }

  // ------------------------------------------------------------------ fine partita

  private checkEnd(dt: number): void {
    if (this.phase === 'fight') {
      const alive = this.fighters.filter((f) => f.inGame);
      if (this.fighters.length > 1 && alive.length <= 1) return this.finish('lastStanding');
      if (this.time >= this.timeLimit) this.resolveTimeout();
    } else if (this.phase === 'sudden') {
      this.suddenT += dt;
      const groupAlive = this.suddenGroup.map((id) => this.byId.get(id)!).filter((f) => f.inGame);
      if (groupAlive.length <= 1) return this.finish('suddenDeath');
      if (this.suddenT >= MATCH.suddenDeathMax) this.finish('suddenDeath');
    }
  }

  private cmpAlive = (a: Fighter, b: Fighter): number => b.lives - a.lives || a.percent - b.percent || b.stats.kos - a.stats.kos;

  private resolveTimeout(): void {
    const alive = this.fighters.filter((f) => f.inGame).sort(this.cmpAlive);
    if (alive.length >= 2 && this.cmpAlive(alive[0], alive[1]) === 0) {
      // SPAREGGIO: i pari a pari al comando si giocano un'ultima vita
      const group = alive.filter((f) => this.cmpAlive(alive[0], f) === 0);
      this.suddenGroup = group.map((f) => f.id);
      this.suddenRest = alive.filter((f) => !this.suddenGroup.includes(f.id)).map((f) => f.id);
      this.phase = 'sudden';
      this.suddenT = 0;
      const sp = spawnPoints(group.length);
      for (const f of alive) {
        if (!this.suddenGroup.includes(f.id)) {
          f.dead = true;
          f.respawnT = 1e9;
          continue;
        }
        const i = group.indexOf(f);
        f.lives = 1;
        f.percent = MATCH.suddenDeathPercent;
        f.dead = false;
        f.x = sp[i].x;
        f.y = sp[i].y;
        f.vx = 0;
        f.vy = 0;
        f.grounded = sp[i].y >= 0;
        f.support = sp[i].y > 5 ? 3 : 0;
        f.jumps = PHYS.jumps;
        f.invuln = 1.2;
        this.interrupt(f);
        this.abil.newLife(f);
      }
      return;
    }
    this.finish('timeout');
  }

  private finish(reason: 'lastStanding' | 'timeout' | 'suddenDeath'): void {
    this.phase = 'over';
    this.endReason = reason;
    this.emit({ t: 'end', reason });
  }

  /** Classifica finale: migliore per primo. Sempre una posizione per ogni giocatore. */
  ranking(): Fighter[] {
    const inGame = this.fighters.filter((f) => f.inGame && !this.suddenRest.includes(f.id) && !this.suddenGroup.includes(f.id)).sort((a, b) => this.cmpAlive(a, b) || a.tieBreak - b.tieBreak);
    const out = this.fighters
      .filter((f) => !f.inGame)
      .sort((a, b) => b.eliminatedAt - a.eliminatedAt || b.stats.kos - a.stats.kos || a.tieBreak - b.tieBreak);
    if (this.suddenGroup.length) {
      const grp = this.suddenGroup.map((id) => this.byId.get(id)!);
      const gAlive = grp.filter((f) => f.inGame).sort((a, b) => a.percent - b.percent || a.tieBreak - b.tieBreak);
      const gOut = grp.filter((f) => !f.inGame).sort((a, b) => b.eliminatedAt - a.eliminatedAt || a.tieBreak - b.tieBreak);
      const rest = this.suddenRest.map((id) => this.byId.get(id)!).sort((a, b) => this.cmpAlive(a, b) || a.tieBreak - b.tieBreak);
      const elim = out.filter((f) => !this.suddenGroup.includes(f.id));
      return [...gAlive, ...gOut, ...rest, ...elim];
    }
    return [...inGame, ...out];
  }

  /** Dati comodi per il debug e per i test. */
  get timeLeft(): number {
    return Math.max(0, this.timeLimit - this.time);
  }
}
