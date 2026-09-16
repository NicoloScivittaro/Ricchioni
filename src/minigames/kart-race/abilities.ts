import { HOOKS } from '../../../shared/hooks';
import type { PlayerId } from '../../../shared/types';
import type { MinigameContext } from '../types';
import type { KartState } from './raceTypes';
import { applyBoost } from './kartPhysics';
import { HARD_CORNER_RANGES } from './track';

/**
 * Collega le abilità dei personaggi già esistenti (shared/characters.ts +
 * shared/hooks.ts + ctx.consume) ai momenti di gioco di KART. Trigger
 * automatici, coerenti con come gli hook sono già descritti sui personaggi:
 * - GOBLIN (EXPLOIT → race_reveal_obstacle): piccolo aiuto nei tratti tecnici.
 * - BUTTAFUORI (MO M'IMPEGNO → race_quick_recover): recupero più rapido dopo un colpo grave.
 * - DOTTORE / JUDOKA / NAPOLETANO (default → generic_undo_one_error): annullano un colpo, una volta a gara.
 */
export class AbilityHooks {
  private wasInHardCorner = new Set<PlayerId>();

  constructor(
    private ctx: MinigameContext,
    private totalLength: number
  ) {}

  /** Da chiamare ogni frame per ogni kart in gara. */
  updateCornerAssist(k: KartState): void {
    const frac = ((k.distance % this.totalLength) + this.totalLength) % this.totalLength / this.totalLength;
    const inZone = HARD_CORNER_RANGES.some(([a, b]) => frac >= a && frac <= b) && k.speed > 25;
    const wasIn = this.wasInHardCorner.has(k.playerId);
    if (inZone && !wasIn) {
      if (this.ctx.consume(k.playerId, HOOKS.race_reveal_obstacle)) {
        applyBoost(k, 8, 1.2);
      }
    }
    if (inZone) this.wasInHardCorner.add(k.playerId);
    else this.wasInHardCorner.delete(k.playerId);
  }

  /** Riduce (se disponibile) la durata dello stun da collisione grave. */
  quickRecoverStun(playerId: PlayerId, baseStun: number): number {
    if (this.ctx.consume(playerId, HOOKS.race_quick_recover)) return baseStun * 0.35;
    return baseStun;
  }

  /** Prova ad annullare del tutto un colpo subito (fallback dei personaggi senza hook GUIDA dedicato). */
  tryCancelHit(playerId: PlayerId): boolean {
    return this.ctx.consume(playerId, HOOKS.generic_undo_one_error);
  }
}
