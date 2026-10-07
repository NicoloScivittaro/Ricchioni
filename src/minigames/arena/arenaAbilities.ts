import type { ArenaPlayer } from './arenaTypes';
import { AB } from '../../../shared/abilityCatalog';
import type { AbilityStatus } from '../../../shared/abilityCatalog';

/**
 * Abilità di ARENA DEL DISAGIO. Numeri e testi: shared/abilityCatalog.ts (AB.arena) — qui solo la logica. La fisica non sa "perché":
 * legge i flag generici su ArenaPlayer (knockbackResist, speedMult, knockMult) che questa classe imposta e ripristina.
 *
 *  GOBLIN     N'CULO!           parata a tempo: chi ti colpisce nella finestra vola via più forte; a vuoto, sei fuori equilibrio
 *  BUTTAFUORI MO M'IMPEGNO      reggi le spinte e le accumuli; alla fine le restituisci in un'onda d'urto
 *  JUDOKA     IPPON             presa su chi hai davanti e lancio; a vuoto perdi il tempo
 *  DOTTORE    M'HO SVEJATO      schivi da sveglio il primo scatto diretto contro di te; se nessuno attacca ti riaddormenti
 *  CIRO       PAGO DOMANI       il bordo non ti elimina: debito, o spingi qualcuno in tempo o cadi davvero
 */
const G = AB.arena.goblin;
const B = AB.arena.buttafuori;
const J = AB.arena.judoka;
const D = AB.arena.dottore;
const C = AB.arena.ciro;

export type ArenaAbilityFeedback =
  | { type: 'goblin_nculo' }
  | { type: 'goblin_parry' }
  | { type: 'goblin_whiff' }
  | { type: 'buttafuori_impegno' }
  | { type: 'buttafuori_release'; power: number }
  | { type: 'judoka_ippon' }
  | { type: 'judoka_whiff' }
  | { type: 'dottore_awake' }
  | { type: 'dottore_dodge' }
  | { type: 'dottore_drowsy' }
  | { type: 'ciro_arm' }
  | { type: 'ciro_saved' }
  | { type: 'ciro_paid' }
  | { type: 'ciro_collect' };

/** Eventi che sono l'ATTIVAZIONE (posa + VFX + nome sopra la testa); gli altri sono esiti e restano solo nel feed. */
export const ARENA_ACTIVATIONS = new Set<ArenaAbilityFeedback['type']>(['goblin_nculo', 'buttafuori_impegno', 'judoka_ippon', 'judoka_whiff', 'dottore_awake', 'ciro_arm']);

/** Esito della pressione del tasto: 'ok' = partita; altrimenti il motivo per cui NON e' partita (feedback privato al giocatore). */
export type ArenaPressResult = 'ok' | 'cooldown' | 'spent' | 'busy' | 'stunned';

export function abilityDescription(characterId: string | null): string {
  const d = characterId ? AB.arena[characterId as keyof typeof AB.arena] : null;
  return d ? `${d.name}: ${d.short}` : '';
}

export class ArenaAbilities {
  constructor(
    private onKnock: (target: ArenaPlayer, kx: number, kz: number, power: number, source?: ArenaPlayer) => void,
    private spawnPulse: (x: number, z: number, color: string, scale: number) => void
  ) {}

  /** Cariche iniziali: lette dal catalogo, una volta per round. */
  init(p: ArenaPlayer): void {
    const d = p.characterId ? AB.arena[p.characterId as keyof typeof AB.arena] : null;
    p.abCharges = d?.charges ?? 0;
  }

  /** L'abilita' e' in corso (finestra, postura, consapevolezza, armata, debito)? */
  private active(p: ArenaPlayer): boolean {
    return p.parryTime > 0 || p.stanceTime > 0 || p.awareTime > 0 || p.armTime > 0 || p.debtTime > 0;
  }

  /** Stato PRESENTAZIONALE per HUD e telefono, calcolato dallo stato vero del giocatore (nessuna seconda simulazione). */
  status(p: ArenaPlayer): AbilityStatus {
    const cid = p.characterId;
    if (!cid) return { state: 'SPENT' };
    const max = AB.arena[cid as keyof typeof AB.arena].charges;
    if (p.debtTime > 0) return { state: 'ACTIVE', remaining: p.debtTime, note: `DEBITO ${p.debtTime.toFixed(1).replace('.', ',')} s` };
    if (p.armTime > 0) return { state: 'ACTIVE', remaining: p.armTime, note: `ARMATA ${Math.ceil(p.armTime)} s` };
    if (p.stanceTime > 0) return { state: 'ACTIVE', remaining: p.stanceTime };
    if (p.awareTime > 0) return { state: 'ACTIVE', remaining: p.awareTime };
    if (p.parryTime > 0) return { state: 'ACTIVE', remaining: p.parryTime };
    if (p.abCharges <= 0) return { state: 'SPENT' };
    if (p.abCooldown > 0) return { state: 'COOLDOWN', remaining: p.abCooldown, charges: max > 1 ? p.abCharges : undefined };
    return { state: 'READY', charges: max > 1 ? p.abCharges : undefined };
  }

