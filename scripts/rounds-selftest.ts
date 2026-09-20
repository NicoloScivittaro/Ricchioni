/**
 * Self-test della logica ROUND (senza browser):  npx tsx scripts/rounds-selftest.ts
 *
 * Regola: fine ROUND ≠ fine MINIGIOCO. Un gioco configurato per N round esegue esattamente N round,
 * il risultato finale esce UNA volta sola, i round successivi all'ultimo vengono ignorati.
 */
import { Rng } from '../shared/rng';
import { MEMORY_ROUNDS, isMemoryOver } from '../shared/memoryTiles';
import { MINIGAME_DEFINITIONS, safetyCapSec } from '../shared/minigames';
import { QuizRoundManager } from '../src/minigames/quiz/QuizRoundManager';
import type { MinigameContext } from '../src/minigames/types';
import { splitFrameDelta, MAX_STEP_DT, MAX_FRAME_DT } from '../src/core/frameClock';

let checks = 0;
function ok(cond: unknown, msg: string): void {
  if (!cond) throw new Error(`ASSERT FALLITA: ${msg}`);
  checks += 1;
  console.log(`  ✔ ${msg}`);
}

// ---------- QUIZ: 10 domande = 10 domande ----------
console.log('\n[QUIZ] 10 domande');
{
  const players = ['a', 'b', 'c'].map((id, i) => ({
    id,
    displayName: `P${i + 1}`,
    characterId: null,
    name: `P${i + 1}`,
    roleTitle: '',
    avatar: '🎲',
    color: '#ffffff'
  }));
  const ctx = { rng: new Rng(42), players, playerIds: players.map((p) => p.id) } as unknown as MinigameContext;
  const events: string[] = [];
  const m = new QuizRoundManager(ctx, (ev) => events.push(ev.type));
  const seenQuestions = new Set<number>();
  let t = 0;
  let neverOutOfRange = true;
  while (!m.finished && t < 3000) {
    m.update(0.05); // nessuna risposta: ogni domanda va al timeout
    t += 0.05;
    seenQuestions.add(m.questionIndex);
    if (!m.currentQuestion() || m.currentQuestion().difficulty === undefined) neverOutOfRange = false;
  }
  ok(m.finished, `il quiz termina da solo (${t.toFixed(0)}s simulati)`);
  ok(neverOutOfRange, 'currentQuestion() è valida in OGNI istante, anche ai risultati (bug: questions[10] → crash a ogni frame, finish() mai chiamato)');
  ok(m.questionIndex === 9, "l'indice resta sull'ultima domanda ai risultati");
  ok(seenQuestions.size === 10 && [...seenQuestions].every((q, i) => q === i), `eseguite esattamente 10 domande (0..9): ${[...seenQuestions].join(',')}`);
  ok(events.filter((e) => e === 'intro').length === 10, 'un solo "intro" per domanda: 10 in totale');
  ok(events.filter((e) => e === 'results').length === 1, 'evento "results" emesso una volta sola');
  const idx = m.questionIndex;
  for (let i = 0; i < 200; i++) m.update(0.05);
  ok(m.questionIndex === idx && events.filter((e) => e === 'results').length === 1, 'update() dopo la fine viene ignorato (nessun round in più)');
  ok(m.buildResults().length === 3, 'risultati per tutti e 3 i giocatori');
}

// ---------- MEMORIA: 5 round, eliminazione ≠ fine gioco ----------
console.log(`\n[MEMORIA] ${MEMORY_ROUNDS} round (sequenze 3-4-5-6-7)`);
{
  ok(MEMORY_ROUNDS === 5, 'la configurazione prevede 5 round');
  // simula: round completato → il gioco è finito?
  const flow = (aliveByRound: number[]): number => {
    let played = 0;
    for (let r = 0; r < 50; r++) {
      played++;
      if (isMemoryOver(r, MEMORY_ROUNDS, aliveByRound[Math.min(r, aliveByRound.length - 1)])) break;
    }
    return played;
  };
  ok(flow([3, 3, 3, 3, 3]) === 5, 'tutti vivi: 5 round esatti (i round 1-4 NON chiudono il gioco, il 5° sì)');
  ok(flow([2, 2, 2, 2, 2]) === 5, '2 giocatori in gara: 5 round');
  ok(flow([3, 2, 1, 1, 1]) === 5, 'un solo superstite dal round 3: si giocano comunque tutti e 5 i round (bug: finiva al round 3)');
  ok(flow([2, 1, 1, 1, 1]) === 5, '2 giocatori, uno sbaglia al round 2: il superstite arriva al round 5');
  ok(flow([3, 2, 0]) === 3, 'tutti eliminati al round 3: il gioco finisce lì (nessuna condizione valida per continuare)');
  ok(!isMemoryOver(0, 5, 1) && !isMemoryOver(3, 5, 1) && isMemoryOver(4, 5, 1), 'sesto round mai raggiunto: dopo il round 5 è sempre finito');
}

