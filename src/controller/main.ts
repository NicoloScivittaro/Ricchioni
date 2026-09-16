import { io, Socket } from 'socket.io-client';
import { EVT } from '../../shared/protocol';
import type { AckResponse, JoinAck, JoinPayload } from '../../shared/protocol';
import type { InputEvent, PlayerPublic, RoomState } from '../../shared/types';
import { CHARACTERS, CHARACTER_ORDER } from '../../shared/characters';
import { renderController } from './ControllerRenderer';
import './style.css';

const serverUrl = (import.meta.env.VITE_SERVER_URL as string | undefined)?.trim();
const socket: Socket = serverUrl
  ? io(serverUrl)
  : import.meta.env.DEV
    ? io(`http://${location.hostname}:3001`)
    : io();
const app = document.getElementById('app')!;

let playerId: string | null = null;
let reconnectToken: string | null = null;
let state: RoomState | null = null;
let lastMinigameId: string | null = null;

const LS = { pid: 'ricchioni.pid', tok: 'ricchioni.tok' };

function loadIdentity(): { playerId: string | null; reconnectToken: string | null } {
  try {
    return {
      playerId: localStorage.getItem(LS.pid),
      reconnectToken: localStorage.getItem(LS.tok)
    };
  } catch {
    return { playerId: null, reconnectToken: null };
  }
}

function saveIdentity(pid: string, tok: string): void {
  try {
    localStorage.setItem(LS.pid, pid);
    localStorage.setItem(LS.tok, tok);
  } catch {
    /* ignore */
  }
}

function clearIdentity(): void {
  try {
    localStorage.removeItem(LS.pid);
    localStorage.removeItem(LS.tok);
  } catch {
    /* ignore */
  }
}

const saved = loadIdentity();
playerId = saved.playerId;
reconnectToken = saved.reconnectToken;

// ---- eventi server ----

socket.on(EVT.roomState, (payload) => {
  state = payload as RoomState;
  render();
});

socket.on(EVT.vibrate, () => {
  try {
    navigator.vibrate?.(120);
  } catch {
    /* ignore */
  }
});

// ---- rendering ----

function render(): void {
  const me: PlayerPublic | undefined =
    playerId && state ? state.players.find((p) => p.id === playerId) : undefined;

  if (!state || !playerId || !me) {
    if (reconnectToken && !state) renderReconnecting();
    else renderJoin();
    return;
  }

  switch (state.phase) {
    case 'LOBBY':
      lastMinigameId = null;
      renderCharacterSelect(state, me);
      break;
    case 'MINIGAME_PLAYING':
      renderPlaying(state);
      break;
    case 'MINIGAME_ROULETTE':
    case 'MINIGAME_INTRO':
      lastMinigameId = null;
      renderPreGame(state);
      break;
    case 'MINIGAME_FINISHED':
    case 'ROUND_RESULTS':
    case 'GLOBAL_LEADERBOARD':
    case 'CHECK_WINNER':
      lastMinigameId = null;
      renderRoundEnded();
      break;
    case 'NEXT_ROUND':
      lastMinigameId = null;
      renderNextRound();
      break;
    case 'GAME_FINISHED':
      lastMinigameId = null;
      renderGameOver(state);
      break;
    default:
      renderWait(state);
  }
}

function renderJoin(): void {
  app.innerHTML = `
    <div class="screen">
      <h1>🎲 RICCHIONI</h1>
      <p class="sub">Controller di gioco</p>
      <input id="code" placeholder="CODICE STANZA" maxlength="5" autocomplete="off" />
      <input id="name" placeholder="IL TUO NOME" maxlength="20" autocomplete="off" />
      <button id="go" class="big">ENTRA</button>
      <p id="err" class="err"></p>
    </div>`;

  const code = app.querySelector<HTMLInputElement>('#code')!;
  const name = app.querySelector<HTMLInputElement>('#name')!;
  const go = app.querySelector<HTMLButtonElement>('#go')!;
  const err = app.querySelector<HTMLParagraphElement>('#err')!;

  const roomParam = new URLSearchParams(location.search).get('room');
  if (roomParam) code.value = roomParam.toUpperCase();

  const doJoin = (): void => {
    const c = code.value.toUpperCase().trim();
    const n = name.value.trim() || 'Giocatore';
    if (!c) {
      err.textContent = 'Inserisci il codice stanza';
      return;
    }
    go.disabled = true;
    err.textContent = 'Connessione...';
    const payload: JoinPayload = { roomCode: c, displayName: n };
    socket.emit(EVT.playerJoin, payload, (ack: JoinAck & AckResponse) => {
      if (ack.ok && ack.playerId) {
        playerId = ack.playerId;
        reconnectToken = ack.reconnectToken;
        saveIdentity(playerId, reconnectToken);
      } else {
        go.disabled = false;
        err.textContent = ack.error ?? 'Errore';
      }
    });
  };

  go.addEventListener('click', doJoin);
  [code, name].forEach((el) => el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doJoin();
  }));
}

