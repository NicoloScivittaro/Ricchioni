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
  const created = await emitAck<AckResponse>(host, EVT.hostCreate, { playerCount: 2, targetScore: 15 });

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

  let lastState: RoomState | null = null;
  host.on(EVT.roomState, (s: RoomState) => (lastState = s));

  const waitPlaying = async (): Promise<void> => {
    const t0 = Date.now();
    while (lastState?.phase !== 'MINIGAME_PLAYING') {
      if (Date.now() - t0 > 15000) throw new Error(`timeout verso PLAYING (fase ${lastState?.phase})`);
      host.emit(EVT.hostSkip);
      await sleep(120);
    }
  };

  const goNextRound = async (): Promise<void> => {
    // 1) aspetta che il finish venga processato (la fase lascia PLAYING)
    const t0 = Date.now();
    while (lastState?.phase === 'MINIGAME_PLAYING') {
      if (Date.now() - t0 > 15000) throw new Error('finish non processato');
      await sleep(50);
    }
    // 2) skip fino a tornare in PLAYING (round successivo)
    await waitPlaying();
  };

  host.emit(EVT.hostStart);
  await waitPlaying();

  // Round 1: vince Nicolò → 10/5
  host.emit(EVT.hostMinigameFinished, {
    results: [
      { playerId: j1.playerId, placement: 1, score: 3 },
      { playerId: j2.playerId, placement: 2, score: 1 }
    ]
  });
  await goNextRound();
  console.log('✔ round 2 raggiunto, punteggi:', lastState?.players.map((p) => `${p.displayName}:${p.score}`).join(', '));

  // Round 2: vince Christian → 15/15, pari al traguardo → sudden death
  host.emit(EVT.hostMinigameFinished, {
    results: [
      { playerId: j2.playerId, placement: 1, score: 3 },
      { playerId: j1.playerId, placement: 2, score: 1 }
    ]
  });

  // Attende CHECK_WINNER: deve andare in NEXT_ROUND con suddenDeath=true
  const t1 = Date.now();
  while (lastState?.phase !== 'NEXT_ROUND' && lastState?.phase !== 'GAME_FINISHED') {
    if (Date.now() - t1 > 15000) throw new Error(`timeout: fase ${lastState?.phase}`);
    host.emit(EVT.hostSkip);
    await sleep(120);
  }

  console.log('✔ fase dopo il tie:', lastState?.phase, '| suddenDeath =', lastState?.suddenDeath);
  if (lastState?.phase !== 'NEXT_ROUND' || lastState?.suddenDeath !== true) {
    throw new Error('SUDDEN DEATH non attivato correttamente');
  }
  console.log('✔ punteggi:', lastState?.players.map((p) => `${p.displayName}:${p.score}`).join(', '));

  console.log('✅ SUDDEN DEATH TEST OK');
  process.exit(0);
}

main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