// ---------- TETTO DI SICUREZZA SERVER ----------
console.log('\n[TETTO SERVER] copre la durata REALE massima di ogni gioco (con ≥25% di margine)');
{
  // Durata massima realistica (s) letta dal codice di ciascun gioco; se ne aggiungi uno, aggiungila qui.
  const WORST_CASE_SEC: Record<string, number> = {
    quiz: 290, // 10 domande, timer 12-25s + reveal/spiegazione + 3 classifiche (misurato 275s senza risposte)
    reaction: 75, // 5 round × (1.1 + 6 + 3 + 2.2) + titolo + risultati
    memory: 105, // 5 round osserva+ripeti fino alla scadenza + risultati
    arena: 58, // countdown + partita (cap durationSec 45) + festeggiamenti
    dodgeball: 58,
    soccer: 115, // 60s + golden goal 15s + pause dopo i gol
    volleyball: 420, // primo a 5: nessun cap di tempo in gioco; scambi lunghi
    kart3d: 185, // countdown + gara (cap durationSec) + arrivo
    cultura: 430, // 8 round × ~51s (bluff 20 + voto 12 + reveal ~9 + spiegazione 5.5) + 3 classifiche; con fine anticipata ~5 min
    fps: 112 // match 100s + countdown/risultati
  };
  for (const def of MINIGAME_DEFINITIONS) {
    const worst = WORST_CASE_SEC[def.id];
    ok(worst !== undefined, `${def.id}: ha una stima di durata massima`);
    ok(safetyCapSec(def) >= worst * 1.25, `${def.id}: tetto ${safetyCapSec(def)}s ≥ 1.25 × ${worst}s`);
  }
  // Regressione: con il vecchio tetto (durationSec + 20s) Cultura veniva troncata a metà (320s contro ~490s)
  const cultura = MINIGAME_DEFINITIONS.find((d) => d.id === 'cultura')!;
  ok(cultura.durationSec + 20 < WORST_CASE_SEC.cultura, 'Cultura: il vecchio tetto durationSec+20 era troppo corto (bug)');
  const volley = MINIGAME_DEFINITIONS.find((d) => d.id === 'volleyball')!;
  ok(volley.durationSec + 20 < WORST_CASE_SEC.volleyball, 'Pallavolo: idem (con scambi più lunghi il vecchio tetto avrebbe troncato la partita)');
}

// ---------- FRAME-RATE: stessa durata a 4, 10, 30 e 120 FPS ----------
console.log('\n[FRAME-RATE] il tempo di gioco segue l\'orologio, non i frame');
{
  const sum = (a: number[]): number => a.reduce((x, y) => x + y, 0);
  ok(splitFrameDelta(1 / 120).length === 1 && Math.abs(sum(splitFrameDelta(1 / 120)) - 1 / 120) < 1e-9, '120 FPS: un solo passo con il dt reale');
  ok(splitFrameDelta(1 / 30).length === 1, '30 FPS: un solo passo (nessun cambiamento di comportamento)');
  ok(splitFrameDelta(0.1).length === 2 && splitFrameDelta(0.1).every((d) => d <= MAX_STEP_DT + 1e-9), '10 FPS: 2 sotto-passi ≤ 50ms');
  ok(splitFrameDelta(MAX_FRAME_DT).length === 5, '4 FPS: 5 sotto-passi');
  ok(Math.abs(sum(splitFrameDelta(3)) - MAX_FRAME_DT) < 1e-9, 'blocco lungo (3s): recupera al massimo 250ms, poi rallenta invece di saltare');
  ok([NaN, 0, -1].every((v) => splitFrameDelta(v).length === 1 && splitFrameDelta(v)[0] <= MAX_STEP_DT), 'delta non valido → un passo di sicurezza');
  for (const fps of [4, 10, 30, 60, 120]) {
    let game = 0;
    const frames = 45 * fps; // 45 secondi REALI di partita
    for (let i = 0; i < frames; i++) game += sum(splitFrameDelta(1 / fps));
    ok(Math.abs(game - 45) < 0.01, `${fps} FPS: 45s reali → ${game.toFixed(2)}s di gioco (durata identica)`);
  }
}

console.log(`\n✅ ROUNDS SELFTEST OK (${checks} controlli)`);
