import { PartyBots } from '../bots/PartyBots';
import Phaser from 'phaser';
import { audio } from '../../core/AudioManager';
import { setGameIntensity } from '../../core/musicDirector';
import { PauseMenu } from '../../core/PauseMenu';
import { QuizRoundManager } from './QuizRoundManager';
import type { QuizHudEvent, QuizPhase } from './QuizRoundManager';
import { abilityNameFor, abilityDescriptionFor } from './abilities';
import { abilityHub } from '../../core/abilityHub';
import { stateLabel } from '../../../shared/abilityCatalog';
import type { MinigameContext } from '../types';
import type { PlayerId } from '../../../shared/types';
import { addBackdrop } from '../../scenes/backdrops';
import { UI, hexToInt } from '../../core/uiTokens';
import { displayText } from '../../core/uiPhaser';
import { addPortrait } from '../../core/portraits';
import type { Backdrop } from '../../scenes/backdrops';
import { FONT_DISPLAY, FONT_BODY } from '../../core/uiTokens';

const LETTERS = ['A', 'B', 'C', 'D'];
const OPTION_COLORS = [0xef4444, 0x3b82f6, 0x22c55e, 0xf59e0b];
const ABILITY_FLASH_DURATION = 2.2;

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
  private soloBots!: PartyBots;
  private ctx!: MinigameContext;
  private backdrop: Backdrop | null = null;
  private manager!: QuizRoundManager;
  private resultsSent = false;
  private quizStateTimer = 0;
  private lastSentPhase: QuizPhase | null = null;
  private controlsDone = false;
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

  private abilityFlashBg!: Phaser.GameObjects.Rectangle;
  private abilityFlashText!: Phaser.GameObjects.Text;
  private abilityFlashTimer = 0;

  private pauseMenu!: PauseMenu;

  constructor() {
    super('quiz');
  }

  create(data: { ctx: MinigameContext }): void {
    this.ctx = data.ctx;
    this.soloBots = new PartyBots(this.ctx);
    // RICOMINCIA riusa la stessa istanza di scena: azzera tutto lo stato custom.
    this.resultsSent = false;
    this.quizStateTimer = 0;
    this.lastSentPhase = null;
    this.optionBoxes = [];
    this.optionLetters = [];
    this.optionTexts = [];
    this.playerRows = new Map();
    this.leaderboardLines = [];
    this.abilityFlashTimer = 0;
    this.controlsDone = false;

    audio.unlock();
    abilityHub.begin('quiz', this.ctx);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => abilityHub.end());
    this.manager = new QuizRoundManager(this.ctx, (ev) => this.onHudEvent(ev));

    this.cameras.main.setBackgroundColor('#1e1b2e');
    this.backdrop = addBackdrop(this, 'quiz'); // scenografia: quiz TV che diventa assurdo (solo sfondo)

    // TESTATA: titolo del gioco piccolo, poi DOMANDA n/10, livello e valore come pillole discrete
    displayText(this, 640, UI.safe.y + 14, '📚 CHI CAZZO LO SA?', UI.size.M, UI.color.text);
    this.headerText = this.add
      .text(640, 86, '', { fontFamily: UI.font.display, fontSize: `${UI.size.S + 2}px`, color: UI.color.info })
      .setOrigin(0.5);
    this.starsText = this.add
      .text(UI.safe.x + 120, 86, '', { fontFamily: UI.font.display, fontSize: `${UI.size.XS}px`, color: UI.color.accent })
      .setOrigin(0.5);
    this.valueText = this.add
      .text(1280 - UI.safe.x - 120, 86, '', { fontFamily: UI.font.display, fontSize: `${UI.size.S}px`, color: UI.color.success })
      .setOrigin(0.5);
    this.categoryText = this.add
      .text(640, 114, '', { fontFamily: UI.font.body, fontStyle: 'bold', fontSize: `${UI.size.XS}px`, color: '#c4b5fd' })
      .setOrigin(0.5);
    this.finalBanner = this.add
      .text(640, 138, '', { fontFamily: UI.font.display, fontSize: `${UI.size.S}px`, color: UI.color.danger })
      .setOrigin(0.5);

    // DOMANDA: la cosa piu' grande dello schermo
    this.questionText = this.add
      .text(640, 160, '', { fontFamily: UI.font.display, fontSize: `${UI.size.L - 4}px`, color: UI.color.text, align: 'center', wordWrap: { width: 1100 } })
      .setOrigin(0.5, 0)
      .setStroke(UI.outline.color, UI.outline.thin)
      .setShadow(0, UI.shadow.y, UI.shadow.color, UI.shadow.blur, true, true);

    // RISPOSTE 2x2: stessa misura, stesso peso, nessun indizio grafico sulla corretta (fino alla rivelazione)
    for (let i = 0; i < 4; i++) {
      const x = i % 2 === 0 ? 352 : 928;
      const y = i < 2 ? 330 : 438;
      const box = this.add.rectangle(x, y, 548, 94, OPTION_COLORS[i], 0.92).setStrokeStyle(4, 0xffffff);
      this.add.circle(x - 232, y, 30, 0xffffff, 0.95).setDepth(1);
      const letter = this.add
        .text(x - 232, y, LETTERS[i], { fontFamily: UI.font.display, fontSize: `${UI.size.M}px`, color: '#0b0b14' })
        .setOrigin(0.5)
        .setDepth(2);
      const t = this.add
        .text(x - 186, y, '', { fontFamily: UI.font.display, fontSize: `${UI.size.M - 2}px`, color: '#0b0b14', align: 'left', wordWrap: { width: 440 } })
        .setOrigin(0, 0.5)
        .setDepth(2);
      this.optionBoxes.push(box);
      this.optionLetters.push(letter);
      this.optionTexts.push(t);
    }

    // TIMER: grande e centrato sotto le risposte
    this.countdownText = displayText(this, 640, 534, '', UI.size.L, UI.color.text);

    this.explanationText = this.add
      .text(640, 400, '', {
        fontFamily: FONT_BODY,
        fontSize: '22px',
        color: '#e5e7eb',
        align: 'center',
        wordWrap: { width: 1000 }
      })
      .setOrigin(0.5);

    this.buildPlayerRows();

    this.leaderboardPanel = this.add.rectangle(640, 340, 680, 400, hexToInt(UI.color.panel), 0.95).setStrokeStyle(3, hexToInt(UI.color.accent)).setVisible(false);
    this.leaderboardTitle = this.add
      .text(640, 180, 'CLASSIFICA QUIZ', { fontFamily: UI.font.display, fontSize: `${UI.size.L - 8}px`, color: UI.color.accent })
      .setOrigin(0.5)
      .setVisible(false);
    for (let i = 0; i < 5; i++) {
      const line = this.add
        .text(640, 240 + i * 52, '', { fontFamily: UI.font.display, fontSize: `${UI.size.M - 2}px`, color: '#ffffff' })
        .setOrigin(0.5)
        .setVisible(false);
      this.leaderboardLines.push(line);
    }

    // Banner "nome abilità a schermo" quando un giocatore la usa (vale per tutti e 5 i personaggi).
    this.abilityFlashBg = this.add.rectangle(640, 534, 760, 74, 0x000000, 0.85).setDepth(20).setStrokeStyle(3, 0xfacc15).setVisible(false);
    this.abilityFlashText = this.add
      .text(640, 534, '', {
        fontFamily: UI.font.display,
        fontSize: `${UI.size.M - 2}px`,
        color: '#facc15',
        align: 'center',
        wordWrap: { width: 720 }
      })
      .setOrigin(0.5)
      .setVisible(false);

    this.pauseMenu = new PauseMenu(this, '📚 CHI CAZZO LO SA?', this.ctx.input, () => this.scene.restart({ ctx: this.ctx }));

    // Schermata CONTROLLI: finche' e' su, il quiz resta fermo (nessun secondo di intro/timer perso, vedi update()).
    if (this.ctx.showControls) void this.ctx.showControls().then(() => { this.controlsDone = true; });
    else this.controlsDone = true;

  }

  private buildPlayerRows(): void {
    const n = this.ctx.players.length;
    const gap = 10;
    const rowW = Math.min(244, Math.floor((1280 - UI.safe.x * 2 - gap * (n - 1)) / Math.max(1, n)));
    const x0 = 640 - ((n - 1) * (rowW + gap)) / 2;
    const y = 720 - UI.safe.y - 46;
    this.ctx.players.forEach((p, i) => {
      const x = x0 + i * (rowW + gap);
      const bg = this.add.rectangle(x, y, rowW, 92, hexToInt(UI.color.panel), UI.color.panelAlpha).setStrokeStyle(2, Phaser.Display.Color.HexStringToColor(p.color).color);
      addPortrait(this, x - rowW / 2 + 32, y - 14, p.characterId, 46);
      const left = x - rowW / 2 + 62;
      const name = this.add
        .text(left, y - 36, p.displayName.toUpperCase(), { fontFamily: UI.font.display, fontSize: `${UI.size.XS + 1}px`, color: p.color })
        .setOrigin(0, 0);
      while (name.width > rowW - 70 && name.text.length > 4) name.setText(`${name.text.slice(0, -2)}…`);
      const points = this.add
        .text(left, y - 12, '0 pt', { fontFamily: UI.font.display, fontSize: `${UI.size.S}px`, color: UI.color.text })
        .setOrigin(0, 0);
      const status = this.add
        .text(x, y + 22, '', { fontFamily: UI.font.display, fontSize: `${UI.size.XS}px`, color: UI.color.muted })
        .setOrigin(0.5, 0.5);
      const ability = this.add
        .text(x, y + 40, '', { fontFamily: UI.font.body, fontStyle: 'bold', fontSize: `${UI.size.XS - 2}px`, color: '#a78bfa' })
        .setOrigin(0.5, 0.5);
      this.playerRows.set(p.id, { bg, name, status, points, ability });
    });
  }

  private lastTickSec = -1;

  private onHudEvent(ev: QuizHudEvent): void {
    switch (ev.type) {
      case 'reveal':
        audio.quizReveal();
        break;
      case 'nculo':
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
      case 'dottore_hint':
        audio.select();
        if (ev.playerId) this.ctx.vibrate(ev.playerId, 60);
        break;
      case 'ultimo_giorno':
        audio.tick();
        if (ev.playerId) this.ctx.vibrate(ev.playerId, 60);
        break;
      case 'ability_used':
        if (ev.playerId) {
          this.flashAbilityName(ev.playerId);
          abilityHub.activated(ev.playerId);
        }
        break;
      case 'final_question':
        audio.announcer('FINAL_ROUND');
        setGameIntensity(2);
        break;
      case 'intro':
        audio.quizQuestion();
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

  /** "Il nome dell'abilità appare a schermo" quando un giocatore la usa (qualsiasi personaggio). */
  private flashAbilityName(playerId: PlayerId): void {
    const p = this.ctx.players.find((pp) => pp.id === playerId);
    const ps = this.manager.players.get(playerId);
    if (!p || !ps) return;
    this.abilityFlashText.setText(`${p.avatar} ${p.displayName} — ${abilityNameFor(ps.characterId)}!`);
    this.abilityFlashText.setColor(p.color);
    this.abilityFlashBg.setVisible(true);
    this.abilityFlashText.setVisible(true);
    this.abilityFlashTimer = ABILITY_FLASH_DURATION;
  }

  update(_t: number, deltaMs: number): void {
    if (this.pauseMenu.update()) return;
    if (!this.controlsDone) {
      this.ctx.input.update(); // schermata CONTROLLI: nessuna fase avanza, nessun input di gioco consumato
      return;
    }
    const dt = Math.min(deltaMs, 250) / 1000; // tempo reale fino a ~4 FPS
    // La scadenza viene applicata prima di consumare gli input di questo frame.
    this.manager.update(dt);

    const botQuestion = this.manager.currentQuestion();
    this.soloBots.quiz(dt, this.manager.phase, `${this.manager.questionIndex}:${botQuestion.id}`, botQuestion.difficulty, botQuestion.correctAnswerIndex);
    for (const pid of this.ctx.playerIds) {
      const input = this.ctx.input.get(pid);
      const phoneAnswer = input.text('quizAnswer');
      input.clearText('quizAnswer');
      if (phoneAnswer) {
        try {
          const [roundId, questionKey, revision, index] = JSON.parse(phoneAnswer);
          if (roundId === (this.ctx.roundId ?? 0) && typeof questionKey === 'string' && Number.isInteger(revision)) {
            this.manager.submitAnswer(pid, index, questionKey, revision);
          }
        } catch { /* input non valido: nessuna risposta */ }
        this.quizStateTimer = 0;
      }
      // Gli input A/B/C/D sono riservati ai bot locali; i telefoni confermano con identità della domanda.
      const isBot = this.ctx.players.find(p => p.id === pid)?.bot;
      if (isBot && input.justPressed('answerA')) this.manager.submitAnswer(pid, 0);
      else if (isBot && input.justPressed('answerB')) this.manager.submitAnswer(pid, 1);
      else if (isBot && input.justPressed('answerC')) this.manager.submitAnswer(pid, 2);
      else if (isBot && input.justPressed('answerD')) this.manager.submitAnswer(pid, 3);

      if (input.justPressed('ability')) {
        // premuta ma non partita: avviso privato col motivo, mai silenzio
        const why = this.manager.useAbility(pid);
        if (why) abilityHub.failed(pid, why);
        this.quizStateTimer = 0;
      }
      abilityHub.setStatus(pid, this.manager.abilityStatus(pid)); // card sul telefono (solo presentazione)
    }

    this.render();
    this.syncQuizState(dt);

    if (this.abilityFlashTimer > 0) {
      this.abilityFlashTimer -= dt;
      if (this.abilityFlashTimer <= 0) {
        this.abilityFlashBg.setVisible(false);
        this.abilityFlashText.setVisible(false);
      }
    }

    if (this.manager.finished && !this.resultsSent) {
      this.resultsSent = true;
      this.time.delayedCall(1200, () => {
        this.ctx.finish({ results: this.manager.buildResults() });
      });
    }

    this.ctx.input.update();
  }

  /** Stato live per il controller "TV quiz show" del telefono (layout custom quiz-tv). */
  private syncQuizState(dt: number): void {
    const m = this.manager;
    const phase = m.phase;
    this.quizStateTimer -= dt;
    const phaseChanged = phase !== this.lastSentPhase;
    if (!phaseChanged && this.quizStateTimer > 0) return;
    this.lastSentPhase = phase;
    this.quizStateTimer = 0.35;

    const q = m.currentQuestion();
    const qNum = m.questionIndex + 1;
    const revealed = phase === 'reveal' || phase === 'explanation' || phase === 'leaderboard';

    for (const p of this.ctx.players) {
      const ps = m.players.get(p.id);
      if (!ps) continue;
      this.ctx.sendPrivate(p.id, {
        type: 'quizState',
        roundId: this.ctx.roundId ?? 0,
        questionKey: m.questionKey(),
        answerRevision: ps.answerRevision,
        canAnswer: m.canAnswer(p.id),
        answerTimeRemaining: m.answerTimeRemaining(p.id),
        answerStatus: ps.hasAnsweredFinal ? 'confirmed' : ps.inSecondChanceGrace ? (ps.secondChanceArmed ? 'retry' : 'grace') : ps.ciroWaiting ? 'waiting' : 'open',
        phase,
        questionNumber: qNum,
        totalQuestions: 10,
        points: qNum,
        category: q.category,
        question: q.question,
        answers: q.answers,
        myAnswerIndex: ps.answerIndex,
        correctIndex: revealed ? q.correctAnswerIndex : null,
        timeRemaining: phase === 'question' ? m.timeRemaining() : 0,
        totalTime: phase === 'question' ? m.totalTime() : 0,
        playerName: p.displayName,
        avatar: p.avatar,
        myScore: ps.points,
        abilityName: abilityNameFor(p.characterId),
        abilityDescription: abilityDescriptionFor(p.characterId),
        abilityUsed: ps.abilityUsed,
        hintText: ps.dottoreHintText,
        ciroBreakdown: m.ciroBreakdown(p.id)
      });
    }
  }

  private render(): void {
    const m = this.manager;
    const q = m.currentQuestion();
    const phase = m.phase;
    const qNum = m.questionIndex + 1;
    const isFinal = qNum === 10;

    this.headerText.setText(`DOMANDA ${qNum}/10`);
    this.backdrop?.setAbsurd((qNum - 1) / 9);
    // livello 1..10: elegante, non enorme (forma + numero, non solo colore)
    this.starsText.setText(`LIVELLO ${'●'.repeat(q.difficulty)}${'○'.repeat(10 - q.difficulty)} ${q.difficulty}/10`);
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
      this.optionTexts[i].setText(q.answers[i]);
      let fill = OPTION_COLORS[i];
      let alpha = 0.92;
      if (phase === 'reveal') {
        if (i === q.correctAnswerIndex) fill = 0x22c55e;
        else fill = 0x3f3f46;
        alpha = 0.95;
      }
      this.optionBoxes[i].setFillStyle(fill, alpha);
      this.optionLetters[i].setText(LETTERS[i]);
    }

    this.countdownText.setVisible(phase === 'question');
    if (phase === 'question') {
      const remain = m.timeRemaining();
      this.countdownText.setText(`⏱ ${remain.toFixed(1)}`);
      this.countdownText.setColor(remain <= 3 ? UI.color.danger : remain <= 5 ? UI.color.accent : UI.color.text);
      // tensione: un tic per ogni secondo degli ultimi 5 (piu' urgente negli ultimi 3). Nessun suono per la risposta del
      // singolo giocatore: nessuna informazione privata passa dall'audio.
      const sec = Math.ceil(remain);
      if (sec <= 5 && sec >= 1 && sec !== this.lastTickSec) {
        this.lastTickSec = sec;
        audio.quizTick(sec <= 3);
      }
    } else {
      this.lastTickSec = -1;
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
        else if (ps.ciroWaiting && !ps.hasAnsweredFinal) row.status.setText('⏳ ULTIMO GIORNO...').setColor('#fbbf24');
        else if (ps.hasAnsweredFinal) row.status.setText('✅ RISPOSTO').setColor('#4ade80');
        else row.status.setText('...').setColor('#9ca3af');
      } else if (phase === 'reveal' || phase === 'explanation') {
        if (ps.lastCorrect) row.status.setText('✅ CORRETTO').setColor('#4ade80');
        else row.status.setText('❌ SBAGLIATO').setColor('#f87171');
      } else {
        row.status.setText('');
      }

      row.points.setText(`${ps.points} pt`);
      // riga ABILITA' (stesso stato che vede il telefono): nome + PRONTA / ATTIVA / usata
      const ab = m.abilityStatus(p.id);
      if (ab.state === 'SPENT') row.ability.setText(`${abilityNameFor(p.characterId)} · usata`).setColor('#6b7280');
      else if (ab.state === 'ACTIVE') row.ability.setText(`⚡ ${abilityNameFor(p.characterId)} · ${stateLabel(ab)}`).setColor('#facc15');
      else row.ability.setText(abilityNameFor(p.characterId)).setColor('#a78bfa');
    }
  }
}
