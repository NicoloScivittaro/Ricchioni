/**
 * TEST STATISTICO del mescolamento delle risposte del Quiz (regressione: nel database la risposta giusta sta quasi sempre in B/C).
 * Estrae >= 100.000 domande con il vero selectQuizQuestions / rerollQuestion e misura in che posizione (A/B/C/D) finisce la risposta giusta.
 *   npx tsx scripts/quiz-shuffle-stat.ts            (SELECTIONS=100000 per cambiare, seed casuale se non e' impostato SEED)
 *
 * Esce con 1 se: la giusta non e' ~uniforme (ogni posizione 25% +-1 punto sul totale e chi-quadro ok), la risposta giusta cambia
 * testo dopo il mescolamento, o una domanda non ha mai variato posizione. Le domande a risposte numeriche sono mostrate a parte
 * (erano l'unico punto sbilanciato: prima restavano in ordine crescente e la giusta finiva in C il 64% delle volte).
 */
import { Rng } from '../shared/rng';
import { QUESTIONS } from '../src/minigames/quiz/questions';
import { rerollQuestion, resetQuizHistory, selectQuizQuestions } from '../src/minigames/quiz/selection';

const SELECTIONS = Number(process.env.SELECTIONS ?? 100000);
const seed = process.env.SEED ? Number(process.env.SEED) : Math.floor(Math.random() * 0xffffffff);
const rng = new Rng(seed);
const isNumeric = (answers: readonly string[]): boolean => answers.every((a) => /^[\d.,\s%°-]+$/.test(a.trim()));
const truth = new Map(QUESTIONS.map((q) => [q.id, q.answers[q.correctAnswerIndex]]));

const all = [0, 0, 0, 0];
const shuffled = [0, 0, 0, 0]; // solo domande mescolabili (non numeriche)
const numeric = [0, 0, 0, 0];
const perDifficulty: number[][] = Array.from({ length: 11 }, () => [0, 0, 0, 0]);
const perQuestion = new Map<string, number[]>();
let total = 0;
let corrupted = 0;

const record = (q: (typeof QUESTIONS)[number]): void => {
  const idx = q.correctAnswerIndex;
  if (q.answers[idx] !== truth.get(q.id)) corrupted++;
  all[idx]++;
  (isNumeric(q.answers) ? numeric : shuffled)[idx]++;
  perDifficulty[q.difficulty][idx]++;
  const pq = perQuestion.get(q.id) ?? [0, 0, 0, 0];
  pq[idx]++;
  perQuestion.set(q.id, pq);
  total++;
};

let games = 0;
while (total < SELECTIONS) {
  if (games % 20 === 0) resetQuizHistory(); // come sessioni indipendenti
  const qs = selectQuizQuestions(rng);
  qs.forEach(record);
  games++;
  // il Goblin NCULO! pesca una sostitutiva: una ogni 5 partite
  if (games % 5 === 0) record(rerollQuestion(rng, rng.int(1, 10), qs.map((q) => q.id)));
}

const pct = (a: number[]): string => {
  const n = a.reduce((x, y) => x + y, 0) || 1;
  return a.map((v, i) => `${'ABCD'[i]} ${((v / n) * 100).toFixed(1)}%`).join('  ');
};
console.log(`seed ${seed} · ${total} domande estratte in ${games} partite · ${perQuestion.size}/${QUESTIONS.length} domande del pool viste`);
console.log(`TUTTE                  ${pct(all)}   (n=${total})`);
console.log(`non numeriche         ${pct(shuffled)}   (n=${shuffled.reduce((x, y) => x + y, 0)})`);
console.log(`solo numeriche        ${pct(numeric)}   (n=${numeric.reduce((x, y) => x + y, 0)})`);
for (let d = 1; d <= 10; d++) console.log(`  difficolta' ${String(d).padStart(2)}     ${pct(perDifficulty[d])}`);

let fails = 0;
const check = (c: boolean, m: string): void => {
  console.log(`${c ? '✅' : '❌'} ${m}`);
  if (!c) fails++;
};
const worst = Math.max(...all.map((v) => Math.abs(v / total - 0.25))) * 100;
check(total >= 100000, `almeno 100.000 estrazioni (${total})`);
check(worst <= 1, `posizione della giusta ~uniforme sul totale: scarto massimo dal 25% = ${worst.toFixed(2)} punti (soglia 1)`);
const numN = numeric.reduce((x, y) => x + y, 0);
check(numN === 0 || Math.max(...numeric.map((v) => Math.abs(v / numN - 0.25))) * 100 <= 3, `anche le domande numeriche sono uniformi (n=${numN}, scarto massimo ${(numN ? Math.max(...numeric.map((v) => Math.abs(v / numN - 0.25))) * 100 : 0).toFixed(2)} punti, soglia 3)`);
const shufN = shuffled.reduce((x, y) => x + y, 0);
const worstShuf = Math.max(...shuffled.map((v) => Math.abs(v / shufN - 0.25))) * 100;
check(worstShuf <= 1, `sulle domande non numeriche lo scarto massimo e' ${worstShuf.toFixed(2)} punti (soglia 1)`);
// chi-quadro sul totale (3 gradi di liberta': 11.34 = p 0.01)
const chi = all.reduce((a, v) => a + (v - total / 4) ** 2 / (total / 4), 0);
check(chi < 11.34, `chi-quadro sul totale (3 gdl) = ${chi.toFixed(2)} < 11.34 (p>0.01)`);
check(corrupted === 0, `la risposta giusta mantiene il suo testo dopo il mescolamento (${corrupted} errori)`);
const stuck = [...perQuestion].filter(([id, a]) => a.reduce((x, y) => x + y, 0) >= 40 && a.filter((v) => v > 0).length < 4);
check(stuck.length === 0, `nessuna domanda resta bloccata su meno di 4 posizioni ${stuck.length ? '(' + stuck.map(([id]) => id).join(',') + ')' : ''}`);
process.exitCode = fails ? 1 : 0;
