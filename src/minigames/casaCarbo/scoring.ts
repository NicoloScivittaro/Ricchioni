import { CC } from './ccTuning';
import type { CCStats } from './ccTypes';

/**
 * CASA CARBO — CONTRIBUTO PERSONALE (punti interni del minigioco: NON sono i punti partita, quelli li da' lo ScoreManager in base
 * alla posizione). Valori iniziali per il playtest:
 *   +1  per ogni unita' d'acqua che lascia DAVVERO la casa da uno scarico (secchio, tiracqua o abilita')
 *   +0,5 per ogni unita' fermata alla porta, con un tetto per giocatore
 *   +6  TV messa in salvo · +4 scarico intasato liberato
 *    0  acqua solo spostata fra stanze · acqua raccolta e poi rovesciata
 */
export function drainedOf(s: CCStats): number {
  return s.drainedBucket + s.drainedSqueegee + s.drainedAbility;
}

export function stoppedPoints(s: CCStats): number {
  return Math.min(CC.stopCap, s.stopped * CC.stopPoints);
}

export function contribution(s: CCStats): number {
  return s.emergencyBonus + drainedOf(s) + stoppedPoints(s) + s.tvSaved * CC.points.tv + s.unclogged * CC.points.unclog;
}

export interface CCTitleInput {
  id: string;
  stats: CCStats;
}

/**
 * TITOLI COMICI di fine partita (non cambiano i punti). Ognuno va a UN giocatore; un titolo si assegna solo se c'e' qualcosa da
 * premiare (nessun "IL BAGNINO" se nessuno ha fermato acqua). PRESENTE MA INUTILE va all'ultimo per contributo (con almeno 3 giocatori).
 */
export function titles(list: CCTitleInput[]): Map<string, string> {
  const out = new Map<string, string>();
  if (!list.length) return out;
  const best = (fn: (s: CCStats) => number, min = 0.5): CCTitleInput | null => {
    let b: CCTitleInput | null = null;
    for (const p of list) if (fn(p.stats) >= min && (!b || fn(p.stats) > fn(b.stats))) b = p;
    return b;
  };
  const give = (p: CCTitleInput | null, t: string): void => {
    if (p && !out.has(p.id)) out.set(p.id, t);
  };
  give(best(contribution), "L'UNICO CHE HA LAVORATO");
  give(best((s) => s.drainedBucket), "IL SECCHIO D'ORO");
  give(best((s) => s.drainedSqueegee), 'MO ASCIUGO IO');
  give(best((s) => s.stopped), 'IL BAGNINO');
  give(best((s) => s.spilled), 'DANNO COLLATERALE');
  if (list.length >= 3) {
    const worst = [...list].sort((a, b) => contribution(a.stats) - contribution(b.stats))[0];
    give(worst, 'PRESENTE MA INUTILE');
  }
  return out;
}
