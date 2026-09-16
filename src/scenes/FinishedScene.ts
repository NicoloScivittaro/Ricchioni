import Phaser from 'phaser';
import { audio } from '../core/AudioManager';

/** Breve stacco "MINIGIOCO FINITO!" prima dei risultati. */
export class FinishedScene extends Phaser.Scene {
  constructor() {
    super('FinishedScene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#0b0b14');
    this.add
      .text(640, 360, '🏁 MINIGIOCO FINITO!', {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: '64px',
        color: '#ffffff'
      })
      .setOrigin(0.5)
      .setScale(0.6)
      .setAlpha(0);
    this.tweens.add({ targets: this.children.list, alpha: 1, scale: 1, duration: 300, ease: 'Back.easeOut' });
    audio.select();
  }
}
