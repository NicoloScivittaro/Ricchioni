import type { DodgeballPlayer } from './dodgeballTypes';
import {
  PARRY_TIME,
  AIM_TIME,
  VISION_TIME,
  TRUCK_BEEP_TIME,
  TRUCK_TIME,
  CIRO_ARM_WINDOW,
  CIRO_DEBT_TIME
} from './dodgeballTypes';

export type DodgeballAbilityFeedback =
  | { type: 'goblin_parry' }
  | { type: 'goblin_reflect' }
  | { type: 'goblin_whiff' }
  | { type: 'buttafuori_aim' }
  | { type: 'buttafuori_charged' }
  | { type: 'dottore_vision' }
  | { type: 'dottore_hit_anyway' }
  | { type: 'judoka_beep' }
  | { type: 'judoka_truck' }
  | { type: 'judoka_wall' }
  | { type: 'judoka_scarica' }
  | { type: 'ciro_arm' }
  | { type: 'ciro_debt' }
  | { type: 'ciro_debt_cancelled' }
  | { type: 'ciro_debt_due' };

/**
 * Abilità di DODGEBALL DEI COGLIONI (v2). La classe gestisce SOLO lo stato
 * (timer/flag); le interazioni fisiche (rimbalzo parata, raccolta camion,
 * eliminazione per debito) sono orchestrate dal gioco.
 */
export class DodgeballAbilities {
  onAbilityPress(
    p: DodgeballPlayer,
    dirX: number,
    dirZ: number,
    onFeedback: (f: DodgeballAbilityFeedback) => void
  ): void {
    if (p.abilityUsed || !p.alive || p.falling) return;

    switch (p.characterId) {
      case 'goblin': {
        p.abilityUsed = true;
        p.parryTime = PARRY_TIME;
        onFeedback({ type: 'goblin_parry' });
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
        p.visionTime = VISION_TIME;
        onFeedback({ type: 'dottore_vision' });
        break;
      }
      case 'judoka': {
        p.abilityUsed = true;
        p.truckBeepTimer = TRUCK_BEEP_TIME;
        p.truckTime = 0;
        p.truckDirX = dirX;
        p.truckDirZ = dirZ;
        p.truckBalls = [];
        onFeedback({ type: 'judoka_beep' });
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

  /**
   * Applicato quando una palla sta per colpire `p` (dopo la parata di Goblin,
   * gestita a parte). Ritorna 'survive' se il colpo è assorbito/trasformato.
   */
  handleIncomingHit(p: DodgeballPlayer, onFeedback: (f: DodgeballAbilityFeedback) => void): 'survive' | 'die' {
    if (p.invulnTime > 0) return 'survive'; // schivata
    if (p.truckTime > 0) return 'survive'; // camion: più difficile da fermare
    if (p.deferArmed) {
      p.deferArmed = false;
      p.armTimer = 0;
      p.debtActive = true;
      p.debtTimer = CIRO_DEBT_TIME;
      onFeedback({ type: 'ciro_debt' });
      return 'survive';
    }
    return 'die';
  }

  update(p: DodgeballPlayer, dt: number, onFeedback: (f: DodgeballAbilityFeedback) => void): void {
    // Goblin: fine finestra di parata (senza aver intercettato nulla).
    if (p.parryTime > 0) {
      p.parryTime -= dt;
      if (p.parryTime <= 0) {
        p.parryTime = 0;
        onFeedback({ type: 'goblin_whiff' });
      }
    }

    if (p.aimTime > 0) p.aimTime = Math.max(0, p.aimTime - dt);
    if (p.visionTime > 0) p.visionTime = Math.max(0, p.visionTime - dt);

    // Ciro: finestra "armato" senza essere stato colpito.
    if (p.armTimer > 0) {
      p.armTimer -= dt;
      if (p.armTimer <= 0) {
        p.armTimer = 0;
        p.deferArmed = false;
      }
    }

    // Ciro: countdown del debito.
    if (p.debtActive) {
      p.debtTimer -= dt;
    }

    // Judoka: BIP… BIP… BIP… poi corsa camion, poi "SCARICA".
    if (p.truckBeepTimer > 0) {
      p.truckBeepTimer -= dt;
      if (p.truckBeepTimer <= 0) {
        p.truckBeepTimer = 0;
        p.truckTime = TRUCK_TIME;
        onFeedback({ type: 'judoka_truck' });
      }
    } else if (p.truckTime > 0) {
      p.truckTime -= dt;
      if (p.truckTime <= 0) {
        p.truckTime = 0;
        onFeedback({ type: 'judoka_scarica' });
      }
    }
  }
}
