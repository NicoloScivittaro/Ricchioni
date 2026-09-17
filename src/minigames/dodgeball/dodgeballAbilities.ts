import type { DodgeballPlayer } from './dodgeballTypes';
import { DODGE_SPEED, DODGE_TIME, DODGE_COOLDOWN, STUN_TIME } from './dodgeballTypes';

const BUTTAFUORI_DURATION = 5;
const DOTTORE_DURATION = 5;
const DOTTORE_SPEED = 1.4;
const DOTTORE_TAKEN = 2.2;
const JUDOKA_RADIUS = 6;
const JUDOKA_POWER = 14;
const CIRO_ARM_WINDOW = 4;

export type DodgeballAbilityFeedback =
  | { type: 'goblin_nculo' }
  | { type: 'buttafuori_impegno' }
  | { type: 'dottore_light' }
  | { type: 'judoka_ippon' }
  | { type: 'ciro_arm' }
  | { type: 'buttafuori_saved' }
  | { type: 'ciro_saved' };

/**
 * Abilità di DODGEBALL DEI COGLIONI. Come per l'arena, la fisica legge solo i
 * flag su DodgeballPlayer (invulnTime, speedMult, knockbackResist, deferArmed).
 */
export class DodgeballAbilities {
  constructor(private onKnock: (target: DodgeballPlayer, kx: number, kz: number, power: number, dropBall?: boolean) => void) {}

  onAbilityPress(p: DodgeballPlayer, players: DodgeballPlayer[], onFeedback: (f: DodgeballAbilityFeedback) => void): void {
    if (p.abilityUsed || !p.alive || p.falling) return;

    switch (p.characterId) {
      case 'goblin': {
        // Schiva sporca: scatto imprevedibile + invulnerabilità.
        p.abilityUsed = true;
        const jitter = (Math.random() - 0.5) * 1.2;
        p.facing += jitter;
        p.dodgeTime = DODGE_TIME * 1.15;
        p.dodgeCooldown = DODGE_COOLDOWN;
        p.invulnTime = Math.max(p.invulnTime, 0.6);
        p.vx = Math.sin(p.facing) * DODGE_SPEED;
        p.vz = Math.cos(p.facing) * DODGE_SPEED;
        onFeedback({ type: 'goblin_nculo' });
        break;
      }
      case 'buttafuori': {
        p.abilityUsed = true;
        p.abilityTimer = BUTTAFUORI_DURATION;
        onFeedback({ type: 'buttafuori_impegno' });
        break;
      }
      case 'dottore': {
        p.abilityUsed = true;
        p.speedMult = DOTTORE_SPEED;
        p.knockbackResist = DOTTORE_TAKEN;
        p.abilityTimer = DOTTORE_DURATION;
        onFeedback({ type: 'dottore_light' });
        break;
      }
      case 'judoka': {
        p.abilityUsed = true;
        for (const other of players) {
          if (other.id === p.id || !other.alive || other.falling) continue;
          const dx = other.x - p.x;
          const dz = other.z - p.z;
          const d = Math.hypot(dx, dz);
          if (d < JUDOKA_RADIUS && d > 0.001) {
            this.onKnock(other, dx / d, dz / d, JUDOKA_POWER, true);
          }
        }
        onFeedback({ type: 'judoka_ippon' });
        break;
      }
      case 'ciro': {
        p.abilityUsed = true;
        p.deferArmed = true;
        p.abilityTimer = CIRO_ARM_WINDOW;
        onFeedback({ type: 'ciro_arm' });
        break;
      }
    }
  }

  /**
   * Applicato quando una palla colpisce `p`. Ritorna 'survive' se il colpo è
   * stato assorbito (schivata invulnerabile, tank Buttafuori, rinvio Ciro).
   */
  handleIncomingHit(p: DodgeballPlayer, onFeedback: (f: DodgeballAbilityFeedback) => void): 'survive' | 'die' {
    if (p.invulnTime > 0) return 'survive';
    if (p.characterId === 'buttafuori' && p.abilityTimer > 0) {
      p.abilityTimer = 0;
      onFeedback({ type: 'buttafuori_saved' });
      return 'survive';
    }
    if (p.deferArmed) {
      p.deferArmed = false;
      p.abilityTimer = 0;
      p.stunTime = Math.max(p.stunTime, STUN_TIME * 3);
      onFeedback({ type: 'ciro_saved' });
      return 'survive';
    }
    return 'die';
  }

  update(p: DodgeballPlayer, dt: number): void {
    if (p.abilityTimer > 0) {
      p.abilityTimer -= dt;
      if (p.abilityTimer <= 0) {
        p.abilityTimer = 0;
        p.speedMult = 1;
        p.knockbackResist = 1;
        p.deferArmed = false;
      }
    }
  }
}
