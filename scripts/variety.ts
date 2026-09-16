import { io, Socket } from 'socket.io-client';
import { EVT } from '../shared/protocol';
import type { AckResponse, JoinAck, MinigameSelectedPayload } from '../shared/protocol';
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
  const created = await emitAck<AckResponse>(host, EVT.hostCreate, { playerCount: 2, targetScore: 999 });

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
  const picked: string[] = [];
  host.on(EVT.roomState, (s: RoomState) => (lastState = s));
  host.on(EVT.minigameSelected, (p: MinigameSelectedPayload) => picked.push(p.name));

  const waitPlaying = async (): Promise<void> => {
    const t0 = Date.now();
    while (lastState?.phase !== 'MINIGAME_PLAYING') {
      if (Date.now() - t0 > 15000) throw new Error('timeout verso PLAYING');
      host.emit(EVT.hostSkip);
      await sleep(120);
    }
  };
  const nextRound = async (): Promise<void> => {
    const t0 = Date.now();
    while (lastState?.phase === 'MINIGAME_PLAYING') {
      if (Date.now() - t0 > 15000) throw new Error('finish non processato');
      await sleep(50);
    }
    await waitPlaying();
  };

  host.emit(EVT.hostStart);
  await waitPlaying();

  const ROUNDS = 6;
  for (let r = 0; r < ROUNDS; r++) {
    host.emit(EVT.hostMinigameFinished, {
      results: [
        { playerId: j1.playerId, placement: 1, score: 1 },
        { playerId: j2.playerId, placement: 2, score: 0 }
      ]
    });
    if (r < ROUNDS - 1) await nextRound();
  }

  console.log('✔ giochi selezionati in', ROUNDS, 'round:', picked.join(', '));
  const distinct = new Set(picked);
  console.log('✔ giochi distinti:', distinct.size, 'su 4');
  if (distinct.size < 3) throw new Error('poca varietà nel rullo');

  console.log('✅ VARIETY TEST OK');
  process.exit(0);
}

main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
