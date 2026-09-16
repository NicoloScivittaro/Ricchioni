import { MinigameRegistry } from './MinigameRegistry';
import { ModifierRegistry } from './ModifierRegistry';
import { RARITY_WEIGHT } from './types';
import type { RouletteHistoryEntry, RoulettePick } from './types';
import type { Rng } from './Rng';

/**
 * Algoritmo di selezione del rullo (pura logica, testabile senza browser).
 * - categoria pesata con anti-ripetizione della categoria precedente
 * - minigioco pesato per rarità, con anti-ripetizione (mai 2 volte consecutive,
 *   probabilità ridotta se uscito negli ultimi 3 round)
 * - modificatore opzionale (~25%), scelto tra quelli compatibili
 */
export class RouletteEngine {
  static pick(playerCount: number, history: RouletteHistoryEntry[], rng: Rng): RoulettePick {
    const all = MinigameRegistry.all().filter(
      (d) => playerCount >= d.minPlayers && playerCount <= d.maxPlayers
    );
    if (all.length === 0) throw new Error('Nessun minigioco registrato per questo numero di giocatori');

    // 1) Categoria (anti-ripetizione: la precedente ha peso ridotto)
    const lastCategory = history[history.length - 1]?.category;
    const categories = [...new Set(all.map((d) => d.category))];
    const category = rng.weighted(
      categories.map((c) => ({ item: c, weight: c === lastCategory ? 0.3 : 1 }))
    );

    // 2) Minigioco nella categoria
    const lastId = history[history.length - 1]?.minigameId;
    const recentIds = new Set(history.slice(-3).map((h) => h.minigameId));
    const pool = all
      .filter((d) => d.category === category)
      .map((d) => {
        let w = RARITY_WEIGHT[d.rarity];
        if (d.id === lastId) w = 0;
        else if (recentIds.has(d.id)) w *= 0.3;
        return { item: d, weight: w };
      });
    const minigame = rng.weighted(pool);

    // 3) Modificatore
    let modifierId: string | null = null;
    if (minigame.compatibleModifiers.length > 0 && rng.chance(0.25)) {
      const mods = minigame.compatibleModifiers
        .map((id) => ModifierRegistry.byId(id))
        .filter((m): m is NonNullable<typeof m> => Boolean(m));
      if (mods.length > 0) {
        modifierId = rng.weighted(mods.map((m) => ({ item: m.id, weight: m.weight })));
      }
    }

    return { category, minigameId: minigame.id, modifierId };
  }
}
