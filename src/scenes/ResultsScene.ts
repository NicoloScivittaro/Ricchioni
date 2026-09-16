import Phaser from 'phaser';
import { game as gm } from '../core/GameManager';
import { audio } from '../core/AudioManager';
import { getCharacter } from '../../shared/characters';

export class ResultsScene extends Phaser.Scene {
  constructor() {
    super('ResultsScene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#0b0b14');
    const st = gm.state;
    const out = st?.lastResults;
    if (!st || !out) {
      this.scene.start('RoomScene');
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
        .text(640, 92, '⚡ PUNTI DOPPI!', {
          fontFamily: '"Arial Black", Arial, sans-serif',
          fontSize: '22px',
          color: '#fbbf24'
        })
        .setOrigin(0.5);
    }
    if (st.suddenDeath) {
      this.add
        .text(640, 118, '☠️ SUDDEN DEATH! Pari al traguardo', {
          fontFamily: '"Arial Black", Arial, sans-serif',
          fontSize: '22px',
          color: '#f87171'
        })
        .setOrigin(0.5);
    }

    const medals = ['🥇', '🥈', '🥉', '4°', '5°'];
    out.ranking.forEach((pid, i) => {
      const y = 160 + i * 46;
      const player = st.players.find((p) => p.id === pid);
      const c = player?.characterId ? getCharacter(player.characterId) : null;
      const delta = out.deltas[pid] ?? 0;
      this.add.text(110, y, medals[i] ?? `${i + 1}°`, { fontFamily: 'Arial, sans-serif', fontSize: '26px' }).setOrigin(0, 0.5);
      this.add
        .text(220, y, `${c?.avatar ?? '🎮'} ${player?.displayName ?? pid}`, {
          fontFamily: '"Arial Black", Arial, sans-serif',
          fontSize: '23px',
          color: c?.color ?? '#ffffff'
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
        .text(900, y, `${player?.score ?? 0}`, {
          fontFamily: '"Arial Black", Arial, sans-serif',
          fontSize: '26px',
          color: '#ffffff'
        })
        .setOrigin(0, 0.5);
    });

    this.add
      .text(640, 420, 'CLASSIFICA GENERALE', {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: '30px',
        color: '#93c5fd'
      })
      .setOrigin(0.5);

    const standings = [...st.players].sort((a, b) => b.score - a.score);
    standings.forEach((p, i) => {
      const y = 465 + i * 44;
      const c = p.characterId ? getCharacter(p.characterId) : null;
      this.add.text(180, y, `${i + 1}.`, { fontFamily: '"Arial Black", Arial, sans-serif', fontSize: '22px', color: '#9ca3af' }).setOrigin(0, 0.5);
      this.add
        .text(270, y, `${c?.avatar ?? '🎮'} ${p.displayName}`, {
          fontFamily: 'Arial, sans-serif',
          fontSize: '22px',
          color: c?.color ?? '#ffffff'
        })
        .setOrigin(0, 0.5);
      this.add
        .text(940, y, `${p.score} / ${st.targetScore}`, {
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
        gm.continueRound();
      }
    });
  }
}
