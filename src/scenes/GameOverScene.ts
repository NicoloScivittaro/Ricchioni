import Phaser from 'phaser';
import { game as gm } from '../core/GameManager';
import { audio } from '../core/AudioManager';
import { getCharacter } from '../../shared/characters';
import { confetti } from './confetti';

const ROW_MS = 650; // un giocatore ogni 650ms, dall'ULTIMO al PRIMO
const KEY_LOCK_MS = 1500; // ignora tasti residui della schermata precedente

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

    const header = this.add
      .text(640, 70, 'CLASSIFICA FINALE', {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: '48px',
        color: '#ffffff'
      })
      .setOrigin(0.5)
      .setShadow(0, 4, '#000000', 8);

    // Blocco vincitore: nascosto finché la classifica non è stata rivelata.
    const winnerObjs: (Phaser.GameObjects.Image | Phaser.GameObjects.Text)[] = [];
    if (c) {
      const portrait = this.add.image(640, 205, c.id);
      portrait.setScale(150 / portrait.height);
      winnerObjs.push(portrait);
    }
    winnerObjs.push(
      this.add
        .text(640, 285, `${c?.avatar ?? '🎮'} ${winnerPlayer.displayName}`, {
          fontFamily: '"Arial Black", Arial, sans-serif',
          fontSize: '44px',
          color: c?.color ?? '#ffffff'
        })
        .setOrigin(0.5),
      this.add
        .text(640, 330, `${winnerPlayer.score} punti`, {
          fontFamily: '"Arial Black", Arial, sans-serif',
          fontSize: '28px',
          color: '#ffffff'
        })
        .setOrigin(0.5)
    );
    winnerObjs.forEach((o) => o.setAlpha(0));

    // Classifica finale completa (primo in cima), rivelata dall'ultimo al primo.
    const standings = [...st.players].sort((a, b) => b.score - a.score);
    const rows: Phaser.GameObjects.Text[][] = [];
    standings.forEach((p, i) => {
      const y = 390 + i * 44;
      const pc = p.characterId ? getCharacter(p.characterId) : null;
      const pos = this.add
        .text(300, y, `${i + 1}.`, { fontFamily: '"Arial Black", Arial, sans-serif', fontSize: '20px', color: '#9ca3af' })
        .setOrigin(0, 0.5);
      const name = this.add
        .text(380, y, `${pc?.avatar ?? '🎮'} ${p.displayName}`, {
          fontFamily: 'Arial, sans-serif',
          fontSize: '20px',
          color: pc?.color ?? '#ffffff'
        })
        .setOrigin(0, 0.5);
      const pts = this.add
        .text(940, y, `${p.score} PT`, { fontFamily: '"Arial Black", Arial, sans-serif', fontSize: '20px', color: '#ffffff' })
        .setOrigin(0, 0.5);
      const row = [pos, name, pts];
      row.forEach((t) => t.setAlpha(0));
      rows.push(row);
    });

    const n = rows.length;
    for (let k = 0; k < n; k++) {
      const row = rows[n - 1 - k]; // ultimo → primo
      this.time.delayedCall(400 + k * ROW_MS, () => {
        row.forEach((t) => t.setAlpha(1));
        audio.select();
      });
    }

    // Poi il vincitore, in grande.
    this.time.delayedCall(400 + n * ROW_MS + 500, () => {
      header.setText('🏆 VINCITORE DELLA PARTITA 🏆').setColor('#fbbf24');
      this.tweens.add({ targets: winnerObjs, alpha: 1, duration: 500 });
      audio.fanfare();
      confetti(this, 640, -30);
    });

    this.add
      .text(640, 690, 'R = NUOVA PARTITA (stessa squadra) · INVIO = nuova configurazione', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '20px',
        color: '#4ade80'
      })
      .setOrigin(0.5);

    const openedAt = this.time.now;
    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
      // Mai tornare da soli alla lobby: serve un tasto volontario, non un auto-repeat/residuo.
      if (e.repeat || this.time.now - openedAt < KEY_LOCK_MS) return;
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
