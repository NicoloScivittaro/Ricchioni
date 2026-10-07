import type { Rng } from '../../../shared/rng';
import { CULTURA_QUESTIONS } from '../../../shared/culturaQuestions';
import type { CulturaQuestion } from '../../../shared/culturaQuestions';

/**
 * ESTRAZIONE DELLE DOMANDE DI CULTURA O CAZZATA. Prima il pool veniva preso in ordine (senza mescolare): ogni partita
 * giocava quasi sempre le stesse 8 domande. Ora: pool mescolato con l'rng della partita, domande giocate di recente in
 * fondo, e categorie tutte diverse dentro la stessa partita finché ce ne sono (altrimenti almeno diversa dalla precedente).
 */
const HISTORY_LIMIT = 80; // ~10 partite da 8 round: con ~160 domande restano sempre ~80 domande "fresche"

/** Modulo-livello come nel Quiz: vive quanto la pagina dell'host, quindi copre tutta la serata. */
let recentIds: string[] = [];

export function selectCulturaQuestions(rng: Rng, count: number, pool: readonly CulturaQuestion[] = CULTURA_QUESTIONS): CulturaQuestion[] {
  const recent = new Set(recentIds);
  const fresh = rng.shuffle(pool.filter((q) => !recent.has(q.id)));
  const stale = rng.shuffle(pool.filter((q) => recent.has(q.id)));
  const left = [...fresh, ...stale];
  const picked: CulturaQuestion[] = [];
  const usedCats = new Set<string>();
  while (picked.length < count && left.length > 0) {
    const prev = picked.length > 0 ? picked[picked.length - 1].category : '';
    const isFresh = (q: CulturaQuestion): boolean => !recent.has(q.id);
    // Preferenze in ordine: fresca + categoria nuova, fresca + diversa dalla precedente, fresca, poi le stesse regole fra le recenti.
    const rules: ((q: CulturaQuestion) => boolean)[] = [
      (q) => isFresh(q) && !usedCats.has(q.category),
      (q) => isFresh(q) && q.category !== prev,
      (q) => isFresh(q),
      (q) => !usedCats.has(q.category),
      (q) => q.category !== prev
    ];
    let idx = -1;
    for (const rule of rules) {
      idx = left.findIndex(rule);
      if (idx >= 0) break;
    }
    if (idx < 0) idx = 0;
    const q = left.splice(idx, 1)[0];
    usedCats.add(q.category);
    picked.push(q);
  }
  recentIds.push(...picked.map((q) => q.id));
  if (recentIds.length > HISTORY_LIMIT) recentIds = recentIds.slice(-HISTORY_LIMIT);
  return picked;
}

/** Solo per i test/script: azzera la storia recente. */
export function resetCulturaHistory(): void {
  recentIds = [];
}
