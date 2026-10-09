import { BotInputs } from './BotInputs';
import type { PlayerSnapshot } from '../../../shared/types';
interface MemoryActor { snap: PlayerSnapshot; alive: boolean; resolved: boolean; inputIndex: number; pausedUntil: number }
interface Option { ownerId: string | null; isCorrect: boolean }

/** Delayed, fallible decisions for phone/party games; no invented points. */
export class PartyBots extends BotInputs {
  private observed = new Map<number, number[]>();
  quiz(dt: number, phase: string, questionKey: string, difficulty: number, correct: number): void {
    this.tick(dt);
    if (phase !== 'question') return;
    for (const id of this.ids) this.once(id, `quiz:${questionKey}`, 2.5, 6.5, () => {
      const answer = this.rng.chance(0.87 - difficulty * 0.045) ? correct : (correct + this.rng.int(1, 3)) % 4;
      this.tap(id, `answer${'ABCD'[answer]}`);
    });
  }
  reaction(dt: number, phase: string, round: number): void {
    this.tick(dt);
    if (phase !== 'via') return;
    for (const id of this.ids) this.once(id, `reaction:${round}`, 0.28, 0.65, () => this.tap(id, 'action'));
  }
  memory(dt: number, phase: string, round: number, flashed: number[], players: MemoryActor[], gameTime: number): void {
    this.tick(dt);
    // Receives only tiles already flashed in OSSERVA, never future sequences.
    if (phase === 'observe') this.observed.set(round, [...flashed]);
    if (phase !== 'repeat') return;
    const remembered = this.observed.get(round) ?? [];
    for (const p of players) if (this.ids.has(p.snap.id) && p.alive && !p.resolved && gameTime >= p.pausedUntil) {
      if (!this.every(p.snap.id, 'tile', 0.38, 0.7)) continue;
      const tile = remembered[p.inputIndex];
      if (tile === undefined) continue;
      const mistake = this.rng.chance(0.025 + round * 0.012);
      this.tap(p.snap.id, `c${mistake ? (tile + this.rng.int(1, 3)) % 4 : tile}`);
    }
  }
  cultura(dt: number, phase: string, round: number, decoys: string[], options: Option[], hidden: Map<string, number>): void {
    this.tick(dt);
    [...this.ids].forEach((id, i) => {
      if (phase === 'bluff') this.once(id, `bluff:${round}`, 3, 7, () => {
        this.ctx.input.setText(id, 'bluff', decoys[i % Math.max(1, decoys.length)] ?? 'Una leggenda metropolitana');
      });
      if (phase === 'vote') this.once(id, `vote:${round}`, 2, 5, () => {
        const valid = options.map((o, index) => ({ ...o, index })).filter((o) => o.ownerId !== id && hidden.get(id) !== o.index);
        const correct = valid.find((o) => o.isCorrect);
        const wrong = valid.filter((o) => !o.isCorrect);
        const choice = correct && (wrong.length === 0 || this.rng.chance(0.55)) ? correct : this.rng.pick(wrong);
        if (choice) this.ctx.input.setText(id, 'vote', String(choice.index));
      });
    });
  }
}
