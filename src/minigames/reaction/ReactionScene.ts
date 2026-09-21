import Phaser from 'phaser';
import { audio } from '../../core/AudioManager';
import { confetti } from '../../scenes/confetti';
import { PauseMenu } from '../../core/PauseMenu';
import { REACTION_ABILITIES } from '../../../shared/reactionAbilities';
import type { MinigameContext } from '../types';
import type { PlayerSnapshot } from '../../../shared/types';

// BOTTA AL VOLO — 5 round, 5 abilità, tempi in ms, classifica cumulativa.
// Regola: nessuna abilità regala un tempo migliore.

const ROUNDS = 5;
const TITLE_S = 2;
const ROUND_INTRO_S = 1.1;
const MIN_WAIT_S = 2;
const MAX_WAIT_S = 6;
const FAKEOUT_CHANCE = 0.4;
const RESPONSE_TIMEOUT_S = 3;
const ROUND_RESULT_S = 2.2;
const RESULTS_HOLD_S = 5;

const FALSE_START_PENALTY = 1000;
const DNF_PENALTY = 2000;

type Status = 'ready' | 'pressed' | 'falseStart' | 'dnf';
type Phase = 'title' | 'intro' | 'waiting' | 'via' | 'roundResult' | 'results';

interface PState {
  snap: PlayerSnapshot;
  status: Status;
  timeMs: number | null;
  falseAt: number | null;
  abilityUsed: boolean;
  penaltyMs: number;
  focusUntil: number;
  /** M'HO SVEJATO: la finestra FOCUS e' aperta (2 s durante l'attesa) */
  focusOpen: boolean;
  /** ULTIMO SECONDO: in guardia per questo round */
  armed: boolean;
  /** Dottore e Ciro: abilita' UNA volta a partita (le altre si rinnovano a ogni round) */
  gameUsed: boolean;
  roundTimes: number[];
  card: Phaser.GameObjects.Text;
}

let sessionRecord: { ms: number; name: string } | null = null;

export class ReactionScene extends Phaser.Scene {
  private ctx!: MinigameContext;
  private players: PState[] = [];
  private phase: Phase = 'title';
  private round = 0;
  private gameTime = 0;
  private phaseEndsAt = 0;
  private viaDeadline = 0;
  private viaTime = 0;
  private fakeAt = -1;
  private fakeDone = false;
  private fakeActive = false;
  private finished = false;

  private centerText!: Phaser.GameObjects.Text;
  private subText!: Phaser.GameObjects.Text;
  private core!: Phaser.GameObjects.Arc;
  private flashRect!: Phaser.GameObjects.Rectangle;

  private pauseMenu!: PauseMenu;

  constructor() {
    super('reaction');
  }

  create(data: { ctx: MinigameContext }): void {
    this.ctx = data.ctx;
    // RICOMINCIA riusa la stessa istanza: azzera TUTTO lo stato custom.
    this.players = [];
    this.phase = 'title';
    this.round = 0;
    this.gameTime = 0;
    this.phaseEndsAt = 0;
    this.viaDeadline = 0;
    this.viaTime = 0;
    this.fakeAt = -1;
    this.fakeDone = false;
    this.fakeActive = false;
    this.finished = false;

    audio.unlock();
    this.cameras.main.setBackgroundColor('#0d0f1e');

    this.flashRect = this.add.rectangle(640, 360, 1280, 720, 0xffffff, 0).setDepth(60);
    this.core = this.add.circle(640, 290, 110, 0x14182b).setStrokeStyle(6, 0x6366f1).setDepth(5).setVisible(false);

    const n = this.ctx.players.length;
    this.ctx.players.forEach((p, i) => {
      const x = n > 1 ? 170 + i * (940 / (n - 1)) : 640;
      const card = this.add
        .text(x, 580, '', {
          fontFamily: '"Arial Black", Arial, sans-serif',
          fontSize: '18px',
          color: p.color,
          align: 'center'
        })
        .setOrigin(0.5, 0);
      this.players.push({
        snap: p,
        status: 'ready',
        timeMs: null,
        falseAt: null,
        abilityUsed: false,
        penaltyMs: 0,
        focusUntil: 0,
        focusOpen: false,
        armed: false,
        gameUsed: false,
        roundTimes: [],
        card
      });
    });

    this.centerText = this.add
      .text(640, 320, '', { fontFamily: '"Arial Black", Arial, sans-serif', fontSize: '110px', color: '#ffffff' })
      .setOrigin(0.5)
      .setDepth(10);
    this.subText = this.add
      .text(640, 430, '', { fontFamily: 'Arial, sans-serif', fontSize: '28px', color: '#9ca3af', align: 'center' })
      .setOrigin(0.5)
      .setDepth(10);

    this.pauseMenu = new PauseMenu(this, '⚡ BOTTA AL VOLO', this.ctx.input, () => this.scene.restart({ ctx: this.ctx }));

    this.showTitle();
  }

