import Phaser from 'phaser';
import { game as gm } from '../core/GameManager';
import { audio } from '../core/AudioManager';
import { getCharacter } from '../../shared/characters';

/**
 * Breve stacco "MINIGIOCO FINITO!" — mostra anche chi ha vinto QUESTO
 * minigioco (utile sia nel flusso normale, prima dei RISULTATI completi,
 * sia dopo un "Ricomincia minigioco" manuale, dove questa è l'unica
 * schermata di rivelazione prima di tornare in lobby, vedi GameSession).
 */
export class FinishedScene extends Phaser.Scene {
  constructor() {
    super('FinishedScene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#0b0b14');
    this.add
      .text(640, 300, '🏁 MINIGIOCO FINITO!', {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: '64px',
        color: '#ffffff'
      })
      .setOrigin(0.5)
      .setScale(0.6)
      .setAlpha(0);

    const out = gm.state?.lastResults;
    const winnerId = out?.results.find((r) => r.placement === 1)?.playerId;
    const winner = winnerId ? gm.state?.players.find((p) => p.id === winnerId) : null;
    if (winner) {
      const c = winner.characterId ? getCharacter(winner.characterId) : null;
      this.add
        .text(640, 400, `🏆 ${c?.avatar ?? '🎮'} ${winner.displayName} ha vinto!`, {
          fontFamily: '"Arial Black", Arial, sans-serif',
          fontSize: '32px',
          color: c?.color ?? '#fbbf24'
        })
        .setOrigin(0.5)
        .setScale(0.6)
        .setAlpha(0);
    }

    this.tweens.add({ targets: this.children.list, alpha: 1, scale: 1, duration: 300, ease: 'Back.easeOut' });
    audio.select();
  }
}
