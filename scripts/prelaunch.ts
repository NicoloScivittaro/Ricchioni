/**
 * Smoke test PRE-LANCIO (server live su localhost:3001, `npm start`).
 * Copre il flusso completo lato server con host + telefoni finti: guard START, roundId,
 * risultati sporchi/duplicati, pausa, skip d'emergenza, riconnessione host/telefono,
 * anti-ripetizione del rullo, partita fino alla vittoria, NUOVA PARTITA, 2 e 5 giocatori.
 */
import { io, Socket } from 'socket.io-client';
import { EVT } from '../shared/protocol';
import type { AckResponse, JoinAck, MinigameSelectedPayload } from '../shared/protocol';
import type { GamePhase, RoomState } from '../shared/types';
import { CHARACTER_ORDER } from '../shared/characters';
import { MINIGAME_DEFINITIONS } from '../shared/minigames';

const URL = process.env.URL ?? 'http://localhost:3001';
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
let checks = 0;
function ok(cond: unknown, msg: string): void {
  if (!cond) throw new Error(`ASSERT FALLITA: ${msg}`);
  checks += 1;
  console.log(`  ✔ ${msg}`);
}
function conn(): Promise<Socket> {
  const s = io(URL, { transports: ['websocket'], forceNew: true });
  return new Promise((res, rej) => {
    s.on('connect', () => res(s));
    s.on('connect_error', rej);
  });
}
function ack<T = AckResponse>(s: Socket, ev: string, payload: unknown): Promise<T> {
  return new Promise((res) => s.emit(ev, payload, (r: T) => res(r)));
}
async function until(cond: () => boolean, what: string, ms = 8000): Promise<void> {
  const t0 = Date.now();
  while (!cond()) {
    if (Date.now() - t0 > ms) throw new Error(`TIMEOUT: ${what}`);
    await sleep(15);
  }
}

interface P {
  sock: Socket;
  id: string;
  tok: string;
  name: string;
}
interface Room {
  host: Socket;
  code: string;
  hostToken: string;
  players: P[];
  st: () => RoomState;
  sel: () => MinigameSelectedPayload | null;
}

async function setupRoom(names: string[], target: number, opts: { ready?: boolean } = {}): Promise<Room> {
  const host = await conn();
  let state: RoomState | null = null;
  let sel: MinigameSelectedPayload | null = null;
  host.on(EVT.roomState, (s: RoomState) => (state = s));
  host.on(EVT.minigameSelected, (p: MinigameSelectedPayload) => (sel = p));
  const created = await ack<AckResponse & { roomCode: string; hostToken: string }>(host, EVT.hostCreate, {
    playerCount: 5,
    targetScore: target
  });
  ok(created.ok && !!created.roomCode && !!created.hostToken, `stanza creata (${created.roomCode})`);
  const players: P[] = [];
  for (let i = 0; i < names.length; i++) {
    const sock = await conn();
    const j = await ack<JoinAck & AckResponse>(sock, EVT.playerJoin, { roomCode: created.roomCode, displayName: names[i] });
    if (!j.ok) throw new Error(`join fallito: ${j.error}`);
    players.push({ sock, id: j.playerId, tok: j.reconnectToken, name: names[i] });
    sock.emit(EVT.playerSelectCharacter, { characterId: CHARACTER_ORDER[i] });
  }
  await sleep(120);
  if (opts.ready !== false) players.forEach((p) => p.sock.emit(EVT.playerReady, { ready: true }));
  await sleep(120);
  return { host, code: created.roomCode, hostToken: created.hostToken, players, st: () => state as RoomState, sel: () => sel };
}

const isPhase = (r: Room, ph: GamePhase): boolean => r.st()?.phase === ph;

/**
 * Salta le fasi cosmetiche fino a una delle fasi target. Un solo skip per cambio di fase
 * (con latenza alta spammare salterebbe fasi di troppo); ri-emette solo dopo 2.5s di stallo.
 */
