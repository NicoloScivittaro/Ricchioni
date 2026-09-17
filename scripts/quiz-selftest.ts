/**
 * Self-test standalone del nuovo motore di "CHI CAZZO LO SA?" — NON un test
 * automatizzato del progetto (nessun runner configurato), ma uno script
 * eseguibile con `npx tsx scripts/quiz-selftest.ts` che simula partite
 * complete pilotando QuizRoundManager direttamente (nessun browser/Phaser
 * necessario: la logica è pura).
 */
import { InputManager } from '../src/network/InputManager';
import { Rng } from '../shared/rng';
import { QuizRoundManager } from '../src/minigames/quiz/QuizRoundManager';
import { selectQuizQuestions, resetQuizHistory } from '../src/minigames/quiz/selection';
import { QUESTIONS } from '../src/minigames/quiz/questions';
import type { MinigameContext } from '../src/minigames/types';
import type { PlayerId, PlayerSnapshot } from '../shared/types';

let failures = 0;
function assert(cond: boolean, label: string): void {
  if (cond) {
    console.log(`  ✅ ${label}`);
  } else {
    console.log(`  ❌ ${label}`);
    failures++;
  }
}

function makePlayers(n: number, characterIds: (string | null)[]): PlayerSnapshot[] {
  const colors = ['#10b981', '#ef4444', '#06b6d4', '#f59e0b', '#8b5cf6'];
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i}` as PlayerId,
    displayName: `Player${i}`,
    characterId: characterIds[i] ?? null,
    name: `Player${i}`,
    roleTitle: '',
    avatar: '🎮',
    color: colors[i % colors.length],
    quote: '',
    score: 0
  }));
}

interface FakeCtx extends MinigameContext {
  sentPrivate: { playerId: PlayerId; data: unknown }[];
  finished: boolean;
  results: { playerId: PlayerId; placement: number; score: number }[] | null;
}

function makeCtx(players: PlayerSnapshot[]): FakeCtx {
  const input = new InputManager();
  const sentPrivate: { playerId: PlayerId; data: unknown }[] = [];
  const ctx: FakeCtx = {
    players,
    playerIds: players.map((p) => p.id),
    rng: new Rng(12345),
    durationSec: 320,
    modifier: null,
    modifiers: new Map(),
    input,
    consume: () => false,
    sendPrivate: (playerId, data) => sentPrivate.push({ playerId, data }),
    vibrate: () => {},
    finish: (result) => {
      ctx.finished = true;
      ctx.results = result.results;
    },
    sentPrivate,
    finished: false,
    results: null
  };
  return ctx;
}

/**
 * Fa avanzare il manager finché non finisce o supera un tetto di sicurezza
 * (evita loop infiniti nel test). QuizRoundManager NON chiama ctx.finish() da
 * solo (lo fa QuizScene, con un piccolo ritardo per l'effetto "climax finale"
 * — stesso schema architetturale di RaceManager nel minigioco kart, che resta
 * pura logica e lascia alla scena l'orchestrazione IO): qui lo replichiamo a
 * mano, esattamente come farebbe la scena reale.
 */
function runToCompletion(mgr: QuizRoundManager, ctx: FakeCtx, dt: number, maxSeconds: number, onTick?: (mgr: QuizRoundManager) => void): void {
  let t = 0;
  while (!mgr.finished && t < maxSeconds) {
    onTick?.(mgr);
    mgr.update(dt);
    t += dt;
  }
  if (mgr.finished) ctx.finish({ results: mgr.buildResults() });
}

function testFullGame(n: number, description: string, characterIds: (string | null)[], answerStrategy: (mgr: QuizRoundManager, pid: PlayerId) => number): void {
  console.log(`\n--- ${description} (${n} giocatori) ---`);
  resetQuizHistory();
  const players = makePlayers(n, characterIds);
  const ctx = makeCtx(players);
  const mgr = new QuizRoundManager(ctx, () => {});

  let answeredThisQuestion = new Set<PlayerId>();
  runToCompletion(mgr, ctx, 0.1, 400, (m) => {
    if (m.phase === 'question') {
      for (const pid of ctx.playerIds) {
        if (answeredThisQuestion.has(pid)) continue;
        const p = m.players.get(pid)!;
        if (p.hasAnsweredFinal || p.inSecondChanceGrace) continue;
        const idx = answerStrategy(m, pid);
        m.submitAnswer(pid, idx);
        answeredThisQuestion.add(pid);
      }
    } else {
      answeredThisQuestion = new Set();
    }
  });

  assert(mgr.finished, 'la partita termina entro il tetto di sicurezza (nessun blocco/loop infinito)');
  assert(ctx.finished && ctx.results !== null, 'ctx.finish() viene chiamato con dei risultati');
  const results = ctx.results ?? [];
  assert(results.length === n, `i risultati contengono ${n} giocatori`);
  const placements = results.map((r) => r.placement).sort((a, b) => a - b);
  const expected = Array.from({ length: n }, (_, i) => i + 1);
  assert(JSON.stringify(placements) === JSON.stringify(expected), `i piazzamenti sono 1..${n} senza buchi né duplicati`);
}

console.log('=== TEST 1: database domande ===');
assert(QUESTIONS.length >= 100, `almeno 100 domande nel database (trovate ${QUESTIONS.length})`);
const ids = new Set(QUESTIONS.map((q) => q.id));
assert(ids.size === QUESTIONS.length, 'tutti gli id sono univoci');
for (let d = 1; d <= 10; d++) {
  const count = QUESTIONS.filter((q) => q.difficulty === d).length;
  assert(count >= 1, `difficoltà ${d}: almeno 1 domanda disponibile (trovate ${count})`);
}
for (const q of QUESTIONS) {
  assert(q.answers.length === 4, `[${q.id}] ha esattamente 4 risposte`);
  assert(q.correctAnswerIndex >= 0 && q.correctAnswerIndex <= 3, `[${q.id}] correctAnswerIndex valido (0-3)`);
  assert(q.question.trim().length > 0 && q.explanation.trim().length > 0, `[${q.id}] domanda e spiegazione non vuote`);
}

console.log('\n=== TEST 2: selezione domande (1 per difficoltà, 10 totali) ===');
{
  resetQuizHistory();
  const rng = new Rng(999);
  const selected = selectQuizQuestions(rng);
  assert(selected.length === 10, 'selectQuizQuestions restituisce esattamente 10 domande');
  const diffs = selected.map((q) => q.difficulty).sort((a, b) => a - b);
  assert(JSON.stringify(diffs) === JSON.stringify([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]), 'copre esattamente le difficoltà 1..10, una ciascuna');
  const selIds = new Set(selected.map((q) => q.id));
  assert(selIds.size === 10, 'nessuna domanda ripetuta nella stessa selezione');
}

console.log('\n=== TEST 3: algoritmo anti-ripetizione ===');
{
  resetQuizHistory();
  const rng = new Rng(42);
  const round1 = selectQuizQuestions(rng).map((q) => q.id);
  const round2 = selectQuizQuestions(rng).map((q) => q.id);
  const overlap = round1.filter((id) => round2.includes(id));
  // Con 12 domande per difficoltà e cronologia che ne esclude fino a 12 per
  // slot, un secondo giro consecutivo dovrebbe evitare quasi tutte le stesse id.
  assert(overlap.length <= 2, `seconda selezione condivide poche domande con la prima (${overlap.length}/10 in comune)`);
}

console.log('\n=== TEST 4: punteggio massimo 55 senza abilità (tutte corrette, nessuna abilità) ===');
{
  resetQuizHistory();
  const players = makePlayers(2, [null, null]);
  const ctx = makeCtx(players);
  const mgr = new QuizRoundManager(ctx, () => {});
  const answered = new Set<PlayerId>();
  runToCompletion(mgr, ctx, 0.1, 400, (m) => {
    if (m.phase === 'question') {
      for (const pid of ctx.playerIds) {
        if (answered.has(pid)) continue;
        const q = m.currentQuestion();
        m.submitAnswer(pid, q.correctAnswerIndex);
        answered.add(pid);
      }
    } else {
      answered.clear();
    }
  });
  const p0 = ctx.results?.find((r) => r.playerId === 'p0');
  assert(p0?.score === 55, `con tutte le risposte corrette e nessuna abilità il punteggio è 55 (trovato ${p0?.score})`);
}

console.log('\n=== TEST 5: pareggio risolto dal tie-break sul tempo ===');
{
  resetQuizHistory();
  const players = makePlayers(2, [null, null]);
  const ctx = makeCtx(players);
  const mgr = new QuizRoundManager(ctx, () => {});
  const answered = new Set<PlayerId>();
  runToCompletion(mgr, ctx, 0.1, 400, (m) => {
    if (m.phase === 'question') {
      const q = m.currentQuestion();
      // p0 risponde subito (poco tempo trascorso), p1 aspetta un po' prima di rispondere: stesso punteggio, tempo diverso.
      if (!answered.has('p0' as PlayerId)) {
        m.submitAnswer('p0' as PlayerId, q.correctAnswerIndex);
        answered.add('p0' as PlayerId);
      }
      if (!answered.has('p1' as PlayerId) && m.questionElapsed > 1.5) {
        m.submitAnswer('p1' as PlayerId, q.correctAnswerIndex);
        answered.add('p1' as PlayerId);
      }
    } else {
      answered.clear();
    }
  });
  const p0 = ctx.results?.find((r) => r.playerId === 'p0');
  const p1 = ctx.results?.find((r) => r.playerId === 'p1');
  assert(p0?.score === p1?.score, `entrambi i giocatori totalizzano lo stesso punteggio (${p0?.score} vs ${p1?.score})`);
  assert((p0?.placement ?? 99) < (p1?.placement ?? 99), 'a parità di punti vince chi ha risposto più velocemente (tie-break sul tempo)');
}

console.log('\n=== TEST 6: timeout (nessuna risposta) non blocca la partita ===');
testFullGame(3, 'nessuno risponde mai', [null, null, null], () => -1); // -1 = non risponde mai (answerStrategy non chiamata comunque perché saltiamo submitAnswer)
{
  // ripetiamo con una strategia che DAVVERO non chiama mai submitAnswer
  resetQuizHistory();
  const players = makePlayers(2, [null, null]);
  const ctx = makeCtx(players);
  const mgr = new QuizRoundManager(ctx, () => {});
  runToCompletion(mgr, ctx, 0.1, 400);
  assert(mgr.finished, 'con zero risposte in assoluto la partita termina comunque (nessun blocco)');
  const totalScore = (ctx.results ?? []).reduce((s, r) => s + r.score, 0);
  assert(totalScore === 0, 'nessuna risposta -> punteggio totale 0 per tutti');
}

console.log('\n=== TEST 7: disconnessione (giocatore rimosso a metà non deve far crashare il manager) ===');
{
  resetQuizHistory();
  const players = makePlayers(3, [null, null, null]);
  const ctx = makeCtx(players);
  const mgr = new QuizRoundManager(ctx, () => {});
  let ticks = 0;
  try {
    runToCompletion(mgr, ctx, 0.1, 400, (m) => {
      ticks++;
      // simula una disconnessione: il playerId sparisce da ctx.playerIds ma
      // resta nel manager (il minigioco non deve mai leggere ctx.playerIds
      // per gli input dei giocatori mid-round — solo submitAnswer/useAbility
      // mirati, che qui semplicemente non vengono più chiamati per lui).
      if (ticks === 20) {
        const idx = ctx.playerIds.indexOf('p1' as PlayerId);
        if (idx >= 0) ctx.playerIds.splice(idx, 1);
      }
      if (m.phase === 'question') {
        for (const pid of ctx.playerIds) {
          const p = m.players.get(pid);
          if (p && !p.hasAnsweredFinal && !p.inSecondChanceGrace) m.submitAnswer(pid, m.currentQuestion().correctAnswerIndex);
        }
      }
    });
    assert(true, 'nessuna eccezione lanciata quando un giocatore "sparisce" a metà partita');
  } catch (e) {
    assert(false, `nessuna eccezione lanciata quando un giocatore "sparisce" a metà partita (invece: ${e})`);
  }
  assert((ctx.results ?? []).length === 3, 'il giocatore disconnesso resta comunque nei risultati finali (con 0 punti dalle domande perse)');
}

console.log('\n=== TEST 8: domanda 10 (climax) ===');
{
  resetQuizHistory();
  const players = makePlayers(2, [null, null]);
  const ctx = makeCtx(players);
  const mgr = new QuizRoundManager(ctx, () => {});
  const answered = new Set<PlayerId>();
  let sawFinal = false;
  runToCompletion(mgr, ctx, 0.1, 400, (m) => {
    if (m.questionIndex === 9) sawFinal = true;
    if (m.phase === 'question') {
      for (const pid of ctx.playerIds) {
        if (answered.has(pid)) continue;
        m.submitAnswer(pid, m.currentQuestion().correctAnswerIndex);
        answered.add(pid);
      }
    } else {
      answered.clear();
    }
  });
  assert(sawFinal, 'la partita attraversa la decima domanda (indice 9) prima di terminare');
}

console.log("\n=== TEST 9: abilità — GOBLIN (NCULO! rifiuta la domanda, stessa difficoltà per tutti) ===");
{
  resetQuizHistory();
  const players = makePlayers(2, ['goblin', null]);
  const ctx = makeCtx(players);
  const mgr = new QuizRoundManager(ctx, () => {});
  mgr.update(mgr.phaseTimer + 0.05); // passa da 'intro' a 'question'
  const before = mgr.currentQuestion();
  const p1 = mgr.players.get('p1' as PlayerId)!;
  // p1 risponde PRIMA che Goblin rifiuti: la domanda cambia sotto ai suoi piedi.
  mgr.submitAnswer('p1' as PlayerId, before.correctAnswerIndex);
  assert(p1.hasAnsweredFinal, 'p1 ha risposto prima del rifiuto');

  mgr.useAbility('p0' as PlayerId);
  const after = mgr.currentQuestion();
  assert(after.id !== before.id, `NCULO! sostituisce la domanda (${before.id} -> ${after.id})`);
  assert(after.difficulty === before.difficulty, `la nuova domanda ha la STESSA difficoltà (${before.difficulty})`);
  assert(mgr.phase === 'intro', 'dopo NCULO! si torna alla fase intro (nuova domanda da presentare)');
  assert(!p1.hasAnsweredFinal, "la risposta di p1 sulla vecchia domanda viene azzerata (la domanda è cambiata per tutti)");
  const p0 = mgr.players.get('p0' as PlayerId)!;
  assert(p0.abilityUsed, "l'abilità risulta usata dopo l'attivazione");
  mgr.update(mgr.phaseTimer + 0.05);
  const stillSame = mgr.currentQuestion();
  mgr.useAbility('p0' as PlayerId);
  assert(mgr.currentQuestion().id === stillSame.id, 'una seconda pressione di ABILITÀ non ha alcun effetto (una sola volta a partita)');
}

console.log('\n=== TEST 10: abilità — BUTTAFUORI (secondo tentativo dopo risposta sbagliata) ===');
{
  resetQuizHistory();
  const players = makePlayers(1, ['buttafuori']);
  const ctx = makeCtx(players);
  const mgr = new QuizRoundManager(ctx, () => {});
  mgr.update(mgr.phaseTimer + 0.05);
  const q = mgr.currentQuestion();
  const wrongIdx = [0, 1, 2, 3].find((i) => i !== q.correctAnswerIndex)!;
  mgr.submitAnswer('p0' as PlayerId, wrongIdx);
  const p0 = mgr.players.get('p0' as PlayerId)!;
  assert(p0.inSecondChanceGrace, 'una risposta sbagliata apre la finestra di grazia per MO HO CAPITO');
  assert(!p0.hasAnsweredFinal, 'la risposta NON è ancora bloccata durante la finestra di grazia');
  mgr.useAbility('p0' as PlayerId);
  assert(p0.secondChanceArmed, "premendo ABILITÀ il secondo tentativo si arma");
  mgr.submitAnswer('p0' as PlayerId, q.correctAnswerIndex);
  assert(p0.hasAnsweredFinal && p0.lastCorrect === true, 'il secondo tentativo corretto viene registrato come corretto');
  const value = mgr.questionIndex + 1;
  assert(p0.points === Math.ceil(value / 2), `il secondo tentativo corretto vale il 50% arrotondato per eccesso (${Math.ceil(value / 2)}, trovato ${p0.points})`);
}

console.log('\n=== TEST 11: abilità — JUDOKA (cambia risposta prima della rivelazione) ===');
{
  resetQuizHistory();
  const players = makePlayers(1, ['judoka']);
  const ctx = makeCtx(players);
  const mgr = new QuizRoundManager(ctx, () => {});
  mgr.update(mgr.phaseTimer + 0.05);
  const q = mgr.currentQuestion();
  const wrongIdx = [0, 1, 2, 3].find((i) => i !== q.correctAnswerIndex)!;
  mgr.submitAnswer('p0' as PlayerId, wrongIdx);
  const p0 = mgr.players.get('p0' as PlayerId)!;
  assert(p0.hasAnsweredFinal && p0.lastCorrect === false, 'prima risposta (sbagliata) registrata come definitiva');
  const deadlineBefore = mgr.timeRemaining();
  mgr.useAbility('p0' as PlayerId);
  assert(!p0.hasAnsweredFinal, "NO, ASPETTA! riapre la risposta");
  assert(mgr.timeRemaining() > deadlineBefore, 'il tempo residuo aumenta di 3 secondi dopo NO, ASPETTA!');
  mgr.submitAnswer('p0' as PlayerId, q.correctAnswerIndex);
  assert(p0.hasAnsweredFinal && p0.lastCorrect === true, 'la nuova risposta corretta viene registrata regolarmente');
  assert(p0.points === mgr.questionIndex + 1, 'NO, ASPETTA! non altera il valore normale della domanda');
}

console.log("\n=== TEST 12: abilità — CIRO (ULTIMO GIORNO UTILE: aspetta, vede il riepilogo, risponde dopo) ===");
{
  resetQuizHistory();
  const players = makePlayers(2, ['ciro', null]);
  const ctx = makeCtx(players);
  const mgr = new QuizRoundManager(ctx, () => {});
  mgr.update(mgr.phaseTimer + 0.05); // passa a 'question'
  const q = mgr.currentQuestion();

  mgr.useAbility('p0' as PlayerId); // attiva ULTIMO GIORNO UTILE
  const p0 = mgr.players.get('p0' as PlayerId)!;
  assert(p0.ciroWaiting, 'ULTIMO GIORNO UTILE mette Ciro in attesa');
  assert(p0.abilityUsed, "l'abilità risulta usata subito");

  // p1 risponde subito (sbagliata), Ciro non ha ancora risposto: nessun riepilogo prima dello scadere del timer normale.
  const wrongIdx = [0, 1, 2, 3].find((i) => i !== q.correctAnswerIndex)!;
  mgr.submitAnswer('p1' as PlayerId, wrongIdx);
  assert(mgr.ciroBreakdown('p0' as PlayerId) === null, 'il riepilogo non è ancora visibile prima dello scadere del timer normale');

  // Facciamo scadere il timer normale (non oltre l'extra time, altrimenti la domanda passa a reveal).
  mgr.update(mgr.totalTime() + 0.1);
  const breakdown = mgr.ciroBreakdown('p0' as PlayerId);
  assert(breakdown !== null && breakdown[wrongIdx] === 1, `il riepilogo mostra il conteggio delle risposte altrui (${JSON.stringify(breakdown)})`);
  assert(mgr.phase === 'question', 'la domanda resta aperta durante i 4 secondi extra di Ciro');

  mgr.submitAnswer('p0' as PlayerId, q.correctAnswerIndex);
  assert(p0.hasAnsweredFinal && p0.lastCorrect === true, 'Ciro può ancora rispondere correttamente entro il tempo extra');
  assert(p0.points === mgr.questionIndex + 1, 'ULTIMO GIORNO UTILE non altera il punteggio normale della domanda');
  assert(mgr.ciroBreakdown('p0' as PlayerId) === null, 'il riepilogo sparisce una volta che Ciro ha risposto');
}

console.log("\n=== TEST 13: abilità — DOTTORE (M'HO SVEJATO: indizio vero, 70% dei punti se indovina) ===");
{
  resetQuizHistory();
  const players = makePlayers(1, ['dottore']);
  const ctx = makeCtx(players);
  const mgr = new QuizRoundManager(ctx, () => {});
  mgr.update(mgr.phaseTimer + 0.05);
  const q = mgr.currentQuestion();
  mgr.useAbility('p0' as PlayerId);
  const p0 = mgr.players.get('p0' as PlayerId)!;
  assert(p0.dottoreHintText === q.hint, "M'HO SVEJATO mostra l'indizio vero della domanda corrente");
  assert(p0.abilityUsed, "l'abilità risulta usata subito");
  mgr.submitAnswer('p0' as PlayerId, q.correctAnswerIndex);
  const value = mgr.questionIndex + 1;
  const expected = Math.round(value * 0.7);
  assert(p0.points === expected, `risposta corretta con indizio vale il 70% arrotondato (${expected}, trovato ${p0.points})`);
}
{
  // Sulla domanda successiva l'indizio non è più attivo (era valido solo per quella su cui è stato chiesto).
  resetQuizHistory();
  const players = makePlayers(1, ['dottore']);
  const ctx = makeCtx(players);
  const mgr = new QuizRoundManager(ctx, () => {});
  mgr.update(mgr.phaseTimer + 0.05);
  mgr.useAbility('p0' as PlayerId);
  const q1 = mgr.currentQuestion();
  mgr.submitAnswer('p0' as PlayerId, q1.correctAnswerIndex);
  // attraversa reveal + explanation con piccoli step, fino alla domanda successiva.
  for (let i = 0; i < 150 && mgr.questionIndex === 0; i++) mgr.update(0.1);
  assert(mgr.questionIndex === 1, 'la partita è avanzata alla domanda successiva');
  if (mgr.phase !== 'question') mgr.update(mgr.phaseTimer + 0.05);
  const p0 = mgr.players.get('p0' as PlayerId)!;
  assert(!p0.dottoreHintActive && p0.dottoreHintText === null, "l'indizio non è più attivo sulla domanda successiva");
  const pointsBeforeQ2 = p0.points; // 1 punto dalla domanda 1 (70% di 1, arrotondato)
  const q2 = mgr.currentQuestion();
  mgr.submitAnswer('p0' as PlayerId, q2.correctAnswerIndex);
  const q2Value = mgr.questionIndex + 1;
  assert(p0.points === pointsBeforeQ2 + q2Value, `senza indizio attivo la domanda successiva vale il punteggio pieno (+${q2Value}, trovato +${p0.points - pointsBeforeQ2})`);
}

console.log('\n=== TEST 14: 2, 3, 4, 5 giocatori — partita completa senza crash ===');
for (const n of [2, 3, 4, 5]) {
  const chars = ['goblin', 'buttafuori', 'dottore', 'judoka', 'ciro'].slice(0, n);
  testFullGame(n, 'mix vincitori/perdenti', chars, (m, pid) => {
    const q = m.currentQuestion();
    // alterna corretto/sbagliato in base a giocatore+domanda, per avere varietà.
    const hashy = (pid.charCodeAt(1) + m.questionIndex) % 3;
    if (hashy === 0) return q.correctAnswerIndex;
    return [0, 1, 2, 3].find((i) => i !== q.correctAnswerIndex)!;
  });
}

console.log(`\n=== RISULTATO: ${failures === 0 ? 'TUTTI I TEST PASSATI ✅' : `${failures} TEST FALLITI ❌`} ===`);
process.exit(failures === 0 ? 0 : 1);
