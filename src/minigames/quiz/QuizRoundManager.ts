import type { PlayerId, PlayerResult } from '../../../shared/types';
import type { Rng } from '../../../shared/rng';
import type { MinigameContext } from '../types';
import { selectQuizQuestions, rerollQuestion } from './selection';
import type { QuizQuestion } from './questions';

export type QuizPhase = 'intro' | 'question' | 'reveal' | 'explanation' | 'leaderboard' | 'results';

/** Spec: "mantieni questa restrizione facilmente configurabile". Default permissivo. */
export const ABILITIES_ALLOWED_ON_FINAL_QUESTION = true;

const INTRO_DURATION = 2.4; // finestra "prima di vedere le risposte" (usata da Ciro)
const REVEAL_DURATION = 3.2;
const EXPLANATION_DURATION = 4.2;
const LEADERBOARD_DURATION = 4.5;
const LEADERBOARD_AFTER_QUESTIONS = new Set([3, 6, 9]);
const SECOND_CHANCE_GRACE = 4; // Buttafuori: finestra per attivare MO HO CAPITO dopo una risposta sbagliata
const CIRO_EXTRA_TIME = 4; // Ciro: secondi extra dopo lo scadere del timer normale, per rispondere dopo aver visto il riepilogo
const DOTTORE_HINT_SCORE_FACTOR = 0.7; // M'HO SVEJATO: usare l'indizio riduce il punteggio se poi si indovina

const TIMER_BY_DIFFICULTY: Record<number, number> = {
  1: 12, 2: 12, 3: 12,
  4: 15, 5: 15, 6: 15,
  7: 18, 8: 18,
  9: 20,
  10: 25
};

export interface QuizPlayerState {
  playerId: PlayerId;
  characterId: string | null;
  displayName: string;
  color: string;
  avatar: string;

  points: number;
  correctTimeSum: number;
  correctCount: number; // risposte esatte (statistica dei risultati)
  abilityUsed: boolean;

  answerIndex: number | null;
  hasAnsweredFinal: boolean;
  answeredElapsed: number | null;
  lastCorrect: boolean | null; // esito dell'ultima domanda (per la rivelazione), null = non ha risposto

  secondChanceUsed: boolean;
  inSecondChanceGrace: boolean;
  secondChanceArmed: boolean; // ha premuto ABILITÀ durante la finestra di grazia
  secondChanceGraceTimer: number;
  firstWrongIndex: number | null;
  usedSecondChanceThisQuestion: boolean;

  rethinkUsedThisQuestion: boolean;
  personalExtraDeadline: number;

  dottoreHintText: string | null; // testo dell'indizio, valido solo per la domanda su cui è stato chiesto
  dottoreHintActive: boolean; // true SOLO sulla domanda in cui è stato chiesto l'indizio (penalizza il punteggio)

  ciroWaiting: boolean; // ULTIMO GIORNO UTILE attivata: aspetta lo scadere del timer normale prima di rispondere
}

export interface QuizHudEvent {
  type: 'intro' | 'reveal' | 'ability_used' | 'nculo' | 'second_chance' | 'rethink' | 'dottore_hint' | 'ultimo_giorno' | 'leaderboard' | 'final_question' | 'results';
  playerId?: PlayerId;
  value?: number;
}

function freshPerQuestionState(p: QuizPlayerState): void {
  p.answerIndex = null;
  p.hasAnsweredFinal = false;
  p.answeredElapsed = null;
  p.lastCorrect = null;
  p.inSecondChanceGrace = false;
  p.secondChanceArmed = false;
  p.secondChanceGraceTimer = 0;
  p.firstWrongIndex = null;
  p.usedSecondChanceThisQuestion = false;
  p.rethinkUsedThisQuestion = false;
  p.personalExtraDeadline = 0;
  p.dottoreHintText = null;
  p.dottoreHintActive = false;
  p.ciroWaiting = false;
}

/**
 * QuizRoundManager — stato puro del round (nessun riferimento a Phaser).
 * QuizScene lo guida (update(dt)) e legge lo stato per disegnare; gli input
 * dei giocatori (risposte, uso abilità) arrivano tramite i metodi pubblici.
 */
export class QuizRoundManager {
  phase: QuizPhase = 'intro';
  phaseTimer = INTRO_DURATION;
  questionIndex = 0; // 0..9
  questionElapsed = 0;
  finished = false;

  readonly questions: QuizQuestion[];
  readonly players = new Map<PlayerId, QuizPlayerState>();
  readonly order: PlayerId[];