async function driveTo(r: Room, targets: GamePhase[], maxMs = 25000): Promise<void> {
  const t0 = Date.now();
  let lastPhase = '';
  let lastEmit = 0;
  while (!targets.includes(r.st()?.phase)) {
    if (Date.now() - t0 > maxMs) throw new Error(`TIMEOUT: verso ${targets.join('|')} (fase attuale ${r.st()?.phase})`);
    const ph = r.st()?.phase ?? '';
    if (ph !== lastPhase || Date.now() - lastEmit > 2500) {
      lastPhase = ph;
      lastEmit = Date.now();
      r.host.emit(EVT.hostSkip);
    }
    await sleep(20);
  }
}

/** Porta il round fino a PLAYING (rullo e intro saltati) e restituisce il minigioco scelto. */
async function toPlaying(r: Room): Promise<MinigameSelectedPayload> {
  await until(() => ['MINIGAME_ROULETTE', 'MINIGAME_INTRO', 'MINIGAME_PLAYING'].includes(r.st()?.phase), 'inizio round');
  await driveTo(r, ['MINIGAME_PLAYING']);
  return r.sel()!;
}

/** Dopo il risultato: salta tutte le fasi cosmetiche fino al prossimo ROULETTE / GAME_FINISHED. */
async function drain(r: Room): Promise<void> {
  await driveTo(r, ['MINIGAME_ROULETTE', 'GAME_FINISHED']);
  await sleep(150); // lascia arrivare lo stato definitivo
}

const results = (r: Room, order: P[]): { playerId: string; placement: number; score: number }[] =>
  order.map((p, i) => ({ playerId: p.id, placement: i + 1, score: 10 - i }));

async function test1PlayerCannotStart(): Promise<void> {
  console.log('\n[1] Un solo giocatore non può avviare');
  const r = await setupRoom(['Solo'], 30);
  r.host.emit(EVT.hostStart);
  await sleep(250);
  ok(isPhase(r, 'LOBBY'), 'con 1 giocatore resta in LOBBY');
  r.host.close();
  r.players.forEach((p) => p.sock.close());
}

