import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {Server} from 'socket.io';
import {io, type Socket} from 'socket.io-client';
import {GameSession} from '../server/GameSession';
import {PlayerSession} from '../server/PlayerSession';
import {RoomManager} from '../server/RoomManager';
import {CHARACTER_ORDER} from '../shared/characters';
import {EVT} from '../shared/protocol';
import type {RoomState} from '../shared/types';

for (let seats = 2; seats <= 5; seats++) for (let humans = 1; humans <= seats; humans++) for (const enabled of [false, true]) {
  const room = new GameSession('LOCAL', seats, 60, 'host');
  try {
    for (let i = 0; i < humans; i++) {
      const p = new PlayerSession(`human${i}`, `Human ${i}`, `token${i}`);
      p.attach(`socket${i}`); room.addPlayer(p);
      room.selectCharacter(p.id, CHARACTER_ORDER[i]); p.ready = true;
    }
    assert.equal(room.setBots(enabled), true);
    assert.equal(room.setBots('true'), false);
    room.players[0].detach(); room.startGame(); assert.equal(room.phase, 'LOBBY');
    room.players[0].attach('socket0'); room.players[0].ready = false;
    room.startGame(); assert.equal(room.phase, 'LOBBY');
    room.players[0].ready = true; room.selectMinigame('quiz'); room.startGame();
    const expected = enabled ? seats : humans;
    assert.equal(room.players.length, expected);
    assert.equal(room.players.filter(p => p.bot).length, expected - humans);
    assert.equal(new Set(room.players.map(p => p.characterId)).size, expected);
    assert.equal(room.lastSelectedPayload!.players.length, expected);
    assert.ok(room.players.filter(p => p.bot).every(p => p.connected && p.ready && !p.connectionId && !p.reconnectToken));
    assert.equal(room.setBots(!enabled), false);
    room.startGame(); assert.equal(room.players.length, expected);
    room.restartMatch(); assert.equal(room.players.length, humans);
    assert.equal(room.fillWithBots, enabled);
    assert.equal(room.charactersLocked.length, humans);
  } finally { room.resetToLobby(); }
}
console.log('PASS: all 2–5 seat / 1–5 human combinations, bots on/off, readiness, unique characters, payload, duplicate start and restart.');

const http = createServer(), server = new Server(http), manager = new RoomManager(server);
server.on('connection', s => manager.handleConnection(s));
await new Promise<void>(r => http.listen(0, '127.0.0.1', r));
const port = (http.address() as {port: number}).port, sockets: Socket[] = [];
const connect = async (): Promise<Socket> => {
  const s = io(`http://127.0.0.1:${port}`, {transports:['websocket'], reconnection:false}); sockets.push(s);
  await new Promise<void>((resolve, reject) => {s.once('connect', resolve); s.once('connect_error', reject);}); return s;
};
const ack = (s: Socket, event: string, p: unknown): Promise<any> => new Promise((resolve, reject) => s.timeout(3000).emit(event, p, (e:unknown, a:unknown) => e ? reject(e) : resolve(a)));
const until = async (fn: () => boolean): Promise<void> => {
  const end = Date.now() + 4000;
  while (!fn()) {if (Date.now() > end) throw Error('State timeout'); await new Promise(r => setTimeout(r, 20));}
};
let state: RoomState | undefined;
try {
  const host = await connect(); host.on(EVT.roomState, s => state = s);
  const created = await ack(host, EVT.hostCreate, {playerCount:5, targetScore:60});
  const humans: Socket[] = [];
  for (let i=0; i<3; i++) {
    const p = await connect(); humans.push(p);
    assert.equal((await ack(p, EVT.playerJoin, {roomCode:created.roomCode, displayName:`Human ${i}`})).ok, true);
    p.emit(EVT.playerSelectCharacter, {characterId:CHARACTER_ORDER[i]}); p.emit(EVT.playerReady, {ready:true});
  }
  await until(() => state?.players.length === 3 && state.players.every(p=>p.ready));
  assert.equal((await ack(humans[0], EVT.hostSetBots, {enabled:false})).ok, false);
  assert.equal((await ack(host, EVT.hostSetBots, {enabled:'false'})).ok, false);
  assert.equal((await ack(host, EVT.hostSetBots, {enabled:false})).ok, true);
  await until(() => state?.fillWithBots === false);
  const resumed = await connect(); resumed.on(EVT.roomState, s => state = s);
  assert.equal((await ack(resumed, EVT.hostCreate, {hostToken:created.hostToken})).roomCode, created.roomCode);
  await until(() => state?.fillWithBots === false);
  assert.equal((await ack(host, EVT.hostSetBots, {enabled:true})).ok, false);
  assert.equal((await ack(resumed, EVT.hostSetBots, {enabled:true})).ok, true);
  await until(() => state?.fillWithBots === true);
  resumed.emit(EVT.hostSelectMinigame, {minigameId:'kart3d'}); resumed.emit(EVT.hostStart);
  await until(() => state?.phase === 'MINIGAME_ROULETTE');
  assert.equal(state!.players.length, 5); assert.equal(state!.players.filter(p=>p.bot).length, 2);
  assert.equal((await ack(resumed, EVT.hostSetBots, {enabled:false})).ok, false);
  resumed.emit(EVT.hostSkip); await until(() => state?.phase === 'MINIGAME_MAP_VOTE');
  assert.deepEqual(state!.mapVote!.options.map(o=>o.id), ['litorale','arcobaleno','sydney','primo']);
  assert.equal(state!.mapVote!.eligible.length, 3);
  assert.ok(state!.mapVote!.eligible.every(id=>!state!.players.find(p=>p.id===id)?.bot));
  resumed.emit(EVT.hostRestartMatch); await until(() => state?.phase === 'LOBBY');
  assert.equal(state!.players.length, 3); assert.equal(state!.charactersLocked.length, 3);
  assert.equal((await ack(resumed, EVT.hostSetBots, {enabled:false})).ok, true);
  for (const p of humans) p.emit(EVT.playerReady, {ready:true});
  await until(() => state!.players.every(p=>p.ready));
  resumed.emit(EVT.hostStart); await until(() => state?.phase !== 'LOBBY');
  assert.equal(state!.players.length, 3); assert.ok(state!.players.every(p=>!p.bot));
  console.log('PASS: real sockets, 3 humans + 2 bots / bots off, host authority and reconnect, phase lock, all four Ribaltati maps, human-only votes and restart cleanup.');
} finally {
  for (const room of (manager as unknown as {rooms:Map<string, GameSession>}).rooms.values()) room.resetToLobby();
  sockets.forEach(s=>s.disconnect());
  await new Promise<void>(r=>server.close(()=>r()));
}
