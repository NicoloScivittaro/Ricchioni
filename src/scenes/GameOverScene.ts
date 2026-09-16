import Phaser from 'phaser';
import { game as gm } from '../core/GameManager';
import { audio } from '../core/AudioManager';
import { getCharacter } from '../../shared/characters';
import { confetti } from './confetti';

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOverScene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#0b0b14');
    const st = gm.state;
    const winnerPlayer = st?.players.find((p) => p.id === st?.winner);
    if (!st || !winnerPlayer) {
      this.scene.start('LobbyScene');
      return;
    }
    const c = winnerPlayer.characterId ? getCharacter(winnerPlayer.characterId) : null;
    audio.fanfare();
    confetti(this, 640, -30);

    this.add
      .text(640, 70, '🏆 VINCITORE DELLA PARTITA 🏆', {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: '48px',
        color: '#fbbf24'
      })
      .setOrigin(0.5)
      .setShadow(0, 4, '#000000', 8);

    if (c) {
      const portrait = this.add.image(640, 205, c.id);
      portrait.setScale(150 / portrait.height);
    }
    this.add
      .text(640, 285, `${c?.avatar ?? '🎮'} ${winnerPlayer.displayName}`, {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: '44px',
        color: c?.color ?? '#ffffff'
      })
      .setOrigin(0.5);
    this.add
      .text(640, 330, `${winnerPlayer.score} punti`, {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: '28px',
        color: '#ffffff'
      })
      .setOrigin(0.5);

    // Classifica finale completa (primo in cima).
    const standings = [...st.players].sort((a, b) => b.score - a.score);
    standings.forEach((p, i) => {
      const y = 390 + i * 44;
      const pc = p.characterId ? getCharacter(p.characterId) : null;
      this.add
        .text(300, y, `${i + 1}.`, {
          fontFamily: '"Arial Black", Arial, sans-serif',
          fontSize: '20px',
          color: '#9ca3af'
        })
        .setOrigin(0, 0.5);
      this.add
        .text(380, y, `${pc?.avatar ?? '🎮'} ${p.displayName}`, {
          fontFamily: 'Arial, sans-serif',
          fontSize: '20px',
          color: pc?.color ?? '#ffffff'
        })
        .setOrigin(0, 0.5);
      this.add
        .text(940, y, `${p.score} PT`, {
          fontFamily: '"Arial Black", Arial, sans-serif',
          fontSize: '20px',
          color: '#ffffff'
        })
        .setOrigin(0, 0.5);
    });

    this.add
      .text(640, 690, 'R = RIGIOCA (stessa squadra) · INVIO = nuova configurazione', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '20px',
        color: '#4ade80'
      })
      .setOrigin(0.5);

    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
      if (e.key === 'r' || e.key === 'R') {
        audio.select();
        gm.restartMatch();
      } else if (e.key === 'Enter' || e.key === 'Escape') {
        audio.select();
        gm.backToLobby();
        this.scene.start('LobbyScene');
      }
    });
  }
}
