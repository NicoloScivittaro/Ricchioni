import { MINIGAME_DEFINITIONS } from './minigames';
import { getModifier } from './modifiers';
import { RARITY_WEIGHT } from './types';
import type { Category, MinigameDefinition } from './types';
import type { Rng } from './rng';

export interface RouletteHistoryEntry {
  round: number;
  minigameId: string;
  category: Category;
}

export interface RoulettePick {
  category: Category;
  minigameId: string;
  modifierId: string | null;
}

/**
 * Selezione del rullo (server-authoritative):
 * - filtra i giochi incompatibili con il numero di giocatori (minPlayers/maxPlayers)
 * - categoria pesata con anti-ripetizione
 * - minigioco pesato per rarità + anti-ripetizione
 * - modificatore opzionale (~25%) tra quelli compatibili
 */
export class RouletteEngine {
  static pick(playerCount: number, history: RouletteHistoryEntry[], rng: Rng): RoulettePick {
    const all = MINIGAME_DEFINITIONS.filter(
      (d) => playerCount >= d.minPlayers && playerCount <= d.maxPlayers
    );
    if (all.length === 0) throw new Error('Nessun minigioco compatibile con questo numero di giocatori');

    const lastCategory = history[history.length - 1]?.category;
    const categories = [...new Set(all.map((d) => d.category))];
    const category = rng.weighted(
      categories.map((c) => ({ item: c, weight: c === lastCategory ? 0.3 : 1 }))
    );

    const lastId = history[history.length - 1]?.minigameId;
    const recentIds = new Set(history.slice(-3).map((h) => h.minigameId));
    const weightOf = (d: MinigameDefinition): number => {
      let w = RARITY_WEIGHT[d.rarity];
      if (d.id === lastId) w = 0;
      else if (recentIds.has(d.id)) w *= 0.3;
      return w;
    };

    // Minigiochi della categoria, escludendo quelli a peso 0.
    let pool = all
      .filter((d) => d.category === category)
      .map((d) => ({ item: d, weight: weightOf(d) }))
      .filter((x) => x.weight > 0);

    // Se la categoria aveva solo il gioco appena uscito, ripiega su TUTTI i giochi (mai l'ultimo).
    if (pool.length === 0) {
      pool = all
        .map((d) => ({ item: d, weight: weightOf(d) }))
        .filter((x) => x.weight > 0);
    }
    const minigame = pool.length > 0 ? rng.weighted(pool) : rng.pick(all);

    let modifierId: string | null = null;
    if (minigame.compatibleModifiers.length > 0 && rng.chance(0.25)) {
      const mods = minigame.compatibleModifiers
        .map((id) => getModifier(id))
        .filter((m): m is NonNullable<typeof m> => Boolean(m));
      if (mods.length > 0) {
        modifierId = rng.weighted(mods.map((m) => ({ item: m.id, weight: m.weight })));
      }
    }

    return { category: minigame.category, minigameId: minigame.id, modifierId };
  }
}