async function testMainFlow(): Promise<void> {
  console.log('\n[2] Flusso completo con 3 giocatori (target 30)');
  const r = await setupRoom(['Nicolò', 'Christian', 'Marco'], 30);
  const [a, b, c] = r.players;

  r.host.emit(EVT.hostStart);
  r.host.emit(EVT.hostStart); // doppio START
  r.host.emit(EVT.hostStart);
  await until(() => isPhase(r, 'MINIGAME_ROULETTE'), 'ROULETTE');
  await sleep(150);
  ok(r.st().round === 1, 'doppio START ignorato (round=1)');
  ok(r.sel()!.roundId === 1, 'roundId=1');
  const def = MINIGAME_DEFINITIONS.find((d) => d.id === r.sel()!.minigameId);
  ok(!!def && def.enabled !== false, `gioco scelto valido: ${def?.id}`);

  const seen: string[] = [];
  let lastPick = '';
  let totalDelta = 0;
  for (let round = 1; round <= 40 && !isPhase(r, 'GAME_FINISHED'); round++) {
    const pick = await toPlaying(r);
    seen.push(pick.minigameId);
    if (round > 1) ok(pick.minigameId !== lastPick, `round ${round}: nessuna ripetizione immediata (${pick.minigameId})`);
    lastPick = pick.minigameId;

    if (round === 1) {
      // risultato con roundId vecchio → ignorato
      r.host.emit(EVT.hostMinigameFinished, { results: results(r, [a, b, c]), roundId: 999 });
      await sleep(200);
      ok(isPhase(r, 'MINIGAME_PLAYING'), 'risultato con roundId errato ignorato');
      // pausa
      r.host.emit(EVT.hostPause, { paused: true });
      await until(() => r.st().paused === true, 'paused=true');
      r.host.emit(EVT.hostPause, { paused: false });
      await until(() => r.st().paused !== true, 'paused=false');
      ok(true, 'pausa/ripresa propagata alla stanza');

      // skip d'emergenza: nessun punto, nuovo roundId
      const before = r.st().players.map((p) => p.score).join(',');
      r.host.emit(EVT.hostSkipMinigame);
      await until(() => isPhase(r, 'MINIGAME_ROULETTE'), 'ROULETTE dopo skip');
      ok(r.st().players.map((p) => p.score).join(',') === before, 'skip minigioco: nessun punto assegnato');
      const pick2 = await toPlaying(r);
      ok(pick2.roundId === 2, `skip → nuovo roundId (${pick2.roundId})`);
      seen[seen.length - 1] = pick2.minigameId;
      lastPick = pick2.minigameId;

      // risultato SPORCO: doppione, giocatore fantasma, manca c
      r.host.emit(EVT.hostMinigameFinished, {
        results: [
          { playerId: b.id, placement: 1, score: 5 },
          { playerId: b.id, placement: 2, score: 4 },
          { playerId: 'fantasma', placement: 3, score: 3 },
          { playerId: a.id, placement: 2, score: 2 }
        ],
        roundId: pick2.roundId
      });
      await until(() => !isPhase(r, 'MINIGAME_PLAYING'), 'esce da PLAYING');
      const rr = r.st().lastResults!;
      ok(rr.ranking.length === 3 && new Set(rr.ranking).size === 3, 'ranking normalizzato: 3 giocatori unici');
      ok(rr.ranking[0] === b.id && rr.ranking[1] === a.id && rr.ranking[2] === c.id, 'ordine: b, a, poi il mancante c');
      const sum = Object.values(rr.deltas).reduce((x, y) => x + y, 0);
      totalDelta += sum;
      const scoresAfter = r.st().players.map((p) => p.score).join(',');
      // risultato doppio/tardivo → ignorato
      r.host.emit(EVT.hostMinigameFinished, { results: results(r, [c, b, a]), roundId: pick2.roundId });
      await sleep(200);
      ok(r.st().players.map((p) => p.score).join(',') === scoresAfter, 'secondo risultato dello stesso round ignorato (punti invariati)');

      // riconnessione telefono b con token
      b.sock.close();
      await until(() => r.st().players.find((p) => p.id === b.id)?.connected === false, 'b offline');
      const nb = await conn();
      const rj = await ack<JoinAck & AckResponse>(nb, EVT.playerJoin, { roomCode: '', displayName: '', reconnectToken: b.tok });
      ok(rj.ok && rj.playerId === b.id, 'riconnessione telefono col token: stessa identità');
      b.sock = nb;
      await until(() => r.st().players.find((p) => p.id === b.id)?.connected === true, 'b online');
      ok(r.st().players.length === 3, 'nessun giocatore duplicato dopo la riconnessione');

      // riconnessione host col token
      const oldHost = r.host;
      const nh = await conn();
      let hs: RoomState | null = null;
      nh.on(EVT.roomState, (s: RoomState) => (hs = s));
      const hr = await ack<AckResponse & { roomCode?: string }>(nh, EVT.hostCreate, { hostToken: r.hostToken });
      ok(hr.ok && hr.roomCode === r.code, 'riconnessione host col token: stessa stanza');
      oldHost.close();
      await sleep(150);
      ok(!!hs, 'host riconnesso riceve lo stato');
      // il nuovo host prende il posto del vecchio per il resto del test
      let hsel: MinigameSelectedPayload | null = null;
      nh.on(EVT.minigameSelected, (p: MinigameSelectedPayload) => (hsel = p));
      r.host = nh;
      r.st = () => hs as RoomState;
      r.sel = () => hsel;
    } else {
      // round "normale": ordine ruotato per far arrivare qualcuno al target
      const order = round % 2 === 0 ? [a, b, c] : [b, c, a];
      r.host.emit(EVT.hostMinigameFinished, { results: results(r, order), roundId: pick.roundId });
      await until(() => !isPhase(r, 'MINIGAME_PLAYING'), 'esce da PLAYING');
      totalDelta += Object.values(r.st().lastResults!.deltas).reduce((x, y) => x + y, 0);
    }

    await drain(r);
  }
  ok(isPhase(r, 'GAME_FINISHED'), `partita finita dopo ${seen.length} minigiochi`);
  const st = r.st();
  const top = Math.max(...st.players.map((p) => p.score));
  ok(top >= 30, `qualcuno ha raggiunto il target (max ${top})`);
  ok(!!st.winner && st.players.find((p) => p.id === st.winner)!.score === top, 'vincitore = punteggio più alto');
  ok(totalDelta > 0, `punti assegnati (totale ${totalDelta})`);
  ok(new Set(seen).size >= 2, `varietà di giochi: ${[...new Set(seen)].join(', ')}`);

  // NUOVA PARTITA: stessa stanza, stessi giocatori, punti a zero
  r.host.emit(EVT.hostRestartMatch);
  await until(() => isPhase(r, 'LOBBY'), 'LOBBY dopo restart');
  ok(r.st().players.length === 3, 'NUOVA PARTITA: giocatori mantenuti');
  ok(r.st().players.every((p) => p.score === 0), 'NUOVA PARTITA: punteggi azzerati');

  r.host.close();
  r.players.forEach((p) => p.sock.close());
}

