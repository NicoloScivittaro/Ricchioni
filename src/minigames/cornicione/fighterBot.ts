import { STAGE } from './fighterData';
import { FighterWorld } from './fighterCore';
import { NO_INPUT } from './fighterTypes';
import type { Fighter, FighterInput } from './fighterTypes';

/**
 * BOT di Cornicione, usati in solitaria e nelle simulazioni (si muovono, saltano, attaccano, schivano,
 * recuperano, fanno edge guard, usano l'abilita'). Stessa interfaccia del giocatore vero: restituiscono un FighterInput per passo.
 * Stesse regole di movimento, attacco e recupero dei giocatori reali.
 */
export class FighterBot {
  private cd = 0; // tempo fino alla prossima decisione di attacco
  private hold = { jump: 0 };
  private abilityTry = 0;
  private lastAttackerPhase = false;

  constructor(
    readonly id: string,
    private rnd: () => number,
    /** 0..1: reattivita' (schivate, counter, recovery) */
    private skill = 0.6,
    /** true = non attacca mai (bersaglio di prova) */
    private passive = false
  ) {}

  input(w: FighterWorld, dt: number): FighterInput {
    const f = w.byId.get(this.id);
    if (!f || !f.inGame || f.dead) return NO_INPUT;
    const out: FighterInput = { mx: 0, my: 0, jumpPressed: false, jumpHeld: false, lightPressed: false, heavyPressed: false, dodgePressed: false, abilityPressed: false };
    this.cd -= dt;
    this.abilityTry -= dt;
    this.hold.jump = Math.max(0, this.hold.jump - dt);
    if (f.ab.windowT > 0) {
      // Ciro: il bonifico si compra quasi sempre
      if (this.rnd() < 0.6) out.abilityPressed = true;
      return out;
    }
    if (f.hitstun > 0) {
      // DI: verso il palco
      out.mx = -Math.sign(f.x) * 0.6;
      out.my = 0.3;
      return out;
    }
    if (f.ab.vanishT > 0 || f.frozenT > 0) {
      out.mx = -Math.sign(f.x);
      return out;
    }
    const enemies = w.fighters.filter((e) => e !== f && e.inGame && !e.dead);
    if (this.offstageLogic(w, f, out)) return out;
    if (enemies.length === 0) return out;
    const e = enemies.reduce((best, c) => (Math.hypot(c.x - f.x, c.y - f.y) < Math.hypot(best.x - f.x, best.y - f.y) ? c : best));
    const dx = e.x - f.x;
    const dy = e.y - f.y;
    const dist = Math.abs(dx);

    // difesa: schiva o fa counter se l'avversario sta attaccando da vicino
    const threat = !!e.attack && e.attack.phase <= 1 && dist < 3 && Math.abs(dy) < 2.5 && Math.sign(dx) === e.facing * -1;
    if (threat && !this.lastAttackerPhase && this.rnd() < this.skill * 0.5) {
      if (f.characterId === 'judoka' && f.ab.charges > 0 && this.rnd() < 0.7) out.abilityPressed = true;
      else if (f.characterId === 'buttafuori' && f.ab.charges > 0 && f.percent > 70 && this.rnd() < 0.4) {
        out.abilityPressed = true;
        out.mx = -Math.sign(dx);
      } else out.dodgePressed = true;
    }
    this.lastAttackerPhase = threat;

    // dottore: sceglie un momento per "tagliare il peso" (a volte sbagliato, e' un rischio)
    if (f.characterId === 'dottore' && f.ab.charges > 0 && f.ab.weightT <= 0 && this.abilityTry <= 0) {
      this.abilityTry = 2;
      if (this.rnd() < 0.25) out.abilityPressed = true;
    }

    // movimento verso il bersaglio
    if (f.grounded) {
      if (dist > 1.7) out.mx = Math.sign(dx);
      else if (dist < 0.9) out.mx = -Math.sign(dx) * 0.5;
      // sali verso chi e' piu' in alto
      if (dy > 2.8 && this.hold.jump <= 0 && this.rnd() < 0.05) {
        out.jumpPressed = true;
        this.hold.jump = 0.4;
      }
      if (dy < -2.8 && f.support > 0) out.my = -1; // scendi dalla piattaforma
    } else {
      out.mx = Math.sign(dx) * Math.min(1, dist / 3);
      if (dy > 2 && f.jumps > 0 && f.vy < 2 && this.rnd() < 0.08) out.jumpPressed = true;
      if (dy < -1.5 && !f.attack) out.my = -0.8;
    }
    out.jumpHeld = this.hold.jump > 0.2 || f.vy > 4;

    // attacco
    if (!this.passive && this.cd <= 0 && dist < 2.4 && Math.abs(dy) < 2.6 && !f.attack && !f.dodge) {
      const heavy = this.rnd() < 0.3;
      if (heavy) out.heavyPressed = true;
      else out.lightPressed = true;
      if (dy > 1.4) out.my = 1;
      else if (dy < -1.6 && !f.grounded) out.my = -1;
      else if (!f.grounded && this.rnd() < 0.3) out.my = 0;
      out.mx = Math.sign(dx) * (this.rnd() < 0.7 ? 0.8 : 0);
      this.cd = 0.15 + this.rnd() * 0.5;
    }
    return out;
  }

  /** Recupero e edge guard. true = ha deciso lui l'input. */
  private offstageLogic(w: FighterWorld, f: Fighter, out: FighterInput): boolean {
    if (w.offstage(f)) {
      const towards = -Math.sign(f.x || 1);
      out.mx = towards;
      const low = f.y < 1;
      // goblin: la rimonta si usa quando sei davvero in difficolta'
      if (f.characterId === 'goblin' && f.ab.charges > 0 && (f.y < -4 || Math.abs(f.x) > 18) && f.vy < 2) {
        out.abilityPressed = true;
        out.my = 0.6;
      }
      if (f.vy < 0 && f.jumps > 0 && low && this.rnd() < 0.5 * (0.5 + this.skill)) out.jumpPressed = true;
      if (f.vy < -3 && f.jumps === 0 && !f.recoveryUsed && f.y < 0.5 && Math.abs(f.x) < STAGE.mainX + 6 && this.rnd() < 0.7) {
        out.heavyPressed = true;
        out.my = 1;
        out.mx = towards * 0.6;
      } else if (f.jumps === 0 && f.recoveryUsed && !f.airDodgeUsed && f.dodgeCd <= 0 && this.rnd() < 0.2 * this.skill) {
        out.dodgePressed = true;
        out.my = 0.6;
      }
      out.jumpHeld = true;
      // alla parete: salta
      if (f.wallSide !== 0 && this.rnd() < 0.3) out.jumpPressed = true;
      return true;
    }
    // edge guard: se un avversario e' fuori e basso, vai al bordo
    const target = w.fighters.find((e) => e !== f && e.inGame && !e.dead && w.offstage(e) && e.y > -10 && Math.abs(e.x) < 24);
    if (target && f.grounded && !this.passive) {
      const edge = Math.sign(target.x) * (STAGE.mainX - 1.2);
      if (Math.abs(f.x - edge) > 0.8 && f.support === 0) out.mx = Math.sign(edge - f.x);
      else if (this.cd <= 0 && Math.abs(target.x - f.x) < 4) {
        out.heavyPressed = true;
        out.mx = Math.sign(target.x - f.x) * 0.8;
        this.cd = 0.8;
      }
      return true;
    }
    return false;
  }
}
