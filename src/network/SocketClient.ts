import { io, Socket } from 'socket.io-client';

/** Sottile wrapper tipizzato-lenient su socket.io-client. */
export class SocketClient {
  readonly socket: Socket;

  constructor(url?: string) {
    const opts = { autoConnect: true, transports: ['websocket', 'polling'] as string[] };
    this.socket = url ? io(url, opts) : io(opts);
  }

  get id(): string | undefined {
    return this.socket.id;
  }

  on(event: string, handler: (payload: unknown) => void): void {
    this.socket.on(event, handler);
  }

  off(event: string, handler?: (payload: unknown) => void): void {
    this.socket.off(event, handler);
  }

  emit(event: string, payload?: unknown, ack?: (res: unknown) => void): void {
    this.socket.emit(event, payload, ack);
  }

  /** Emette con callback-ack e restituisce una Promise (per i flussi join/create). */
  emitAck<T = unknown>(event: string, payload?: unknown): Promise<T> {
    return new Promise((resolve) => {
      this.socket.emit(event, payload, (res: T) => resolve(res));
    });
  }
}
