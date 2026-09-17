import type { Rng } from '../../../shared/rng';
import { QUESTIONS } from './questions';
import type { QuizQuestion } from './questions';

const HISTORY_LIMIT = 30; // ~3 partite di 10 domande: evita che il pool si esaurisca in sessioni lunghe

/**
 * Storia delle domande recentemente giocate. Modulo-livello: vive quanto la
 * pagina dell'host (persiste tra un round di quiz e il successivo nella
 * stessa partita), che è esattamente il comportamento voluto.
 */
let recentIds: string[] = [];

function markUsed(ids: string[]): void {
  recentIds.push(...ids);
  if (recentIds.length > HISTORY_LIMIT) recentIds = recentIds.slice(-HISTORY_LIMIT);
}

/**
 * Sceglie ESATTAMENTE 10 domande, una per ciascuna difficoltà 1..10, dal pool
 * di QUESTIONS. Preferisce domande non giocate di recente e cerca di variare
 * le categorie tra domande consecutive (evita che due difficoltà adiacenti
 * abbiano la stessa categoria, quando esiste un'alternativa).
 */
export function selectQuizQuestions(rng: Rng): QuizQuestion[] {
  const selected: QuizQuestion[] = [];
  const recentSet = new Set(recentIds);

  for (let difficulty = 1; difficulty <= 10; difficulty++) {
    const pool = QUESTIONS.filter((q) => q.difficulty === difficulty);
    if (pool.length === 0) continue; // non dovrebbe mai succedere con il database attuale

    const prevCategory = selected.length > 0 ? selected[selected.length - 1].category : null;

    // Preferenza in ordine: (a) non recente + categoria diversa dalla precedente,
    // (b) non recente, (c) qualsiasi cosa nel pool (fallback se il pool è piccolo).
    const notRecent = pool.filter((q) => !recentSet.has(q.id));
    const notRecentDifferentCategory = notRecent.filter((q) => q.category !== prevCategory);

    const candidates = notRecentDifferentCategory.length > 0 ? notRecentDifferentCategory : notRecent.length > 0 ? notRecent : pool;

    selected.push(rng.pick(candidates));
  }

  markUsed(selected.map((q) => q.id));
  return selected;
}

/** Solo per i test/script manuali: azzera la storia recente. */
export function resetQuizHistory(): void {
  recentIds = [];
}
