import { io, Socket } from 'socket.io-client';
import { EVT } from '../shared/protocol';
import type { AckResponse, JoinAck, MinigameSelectedPayload } from '../shared/protocol';
import type { InputRelayEvent, RoomState } from '../shared/types';

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

  const created = await emitAck<AckResponse>(host, EVT.hostCreate, { playerCount: 2, targetScore: 20 });
  console.log('✔ room created:', JSON.stringify(created));
  const roomCode = String(created.roomCode);

  const selectedP = new Promise<MinigameSelectedPayload>((r) => host.once(EVT.minigameSelected, r));

  const p1 = connect();
  await new Promise((r) => p1.on('connect', r));
  const j1 = await emitAck<JoinAck & AckResponse>(p1, EVT.playerJoin, { roomCode, displayName: 'Nicolò' });
  console.log('✔ p1 joined:', j1.ok, 'playerId=', j1.playerId?.slice(0, 8), 'token=', j1.reconnectToken ? 'yes' : 'no');

  const p2 = connect();
  await new Promise((r) => p2.on('connect', r));
  const j2 = await emitAck<JoinAck & AckResponse>(p2, EVT.playerJoin, { roomCode, displayName: 'Christian' });
  console.log('✔ p2 joined:', j2.ok, 'playerId=', j2.playerId?.slice(0, 8));

  p1.emit(EVT.playerSelectCharacter, { characterId: 'goblin' });
  p2.emit(EVT.playerSelectCharacter, { characterId: 'buttafuori' });
  await sleep(150);
  p1.emit(EVT.playerReady, { ready: true });
  p2.emit(EVT.playerReady, { ready: true });
  await sleep(150);

  host.emit(EVT.hostStart);
  const selected = await selectedP;
  console.log('✔ minigame selected:', selected.minigameId, '|', selected.name, '| players:', selected.players.map((p) => p.displayName).join(', '));
  console.log('✔ controllerLayout:', selected.controllerLayout.type, 'controls=', selected.controllerLayout.controls.map((c) => c.id).join(','));
  console.log('✔ activeModifiers:', Object.keys(selected.activeModifiers).length, 'giocatori con hook');

  const relayP = new Promise<InputRelayEvent>((r) => host.once(EVT.inputRelay, r));
  p1.emit(EVT.inputAction, { controlId: 'answerA' });
  const relay = await relayP;
  console.log('✔ input relayed al host:', relay.playerId === j1.playerId, relay.input.kind, relay.input.controlId);

  const stateP = new Promise<RoomState>((r) => host.once(EVT.roomState, r));
  host.emit(EVT.hostMinigameFinished, { ranking: [j1.playerId, j2.playerId] });
  const st = await stateP;
  console.log('✔ phase dopo finish:', st.phase, '| deltas:', JSON.stringify(st.lastResults?.deltas));

  const nextP = new Promise<MinigameSelectedPayload>((r) => host.once(EVT.minigameSelected, r));
  host.emit(EVT.hostContinue);
  const next = await nextP;
  console.log('✔ prossimo round → minigame:', next.minigameId, '| round:', 2);

  console.log('\n✅ SMOKE TEST OK');
  process.exit(0);
}

main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
