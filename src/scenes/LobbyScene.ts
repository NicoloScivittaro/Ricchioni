import Phaser from 'phaser';
import { game as gm } from '../core/GameManager';
import { audio } from '../core/AudioManager';
import { GAME_CONFIG } from '../app/config';

const MODES = ['VELOCE', 'NORMALE', 'LUNGA'] as const;

export class LobbyScene extends Phaser.Scene {
  private count = 2;
  private modeIdx = 1;
  private countText!: Phaser.GameObjects.Text;
  private modeText!: Phaser.GameObjects.Text;

  constructor() {
    super('LobbyScene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#0b0b14');
    this.add.image(640, 360, 'bg').setAlpha(0.22).setDisplaySize(1280, 720);

    this.add
      .text(640, 90, 'RICCHIONI PARTY', {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: '72px',
        color: '#fbbf24'
      })
      .setOrigin(0.5)
      .setShadow(0, 4, '#000000', 8);

    this.add
      .text(640, 155, 'NOTTE BRAVA — Party game senza tabellone', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '24px',
        color: '#e5e7eb'
      })
      .setOrigin(0.5);

    this.add
      .text(640, 235, 'GIOCATORI   (← →)', {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: '24px',
        color: '#93c5fd'
      })
      .setOrigin(0.5);
    this.countText = this.add
      .text(640, 290, String(this.count), {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: '72px',
        color: '#ffffff'
      })
      .setOrigin(0.5);

    this.add
      .text(640, 400, 'MODALITÀ   (↑ ↓)', {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: '24px',
        color: '#93c5fd'
      })
      .setOrigin(0.5);
    this.modeText = this.add
      .text(640, 450, '', {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: '38px',
        color: '#ffffff'
      })
      .setOrigin(0.5);

    this.add
      .text(640, 570, 'Premi INVIO per iniziare', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '26px',
        color: '#4ade80'
      })
      .setOrigin(0.5);

    this.renderMode();

    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
      audio.unlock();
      if (e.key === 'ArrowLeft') {
        this.count = Math.max(2, this.count - 1);
        audio.select();
        this.countText.setText(String(this.count));
      } else if (e.key === 'ArrowRight') {
        this.count = Math.min(5, this.count + 1);
        audio.select();
        this.countText.setText(String(this.count));
      } else if (e.key === 'ArrowUp') {
        this.modeIdx = (this.modeIdx + MODES.length - 1) % MODES.length;
        audio.select();
        this.renderMode();
      } else if (e.key === 'ArrowDown') {
        this.modeIdx = (this.modeIdx + 1) % MODES.length;
        audio.select();
        this.renderMode();
      } else if (e.key === 'Enter') {
        audio.select();
        this.start();
      }
    });
  }

  private renderMode(): void {
    const mode = MODES[this.modeIdx];
    this.modeText.setText(`${mode}  ·  ${GAME_CONFIG.winTargets[mode]} punti`);
  }

  private start(): void {
    gm.setLobby(this.count, MODES[this.modeIdx]);
    this.scene.start('CharacterSelectScene');
  }
}
