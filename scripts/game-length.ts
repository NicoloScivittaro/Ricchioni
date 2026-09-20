/**
 * ANALISI DELLA DURATA DELLA PARTITA:  npx tsx scripts/game-length.ts
 *
 * Simula migliaia di partite con lo ScoreManager REALE (tabella punti + rubber-band) e stima i minuti totali
 * per numero di giocatori e punteggio obiettivo. Non modifica nulla: serve a decidere se target/punti producono
 * serate troppo corte o troppo lunghe. La durata di ogni minigioco è una STIMA (misurata nei playtest E2E).
 */
import { ScoreManager } from '../shared/scoring';
import { FLOW_TIMING } from '../shared/types';
import { MINIGAME_DEFINITIONS as MINIGAMES } from '../shared/minigames';

/** Durata media reale (secondi) di un minigioco, countdown e festeggiamenti compresi. */
const REAL_SEC: Record<string, number> = {
  quiz: 270,
  reaction: 90,
  memory: 150,
  arena: 75,
  dodgeball: 75,
  soccer: 100,
  volleyball: 180,
  kart3d: 180,
  cultura: 360,
  fps: 115
};

function overheadSec(players: number): number {
  const results = (FLOW_TIMING.revealStepMs * Math.max(0, players - 1) + FLOW_TIMING.revealWinnerDelayMs + FLOW_TIMING.revealFinalHoldMs + 300) / 1000;
  return (FLOW_TIMING.rouletteMs + FLOW_TIMING.introMs + FLOW_TIMING.finishedMs + FLOW_TIMING.leaderboardMs + FLOW_TIMING.nextRoundMs) / 1000 + results;
}

const enabled = MINIGAMES.filter((m) => m.enabled !== false);
const avgGame = enabled.reduce((s, m) => s + (REAL_SEC[m.id] ?? 120), 0) / enabled.length;

/** Numero pseudo-casuale riproducibile (mulberry32). */
function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Classifica casuale; `skill` > 0 favorisce i giocatori bravi (p0 il più forte) come in una serata reale. */
function ranking(n: number, rand: () => number, skill: number): number[] {
  const strength = Array.from({ length: n }, (_, i) => -i * skill + rand() * 2);
  return [...Array(n).keys()].sort((a, b) => strength[b] - strength[a]);
}

function simulate(players: number, target: number, skill: number, runs = 3000): { rounds: number[]; } {
  const rand = rng(players * 1000 + target + Math.round(skill * 100));
  const rounds: number[] = [];
  for (let r = 0; r < runs; r++) {
    const scores = new Map<string, number>(Array.from({ length: players }, (_, i) => [`p${i}`, 0] as [string, number]));
    let n = 0;
    while (n < 200) {
      n++;
      const order = ranking(players, rand, skill).map((i) => `p${i}`);
      const deltas = ScoreManager.awardRound(scores, order, target, false);
      for (const id of order) scores.set(id, (scores.get(id) ?? 0) + (deltas[id] ?? 0));
      if (Math.max(...scores.values()) >= target) break;
    }
    rounds.push(n);
  }
  return { rounds };
}

const pct = (a: number[], p: number): number => [...a].sort((x, y) => x - y)[Math.floor((a.length - 1) * p)];
const mean = (a: number[]): number => a.reduce((s, x) => s + x, 0) / a.length;

console.log(`Giochi abilitati: ${enabled.length} · durata media di un minigioco ≈ ${(avgGame / 60).toFixed(1)} min`);
console.log(`Tra un gioco e l'altro (rullo+intro+risultati+classifica) ≈ ${overheadSec(4).toFixed(0)}s`);
console.log('');
console.log('giocatori  target   round (10°/medio/90°)   minuti (10°/medio/90°)');
const TARGETS = [30, 40, 60, 80, 120, 150];
let tooShort = 0;
let tooLong = 0;
for (const players of [2, 3, 4, 5]) {
  for (const target of TARGETS) {
    const { rounds } = simulate(players, target, 0.35);
    const per = avgGame + overheadSec(players);
    const m = (r: number): string => ((r * per) / 60).toFixed(0).padStart(3);
    const lo = pct(rounds, 0.1);
    const md = mean(rounds);
    const hi = pct(rounds, 0.9);
    const minutes = (md * per) / 60;
    const flag = minutes < 12 ? '  ← corta' : minutes > 90 ? '  ← lunghissima' : '';
    if (minutes < 12) tooShort++;
    if (minutes > 90) tooLong++;
    console.log(
      `   ${players}        ${String(target).padStart(3)}     ${String(lo).padStart(2)} / ${md.toFixed(1).padStart(4)} / ${String(hi).padStart(2)}          ${m(lo)} / ${((md * per) / 60).toFixed(0).padStart(3)} / ${m(hi)}${flag}`
    );
  }
}
console.log('');
console.log(tooShort + tooLong === 0 ? 'Nessuna combinazione fuori scala (12–90 min).' : `Combinazioni corte: ${tooShort}, lunghissime: ${tooLong} (vedi sopra).`);
