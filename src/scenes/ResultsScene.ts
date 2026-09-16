import Phaser from 'phaser';
import { game as gm } from '../core/GameManager';
import { audio } from '../core/AudioManager';
import { getCharacter } from '../../shared/characters';
import { FLOW_TIMING } from '../../shared/types';
import type { PlayerResult, RoundResults } from '../../shared/types';
import { confetti } from './confetti';

/** Rivelazione della classifica del round, DALL'ULTIMO AL PRIMO. */
export class ResultsScene extends Phaser.Scene {
  constructor() {
    super('ResultsScene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#0b0b14');
    const st = gm.state;
    const out = st?.lastResults;
    if (!st || !out || out.results.length === 0) {
      this.scene.start('RoomScene');
      return;
    }

    this.add
      .text(640, 55, 'RISULTATI', {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: '56px',
        color: '#ffffff'
      })
      .setOrigin(0.5)
      .setShadow(0, 4, '#000000', 8);

    // Rivelazione dall'ultimo al primo.
    const revealOrder = [...out.results].sort((a, b) => b.placement - a.placement);
    let t = 0;
    const scheduled: { r: PlayerResult; at: number }[] = [];
    for (const r of revealOrder) {
      if (r.placement === 1) t += FLOW_TIMING.revealWinnerDelayMs;
      scheduled.push({ r, at: t });
      t += FLOW_TIMING.revealStepMs;
    }

    for (const { r, at } of scheduled) {
      this.time.delayedCall(at, () => this.reveal(r, out));
    }

    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') gm.skip();
    });
  }

  private reveal(r: PlayerResult, out: RoundResults): void {
    const st = gm.state;
    if (!st) return;
    const player = st.players.find((p) => p.id === r.playerId);
    const c = player?.characterId ? getCharacter(player.characterId) : null;
    const delta = out.deltas[r.playerId] ?? 0;
    const isWinner = r.placement === 1;
    const idx = out.results.length - r.placement; // 0 per l'ultimo
    const y = 150 + idx * 62;

    const medal =
      r.placement === 1 ? '🥇' : r.placement === 2 ? '🥈' : r.placement === 3 ? '🥉' : `${r.placement}°`;

    const row = this.add.container(640, y).setAlpha(0).setScale(0.6);

    const place = this.add
      .text(-380, 0, medal, {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: isWinner ? '46px' : '40px',
        color: '#fbbf24'
      })
      .setOrigin(0.5);

    const avatar = this.add
      .text(-270, 0, c?.avatar ?? '🎮', {
        fontFamily: 'Arial, sans-serif',
        fontSize: isWinner ? '48px' : '40px'
      })
      .setOrigin(0.5);

    const name = this.add
      .text(-170, 0, player?.displayName ?? r.playerId, {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: isWinner ? '34px' : '30px',
        color: c?.color ?? '#ffffff'
      })
      .setOrigin(0, 0.5);

    const plus = this.add
      .text(300, 0, `+${delta}`, {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: isWinner ? '34px' : '30px',
        color: '#4ade80'
      })
      .setOrigin(0.5);

    row.add([place, avatar, name, plus]);
    this.tweens.add({ targets: row, alpha: 1, scale: 1, duration: 280, ease: 'Back.easeOut' });

    if (isWinner) {
      audio.fanfare();
      confetti(this, 640, -30);
      const winLabel = this.add
        .text(640, 150 + idx * 62 + 52, '🏆 VINCITORE DEL ROUND', {
          fontFamily: '"Arial Black", Arial, sans-serif',
          fontSize: '34px',
          color: '#fbbf24'
        })
        .setOrigin(0.5)
        .setAlpha(0)
        .setScale(0.5);
      this.tweens.add({ targets: winLabel, alpha: 1, scale: 1, duration: 320, ease: 'Back.easeOut' });
    } else {
      audio.select();
    }
  }
}
