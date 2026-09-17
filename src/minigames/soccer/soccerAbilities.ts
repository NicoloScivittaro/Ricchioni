import type { SoccerPlayer } from './soccerTypes';
import { AIM_TIME, LIGHT_TIME, CIRO_ARM_WINDOW } from './soccerTypes';

export type SoccerAbilityFeedback =
  | { type: 'goblin_trivela' }
  | { type: 'buttafuori_aim' }
  | { type: 'buttafuori_charged' }
  | { type: 'dottore_light' }
  | { type: 'judoka_charge' }
  | { type: 'ciro_arm' }
  | { type: 'ciro_hold' };

/**
 * Abilità di CALCIO DEI DISAGIATI. Gestisce SOLO lo stato (flag/timer); le
 * interazioni (curva del tiro, tackle, ecc.) sono orchestrate dal gioco.
 */
export class SoccerAbilities {
  onAbilityPress(p: SoccerPlayer, onFeedback: (f: SoccerAbilityFeedback) => void): void {
    if (p.abilityUsed || !p.alive) return;
    switch (p.characterId) {
      case 'goblin': {
        p.abilityUsed = true;
        p.curveNext = true;
        onFeedback({ type: 'goblin_trivela' });
        break;
      }
      case 'buttafuori': {
        p.abilityUsed = true;
        p.aimTime = AIM_TIME;
        p.aimThrown = false;
        onFeedback({ type: 'buttafuori_aim' });
        break;
      }
      case 'dottore': {
        p.abilityUsed = true;
        p.lightTime = LIGHT_TIME;
        onFeedback({ type: 'dottore_light' });
        break;
      }
      case 'judoka': {
        p.abilityUsed = true;
        p.judokaCharge = true;
        onFeedback({ type: 'judoka_charge' });
        break;
      }
      case 'ciro': {
        p.abilityUsed = true;
        p.deferArmed = true;
        p.armTimer = CIRO_ARM_WINDOW;
        onFeedback({ type: 'ciro_arm' });
        break;
      }
    }
  }

  update(p: SoccerPlayer, dt: number): void {
    if (p.aimTime > 0) p.aimTime = Math.max(0, p.aimTime - dt);
    if (p.lightTime > 0) p.lightTime = Math.max(0, p.lightTime - dt);
    if (p.armTimer > 0) {
      p.armTimer -= dt;
      if (p.armTimer <= 0) {
        p.armTimer = 0;
        p.deferArmed = false;
      }
    }
  }

  /**
   * Risolve un tackle: attacker prova a rubare palla a victim (che la possiede).
   * Ritorna 'steal' se il tackle riesce, 'blocked' se neutralizzato (Dottore
   * debole in "20 KG" oppure Ciro in "PAGO DOMANI").
   */
  resolveTackle(attacker: SoccerPlayer, victim: SoccerPlayer): 'steal' | 'blocked' {
    if (attacker.lightTime > 0) return 'blocked';
    if (victim.deferArmed) {
      victim.deferArmed = false;
      victim.armTimer = 0;
      return 'blocked';
    }
    return 'steal';
  }
}
