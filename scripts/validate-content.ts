/**
 * Controllo QUALITÀ dei database domande (Quiz + Cultura):  npx tsx scripts/validate-content.ts
 *
 * Cattura gli errori STRUTTURALI e di forma che rovinano una serata: risposte doppie o quasi uguali
 * (ambiguità / due risposte giuste), risposta giusta suggerita dall'indizio, decoy uguali alla risposta vera,
 * testi troppo lunghi per il telefono, refusi tipografici, pool sbilanciati. Non può verificare i FATTI
 * (informazioni obsolete): le domande sono scritte "stabili nel tempo", ma una rilettura umana resta utile.
 */
import { QUESTIONS } from '../src/minigames/quiz/questions';
import { CULTURA_QUESTIONS } from '../shared/culturaQuestions';

const errors: string[] = [];
const warns: string[] = [];
const err = (m: string): void => void errors.push(m);
const warn = (m: string): void => void warns.push(m);

/** minuscolo, senza accenti/punteggiatura/articoli iniziali: per confrontare testi "quasi uguali". */
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/^(il|lo|la|le|gli|i|un|uno|una|l|the) /, '')
    .replace(/\s+/g, ' ')
    .trim();
}
const contains = (a: string, b: string): boolean => a.length >= 4 && b.length >= 4 && (a.includes(b) || b.includes(a));
function typo(where: string, s: string): void {
  if (/\s{2,}/.test(s)) err(`${where}: spazi doppi in "${s}"`);
  if (s !== s.trim()) err(`${where}: spazi a inizio/fine in "${s}"`);
  if (/\s[,.;:!?]/.test(s)) err(`${where}: spazio prima della punteggiatura in "${s}"`);
  if (/[,.;:!?][A-Za-zÀ-ÿ]/.test(s) && !/\d[.,]\d|\.\w{2,4}\b|\w\.\w\./.test(s)) warn(`${where}: manca lo spazio dopo la punteggiatura in "${s}"`);
  if (/[.]{4,}|\?\?|!!/.test(s)) warn(`${where}: punteggiatura ripetuta in "${s}"`);
}

// ---------------- QUIZ ----------------
{
  const ids = new Set<string>();
  const texts = new Set<string>();
  const perDiff = new Map<number, QuestionInfo[]>();
  interface QuestionInfo { cat: string }
  for (const q of QUESTIONS) {
    const w = `quiz ${q.id}`;
    if (ids.has(q.id)) err(`${w}: id duplicato`);
    ids.add(q.id);
    const nq = norm(q.question);
    if (texts.has(nq)) err(`${w}: domanda duplicata "${q.question}"`);
    texts.add(nq);
    if (!Number.isInteger(q.difficulty) || q.difficulty < 1 || q.difficulty > 10) err(`${w}: difficoltà ${q.difficulty} fuori 1..10`);
    if (q.answers.length !== 4) err(`${w}: servono 4 risposte`);
    if (!Number.isInteger(q.correctAnswerIndex) || q.correctAnswerIndex < 0 || q.correctAnswerIndex > 3) err(`${w}: correctAnswerIndex non valido`);
    const na = q.answers.map(norm);
    if (new Set(na).size !== na.length) err(`${w}: risposte uguali/quasi uguali ${JSON.stringify(q.answers)}`);
    q.answers.forEach((a, i) => {
      if (!a || !a.trim()) err(`${w}: risposta ${i} vuota`);
      if (a.length > 46) warn(`${w}: risposta lunga (${a.length}) "${a}"`);
      typo(`${w} risposta ${i}`, a);
    });
    // ambiguità: una risposta sbagliata che contiene (o è contenuta nella) risposta giusta
    const correct = na[q.correctAnswerIndex];
    na.forEach((a, i) => {
      if (i !== q.correctAnswerIndex && contains(a, correct)) warn(`${w}: "${q.answers[i]}" è troppo simile alla risposta giusta "${q.answers[q.correctAnswerIndex]}" (possibile doppia risposta corretta)`);
    });
    if (!q.explanation?.trim()) err(`${w}: manca la spiegazione`);
    if (!q.hint?.trim()) err(`${w}: manca l'indizio`);
    // l'indizio NON deve nominare la risposta giusta
    if (q.hint && correct.length >= 4 && norm(q.hint).includes(correct)) err(`${w}: l'indizio regala la risposta ("${q.hint}")`);
    if (q.question.length > 150) warn(`${w}: domanda lunga (${q.question.length})`);
    if ((q.explanation ?? '').length > 230) warn(`${w}: spiegazione lunga (${q.explanation.length})`);
    typo(`${w} domanda`, q.question);
    typo(`${w} spiegazione`, q.explanation ?? '');
    if (!/[?]$/.test(q.question.trim()) && !/[.:]$/.test(q.question.trim())) warn(`${w}: la domanda non finisce con ? . o : → "${q.question}"`);
    (perDiff.get(q.difficulty) ?? perDiff.set(q.difficulty, []).get(q.difficulty)!).push({ cat: q.category });
  }
  for (let d = 1; d <= 10; d++) {
    const list = perDiff.get(d) ?? [];
    if (list.length < 6) err(`quiz: difficoltà ${d} ha solo ${list.length} domande (ne servono ≥6 per non ripetersi)`);
    const cats = new Set(list.map((x) => x.cat));
    if (cats.size < 3) warn(`quiz: difficoltà ${d} ha solo ${cats.size} categorie`);
  }
  console.log(`QUIZ: ${QUESTIONS.length} domande, ${new Set(QUESTIONS.map((q) => q.category)).size} categorie`);
}

