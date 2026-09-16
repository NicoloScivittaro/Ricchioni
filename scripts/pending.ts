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
  const hostToken = created.hostToken as string;
  console.log('✔ room:', created.roomCode, '| hostToken:', hostToken.slice(0, 8));

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

  // 1) dati privati host → telefono
  const privP = new Promise<unknown>((r) => p1.once(EVT.privateData, r));
  host.emit(EVT.hostPrivateData, { playerId: j1.playerId, data: 'Carta segreta: GOBLIN' });
  const priv = await privP;
  console.log('✔ privateData ricevuto da p1:', priv);

  // 2) vibrazione all'avvio del minigioco
  const vibP = new Promise((r) => p1.once(EVT.vibrate, r));
  const pickP = new Promise<MinigameSelectedPayload>((r) => host.once(EVT.minigameSelected, r));
  host.emit(EVT.hostStart);
  await Promise.all([vibP, pickP]);
  console.log('✔ vibrate ricevuto dal telefono all\'avvio del minigioco');

  // 3) riconnessione host con token
  const host2 = connect();
  await new Promise((r) => host2.on('connect', r));
  const stateP = new Promise<RoomState>((r) => host2.once(EVT.roomState, r));
  const reAck = await emitAck<AckResponse>(host2, EVT.hostCreate, { hostToken });
  const st = await stateP;
  console.log('✔ host riconnesso:', reAck.ok, '| codice uguale:', st.roomCode === created.roomCode, '| fase:', st.phase);

  console.log('✅ PENDING TEST OK');
  process.exit(0);
}

main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
