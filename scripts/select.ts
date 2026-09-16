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
  const created = await emitAck<AckResponse>(host, EVT.hostCreate, { playerCount: 2, targetScore: 30 });

  const p1 = connect();
  await new Promise((r) => p1.on('connect', r));
  await emitAck<JoinAck & AckResponse>(p1, EVT.playerJoin, { roomCode: created.roomCode as string, displayName: 'Nicolò' });
  const p2 = connect();
  await new Promise((r) => p2.on('connect', r));
  await emitAck<JoinAck & AckResponse>(p2, EVT.playerJoin, { roomCode: created.roomCode as string, displayName: 'Christian' });

  p1.emit(EVT.playerSelectCharacter, { characterId: 'goblin' });
  p2.emit(EVT.playerSelectCharacter, { characterId: 'buttafuori' });
  await sleep(120);
  p1.emit(EVT.playerReady, { ready: true });
  p2.emit(EVT.playerReady, { ready: true });
  await sleep(120);

  let state: RoomState | null = null;
  host.on(EVT.roomState, (s: RoomState) => (state = s));

  // Selezione manuale
  host.emit(EVT.hostSelectMinigame, { minigameId: 'volleyball' });
  await sleep(200);
  console.log('✔ selectedMinigameId dopo selezione:', state?.selectedMinigameId);

  const pickP = new Promise<MinigameSelectedPayload>((r) => host.once(EVT.minigameSelected, r));
  host.emit(EVT.hostStart);
  const pick = await pickP;

  console.log('✔ minigioco scelto:', pick.minigameId, '|', pick.name);
  console.log('✔ controllerLayout:', pick.controllerLayout.type, 'controls =', pick.controllerLayout.controls.map((c) => c.id).join(','));
  if (pick.minigameId !== 'volleyball') throw new Error('la selezione manuale non è stata rispettata');

  // Torna al rullo
  host.emit(EVT.hostBackToLobby);
  await sleep(200);
  host.emit(EVT.hostSelectMinigame, { minigameId: null });
  await sleep(200);
  console.log('✔ selectedMinigameId dopo reset:', state?.selectedMinigameId);

  console.log('✅ SELECT TEST OK');
  process.exit(0);
}

main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
