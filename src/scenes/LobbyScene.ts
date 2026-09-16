import Phaser from 'phaser';
import { game as gm } from '../core/GameManager';
import { audio } from '../core/AudioManager';
import { MAX_PLAYERS, MIN_PLAYERS, SCORE_PRESETS, TARGET_SCORE_MAX, TARGET_SCORE_MIN } from '../../shared/types';

const CUSTOM_IDX = SCORE_PRESETS.length;

export class LobbyScene extends Phaser.Scene {
  private count = 2;
  private presetIdx = 2; // NORMALE
  private customScore = 100;

  private countText!: Phaser.GameObjects.Text;
  private targetText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;

  constructor() {
    super('LobbyScene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#0b0b14');
    this.add.image(640, 360, 'bg').setAlpha(0.22).setDisplaySize(1280, 720);

    this.add
      .text(640, 80, 'RICCHIONI PARTY', {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: '72px',
        color: '#fbbf24'
      })
      .setOrigin(0.5)
      .setShadow(0, 4, '#000000', 8);

    this.add
      .text(640, 180, 'GIOCATORI   (← →)', {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: '24px',
        color: '#93c5fd'
      })
      .setOrigin(0.5);
    this.countText = this.add
      .text(640, 235, String(this.count), {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: '64px',
        color: '#ffffff'
      })
      .setOrigin(0.5);

    this.add
      .text(640, 340, 'PUNTEGGIO OBIETTIVO   (↑ ↓)   [+ / - per il valore personalizzato]', {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: '22px',
        color: '#93c5fd'
      })
      .setOrigin(0.5);
    this.targetText = this.add
      .text(640, 395, '', {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: '46px',
        color: '#ffffff'
      })
      .setOrigin(0.5);

    this.statusText = this.add
      .text(640, 560, 'Premi INVIO per CREARE LA PARTITA', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '26px',
        color: '#4ade80'
      })
      .setOrigin(0.5);

    this.render();

    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
      audio.unlock();
      if (e.key === 'ArrowLeft') {
        this.count = Math.max(MIN_PLAYERS, this.count - 1);
        audio.select();
        this.render();
      } else if (e.key === 'ArrowRight') {
        this.count = Math.min(MAX_PLAYERS, this.count + 1);
        audio.select();
        this.render();
      } else if (e.key === 'ArrowUp') {
        this.presetIdx = this.presetIdx <= 0 ? CUSTOM_IDX : this.presetIdx - 1;
        audio.select();
        this.render();
      } else if (e.key === 'ArrowDown') {
        this.presetIdx = this.presetIdx >= CUSTOM_IDX ? 0 : this.presetIdx + 1;
        audio.select();
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
        audio.select();
        void this.start();
      }
    });
  }

  private currentTarget(): number {
    return this.presetIdx < SCORE_PRESETS.length ? SCORE_PRESETS[this.presetIdx].points : this.customScore;
  }

  private render(): void {
    this.countText.setText(String(this.count));
    if (this.presetIdx < SCORE_PRESETS.length) {
      const p = SCORE_PRESETS[this.presetIdx];
      this.targetText.setText(`${p.label} · ${p.points} punti`);
    } else {
      this.targetText.setText(`PERSONALIZZATA · ${this.customScore} punti`);
    }
  }

  private async start(): Promise<void> {
    this.statusText.setText('Creo la stanza...').setColor('#fbbf24');
    const ack = await gm.createRoom(this.count, this.currentTarget());
    if (ack.ok && ack.roomCode) {
      this.scene.start('RoomScene');
    } else {
      this.statusText.setText('Errore durante la creazione della stanza').setColor('#f87171');
    }
  }
}
