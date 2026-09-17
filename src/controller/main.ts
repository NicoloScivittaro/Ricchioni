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

socket.on(EVT.vibrate, (ms?: number) => {
  try {
    navigator.vibrate?.(typeof ms === 'number' && ms > 0 ? ms : 120);
  } catch {
    /* ignore */
  }
});

socket.on(EVT.controllerSignal, (data) => {
  const s = data as { type: string; ms?: number };
  const btn = app.querySelector<HTMLButtonElement>('.ctl-btn');
  if (s.type === 'via') {
    if (btn) {
      btn.textContent = '⚡ PREMI!';
      btn.classList.add('go');
    }
    try {
      navigator.vibrate?.(60);
    } catch {
      /* ignore */
    }
  } else if (s.type === 'pressed') {
    if (btn) {
      btn.textContent = `${s.ms ?? '—'} ms`;
      btn.disabled = true;
      btn.classList.remove('go');
    }
  } else if (s.type === 'falseStart') {
    if (btn) {
      btn.textContent = '❌ FALSA PARTENZA';
      btn.disabled = true;
      btn.classList.remove('go');
    }
    try {
      navigator.vibrate?.([100, 60, 100]);
    } catch {
      /* ignore */
    }
  }
});

interface InfoLineData {
  type: 'info';
  item?: string | null;
  ability?: string | null;
}

function isInfoLine(data: unknown): data is InfoLineData {
  return typeof data === 'object' && data !== null && (data as { type?: unknown }).type === 'info';
}

interface QuizStatePayload {
  type: 'quizState';
  phase: string;
  questionNumber: number;
  totalQuestions: number;
  points: number;
  category: string;
  question: string;
  answers: [string, string, string, string];
  myAnswerIndex: number | null;
  correctIndex: number | null;
  timeRemaining: number;
  totalTime: number;
  playerName: string;
  avatar: string;
  myScore: number;
  abilityName: string;
  abilityDescription: string;
  abilityUsed: boolean;
  hintText: string | null;
  ciroBreakdown: [number, number, number, number] | null;
}

function isQuizState(data: unknown): data is QuizStatePayload {
  return typeof data === 'object' && data !== null && (data as { type?: unknown }).type === 'quizState';
}

let lastInfo: InfoLineData | null = null;
let lastQuizState: QuizStatePayload | null = null;
let quizSelectedLocal: number | null = null;

socket.on(EVT.privateData, (data) => {
  if (isInfoLine(data)) {
    lastInfo = data;
    renderInfoLine();
    return;
  }
  if (isQuizState(data)) {
    if (data.phase === 'intro') quizSelectedLocal = null;
    lastQuizState = data;
    updateQuizUI();
    return;
  }
  // Dati privati (es. carta segreta, ruolo). Mostrati come schermata temporanea.
  app.innerHTML = `
    <div class="screen">
      <h1>🔒 Segreto</h1>
      <p class="big-num">${String(data)}</p>
      <p class="sub">Guarda lo schermo principale</p>
    </div>`;
});

/** Aggiorna la riga "cosa fa" (item tenuto + abilità del personaggio) senza toccare i pulsanti. */
function renderInfoLine(): void {
  const el = app.querySelector<HTMLDivElement>('#info-line');
  if (!el || !lastInfo) return;
  const parts: string[] = [];
  if (lastInfo.item) parts.push(`🎁 ${lastInfo.item}`);
  if (lastInfo.ability) parts.push(`⭐ ${lastInfo.ability}`);
  el.textContent = parts.join(' · ');
}

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
    b.disabled = locked;

    const img = document.createElement('img');
    img.className = 'char-img';
    img.src = c.image;
    img.alt = c.name;

    const label = document.createElement('span');
    label.className = 'char-label';
    label.textContent = `${c.avatar} ${c.name}`;

    b.append(img, label);
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
  showControls(mg);
}

function showControls(mg: NonNullable<RoomState['currentMinigame']>): void {
  const layout = mg.controllerLayout;
  if (layout.type === 'custom' && layout.id === 'quiz-tv') {
    renderQuizController();
    return;
  }
  app.innerHTML = `
    <div class="screen">
      <h1>${mg.name}</h1>
      <p id="info-line" class="sub info-line"></p>
      <div id="ctl"></div>
    </div>`;
  renderController(app.querySelector<HTMLDivElement>('#ctl')!, mg.controllerLayout, sendInput);
  renderInfoLine();
}

const QUIZ_LETTERS = ['A', 'B', 'C', 'D'] as const;
let quizAnswerEls: { root: HTMLButtonElement; letter: HTMLSpanElement; text: HTMLSpanElement }[] = [];