  // ---- Fasi ----

  private showTitle(): void {
    this.phase = 'title';
    this.phaseEndsAt = this.gameTime + TITLE_S;
    this.centerText.setText('⚡ BOTTA AL VOLO ⚡').setFontSize(64).setColor('#fbbf24').setScale(0.4).setAlpha(0).setY(320);
    this.tweens.add({ targets: this.centerText, scale: 1, alpha: 1, duration: 380, ease: 'Back.easeOut' });
    this.subText.setText('5 ROUND · PREMI APPENA VEDI "VIA!" · SE PREMI PRIMA: FALSA PARTENZA');
    audio.select();
  }

  private startRound(): void {
    this.round += 1;
    this.phase = 'intro';
    this.phaseEndsAt = this.gameTime + ROUND_INTRO_S;
    for (const p of this.players) {
      p.status = 'ready';
      p.timeMs = null;
      p.falseAt = null;
      p.abilityUsed = p.gameUsed; // Dottore e Ciro: una volta a partita
      p.penaltyMs = 0;
      p.focusUntil = 0;
      p.focusOpen = false;
      p.armed = false;
      this.updateCard(p);
      // Riga persistente sul telefono: cosa fa l'abilità di QUESTO personaggio (come kart/quiz).
      const ab = REACTION_ABILITIES[p.snap.characterId ?? ''];
      if (ab) this.ctx.sendPrivate(p.snap.id, { type: 'info', ability: `${ab.name}: ${ab.desc}` });
    }
    this.core.setVisible(false);
    this.centerText.setText(`ROUND ${this.round}/${ROUNDS}`).setFontSize(72).setColor('#ffffff').setScale(1).setAlpha(1).setY(320);
    this.subText.setText('');
    audio.select();
  }

  private enterWaiting(): void {
    this.phase = 'waiting';
    this.viaDeadline = this.gameTime + MIN_WAIT_S + Math.random() * (MAX_WAIT_S - MIN_WAIT_S);
    this.fakeAt = Math.random() < FAKEOUT_CHANCE ? this.gameTime + 0.6 + Math.random() * (this.viaDeadline - this.gameTime - 1.4) : -1;
    this.fakeDone = false;
    this.fakeActive = false;
    this.core.setVisible(true);
    this.centerText.setText('ATTENDI...').setFontSize(72).setColor('#e0e7ff').setY(500); // sotto il cerchio pulsante
    this.subText.setText('');
    this.ctx.signal(null, { type: 'wait' });
  }

  private updateWaiting(): void {
    this.core.setScale(1 + Math.sin(this.gameTime * 6) * 0.07);

    if (this.fakeAt >= 0 && !this.fakeDone && this.gameTime >= this.fakeAt) {
      this.fakeDone = true;
      this.doFakeOut();
    }

    for (const p of this.players) {
      if (p.status !== 'ready') continue;
      const input = this.ctx.input.get(p.snap.id);
      if (input.justPressed('action')) {
        this.checkFalseStart(p);
      } else if (input.justPressed('ability')) {
        this.useAbility(p);
      }
    }

    // FOCUS scaduto senza VIA: abilita' sprecata
    for (const p of this.players) {
      if (p.focusOpen && this.gameTime > p.focusUntil) {
        p.focusOpen = false;
        this.ctx.signal(p.snap.id, { type: 'focusMiss' });
        this.showAbilityBanner(p, "M'HO SVEJATO — FOCUS sprecato");
      }
    }

    if (this.gameTime >= this.viaDeadline) this.triggerVia();
  }

  private checkFalseStart(p: PState): void {
    // Buttafuori: "MO HO CAPITO" — seconda chance con penalità
    if (p.snap.characterId === 'buttafuori' && !p.abilityUsed) {
      p.abilityUsed = true;
      p.penaltyMs = 120;
      audio.select();
      this.ctx.signal(p.snap.id, { type: 'abilityUsed', name: 'MO HO CAPITO' });
      this.ctx.signal(p.snap.id, { type: 'secondChance' });
      this.showAbilityBanner(p, 'MO HO CAPITO! (+120 ms)');
      this.updateCard(p);
      return;
    }
    p.status = 'falseStart';
    p.falseAt = this.gameTime;
    audio.wrong();
    this.ctx.signal(p.snap.id, { type: 'falseStart' });
    this.updateCard(p);
    this.calmArmed('false', p);
  }

