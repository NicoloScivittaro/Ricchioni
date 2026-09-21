/**
 * BILANCIAMENTO ARMI FPS (senza browser):  npx tsx scripts/fps-balance.ts
 *
 * Per ogni arma stima, a varie distanze, la probabilita' che un colpo/pallino centri un bersaglio (larghezza 0.8m,
 * come l'hitbox dell'host) e il TEMPO PER UCCIDERE (TTK) un bersaglio da 100 HP, con un tiratore che tiene
 * il mirino centrato (precisione umana = "aim" 0..1: frazione dei colpi che parte davvero verso il bersaglio).
 * Monte Carlo con la stessa logica di dispersione dell'host (angolo uniforme nel cono `spread`).
 * Obiettivo di design: nessuna arma domina a tutte le distanze; ognuna ha la sua fascia.
 */
import { WEAPONS } from '../shared/fpsWeapons';
import type { WeaponConfig } from '../shared/fpsWeapons';

const HP = 100;
const HALF_W = 0.4; // mezza larghezza del bersaglio
const TRIALS = 4000;

function rand(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Gaussiana standard (Box-Muller). */
function gauss(r: () => number): number {
  return Math.sqrt(-2 * Math.log(Math.max(1e-9, r()))) * Math.cos(2 * Math.PI * r());
}

/**
 * Danno di UN colpo (tutti i pallini) a distanza d. L'errore di mira del giocatore (gaussiano, `sigma` radianti: su un
 * telefono ~0.02 = 1.1 gradi) e' condiviso dai pallini dello stesso colpo; la dispersione dell'arma e' uniforme nel cono.
 */
function shotDamage(w: WeaponConfig, d: number, sigma: number, r: () => number): number {
  if (d > w.range) return 0;
  const aimErr = gauss(r) * sigma;
  const pellets = w.pellets ?? 1;
  // bombarda: proiettile con splash (impatto diretto pieno; il raggio perdona la mira)
  if (w.splashRadius > 0) {
    // il proiettile ci mette d/velocita' secondi: nel frattempo il bersaglio si sposta (velocita' media 9 u/s, in movimento 70% del tempo)
    const flight = d / (w.projectileSpeed || 20);
    const drift = r() < 0.7 ? (r() - 0.5) * 2 * 9 * flight * 0.6 : 0;
    const off = Math.abs(Math.tan(aimErr + (r() - 0.5) * 2 * w.spread) * d + drift);
    const dist = Math.max(0, off - HALF_W);
    if (dist <= w.splashRadius) return w.damage * (dist <= 1 ? 1 : Math.max(0.3, 1 - (0.7 * (dist - 1)) / (w.splashRadius - 1)));
    return 0;
  }
  let dmg = 0;
  for (let i = 0; i < pellets; i++) {
    const off = Math.tan(aimErr + (r() - 0.5) * 2 * w.spread) * d;
    if (Math.abs(off) <= HALF_W) dmg += w.damage;
  }
  return dmg;
}

/** TTK medio (secondi) per uccidere il bersaglio. Include ricarica. */
function ttk(w: WeaponConfig, d: number, sigma: number, seed: number): { t: number; killProb: number } {
  const r = rand(seed);
  const burst = w.burst ?? 1;
  const gap = w.burstGap ?? 0.07;
  const cycle = burst / w.fireRate; // secondi per pressione del grilletto
  let total = 0;
  let kills = 0;
  for (let n = 0; n < TRIALS; n++) {
    let hp = HP;
    let t = 0;
    let mag = w.magazine;
    let guard = 0;
    while (hp > 0 && guard++ < 600) {
      for (let k = 0; k < burst && hp > 0; k++) {
        if (mag <= 0) {
          t += w.reload;
          mag = w.magazine;
        }
        mag--;
        hp -= shotDamage(w, d, sigma, r);
        if (k < burst - 1) t += gap;
      }
      if (hp > 0) t += cycle - (burst - 1) * gap;
    }
    if (hp <= 0) kills++;
    total += t;
  }
  return { t: total / TRIALS, killProb: kills / TRIALS };
}

const DIST = [3, 6, 10, 15, 22, 35];
const SIGMA = Number(process.env.SIGMA ?? 0.02); // errore di mira in radianti (0.02 = 1.1 gradi, telefono medio)
console.log(`TTK medio (s) per uccidere 100 HP · errore di mira ${(SIGMA * 57.3).toFixed(1)}° · distanze in metri`);
console.log('arma            ' + DIST.map((d) => String(d).padStart(6)).join(' ') + '   | DPS teorico');
const best: number[] = DIST.map(() => Infinity);
const rows: { id: string; v: number[] }[] = [];
for (const w of WEAPONS) {
  const v = DIST.map((d, i) => {
    if (d > w.range) return Infinity;
    const x = ttk(w, d, SIGMA, 1000 + i).t;
    best[i] = Math.min(best[i], x);
    return x;
  });
  rows.push({ id: w.id, v });
  const dps = w.damage * (w.pellets ?? 1) * w.fireRate;
  console.log(
    w.id.padEnd(16) + v.map((x) => (Number.isFinite(x) ? x.toFixed(2) : '  —').padStart(6)).join(' ') + `   | ${dps.toFixed(0)}`
  );
}
console.log('');
console.log('arma migliore per distanza: ' + DIST.map((d, i) => `${d}m=${rows.filter((r) => r.v[i] === best[i]).map((r) => r.id).join('/')}`).join('  '));
// controlli di design
const problems: string[] = [];
const wins = new Map<string, number>();
DIST.forEach((_, i) => rows.filter((r) => r.v[i] === best[i]).forEach((r) => wins.set(r.id, (wins.get(r.id) ?? 0) + 1)));
for (const [id, n] of wins) if (n >= 4) problems.push(`${id} e' la migliore su ${n}/${DIST.length} distanze (domina)`);
for (const r of rows) {
  // competitiva = a almeno una distanza (nel suo raggio) ha un TTK entro 1.35x del migliore
  const ok = r.v.some((x, i) => Number.isFinite(x) && x <= best[i] * 1.35);
  if (!ok) problems.push(`${r.id}: mai competitiva (TTK sempre > 1.35x il migliore alla stessa distanza)`);
}
console.log(problems.length ? 'ATTENZIONE:\n - ' + problems.join('\n - ') : 'Nessuna arma domina e nessuna e\' inutile alle distanze testate.');
