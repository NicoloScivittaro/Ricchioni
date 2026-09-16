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

function waitPhase(socket: Socket, phase: string, timeout = 12000): Promise<RoomState> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout su ${phase}`)), timeout);
    const h = (s: RoomState): void => {
      if (s.phase === phase) {
        clearTimeout(t);
        socket.off(EVT.roomState, h);
        resolve(s);
      }
    };
    socket.on(EVT.roomState, h);
  });
}

async function main(): Promise<void> {
  const host = connect();
  await new Promise((r) => host.on('connect', r));
  const created = await emitAck<AckResponse>(host, EVT.hostCreate, { playerCount: 2, targetScore: 10 });

  const p1 = connect();
  await new Promise((r) => p1.on('connect', r));
  const j1 = await emitAck<JoinAck & AckResponse>(p1, EVT.playerJoin, { roomCode: created.roomCode as string, displayName: 'Nicolò' });

  const p2 = connect();
  await new Promise((r) => p2.on('connect', r));
  const j2 = await emitAck<JoinAck & AckResponse>(p2, EVT.playerJoin, { roomCode: created.roomCode as string, displayName: 'Christian' });

  p1.emit(EVT.playerSelectCharacter, { characterId: 'goblin' });
  p2.emit(EVT.playerSelectCharacter, { characterId: 'buttafuori' });
  await sleep(120);
  p1.emit(EVT.playerReady, { ready: true });
  p2.emit(EVT.playerReady, { ready: true });
  await sleep(120);

  const finishP = new Promise<RoomState>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout GAME_FINISHED')), 30000);
    host.on(EVT.roomState, (s: RoomState) => {
      if (s.phase === 'GAME_FINISHED') {
        clearTimeout(t);
        resolve(s);
      }
    });
  });

  host.emit(EVT.hostStart);
  await waitPhase(host, 'MINIGAME_PLAYING');
  host.emit(EVT.hostMinigameFinished, {
    results: [
      { playerId: j1.playerId, placement: 1, score: 3 },
      { playerId: j2.playerId, placement: 2, score: 1 }
    ]
  });

  const fin = await finishP;
  console.log('✔ GAME_FINISHED raggiunto');
  console.log('✔ vincitore =', fin.winner === j1.playerId ? 'Nicolò (corretto)' : `ERRORE: ${fin.winner}`);
  console.log('✔ punteggi:', fin.players.map((p) => `${p.displayName}:${p.score}`).join(', '));
  if (fin.winner !== j1.playerId) throw new Error('Vincitore errato');

  console.log('✅ VICTORY TEST OK');
  process.exit(0);
}

main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
