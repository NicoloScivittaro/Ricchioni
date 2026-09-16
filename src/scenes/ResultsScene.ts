import Phaser from 'phaser';
import { game as gm } from '../core/GameManager';
import { audio } from '../core/AudioManager';
import { getCharacter } from '../characters';

export class ResultsScene extends Phaser.Scene {
  constructor() {
    super('ResultsScene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#0b0b14');
    const out = gm.lastOutcome;
    if (!out) {
      this.scene.start('RouletteScene');
      return;
    }

    this.add
      .text(640, 45, 'CLASSIFICA DEL ROUND', {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: '42px',
        color: '#ffffff'
      })
      .setOrigin(0.5);

    if (out.double) {
      this.add
        .text(640, 95, '⚡ PUNTI DOPPI!', {
          fontFamily: '"Arial Black", Arial, sans-serif',
          fontSize: '24px',
          color: '#fbbf24'
        })
        .setOrigin(0.5);
    }

    // Classifica del round (1°..ultimo)
    const medals = ['🥇', '🥈', '🥉', '4°', '5°'];
    out.ranking.forEach((pid, i) => {
      const y = 150 + i * 48;
      const c = getCharacter(pid);
      const delta = out.deltas[pid] ?? 0;
      this.add.text(110, y, medals[i] ?? `${i + 1}°`, { fontFamily: 'Arial, sans-serif', fontSize: '28px' }).setOrigin(0, 0.5);
      this.add
        .text(210, y, `${c.avatar} ${c.name}`, {
          fontFamily: '"Arial Black", Arial, sans-serif',
          fontSize: '24px',
          color: c.color
        })
        .setOrigin(0, 0.5);
      this.add
        .text(640, y, `+${delta}`, {
          fontFamily: '"Arial Black", Arial, sans-serif',
          fontSize: '26px',
          color: '#4ade80'
        })
        .setOrigin(0, 0.5);
      this.add
        .text(900, y, `${gm.scores.get(pid) ?? 0}`, {
          fontFamily: '"Arial Black", Arial, sans-serif',
          fontSize: '26px',
          color: '#ffffff'
        })
        .setOrigin(0, 0.5);
    });

    // Classifica generale
    this.add
      .text(640, 420, 'CLASSIFICA GENERALE', {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: '30px',
        color: '#93c5fd'
      })
      .setOrigin(0.5);

    const standings = [...gm.scores.entries()].sort((a, b) => b[1] - a[1]);
    standings.forEach(([pid, score], i) => {
      const y = 465 + i * 44;
      const c = getCharacter(pid);
      this.add.text(180, y, `${i + 1}.`, { fontFamily: '"Arial Black", Arial, sans-serif', fontSize: '22px', color: '#9ca3af' }).setOrigin(0, 0.5);
      this.add
        .text(260, y, `${c.avatar} ${c.name}`, {
          fontFamily: 'Arial, sans-serif',
          fontSize: '22px',
          color: c.color
        })
        .setOrigin(0, 0.5);
      this.add
        .text(940, y, `${score} punti`, {
          fontFamily: '"Arial Black", Arial, sans-serif',
          fontSize: '22px',
          color: '#ffffff'
        })
        .setOrigin(0, 0.5);
    });

    this.add
      .text(640, 695, 'Premi INVIO per il prossimo rullo', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '22px',
        color: '#4ade80'
      })
      .setOrigin(0.5);

    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        audio.select();
        gm.nextRound();
      }
    });
  }
}
