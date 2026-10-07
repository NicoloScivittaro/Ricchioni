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
 *  ESPANSIONE  quiz: 4 risposte non vuote, indice 0-3, difficolta' 1-10, indizio, almeno 12 domande per difficolta' ·
 *              cultura: campi non vuoti, categoria fra le 20, difficolta' 1-8, bluff 1-5, 5 decoy ·
 *              ERRORE se le domande nuove (id oltre q120 nel quiz, oltre q030 in cultura) sono meno di 120 per gioco ·
 *              report finale: prima/tolte/nuove/totale, difficolta', categorie, posizione della giusta, bluffabilita' media.
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

// ---- ESPANSIONE CONTENUTI: forma di ogni record, minimo di domande nuove, distribuzioni ----
// Il pool prima dell'espansione: quiz q001-q120, cultura q001-q030. "Nuove" = id oltre quel numero (gli id tolti non si riusano).
const QUIZ_BASE = { count: 120, lastId: 120 };
const CULTURA_BASE = { count: 30, lastId: 30 };
const MIN_NEW = 120;
const CULTURA_CATEGORIES = ['Animali e natura', 'Storia', 'Scienza', 'Corpo umano', 'Spazio', 'Geografia', 'Cibo', 'Invenzioni', 'Lingue', 'Costumi', 'Arte', 'Musica', 'Cinema', 'Sport', 'Tecnologia', 'Oggetti', 'Record', 'Miti e leggende', 'Curiosità', 'Etimologia'];
const idNum = (id: string): number => Number(id.replace(/\D/g, ''));
const filled = (s: unknown): boolean => typeof s === 'string' && s.trim().length > 0;

for (const q of QUESTIONS) {
  const w = `quiz ${q.id}`;
  if (!filled(q.question)) E(`${w}: domanda vuota`);
  if (!filled(q.category)) E(`${w}: categoria vuota`);
  if (!Array.isArray(q.answers) || q.answers.length !== 4) E(`${w}: le risposte devono essere esattamente 4 (sono ${q.answers?.length})`);
  else if (q.answers.some((a) => !filled(a))) E(`${w}: risposta vuota ${JSON.stringify(q.answers)}`);
  if (!Number.isInteger(q.correctAnswerIndex) || q.correctAnswerIndex < 0 || q.correctAnswerIndex > 3) E(`${w}: correctAnswerIndex fuori da 0-3 (${q.correctAnswerIndex})`);
  if (!Number.isInteger(q.difficulty) || q.difficulty < 1 || q.difficulty > 10) E(`${w}: difficolta' fuori da 1-10 (${q.difficulty})`);
  if (!filled(q.hint)) E(`${w}: manca l'indizio`);
}
for (const q of CULTURA_QUESTIONS) {
  const w = `cultura ${q.id}`;
  if (!filled(q.question)) E(`${w}: domanda vuota`);
  if (!filled(q.correctAnswer)) E(`${w}: risposta vera vuota`);
  if (!filled(q.category)) E(`${w}: categoria vuota`);
  else if (!CULTURA_CATEGORIES.includes(q.category)) E(`${w}: categoria "${q.category}" fuori dalle 20 previste`);
  if (!Number.isInteger(q.difficulty) || q.difficulty < 1 || q.difficulty > 8) E(`${w}: difficolta' fuori da 1-8 (${q.difficulty})`);
  if (!Array.isArray(q.fallbackDecoys) || q.fallbackDecoys.length < 3) E(`${w}: servono almeno 3 decoy`);
  else if (q.fallbackDecoys.length < 5) S(`${w}: solo ${q.fallbackDecoys.length} decoy — con 5 giocatori senza bluff la scena ricade su "<risposta> (ma sbagliato)"`);
  if (q.fallbackDecoys?.some((d) => !filled(d))) E(`${w}: decoy vuoto`);
  if (q.bluff !== undefined && (!Number.isInteger(q.bluff) || q.bluff < 1 || q.bluff > 5)) E(`${w}: bluff fuori da 1-5 (${q.bluff})`);
  if (idNum(q.id) > CULTURA_BASE.lastId && q.bluff === undefined) S(`${w}: domanda nuova senza punteggio "bluff"`);
}
const quizNew = QUESTIONS.filter((q) => idNum(q.id) > QUIZ_BASE.lastId);
const culturaNew = CULTURA_QUESTIONS.filter((q) => idNum(q.id) > CULTURA_BASE.lastId);
if (quizNew.length < MIN_NEW) E(`quiz: solo ${quizNew.length} domande nuove (minimo ${MIN_NEW})`);
if (culturaNew.length < MIN_NEW) E(`cultura: solo ${culturaNew.length} domande nuove (minimo ${MIN_NEW})`);
const quizByDiff = Array.from({ length: 11 }, (_, d) => QUESTIONS.filter((q) => q.difficulty === d).length);
for (let d = 1; d <= 10; d++) if (quizByDiff[d] < 12) E(`quiz: difficolta' ${d} ha solo ${quizByDiff[d]} domande (con la storia di 30 domande servono almeno 12 per non ripetere fra partite vicine)`);
const culturaCats = new Map<string, number>();
for (const q of CULTURA_QUESTIONS) culturaCats.set(q.category, (culturaCats.get(q.category) ?? 0) + 1);
for (const c of CULTURA_CATEGORIES) {
  const n = culturaCats.get(c) ?? 0;
  if (n < 6 || n > 10) S(`cultura: categoria "${c}" ha ${n} domande (obiettivo 6-10)`);
}

