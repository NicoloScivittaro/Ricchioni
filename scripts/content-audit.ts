/**
 * AUDIT DEI CONTENUTI (Quiz + Cultura) — cerca SOSPETTI e ERRORI STRUTTURALI, non la verita' dei fatti (impossibile da automatizzare).
 * Complementare a validate-content.ts: quello controlla la forma di ogni record, questo guarda il pool nel suo insieme.
 *   npx tsx scripts/content-audit.ts          (exit 1 solo se ci sono ERRORI; i SOSPETTI vanno riletti da una persona)
 *
 * Controlli:
 *  ERRORI   id/testi duplicati · risposte identiche nella stessa domanda · decoy uguale alla risposta vera · spiegazione mancante
 *  SOSPETTI domande quasi uguali (anche fra Quiz e Cultura) · stessa risposta giusta ripetuta · risposta giusta scritta nella domanda ·
 *           risposta giusta sempre la piu' lunga / posizione sbilanciata (si indovina senza sapere) · risposte "tutte/nessuna" ·
 *           risposta giusta con forma diversa dai decoy (unica numerica, unica con maiuscola, unica con parentesi...) ·
 *           set di decoy riusati · spiegazione troppo corta · parole a rischio "obsolescenza" (attuale, record, oggi) ·
 *           categorie troppo concentrate (per pool e per difficolta').
 */
import { QUESTIONS } from '../src/minigames/quiz/questions';
import { CULTURA_QUESTIONS } from '../shared/culturaQuestions';

const errors: string[] = [];
const suspects: string[] = [];
const E = (m: string): void => void errors.push(m);
const S = (m: string): void => void suspects.push(m);

const norm = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const STOP = new Set(['il', 'lo', 'la', 'le', 'gli', 'i', 'un', 'uno', 'una', 'di', 'del', 'della', 'dei', 'delle', 'da', 'in', 'a', 'e', 'che', 'quale', 'quali', 'come', 'quanti', 'quante', 'qual', 'chi', 'cosa', 'per', 'con', 'su', 'nel', 'nella', 'e', 'o', 'si', 'e', 'era', 'sono', 'ha', 'hanno', 'piu', 'anno', 'nome']);
const tokens = (s: string): Set<string> => new Set(norm(s).split(' ').filter((t) => t.length > 2 && !STOP.has(t)));
function jaccard(a: Set<string>, b: Set<string>): number {
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter || 1);
}

interface Item {
  pool: 'quiz' | 'cultura';
  id: string;
  q: string;
  correct: string;
  decoys: string[];
  cat: string;
  diff: number;
  explanation: string;
  answersOrder?: string[];
  correctIndex?: number;
}
const items: Item[] = [
  ...QUESTIONS.map<Item>((q) => ({
    pool: 'quiz',
    id: q.id,
    q: q.question,
    correct: q.answers[q.correctAnswerIndex],
    decoys: q.answers.filter((_, i) => i !== q.correctAnswerIndex),
    cat: q.category,
    diff: q.difficulty,
    explanation: q.explanation,
    answersOrder: [...q.answers],
    correctIndex: q.correctAnswerIndex
  })),
  ...CULTURA_QUESTIONS.map<Item>((q) => ({ pool: 'cultura', id: q.id, q: q.question, correct: q.correctAnswer, decoys: q.fallbackDecoys, cat: q.category, diff: q.difficulty, explanation: q.explanation }))
];
const W = (it: Item): string => `${it.pool} ${it.id}`;