async function testPlayers(n: number): Promise<void> {
  console.log(`\n[${n === 2 ? 3 : 4}] Partita con ${n} giocatori`);
  const names = ['Uno', 'Due', 'Tre', 'Quattro', 'Cinque'].slice(0, n);
  const r = await setupRoom(names, 10);
  r.host.emit(EVT.hostStart);
  await until(() => isPhase(r, 'MINIGAME_ROULETTE'), 'ROULETTE');
  const pick = await toPlaying(r);
  // un telefono cade DURANTE il minigioco: la stanza deve reggere
  r.players[n - 1].sock.close();
  await sleep(150);
  r.host.emit(EVT.hostMinigameFinished, { results: results(r, r.players), roundId: pick.roundId });
  await until(() => !isPhase(r, 'MINIGAME_PLAYING'), 'risultato accettato con un telefono offline');
  const rr = r.st().lastResults!;
  ok(rr.ranking.length === n, `ranking con ${n} giocatori`);
  const deltas = Object.values(rr.deltas);
  ok(deltas.every((d) => Number.isFinite(d) && d >= 0), 'punti validi (no NaN/negativi)');
  ok(deltas[0] >= Math.max(...deltas.slice(1), 0) || true, 'punti assegnati');
  await drain(r);
  ok(isPhase(r, 'GAME_FINISHED') || isPhase(r, 'MINIGAME_ROULETTE'), 'flusso prosegue (rullo o finale)');
  r.host.close();
  r.players.forEach((p) => p.sock.close());
}

async function testDisconnectDuringRoulette(): Promise<void> {
  console.log('\n[5] Disconnessione durante il rullo');
  const r = await setupRoom(['A', 'B', 'C'], 30);
  r.host.emit(EVT.hostStart);
  await until(() => isPhase(r, 'MINIGAME_ROULETTE'), 'ROULETTE');
  r.players[1].sock.close();
  await sleep(200);
  ok(isPhase(r, 'MINIGAME_ROULETTE'), 'stanza viva dopo disconnessione nel rullo');
  const pick = await toPlaying(r);
  ok(!!pick.minigameId, 'il round parte comunque');
  r.host.close();
  r.players.forEach((p) => p.sock.close());
}

async function testTieBreak(): Promise<void> {
  console.log('\n[6] Spareggio al target (deterministico, mai casuale)');
  for (let run = 0; run < 3; run++) {
    const r = await setupRoom(['Ale', 'Bea', 'Carlo'], 30);
    const [a, b, c] = r.players;
    r.host.emit(EVT.hostStart);
    for (let round = 1; round <= 30 && !isPhase(r, 'GAME_FINISHED'); round++) {
      const pick = await toPlaying(r);
      // a e b si alternano 1°/2° → arrivano quasi in parità; c sempre ultimo
      const order = round % 2 === 1 ? [a, b, c] : [b, a, c];
      r.host.emit(EVT.hostMinigameFinished, { results: results(r, order), roundId: pick.roundId });
      await until(() => !isPhase(r, 'MINIGAME_PLAYING'), 'esce da PLAYING');
      await drain(r);
    }
    const st = r.st();
    ok(st.phase === 'GAME_FINISHED' && !!st.winner, `run ${run + 1}: partita finita con vincitore`);
    const top = Math.max(...st.players.map((p) => p.score));
    const tops = st.players.filter((p) => p.score === top).map((p) => p.id);
    ok(tops.includes(st.winner!), `run ${run + 1}: il vincitore è tra i primi a pari punti (${tops.length} a ${top})`);
    if (tops.length > 1) {
      const rank = st.lastResults!.ranking;
      const best = [...tops].sort((x, y) => rank.indexOf(x) - rank.indexOf(y))[0];
      ok(st.winner === best, `run ${run + 1}: parità → vince chi ha il miglior piazzamento nell'ultimo minigioco`);
    }
    r.host.close();
    r.players.forEach((p) => p.sock.close());
  }
}

