import Phaser from 'phaser';
import { game as gm } from '../core/GameManager';
import { audio } from '../core/AudioManager';
import { MAX_PLAYERS, MIN_PLAYERS, SCORE_PRESETS, TARGET_SCORE_MAX, TARGET_SCORE_MIN, estimateGameMinutes } from '../../shared/types';
import { UI, hexToInt } from '../core/uiTokens';
import { displayText, infoText, uiPanel } from '../core/uiPhaser';

const CUSTOM_IDX = SCORE_PRESETS.length;

/**
 * CONFIGURAZIONE DELLA SERATA (prima della stanza): due scelte grandi (quanti siete, quanto dura) e un solo pulsante.
 * I tasti sono mostrati come tasti, non come istruzioni tecniche. Lo stato del server compare solo se c'e' un problema.
 */
export class LobbyScene extends Phaser.Scene {
  private count = 2;
  private presetIdx = 2; // NORMALE
  private customScore = 100;

  private countText!: Phaser.GameObjects.Text;
  private targetText!: Phaser.GameObjects.Text;
  private targetSub!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private connText!: Phaser.GameObjects.Text;

  constructor() {
    super('LobbyScene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(UI.color.bg);
    this.add.image(640, 360, 'bg').setAlpha(0.3).setDisplaySize(1280, 720);
    this.add.rectangle(640, 360, 1280, 720, 0x0b0b14, 0.35);

    displayText(this, 640, 96, 'PARTY GAME', 84, UI.color.accent);
    infoText(this, 640, 156, 'IL PARTY GAME DELLA SERATA', UI.size.S, UI.color.text);

    // scheda centrale con le due scelte
    uiPanel(this, 640, 372, 760, 300, UI.color.line, true);
    const row = (y: number, label: string, keys: string): void => {
      infoText(this, 640, y - 52, label, UI.size.S, UI.color.info);
      this.keycap(640 - 300, y + 4, keys === 'lr' ? '◀' : '▲');
      this.keycap(640 + 300, y + 4, keys === 'lr' ? '▶' : '▼');
    };
    row(286, 'QUANTI SIETE', 'lr');
    this.countText = displayText(this, 640, 290, String(this.count), UI.size.XL, UI.color.text);
    row(436, 'QUANTO DURA LA SERATA', 'ud');
    this.targetText = displayText(this, 640, 432, '', UI.size.L, UI.color.text);
    this.targetSub = infoText(this, 640, 476, '', UI.size.S, UI.color.textDim);

    // START
    this.add.rectangle(640, 594, 520, 66, hexToInt(UI.color.success), 1).setStrokeStyle(3, 0xbbf7d0);
    this.statusText = displayText(this, 640, 594, 'INVIO  ·  CREA LA PARTITA', UI.size.M, '#062012').setStroke('#062012', 0).setShadow(0, 0, '#000', 0);
    this.tweens.add({ targets: this.statusText, scale: 1.04, duration: UI.motion.pulse, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // stato del server: visibile SOLO se qualcosa non va
    this.connText = infoText(this, 640, 660, '', UI.size.S, UI.color.danger);

    const updateConn = (status: unknown): void => {
      if (status === 'error') this.connText.setText('⚠ NON RIESCO A COLLEGARMI AL SERVER — controlla che sia acceso').setColor(UI.color.danger);
      else this.connText.setText('');
    };
    updateConn(gm.connected ? 'ok' : 'error');
    const offConn = gm.events.on('connection', updateConn);
    // Ogni ritorno in lobby ricrea la scena: senza questo i listener si accumulano e aggiornano testi distrutti.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, offConn);

    this.render();

    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
      audio.unlock();
      if (e.key === 'ArrowLeft') {
        this.count = Math.max(MIN_PLAYERS, this.count - 1);
        audio.ui('move');
        this.render();
      } else if (e.key === 'ArrowRight') {
        this.count = Math.min(MAX_PLAYERS, this.count + 1);
        audio.ui('move');
        this.render();
      } else if (e.key === 'ArrowUp') {
        this.presetIdx = this.presetIdx <= 0 ? CUSTOM_IDX : this.presetIdx - 1;
        audio.ui('move');
        this.render();
      } else if (e.key === 'ArrowDown') {
        this.presetIdx = this.presetIdx >= CUSTOM_IDX ? 0 : this.presetIdx + 1;
        audio.ui('move');
        this.render();
      } else if (e.key === '+' || e.key === '=') {
        if (this.presetIdx === CUSTOM_IDX) {
          this.customScore = Math.min(TARGET_SCORE_MAX, this.customScore + 10);
          audio.select();
          this.render();
        }
      } else if (e.key === '-' || e.key === '_') {
        if (this.presetIdx === CUSTOM_IDX) {
          this.customScore = Math.max(TARGET_SCORE_MIN, this.customScore - 10);
          audio.select();
          this.render();
        }
      } else if (e.key === 'Enter') {
        audio.ui('confirm');
        void this.start();
      }
    });
  }

  /** Tasto disegnato come tasto (non come testo "(← →)"). */
  private keycap(x: number, y: number, label: string): void {
    this.add.rectangle(x, y + 4, 64, 58, 0x6b7280, 1);
    this.add.rectangle(x, y, 64, 58, 0xe5e7eb, 1);
    this.add.text(x, y, label, { fontFamily: UI.font.display, fontSize: `${UI.size.M}px`, color: '#0b0b14' }).setOrigin(0.5);
  }

  private currentTarget(): number {
    return this.presetIdx < SCORE_PRESETS.length ? SCORE_PRESETS[this.presetIdx].points : this.customScore;
  }

  private render(): void {
    this.countText.setText(String(this.count));
    if (this.presetIdx < SCORE_PRESETS.length) {
      const p = SCORE_PRESETS[this.presetIdx];
      this.targetText.setText(p.label);
      this.targetSub.setText(`${p.points} PUNTI · ~${estimateGameMinutes(p.points)} MIN`);
    } else {
      this.targetText.setText('PERSONALIZZATA');
      this.targetSub.setText(`${this.customScore} PUNTI · ~${estimateGameMinutes(this.customScore)} MIN   ·   + / −  per cambiare`);
    }
  }

  private creating = false;

  private async start(): Promise<void> {
    if (this.creating) return; // evita doppie stanze con doppio click
    this.creating = true;
    this.statusText.setText('CREO LA STANZA…');
    const ack = await gm.createRoom(this.count, this.currentTarget());
    if (ack.ok && ack.roomCode) {
      this.scene.start('RoomScene');
    } else {
      this.creating = false;
      this.statusText.setText('INVIO  ·  CREA LA PARTITA');
      this.connText.setText(`⚠ ${ack.error ?? 'Non sono riuscito a creare la stanza'}`).setColor(UI.color.danger);
    }
  }
}
