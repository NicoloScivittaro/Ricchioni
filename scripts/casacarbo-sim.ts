// CASA CARBO — SIMULAZIONI INDICATIVE con bot (npx tsx scripts/casacarbo-sim.ts [partite=20]).
// Non bilancia: cerca cose rotte e da' l'ordine di grandezza. Per ogni numero di giocatori (2-5), abilita' ON/OFF e una partita
// "nessuno pulisce": % di casa asciutta a fine partita, quante volte la casa e' salva (>=75%), acqua entrata/tolta, contributi,
// valori non finiti, conservazione dell'acqua (entrata = tolta + per terra + nei secchi + rovesciata fuori + trattenuta).
import { CasaCarboWorld } from '../src/minigames/casaCarbo/waterCore';
import { CCBot, botRoles } from '../src/minigames/casaCarbo/ccBot';
import { contribution, drainedOf } from '../src/minigames/casaCarbo/scoring';
import { Rng } from '../shared/rng';
import type { CCInput } from '../src/minigames/casaCarbo/ccTypes';

const CH = ['goblin', 'buttafuori', 'dottore', 'judoka', 'ciro'];
const GAMES = Number(process.argv[2] ?? 20);
let problems = 0;
const bad = (m: string): void => {
  console.log('❌ ' + m);
  problems++;
};
const avg = (a: number[]): number => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

interface Run {
  dry: number;
  saved: boolean;
  inflow: number;
  drained: number;
  passive: number;
  leak: number;
  nan: boolean;
  contrib: number[];
  byChar: Record<string, { c: number; uses: number; ok: number; fail: number; win: number }>;
}

function play(n: number, abil: boolean, idle: boolean, seed: number, rotate: number): Run {
  const rng = new Rng(seed);
  const ids = Array.from({ length: n }, (_, i) => `p${i}`);
  const chars = ids.map((_, i) => CH[(i + rotate) % 5]);
  const w = new CasaCarboWorld({ ids, characters: chars, rng: () => rng.next(), abilities: abil });
  const roles = botRoles(n);
  const bots = ids.map((id, i) => new CCBot(id, () => rng.next(), roles[i]));
  const dt = 1 / 30;
  let nan = false;
  while (!w.over) {
    const inputs: Record<string, CCInput> = {};
    if (!idle) bots.forEach((b) => (inputs[b.id] = b.input(w, dt)));
    w.step(dt, inputs);
    w.drainEvents();
    if (w.players.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))) nan = true;
  }
  const floor = w.waterOnFloor();
  const leak = w.inflowTotal - (w.drainedCredited + w.drainedPassive + floor + w.waterInBuckets() + w.spilledOutside);
  const rank = w.ranking();
  const byChar: Run['byChar'] = {};
  for (const p of w.players) byChar[p.characterId] = { c: contribution(p.stats), uses: p.stats.abilityUses, ok: p.stats.abilitySuccess, fail: p.stats.abilityFail, win: rank[0] === p ? 1 : 0 };
  if (!Number.isFinite(floor)) nan = true;
  const dry = w.dryFraction();
  return { dry, saved: dry >= 0.75, inflow: w.inflowTotal, drained: w.players.reduce((a, p) => a + drainedOf(p.stats), 0), passive: w.drainedPassive, leak, nan, contrib: w.players.map((p) => contribution(p.stats)), byChar };
}

for (const mode of ['ON', 'OFF', 'IDLE'] as const) {
  console.log(`\n=== ${mode === 'IDLE' ? 'nessuno pulisce' : `bot · abilità ${mode}`} ===`);
  for (const n of [2, 3, 4, 5]) {
    const runs: Run[] = [];
    const G = mode === 'IDLE' ? Math.min(4, GAMES) : GAMES;
    for (let g = 0; g < G; g++) runs.push(play(n, mode !== 'OFF', mode === 'IDLE', 500 + g * 13 + n, g));
    console.log(
      `${n}p: asciutta ${(100 * avg(runs.map((r) => r.dry))).toFixed(0)}% (min ${(100 * Math.min(...runs.map((r) => r.dry))).toFixed(0)}, max ${(100 * Math.max(...runs.map((r) => r.dry))).toFixed(0)}) · salvata ${runs.filter((r) => r.saved).length}/${runs.length} · entrata ${avg(runs.map((r) => r.inflow)).toFixed(0)} · tolta (punti) ${avg(runs.map((r) => r.drained)).toFixed(0)} + passiva ${avg(runs.map((r) => r.passive)).toFixed(0)} · contributo medio ${avg(runs.flatMap((r) => r.contrib)).toFixed(1)}`
    );
    if (runs.some((r) => r.nan)) bad(`${n}p ${mode}: valori non finiti`);
    const worstLeak = Math.max(...runs.map((r) => Math.abs(r.leak)));
    if (worstLeak > 1e-2) bad(`${n}p ${mode}: l'acqua non si conserva (scarto ${worstLeak.toFixed(4)})`);
    if (mode === 'IDLE' && runs.some((r) => r.saved)) bad(`${n}p: la casa si salva anche se nessuno pulisce`);
    if (mode === 'ON' && n === 5) {
      const agg: Record<string, { c: number; uses: number; ok: number; fail: number; win: number; k: number }> = {};
      for (const r of runs) for (const [c, s] of Object.entries(r.byChar)) {
        const a = (agg[c] ??= { c: 0, uses: 0, ok: 0, fail: 0, win: 0, k: 0 });
        a.c += s.c;
        a.uses += s.uses;
        a.ok += s.ok;
        a.fail += s.fail;
        a.win += s.win;
        a.k++;
      }
      for (const [c, a] of Object.entries(agg)) console.log(`   ${c.padEnd(11)} contributo ${(a.c / a.k).toFixed(1)} · usi ${(a.uses / a.k).toFixed(1)} · riusciti ${a.ok} · falliti ${a.fail} · primo ${a.win}/${a.k}`);
    }
  }
}
console.log(problems ? `\n❌ ${problems} problemi` : '\n✅ nessun problema evidente (indicativo: i bot non sono giocatori)');
process.exit(problems ? 1 : 0);