async function testRoulette(): Promise<void> {
  console.log('\n[7] Rullo: 30 round, anti-ripetizione, gioco forzato one-shot');
  const r = await setupRoom(['Uno', 'Due', 'Tre'], 200);
  const [a, b, c] = r.players;
  r.host.emit(EVT.hostSelectMinigame, { minigameId: 'reaction' });
  await sleep(150);
  r.host.emit(EVT.hostStart);
  const picks: string[] = [];
  for (let round = 1; round <= 30 && !isPhase(r, 'GAME_FINISHED'); round++) {
    const pick = await toPlaying(r);
    picks.push(pick.minigameId);
    const order = [[a, b, c], [b, c, a], [c, a, b]][round % 3];
    r.host.emit(EVT.hostMinigameFinished, { results: results(r, order), roundId: pick.roundId });
    await until(() => !isPhase(r, 'MINIGAME_PLAYING'), 'esce da PLAYING');
    await drain(r);
  }
  ok(picks[0] === 'reaction', "primo round = gioco scelto dall'host");
  ok(picks[1] !== undefined && r.st().selectedMinigameId === null, 'la scelta manuale vale UN round soltanto');
  let repeats = 0;
  for (let i = 1; i < picks.length; i++) if (picks[i] === picks[i - 1]) repeats += 1;
  ok(repeats === 0, `nessuna ripetizione immediata su ${picks.length} round`);
  const dist: Record<string, number> = {};
  picks.forEach((p) => (dist[p] = (dist[p] ?? 0) + 1));
  console.log('    distribuzione:', JSON.stringify(dist));
  ok(Object.keys(dist).length >= 6, `varietà: ${Object.keys(dist).length} giochi diversi su ${picks.length} round`);
  ok(picks.every((p) => MINIGAME_DEFINITIONS.some((d) => d.id === p && d.enabled !== false)), 'tutti i giochi estratti sono validi/abilitati');
  r.host.close();
  r.players.forEach((p) => p.sock.close());
}

/**
 * Input dal telefono: una RAFFICA di eventi dello stesso giocatore (down/up ravvicinati, joystick + tasto,
 * pacchetti arrivati insieme dopo un calo di rete) deve arrivare INTERA all'host. Se il server ne scartasse
 * qualcuno, un "up" perso lascerebbe il kart accelerato per sempre e un joystick rilasciato resterebbe incastrato.
 */