  private useAbility(p: PState): void {
    if (p.abilityUsed || this.phase !== 'waiting') return;
    const cid = p.snap.characterId ?? '';
    // Buttafuori ha un'abilità PASSIVA (scatta da sola sulla falsa partenza):
    // il pulsante abilità sul suo telefono non deve consumarla.
    if (!['goblin', 'dottore', 'judoka', 'ciro'].includes(cid)) return;
    p.abilityUsed = true;
    const once = cid === 'dottore' || cid === 'ciro';
    if (once) p.gameUsed = true;
    this.ctx.signal(p.snap.id, { type: 'abilityUsed', name: REACTION_ABILITIES[cid]?.name, permanent: once });
    switch (cid) {
      case 'goblin':
        this.abilityGoblin(p);
        break;
      case 'dottore':
        this.abilityDottore(p);
        break;
      case 'judoka':
        this.abilityJudoka(p);
        break;
      case 'ciro':
        this.abilityCiro(p);
        break;
      default:
        break;
    }
    this.updateCard(p);
  }

  private abilityGoblin(p: PState): void {
    if (this.fakeActive) {
      this.fakeActive = false;
      this.viaDeadline = this.gameTime + MIN_WAIT_S + Math.random() * (MAX_WAIT_S - MIN_WAIT_S);
      audio.select();
      this.ctx.signal(p.snap.id, { type: 'ability', name: 'NCULO!' });
      this.showAbilityBanner(p, 'NCULO! — fake-out annullato, nuovo timer');
    } else {
      this.ctx.signal(p.snap.id, { type: 'drunk' });
      this.showAbilityBanner(p, 'NCULO! — troppo presto... (effetto ubriaco)');
    }
  }

  /**
   * M'HO SVEJATO (Dottore): vantaggio INFORMATIVO, mai temporale. Apre una finestra FOCUS di 2 s durante l'attesa: se il VIA cade dentro
   * il telefono vibra e la TV annuncia la diagnosi esatta, altrimenti l'abilita' e' sprecata. Il tempo parte sempre dal VIA vero.
   */
  private abilityDottore(p: PState): void {
    p.focusUntil = this.gameTime + 2;
    p.focusOpen = true;
    audio.select();
    this.ctx.signal(p.snap.id, { type: 'focus', ms: 2000 });
    this.showAbilityBanner(p, "M'HO SVEJATO — FOCUS aperto (2 s)");
  }

  private abilityJudoka(p: PState): void {
    audio.wrong();
    this.ctx.signal(null, { type: 'reset' });
    this.showAbilityBanner(p, 'ASPETTA UN ATTIMO! — finto reset');
    this.flashRect.setFillStyle(0xffffff, 1).setAlpha(0.55);
    this.tweens.add({ targets: this.flashRect, alpha: 0, duration: 500 });
    this.centerText.setText('RESET...').setFontSize(72).setColor('#ffffff');
    this.viaDeadline = this.gameTime + 1.4 + MIN_WAIT_S + Math.random() * (MAX_WAIT_S - MIN_WAIT_S);
    this.time.delayedCall(1000, () => {
      if (this.phase === 'waiting') this.centerText.setText('ATTENDI...').setColor('#e0e7ff');
    });
  }

  /**
   * ULTIMO SECONDO (Ciro): resta in guardia per il round. Se parte un falso allarme (il finto V) o un altro giocatore sbaglia, il suo
   * telefono lo avvisa: NON È ANCORA FINITA. Non dice MAI quando arriva il VIA e non regala millisecondi.
   */
  private abilityCiro(p: PState): void {
    p.armed = true;
    audio.select();
    this.ctx.signal(p.snap.id, { type: 'armed' });
    this.showAbilityBanner(p, 'ULTIMO SECONDO — in guardia per questo round');
  }

  /** Avvisa i Ciro in guardia (falso allarme o falsa partenza altrui): "NON È ANCORA FINITA". */
  private calmArmed(why: 'fake' | 'false', except?: PState): void {
    for (const c of this.players) {
      if (!c.armed || c === except || c.status !== 'ready') continue;
      this.ctx.signal(c.snap.id, { type: 'calm', why });
      this.showAbilityBanner(c, why === 'fake' ? 'ULTIMO SECONDO — FALSO ALLARME, non è ancora finita' : 'ULTIMO SECONDO — qualcuno ha sbagliato, non è ancora finita');
    }
  }

