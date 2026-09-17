import Phaser from 'phaser';
import { audio } from '../../core/AudioManager';
import { QuizRoundManager } from './QuizRoundManager';
import type { QuizHudEvent } from './QuizRoundManager';
import { abilityNameFor } from './abilities';
import type { MinigameContext } from '../types';
import type { PlayerId } from '../../../shared/types';

const LETTERS = ['A', 'B', 'C', 'D'];
const OPTION_COLORS = [0xef4444, 0x3b82f6, 0x22c55e, 0xf59e0b];
const ABILITY_CONTROL_IDS = ['dottore_a', 'dottore_b', 'dottore_c'];

interface PlayerRow {
  bg: Phaser.GameObjects.Rectangle;
  name: Phaser.GameObjects.Text;
  status: Phaser.GameObjects.Text;
  points: Phaser.GameObjects.Text;
  ability: Phaser.GameObjects.Text;
}

/**
 * CHI CAZZO LO SA? — quiz "TV show" per 1-5 giocatori. Il rendering è un
 * guscio sottile: tutta la logica (fasi, punteggio, abilità) vive in
 * QuizRoundManager (nessuna dipendenza da Phaser), qui si legge lo stato e
 * si disegna, e si inoltrano gli input del telefono al manager.
 */
export class QuizScene extends Phaser.Scene {
  private ctx!: MinigameContext;
  private manager!: QuizRoundManager;
  private resultsSent = false;

  private headerText!: Phaser.GameObjects.Text;
  private starsText!: Phaser.GameObjects.Text;
  private valueText!: Phaser.GameObjects.Text;
  private categoryText!: Phaser.GameObjects.Text;
  private finalBanner!: Phaser.GameObjects.Text;
  private questionText!: Phaser.GameObjects.Text;
  private explanationText!: Phaser.GameObjects.Text;
  private countdownText!: Phaser.GameObjects.Text;

  private optionBoxes: Phaser.GameObjects.Rectangle[] = [];
  private optionLetters: Phaser.GameObjects.Text[] = [];
  private optionTexts: Phaser.GameObjects.Text[] = [];

  private playerRows = new Map<PlayerId, PlayerRow>();
  private leaderboardPanel!: Phaser.GameObjects.Rectangle;
  private leaderboardTitle!: Phaser.GameObjects.Text;
  private leaderboardLines: Phaser.GameObjects.Text[] = [];

  constructor() {
    super('quiz');
  }

