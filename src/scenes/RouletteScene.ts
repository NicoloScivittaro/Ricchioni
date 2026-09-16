import Phaser from 'phaser';
import { game as gm } from '../core/GameManager';

/** Il rullo è la cosmesi di un minigioco già scelto dal server (authoritativo). */
export class RouletteScene extends Phaser.Scene {
  constructor() {
    super('RouletteScene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#0b0b14');
    const pick = gm.pendingMinigame;
    if (!pick) {
      this.scene.start('RoomScene');
      return;
    }

    this.add
      .text(640, 60, `ROUND ${gm.state?.round ?? 1}`, {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: '32px',
        color: '#9ca3af'
      })
      .setOrigin(0.5);

    this.add
      .text(640, 190, '🎰 IL RULLO DECIDE...', {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: '46px',
        color: '#ffffff'
      })
      .setOrigin(0.5);

    const catText = this.add
      .text(640, 320, pick.category, {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: '84px',
        color: '#fbbf24'
      })
      .setOrigin(0.5)
      .setAlpha(0);

    const gameText = this.add
      .text(640, 440, pick.name, {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: '60px',
        color: '#ffffff'
      })
      .setOrigin(0.5)
      .setAlpha(0);

    const modText = this.add
      .text(640, 520, '', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '26px',
        color: '#f87171'
      })
      .setOrigin(0.5)
      .setAlpha(0);

    this.time.delayedCall(700, () => catText.setAlpha(1));
    this.time.delayedCall(1750, () => {
      gameText.setAlpha(1);
      if (pick.modifierId) {
        modText.setText(`MODIFICATORE: ${pick.modifierName} — ${pick.modifierDescription}`).setAlpha(1);
      }
    });
    this.time.delayedCall(3400, () => gm.launchMinigame());
  }
}
