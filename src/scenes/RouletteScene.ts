import Phaser from 'phaser';
import { game as gm } from '../core/GameManager';
import { audio } from '../core/AudioManager';
import { MINIGAME_DEFINITIONS } from '../../shared/minigames';
import { FLOW_TIMING } from '../../shared/types';

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

    const categories = [...new Set(MINIGAME_DEFINITIONS.map((d) => d.category))];
    const mgPool = MINIGAME_DEFINITIONS.filter((d) => d.category === pick.category).map((d) => d.name);
    const pool = mgPool.length > 0 ? mgPool : [pick.name];
    let stopped = false;

    this.add
      .text(640, 60, `ROUND ${gm.state?.round ?? 1}`, {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: '32px',
        color: '#9ca3af'
      })
      .setOrigin(0.5);

    this.add
      .text(640, 180, '🎰 IL RULLO DECIDE...', {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: '40px',
        color: '#ffffff'
      })
      .setOrigin(0.5);

    const big = this.add
      .text(640, 300, '?', {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: '100px',
        color: '#ffffff'
      })
      .setOrigin(0.5);

    // Fase 1: categorie veloci
    let catIdx = 0;
    const catEvt = this.time.addEvent({
      delay: 80,
      loop: true,
      callback: () => {
        if (stopped) return;
        catIdx += 1;
        big.setText(categories[catIdx % categories.length]);
      }
    });

    this.time.delayedCall(FLOW_TIMING.rouletteMs * 0.4, () => {
      catEvt.remove();
      big.setText(pick.category).setColor('#fbbf24');
      audio.select();
      // Fase 2: nomi minigioco che rallentano
      let mgIdx = 0;
      let mgDelay = 120;
      const cycle = (): void => {
        if (stopped) return;
        mgIdx += 1;
        big.setText(pool[mgIdx % pool.length]).setColor('#ffffff');
        mgDelay = Math.min(mgDelay + 45, 320);
        this.time.delayedCall(mgDelay, cycle);
      };
      cycle();
    });

    // Fase 3: stop ("TAC")
    this.time.delayedCall(FLOW_TIMING.rouletteMs - 700, () => {
      stopped = true;
      big.setText(pick.name).setColor('#ffffff');
      audio.fanfare();

      this.add
        .text(640, 430, `TIPO: ${pick.category}`, {
          fontFamily: '"Arial Black", Arial, sans-serif',
          fontSize: '30px',
          color: '#fbbf24'
        })
        .setOrigin(0.5);

      if (pick.modifierId) {
        this.add
          .text(640, 480, `MODIFICATORE: ${pick.modifierName} — ${pick.modifierDescription}`, {
            fontFamily: 'Arial, sans-serif',
            fontSize: '22px',
            color: '#f87171'
          })
          .setOrigin(0.5);
      }
    });
  }
}