  create(data: { ctx: MinigameContext }): void {
    this.ctx = data.ctx;
    audio.unlock();
    this.resultsSent = false;
    this.manager = new QuizRoundManager(this.ctx, (ev) => this.onHudEvent(ev));

    this.cameras.main.setBackgroundColor('#1e1b2e');

    this.add
      .text(640, 16, '📚 CHI CAZZO LO SA?', {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: '34px',
        color: '#ffffff'
      })
      .setOrigin(0.5, 0);

    this.headerText = this.add
      .text(640, 66, '', { fontFamily: '"Arial Black", Arial, sans-serif', fontSize: '22px', color: '#93c5fd' })
      .setOrigin(0.5, 0);
    this.starsText = this.add
      .text(400, 66, '', { fontFamily: 'Arial, sans-serif', fontSize: '22px', color: '#fbbf24' })
      .setOrigin(0.5, 0);
    this.valueText = this.add
      .text(880, 66, '', { fontFamily: '"Arial Black", Arial, sans-serif', fontSize: '20px', color: '#4ade80' })
      .setOrigin(0.5, 0);
    this.categoryText = this.add
      .text(640, 96, '', { fontFamily: 'Arial, sans-serif', fontSize: '17px', color: '#c4b5fd' })
      .setOrigin(0.5, 0);
    this.finalBanner = this.add
      .text(640, 120, '', { fontFamily: '"Arial Black", Arial, sans-serif', fontSize: '20px', color: '#f87171' })
      .setOrigin(0.5, 0);

    this.questionText = this.add
      .text(640, 155, '', {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: '28px',
        color: '#ffffff',
        align: 'center',
        wordWrap: { width: 1080 }
      })
      .setOrigin(0.5, 0);

    for (let i = 0; i < 4; i++) {
      const x = 320 + i * 220;
      const box = this.add.rectangle(x, 400, 200, 120, OPTION_COLORS[i], 0.92).setStrokeStyle(4, 0xffffff);
      const letter = this.add
        .text(x, 320, LETTERS[i], { fontFamily: '"Arial Black", Arial, sans-serif', fontSize: '30px', color: '#000000' })
        .setOrigin(0.5);
      const t = this.add
        .text(x, 405, '', {
          fontFamily: 'Arial, sans-serif',
          fontSize: '17px',
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
      .text(640, 480, '', { fontFamily: '"Arial Black", Arial, sans-serif', fontSize: '30px', color: '#f87171' })
      .setOrigin(0.5);

    this.explanationText = this.add
      .text(640, 400, '', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '22px',
        color: '#e5e7eb',
        align: 'center',
        wordWrap: { width: 1000 }
      })
      .setOrigin(0.5);

    this.buildPlayerRows();

    this.leaderboardPanel = this.add.rectangle(640, 360, 620, 420, 0x0b0b14, 0.94).setStrokeStyle(3, 0xfbbf24).setVisible(false);
    this.leaderboardTitle = this.add
      .text(640, 180, 'CLASSIFICA QUIZ', { fontFamily: '"Arial Black", Arial, sans-serif', fontSize: '30px', color: '#fbbf24' })
      .setOrigin(0.5)
      .setVisible(false);
    for (let i = 0; i < 5; i++) {
      const line = this.add
        .text(640, 235 + i * 48, '', { fontFamily: '"Arial Black", Arial, sans-serif', fontSize: '22px', color: '#ffffff' })
        .setOrigin(0.5)
        .setVisible(false);
      this.leaderboardLines.push(line);
    }
  }

  private buildPlayerRows(): void {
    const n = this.ctx.players.length;
    const rowW = Math.min(240, Math.floor(1240 / Math.max(1, n)));
    this.ctx.players.forEach((p, i) => {
      const x = 20 + i * rowW + rowW / 2;
      const bg = this.add.rectangle(x, 660, rowW - 10, 80, 0x000000, 0.35).setStrokeStyle(2, Phaser.Display.Color.HexStringToColor(p.color).color);
      const name = this.add
        .text(x, 630, `${p.avatar} ${p.displayName}`, { fontFamily: 'Arial, sans-serif', fontSize: '14px', color: p.color })
        .setOrigin(0.5);
      const status = this.add
        .text(x, 650, '', { fontFamily: '"Arial Black", Arial, sans-serif', fontSize: '15px', color: '#9ca3af' })
        .setOrigin(0.5);
      const points = this.add
        .text(x, 670, '0 pt', { fontFamily: 'Arial, sans-serif', fontSize: '13px', color: '#e5e7eb' })
        .setOrigin(0.5);
      const ability = this.add
        .text(x, 690, '', { fontFamily: 'Arial, sans-serif', fontSize: '12px', color: '#a78bfa' })
        .setOrigin(0.5);
      this.playerRows.set(p.id, { bg, name, status, points, ability });
    });
  }

  private onHudEvent(ev: QuizHudEvent): void {
    switch (ev.type) {
      case 'reveal':
        audio.select();
        break;
      case 'exploit':
        audio.boost();
        if (ev.playerId) this.ctx.vibrate(ev.playerId, 90);
        break;
      case 'second_chance':
        audio.tick();
        if (ev.playerId) this.ctx.vibrate(ev.playerId, 70);
        break;
      case 'rethink':
        audio.select();
        if (ev.playerId) this.ctx.vibrate(ev.playerId, 70);
        break;
      case 'double_or_nothing':
        audio.hit();
        if (ev.playerId) this.ctx.vibrate(ev.playerId, 100);
        break;
      case 'dottore_effect':
        audio.select();
        if (ev.playerId) this.ctx.vibrate(ev.playerId, 60);
        break;
      case 'final_question':
        audio.fanfare();
        break;
      case 'leaderboard':
        audio.tick();
        break;
      case 'results':
        audio.fanfare();
        break;
      default:
        break;
    }
  }

  update(_t: number, deltaMs: number): void {
    const dt = Math.min(deltaMs, 80) / 1000;

    for (const pid of this.ctx.playerIds) {
      const input = this.ctx.input.get(pid);
      if (input.justPressed('answerA')) this.manager.submitAnswer(pid, 0);
      else if (input.justPressed('answerB')) this.manager.submitAnswer(pid, 1);
      else if (input.justPressed('answerC')) this.manager.submitAnswer(pid, 2);
      else if (input.justPressed('answerD')) this.manager.submitAnswer(pid, 3);

      if (input.justPressed('ability')) this.manager.useAbility(pid);
      for (const cid of ABILITY_CONTROL_IDS) {
        if (input.justPressed(cid)) this.manager.handleChoiceInput(pid, cid);
      }
    }

    this.manager.update(dt);
    this.render();

    if (this.manager.finished && !this.resultsSent) {
      this.resultsSent = true;
      this.time.delayedCall(1200, () => {
        this.ctx.finish({ results: this.manager.buildResults() });
      });
    }

    this.ctx.input.update();
  }

  private render(): void {
    const m = this.manager;
    const q = m.currentQuestion();
    const phase = m.phase;
    const qNum = m.questionIndex + 1;
    const isFinal = qNum === 10;

    this.headerText.setText(`DOMANDA ${qNum}/10`);
    this.starsText.setText('★'.repeat(q.difficulty) + '☆'.repeat(10 - q.difficulty));
    this.valueText.setText(`${qNum} PUNT${qNum === 1 ? 'O' : 'I'}`);
    this.categoryText.setText(q.category.toUpperCase());
    this.finalBanner.setText(isFinal && (phase === 'intro' || phase === 'question') ? 'DOMANDA FINALE — DIFFICOLTÀ MASSIMA' : '');
    this.finalBanner.setColor(isFinal ? '#f87171' : '#f87171');

    const showBoard = phase === 'question' || phase === 'reveal';
    this.questionText.setVisible(phase !== 'leaderboard').setText(q.question);
    for (let i = 0; i < 4; i++) {
      this.optionBoxes[i].setVisible(showBoard);
      this.optionLetters[i].setVisible(showBoard);
      this.optionTexts[i].setVisible(showBoard);
      if (!showBoard) continue;
      const hidden = m.hiddenIndices.has(i);
      this.optionTexts[i].setText(q.answers[i]);
      let fill = OPTION_COLORS[i];
      let alpha = hidden ? 0.2 : 0.92;
      if (phase === 'reveal') {
        if (i === q.correctAnswerIndex) fill = 0x22c55e;
        else fill = 0x3f3f46;
        alpha = hidden ? 0.3 : 0.95;
      }
      this.optionBoxes[i].setFillStyle(fill, alpha);
      this.optionLetters[i].setText(hidden ? '✖' : LETTERS[i]);
    }

    this.countdownText.setVisible(phase === 'question');
    if (phase === 'question') {
      const remain = m.timeRemaining();
      this.countdownText.setText(`${remain.toFixed(1)}s`);
      this.countdownText.setColor(remain <= 3 ? '#f87171' : '#e5e7eb');
    }

    this.explanationText.setVisible(phase === 'explanation').setText(phase === 'explanation' ? `💡 ${q.explanation}` : '');

    const showLeaderboard = phase === 'leaderboard';
    this.leaderboardPanel.setVisible(showLeaderboard);
    this.leaderboardTitle.setVisible(showLeaderboard);
    const standings = showLeaderboard ? m.standings() : [];
    this.leaderboardLines.forEach((line, i) => {
      const s = standings[i];
      if (s && showLeaderboard) {
        line.setVisible(true).setText(`${i + 1}° ${s.avatar} ${s.displayName} — ${s.points} pt`).setColor(s.color);
      } else {
        line.setVisible(false);
      }
    });

    for (const p of this.ctx.players) {
      const row = this.playerRows.get(p.id);
      const ps = m.players.get(p.id);
      if (!row || !ps) continue;

      if (phase === 'question' || phase === 'intro') {
        if (ps.inSecondChanceGrace && !ps.secondChanceArmed) row.status.setText('❓ MO HO CAPITO?').setColor('#fbbf24');
        else if (ps.inSecondChanceGrace && ps.secondChanceArmed) row.status.setText('🔁 RIPROVA...').setColor('#fbbf24');
        else if (ps.hasAnsweredFinal) row.status.setText('✅ RISPOSTO').setColor('#4ade80');
        else if (ps.awaitingDottoreChoice) row.status.setText('💉 SCEGLIE...').setColor('#22d3ee');
        else row.status.setText('...').setColor('#9ca3af');
      } else if (phase === 'reveal' || phase === 'explanation') {
        if (ps.lastCorrect) row.status.setText('✅ CORRETTO').setColor('#4ade80');
        else row.status.setText('❌ SBAGLIATO').setColor('#f87171');
      } else {
        row.status.setText('');
      }

      row.points.setText(`${ps.points} pt`);
      if (ps.abilityUsed) row.ability.setText(`${abilityNameFor(p.characterId)} · usata`).setColor('#6b7280');
      else row.ability.setText(abilityNameFor(p.characterId)).setColor('#a78bfa');
    }
  }
}
