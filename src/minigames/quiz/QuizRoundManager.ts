import type { PlayerId } from '../../../shared/types';
import type { Rng } from '../../../shared/rng';
import type { MinigameContext } from '../types';
import { selectQuizQuestions } from './selection';
import type { QuizQuestion } from './questions';
import { rollDottoreEffect, dottoreEffectLabel } from './abilities';
import type { DottoreEffect } from './abilities';

export type QuizPhase = 'intro' | 'question' | 'reveal' | 'explanation' | 'leaderboard' | 'results';

/** Spec: "mantieni questa restrizione facilmente configurabile". Default permissivo. */
export const ABILITIES_ALLOWED_ON_FINAL_QUESTION = true;

const INTRO_DURATION = 2.4; // finestra "prima di vedere le risposte" (usata da Ciro)
const REVEAL_DURATION = 3.2;
const EXPLANATION_DURATION = 4.2;
const LEADERBOARD_DURATION = 4.5;
const LEADERBOARD_AFTER_QUESTIONS = new Set([3, 6, 9]);
const SECOND_CHANCE_GRACE = 2.6; // Buttafuori: finestra per attivare MO HO CAPITO dopo una risposta sbagliata
const CHOICE_TIMEOUT = 3.5; // Dottore: tempo per scegliere una siringa

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

  doubleOrNothing: boolean;

  dottoreEffect: DottoreEffect | null;
  dottoreHintText: string | null;
  awaitingDottoreChoice: boolean;
  dottoreChoiceTimer: number;
}

