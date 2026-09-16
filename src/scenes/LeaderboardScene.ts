import Phaser from 'phaser';
import { game as gm } from '../core/GameManager';
import { getCharacter } from '../../shared/characters';

/** Classifica generale ordinata DAL PRIMO ALL'ULTIMO, con count-up del punteggio. */
export class LeaderboardScene extends Phaser.Scene {
  constructor() {
    super('LeaderboardScene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#0b0b14');
    const st = gm.state;
    if (!st) {
      this.scene.start('RoomScene');
      return;
    }
    const out = st.lastResults;

    this.add
      .text(640, 50, 'CLASSIFICA GENERALE', {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: '46px',
        color: '#93c5fd'
      })
      .setOrigin(0.5);

    const standings = [...st.players].sort((a, b) => b.score - a.score);
    standings.forEach((p, i) => {
      const y = 150 + i * 88;
      const c = p.characterId ? getCharacter(p.characterId) : null;
      const delta = out?.deltas[p.id] ?? 0;
      const old = p.score - delta;

      this.add
        .text(170, y, `${i + 1}.`, {
          fontFamily: '"Arial Black", Arial, sans-serif',
          fontSize: '26px',
          color: '#9ca3af'
        })
        .setOrigin(0, 0.5);

      this.add
        .text(250, y, `${c?.avatar ?? '🎮'} ${p.displayName}`, {
          fontFamily: 'Arial, sans-serif',
          fontSize: '26px',
          color: c?.color ?? '#ffffff'
        })
        .setOrigin(0, 0.5);

      const scoreText = this.add
        .text(920, y, String(old), {
          fontFamily: '"Arial Black", Arial, sans-serif',
          fontSize: '34px',
          color: '#ffffff'
        })
        .setOrigin(0.5);

      this.tweens.addCounter({
        from: old,
        to: p.score,
        duration: 800,
        ease: 'Cubic.easeOut',
        onUpdate: (tw) => {
          scoreText.setText(`${Math.round(tw.getValue() ?? 0)} PT`);
        }
      });

      if (delta > 0) {
        const plus = this.add
          .text(1000, y - 32, `+${delta}`, {
            fontFamily: '"Arial Black", Arial, sans-serif',
            fontSize: '22px',
            color: '#4ade80'
          })
          .setOrigin(0.5);
        this.tweens.add({ targets: plus, alpha: 0, y: y - 52, delay: 900, duration: 500 });
      }
    });

    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') gm.skip();
    });
  }
}
