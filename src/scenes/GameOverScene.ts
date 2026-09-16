import Phaser from 'phaser';
import { game as gm } from '../core/GameManager';
import { audio } from '../core/AudioManager';
import { getCharacter } from '../../shared/characters';

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

    this.add
      .text(640, 110, '🏆 IL VINCITORE 🏆', {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: '60px',
        color: '#fbbf24'
      })
      .setOrigin(0.5)
      .setShadow(0, 4, '#000000', 8);

    if (c) {
      this.add.image(640, 300, c.id).setDisplaySize(200, 200);
    }
    this.add
      .text(640, 430, `${c?.avatar ?? '🎮'} ${winnerPlayer.displayName}`, {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: '52px',
        color: c?.color ?? '#ffffff'
      })
      .setOrigin(0.5);
    if (c) {
      this.add
        .text(640, 490, c.roleTitle, {
          fontFamily: 'Arial, sans-serif',
          fontSize: '26px',
          color: '#e5e7eb'
        })
        .setOrigin(0.5);
    }
    this.add
      .text(640, 530, `${winnerPlayer.score} punti (obiettivo ${st.targetScore})`, {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: '30px',
        color: '#ffffff'
      })
      .setOrigin(0.5);

    this.add
      .text(640, 640, 'Premi INVIO per tornare alla lobby', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '24px',
        color: '#4ade80'
      })
      .setOrigin(0.5);

    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        audio.select();
        gm.backToLobby();
        this.scene.start('LobbyScene');
      }
    });
  }
}