  constructor(
    private ctx: MinigameContext,
    private onEvent: (ev: QuizHudEvent) => void
  ) {
    this.questions = selectQuizQuestions(ctx.rng);
    this.order = [...ctx.playerIds];
    for (const p of ctx.players) {
      const state: QuizPlayerState = {
        playerId: p.id,
        characterId: p.characterId,
        displayName: p.displayName,
        color: p.color,
        avatar: p.avatar,
        points: 0,
        correctTimeSum: 0,
        correctCount: 0,
        abilityUsed: false,
        answerIndex: null,
        hasAnsweredFinal: false,
        answeredElapsed: null,
        lastCorrect: null,
        secondChanceUsed: false,
        inSecondChanceGrace: false,
        secondChanceArmed: false,
        secondChanceGraceTimer: 0,
        firstWrongIndex: null,
        usedSecondChanceThisQuestion: false,
        rethinkUsedThisQuestion: false,
        personalExtraDeadline: 0,
        dottoreHintText: null,
        dottoreHintActive: false,
        ciroWaiting: false
      };
      this.players.set(p.id, state);
    }
    this.onEvent({ type: 'intro', value: 1 });
  }

  currentQuestion(): QuizQuestion {
    // Mai fuori dall'array (dopo l'ultima domanda la scena continua a disegnare i risultati).
    return this.questions[Math.min(this.questionIndex, this.questions.length - 1)];
  }

  private abilitiesAllowedNow(): boolean {
    return ABILITIES_ALLOWED_ON_FINAL_QUESTION || this.questionIndex < 9;
  }

  private baseTimer(): number {
    return TIMER_BY_DIFFICULTY[this.currentQuestion().difficulty] ?? 15;
  }

  private effectiveDeadline(): number {
    let maxExtra = 0;
    for (const p of this.players.values()) maxExtra = Math.max(maxExtra, p.personalExtraDeadline);
    return this.baseTimer() + Math.max(0, maxExtra);
  }

  // ---- Input dai giocatori ----

  submitAnswer(pid: PlayerId, index: number): void {
    if (this.phase !== 'question') return;
    if (index < 0 || index > 3) return;
    const p = this.players.get(pid);
    if (!p) return;

    if (p.inSecondChanceGrace) {
      // Buttafuori: il secondo tentativo conta solo dopo aver premuto ABILITÀ
      // (secondChanceArmed) — la sola finestra di grazia non basta a riprovare.
      if (!p.secondChanceArmed) return;
      if (index === p.firstWrongIndex) return;
      this.finalizeAnswer(p, index, true);
      return;
    }
    if (p.hasAnsweredFinal) return; // già bloccato (a meno di NO, ASPETTA! — vedi useAbility)

    const q = this.currentQuestion();
    const correct = index === q.correctAnswerIndex;
    if (!correct && p.characterId === 'buttafuori' && !p.abilityUsed) {
      // Non blocca subito: apre la finestra di grazia per MO HO CAPITO.
      p.answerIndex = index;
      p.firstWrongIndex = index;
      p.lastCorrect = false;
      p.answeredElapsed = this.questionElapsed;
      p.inSecondChanceGrace = true;
      p.secondChanceGraceTimer = SECOND_CHANCE_GRACE;
      return;
    }
    this.finalizeAnswer(p, index, false);
  }

  private finalizeAnswer(p: QuizPlayerState, index: number, isSecondChance: boolean): void {
    const q = this.currentQuestion();
    const correct = index === q.correctAnswerIndex;
    p.answerIndex = index;
    p.hasAnsweredFinal = true;
    p.inSecondChanceGrace = false;
    p.ciroWaiting = false;
    p.answeredElapsed = this.questionElapsed;
    p.lastCorrect = correct;
    if (isSecondChance) {
      p.usedSecondChanceThisQuestion = true;
      p.secondChanceUsed = true;
      p.abilityUsed = true;
    }
    this.applyScore(p, correct, isSecondChance);
  }

  private applyScore(p: QuizPlayerState, correct: boolean, isSecondChance: boolean): void {
    const value = this.questionIndex + 1; // Q1=1 .. Q10=10
    if (isSecondChance) {
      if (correct) {
        p.points += Math.ceil(value / 2);
        p.correctCount++;
      }
      return;
    }
    if (p.dottoreHintActive) {
      // M'HO SVEJATO: l'indizio aiuta ma costa punti se poi si indovina.
      if (correct) {
        p.points += Math.round(value * DOTTORE_HINT_SCORE_FACTOR);
        p.correctTimeSum += p.answeredElapsed ?? 0;
        p.correctCount++;
      }
      return;
    }
    if (correct) {
      p.points += value;
      p.correctTimeSum += p.answeredElapsed ?? 0;
      p.correctCount++;
    }
  }