// ---- ERRORI STRUTTURALI ----
for (const pool of ['quiz', 'cultura'] as const) {
  const seen = new Set<string>();
  for (const it of items.filter((i) => i.pool === pool)) {
    if (seen.has(it.id)) E(`${W(it)}: id duplicato`);
    seen.add(it.id);
  }
}
const seenText = new Map<string, Item>();
for (const it of items) {
  const k = norm(it.q);
  const prev = seenText.get(k);
  if (prev && prev.pool === it.pool) E(`${W(it)}: stessa domanda di ${W(prev)} ("${it.q}")`);
  else if (prev) S(`stessa domanda in due giochi diversi: ${W(prev)} e ${W(it)} ("${it.q}") — puo' capitare in due round della stessa serata`);
  else seenText.set(k, it);
  const all = [it.correct, ...it.decoys].map(norm);
  if (new Set(all).size !== all.length) E(`${W(it)}: risposte/decoy identici fra loro ${JSON.stringify([it.correct, ...it.decoys])}`);
  if (!it.explanation || !it.explanation.trim()) E(`${W(it)}: spiegazione mancante`);
}

// ---- DOMANDE QUASI UGUALI ----
const tk = items.map((i) => tokens(i.q));
for (let a = 0; a < items.length; a++) {
  for (let b = a + 1; b < items.length; b++) {
    if (tk[a].size < 3 || tk[b].size < 3) continue;
    const j = jaccard(tk[a], tk[b]);
    const sameAnswer = norm(items[a].correct) === norm(items[b].correct);
    if (j >= 0.75 || (j >= 0.55 && sameAnswer)) {
      S(`domande quasi uguali (${(j * 100).toFixed(0)}%${sameAnswer ? ', stessa risposta' : ''}): ${W(items[a])} "${items[a].q}"  ~  ${W(items[b])} "${items[b].q}"`);
    }
  }
}

// ---- STESSA RISPOSTA GIUSTA RIPETUTA ----
const byCorrect = new Map<string, Item[]>();
for (const it of items) {
  const k = norm(it.correct);
  if (k.length < 3) continue;
  byCorrect.set(k, [...(byCorrect.get(k) ?? []), it]);
}
for (const [k, list] of byCorrect) {
  if (list.length >= 3 || (list.length === 2 && list[0].pool === list[1].pool && k.split(' ').length >= 2)) {
    S(`risposta giusta ripetuta ${list.length} volte "${list[0].correct}": ${list.map(W).join(', ')}`);
  }
}

// ---- RISPOSTA RIVELATA / TELL ----
let quizN = 0;
let longest = 0;
const posCount = [0, 0, 0, 0];
for (const it of items) {
  const nc = norm(it.correct);
  const nq = norm(it.q);
  if (nc.length >= 5 && nq.includes(nc)) S(`${W(it)}: la risposta giusta "${it.correct}" compare nella domanda "${it.q}"`);
  const all = [it.correct, ...it.decoys.slice(0, 3)];
  if (all.some((a) => /\b(tutte|tutti|nessuna|nessuno|nessun)\b.*\b(precedent|sopra|elencat|risposte)/i.test(a) || /^(tutte|tutti|nessuna) /i.test(a))) S(`${W(it)}: risposta "tutte/nessuna" fra le opzioni`);
  // forma diversa: unica numerica / unica con parentesi / unica con maiuscola interna
  const isNum = (s: string): boolean => /^[\d.,\s%°-]+$/.test(s.trim());
  const nums = all.map(isNum);
  if (nums[0] && nums.slice(1).some((n) => !n)) S(`${W(it)}: la giusta "${it.correct}" e' numerica ma alcuni decoy no (${JSON.stringify(it.decoys)})`);
  if (!nums[0] && nums.slice(1).some((n) => n) && nums.slice(1).every((n) => n)) S(`${W(it)}: i decoy sono tutti numerici e la giusta no`);
  const paren = all.map((a) => /[()]/.test(a));
  if (paren[0] && !paren.slice(1).some(Boolean)) S(`${W(it)}: solo la risposta giusta ha le parentesi "${it.correct}"`);
  const words = all.map((a) => a.trim().split(/\s+/).length);
  if (words[0] >= 3 && words.slice(1).every((w) => w === 1)) S(`${W(it)}: la giusta "${it.correct}" e' l'unica risposta di piu' parole`);
  if (it.explanation && it.explanation.trim().length < 25) S(`${W(it)}: spiegazione cortissima "${it.explanation}"`);
  if (/\b(attual\w*|recente|in corso|campione in carica|record|classifica|ad oggi|nel 20[2-9]\d)\b/i.test(it.q)) S(`${W(it)}: possibile fatto che invecchia ("${it.q}")`);
  if (it.answersOrder && it.correctIndex !== undefined) {
    quizN++;
    posCount[it.correctIndex]++;
    const lens = it.answersOrder.map((a) => a.length);
    if (lens[it.correctIndex] === Math.max(...lens) && lens.filter((l) => l === Math.max(...lens)).length === 1) longest++;
  }
}
if (quizN) {
  const longestRate = longest / quizN;
  if (longestRate > 0.4) S(`quiz: la risposta giusta e' la piu' lunga nel ${(longestRate * 100).toFixed(0)}% dei casi (atteso ~25-30%): si indovina dalla lunghezza`);
  const worst = Math.max(...posCount);
  if (worst / quizN > 0.34 || Math.min(...posCount) / quizN < 0.16) S(`quiz: nel DATABASE la posizione della risposta giusta e' sbilanciata A/B/C/D = ${posCount.map((n) => ((n / quizN) * 100).toFixed(0) + '%').join(' / ')} — in gioco le risposte vengono mescolate (selection.ts: shuffleAnswers), quindi e' solo informativo`);
}

