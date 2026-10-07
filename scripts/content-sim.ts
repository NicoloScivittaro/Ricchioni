/**
 * SIMULAZIONE DEI CONTENUTI — pesca le domande con le funzioni vere del gioco, senza browser.
 *   npx tsx scripts/content-sim.ts            (QUIZ_GAMES=100000 CULTURA_SESSIONS=10000 SEED=... per cambiare)
 *
 * QUIZ (selectQuizQuestions + rerollQuestion del Goblin): ogni partita ha 10 domande, una per difficolta' 1-10, nessuna
 *   undefined, 4 risposte, giusta che conserva il testo dopo il mescolamento, nessun doppione nella stessa partita (anche
 *   dopo il reroll), A/B/C/D ~25%, tutte le domande del pool estratte, nessuna ripetizione fra partite vicine.
 * CULTURA (selectCulturaQuestions): 8 round senza doppioni, categorie diverse, niente ripetizioni fra partite vicine.
 *   La fase bluff e' rifatta qui IDENTICA a CulturaScene.endBluff (stessa normalizzazione, stessi decoy, stesso riempimento
 *   fino a 5 opzioni) con 2-5 giocatori che a caso non scrivono, copiano un altro o scrivono la risposta vera: controlla che
 *   ogni giocatore abbia un bluff, che non serva mai il ripiego "<risposta> (ma sbagliato)" e che le opzioni siano valide
 *   (una sola vera, nessun doppione nemmeno a parte maiuscole/minuscole).
 */
import { Rng } from '../shared/rng';
import { QUESTIONS } from '../src/minigames/quiz/questions';
import { rerollQuestion, resetQuizHistory, selectQuizQuestions } from '../src/minigames/quiz/selection';
import { CULTURA_QUESTIONS } from '../shared/culturaQuestions';
import type { CulturaQuestion } from '../shared/culturaQuestions';
import { resetCulturaHistory, selectCulturaQuestions } from '../src/minigames/cultura/selection';

const QUIZ_GAMES = Number(process.env.QUIZ_GAMES ?? 100000);
const CULTURA_SESSIONS = Number(process.env.CULTURA_SESSIONS ?? 10000);
const seed = process.env.SEED ? Number(process.env.SEED) : Math.floor(Math.random() * 0xffffffff);
const rng = new Rng(seed);

let fails = 0;
const check = (ok: boolean, msg: string): void => {
  console.log(`${ok ? '✅' : '❌'} ${msg}`);
  if (!ok) fails++;
};
const pct = (n: number, tot: number): string => `${((n / Math.max(1, tot)) * 100).toFixed(2)}%`;

// =============================== QUIZ ===============================
{
  const truth = new Map(QUESTIONS.map((q) => [q.id, q.answers[q.correctAnswerIndex]]));
  const seen = new Map<string, number>();
  const pos = [0, 0, 0, 0];
  let broken = 0;
  let wrongShape = 0;
  let dupInGame = 0;
  let dupAfterReroll = 0;
  let sameCatConsecutive = 0;
  let repeatNextGame = 0;
  let total = 0;
  let prevIds = new Set<string>();
  const t0 = Date.now();
  for (let g = 0; g < QUIZ_GAMES; g++) {
    if (g % 25 === 0) {
      resetQuizHistory(); // una "serata" ogni 25 partite
      prevIds = new Set();
    }
    const qs = selectQuizQuestions(rng);
    const diffs = qs.map((q) => q?.difficulty).join(',');
    if (qs.length !== 10 || diffs !== '1,2,3,4,5,6,7,8,9,10') wrongShape++;
    for (const q of qs) {
      if (!q || !q.answers || q.answers.length !== 4 || q.answers.some((a) => typeof a !== 'string' || !a) || q.answers[q.correctAnswerIndex] === undefined) broken++;
      else if (q.answers[q.correctAnswerIndex] !== truth.get(q.id)) broken++;
      else pos[q.correctAnswerIndex]++;
      seen.set(q.id, (seen.get(q.id) ?? 0) + 1);
      total++;
    }
    const ids = qs.map((q) => q.id);
    if (new Set(ids).size !== ids.length) dupInGame++;
    for (let i = 1; i < qs.length; i++) if (qs[i].category === qs[i - 1].category) sameCatConsecutive++;
    if (ids.some((id) => prevIds.has(id))) repeatNextGame++;
    prevIds = new Set(ids);
    // Goblin NCULO!: una domanda su dieci viene rifiutata e sostituita (una volta ogni 4 partite)
    if (g % 4 === 0) {
      const slot = rng.int(0, 9);
      const r = rerollQuestion(rng, qs[slot].difficulty, ids);
      if (!r || r.difficulty !== qs[slot].difficulty || ids.includes(r.id) || r.answers[r.correctAnswerIndex] !== truth.get(r.id)) dupAfterReroll++;
    }
  }
  const ms = Date.now() - t0;
  console.log(`\nQUIZ — ${QUIZ_GAMES} partite, ${total} domande estratte in ${ms} ms (seed ${seed})`);
  console.log(`   posizione della giusta A/B/C/D: ${pos.map((n) => pct(n, total)).join(' / ')}`);
  const counts = [...seen.values()];
  console.log(`   domande del pool viste: ${seen.size}/${QUESTIONS.length} · estrazioni per domanda min ${Math.min(...counts)} max ${Math.max(...counts)}`);
  check(QUIZ_GAMES >= 100000, `almeno 100.000 partite simulate (${QUIZ_GAMES})`);
  check(wrongShape === 0, `ogni partita ha 10 domande, una per difficolta' 1-10 (${wrongShape} partite sbagliate)`);
  check(broken === 0, `nessuna domanda undefined / senza 4 risposte / con la giusta cambiata (${broken})`);
  check(dupInGame === 0, `nessun doppione nella stessa partita (${dupInGame})`);
  check(dupAfterReroll === 0, `il reroll del Goblin non crea doppioni e resta della stessa difficolta' (${dupAfterReroll})`);
  check(seen.size === QUESTIONS.length, `tutte le ${QUESTIONS.length} domande escono almeno una volta`);
  check(repeatNextGame === 0, `nessuna domanda si ripete nella partita successiva della stessa serata (${repeatNextGame})`);
  const worst = Math.max(...pos.map((n) => Math.abs(n / total - 0.25))) * 100;
  check(worst <= 1, `A/B/C/D ~25%: scarto massimo ${worst.toFixed(2)} punti (soglia 1)`);
  console.log(`   info: due domande consecutive della stessa categoria ${sameCatConsecutive} volte su ${QUIZ_GAMES * 9} coppie (${pct(sameCatConsecutive, QUIZ_GAMES * 9)})`);
}

