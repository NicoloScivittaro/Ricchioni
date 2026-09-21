/**
 * RULLO — simulazione di 100.000 estrazioni per ogni numero di giocatori (2..5) con la STESSA storia che usa il server, confrontando
 * il modello senza pity ("prima") con quello attuale con pity ("dopo"). Non modifica nulla: e' una statistica di debug.
 *   npx tsx scripts/roulette-sim.ts                DRAWS=20000 npx tsx scripts/roulette-sim.ts
 *   STEPS='[[0,1],[4,1.3],[7,1.8]]' npx tsx scripts/roulette-sim.ts    (prova soglie diverse: [da, moltiplicatore])
 * Report per ogni gioco: frequenza, intervallo medio fra due apparizioni, gap massimo, quante "serate" da 12 round lo vedono
 * almeno una volta; poi violazioni di ripetizione, incompatibilita', distribuzione per categoria, modificatori.
 */
import { RouletteEngine, PITY_STEPS } from '../shared/roulette';
import type { RouletteHistoryEntry, PityStep } from '../shared/roulette';
import { MINIGAME_DEFINITIONS } from '../shared/minigames';
import { Rng } from '../shared/rng';

const DRAWS = Number(process.env.DRAWS ?? 100000);
const EVENING = 12; // una serata "normale": 12 round
const steps: PityStep[] = process.env.STEPS ? (JSON.parse(process.env.STEPS) as [number, number][]).map(([from, mult]) => ({ from, mult })) : PITY_STEPS;
let fails = 0;
const check = (c: boolean, m: string): void => {
  console.log(`  ${c ? '✅' : '❌'} ${m}`);
  if (!c) fails++;
};
const pct = (n: number, d = 1): string => `${((n / d) * 100).toFixed(1)}%`.padStart(6);

interface Stats {
  share: Map<string, number>;
  avgGap: Map<string, number>;
  maxGap: Map<string, number>;
  evening: Map<string, number>;
  cats: Map<string, number>;
  sameGameTwice: number;
  incompatible: number;
  withModifier: number;
}

function run(playerCount: number, pity: boolean): Stats {
  const eligible = MINIGAME_DEFINITIONS.filter((d) => d.enabled !== false && playerCount >= d.minPlayers && playerCount <= d.maxPlayers);
  const rng = new Rng(1000 + playerCount);
  // il server azzera la storia a ogni nuova partita: simulo partite lunghe 60 round, cosi' il pity riparte da capo come nel gioco reale
  const MATCH = 60;
  let history: RouletteHistoryEntry[] = [];
  const count = new Map<string, number>();
  const last = new Map<string, number>();
  const maxGap = new Map<string, number>();
  const evening = new Map<string, number>();
  const cats = new Map<string, number>();
  let seenInEvening = new Set<string>();
  let sameGameTwice = 0;
  let incompatible = 0;
  let withModifier = 0;
  for (let i = 0; i < DRAWS; i++) {
    if (i % MATCH === 0) {
      history = [];
      last.clear(); // i gap si misurano dentro la partita: a ogni nuova partita la storia (e il pity) riparte da zero
      for (const d of eligible) last.set(d.id, i - 1);
    }
    const pick = RouletteEngine.pick(playerCount, history, rng, { pity, pitySteps: steps });
    const def = MINIGAME_DEFINITIONS.find((d) => d.id === pick.minigameId);
    if (!def || !eligible.some((d) => d.id === def.id)) incompatible++;
    if (history.length && history[history.length - 1].minigameId === pick.minigameId) sameGameTwice++;
    if (pick.modifierId) withModifier++;
    count.set(pick.minigameId, (count.get(pick.minigameId) ?? 0) + 1);
    cats.set(pick.category, (cats.get(pick.category) ?? 0) + 1);
    const gap = i - (last.get(pick.minigameId) ?? -1);
    maxGap.set(pick.minigameId, Math.max(maxGap.get(pick.minigameId) ?? 0, gap));
    last.set(pick.minigameId, i);
    seenInEvening.add(pick.minigameId);
    if ((i + 1) % EVENING === 0) {
      for (const id of seenInEvening) evening.set(id, (evening.get(id) ?? 0) + 1);
      seenInEvening = new Set();
    }
    history.push({ round: history.length + 1, minigameId: pick.minigameId, category: pick.category });
  }
  const avgGap = new Map<string, number>();
  for (const d of eligible) avgGap.set(d.id, DRAWS / Math.max(1, count.get(d.id) ?? 0));
  const share = new Map<string, number>();
  for (const [k, v] of count) share.set(k, v / DRAWS);
  const ev = new Map<string, number>();
  for (const [k, v] of evening) ev.set(k, v / Math.floor(DRAWS / EVENING));
  return { share, avgGap, maxGap, evening: ev, cats, sameGameTwice, incompatible, withModifier };
}

