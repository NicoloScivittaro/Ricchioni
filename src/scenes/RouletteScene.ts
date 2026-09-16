import Phaser from 'phaser';
import { game as gm } from '../core/GameManager';
import { audio } from '../core/AudioManager';
import { MinigameRegistry } from '../core/MinigameRegistry';
import { ModifierRegistry } from '../core/ModifierRegistry';

/** Il rullo è la cosmesi di un risultato già calcolato dal GameManager. */
export class RouletteScene extends Phaser.Scene {
  constructor() {
    super('RouletteScene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#0b0b14');
    const pick = gm.spinRoulette();
    const def = MinigameRegistry.byId(pick.minigameId);
    if (!def) {
      this.scene.start('LobbyScene');
      return;
    }
    const mod = pick.modifierId ? (ModifierRegistry.byId(pick.modifierId) ?? null) : null;

    this.add
      .text(640, 60, `ROUND ${gm.round + 1}`, {
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
      .text(640, 320, '', {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: '84px',
        color: '#fbbf24'
      })
      .setOrigin(0.5)
      .setAlpha(0);

    const gameText = this.add
      .text(640, 440, '', {
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

    this.time.delayedCall(700, () => {
      catText.setText(def.category).setAlpha(1);
      audio.select();
    });
    this.time.delayedCall(1750, () => {
      gameText.setText(def.name).setAlpha(1);
      audio.select();
      if (mod) {
        modText.setText(`MODIFICATORE: ${mod.name} — ${mod.description}`).setAlpha(1);
      }
    });
    this.time.delayedCall(3400, () => {
      gm.beginMinigame();
    });
  }
}
