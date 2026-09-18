import type { VolleyballPlayer } from './volleyballTypes';

export const MURO_TIME = 6;
export const LIGHT_TIME = 5;
export const CIRO_ARM_WINDOW = 4;
export const JAGER_POWER_MULT = 1.55;
export const JUDOKA_ACCEL_MULT = 2.6;
export const JUDOKA_HIT_MULT = 1.4;
export const JUDOKA_TIME = 6;

export type VolleyballAbilityFeedback =
  | { type: 'goblin_jager' }
  | { type: 'goblin_jager_boom' }
  | { type: 'goblin_jager_wasted' }
  | { type: 'buttafuori_muro' }
  | { type: 'buttafuori_stable' }
  | { type: 'dottore_light' }
  | { type: 'judoka_charge' }
  | { type: 'judoka_strong' }
  | { type: 'ciro_arm' }
  | { type: 'ciro_saved' }
  | { type: 'ciro_failed' };

/**
 * Abilità di PALLAVOLO DEI DISAGIATI. Gestisce SOLO lo stato (flag/timer);
 * gli effetti fisici (smash potenziato, congelamento punto, ecc.) sono
 * applicati dal gioco leggendo i flag.
 */
export class VolleyballAbilities {
  onAbilityPress(p: VolleyballPlayer, onFeedback: (f: VolleyballAbilityFeedback) => void): void {
    if (p.abilityUsed || !p.alive) return;
    switch (p.characterId) {
      case 'goblin': {
        p.abilityUsed = true;
        p.jagerBomb = true;
        onFeedback({ type: 'goblin_jager' });
        break;
      }
      case 'buttafuori': {
        p.abilityUsed = true;
        p.muroTime = MURO_TIME;
        onFeedback({ type: 'buttafuori_muro' });
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
        p.judokaTime = JUDOKA_TIME;
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

  update(p: VolleyballPlayer, dt: number): void {
    if (p.muroTime > 0) p.muroTime = Math.max(0, p.muroTime - dt);
    if (p.lightTime > 0) p.lightTime = Math.max(0, p.lightTime - dt);
    if (p.judokaTime > 0) {
      p.judokaTime -= dt;
      if (p.judokaTime <= 0) {
        p.judokaTime = 0;
        p.judokaCharge = false; // carica scaduta
      }
    }
    if (p.armTimer > 0) {
      p.armTimer -= dt;
      if (p.armTimer <= 0) {
        p.armTimer = 0;
        p.deferArmed = false;
      }
    }
  }
}
