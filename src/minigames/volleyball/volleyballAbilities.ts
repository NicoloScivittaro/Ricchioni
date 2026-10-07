import type { VolleyballPlayer } from './volleyballTypes';
import { AB } from '../../../shared/abilityCatalog';
import type { AbilityStatus } from '../../../shared/abilityCatalog';

/**
 * Abilità di PALLAVOLO DEI DISAGIATI. Numeri e testi: shared/abilityCatalog.ts (AB.volleyball). Gestisce SOLO lo stato (flag/timer):
 * gli effetti fisici (smash potenziato, muro, palla ferma, rimbalzo del Ciro) li applica il gioco leggendo questi flag.
 *
 *  GOBLIN     JÄGER BOMB          arma il prossimo smash: se lo colpisci "perfetto" diventa una bomba, altrimenti e' sprecata
 *  BUTTAFUORI MURO DEL POLIGONO   a rete le braccia arrivano piu' lontano e la palla colpita in alto torna giu'
 *  JUDOKA     NO, ASPETTA!        la palla resta ferma in aria e solo tu puoi muoverti
 *  DOTTORE    M'HO SVEJATO        salti/corri meglio e il prossimo smash va dove nessuno difende; poi scivoli
 *  CIRO       PAGO DOMANI         la prima palla a terra nel tuo campo rimbalza e si continua; se poi perdi lo scambio, vale doppio
 */
const G = AB.volleyball.goblin;
const B = AB.volleyball.buttafuori;
const J = AB.volleyball.judoka;
const D = AB.volleyball.dottore;
const C = AB.volleyball.ciro;

export const JAGER_POWER_MULT = G.p.power;

export type VolleyballAbilityFeedback =
  | { type: 'goblin_jager' }
  | { type: 'goblin_jager_boom' }
  | { type: 'goblin_jager_wasted' }
  | { type: 'goblin_jager_expired' }
  | { type: 'buttafuori_muro' }
  | { type: 'buttafuori_block' }
  | { type: 'judoka_freeze' }
  | { type: 'judoka_resume' }
  | { type: 'dottore_awake' }
  | { type: 'dottore_shot' }
  | { type: 'dottore_dizzy' }
  | { type: 'ciro_arm' }
  | { type: 'ciro_saved' }
  | { type: 'ciro_paid' }
  | { type: 'ciro_collect' };

/** Eventi che sono l'ATTIVAZIONE (posa + VFX + nome sopra la testa); gli altri sono esiti e restano solo nel feed. */
export const VOLLEYBALL_ACTIVATIONS = new Set<VolleyballAbilityFeedback['type']>(['goblin_jager', 'buttafuori_muro', 'judoka_freeze', 'dottore_awake', 'ciro_arm']);

export type VolleyballPressResult = 'ok' | 'spent' | 'busy' | 'noball';

export class VolleyballAbilities {
  init(p: VolleyballPlayer): void {
    const d = p.characterId ? AB.volleyball[p.characterId as keyof typeof AB.volleyball] : null;
    p.abCharges = d?.charges ?? 0;
  }

  private active(p: VolleyballPlayer): boolean {
    return p.jagerTime > 0 || p.muroTime > 0 || p.lucidTime > 0 || p.armTime > 0 || p.dizzyTime > 0;
  }

  /** `freezeLeft` > 0 se QUESTO giocatore (Judoka) sta tenendo ferma la palla: lo stato vive nel gioco, qui solo la lettura. */
  status(p: VolleyballPlayer, freezeLeft = 0, debtOnMe = false): AbilityStatus {
    const cid = p.characterId;
    if (!cid) return { state: 'SPENT' };
    if (freezeLeft > 0) return { state: 'ACTIVE', remaining: freezeLeft, note: 'PALLA FERMA' };
    if (debtOnMe) return { state: 'ACTIVE', note: 'DEBITO: VINCI LO SCAMBIO' };
    if (p.armTime > 0) return { state: 'ACTIVE', remaining: p.armTime, note: `ARMATA ${Math.ceil(p.armTime)} s` };
    if (p.jagerTime > 0) return { state: 'ACTIVE', remaining: p.jagerTime, note: 'SCHIACCIA A MEZZ’ARIA' };
    if (p.muroTime > 0) return { state: 'ACTIVE', remaining: p.muroTime };
    if (p.lucidTime > 0) return { state: 'ACTIVE', remaining: p.lucidTime, note: 'SCHIACCIA!' };
    if (p.dizzyTime > 0) return { state: 'ACTIVE', remaining: p.dizzyTime, note: 'GIRA LA TESTA' };
    if (p.abCharges <= 0) return { state: 'SPENT' };
    return { state: 'READY' };
  }

  /** `ballInAir` serve solo al Judoka: la palla deve essere in volo. */
  onAbilityPress(p: VolleyballPlayer, ballInAir: boolean, onFeedback: (f: VolleyballAbilityFeedback) => void): VolleyballPressResult {
    if (!p.alive) return 'busy';
    if (this.active(p)) return 'busy';
    if (p.abCharges <= 0) return 'spent';
    switch (p.characterId) {
      case 'goblin': {
        p.abCharges--;
        p.jagerTime = G.p.arm;
        onFeedback({ type: 'goblin_jager' });
        return 'ok';
      }
      case 'buttafuori': {
        p.abCharges--;
        p.muroTime = B.p.duration;
        onFeedback({ type: 'buttafuori_muro' });
        return 'ok';
      }
      case 'judoka': {
        if (!ballInAir) return 'noball';
        p.abCharges--;
        onFeedback({ type: 'judoka_freeze' });
        return 'ok';
      }
      case 'dottore': {
        p.abCharges--;
        p.lucidTime = D.p.duration;
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

  update(p: VolleyballPlayer, dt: number, onFeedback: (f: VolleyballAbilityFeedback) => void): void {
    if (p.jagerTime > 0) {
      p.jagerTime -= dt;
      if (p.jagerTime <= 0) {
        p.jagerTime = 0;
        onFeedback({ type: 'goblin_jager_expired' });
      }
    }
    if (p.muroTime > 0) p.muroTime = Math.max(0, p.muroTime - dt);
    if (p.lucidTime > 0) {
      p.lucidTime -= dt;
      if (p.lucidTime <= 0) {
        p.lucidTime = 0;
        p.dizzyTime = D.p.dizzy;
        onFeedback({ type: 'dottore_dizzy' });
      }
    }
    if (p.dizzyTime > 0) p.dizzyTime = Math.max(0, p.dizzyTime - dt);
    if (p.armTime > 0) p.armTime = Math.max(0, p.armTime - dt);
  }

  /** Fine di uno scambio / ripartenza: nessuna finestra aperta (le cariche restano com'erano). */
  clearEffects(p: VolleyballPlayer): void {
    p.jagerTime = 0;
    p.muroTime = 0;
    p.lucidTime = 0;
    p.dizzyTime = 0;
    p.armTime = 0;
  }

  /** Moltiplicatori di movimento dovuti alle abilita'. */
  speedFactor(p: VolleyballPlayer): number {
    if (p.lucidTime > 0) return D.p.speed;
    if (p.dizzyTime > 0) return D.p.dizzySpeed;
    return 1;
  }
  jumpFactor(p: VolleyballPlayer): number {
    return p.lucidTime > 0 ? D.p.jump : 1;
  }
}

export const VOLLEY_BUTTAFUORI = B;
export const VOLLEY_JUDOKA = J;
export const VOLLEY_DOTTORE = D;
export const VOLLEY_CIRO = C;
