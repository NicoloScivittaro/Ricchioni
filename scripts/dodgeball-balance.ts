/**
 * DODGEBALL — audit di bilanciamento (analitico + Monte Carlo): "un tiro forte deve essere PERICOLOSO ma non impossibile da schivare".
 * Modello: attaccante e difensore in posizioni casuali del campo; il tiro parte dritto verso il difensore (mira perfetta, nessun anticipo).
 * Il difensore reagisce dopo `reazione` (visione + pollice + rete) e usa SCHIVA (invulnerabilita' DODGE_INVULN) con il tempismo giusto:
 * ce la fa se l'impatto arriva DOPO la sua reazione. Il tiro e' quindi "non reagibile" sotto una distanza critica.
 *   npx tsx scripts/dodgeball-balance.ts
 */
import { ARENA_HALF_W, ARENA_HALF_D, PLAYER_RADIUS, BALL_RADIUS, THROW_SPEED, DODGE_INVULN, DODGE_COOLDOWN, MAX_SPEED, ACCEL } from '../src/minigames/dodgeball/dodgeballTypes';

const HIT_R = PLAYER_RADIUS + BALL_RADIUS;
const ttl = (d: number): number => Math.max(0, d - HIT_R) / THROW_SPEED; // tempo di volo fino al contatto
const N = 200000;

console.log(`\nDODGEBALL — palla ${THROW_SPEED} u/s, corpo+palla ${HIT_R}, corsa ${MAX_SPEED} u/s (accel ${ACCEL}), schivata invuln ${DODGE_INVULN}s / cooldown ${DODGE_COOLDOWN}s\n`);
console.log('distanza  tempo di volo | difendersi a piedi (lateral 1.5u)  | con SCHIVA (reazione 0.30s)');
for (const d of [4, 6, 8, 10, 12, 14, 18, 24]) {
  const t = ttl(d);
  // spostamento laterale a piedi dopo la reazione (0.30 s): accelera da fermo
  const run = Math.max(0, t - 0.3);
  const lat = run < MAX_SPEED / ACCEL ? 0.5 * ACCEL * run * run : (MAX_SPEED * MAX_SPEED) / (2 * ACCEL) + MAX_SPEED * (run - MAX_SPEED / ACCEL);
  const dash = t >= 0.3 ? 'SI (timing)' : 'no';
  console.log(`${String(d).padStart(6)}u  ${t.toFixed(2)}s        | ${lat >= HIT_R ? 'SI' : 'no'}  (${lat.toFixed(2)}u)                      | ${dash}`);
}
console.log(`\ndistanza critica di reazione (0.30 s): ${(THROW_SPEED * 0.3 + HIT_R).toFixed(1)} u — sotto, il tiro non e' reagibile: si schiva solo leggendo la posizione di chi tira (la direzione = verso dove corre).\n`);

let seed = 12345;
const rnd = (): number => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
for (const react of [0.22, 0.3, 0.4, 0.55]) {
  let hits = 0;
  let close = 0;
  for (let i = 0; i < N; i++) {
    const ax = (rnd() * 2 - 1) * (ARENA_HALF_W - PLAYER_RADIUS), az = (rnd() * 2 - 1) * (ARENA_HALF_D - PLAYER_RADIUS);
    const bx = (rnd() * 2 - 1) * (ARENA_HALF_W - PLAYER_RADIUS), bz = (rnd() * 2 - 1) * (ARENA_HALF_D - PLAYER_RADIUS);
    const d = Math.hypot(ax - bx, az - bz);
    if (d < 3) continue;
    if (d < THROW_SPEED * react + HIT_R) hits++;
    if (d < 8) close++;
  }
  console.log(`reazione ${react.toFixed(2)}s: tiri "non reagibili" ${((hits / N) * 100).toFixed(0)}% (a bruciapelo <8u: ${((close / N) * 100).toFixed(0)}%) — il resto e' schivabile con SCHIVA pronta`);
}
console.log('\nLettura: campo 28x18 -> molti scambi sono a media distanza. Con reazione tipica (~0.3 s) circa 1 tiro su 3 e\' inevitabile, il resto si schiva.');
console.log('Il cooldown della schivata (1 s) impedisce di essere invulnerabili di continuo: due palle ravvicinate restano il modo di eliminare.\n');
