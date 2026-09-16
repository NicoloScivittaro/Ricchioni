import Phaser from 'phaser';
import { audio } from '../../core/AudioManager';
import type { MinigameContext } from '../types';
import type { PlayerId } from '../../../shared/types';

/**
 * BOTTA AL VOLO — riflessi: premi il pulsante appena appare "VIA!".
 * Falsa partenza = ultimo posto. Classifica per tempo di reazione.
 */
export class ReactionScene extends Phaser.Scene {
  private ctx!: MinigameContext;
  private signalAt = 0;
  private started = false;
  private finished = false;
  private reactionTimes = new Map<PlayerId, number>();
  private falseStarts: PlayerId[] = [];
  private statusText!: Phaser.GameObjects.Text;

  constructor() {
    super('reaction');
  }

  create(data: { ctx: MinigameContext }): void {
    this.ctx = data.ctx;
    audio.unlock();
    this.cameras.main.setBackgroundColor('#101828');

    this.add
      .text(640, 140, '⚡ BOTTA AL VOLO', {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: '56px',
        color: '#ffffff'
      })
      .setOrigin(0.5);
    this.add
      .text(640, 210, 'Premi il pulsante APPENA vedi VIA!', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '26px',
        color: '#9ca3af'
      })
      .setOrigin(0.5);
    this.add
      .text(640, 260, 'Se premi prima: FALSA PARTENZA!', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '22px',
        color: '#f87171'
      })
      .setOrigin(0.5);

    this.statusText = this.add
      .text(640, 420, 'PREPARATI...', {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: '80px',
        color: '#fbbf24'
      })
      .setOrigin(0.5);

    const delay = 1500 + Math.random() * 2000;
    this.signalAt = this.time.now + delay;
    this.time.delayedCall(delay, () => {
      this.started = true;
      audio.select();
      this.statusText.setText('VIA!').setColor('#4ade80');
    });

    this.time.delayedCall(this.ctx.durationSec * 1000, () => this.end());
  }

  update(): void {
    if (this.finished) return;

    for (const pid of this.ctx.playerIds) {
      const input = this.ctx.input.get(pid);
      if (input.justPressed('action')) {
        if (!this.started) {
          if (!this.falseStarts.includes(pid)) {
            this.falseStarts.push(pid);
            audio.wrong();
          }
        } else if (!this.falseStarts.includes(pid) && !this.reactionTimes.has(pid)) {
          this.reactionTimes.set(pid, Math.max(0, this.time.now - this.signalAt));
          audio.correct();
        }
      }
    }

    const pending = this.ctx.playerIds.filter(
      (p) => !this.falseStarts.includes(p) && !this.reactionTimes.has(p)
    );
    if (this.started && pending.length === 0) {
      this.time.delayedCall(300, () => this.end());
    }

    this.ctx.input.update();
  }

  private end(): void {
    if (this.finished) return;
    this.finished = true;

    const all = this.ctx.playerIds;
    const valid = all
      .filter((p) => this.reactionTimes.has(p))
      .sort((a, b) => (this.reactionTimes.get(a) ?? 999999) - (this.reactionTimes.get(b) ?? 999999));
    const missed = all.filter((p) => !this.reactionTimes.has(p) && !this.falseStarts.includes(p));
    const ranking = [...valid, ...missed, ...this.falseStarts];

    const results = ranking.map((pid, i) => ({
      playerId: pid,
      placement: i + 1,
      score: this.reactionTimes.has(pid) ? Math.round(this.reactionTimes.get(pid)!) : 0
    }));
    this.ctx.finish({ results });
  }
}