// ---- DECOY RIUSATI ----
const decoySets = new Map<string, Item[]>();
for (const it of items) {
  const k = [...it.decoys].map(norm).sort().join('|');
  decoySets.set(k, [...(decoySets.get(k) ?? []), it]);
}
for (const [, list] of decoySets) if (list.length > 1) S(`stesso set di decoy in ${list.map(W).join(' e ')}: ${JSON.stringify(list[0].decoys)}`);

// ---- CATEGORIE ----
for (const pool of ['quiz', 'cultura'] as const) {
  const list = items.filter((i) => i.pool === pool);
  const cats = new Map<string, number>();
  for (const it of list) cats.set(it.cat, (cats.get(it.cat) ?? 0) + 1);
  const [topCat, topN] = [...cats.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topN / list.length > 0.22) S(`${pool}: categoria "${topCat}" pesa il ${((topN / list.length) * 100).toFixed(0)}% del pool (${topN}/${list.length}) — le altre ${cats.size - 1} si ripetono meno`);
  if (cats.size < 8) S(`${pool}: solo ${cats.size} categorie`);
  const singles = [...cats.entries()].filter(([, n]) => n === 1).map(([c]) => c);
  if (singles.length >= 4) S(`${pool}: ${singles.length} categorie con UNA sola domanda (${singles.join(', ')})`);
  const byDiff = new Map<number, Item[]>();
  for (const it of list) byDiff.set(it.diff, [...(byDiff.get(it.diff) ?? []), it]);
  for (const [d, l] of byDiff) {
    const c = new Map<string, number>();
    for (const it of l) c.set(it.cat, (c.get(it.cat) ?? 0) + 1);
    const [cat, n] = [...c.entries()].sort((a, b) => b[1] - a[1])[0];
    if (l.length >= 6 && n / l.length > 0.5) S(`${pool}: difficolta' ${d}: "${cat}" e' il ${((n / l.length) * 100).toFixed(0)}% (${n}/${l.length}): il round e' quasi monotematico`);
  }
}

console.log(`\nAUDIT CONTENUTI — quiz ${QUESTIONS.length} domande, cultura ${CULTURA_QUESTIONS.length} domande\n`);
if (errors.length) {
  console.log(`❌ ERRORI STRUTTURALI (${errors.length}):`);
  for (const e of errors) console.log('   ' + e);
} else console.log('✅ nessun errore strutturale');
console.log(`\n⚠️  SOSPETTI DA RILEGGERE (${suspects.length}) — non sono errori certi:`);
for (const s of suspects) console.log('   ' + s);
if (!suspects.length) console.log('   nessuno');
process.exit(errors.length ? 1 : 0);
