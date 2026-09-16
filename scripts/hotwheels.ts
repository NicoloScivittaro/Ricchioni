import { io, Socket } from 'socket.io-client';
import { EVT } from '../shared/protocol';
import type { AckResponse, JoinAck, MinigameSelectedPayload } from '../shared/protocol';

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
  const created = await emitAck<AckResponse>(host, EVT.hostCreate, { playerCount: 5, targetScore: 30 });

  const chars = ['goblin', 'buttafuori', 'dottore', 'judoka', 'ciro'];
  const names = ['Nicolò', 'Christian', 'Victor', 'Judoka', 'Ciro'];
  for (let i = 0; i < 5; i++) {
    const p = connect();
    await new Promise((r) => p.on('connect', r));
    await emitAck<JoinAck & AckResponse>(p, EVT.playerJoin, { roomCode: created.roomCode as string, displayName: names[i] });
    p.emit(EVT.playerSelectCharacter, { characterId: chars[i] });
    await sleep(40);
    p.emit(EVT.playerReady, { ready: true });
    await sleep(40);
  }

  host.emit(EVT.hostSelectMinigame, { minigameId: 'hotwheels' });
  await sleep(200);

  const pickP = new Promise<MinigameSelectedPayload>((r) => host.once(EVT.minigameSelected, r));
  host.emit(EVT.hostStart);
  const pick = await pickP;

  console.log('✔ minigioco:', pick.minigameId, '|', pick.name, '|', pick.category);
  console.log('✔ giocatori:', pick.players.length);
  console.log('✔ controller:', pick.controllerLayout.type, '=', pick.controllerLayout.controls.map((c) => c.id).join(','));
  if (pick.minigameId !== 'hotwheels') throw new Error('hotwheels non selezionato');
  if (pick.players.length !== 5) throw new Error('attesi 5 giocatori');

  console.log('✅ HOT WHEELS TEST OK (5 giocatori)');
  process.exit(0);
}

main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