// ---------------- CULTURA ----------------
{
  const ids = new Set<string>();
  const texts = new Set<string>();
  for (const q of CULTURA_QUESTIONS) {
    const w = `cultura ${q.id}`;
    if (ids.has(q.id)) err(`${w}: id duplicato`);
    ids.add(q.id);
    const nq = norm(q.question);
    if (texts.has(nq)) err(`${w}: domanda duplicata`);
    texts.add(nq);
    if (!q.correctAnswer?.trim()) err(`${w}: manca la risposta vera`);
    if (q.correctAnswer.length > 40) warn(`${w}: risposta vera lunga (${q.correctAnswer.length}) — i bluff dei giocatori sono max 40`);
    if (!q.explanation?.trim()) err(`${w}: manca la spiegazione`);
    if (q.fallbackDecoys.length < 3) err(`${w}: servono ≥3 decoy di riserva (ha ${q.fallbackDecoys.length})`);
    const nc = norm(q.correctAnswer);
    const nd = q.fallbackDecoys.map(norm);
    if (new Set(nd).size !== nd.length) err(`${w}: decoy uguali tra loro ${JSON.stringify(q.fallbackDecoys)}`);
    q.fallbackDecoys.forEach((d, i) => {
      if (norm(d) === nc) err(`${w}: il decoy "${d}" è UGUALE alla risposta vera`);
      else if (contains(norm(d), nc)) warn(`${w}: il decoy "${d}" contiene/è contenuto nella risposta vera "${q.correctAnswer}"`);
      if (d.length > 40) warn(`${w}: decoy lungo "${d}"`);
      typo(`${w} decoy ${i}`, d);
    });
    typo(`${w} domanda`, q.question);
    typo(`${w} risposta`, q.correctAnswer);
    typo(`${w} spiegazione`, q.explanation);
    if (q.difficulty < 1 || q.difficulty > 8) warn(`${w}: difficoltà ${q.difficulty} fuori 1..8`);
    if ((q.explanation ?? '').length > 260) warn(`${w}: spiegazione lunga (${q.explanation.length})`);
  }
  const cats = new Map<string, number>();
  for (const q of CULTURA_QUESTIONS) cats.set(q.category, (cats.get(q.category) ?? 0) + 1);
  console.log(`CULTURA: ${CULTURA_QUESTIONS.length} domande · categorie: ${[...cats].map(([c, n]) => `${c} ${n}`).join(', ')}`);
  if (CULTURA_QUESTIONS.length < 24) err(`cultura: poche domande (${CULTURA_QUESTIONS.length}) per 8 round senza ripetizioni tra serate`);
}

console.log(`\n${errors.length} errori, ${warns.length} avvisi`);
for (const e of errors) console.log('❌', e);
for (const w of warns) console.log('⚠️ ', w);
if (errors.length === 0) console.log('✅ nessun errore strutturale nei database domande');
process.exit(errors.length ? 1 : 0);
