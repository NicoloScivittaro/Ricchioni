import Phaser from 'phaser';
import { audio } from '../core/AudioManager';

/** Countdown "PROSSIMO ROUND 3, 2, 1" prima del rullo. */
export class NextRoundScene extends Phaser.Scene {
  constructor() {
    super('NextRoundScene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#0b0b14');
    this.add
      .text(640, 220, 'PROSSIMO ROUND', {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: '56px',
        color: '#ffffff'
      })
      .setOrigin(0.5);

    const count = this.add
      .text(640, 360, '', {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: '96px',
        color: '#fbbf24'
      })
      .setOrigin(0.5);

    ['3', '2', '1'].forEach((s, i) => {
      this.time.delayedCall(150 + i * 900, () => {
        count.setText(s);
        audio.tick();
      });
    });
  }
}
