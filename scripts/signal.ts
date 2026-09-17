import { io, Socket } from 'socket.io-client';
import { EVT } from '../shared/protocol';
import type { AckResponse, JoinAck } from '../shared/protocol';

const URL = 'http://localhost:3001';
function connect(): Socket {
  return io(URL, { transports: ['websocket', 'polling'] });
}
function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
function emitAck<T>(socket: Socket, event: string, payload: unknown): Promise<T> {
  return new Promise((resolve) => socket.emit(event, payload, (res: T) => resolve(res)));
}

async function main(): Promise<void> {
  const host = connect();
  await new Promise((r) => host.on('connect', r));
  const created = await emitAck<AckResponse>(host, EVT.hostCreate, { playerCount: 2, targetScore: 30 });

  const p1 = connect();
  await new Promise((r) => p1.on('connect', r));
  const j1 = await emitAck<JoinAck & AckResponse>(p1, EVT.playerJoin, { roomCode: created.roomCode as string, displayName: 'Nicolò' });
  const p2 = connect();
  await new Promise((r) => p2.on('connect', r));
  await emitAck<JoinAck & AckResponse>(p2, EVT.playerJoin, { roomCode: created.roomCode as string, displayName: 'Christian' });
  p1.emit(EVT.playerSelectCharacter, { characterId: 'goblin' });
  p2.emit(EVT.playerSelectCharacter, { characterId: 'buttafuori' });
  await sleep(100);
  p1.emit(EVT.playerReady, { ready: true });
  p2.emit(EVT.playerReady, { ready: true });
  await sleep(100);

  host.emit(EVT.hostSelectMinigame, { minigameId: 'reaction' });
  await sleep(150);
  host.emit(EVT.hostStart);

  // Broadcast a tutti
  const allP = new Promise<unknown>((r) => p1.once(EVT.controllerSignal, r));
  host.emit(EVT.hostSignal, { playerId: null, signal: { type: 'via' } });
  const allSig = await allP;
  console.log('✔ broadcast signal ricevuto:', (allSig as { type: string }).type);

  // Solo a p1
  const oneP = new Promise<unknown>((r) => p1.once(EVT.controllerSignal, r));
  host.emit(EVT.hostSignal, { playerId: j1.playerId, signal: { type: 'pressed', ms: 183 } });
  const oneSig = await oneP;
  console.log('✔ signal singolo:', (oneSig as { type: string }).type, (oneSig as { ms: number }).ms, 'ms');

  console.log('✅ SIGNAL TEST OK');
  process.exit(0);
}

main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
