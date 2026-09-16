import { getCharacter } from '../characters';
import { HOOKS } from './hooks';
import type { ActiveModifier, Category, PlayerId, PlayerState } from './types';
import type { Rng } from './Rng';

/**
 * Sistema centrale "CHARACTER ABILITY MODIFIERS".
 * Risolve (personaggio × categoria × ripetizione) → hook attivi per giocatore.
 * I minigiochi consumano questi hook tramite ctx.consume(); se un minigioco non
 * implementa un hook, l'abilità semplicemente non produce effetto (degradazione pulita).
 */
export class AbilitySystem {
  static resolve(
    players: PlayerState[],
    category: Category,
    repeatedMinigame: boolean,
    rng: Rng
  ): Map<PlayerId, ActiveModifier[]> {
    void rng; // riservato per risoluzioni future non deterministiche
    const map = new Map<PlayerId, ActiveModifier[]>();

    for (const p of players) {
      const c = getCharacter(p.id);
      const hooks = c.hooks[category] ?? c.defaultHooks ?? [];
      const mods: ActiveModifier[] = hooks.map((hook) => ({
        source: p.id,
        hook,
        label: c.abilityName,
        uses: 1
      }));

      // Goblin: più perde lucidità (risorsa bassa), più usi (più caos)
      if (p.id === 'goblin') {
        const uses = p.resourceValue <= 25 ? 2 : 1;
        mods.forEach((m) => (m.uses = uses));
      }

      // Buttafuori: "ASPETTA, FAMME CAPÌ" — vantaggio se il gioco è già uscito in partita
      if (p.id === 'buttafuori' && repeatedMinigame) {
        mods.push({
          source: p.id,
          hook: HOOKS.timing_stability,
          label: 'ASPETTA, FAMME CAPÌ',
          uses: 1
        });
      }

      if (mods.length > 0) map.set(p.id, mods);
    }

    return map;
  }
}