  /** Tasto ABILITÀ sul telefono. */
  useAbility(pid: PlayerId): void {
    const p = this.players.get(pid);
    if (!p || p.abilityUsed || !this.abilitiesAllowedNow()) return;

    switch (p.characterId) {
      case 'goblin':
        this.useGoblinNculo(p);
        break;
      case 'dottore':
        this.useDottoreHint(p);
        break;
      case 'judoka':
        this.useJudokaRethink(p);
        break;
      case 'ciro':
        this.useCiroUltimoGiorno(p);
        break;
      case 'buttafuori':
        this.useButtafuoriSecondChance(p);
        break;
      default:
        break;
    }
  }

  /** GOBLIN — NCULO!: rifiuta la domanda prima di aver risposto. Nuova domanda, stessa difficoltà, per tutti. */
  private useGoblinNculo(p: QuizPlayerState): void {
    if (this.phase !== 'intro' && this.phase !== 'question') return;
    if (p.hasAnsweredFinal) return;
    const q = this.currentQuestion();
    const excludeIds = this.questions.map((qq) => qq.id); // evita duplicati con le altre 9 domande già estratte
    this.questions[this.questionIndex] = rerollQuestion(this.ctx.rng, q.difficulty, excludeIds);

    for (const player of this.players.values()) freshPerQuestionState(player);
    p.abilityUsed = true;
    this.phase = 'intro';
    this.phaseTimer = INTRO_DURATION;
    this.questionElapsed = 0;
    this.onEvent({ type: 'nculo', playerId: p.playerId });
    this.onEvent({ type: 'ability_used', playerId: p.playerId });
  }

  private useButtafuoriSecondChance(p: QuizPlayerState): void {
    // La finestra di grazia si apre da sola alla prima risposta sbagliata
    // (submitAnswer), ma serve la pressione esplicita di ABILITÀ per "armare"
    // il secondo tentativo: da qui in poi può scegliere di nuovo.
    if (!p.inSecondChanceGrace || p.secondChanceArmed) return;
    p.secondChanceArmed = true;
    p.answerIndex = null;
    this.onEvent({ type: 'second_chance', playerId: p.playerId });
    this.onEvent({ type: 'ability_used', playerId: p.playerId });
  }

  /** DOTTORE — M'HO SVEJATO: un indizio vero sulla domanda corrente (non elimina risposte). */
  private useDottoreHint(p: QuizPlayerState): void {
    if (this.phase !== 'intro' && this.phase !== 'question') return;
    if (p.hasAnsweredFinal) return;
    p.abilityUsed = true;
    p.dottoreHintActive = true;
    p.dottoreHintText = this.currentQuestion().hint;
    this.onEvent({ type: 'dottore_hint', playerId: p.playerId });
    this.onEvent({ type: 'ability_used', playerId: p.playerId });
  }

  private useJudokaRethink(p: QuizPlayerState): void {
    if (this.phase !== 'question') return;
    if (!p.hasAnsweredFinal || p.rethinkUsedThisQuestion) return;
    p.hasAnsweredFinal = false;
    p.answerIndex = null;
    p.lastCorrect = null;
    p.rethinkUsedThisQuestion = true;
    p.abilityUsed = true;
    p.personalExtraDeadline += 3;
    this.onEvent({ type: 'rethink', playerId: p.playerId });
    this.onEvent({ type: 'ability_used', playerId: p.playerId });
  }

  /** CIRO — ULTIMO GIORNO UTILE: lascia scadere il timer normale, poi vede il riepilogo A/B/C/D e ha 4s extra. */
  private useCiroUltimoGiorno(p: QuizPlayerState): void {
    if (this.phase !== 'question') return;
    if (p.hasAnsweredFinal || p.ciroWaiting) return;
    p.ciroWaiting = true;
    p.abilityUsed = true;
    this.onEvent({ type: 'ultimo_giorno', playerId: p.playerId });
    this.onEvent({ type: 'ability_used', playerId: p.playerId });
  }

  /**
   * CIRO — ULTIMO GIORNO UTILE: conteggio di quanti hanno scelto A/B/C/D tra
   * GLI ALTRI (mai i nomi), visibile solo dopo lo scadere del timer normale
   * e finché Ciro non ha ancora risposto.
   */
  ciroBreakdown(pid: PlayerId): [number, number, number, number] | null {
    const p = this.players.get(pid);
    if (!p || !p.ciroWaiting) return null;
    if (this.questionElapsed < this.effectiveDeadline()) return null;
    const counts: [number, number, number, number] = [0, 0, 0, 0];
    for (const other of this.players.values()) {
      if (other.playerId === pid) continue;
      if (other.answerIndex !== null && other.answerIndex >= 0 && other.answerIndex <= 3) {
        counts[other.answerIndex] += 1;
      }
    }
    return counts;
  }

  // ---- Ciclo di vita ----

