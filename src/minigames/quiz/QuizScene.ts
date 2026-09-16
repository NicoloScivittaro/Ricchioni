import Phaser from 'phaser';
import { HOOKS } from '../../../shared/hooks';
import { audio } from '../../core/AudioManager';
import { QUESTIONS } from './questions';
import type { Question } from './questions';
import type { MinigameContext } from '../types';
import type { PlayerId } from '../../../shared/types';

const Q_COUNT = 5;
const QUESTION_TIME_MS = 10000;
const EXTRA_TIME_PER_HOOK_MS = 2000;

/**
 * CHI CAZZO LO SA? — quiz rapido, tutti rispondono dal telefono in contemporanea.
 * Legge gli input tramite ctx.input (PlayerInput) e applica gli hook:
 * quiz.remove_answer (opzione sbagliata rimossa), quiz.extra_time (tempo extra).
 */
export class QuizScene extends Phaser.Scene {
  private ctx!: MinigameContext;
  private questions: Question[] = [];
  private index = 0;
  private correctCount = new Map<PlayerId, number>();
  private answeredThisRound = new Set<PlayerId>();
  private dimmedOptions = new Set<number>();
  private questionEndsAt = 0;
  private timerEvent?: Phaser.Time.TimerEvent;
  private finished = false;

  private promptText!: Phaser.GameObjects.Text;
  private optionTexts: Phaser.GameObjects.Text[] = [];
  private optionBoxes: Phaser.GameObjects.Rectangle[] = [];
  private optionLetters: Phaser.GameObjects.Text[] = [];
  private playerIndicators: Phaser.GameObjects.Text[] = [];
  private countdownText!: Phaser.GameObjects.Text;

  constructor() {
    super('quiz');
  }

  create(data: { ctx: MinigameContext }): void {
    this.ctx = data.ctx;
    audio.unlock();
    this.questions = this.ctx.rng.shuffle(QUESTIONS).slice(0, Q_COUNT);
    for (const p of this.ctx.players) this.correctCount.set(p.id, 0);

    this.cameras.main.setBackgroundColor('#1e1b2e');

    this.add
      .text(640, 24, '📚 CHI CAZZO LO SA?', {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: '42px',
        color: '#ffffff'
      })
      .setOrigin(0.5, 0);

    if (this.ctx.modifier) {
      this.add
        .text(640, 76, `⚡ ${this.ctx.modifier.name} — ${this.ctx.modifier.description}`, {
          fontFamily: 'Arial, sans-serif',
          fontSize: '20px',
          color: '#fbbf24'
        })
        .setOrigin(0.5, 0);
    }

    this.promptText = this.add
      .text(640, 145, '', {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: '34px',
        color: '#ffffff',
        align: 'center',
        wordWrap: { width: 1080 }
      })
      .setOrigin(0.5, 0);

    const labels = ['A', 'B', 'C', 'D'];
    const colors = [0xef4444, 0x3b82f6, 0x22c55e, 0xf59e0b];
    for (let i = 0; i < 4; i++) {
      const x = 320 + i * 220;
      const box = this.add
        .rectangle(x, 390, 200, 130, colors[i], 0.9)
        .setStrokeStyle(4, 0xffffff);
      const letter = this.add
        .text(x, 305, labels[i], {
          fontFamily: '"Arial Black", Arial, sans-serif',
          fontSize: '34px',
          color: '#000000'
        })
        .setOrigin(0.5);
      const t = this.add
        .text(x, 400, '', {
          fontFamily: 'Arial, sans-serif',
          fontSize: '19px',
          color: '#000000',
          align: 'center',
          wordWrap: { width: 180 }
        })
        .setOrigin(0.5);
      this.optionBoxes.push(box);
      this.optionLetters.push(letter);
      this.optionTexts.push(t);
    }

    this.countdownText = this.add
      .text(640, 500, '', {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: '30px',
        color: '#f87171'
      })
      .setOrigin(0.5);

    this.ctx.players.forEach((p, idx) => {
      const ind = this.add
        .text(30 + idx * 248, 640, `${p.avatar} ${p.displayName}`, {
          fontFamily: 'Arial, sans-serif',
          fontSize: '18px',
          color: p.color
        })
        .setOrigin(0, 0.5);
      this.playerIndicators.push(ind);
    });

    this.add
      .text(640, 692, 'Rispondi dal tuo telefono: premi A, B, C o D', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '16px',
        color: '#9ca3af'
      })
      .setOrigin(0.5);