/** Controller "TV quiz show" dedicato a CHI CAZZO LO SA? (layout custom: quiz-tv). */
function renderQuizController(): void {
  lastQuizState = null;
  quizSelectedLocal = null;

  app.innerHTML = `
    <div class="quiz-shell">
      <div class="quiz-topbar">
        <div class="quiz-brand">📚 CHI CAZZO LO SA?</div>
        <div id="quiz-timer" class="quiz-timer" style="display:none">
          <span id="quiz-timer-num">--</span>
        </div>
      </div>
      <div class="quiz-card">
        <div class="quiz-card-top">
          <div>
            <div id="quiz-qnum" class="quiz-qnum">Domanda -/10</div>
            <div id="quiz-dots" class="quiz-dots"></div>
          </div>
          <div id="quiz-points" class="quiz-points">👑 --</div>
        </div>
        <div id="quiz-category" class="quiz-category">—</div>
        <div id="quiz-question" class="quiz-question">In attesa della domanda...</div>
        <p id="quiz-hint" class="quiz-hint"></p>
      </div>
      <div id="quiz-answers" class="quiz-answers"></div>
      <div id="quiz-breakdown" class="quiz-breakdown"></div>
      <div class="quiz-footer">
        <div class="quiz-player">
          <div id="quiz-avatar" class="quiz-avatar">🎮</div>
          <div class="quiz-player-info">
            <div id="quiz-name" class="quiz-name">—</div>
            <div id="quiz-score" class="quiz-score">0 punti</div>
          </div>
        </div>
        <button id="quiz-ability-btn" class="quiz-ability-btn">
          <span id="quiz-ability-icon">⭐</span>
          <span id="quiz-ability-name">ABILITÀ</span>
        </button>
      </div>
      <p id="quiz-ability-desc" class="quiz-ability-desc"></p>
    </div>`;

  const answersRoot = app.querySelector<HTMLDivElement>('#quiz-answers')!;
  quizAnswerEls = [];
  QUIZ_LETTERS.forEach((letter, i) => {
    const btn = document.createElement('button');
    btn.className = `quiz-answer quiz-ans-${letter.toLowerCase()}`;
    const badge = document.createElement('span');
    badge.className = 'quiz-answer-letter';
    badge.textContent = letter;
    const text = document.createElement('span');
    text.className = 'quiz-answer-text';
    btn.append(badge, text);
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (btn.disabled) return;
      quizSelectedLocal = i;
      sendInput({ kind: 'action', controlId: `answer${letter}` });
      updateQuizUI();
    });
    answersRoot.appendChild(btn);
    quizAnswerEls.push({ root: btn, letter: badge, text });
  });

  const abilityBtn = app.querySelector<HTMLButtonElement>('#quiz-ability-btn')!;
  abilityBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (abilityBtn.disabled) return;
    sendInput({ kind: 'action', controlId: 'ability' });
  });
}

function updateQuizUI(): void {
  const s = lastQuizState;
  const root = app.querySelector('.quiz-shell');
  if (!s || !root) return;

  root.querySelector('#quiz-qnum')!.textContent = `Domanda ${s.questionNumber}/${s.totalQuestions}`;

  const dotsEl = root.querySelector('#quiz-dots')!;
  dotsEl.innerHTML = '';
  for (let i = 1; i <= s.totalQuestions; i++) {
    const dot = document.createElement('span');
    dot.className = 'quiz-dot' + (i <= s.questionNumber ? ' filled' : '');
    dotsEl.appendChild(dot);
  }

  root.querySelector('#quiz-points')!.textContent = `👑 vale ${s.points} punt${s.points === 1 ? 'o' : 'i'}`;
  root.querySelector('#quiz-category')!.textContent = s.category.toUpperCase();
  root.querySelector('#quiz-question')!.textContent = s.question;

  const hintEl = root.querySelector<HTMLElement>('#quiz-hint')!;
  hintEl.textContent = s.hintText ? `💡 ${s.hintText}` : '';
  hintEl.style.display = s.hintText ? '' : 'none';

  const locked = s.phase === 'reveal' || s.phase === 'explanation' || s.phase === 'leaderboard';
  quizAnswerEls.forEach((el, i) => {
    el.text.textContent = s.answers[i] ?? '';
    el.letter.textContent = QUIZ_LETTERS[i];
    el.root.classList.remove('selected', 'correct', 'wrong');
    el.root.disabled = locked;

    if (locked && s.correctIndex !== null) {
      if (i === s.correctIndex) el.root.classList.add('correct');
      else if (i === s.myAnswerIndex) el.root.classList.add('wrong');
    } else if (s.myAnswerIndex === i || quizSelectedLocal === i) {
      el.root.classList.add('selected');
    }
  });

  const breakdownEl = root.querySelector<HTMLElement>('#quiz-breakdown')!;
  if (s.ciroBreakdown) {
    breakdownEl.style.display = 'flex';
    breakdownEl.innerHTML = QUIZ_LETTERS.map(
      (letter, i) => `<div class="quiz-breakdown-row"><span>${letter}</span><span>${s.ciroBreakdown![i]}</span></div>`
    ).join('');
  } else {
    breakdownEl.style.display = 'none';
    breakdownEl.innerHTML = '';
  }

  const timerEl = root.querySelector<HTMLElement>('#quiz-timer')!;
  const timerNum = root.querySelector('#quiz-timer-num')!;
  if (s.phase === 'question' && s.totalTime > 0) {
    timerEl.style.display = '';
    timerNum.textContent = Math.max(0, Math.ceil(s.timeRemaining)).toString();
    const frac = Math.max(0, Math.min(1, s.timeRemaining / s.totalTime));
    timerEl.style.setProperty('--pct', `${frac * 360}deg`);
    timerEl.classList.toggle('urgent', s.timeRemaining <= 3);
  } else {
    timerEl.style.display = 'none';
  }

  root.querySelector('#quiz-name')!.textContent = s.playerName;
  root.querySelector('#quiz-avatar')!.textContent = s.avatar;
  root.querySelector('#quiz-score')!.textContent = `${s.myScore} punti`;

  const abilityBtn = root.querySelector<HTMLButtonElement>('#quiz-ability-btn')!;
  root.querySelector('#quiz-ability-name')!.textContent = s.abilityUsed ? `${s.abilityName} · USATA` : s.abilityName;
  root.querySelector('#quiz-ability-desc')!.textContent = s.abilityDescription;
  abilityBtn.classList.toggle('used', s.abilityUsed);
  abilityBtn.disabled = s.abilityUsed;
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
