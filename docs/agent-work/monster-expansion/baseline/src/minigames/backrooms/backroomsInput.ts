import type { PlayerInput } from '../../network/PlayerInput';

/** Own cursor per player: repeated substeps never replay an edge, brief taps survive frame clears. */
export class BackroomsInteractionInput {
  private cursors = new Map<string, { input: PlayerInput; serial: number; cancel: number }>();
  read(id: string, input: PlayerInput): number {
    const serial = input.pressCount('interact'), old = this.cursors.get(id);
    this.cursors.set(id, { input, serial, cancel: input.cancellationVersion });
    const baseline = !old || old.input !== input || old.cancel !== input.cancellationVersion
      ? input.pressCountAtCancellation('interact') : old.serial;
    return Math.min(16, Math.max(0, serial - baseline));
  }
  sync(id: string, input: PlayerInput): void {
    this.cursors.set(id, { input, serial: input.pressCount('interact'), cancel: input.cancellationVersion });
  }
}