  onAbilityPress(p: ArenaPlayer, players: ArenaPlayer[], onFeedback: (f: ArenaAbilityFeedback) => void): ArenaPressResult {
    if (!p.alive || p.falling) return 'busy';
    // Buttafuori: premere di nuovo durante la postura RESTITUISCE subito (decidi tu quando)
    if (p.characterId === 'buttafuori' && p.stanceTime > 0) {
      this.endStance(p, onFeedback);
      return 'ok';
    }
    if (this.active(p) || p.whiffTime > 0) return 'busy';
    if (p.abCharges <= 0) return 'spent';
    if (p.abCooldown > 0) return 'cooldown';

    switch (p.characterId) {
      case 'goblin': {
        p.abCharges--;
        p.abCooldown = G.cooldown;
        p.parryTime = G.p.window;
        onFeedback({ type: 'goblin_nculo' });
        return 'ok';
      }
      case 'buttafuori': {
        p.abCharges--;
        p.abCooldown = B.cooldown;
        p.stanceTime = B.p.duration;
        p.stored = 0;
        p.knockbackResist = B.p.resist;
        p.speedMult = B.p.speed;
        onFeedback({ type: 'buttafuori_impegno' });
        return 'ok';
      }
      case 'judoka': {
        p.abCharges--;
        p.abCooldown = J.cooldown;
        // bersaglio: il piu' vicino entro `reach` e davanti a te (cono di ~±70°)
        const fx = Math.sin(p.facing);
        const fz = Math.cos(p.facing);
        let best: ArenaPlayer | null = null;
        let bestD = J.p.reach;
        for (const o of players) {
          if (o.id === p.id || !o.alive || o.falling) continue;
          const dx = o.x - p.x;
          const dz = o.z - p.z;
          const d = Math.hypot(dx, dz);
          if (d > bestD || d < 0.001) continue;
          if ((dx * fx + dz * fz) / d < 0.35) continue;
          best = o;
          bestD = d;
        }
        if (best) {
          const dx = best.x - p.x;
          const dz = best.z - p.z;
          const d = Math.hypot(dx, dz) || 1;
          best.stunTime = Math.max(best.stunTime, J.p.stun);
          best.dashing = false;
          this.onKnock(best, dx / d, dz / d, J.p.throw, p);
          p.stunTime = Math.max(p.stunTime, 0.25); // il gesto costa un attimo anche a te
          onFeedback({ type: 'judoka_ippon' });
        } else {
          p.stunTime = Math.max(p.stunTime, J.p.whiff);
          onFeedback({ type: 'judoka_whiff' });
        }
        return 'ok';
      }
      case 'dottore': {
        p.abCharges--;
        p.awareTime = D.p.window;
        onFeedback({ type: 'dottore_awake' });
        return 'ok';
      }
      case 'ciro': {
        p.abCharges--;
        p.armTime = C.p.arm;
        onFeedback({ type: 'ciro_arm' });
        return 'ok';
      }
    }
    return 'busy';
  }

  /**
   * Applicato prima di far subire un knockback a `target`. Ritorna il knockback da applicare ORA ({0,0} = assorbito/parato/schivato).
   * Qui vivono le tre reazioni: parata del Goblin, postura del Buttafuori, schivata del Dottore.
   */
  shieldIncoming(target: ArenaPlayer, kx: number, kz: number, source: ArenaPlayer | undefined, onFeedback: (f: ArenaAbilityFeedback) => void): { x: number; z: number } {
    if (target.alive && !target.falling) {
      // GOBLIN: parata riuscita — nessuna spinta per te, chi ti ha colpito vola via piu' forte e resta stordito
      if (target.parryTime > 0 && source && source.id !== target.id) {
        target.parryTime = 0;
        onFeedback({ type: 'goblin_parry' });
        source.stunTime = Math.max(source.stunTime, G.p.stun);
        source.dashing = false;
        const len = Math.hypot(kx, kz) || 1;
        this.onKnock(source, -kx / len, -kz / len, len * G.p.reflect, target);
        return { x: 0, z: 0 };
      }
      // DOTTORE: schivata da sveglio del primo scatto diretto contro di lui; chi attaccava inciampa
      if (target.awareTime > 0 && source && source.id !== target.id && source.dashing) {
        target.awareTime = 0;
        const len = Math.hypot(kx, kz) || 1;
        // un passo laterale, verso il centro dell'arena (mai verso il vuoto)
        const px = -kz / len;
        const pz = kx / len;
        const side = (px * -target.x + pz * -target.z) >= 0 ? 1 : -1;
        target.x += px * side * 1.7;
        target.z += pz * side * 1.7;
        source.stunTime = Math.max(source.stunTime, D.p.stun);
        source.dashing = false;
        source.vx *= 0.2;
        source.vz *= 0.2;
        onFeedback({ type: 'dottore_dodge' });
        return { x: 0, z: 0 };
      }
      // BUTTAFUORI: reggi e accumuli quello che hai assorbito
      if (target.stanceTime > 0) {
        const absorbed = Math.hypot(kx, kz) * (1 - target.knockbackResist);
        target.stored += absorbed;
      }
    }
    return { x: kx * target.knockbackResist, z: kz * target.knockbackResist };
  }

