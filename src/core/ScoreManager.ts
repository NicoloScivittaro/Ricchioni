import type { PlayerId } from './types';

/**
 * Converte la classifica di un round in punti.
 * Tabella base dinamica per numero di giocatori + rubber-band per la rimonta:
 * chi è sotto al leader di ≥15 punti riceve ×1.5 (arrotondato).
 */
export class ScoreManager {
  static baseTable(playerCount: number): number[] {
    switch (playerCount) {
      case 2:
        return [10, 4];
      case 3:
        return [10, 7, 4];
      case 4:
        return [10, 7, 5, 3];
      default:
        return [10, 7, 5, 3, 1];
    }
  }

  static awardRound(
    scores: Map<PlayerId, number>,
    ranking: PlayerId[],
    double = false
  ): Record<PlayerId, number> {
    const table = this.baseTable(ranking.length);
    const leader = Math.max(0, ...scores.values());
    const deltas: Record<PlayerId, number> = {};

    ranking.forEach((pid, idx) => {
      let pts = table[idx] ?? 1;
      if (double) pts *= 2;
      const current = scores.get(pid) ?? 0;
      if (leader - current >= 15) pts = Math.round(pts * 1.5);
      deltas[pid] = pts;
    });

    return deltas;
  }
}