console.log(`\nAUDIT CONTENUTI — quiz ${QUESTIONS.length} domande, cultura ${CULTURA_QUESTIONS.length} domande\n`);
if (errors.length) {
  console.log(`❌ ERRORI STRUTTURALI (${errors.length}):`);
  for (const e of errors) console.log('   ' + e);
} else console.log('✅ nessun errore strutturale');
console.log(`\n⚠️  SOSPETTI DA RILEGGERE (${suspects.length}) — non sono errori certi:`);
for (const s of suspects) console.log('   ' + s);
if (!suspects.length) console.log('   nessuno');

// COPERTURA DEL POOL CULTURA: nessuna domanda viene inventata qui, e' solo il conto di dove mancano (una partita ne pesca 8 su tutto il pool).
{
  const TARGET = 4; // domande minime per categoria perche' una categoria non si ripeta a ogni partita
  const byCat = new Map<string, number[]>();
  for (const q of CULTURA_QUESTIONS) byCat.set(q.category, [...(byCat.get(q.category) ?? []), q.difficulty]);
  console.log(`\nCOPERTURA CULTURA — ${CULTURA_QUESTIONS.length} domande, ${byCat.size} categorie (obiettivo minimo ${TARGET} per categoria)`);
  console.log('   categoria        domande  difficolta\' presenti   da aggiungere  difficolta\' consigliate');
  let toAdd = 0;
  for (const [cat, ds] of [...byCat.entries()].sort((a, b) => a[1].length - b[1].length || a[0].localeCompare(b[0]))) {
    const need = Math.max(0, TARGET - ds.length);
    toAdd += need;
    const have = new Set(ds);
    const want = [1, 2, 3, 4, 5].filter((d) => !have.has(d)).slice(0, need || 0);
    console.log(`   ${cat.padEnd(16)} ${String(ds.length).padStart(5)}    ${[...have].sort().join(',').padEnd(20)} ${String(need).padStart(8)}       ${need ? want.join(',') : '—'}`);
  }
  console.log(`   TOTALE consigliato: +${toAdd} domande (pool ${CULTURA_QUESTIONS.length} -> ${CULTURA_QUESTIONS.length + toAdd}); ogni partita ne pesca 8 (cultura/selection.ts: mescolate, senza le ultime 80 giocate, categorie diverse).`);
}

// REPORT DELL'ESPANSIONE: prima / aggiunte / dopo, difficolta', categorie, posizione della giusta, bluffabilita'.
{
  const count = <T,>(list: T[], key: (x: T) => string | number): [string, number][] => {
    const m = new Map<string, number>();
    for (const x of list) m.set(String(key(x)), (m.get(String(key(x))) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  };
  const line = (pairs: [string, number][]): string => pairs.map(([k, n]) => `${k} ${n}`).join(' · ');
  const quizKept = QUESTIONS.filter((q) => idNum(q.id) <= QUIZ_BASE.lastId).length;
  const culturaKept = CULTURA_QUESTIONS.filter((q) => idNum(q.id) <= CULTURA_BASE.lastId).length;
  console.log(`\nREPORT ESPANSIONE (minimo ${MIN_NEW} nuove per gioco)`);
  console.log(`QUIZ     prima ${QUIZ_BASE.count} · tolte ${QUIZ_BASE.count - quizKept} · nuove ${quizNew.length} ${quizNew.length >= MIN_NEW ? '✅' : '❌'} · totale ${QUESTIONS.length}`);
  console.log(`   per difficolta': ${Array.from({ length: 10 }, (_, i) => `${i + 1}:${quizByDiff[i + 1]}`).join(' ')}`);
  console.log(`   nuove per difficolta': ${Array.from({ length: 10 }, (_, i) => `${i + 1}:${quizNew.filter((q) => q.difficulty === i + 1).length}`).join(' ')}`);
  console.log(`   categorie (tutte): ${line(count(QUESTIONS, (q) => q.category))}`);
  console.log(`   categorie (nuove): ${line(count(quizNew, (q) => q.category))}`);
  const pos = [0, 1, 2, 3].map((i) => QUESTIONS.filter((q) => q.correctAnswerIndex === i).length);
  console.log(`   posizione della giusta nel database A/B/C/D: ${pos.join(' / ')} (in gioco si mescola: vedi quiz-shuffle-stat.ts e content-sim.ts)`);
  console.log(`CULTURA  prima ${CULTURA_BASE.count} · tolte ${CULTURA_BASE.count - culturaKept} · nuove ${culturaNew.length} ${culturaNew.length >= MIN_NEW ? '✅' : '❌'} · totale ${CULTURA_QUESTIONS.length}`);
  console.log(`   categorie: ${line(count(CULTURA_QUESTIONS, (q) => q.category))}`);
  const band = (d: number): string => (d <= 2 ? 'facile' : d <= 4 ? 'media' : 'difficile');
  const mix = count(culturaNew, (q) => band(q.difficulty));
  console.log(`   difficolta' delle nuove: ${mix.map(([k, n]) => `${k} ${n} (${Math.round((n / culturaNew.length) * 100)}%)`).join(' · ')} — obiettivo 25/50/25`);
  const avg = (l: typeof CULTURA_QUESTIONS): string => (l.reduce((s, q) => s + (q.bluff ?? 0), 0) / Math.max(1, l.filter((q) => q.bluff !== undefined).length)).toFixed(2);
  console.log(`   bluffabilita' media: tutte ${avg(CULTURA_QUESTIONS)} · nuove ${avg(culturaNew)} · nuove con bluff >= 4: ${culturaNew.filter((q) => (q.bluff ?? 0) >= 4).length}/${culturaNew.length}`);
  console.log(`   decoy per domanda: min ${Math.min(...CULTURA_QUESTIONS.map((q) => q.fallbackDecoys.length))} · max ${Math.max(...CULTURA_QUESTIONS.map((q) => q.fallbackDecoys.length))}`);
}
process.exit(errors.length ? 1 : 0);