export interface QuizHudEvent {
  type:
    | 'intro'
    | 'reveal'
    | 'ability_ready'
    | 'ability_used'
    | 'exploit'
    | 'second_chance'
    | 'rethink'
    | 'double_or_nothing'
    | 'dottore_choice_open'
    | 'dottore_effect'
    | 'timer_tick'
    | 'leaderboard'
    | 'final_question'
    | 'results';
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
  p.doubleOrNothing = false;
  p.dottoreEffect = null;
  p.dottoreHintText = null;
  p.awaitingDottoreChoice = false;
  p.dottoreChoiceTimer = 0;
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
  hiddenIndices = new Set<number>(); // condiviso: risposte "oscurate" sullo schermo (EXPLOIT / Dottore)
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
        doubleOrNothing: false,
        dottoreEffect: null,
        dottoreHintText: null,
        awaitingDottoreChoice: false,
        dottoreChoiceTimer: 0
      };
      this.players.set(p.id, state);
    }
    this.onEvent({ type: 'intro', value: 1 });
  }

  currentQuestion(): QuizQuestion {
    return this.questions[this.questionIndex];
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
    if (index < 0 || index > 3 || this.hiddenIndices.has(index)) return;
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
      if (correct) p.points += Math.ceil(value / 2);
      return;
    }
    if (p.doubleOrNothing) {
      if (correct) {
        p.points += value * 2;
        p.correctTimeSum += p.answeredElapsed ?? 0;
      } else {
        p.points = Math.max(0, p.points - value);
      }
      return;
    }
    if (correct) {
      p.points += value;
      p.correctTimeSum += p.answeredElapsed ?? 0;
    }
  }

  /** Tasto ABILITÀ sul telefono. */
  useAbility(pid: PlayerId): void {
    const p = this.players.get(pid);
    if (!p || p.abilityUsed || !this.abilitiesAllowedNow()) return;

    switch (p.characterId) {
      case 'goblin':
        this.useGoblinExploit(p);
        break;
      case 'dottore':
        this.useDottoreDiagnosi(p);
        break;
      case 'judoka':
        this.useJudokaRethink(p);
        break;
      case 'ciro':
        this.useCiroDoubleOrNothing(p);
        break;
      case 'buttafuori':
        this.useButtafuoriSecondChance(p);
        break;
      default:
        break;
    }
  }

  private useGoblinExploit(p: QuizPlayerState): void {
    if (this.phase !== 'intro' && this.phase !== 'question') return;
    if (p.hasAnsweredFinal) return;
    const q = this.currentQuestion();
    const wrongIndices = [0, 1, 2, 3].filter((i) => i !== q.correctAnswerIndex);
    const shuffled = [...wrongIndices].sort(() => this.ctx.rng.next() - 0.5);
    const howMany = q.difficulty <= 6 ? 2 : 1;
    let added = 0;
    for (const i of shuffled) {
      if (added >= howMany || this.hiddenIndices.size >= 2) break;
      this.hiddenIndices.add(i);
      added++;
    }
    p.abilityUsed = true;
    this.onEvent({ type: 'exploit', playerId: p.playerId });
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
  }

  private useDottoreDiagnosi(p: QuizPlayerState): void {
    if (this.phase !== 'intro' && this.phase !== 'question') return;
    if (p.hasAnsweredFinal || p.awaitingDottoreChoice) return;
    p.awaitingDottoreChoice = true;
    p.dottoreChoiceTimer = CHOICE_TIMEOUT;
    p.abilityUsed = true;
    this.ctx.sendPrivate(p.playerId, {
      type: 'choice',
      title: 'DIAGNOSI SPERIMENTALE',
      options: [
        { id: 'dottore_a', label: 'SIRINGA A', icon: '💉' },
        { id: 'dottore_b', label: 'SIRINGA B', icon: '💉' },
        { id: 'dottore_c', label: 'SIRINGA C', icon: '💉' }
      ],
      timeoutMs: CHOICE_TIMEOUT * 1000
    });
    this.onEvent({ type: 'ability_used', playerId: p.playerId });
  }

  /** Da chiamare quando arriva la scelta della siringa (justPressed su dottore_a/b/c). */
  private resolveDottoreChoice(p: QuizPlayerState): void {
    const effect = rollDottoreEffect(() => this.ctx.rng.next());
    p.dottoreEffect = effect;
    p.awaitingDottoreChoice = false;
    switch (effect) {
      case 'remove_wrong': {
        const q = this.currentQuestion();
        const wrong = [0, 1, 2, 3].filter((i) => i !== q.correctAnswerIndex && !this.hiddenIndices.has(i));
        if (wrong.length > 0 && this.hiddenIndices.size < 2) {
          this.hiddenIndices.add(this.ctx.rng.pick(wrong));
        }
        break;
      }
      case 'extra_time':
        p.personalExtraDeadline += 8;
        break;
      case 'hint': {
        const q = this.currentQuestion();
        const wrong = [0, 1, 2, 3].filter((i) => i !== q.correctAnswerIndex && !this.hiddenIndices.has(i));
        if (wrong.length > 0) {
          const letter = ['A', 'B', 'C', 'D'][this.ctx.rng.pick(wrong)];
          p.dottoreHintText = `💡 Indizio: la risposta corretta NON è ${letter}.`;
        }
        break;
      }
      case 'faster_timer':
        p.personalExtraDeadline -= 3;
        break;
      case 'no_effect':
      default:
        break;
    }
    this.ctx.sendPrivate(p.playerId, {
      type: 'info',
      item: `💉 ${dottoreEffectLabel(effect)}`,
      ability: p.dottoreHintText ?? undefined
    });
    this.onEvent({ type: 'dottore_effect', playerId: p.playerId, value: DOTTORE_EFFECT_INDEX[effect] });
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

  private useCiroDoubleOrNothing(p: QuizPlayerState): void {
    if (this.phase !== 'intro') return;
    p.doubleOrNothing = true;
    p.abilityUsed = true;
    this.onEvent({ type: 'double_or_nothing', playerId: p.playerId });
    this.onEvent({ type: 'ability_used', playerId: p.playerId });
  }

  /** Da chiamare quando arriva un input col controlId di una scelta Dottore. */
  handleChoiceInput(pid: PlayerId, controlId: string): void {
    const p = this.players.get(pid);
    if (!p || !p.awaitingDottoreChoice) return;
    if (controlId === 'dottore_a' || controlId === 'dottore_b' || controlId === 'dottore_c') {
      this.resolveDottoreChoice(p);
    }
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
      if (p.awaitingDottoreChoice) {
        p.dottoreChoiceTimer -= dt;
        if (p.dottoreChoiceTimer <= 0) this.resolveDottoreChoice(p);
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
    const anyPending = players.some((p) => p.inSecondChanceGrace || p.awaitingDottoreChoice);
    const allAnswered = players.every((p) => p.hasAnsweredFinal);
    if (allAnswered && !anyPending) return true;
    // Se qualcuno è ancora dentro una finestra di grazia/scelta proprio allo
    // scadere del timer, le concediamo qualche secondo extra invece di
    // troncarla di netto (i suoi timer interni la chiuderanno comunque).
    const hardDeadline = this.effectiveDeadline() + (anyPending ? 4 : 0);
    return this.questionElapsed >= hardDeadline;
  }

  timeRemaining(): number {
    return Math.max(0, this.effectiveDeadline() - this.questionElapsed);
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
    this.questionIndex += 1;
    if (this.questionIndex >= this.questions.length) {
      this.enterResults();
      return;
    }
    this.hiddenIndices.clear();
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

  buildResults(): { playerId: PlayerId; placement: number; score: number }[] {
    return this.standings().map((p, i) => ({ playerId: p.playerId, placement: i + 1, score: p.points }));
  }
}

const DOTTORE_EFFECT_INDEX: Record<DottoreEffect, number> = {
  remove_wrong: 0,
  extra_time: 1,
  hint: 2,
  no_effect: 3,
  faster_timer: 4
};