function renderReconnecting(): void {
  app.innerHTML = `<div class="screen"><h1>Riconnessione...</h1><p class="sub">Riprendo la partita</p></div>`;
}

function renderCharacterSelect(state: RoomState, me: PlayerPublic): void {
  const myChar = me.characterId;
  app.innerHTML = `
    <div class="screen">
      <h1>Scegli il personaggio</h1>
      <div id="chars" class="char-grid"></div>
      <button id="ready" class="big ${me.ready ? 'ready' : ''}">${me.ready ? 'PRONTO ✅' : 'PRONTO'}</button>
      <p class="sub">${state.players.length}/${state.playerCount} giocatori</p>
    </div>`;

  const grid = app.querySelector<HTMLDivElement>('#chars')!;
  for (const cid of CHARACTER_ORDER) {
    const c = CHARACTERS[cid];
    const locked = state.charactersLocked.includes(cid) && myChar !== cid;
    const mine = myChar === cid;
    const b = document.createElement('button');
    b.className = 'char' + (mine ? ' mine' : '') + (locked ? ' locked' : '');
    b.textContent = `${c.avatar} ${c.name}`;
    b.disabled = locked;
    b.addEventListener('click', () => socket.emit(EVT.playerSelectCharacter, { characterId: cid }));
    grid.appendChild(b);
  }

  const ready = app.querySelector<HTMLButtonElement>('#ready')!;
  ready.disabled = !myChar;
  ready.addEventListener('click', () => socket.emit(EVT.playerReady, { ready: !me.ready }));
}

function renderPlaying(state: RoomState): void {
  const mg = state.currentMinigame;
  if (!mg) return;
  if (lastMinigameId === mg.minigameId) return; // evita re-render durante il gioco
  lastMinigameId = mg.minigameId;

  app.innerHTML = `
    <div class="screen">
      <h1>${mg.name}</h1>
      <div id="ctl"></div>
    </div>`;
  renderController(app.querySelector<HTMLDivElement>('#ctl')!, mg.controllerLayout, sendInput);
}

function sendInput(ev: InputEvent): void {
  switch (ev.kind) {
    case 'down':
      socket.emit(EVT.inputDown, { controlId: ev.controlId });
      break;
    case 'up':
      socket.emit(EVT.inputUp, { controlId: ev.controlId });
      break;
    case 'action':
      socket.emit(EVT.inputAction, { controlId: ev.controlId });
      break;
    case 'axis':
      socket.emit(EVT.inputAxis, { controlId: ev.controlId, x: ev.x, y: ev.y });
      break;
  }
}

function renderPreGame(state: RoomState): void {
  const mg = state.currentMinigame;
  app.innerHTML = `
    <div class="screen">
      <h1>${mg?.name ?? 'Preparati...'}</h1>
      <p class="sub">Il rullo sta scegliendo il minigioco</p>
    </div>`;
}

function renderRoundEnded(): void {
  app.innerHTML = `
    <div class="screen">
      <h1>ROUND TERMINATO</h1>
      <p class="sub">Guarda lo schermo principale</p>
    </div>`;
}

function renderNextRound(): void {
  app.innerHTML = `
    <div class="screen">
      <h1>PROSSIMO MINIGIOCO...</h1>
      <p class="sub">Guarda lo schermo principale</p>
    </div>`;
}

function renderGameOver(state: RoomState): void {
  const winner = state.players.find((p) => p.id === state.winner);
  app.innerHTML = `
    <div class="screen">
      <h1>🏆</h1>
      <p class="big-num">${winner?.displayName ?? '?'} ha vinto!</p>
    </div>`;
}

function renderWait(state: RoomState): void {
  void state;
  app.innerHTML = `<div class="screen"><h1>Attendi...</h1></div>`;
}

// ---- avvio ----

if (reconnectToken) {
  renderReconnecting();
  const payload: JoinPayload = { roomCode: '', displayName: '', reconnectToken };
  socket.emit(EVT.playerJoin, payload, (ack: JoinAck & AckResponse) => {
    if (ack.ok && ack.playerId) {
      playerId = ack.playerId;
      reconnectToken = ack.reconnectToken;
      saveIdentity(playerId, reconnectToken);
    } else {
      clearIdentity();
      playerId = null;
      reconnectToken = null;
      renderJoin();
    }
  });
} else {
  renderJoin();
}