  /**
   * CIRO — il bordo non ti elimina: se `p` sta per cadere e ha la postura armata, si salva e parte il DEBITO.
   * Ritorna true se l'eliminazione e' evitata (il gioco non deve eliminarlo).
   */
  tryRescue(p: ArenaPlayer, radius: number, onFeedback: (f: ArenaAbilityFeedback) => void): boolean {
    if (p.characterId !== 'ciro' || p.armTime <= 0 || p.debtTime > 0) return false;
    p.armTime = 0;
    p.debtTime = C.p.debt;
    const d = Math.hypot(p.x, p.z) || 1;
    p.x = (p.x / d) * radius * 0.72;
    p.z = (p.z / d) * radius * 0.72;
    p.vx = 0;
    p.vz = 0;
    p.vy = 4;
    p.dashing = false;
    p.stunTime = Math.max(p.stunTime, 0.5);
    onFeedback({ type: 'ciro_saved' });
    return true;
  }

  /** Chi ha SPINTO qualcuno: se Ciro e' in debito, il debito e' saldato. */
  onPushLanded(source: ArenaPlayer, onFeedback: (f: ArenaAbilityFeedback) => void): void {
    if (source.characterId === 'ciro' && source.debtTime > 0) {
      source.debtTime = 0;
      onFeedback({ type: 'ciro_paid' });
    }
  }

  private endStance(p: ArenaPlayer, onFeedback: (f: ArenaAbilityFeedback) => void): void {
    const power = Math.min(B.p.pulseMax, p.stored * 0.8);
    p.stanceTime = 0;
    p.knockbackResist = 1;
    p.speedMult = 1;
    const stored = p.stored;
    p.stored = 0;
    if (stored < 3) {
      onFeedback({ type: 'buttafuori_release', power: 0 }); // niente da restituire: nessuno ha colpito
      return;
    }
    onFeedback({ type: 'buttafuori_release', power });
  }

  /** Onda di restituzione del Buttafuori: spinge chi gli sta intorno (il gioco passa i giocatori). */
  releasePulse(p: ArenaPlayer, players: ArenaPlayer[], power: number): void {
    if (power <= 0) return;
    this.spawnPulse(p.x, p.z, p.color, 1.4 + power / 15);
    for (const o of players) {
      if (o.id === p.id || !o.alive || o.falling) continue;
      const dx = o.x - p.x;
      const dz = o.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d < B.p.pulseRadius && d > 0.001) this.onKnock(o, dx / d, dz / d, power, p);
    }
  }

  update(p: ArenaPlayer, dt: number, onFeedback: (f: ArenaAbilityFeedback) => void): void {
    p.abCooldown = Math.max(0, p.abCooldown - dt);

    // Goblin: la finestra di parata scade senza aver parato niente → fuori equilibrio
    if (p.parryTime > 0) {
      p.parryTime -= dt;
      if (p.parryTime <= 0) {
        p.parryTime = 0;
        p.whiffTime = G.p.whiff;
        p.speedMult = 0.6;
        p.knockbackResist = 1.4;
        onFeedback({ type: 'goblin_whiff' });
      }
    }
    if (p.whiffTime > 0) {
      p.whiffTime -= dt;
      if (p.whiffTime <= 0) {
        p.whiffTime = 0;
        p.speedMult = 1;
        p.knockbackResist = 1;
      }
    }

    // Buttafuori: la postura finisce da sola e restituisce
    if (p.stanceTime > 0) {
      p.stanceTime -= dt;
      if (p.stanceTime <= 0) this.endStance(p, onFeedback);
    }

    // Dottore: nessuno ti ha attaccato → ti riaddormenti, lento per un po'
    if (p.awareTime > 0) {
      p.awareTime -= dt;
      if (p.awareTime <= 0) {
        p.awareTime = 0;
        p.drowsyTime = D.p.drowsy;
        p.speedMult = D.p.drowsySpeed;
        onFeedback({ type: 'dottore_drowsy' });
      }
    }
    if (p.drowsyTime > 0) {
      p.drowsyTime -= dt;
      if (p.drowsyTime <= 0) {
        p.drowsyTime = 0;
        p.speedMult = 1;
      }
    }

    // Ciro: la postura armata scade da sola (usa persa); il DEBITO scaduto viene riscosso (il gioco elimina)
    if (p.armTime > 0) p.armTime = Math.max(0, p.armTime - dt);
    if (p.debtTime > 0) {
      p.debtTime -= dt;
      if (p.debtTime <= 0) {
        p.debtTime = 0;
        onFeedback({ type: 'ciro_collect' });
      }
    }
  }
}
