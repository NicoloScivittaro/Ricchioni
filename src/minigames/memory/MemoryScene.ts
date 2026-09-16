import Phaser from 'phaser';
import { audio } from '../../core/AudioManager';
import type { MinigameContext } from '../types';
import type { PlayerId } from '../../../shared/types';

const COLORS = [0xef4444, 0x3b82f6, 0x22c55e, 0xeab308];
const ROUNDS = 5;

/**
 * MEMORIA DA UBRIACO — sequenze di colori sempre più lunghe.
 * Ogni round: osserva la sequenza, poi ripetila dal telefono.
 */
export class MemoryScene extends Phaser.Scene {
  private ctx!: MinigameContext;
  private sequences: number[][] = [];
  private round = 0;
  private phase: 'show' | 'input' = 'show';
  private totalCorrect = new Map<PlayerId, number>();
  private playerInputs = new Map<PlayerId, number[]>();
  private playerDone = new Set<PlayerId>();
  private finished = false;
  private inputEndsAt = 0;

  private boxes: Phaser.GameObjects.Rectangle[] = [];
  private statusText!: Phaser.GameObjects.Text;
  private playerIndicators: Phaser.GameObjects.Text[] = [];

  constructor() {
    super('memory');
  }

  create(data: { ctx: MinigameContext }): void {
    this.ctx = data.ctx;
    audio.unlock();
    this.cameras.main.setBackgroundColor('#0f172a');

    this.add
      .text(640, 50, '🧠 MEMORIA DA UBRIACO', {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: '48px',
        color: '#ffffff'
      })
      .setOrigin(0.5);

    this.statusText = this.add
      .text(640, 120, '', {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: '26px',
        color: '#fbbf24'
      })
      .setOrigin(0.5);

    for (let i = 0; i < 4; i++) {
      const x = 320 + i * 220;
      const box = this.add
        .rectangle(x, 320, 180, 180, COLORS[i], 0.35)
        .setStrokeStyle(4, 0xffffff);
      this.boxes.push(box);
    }

    this.ctx.players.forEach((p, idx) => {
      const t = this.add
        .text(60 + idx * 240, 560, `${p.avatar} ${p.displayName}`, {
          fontFamily: 'Arial, sans-serif',
          fontSize: '18px',
          color: p.color
        })
        .setOrigin(0, 0.5);
      this.playerIndicators.push(t);
    });

    this.add
      .text(640, 680, 'Ripeti i colori con i tasti del telefono', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '16px',
        color: '#9ca3af'
      })
      .setOrigin(0.5);

    for (let r = 0; r < ROUNDS; r++) {
      const len = r + 2;
      this.sequences.push(Array.from({ length: len }, () => Math.floor(this.ctx.rng.next() * 4)));
    }

    this.startShow();
  }

  private startShow(): void {
    this.phase = 'show';
    const seq = this.sequences[this.round];
    this.statusText.setText(`OSSERVA la sequenza (round ${this.round + 1}/${ROUNDS})`);

    seq.forEach((c, i) => {
      this.time.delayedCall(700 + i * 700, () => this.flash(c));
    });
    this.time.delayedCall(700 + seq.length * 700 + 300, () => this.startInput());
  }

  private flash(c: number): void {
    const box = this.boxes[c];
    box.setAlpha(1);
    audio.select();
    this.time.delayedCall(500, () => box.setAlpha(0.35));
  }

  private startInput(): void {
    this.phase = 'input';
    this.playerInputs.clear();
    this.playerDone.clear();
    const seq = this.sequences[this.round];
    this.inputEndsAt = this.time.now + seq.length * 1500 + 1200;
    this.statusText.setText(`RIPETI la sequenza! (${seq.length} colori)`).setColor('#4ade80');
  }

  update(): void {
    if (this.finished) return;

    this.playerIndicators.forEach((t, i) => {
      const pid = this.ctx.playerIds[i];
      t.setText(`${this.ctx.players[i].avatar} ${this.ctx.players[i].displayName} — ${this.totalCorrect.get(pid) ?? 0}`);
    });

    if (this.phase !== 'input') {
      this.ctx.input.update();
      return;
    }

    const seq = this.sequences[this.round];
    for (const pid of this.ctx.playerIds) {
      if (this.playerDone.has(pid)) continue;
      const input = this.ctx.input.get(pid);
      for (let c = 0; c < 4; c++) {
        if (input.justPressed(`c${c}`)) {
          const arr = this.playerInputs.get(pid) ?? [];
          arr.push(c);
          this.playerInputs.set(pid, arr);
          audio.tick();
          if (arr.length >= seq.length) this.playerDone.add(pid);
        }
      }
    }

    const allDone = this.ctx.playerIds.every((p) => this.playerDone.has(p));
    if (allDone || this.time.now > this.inputEndsAt) {
      this.scoreRound();
    }

    this.ctx.input.update();
  }

  private scoreRound(): void {
    const seq = this.sequences[this.round];
    for (const pid of this.ctx.playerIds) {
      const arr = this.playerInputs.get(pid) ?? [];
      let correct = 0;
      for (let i = 0; i < seq.length; i++) {
        if (arr[i] === seq[i]) correct += 1;
      }
      this.totalCorrect.set(pid, (this.totalCorrect.get(pid) ?? 0) + correct);
    }

    this.round += 1;
    if (this.round >= ROUNDS) {
      this.endGame();
    } else {
      this.startShow();
    }
  }

  private endGame(): void {
    if (this.finished) return;
    this.finished = true;
    const sorted = [...this.ctx.playerIds].sort(
      (a, b) => (this.totalCorrect.get(b) ?? 0) - (this.totalCorrect.get(a) ?? 0)
    );
    const results = sorted.map((pid, i) => ({
      playerId: pid,
      placement: i + 1,
      score: this.totalCorrect.get(pid) ?? 0
    }));
    this.ctx.finish({ results });
  }
}
