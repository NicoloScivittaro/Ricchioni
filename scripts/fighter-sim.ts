// BOTTE SUL CORNICIONE — SIMULAZIONI INDICATIVE con bot (npx tsx scripts/fighter-sim.ts [partite=40]).
// NON bilancia: cerca solo cose rotte — partite infinite, loop, recovery impossibile, abilita' palesemente fuori scala, stage
// troppo grande/piccolo, durate fuori obiettivo (90-150 s a 5 giocatori, ne' 20 s a 2). Abilita' ON vs OFF, 2-5 giocatori.
import { FighterWorld } from '../src/minigames/cornicione/fighterCore';
import { FighterBot } from '../src/minigames/cornicione/fighterBot';
import { Rng } from '../shared/rng';
import type { FighterInput } from '../src/minigames/cornicione/fighterTypes';

const CH = ['goblin', 'buttafuori', 'judoka', 'dottore', 'ciro'];
const GAMES = Number(process.argv[2] ?? 40);

interface Run {
  n: number;
  abil: boolean;
  dur: number;
  reason: string | null;
  kos: number;
  koPct: number[];
  rank: string[];
  recAtt: number;
  recOk: number;
  nan: boolean;
  maxCombo: number;
  stats: Record<string, { uses: number; ok: number; fail: number; wins: number }>;
}

function play(n: number, abil: boolean, seed: number, rotate: number): Run {
  const rng = new Rng(seed);
  const ids = Array.from({ length: n }, (_, i) => `p${i}`);
  const chars = ids.map((_, i) => CH[(i + rotate) % 5]);
  const w = new FighterWorld({ ids, characters: chars, rng: () => rng.next(), abilities: abil });
  const bots = ids.map((id, i) => new FighterBot(id, () => rng.next(), 0.5 + (i % 3) * 0.15));
  const dt = 1 / 60;
  let nan = false;
  let steps = 0;
  while (w.phase !== 'over' && steps < 60 * 400) {
    const inputs: Record<string, FighterInput> = {};
    bots.forEach((b) => (inputs[b.id] = b.input(w, dt)));
    w.step(dt, inputs);
    w.drainEvents();
    steps++;
    for (const f of w.fighters) if (!Number.isFinite(f.x) || !Number.isFinite(f.y) || !Number.isFinite(f.vx) || !Number.isFinite(f.vy)) nan = true;
  }
  const rank = w.ranking().map((f) => f.characterId);
  const stats: Run['stats'] = {};
  w.fighters.forEach((f) => {
    stats[f.characterId] = { uses: f.stats.abilityUses, ok: f.stats.abilitySuccess, fail: f.stats.abilityFail, wins: rank[0] === f.characterId ? 1 : 0 };
  });
  return {
    n,
    abil,
    dur: w.time,
    reason: w.endReason,
    kos: w.fighters.reduce((a, f) => a + f.stats.deaths, 0),
    koPct: w.fighters.flatMap((f) => f.stats.deathPercents),
    rank,
    recAtt: w.fighters.reduce((a, f) => a + f.stats.recoveryAttempts, 0),
    recOk: w.fighters.reduce((a, f) => a + f.stats.recoveriesOk, 0),
    nan,
    maxCombo: Math.max(...w.fighters.map((f) => f.stats.maxCombo)),
    stats
  };
}

const avg = (a: number[]): number => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
let problems = 0;
const bad = (m: string): void => {
  console.log('❌ ' + m);
  problems++;
};

for (const abil of [true, false]) {
  console.log(`\n=== Abilità ${abil ? 'ON' : 'OFF'} ===`);
  for (const n of [2, 3, 4, 5]) {
    const runs: Run[] = [];
    for (let g = 0; g < GAMES; g++) runs.push(play(n, abil, 1000 + g * 7 + n, g));
    const dur = runs.map((r) => r.dur);
    const timeouts = runs.filter((r) => r.reason === 'timeout' || r.reason === 'suddenDeath').length;
    const koPct = runs.flatMap((r) => r.koPct);
    console.log(
      `${n}p: durata media ${avg(dur).toFixed(0)}s (min ${Math.min(...dur).toFixed(0)}, max ${Math.max(...dur).toFixed(0)}) · scadenza ${timeouts}/${runs.length} · KO/partita ${avg(runs.map((r) => r.kos)).toFixed(1)} · % medio al KO ${avg(koPct).toFixed(0)} · rientri a partita ${avg(runs.map((r) => r.recOk)).toFixed(1)} (recovery attack ${avg(runs.map((r) => r.recAtt)).toFixed(1)}) · combo max ${Math.max(...runs.map((r) => r.maxCombo))}`
    );
    if (runs.some((r) => r.nan)) bad(`${n}p abil=${abil}: valori non finiti nella simulazione`);
    if (runs.some((r) => r.reason === null)) bad(`${n}p abil=${abil}: partita non terminata entro il limite (loop infinito?)`);
    if (n === 2 && avg(dur) < 20) bad(`2p: partite troppo corte (${avg(dur).toFixed(0)} s)`);
    if (n === 5 && avg(dur) > 160) bad(`5p: partite troppo lunghe (${avg(dur).toFixed(0)} s)`);
    if (abil && n === 5) {
      const agg: Record<string, { uses: number; ok: number; fail: number; wins: number; n: number }> = {};
      for (const r of runs) for (const [c, s] of Object.entries(r.stats)) {
        const a = (agg[c] ??= { uses: 0, ok: 0, fail: 0, wins: 0, n: 0 });
        a.uses += s.uses;
        a.ok += s.ok;
        a.fail += s.fail;
        a.wins += s.wins;
        a.n++;
      }
      for (const [c, a] of Object.entries(agg)) {
        console.log(`   ${c.padEnd(11)} usi/partita ${(a.uses / a.n).toFixed(2)} · riusciti ${a.ok} · falliti ${a.fail} · vittorie ${a.wins}/${a.n}`);
        if (a.wins / a.n > 0.45) bad(`${c}: vince il ${Math.round((100 * a.wins) / a.n)}% delle partite a 5 (abilita' dominante?)`);
      }
    }
  }
}
console.log(problems ? `\n❌ ${problems} problemi` : '\n✅ nessun problema evidente (indicativo: i bot non sono giocatori)');
process.exit(problems ? 1 : 0);
