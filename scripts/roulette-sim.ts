/**
 * RULLO — simulazione di 10.000 estrazioni per ogni numero di giocatori (2..5), con la STESSA storia che usa il server:
 * verifica che nessun gioco sia impossibile, che non ci siano sbilanciamenti non voluti, che l'anti-ripetizione funzioni e che
 * ogni estrazione sia compatibile col numero di giocatori. NON modifica nulla: e' una statistica di debug.
 *   npx tsx scripts/roulette-sim.ts            (10.000 estrazioni)      DRAWS=50000 npx tsx scripts/roulette-sim.ts
 */
import { RouletteEngine } from '../shared/roulette';
import type { RouletteHistoryEntry } from '../shared/roulette';
import { MINIGAME_DEFINITIONS } from '../shared/minigames';
import { RARITY_WEIGHT } from '../shared/types';
import { Rng } from '../shared/rng';

const DRAWS = Number(process.env.DRAWS ?? 10000);
let fails = 0;
const check = (c: boolean, m: string): void => {
  console.log(`  ${c ? '✅' : '❌'} ${m}`);
  if (!c) fails++;
};
const pct = (n: number, d: number): string => `${((n / d) * 100).toFixed(1)}%`.padStart(6);

for (const playerCount of [2, 3, 4, 5]) {
  const eligible = MINIGAME_DEFINITIONS.filter((d) => d.enabled !== false && playerCount >= d.minPlayers && playerCount <= d.maxPlayers);
  const rng = new Rng(1000 + playerCount);
  const history: RouletteHistoryEntry[] = [];
  const count = new Map<string, number>();
  let sameGameTwice = 0;
  let sameCategoryTwice = 0;
  let repeatWithin3 = 0;
  let incompatible = 0;
  let withModifier = 0;
  const lastSeen = new Map<string, number>();
  const maxGap = new Map<string, number>();
  for (let i = 0; i < DRAWS; i++) {
    const pick = RouletteEngine.pick(playerCount, history, rng);
    const def = MINIGAME_DEFINITIONS.find((d) => d.id === pick.minigameId);
    if (!def || !eligible.some((d) => d.id === def.id)) incompatible++;
    const prev = history[history.length - 1];
    if (prev && prev.minigameId === pick.minigameId) sameGameTwice++;
    if (prev && prev.category === pick.category) sameCategoryTwice++;
    if (history.slice(-3).some((h) => h.minigameId === pick.minigameId)) repeatWithin3++;
    if (pick.modifierId) withModifier++;
    count.set(pick.minigameId, (count.get(pick.minigameId) ?? 0) + 1);
    const gap = i - (lastSeen.get(pick.minigameId) ?? -1);
    maxGap.set(pick.minigameId, Math.max(maxGap.get(pick.minigameId) ?? 0, gap));
    lastSeen.set(pick.minigameId, i);
    history.push({ round: i + 1, minigameId: pick.minigameId, category: pick.category });
  }

  // Quota attesa dal modello "una categoria uguale per tutte, poi rarita' dentro la categoria" (senza anti-ripetizione)
  const cats = [...new Set(eligible.map((d) => d.category))];
  const expected = new Map<string, number>();
  for (const c of cats) {
    const inCat = eligible.filter((d) => d.category === c);
    const tot = inCat.reduce((s, d) => s + RARITY_WEIGHT[d.rarity], 0);
    for (const d of inCat) expected.set(d.id, (1 / cats.length) * (RARITY_WEIGHT[d.rarity] / tot));
  }

  console.log(`\n=== ${playerCount} GIOCATORI — ${DRAWS} estrazioni, ${eligible.length} giochi compatibili ===`);
  console.log('  gioco        categoria  rarita\'   quota   attesa  scarto  attesa max senza uscire');
  for (const d of [...eligible].sort((a, b) => (count.get(b.id) ?? 0) - (count.get(a.id) ?? 0))) {
    const n = count.get(d.id) ?? 0;
    const exp = expected.get(d.id) ?? 0;
    const dev = exp > 0 ? (n / DRAWS - exp) / exp : 0;
    console.log(
      `  ${d.id.padEnd(11)}  ${d.category.padEnd(9)}  ${d.rarity.padEnd(8)}  ${pct(n, DRAWS)}  ${pct(exp * DRAWS, DRAWS)}  ${(dev >= 0 ? '+' : '') + (dev * 100).toFixed(0) + '%'}`.padEnd(70) + `${maxGap.get(d.id) ?? '-'} round`
    );
  }
  check(incompatible === 0, `nessuna estrazione incompatibile col numero di giocatori (${incompatible})`);
  check(sameGameTwice === 0, `anti-ripetizione: mai lo stesso gioco due volte di fila (${sameGameTwice})`);
  const shareMin = Math.min(...eligible.map((d) => (count.get(d.id) ?? 0) / DRAWS));
  check(shareMin > 0.01, `nessun gioco "impossibile": il piu' raro esce nel ${(shareMin * 100).toFixed(1)}% dei casi`);
  const worstDev = Math.max(...eligible.map((d) => Math.abs(((count.get(d.id) ?? 0) / DRAWS - (expected.get(d.id) ?? 0)) / (expected.get(d.id) ?? 1))));
  check(worstDev < 0.4, `le quote seguono il modello (categoria uniforme x rarita'): scarto massimo ${(worstDev * 100).toFixed(0)}% (anti-ripetizione inclusa)`);
  const rate3 = repeatWithin3 / DRAWS;
  console.log(`  info: stessa categoria di fila ${pct(sameCategoryTwice, DRAWS)} · ritorno di un gioco entro 3 estrazioni ${pct(repeatWithin3, DRAWS)} · modificatore ${pct(withModifier, DRAWS)}`);
  check(withModifier / DRAWS > 0.15 && withModifier / DRAWS < 0.3, `modificatori ~25% (${pct(withModifier, DRAWS).trim()})`);
  void rate3;
  const rarest = [...eligible].sort((a, b) => (count.get(a.id) ?? 0) - (count.get(b.id) ?? 0))[0];
  const most = [...eligible].sort((a, b) => (count.get(b.id) ?? 0) - (count.get(a.id) ?? 0))[0];
  console.log(`  info: piu' frequente ${most.id} ${pct(count.get(most.id) ?? 0, DRAWS).trim()}, piu' raro ${rarest.id} ${pct(count.get(rarest.id) ?? 0, DRAWS).trim()} (rapporto ${((count.get(most.id) ?? 1) / Math.max(1, count.get(rarest.id) ?? 1)).toFixed(1)}x)`);
}
console.log(fails ? `\n${fails} controlli FALLITI\n` : '\nTutto ok\n');
process.exit(fails ? 1 : 0);
