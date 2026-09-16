import Phaser from 'phaser';
import { game as gm } from '../core/GameManager';
import { audio } from '../core/AudioManager';

/** INTRO del minigioco: nome, categoria e countdown "3, 2, 1, VIA!". */
export class IntroScene extends Phaser.Scene {
  constructor() {
    super('IntroScene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#0b0b14');
    const pick = gm.pendingMinigame;
    if (!pick) {
      this.scene.start('RoomScene');
      return;
    }

    this.add
      .text(640, 180, pick.name, {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: '72px',
        color: '#ffffff'
      })
      .setOrigin(0.5);

    this.add
      .text(640, 250, pick.category, {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: '32px',
        color: '#fbbf24'
      })
      .setOrigin(0.5);

    this.add
      .text(640, 320, 'Usa il telefono per giocare', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '22px',
        color: '#9ca3af'
      })
      .setOrigin(0.5);

    const count = this.add
      .text(640, 440, 'PREPARATI', {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: '64px',
        color: '#ffffff'
      })
      .setOrigin(0.5);

    const steps = ['3', '2', '1', 'VIA!'];
    steps.forEach((s, i) => {
      this.time.delayedCall(400 + i * 850, () => {
        count.setText(s).setColor(s === 'VIA!' ? '#4ade80' : '#ffffff');
        audio.select();
      });
    });
  }
}
