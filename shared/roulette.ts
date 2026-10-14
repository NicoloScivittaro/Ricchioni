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
 * PITY WEIGHT: piu' round passano senza che un gioco esca, piu' cresce il suo peso; appena esce torna normale.
 * `since` = round giocati dopo l'ultima volta in cui e' uscito (0 = e' uscito nell'ultimo round; mai uscito = tutti i round giocati).
 * Le soglie sono ordinate: vale l'ultima con `since >= da`. Valori scelti con scripts/roulette-sim.ts (100.000 estrazioni).
 */
export interface PityStep {
  from: number;
  mult: number;
}
export const PITY_STEPS: PityStep[] = [
  { from: 0, mult: 1 },
  { from: 3, mult: 1.3 },
  { from: 5, mult: 2 },
  { from: 7, mult: 3.5 },
  { from: 9, mult: 6 },
  { from: 11, mult: 10 }
];

export function pityMultiplier(since: number, steps: readonly PityStep[] = PITY_STEPS): number {
  let m = 1;
  for (const st of steps) if (since >= st.from) m = st.mult;
  return m;
}

export interface RouletteOptions {
  /** false = nessun pity (solo per confronto nelle simulazioni). Default: attivo. */
  pity?: boolean;
  pitySteps?: readonly PityStep[];
}

/**
 * Selezione del rullo (server-authoritative):
 * - filtra i giochi incompatibili con il numero di giocatori (minPlayers/maxPlayers)
 * - nessun gioco ritorna prima che siano usciti tutti gli altri compatibili
 * - categoria pesata con anti-ripetizione (+ pity: una categoria con un gioco "in ritardo" pesa di piu')
 * - minigioco pesato per rarità + anti-ripetizione + pity
 * - modificatore opzionale (~25%) tra quelli compatibili
 */
export class RouletteEngine {
  /**
   * Prima uscita: scegli fra i giochi mai visti. Dopo il giro completo, il
   * prossimo è quello la cui ultima uscita è più lontana: tutti gli altri
   * sono passati da allora. Non rimescolare a fine giro, altrimenti un gioco
   * in fondo al primo giro potrebbe riapparire subito all'inizio del secondo.
   * Storia della stanza come unica fonte: reset partita = nuovo giro casuale.
   */
  static available(playerCount: number, history: readonly RouletteHistoryEntry[]): MinigameDefinition[] {
    const all = MINIGAME_DEFINITIONS.filter(
      d => d.enabled !== false && playerCount >= d.minPlayers && playerCount <= d.maxPlayers
    );
    const byId = new Map(all.map(d => [d.id, d]));
    const seen = new Set<string>();
    for (let i = history.length - 1; i >= 0; i--) {
      const id = history[i].minigameId;
      if (!byId.has(id) || seen.has(id)) continue;
      seen.add(id);
      if (seen.size === all.length) return [byId.get(id)!];
    }
    return all.filter(d => !seen.has(d.id));
  }

  static pick(playerCount: number, history: RouletteHistoryEntry[], rng: Rng, opts: RouletteOptions = {}): RoulettePick {
    const all = this.available(playerCount, history);
    if (all.length === 0) throw new Error('Nessun minigioco compatibile con questo numero di giocatori');

    const usePity = opts.pity !== false;
    const steps = opts.pitySteps ?? PITY_STEPS;
    const pityOf = (id: string): number => {
      if (!usePity) return 1;
      let idx = -1;
      for (let i = history.length - 1; i >= 0; i--) {
        if (history[i].minigameId === id) {
          idx = i;
          break;
        }
      }
      return pityMultiplier(idx < 0 ? history.length : history.length - 1 - idx, steps);
    };

    const lastCategory = history[history.length - 1]?.category;
    const categories = [...new Set(all.map((d) => d.category))];
    const category = rng.weighted(
      categories.map((c) => {
        const inCat = all.filter((d) => d.category === c);
        // la categoria pesa quanto il suo gioco piu' "in ritardo"; l'anti-ripetizione di categoria resta
        const pity = Math.max(...inCat.map((d) => pityOf(d.id)));
        return { item: c, weight: (c === lastCategory ? 0.3 : 1) * pity };
      })
    );

    const weightOf = (d: MinigameDefinition): number => {
      return RARITY_WEIGHT[d.rarity] * pityOf(d.id);
    };

    // Categoria e pesi agiscono solo sui giochi che rispettano il giro completo.
    const pool = all
      .filter((d) => d.category === category)
      .map((d) => ({ item: d, weight: weightOf(d) }))
      .filter((x) => x.weight > 0);

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