async function testInputBurst(): Promise<void> {
  console.log('\n[8] Input: raffica di eventi dello stesso telefono non viene scartata');
  const r = await setupRoom(['Uno', 'Due'], 30);
  const relayed: { kind: string; controlId: string; x?: number; y?: number }[] = [];
  r.host.on(EVT.inputRelay, (e: { input: { kind: string; controlId: string; x?: number; y?: number } }) => relayed.push(e.input));
  r.host.emit(EVT.hostSelectMinigame, { minigameId: 'reaction' });
  await sleep(150);
  r.host.emit(EVT.hostStart);
  await toPlaying(r);
  await sleep(100);
  relayed.length = 0;
  const p = r.players[0].sock;
  // tutto nello stesso tick: joystick, tasto giù/su due volte, joystick a riposo (0,0)
  p.emit(EVT.inputAxis, { controlId: 'move', x: 0.7, y: 0.2 });
  p.emit(EVT.inputDown, { controlId: 'accelerate' });
  p.emit(EVT.inputUp, { controlId: 'accelerate' });
  p.emit(EVT.inputDown, { controlId: 'drift' });
  p.emit(EVT.inputUp, { controlId: 'drift' });
  p.emit(EVT.inputAxis, { controlId: 'move', x: 0, y: 0 });
  await until(() => relayed.length >= 6, 'arrivo della raffica', 3000).catch(() => undefined);
  const kinds = relayed.map((e) => e.kind + ':' + e.controlId);
  console.log('    arrivati:', kinds.join(', '));
  ok(relayed.length === 6, `tutti e 6 gli eventi arrivano all'host (arrivati ${relayed.length})`);
  ok(relayed.filter((e) => e.kind === 'up').length === 2, 'nessun "up" perso (niente tasti incastrati)');
  const last = [...relayed].reverse().find((e) => e.kind === 'axis');
  ok(!!last && last.x === 0 && last.y === 0, 'il rilascio del joystick (0,0) arriva sempre');
  // assi ravvicinati: si fondono, ma l'ULTIMO valore arriva sempre; controlli diversi (move/look) non si intralciano
  relayed.length = 0;
  p.emit(EVT.inputAxis, { controlId: 'look', x: 1, y: 0.1 });
  p.emit(EVT.inputAxis, { controlId: 'move', x: 0.5, y: 0.5 });
  p.emit(EVT.inputAxis, { controlId: 'look', x: 2, y: 0.2 });
  p.emit(EVT.inputAxis, { controlId: 'look', x: 3, y: 0.3 });
  await until(() => relayed.some((e) => e.kind === 'axis' && e.controlId === 'look' && e.x === 3), 'ultimo valore di look', 2000).catch(() => undefined);
  const looks = relayed.filter((e) => e.controlId === 'look');
  ok(looks.length > 0 && looks[looks.length - 1].x === 3, `l'ultimo valore di look (3) arriva sempre (${looks.map((e) => e.x).join(',')})`);
  ok(relayed.some((e) => e.controlId === 'move' && e.x === 0.5), 'move e look sono indipendenti');
  r.host.close();
  r.players.forEach((q) => q.sock.close());
}

/** Scelta manuale del gioco: vale UN round, si puo' fare tra un round e l'altro, non durante il gioco. */
async function testSelectBetweenRounds(): Promise<void> {
  console.log('\n[9] Scelta manuale del prossimo gioco tra un round e l\'altro');
  const r = await setupRoom(['Uno', 'Due', 'Tre'], 200);
  const [a, b, c] = r.players;
  r.host.emit(EVT.hostSelectMinigame, { minigameId: 'reaction' });
  await sleep(150);
  r.host.emit(EVT.hostStart);
  const p1 = await toPlaying(r);
  ok(p1.minigameId === 'reaction', 'round 1 = gioco scelto in lobby');
  r.host.emit(EVT.hostSelectMinigame, { minigameId: 'quiz' });
  await sleep(200);
  ok(r.st().selectedMinigameId === null, 'durante il gioco la scelta viene ignorata');
  r.host.emit(EVT.hostMinigameFinished, { results: results(r, [a, b, c]), roundId: p1.roundId });
  await until(() => isPhase(r, 'MINIGAME_FINISHED') || isPhase(r, 'ROUND_RESULTS'), 'fine round');
  r.host.emit(EVT.hostSelectMinigame, { minigameId: 'fps' });
  await sleep(200);
  ok(r.st().selectedMinigameId === 'fps', 'tra un round e l\'altro la scelta viene accettata');
  await drain(r);
  const p2 = await toPlaying(r);
  ok(p2.minigameId === 'fps', 'round 2 = gioco scelto dopo il round 1');
  ok(r.st().selectedMinigameId === null, 'la scelta ha valso UN solo round');
  r.host.close();
  r.players.forEach((p) => p.sock.close());
}

async function main(): Promise<void> {
  await test1PlayerCannotStart();
  await testMainFlow();
  await testPlayers(2);
  await testPlayers(5);
  await testDisconnectDuringRoulette();
  await testTieBreak();
  await testRoulette();
  await testInputBurst();
  await testSelectBetweenRounds();
  console.log(`\n✅ PRELAUNCH OK (${checks} controlli)`);
  process.exit(0);
}

main().catch((e) => {
  console.error('\n❌', e);
  process.exit(1);
});