    this.nextQuestion();
  }

  private hasHook(pid: PlayerId, hook: string): boolean {
    return (this.ctx.modifiers.get(pid) ?? []).some((m) => m.hook === hook);
  }

  private nextQuestion(): void {
    if (this.index >= this.questions.length) {
      this.endGame();
      return;
    }

    const q = this.questions[this.index];
    this.answeredThisRound.clear();
    this.dimmedOptions.clear();

    this.promptText.setText(`Domanda ${this.index + 1}/${Q_COUNT}\n${q.prompt}`);

    const removers = this.ctx.playerIds.filter((pid) => this.hasHook(pid, HOOKS.quiz_remove_answer));
    const wrongIndices = [0, 1, 2, 3].filter((i) => i !== q.correct);
    const shuffledWrong = this.ctx.rng.shuffle(wrongIndices);
    shuffledWrong
      .slice(0, Math.min(removers.length, wrongIndices.length - 1))
      .forEach((i) => this.dimmedOptions.add(i));

    q.options.forEach((opt, i) => {
      this.optionTexts[i].setText(opt);
      const dimmed = this.dimmedOptions.has(i);
      this.optionBoxes[i].setAlpha(dimmed ? 0.25 : 0.9);
      this.optionLetters[i].setText(dimmed ? '✖' : ['A', 'B', 'C', 'D'][i]);
      this.optionTexts[i].setAlpha(dimmed ? 0.4 : 1);
    });

    const extra = this.ctx.playerIds.reduce((acc, pid) => {
      const n = (this.ctx.modifiers.get(pid) ?? []).filter((m) => m.hook === HOOKS.quiz_extra_time).length;
      return acc + n * EXTRA_TIME_PER_HOOK_MS;
    }, 0);
    this.questionEndsAt = this.time.now + QUESTION_TIME_MS + extra;
    this.timerEvent?.remove();
    this.timerEvent = this.time.delayedCall(QUESTION_TIME_MS + extra, () => this.advance());
  }

  private answer(pid: PlayerId, option: number): void {
    if (this.finished || this.answeredThisRound.has(pid)) return;
    if (this.dimmedOptions.has(option)) return;

    this.answeredThisRound.add(pid);
    const q = this.questions[this.index];
    const correct = option === q.correct;
    const idx = this.ctx.playerIds.indexOf(pid);
    const indicator = this.playerIndicators[idx];

    if (correct) {
      this.correctCount.set(pid, (this.correctCount.get(pid) ?? 0) + 1);
      audio.correct();
      indicator.setText(`${this.ctx.players[idx].avatar} ${this.ctx.players[idx].displayName}  ✔`);
      indicator.setColor('#4ade80');
    } else {
      audio.wrong();
      indicator.setText(`${this.ctx.players[idx].avatar} ${this.ctx.players[idx].displayName}  ✘`);
      indicator.setColor('#f87171');
    }

    if (this.answeredThisRound.size >= this.ctx.playerIds.length) {
      this.timerEvent?.remove();
      this.time.delayedCall(700, () => this.advance());
    }
  }

  private advance(): void {
    this.index += 1;
    this.ctx.players.forEach((p, i) => {
      this.playerIndicators[i].setText(`${p.avatar} ${p.displayName}`);
      this.playerIndicators[i].setColor(p.color);
    });
    this.nextQuestion();
  }

  private endGame(): void {
    if (this.finished) return;
    this.finished = true;
    const ranking = [...this.ctx.playerIds].sort((a, b) => {
      const d = (this.correctCount.get(b) ?? 0) - (this.correctCount.get(a) ?? 0);
      return d !== 0 ? d : this.ctx.playerIds.indexOf(a) - this.ctx.playerIds.indexOf(b);
    });
    const stats: Record<PlayerId, Record<string, number>> = {};
    for (const pid of this.ctx.playerIds) {
      stats[pid] = { risposteCorrette: this.correctCount.get(pid) ?? 0 };
    }
    this.ctx.finish({ ranking, stats });
  }

  update(): void {
    if (this.finished) return;

    // 1) raccogli le risposte (justPressed accumulati dall'ultimo frame)
    for (const pid of this.ctx.playerIds) {
      const input = this.ctx.input.get(pid);
      if (input.justPressed('answerA')) this.answer(pid, 0);
      else if (input.justPressed('answerB')) this.answer(pid, 1);
      else if (input.justPressed('answerC')) this.answer(pid, 2);
      else if (input.justPressed('answerD')) this.answer(pid, 3);
    }

    // 2) countdown
    const remaining = Math.max(0, this.questionEndsAt - this.time.now);
    this.countdownText.setText(remaining > 0 ? `${(remaining / 1000).toFixed(1)}s` : '');

    // 3) a fine frame azzera gli edge justPressed/justReleased
    this.ctx.input.update();
  }
}