  private doFakeOut(): void {
    this.fakeActive = true;
    this.calmArmed('fake');
    audio.tick();
    this.flashRect.setFillStyle(0x4ade80, 1).setAlpha(0.15);
    this.tweens.add({ targets: this.flashRect, alpha: 0, duration: 180, onComplete: () => (this.fakeActive = false) });
    const v = this.add
      .text(640, 320, 'V', { fontFamily: '"Arial Black", Arial, sans-serif', fontSize: '100px', color: '#4ade80' })
      .setOrigin(0.5)
      .setDepth(11)
      .setAlpha(0);
    this.tweens.add({ targets: v, alpha: 1, duration: 70, yoyo: true, onComplete: () => v.destroy() });
  }

  private triggerVia(): void {
    this.phase = 'via';
    this.viaTime = this.gameTime;
    this.core.setVisible(false);
    this.centerText.setText('⚡ VIA! ⚡').setFontSize(140).setColor('#4ade80').setY(320);
    this.subText.setText('');
    this.cameras.main.shake(180, 0.008);
    this.flashRect.setFillStyle(0x4ade80, 1).setAlpha(0.5);
    this.tweens.add({ targets: this.flashRect, alpha: 0, duration: 300 });
    confetti(this, 640, 320);
    audio.correct();
    this.ctx.signal(null, { type: 'via' });
    // Dottore: se il focus è attivo, vibrazione extra
    for (const p of this.players) {
      if (p.snap.characterId === 'dottore' && p.focusOpen) {
        p.focusOpen = false;
        this.ctx.signal(p.snap.id, { type: 'focusHit' });
        this.showAbilityBanner(p, "M'HO SVEJATO — DIAGNOSI ESATTA: il VIA è nel FOCUS");
      }
    }
  }

  private updateVia(): void {
    for (const p of this.players) {
      if (p.status !== 'ready') continue;
      if (this.ctx.input.get(p.snap.id).justPressed('action')) {
        p.status = 'pressed';
        p.timeMs = Math.round((this.gameTime - this.viaTime) * 1000) + p.penaltyMs;
        audio.select();
        this.ctx.signal(p.snap.id, { type: 'pressed', ms: p.timeMs });
        this.updateCard(p);
      }
    }

    if (this.gameTime - this.viaTime >= RESPONSE_TIMEOUT_S) {
      this.endRound();
    }
  }

  private endRound(): void {
    for (const p of this.players) {
      if (p.status === 'ready') {
        p.status = 'dnf';
        this.updateCard(p);
      }
      let t = DNF_PENALTY;
      if (p.status === 'pressed') t = p.timeMs ?? DNF_PENALTY;
      else if (p.status === 'falseStart') t = FALSE_START_PENALTY;
      p.roundTimes.push(t);
    }

    if (this.round >= ROUNDS) {
      this.showResults();
    } else {
      this.phase = 'roundResult';
      this.phaseEndsAt = this.gameTime + ROUND_RESULT_S;
      this.centerText.setText(`FINE ROUND ${this.round}`).setFontSize(60).setColor('#ffffff').setY(320);
      this.subText.setText('');
    }
  }

  // ---- Risultati finali ----

  private showResults(): void {
    this.phase = 'results';
    this.centerText.setText('RISULTATI').setFontSize(64).setColor('#ffffff').setY(320);
    this.subText.setText('Somma dei 5 round (ms)');

    const ranking = [...this.players].sort((a, b) => this.totalTime(a) - this.totalTime(b));
    const best = ranking[0];

    if (best && sessionRecord === null) {
      sessionRecord = { ms: this.totalTime(best), name: best.snap.displayName };
    }

    let t = 0;
    for (let i = ranking.length - 1; i >= 0; i--) {
      const p = ranking[i];
      const at = t;
      t += p === best ? 550 : 520;
      this.time.delayedCall(at, () => this.revealRank(p, i + 1, p === best));
    }

    if (sessionRecord) {
      this.add
        .text(640, 70, `⚡ RECORD SERATA: ${sessionRecord.ms} ms (${sessionRecord.name})`, {
          fontFamily: '"Arial Black", Arial, sans-serif', fontSize: '22px', color: '#fbbf24'
        })
        .setOrigin(0.5)
        .setDepth(20);
    }

    this.time.delayedCall(t + RESULTS_HOLD_S * 1000, () => this.finish(ranking));
  }