  update(dt: number): void {
    if (this.finished) return;
    this.phaseTimer -= dt;

    for (const p of this.players.values()) {
      if (p.inSecondChanceGrace) {
        p.secondChanceGraceTimer -= dt;
        if (p.secondChanceGraceTimer <= 0) {
          // Non ha attivato MO HO CAPITO in tempo: la prima risposta sbagliata resta definitiva.
          p.inSecondChanceGrace = false;
          p.hasAnsweredFinal = true;
        }
      }
    }

    switch (this.phase) {
      case 'intro':
        if (this.phaseTimer <= 0) this.enterQuestion();
        break;
      case 'question':
        this.questionElapsed += dt;
        if (this.questionReadyToReveal()) this.enterReveal();
        break;
      case 'reveal':
        if (this.phaseTimer <= 0) this.enterExplanation();
        break;
      case 'explanation':
        if (this.phaseTimer <= 0) this.afterExplanation();
        break;
      case 'leaderboard':
        if (this.phaseTimer <= 0) this.advanceToNextQuestion();
        break;
      case 'results':
        break;
    }
  }

  private questionReadyToReveal(): boolean {
    const players = [...this.players.values()];
    const anyPending = players.some((p) => p.inSecondChanceGrace || p.ciroWaiting);
    const allAnswered = players.every((p) => p.hasAnsweredFinal);
    if (allAnswered && !anyPending) return true;
    // Se qualcuno è ancora dentro una finestra di grazia/attesa proprio allo
    // scadere del timer, le concediamo qualche secondo extra invece di
    // troncarla di netto (i suoi timer interni la chiuderanno comunque).
    const hardDeadline = this.effectiveDeadline() + (anyPending ? Math.max(SECOND_CHANCE_GRACE, CIRO_EXTRA_TIME) : 0);
    return this.questionElapsed >= hardDeadline;
  }

  timeRemaining(): number {
    return Math.max(0, this.effectiveDeadline() - this.questionElapsed);
  }

  /** Durata totale (base + eventuali bonus tempo) della domanda corrente, per la UI del timer. */
  totalTime(): number {
    return this.effectiveDeadline();
  }

  private enterQuestion(): void {
    this.phase = 'question';
    this.phaseTimer = 999; // il tempo reale è gestito da questionElapsed/effectiveDeadline()
  }

  private enterReveal(): void {
    // Chi non ha risposto in tempo resta senza risposta (0 punti).
    for (const p of this.players.values()) {
      if (!p.hasAnsweredFinal) {
        p.hasAnsweredFinal = true;
        p.lastCorrect = false;
      }
    }
    this.phase = 'reveal';
    this.phaseTimer = REVEAL_DURATION;
    this.onEvent({ type: 'reveal' });
  }

  private enterExplanation(): void {
    this.phase = 'explanation';
    this.phaseTimer = EXPLANATION_DURATION;
  }

  private afterExplanation(): void {
    const qNumber = this.questionIndex + 1;
    if (LEADERBOARD_AFTER_QUESTIONS.has(qNumber)) {
      this.phase = 'leaderboard';
      this.phaseTimer = LEADERBOARD_DURATION;
      this.onEvent({ type: 'leaderboard' });
    } else {
      this.advanceToNextQuestion();
    }
  }

  private advanceToNextQuestion(): void {
    // Dopo la 10ª domanda si va ai risultati SENZA incrementare l'indice: prima diventava 10, la scena
    // leggeva questions[10].difficulty → TypeError a ogni frame e finish() non veniva mai chiamato.
    if (this.questionIndex + 1 >= this.questions.length) {
      this.enterResults();
      return;
    }
    this.questionIndex += 1;
    for (const p of this.players.values()) freshPerQuestionState(p);
    this.phase = 'intro';
    this.phaseTimer = INTRO_DURATION;
    this.questionElapsed = 0;
    if (this.questionIndex === 9) this.onEvent({ type: 'final_question' });
    this.onEvent({ type: 'intro' });
  }

  private enterResults(): void {
    this.finished = true;
    this.phase = 'results';
    this.onEvent({ type: 'results' });
  }

  /** Ordina per punti quiz desc, poi tempo sulle risposte corrette asc (tie-break). */
  standings(): QuizPlayerState[] {
    return [...this.players.values()].sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      return a.correctTimeSum - b.correctTimeSum;
    });
  }

  buildResults(): PlayerResult[] {
    return this.standings().map((p, i) => ({
      playerId: p.playerId,
      placement: i + 1,
      score: p.points,
      stats: [
        `${p.correctCount}/${this.questions.length} corrette`,
        ...(p.correctCount > 0 ? [`${(p.correctTimeSum / p.correctCount).toFixed(1)}s di media`] : [])
      ]
    }));
  }
}