console.log(`Pity attivo: ${steps.map((s) => `da ${s.from} round x${s.mult}`).join(' · ')}`);
for (const playerCount of [2, 3, 4, 5]) {
  const eligible = MINIGAME_DEFINITIONS.filter((d) => d.enabled !== false && playerCount >= d.minPlayers && playerCount <= d.maxPlayers);
  const before = run(playerCount, false);
  const after = run(playerCount, true);
  console.log(`\n=== ${playerCount} GIOCATORI — ${DRAWS} estrazioni, ${eligible.length} giochi compatibili ===`);
  console.log('  gioco       categoria  rarita\'   | PRIMA: quota  ogni  gap max  serata | DOPO: quota  ogni  gap max  serata');
  for (const d of [...eligible].sort((a, b) => (after.share.get(b.id) ?? 0) - (after.share.get(a.id) ?? 0))) {
    const row = (s: Stats): string =>
      `${pct(s.share.get(d.id) ?? 0)} ${(s.avgGap.get(d.id) ?? 0).toFixed(1).padStart(5)} ${String(s.maxGap.get(d.id) ?? 0).padStart(7)}  ${pct(s.evening.get(d.id) ?? 0, 1).padStart(6)}`;
    console.log(`  ${d.id.padEnd(11)} ${d.category.padEnd(9)}  ${d.rarity.padEnd(8)} |        ${row(before)} |        ${row(after)}`);
  }
  const catLine = (s: Stats): string => [...s.cats.entries()].sort().map(([c, n]) => `${c} ${pct(n, DRAWS).trim()}`).join(' · ');
  console.log(`  categorie PRIMA: ${catLine(before)}`);
  console.log(`  categorie DOPO : ${catLine(after)}`);
  check(after.incompatible === 0 && before.incompatible === 0, `nessuna estrazione incompatibile col numero di giocatori (${after.incompatible})`);
  check(after.sameGameTwice === 0, `anti-ripetizione: mai lo stesso gioco due volte di fila (violazioni ${after.sameGameTwice})`);
  const minShare = Math.min(...eligible.map((d) => after.share.get(d.id) ?? 0));
  const maxShare = Math.max(...eligible.map((d) => after.share.get(d.id) ?? 0));
  check(minShare >= 0.05, `nessun gioco normale sotto il 5%: il piu' raro esce nel ${(minShare * 100).toFixed(1)}% (prima ${(Math.min(...eligible.map((d) => before.share.get(d.id) ?? 0)) * 100).toFixed(1)}%)`);
  check(maxShare <= 0.2, `nessun gioco oltre il 20%: il piu' frequente ${(maxShare * 100).toFixed(1)}%`);
  const worstGap = Math.max(...eligible.map((d) => after.maxGap.get(d.id) ?? 0));
  check(worstGap <= 55, `gap massimo osservato ${worstGap} round (prima ${Math.max(...eligible.map((d) => before.maxGap.get(d.id) ?? 0))})`);
  const worstEvening = Math.min(...eligible.map((d) => after.evening.get(d.id) ?? 0));
  check(worstEvening >= 0.5, `in una serata da ${EVENING} round ogni gioco compare almeno una volta nel >=50% dei casi (minimo ${(worstEvening * 100).toFixed(0)}%)`);
  check(after.withModifier / DRAWS > 0.15 && after.withModifier / DRAWS < 0.3, `modificatori ~25% (${pct(after.withModifier, DRAWS).trim()})`);
}
console.log(fails ? `\n${fails} controlli FALLITI\n` : '\nTutto ok\n');
process.exit(fails ? 1 : 0);
