import type { ArenaPlayer } from './arenaTypes';
import { DASH_TIME, DASH_COOLDOWN, STUN_TIME } from './arenaTypes';

const BUTTAFUORI_DURATION = 5;
const BUTTAFUORI_RESIST = 0.3;
const DOTTORE_DURATION = 5;
const DOTTORE_SPEED = 1.4;
const DOTTORE_TAKEN = 2.0;
const JUDOKA_RADIUS = 5.5;
const JUDOKA_POWER = 15;
const GOBLIN_KNOCK_MULT = 1.85;
const CIRO_ARM_WINDOW = 4;
const CIRO_DEBT_DELAY = 2;

export type ArenaAbilityFeedback =
  | { type: 'goblin_nculo' }
  | { type: 'buttafuori_impegno' }
  | { type: 'dottore_light' }
  | { type: 'judoka_ippon' }
  | { type: 'ciro_arm' }
  | { type: 'ciro_due' };

export function abilityDescription(characterId: string | null): string {
  switch (characterId) {
    case 'goblin':
      return 'NCULO!: dash sporco con traiettoria storta e knockback potenziato.';
    case 'buttafuori':
      return "MO M'IMPEGNO: per 5s resisti molto meglio ai knockback.";
    case 'dottore':
      return '20 KG IN UN MESE: per 5s sei più veloce ma molto più facile da sbalzare.';
    case 'judoka':
      return 'IPPON: onda d\'urto che spinge via con forza chi ti sta vicino.';
    case 'ciro':
      return 'PAGO DOPO: arma per 4s il rinvio della prossima spinta subita (torna dopo 2s).';
    default:
      return '';
  }
}

/**
 * Abilità di ARENA DEL DISAGIO. La fisica resta ignara del "perché": legge solo
 * i flag generici su ArenaPlayer (knockbackResist, speedMult, knockMult,
 * deferArmed, deferredKnock) che questa classe imposta e ripristina.
 */
export class ArenaAbilities {
  constructor(private onKnock: (target: ArenaPlayer, kx: number, kz: number, power: number, source?: ArenaPlayer) => void) {}

  onAbilityPress(p: ArenaPlayer, players: ArenaPlayer[], onFeedback: (f: ArenaAbilityFeedback) => void): void {
    if (p.abilityUsed || !p.alive || p.falling) return;

    switch (p.characterId) {
      case 'goblin': {
        p.abilityUsed = true;
        // Dash "sporco": direzione storta + knockback potenziato.
        const jitter = (Math.random() - 0.5) * 0.7;
        p.facing += jitter;
        p.dashing = true;
        p.dashTime = DASH_TIME * 1.25;
        p.dashCooldown = DASH_COOLDOWN;
        p.knockMult = GOBLIN_KNOCK_MULT;
        p.abilityTimer = DASH_TIME * 1.25 + 0.1; // ripristina knockMult a fine dash
        const fx = Math.sin(p.facing);
        const fz = Math.cos(p.facing);
        p.vx = fx * 17;
        p.vz = fz * 17;
        onFeedback({ type: 'goblin_nculo' });
        break;
      }
      case 'buttafuori': {
        p.abilityUsed = true;
        p.knockbackResist = BUTTAFUORI_RESIST;
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
            this.onKnock(other, dx / d, dz / d, JUDOKA_POWER, p);
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
   * Applicato prima di far subire un knockback a `p`: gestisce il rinvio di Ciro
   * e la resistenza/vulnerabilità di Buttafuori/Dottore. Ritorna il knockback da applicare ORA.
   */
  shieldIncoming(p: ArenaPlayer, kx: number, kz: number): { x: number; z: number } {
    if (p.deferArmed && !p.falling && p.alive) {
      p.deferArmed = false;
      p.deferredKnock = { x: kx * 0.55, z: kz * 0.55 };
      p.deferTimer = CIRO_DEBT_DELAY;
      return { x: 0, z: 0 };
    }
    return { x: kx * p.knockbackResist, z: kz * p.knockbackResist };
  }

  update(p: ArenaPlayer, dt: number, onFeedback: (f: ArenaAbilityFeedback) => void): void {
    // Buff temporizzati (Buttafuori/Dottore/Goblin): allo scadere ripristina i flag.
    if (p.abilityTimer > 0) {
      p.abilityTimer -= dt;
      if (p.abilityTimer <= 0) {
        p.abilityTimer = 0;
        p.knockbackResist = 1;
        p.speedMult = 1;
        p.knockMult = 1;
      }
    }

    // Ciro: il DEBITO scade → la spinta rimandata arriva (più debole).
    if (p.deferredKnock) {
      p.deferTimer -= dt;
      if (p.deferTimer <= 0) {
        const k = p.deferredKnock;
        p.deferredKnock = null;
        if (p.alive && !p.falling) {
          p.vx += k.x;
          p.vz += k.z;
          p.vy += 2;
          p.stunTime = Math.max(p.stunTime, STUN_TIME * 0.7);
          onFeedback({ type: 'ciro_due' });
        }
      }
    }
  }
}
