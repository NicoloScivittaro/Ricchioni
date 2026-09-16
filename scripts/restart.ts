import { io, Socket } from 'socket.io-client';
import { EVT } from '../shared/protocol';
import type { AckResponse, JoinAck } from '../shared/protocol';
import type { RoomState } from '../shared/types';

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
  const j2 = await emitAck<JoinAck & AckResponse>(p2, EVT.playerJoin, { roomCode: created.roomCode as string, displayName: 'Christian' });
  p1.emit(EVT.playerSelectCharacter, { characterId: 'goblin' });
  p2.emit(EVT.playerSelectCharacter, { characterId: 'buttafuori' });
  await sleep(100);
  p1.emit(EVT.playerReady, { ready: true });
  p2.emit(EVT.playerReady, { ready: true });
  await sleep(100);

  let lastState: RoomState | null = null;
  host.on(EVT.roomState, (s: RoomState) => (lastState = s));

  host.emit(EVT.hostStart);
  const t0 = Date.now();
  while (lastState?.phase !== 'MINIGAME_PLAYING') {
    if (Date.now() - t0 > 15000) throw new Error('timeout verso PLAYING');
    host.emit(EVT.hostSkip);
    await sleep(120);
  }

  // Chiude il minigioco → i punteggi vengono assegnati
  host.emit(EVT.hostMinigameFinished, {
    results: [
      { playerId: j1.playerId, placement: 1, score: 1 },
      { playerId: j2.playerId, placement: 2, score: 0 }
    ]
  });
  await sleep(300);

  // Riavvia la partita
  host.emit(EVT.hostRestartMatch);
  const t1 = Date.now();
  while (lastState?.phase !== 'LOBBY') {
    if (Date.now() - t1 > 10000) throw new Error('timeout verso LOBBY');
    await sleep(100);
  }

  console.log('✔ fase dopo restart:', lastState.phase);
  console.log('✔ giocatori mantenuti:', lastState.players.length);
  console.log('✔ punteggi azzerati:', lastState.players.map((p) => `${p.displayName}:${p.score}`).join(', '));
  console.log('✔ ready azzerato:', lastState.players.every((p) => p.ready === false));

  if (lastState.phase !== 'LOBBY') throw new Error('non in LOBBY');
  if (lastState.players.length !== 2) throw new Error('giocatori persi');
  if (!lastState.players.every((p) => p.score === 0)) throw new Error('punteggi non azzerati');

  console.log('✅ RESTART TEST OK');
  process.exit(0);
}

main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
