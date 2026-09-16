import type { PlayerId } from './types';

/**
 * Punteggio dinamico per numero di giocatori.
 * - 2: 10 / 5
 * - 3: 10 / 6 / 3
 * - 4: 10 / 7 / 4 / 2
 * - 5: 10 / 7 / 5 / 3 / 1
 * + rubber-band: chi è sotto al leader di ≥25% del target riceve ×1.5.
 * + modificatore "punti doppi".
 */
export class ScoreManager {
  static baseTable(playerCount: number): number[] {
    switch (playerCount) {
      case 2:
        return [10, 5];
      case 3:
        return [10, 6, 3];
      case 4:
        return [10, 7, 4, 2];
      default:
        return [10, 7, 5, 3, 1];
    }
  }

  static awardRound(
    scores: Map<PlayerId, number>,
    ranking: PlayerId[],
    targetScore: number,
    double = false
  ): Record<PlayerId, number> {
    const table = this.baseTable(ranking.length);
    const leader = Math.max(0, ...scores.values());
    const catchupGap = Math.max(10, Math.round(targetScore * 0.25));
    const deltas: Record<PlayerId, number> = {};

    ranking.forEach((pid, idx) => {
      let pts = table[idx] ?? 1;
      if (double) pts *= 2;
      const current = scores.get(pid) ?? 0;
      if (leader - current >= catchupGap) pts = Math.round(pts * 1.5);
      deltas[pid] = pts;
    });

    return deltas;
  }
}
