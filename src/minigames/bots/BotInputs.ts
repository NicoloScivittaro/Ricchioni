import { Rng } from '../../../shared/rng';
import type { MinigameContext } from '../types';

/** Owns only bot input and thinking time. Called by the game's unpaused simulation. */
export class BotInputs {
  protected readonly ids: Set<string>;
  protected readonly rng: Rng;
  protected time = 0;
  private deadlines = new Map<string, number>();
  private completed = new Set<string>();
  constructor(protected ctx: MinigameContext, seed?: number) {
    this.rng = new Rng(seed);
    this.ids = new Set(ctx.players.filter((p) => p.bot).map((p) => p.id));
  }
  protected tick(dt: number): void { this.time += dt; }
  protected hold(id: string, control: string, down: boolean): void {
    const input = this.ctx.input.get(id);
    if (down) input.setDown(control); else input.setUp(control);
  }
  protected tap(id: string, control: string): void { this.ctx.input.get(id).tap(control); }
  protected move(id: string, x: number, z: number, inverted = false): void {
    const d = Math.max(1, Math.hypot(x, z));
    const sign = inverted && this.ctx.modifier?.id === 'controlli_invertiti' ? -1 : 1;
    this.ctx.input.get(id).setAxis('move', sign * x / d, -sign * z / d);
  }
  protected every(id: string, key: string, min: number, max: number): boolean {
    const k = `${id}:${key}`;
    if (!this.deadlines.has(k)) this.deadlines.set(k, this.time + min + this.rng.next() * (max - min));
    if (this.time < this.deadlines.get(k)!) return false;
    this.deadlines.set(k, this.time + min + this.rng.next() * (max - min));
    return true;
  }
  protected once(id: string, key: string, min: number, max: number, action: () => void): void {
    const k = `${id}:${key}`;
    if (this.completed.has(k) || !this.every(id, key, min, max)) return;
    this.completed.add(k);
    action();
  }
  protected ability(id: string): void {
    if (this.every(id, 'ability', 7, 12)) this.tap(id, 'ability');
  }
}