// =============================== CULTURA ===============================
// Copia fedele di CulturaScene.normalize / isSame / endBluff (fase bluff -> opzioni). Se cambia la scena, va aggiornata qui.
const normalize = (s: string): string => s.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.?!]+$/g, '').trim();
const isSame = (a: string, b: string): boolean => normalize(a) === normalize(b);
interface Opt {
  text: string;
  ownerId: string | null;
  isCorrect: boolean;
}
function endBluff(q: CulturaQuestion, players: string[], typed: Map<string, string>, r: Rng): { bluffs: Map<string, string>; options: Opt[]; usedFallback: number } {
  const bluffs = new Map<string, string>();
  const used = new Set<string>();
  const decoys = [...q.fallbackDecoys];
  let usedFallback = 0;
  for (const p of players) {
    let text = normalize(typed.get(p) ?? '');
    const isCorrect = text.length > 0 && isSame(text, q.correctAnswer);
    if (text.length === 0 || used.has(text) || isCorrect) {
      const d = decoys.shift();
      if (d === undefined) usedFallback++;
      text = d ?? `${q.correctAnswer} (ma sbagliato)`;
      while (used.has(normalize(text)) && decoys.length > 0) text = decoys.shift()!;
    }
    used.add(normalize(text));
    bluffs.set(p, text);
  }
  const options: Opt[] = [];
  for (const p of players) options.push({ text: bluffs.get(p)!, ownerId: p, isCorrect: false });
  options.push({ text: q.correctAnswer, ownerId: null, isCorrect: true });
  let di = 0;
  while (options.length < 5 && di < q.fallbackDecoys.length) {
    const d = q.fallbackDecoys[di++];
    if (!options.some((o) => isSame(o.text, d))) options.push({ text: d, ownerId: null, isCorrect: false });
  }
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(r.next() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return { bluffs, options, usedFallback };
}

{
  const ROUNDS = 8;
  const INVENTED = ['La nonna', 'Un piccione', 'Nel 1492', 'Il martedì grasso', 'Uno spazzolino', 'Trentasette', 'Il Molise', 'Una zattera', 'Il pinguino imperatore', 'Un cucchiaio di legno'];
  let wrongCount = 0;
  let dupInSession = 0;
  let catRepeatInSession = 0;
  let sameCatConsecutive = 0;
  let repeatNextSession = 0;
  let fallbackUsed = 0;
  let missingBluff = 0;
  let badOptions = 0;
  let caseDupOptions = 0;
  let caseTell = 0;
  let rounds = 0;
  const playersHist = [0, 0, 0, 0, 0, 0];
  const seen = new Map<string, number>();
  let prevIds = new Set<string>();
  const t0 = Date.now();
  for (let s = 0; s < CULTURA_SESSIONS; s++) {
    if (s % 10 === 0) {
      resetCulturaHistory(); // una "serata" ogni 10 partite
      prevIds = new Set();
    }
    const qs = selectCulturaQuestions(rng, ROUNDS);
    if (qs.length !== ROUNDS || qs.some((q) => !q)) wrongCount++;
    const ids = qs.map((q) => q.id);
    if (new Set(ids).size !== ids.length) dupInSession++;
    if (new Set(qs.map((q) => q.category)).size !== qs.length) catRepeatInSession++;
    for (let i = 1; i < qs.length; i++) if (qs[i].category === qs[i - 1].category) sameCatConsecutive++;
    if (ids.some((id) => prevIds.has(id))) repeatNextSession++;
    prevIds = new Set(ids);
    const nPlayers = rng.int(2, 5);
    playersHist[nPlayers]++;
    const players = Array.from({ length: nPlayers }, (_, i) => `p${i}`);
    for (const q of qs) {
      seen.set(q.id, (seen.get(q.id) ?? 0) + 1);
      rounds++;
      // comportamento dei giocatori: vuoto 25%, copia un altro 10%, scrive la risposta vera 5%, scrive un decoy 10% (maiuscole a caso), inventa il resto
      const typed = new Map<string, string>();
      for (const p of players) {
        const x = rng.next();
        const others = [...typed.values()].filter(Boolean);
        if (x < 0.25) typed.set(p, '');
        else if (x < 0.35 && others.length) typed.set(p, rng.pick(others));
        else if (x < 0.4) typed.set(p, rng.chance(0.5) ? q.correctAnswer : q.correctAnswer.toUpperCase() + '!');
        else if (x < 0.5) typed.set(p, rng.chance(0.5) ? rng.pick(q.fallbackDecoys) : rng.pick(q.fallbackDecoys).toLowerCase());
        else typed.set(p, `${rng.pick(INVENTED)} ${rng.int(1, 999)}`);
      }
      const { bluffs, options, usedFallback } = endBluff(q, players, typed, rng);
      fallbackUsed += usedFallback;
      if (players.some((p) => !bluffs.get(p)?.trim())) missingBluff++;
      const correct = options.filter((o) => o.isCorrect);
      const texts = options.map((o) => o.text);
      if (correct.length !== 1 || options.length < 5 || new Set(texts).size !== texts.length || options.some((o) => !o.isCorrect && isSame(o.text, q.correctAnswer))) badOptions++;
      if (new Set(texts.map(normalize)).size !== texts.length) caseDupOptions++;
      // il telefono mostra il testo cosi' com'e': la vera e' l'unica opzione con una maiuscola?
      const hasUpper = (t: string): boolean => t !== t.toLowerCase();
      const c0 = correct[0];
      if (c0 && hasUpper(c0.text) && options.filter((o) => hasUpper(o.text)).length === 1) caseTell++;
    }
  }
  const ms = Date.now() - t0;
  console.log(`\nCULTURA — ${CULTURA_SESSIONS} partite da ${ROUNDS} round (${rounds} round) in ${ms} ms · giocatori 2/3/4/5: ${playersHist.slice(2).join(' / ')}`);
  const counts = [...seen.values()];
  console.log(`   domande del pool viste: ${seen.size}/${CULTURA_QUESTIONS.length} · uscite per domanda min ${Math.min(...counts)} max ${Math.max(...counts)}`);
  check(CULTURA_SESSIONS >= 10000, `almeno 10.000 partite simulate (${CULTURA_SESSIONS})`);
  check(wrongCount === 0, `ogni partita ha 8 domande valide (${wrongCount})`);
  check(dupInSession === 0, `nessuna domanda ripetuta nella stessa partita (${dupInSession})`);
  check(catRepeatInSession === 0, `8 categorie diverse in ogni partita (${catRepeatInSession} partite con una categoria ripetuta)`);
  check(sameCatConsecutive === 0, `mai due round consecutivi della stessa categoria (${sameCatConsecutive})`);
  check(repeatNextSession === 0, `nessuna domanda si ripete nella partita successiva della stessa serata (${repeatNextSession})`);
  check(seen.size === CULTURA_QUESTIONS.length, `tutte le ${CULTURA_QUESTIONS.length} domande escono almeno una volta`);
  check(missingBluff === 0, `ogni giocatore ha sempre un bluff da mostrare (${missingBluff} round senza)`);
  check(fallbackUsed === 0, `mai il ripiego "<risposta> (ma sbagliato)": i 5 decoy bastano anche con 5 giocatori senza bluff (${fallbackUsed})`);
  check(badOptions === 0, `opzioni valide: una sola vera, almeno 5, nessun testo doppio, nessun falso uguale alla vera (${badOptions} round)`);
  check(caseDupOptions === 0, `mai due opzioni uguali a parte maiuscole/minuscole, anche se un giocatore riscrive un decoy (${caseDupOptions} round)`);
  console.log(`   info: a testo grezzo la vera sarebbe l'unica opzione con una maiuscola in ${caseTell} round su ${rounds} (${pct(caseTell, rounds)}; con tutti i giocatori che bluffano e' sempre cosi'): per questo TV e telefono mostrano le opzioni in MAIUSCOLO`);
}

console.log(fails ? `\n❌ ${fails} controlli falliti` : '\n✅ simulazione ok');
process.exitCode = fails ? 1 : 0;
