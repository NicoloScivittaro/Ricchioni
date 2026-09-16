import { getCharacter } from './characters';
import { HOOKS } from './hooks';
import type { ActiveModifier, Category, PlayerId } from './types';
import type { Rng } from './rng';

export interface AbilityPlayerRef {
  id: PlayerId;
  characterId: string | null;
}

/**
 * Sistema "CHARACTER ABILITY MODIFIERS".
 * Risolve (personaggio × categoria × ripetizione) → hook attivi.
 * I minigiochi consumano gli hook; se non implementano un hook, l'abilità
 * semplicemente non produce effetto (degradazione pulita).
 */
export class AbilitySystem {
  static resolve(
    players: AbilityPlayerRef[],
    category: Category,
    repeatedMinigame: boolean,
    rng: Rng
  ): Map<PlayerId, ActiveModifier[]> {
    void rng;
    const map = new Map<PlayerId, ActiveModifier[]>();

    for (const p of players) {
      const c = getCharacter(p.characterId ?? p.id);
      const hooks = c.hooks[category] ?? c.defaultHooks ?? [];
      const mods: ActiveModifier[] = hooks.map((hook) => ({
        source: p.id,
        hook,
        label: c.abilityName,
        uses: 1
      }));

      if (p.characterId === 'goblin') {
        mods.forEach((m) => (m.uses = 2));
      }

      if (p.characterId === 'buttafuori' && repeatedMinigame) {
        mods.push({ source: p.id, hook: HOOKS.timing_stability, label: 'ASPETTA, FAMME CAPÌ', uses: 1 });
      }

      if (mods.length > 0) map.set(p.id, mods);
    }

    return map;
  }
}