  private revealRank(p: PState, placement: number, isWinner: boolean): void {
    const medal = placement === 1 ? '🥇' : placement === 2 ? '🥈' : placement === 3 ? '🥉' : `${placement}°`;
    const txt = this.add
      .text(640, 150 + placement * 78, `${medal}  ${p.snap.avatar} ${p.snap.name} — ${this.totalTime(p)} ms`, {
        fontFamily: isWinner ? '"Arial Black", Arial, sans-serif' : 'Arial, sans-serif',
        fontSize: isWinner ? '38px' : '28px',
        color: isWinner ? '#fbbf24' : p.snap.color,
        align: 'center'
      })
      .setOrigin(0.5)
      .setDepth(15)
      .setScale(0.5)
      .setAlpha(0);
    this.tweens.add({ targets: txt, scale: 1, alpha: 1, duration: 300, ease: 'Back.easeOut' });

    if (isWinner) {
      audio.fanfare();
      confetti(this, 640, 250);
      const win = this.add
        .text(640, 210, `🏆 VINCITORE · ${this.totalTime(p)} ms`, {
          fontFamily: '"Arial Black", Arial, sans-serif', fontSize: '44px', color: '#fbbf24'
        })
        .setOrigin(0.5)
        .setDepth(16)
        .setScale(0.5);
      this.tweens.add({ targets: win, scale: 1, duration: 320, ease: 'Back.easeOut' });
    } else {
      audio.select();
    }
  }

  private totalTime(p: PState): number {
    return p.roundTimes.reduce((a, b) => a + b, 0);
  }

  private updateCard(p: PState): void {
    let status: string;
    let color: string;
    if (p.status === 'ready') {
      status = 'PRONTO';
      color = '#9ca3af';
    } else if (p.status === 'pressed') {
      status = `${p.timeMs} ms`;
      color = '#4ade80';
    } else if (p.status === 'falseStart') {
      status = 'FALSA PARTENZA 💀';
      color = '#f87171';
    } else {
      status = 'NESSUNA RISPOSTA';
      color = '#64748b';
    }
    const abName = REACTION_ABILITIES[p.snap.characterId ?? '']?.name ?? 'ABILITÀ';
    const ability = p.abilityUsed ? '⭐ usata' : `⭐ ${abName}`;
    p.card.setText(`${p.snap.avatar}\n${p.snap.displayName}\n${status}\n${ability}`).setColor(
      p.status === 'ready' ? p.snap.color : color
    );
  }

  private showAbilityBanner(p: PState, text: string): void {
    const b = this.add
      .text(640, 500, `${p.snap.avatar} ${text}`, {
        fontFamily: '"Arial Black", Arial, sans-serif', fontSize: '24px', color: p.snap.color
      })
      .setOrigin(0.5)
      .setDepth(30)
      .setAlpha(0);
    this.tweens.add({ targets: b, alpha: 1, duration: 150, yoyo: true, hold: 900, onComplete: () => b.destroy() });
  }

  private finish(ranking: PState[]): void {
    if (this.finished) return;
    this.finished = true;
    const results = ranking.map((p, i) => {
      const valid = p.roundTimes.filter((t) => t < FALSE_START_PENALTY); // esclude falsi start / DNF
      return {
        playerId: p.snap.id,
        placement: i + 1,
        score: this.totalTime(p),
        stats: [
          `${Math.round(this.totalTime(p) / ROUNDS)} ms di media`,
          ...(valid.length > 0 ? [`miglior tempo ${Math.min(...valid)} ms`] : ['nessun tempo valido'])
        ]
      };
    });
    this.ctx.finish({ results });
  }

  // ---- Loop ----

  update(_t: number, delta: number): void {
    if (this.pauseMenu.update()) return;

    if (this.finished) return;
    const dt = Math.min(delta, 250) / 1000; // tempo reale fino a ~4 FPS
    this.gameTime += dt;

    switch (this.phase) {
      case 'title':
        if (this.gameTime >= this.phaseEndsAt) this.startRound();
        break;
      case 'intro':
        if (this.gameTime >= this.phaseEndsAt) this.enterWaiting();
        break;
      case 'waiting':
        this.updateWaiting();
        break;
      case 'via':
        this.updateVia();
        break;
      case 'roundResult':
        if (this.gameTime >= this.phaseEndsAt) this.startRound();
        break;
      case 'results':
        break;
    }

    this.ctx.input.update();
  }
}
