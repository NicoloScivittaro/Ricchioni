type Handler = (payload?: unknown) => void;

/**
 * Mini event-emitter tipizzato, engine-agnostic.
 * Usato dal GameManager per notificare le scene Phaser dei cambi di stato
 * senza accoppiare la logica al motore di rendering.
 */
export class Emitter {
  private handlers = new Map<string, Set<Handler>>();

  on(event: string, fn: Handler): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(fn);
    return () => this.off(event, fn);
  }

  off(event: string, fn: Handler): void {
    this.handlers.get(event)?.delete(fn);
  }

  emit(event: string, payload?: unknown): void {
    this.handlers.get(event)?.forEach((fn) => fn(payload));
  }
}
