import { io, Socket } from 'socket.io-client';
import { EVT } from '../../shared/protocol';
import type { AckResponse, JoinAck, JoinPayload } from '../../shared/protocol';
import type { InputEvent, PlayerPublic, RoomState } from '../../shared/types';
import { CHARACTERS, CHARACTER_ORDER } from '../../shared/characters';
import { renderController } from './ControllerRenderer';
import { MEMORY_TILES } from '../../shared/memoryTiles';
import { MEMORY_ABILITIES } from '../../shared/memoryAbilities';
import { ARENA_ABILITIES } from '../../shared/arenaAbilities';
import { DODGEBALL_ABILITIES } from '../../shared/dodgeballAbilities';
import { SOCCER_ABILITIES } from '../../shared/soccerAbilities';
import { VOLLEYBALL_ABILITIES } from '../../shared/volleyballAbilities';
import { getMinigame } from '../../shared/minigames';
import { createVirtualJoystick } from './joystick';
import type { FpsClient, FpsStatePayload } from './fpsClient';
import type { VirtualJoystick } from './joystick';
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
/** Controller attivo (per instradare i segnali): 'memory' | 'quiz' | null. */
let activeController: string | null = null;

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

/**
 * Ad OGNI (ri)connessione Socket.IO il socket ha un id NUOVO e il server non ci riconosce
 * più: va rifatto il join col token, non solo al caricamento della pagina.
 */
function rejoinWithToken(): void {
  if (!reconnectToken) return;
  const payload: JoinPayload = { roomCode: '', displayName: '', reconnectToken };
  socket.emit(EVT.playerJoin, payload, (ack: JoinAck & AckResponse) => {
    if (ack && ack.ok && ack.playerId) {
      playerId = ack.playerId;
      reconnectToken = ack.reconnectToken;
      saveIdentity(playerId, reconnectToken);
    } else {
      // Stanza sparita (server riavviato) o token scaduto: si riparte dal join.
      clearIdentity();
      playerId = null;
      reconnectToken = null;
      state = null;
      lastMinigameId = null;
      renderJoin();
    }
  });
}

function setOfflineBanner(offline: boolean): void {
  let el = document.getElementById('offline-banner');
  if (offline && !el) {
    el = document.createElement('div');
    el.id = 'offline-banner';
    el.textContent = '📡 Connessione persa… riprovo';
    el.style.cssText =
      'position:fixed;top:0;left:0;right:0;z-index:10000;padding:calc(6px + env(safe-area-inset-top,0px)) 10px 6px;text-align:center;' +
      'background:#b91c1c;color:#fff;font:700 13px Arial,sans-serif;pointer-events:none;';
    document.body.appendChild(el);
  } else if (!offline && el) {
    el.remove();
  }
}

socket.on('connect', () => {
  setOfflineBanner(false);
  rejoinWithToken();
});
socket.on('disconnect', () => setOfflineBanner(true));
// Telefono tornato in primo piano (schermo riacceso / cambio app): il join col token è idempotente e
// fa ripartire uno snapshot completo dal server, così la UI si riallinea senza refresh.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && socket.connected) rejoinWithToken();
});

/** Overlay PAUSA (ESC sull'host): sta sopra al controller senza toccarne il DOM. */
function syncPauseOverlay(s: RoomState | null): void {
  const want = !!s && s.phase === 'MINIGAME_PLAYING' && s.paused === true;
  let el = document.getElementById('pause-overlay');
  if (want && !el) {
    el = document.createElement('div');
    el.id = 'pause-overlay';
    el.style.cssText =
      'position:fixed;inset:0;z-index:9999;display:flex;flex-direction:column;align-items:center;' +
      'justify-content:center;gap:10px;background:rgba(0,0,0,.85);color:#fff;touch-action:none;' +
      'font-family:Arial,sans-serif;';
    el.innerHTML =
      '<div style="font:900 44px Arial,sans-serif;color:#fbbf24">⏸ PAUSA</div>' +
      '<div style="font-size:16px;opacity:.75">Guarda lo schermo principale</div>';
    document.body.appendChild(el);
  } else if (!want && el) {
    el.remove();
  }
}

socket.on(EVT.vibrate, (ms?: number) => {
  try {
    navigator.vibrate?.(typeof ms === 'number' && ms > 0 ? ms : 120);
  } catch {
    /* ignore */
  }
});

interface SignalPayload {
  type: string;
  ms?: number;
  name?: string;
  seq?: number[];
  tile?: number;
  seqLen?: number;
  at?: number;
  value?: number;
  cooldownMs?: number;
  team?: string;
  winner?: string;
}

function vibrate(pattern: number | number[]): void {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* ignore */
  }
}

const JOYSTICK_DEADZONE = 0.12;
/** Attiva l'overlay di debug del joystick con `?joyDebug=1` nell'URL. */
const JOYSTICK_DEBUG = new URLSearchParams(location.search).has('joyDebug');

/**
 * Joystick virtuale condiviso da arena/dodgeball/calcio. La logica vive in
 * `joystick.ts` (createVirtualJoystick): qui si passa solo configurazione e
 * callback. Garanzie:
 * - aggancio a UN SOLO dito (pointerId + setPointerCapture), gli altri touch
 *   vengono ignorati finché non si rilascia;
 * - centro/raggio da getBoundingClientRect() a ogni move (mai hardcodati);
 * - vettore = delta dal centro, clampato a (raggio base - raggio thumb), poi
 *   normalizzato in [-1,1] (sinistra=-x, destra=+x, su=-y, giù=+y);
 * - deadzone configurabile (sotto soglia l'OUTPUT è 0, il thumb segue il dito);
 * - reset a (0,0) su pointerup/pointercancel/touchend/touchcancel;
 * - debug opzionale via ?joyDebug=1.
 */
function mountJoystick(
  baseEl: HTMLElement,
  thumbEl: HTMLElement,
  isLocked: () => boolean,
  onAxis: (x: number, y: number) => void
): VirtualJoystick {
  return createVirtualJoystick(baseEl, thumbEl, {
    deadzone: JOYSTICK_DEADZONE,
    enabled: () => !isLocked(),
    onAxis,
    onActiveChange: (active) => baseEl.classList.toggle('arena-joy-active', active),
    debug: JOYSTICK_DEBUG
  });
}

/** Toast temporaneo sovrapposto ai controlli (abilità, avvisi). */
let toastTimer: number | null = null;
function showToast(text: string, ms = 1200): void {
  let el = app.querySelector<HTMLDivElement>('#ctl-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'ctl-toast';
    el.className = 'ctl-toast';
    app.appendChild(el);
  }
  el.textContent = text;
  el.classList.add('show');
  if (toastTimer) window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    el.classList.remove('show');
    toastTimer = null;
  }, ms);
}

// ---- MEMORIA DA UBRIACO (controller dedicato) ----

let memoryTileEls: HTMLButtonElement[] = [];
let memoryAbilityBtn: HTMLButtonElement | null = null;
let memoryStatusEl: HTMLElement | null = null;

function setMemLocked(locked: boolean, statusText: string): void {
  memoryTileEls.forEach((b) => {
    b.disabled = locked;
    b.classList.toggle('mem-locked', locked);
  });
  if (memoryStatusEl) memoryStatusEl.textContent = statusText;
}

function highlightMemTile(index: number, ms: number): void {
  const btn = memoryTileEls[index];
  if (!btn) return;
  btn.classList.add('mem-flash');
  window.setTimeout(() => btn.classList.remove('mem-flash'), ms);
}

function playReplay(seq: number[]): void {
  setMemLocked(true, '🍺 REPLAY...');
  seq.forEach((tile, i) => {
    window.setTimeout(() => highlightMemTile(tile, 380), 300 + i * 420);
  });
  const total = 300 + seq.length * 420 + 500;
  window.setTimeout(() => setMemLocked(false, '👆 TOCCA!'), total);
}

function handleMemorySignal(s: SignalPayload): void {
  switch (s.type) {
    case 'observe':
      setMemLocked(true, '👀 OSSERVA...');
      break;
    case 'repeat':
      setMemLocked(false, '👆 TOCCA!');
      break;
    case 'completed':
      setMemLocked(true, `✅ ${s.ms ?? '—'} ms`);
      vibrate(80);
      break;
    case 'eliminated':
      setMemLocked(true, `💀 ELIMINATO (mossa ${s.at ?? '?'})`);
      vibrate([100, 60, 100]);
      break;
    case 'secondChance':
      setMemLocked(false, '🥊 RIPROVA!');
      vibrate([80, 40, 80]);
      showToast('🥊 MO HO CAPITO — seconda chance');
      break;
    case 'abilityUsed':
      if (memoryAbilityBtn) {
        memoryAbilityBtn.disabled = true;
        memoryAbilityBtn.classList.add('mem-ability-used');
      }
      break;
    case 'replay':
      playReplay(s.seq ?? []);
      break;
    case 'hint':
      highlightMemTile(s.tile ?? 0, 2000);
      showToast("🤦‍♂️ M'HO SVEJATO — casella illuminata");
      break;
    case 'pause':
      showToast('🥋 NO, ASPETTA! — pausa 2s');
      vibrate(40);
      break;
    case 'rate':
      showToast('💸 A RATE — metà fatta, respira!');
      break;
    case 'rateArmed':
      showToast('💸 A RATE attivata');
      break;
  }
}

// ---- ARENA DEL DISAGIO (controller dedicato: joystick + dash + abilità) ----

let arenaJoystickEl: HTMLElement | null = null;
let arenaThumbEl: HTMLElement | null = null;
let arenaDashBtn: HTMLButtonElement | null = null;
let arenaAbilityBtn: HTMLButtonElement | null = null;
let arenaStatusEl: HTMLElement | null = null;
let arenaOverlayEl: HTMLElement | null = null;
let arenaLocked = false;
let arenaDashCooldownTimer: number | null = null;
let arenaJoy: VirtualJoystick | null = null;

function lockArenaControls(locked: boolean): void {
  arenaLocked = locked;
  if (arenaJoystickEl) arenaJoystickEl.classList.toggle('arena-locked', locked);
  if (arenaDashBtn) arenaDashBtn.disabled = locked;
  if (arenaAbilityBtn) arenaAbilityBtn.disabled = locked;
  if (locked) arenaJoy?.reset();
}

/** Schermata piena e drammatica per i momenti chiave (eliminato/vincitore). */
function showArenaOverlay(icon: string, text: string, color: string): void {
  if (!arenaOverlayEl) return;
  arenaOverlayEl.innerHTML = `<span class="arena-overlay-icon">${icon}</span><span class="arena-overlay-text" style="color:${color}">${text}</span>`;
  arenaOverlayEl.classList.add('show');
}

function handleArenaSignal(s: SignalPayload): void {
  switch (s.type) {
    case 'countdown':
      if (s.value === 0) {
        if (arenaStatusEl) arenaStatusEl.textContent = '⚡ VIA!';
        vibrate(110);
      } else if (s.value && s.value > 0) {
        if (arenaStatusEl) arenaStatusEl.textContent = `⏱ ${s.value}`;
        vibrate(35);
      }
      break;
    case 'eliminated':
      lockArenaControls(true);
      showArenaOverlay('💀', 'SEI FUORI!', '#f87171');
      vibrate([100, 60, 100]);
      break;
    case 'won':
      lockArenaControls(true);
      showArenaOverlay('🏆', 'HAI VINTO!', '#fbbf24');
      vibrate([80, 40, 80, 40, 120]);
      break;
    case 'dash_used': {
      if (arenaDashCooldownTimer) window.clearTimeout(arenaDashCooldownTimer);
      if (arenaDashBtn) {
        arenaDashBtn.disabled = true;
        arenaDashBtn.classList.add('arena-dash-cooldown');
      }
      const ms = s.cooldownMs ?? 1150;
      arenaDashCooldownTimer = window.setTimeout(() => {
        arenaDashCooldownTimer = null;
        if (!arenaDashBtn || arenaLocked) return;
        arenaDashBtn.disabled = false;
        arenaDashBtn.classList.remove('arena-dash-cooldown');
        arenaDashBtn.classList.add('arena-dash-ready');
        window.setTimeout(() => arenaDashBtn?.classList.remove('arena-dash-ready'), 260);
      }, ms);
      break;
    }
    case 'ability':
      if (arenaAbilityBtn) {
        arenaAbilityBtn.disabled = true;
        arenaAbilityBtn.classList.add('arena-ability-used');
      }
      showToast(`⭐ ${s.name ?? 'ABILITÀ'}`);
      vibrate(70);
      break;
    case 'ciro_due':
      showToast('💸 DEBITO RISCOSSO!');
      vibrate(90);
      break;
  }
}

/** Controller dedicato a ARENA DEL DISAGIO (layout custom: arena-tv). */
function renderArenaController(): void {
  arenaJoystickEl = null;
  arenaThumbEl = null;
  arenaDashBtn = null;
  arenaAbilityBtn = null;
  arenaStatusEl = null;
  arenaOverlayEl = null;
  arenaLocked = false;
  arenaJoy = null;
  if (arenaDashCooldownTimer) {
    window.clearTimeout(arenaDashCooldownTimer);
    arenaDashCooldownTimer = null;
  }

  const me: PlayerPublic | undefined =
    playerId && state ? state.players.find((p) => p.id === playerId) : undefined;
  const cid = me?.characterId ?? '';
  const ab = ARENA_ABILITIES[cid];

  app.innerHTML = `
    <div class="arena-shell">
      <div class="arena-topbar">
        <div class="arena-brand">🤼 ARENA DEL DISAGIO</div>
        <div id="arena-status" class="arena-status">PRONTO</div>
      </div>
      <div class="arena-body">
        <div id="arena-joy" class="arena-joy">
          <div id="arena-joy-base" class="arena-joy-base">
            <div id="arena-joy-thumb" class="arena-joy-thumb"></div>
          </div>
        </div>
        <div class="arena-actions">
          <button id="arena-dash" class="arena-dash">💨<span>DASH</span></button>
          <button id="arena-ability" class="arena-ability">⭐<span>${ab?.name ?? 'ABILITÀ'}</span></button>
          <p id="arena-ability-desc" class="arena-ability-desc">${ab?.desc ?? ''}</p>
        </div>
      </div>
      <div id="arena-overlay" class="arena-overlay"></div>
    </div>`;

  arenaStatusEl = app.querySelector<HTMLElement>('#arena-status')!;
  arenaOverlayEl = app.querySelector<HTMLElement>('#arena-overlay')!;
  arenaDashBtn = app.querySelector<HTMLButtonElement>('#arena-dash')!;
  arenaAbilityBtn = app.querySelector<HTMLButtonElement>('#arena-ability')!;
  arenaJoystickEl = app.querySelector<HTMLElement>('#arena-joy')!;
  arenaThumbEl = app.querySelector<HTMLElement>('#arena-joy-thumb')!;
  const baseEl = app.querySelector<HTMLElement>('#arena-joy-base')!;

  arenaDashBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (arenaDashBtn!.disabled) return;
    sendInput({ kind: 'action', controlId: 'dash' });
  });
  arenaAbilityBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (arenaAbilityBtn!.disabled) return;
    sendInput({ kind: 'action', controlId: 'ability' });
  });

  arenaJoy = mountJoystick(baseEl, arenaThumbEl, () => arenaLocked, (x, y) => sendInput({ kind: 'axis', controlId: 'move', x, y }));
}

// ---- DODGEBALL DEI COGLIONI (controller dedicato: joystick + lancia + schiva) ----

let dbJoystickEl: HTMLElement | null = null;
let dbThumbEl: HTMLElement | null = null;
let dbThrowBtn: HTMLButtonElement | null = null;
let dbDodgeBtn: HTMLButtonElement | null = null;
let dbAbilityBtn: HTMLButtonElement | null = null;
let dbStatusEl: HTMLElement | null = null;
let dbLocked = false;
let dbJoy: VirtualJoystick | null = null;

function lockDbControls(locked: boolean, statusText?: string): void {
  dbLocked = locked;
  if (dbJoystickEl) dbJoystickEl.classList.toggle('arena-locked', locked);
  if (dbThrowBtn) dbThrowBtn.disabled = locked;
  if (dbDodgeBtn) dbDodgeBtn.disabled = locked;
  if (dbAbilityBtn) dbAbilityBtn.disabled = locked;
  if (statusText && dbStatusEl) dbStatusEl.textContent = statusText;
  if (locked) dbJoy?.reset();
}

function handleDodgeballSignal(s: SignalPayload): void {
  switch (s.type) {
    case 'countdown':
      if (s.value === 0) {
        if (dbStatusEl) dbStatusEl.textContent = '⚡ VIA!';
        vibrate(110);
      } else if (s.value && s.value > 0) {
        if (dbStatusEl) dbStatusEl.textContent = `⏱ ${s.value}`;
        vibrate(35);
      }
      break;
    case 'eliminated':
      lockDbControls(true, '💀 SEI FUORI!');
      vibrate([100, 60, 100]);
      showToast('💀 Sei stato colpito!');
      break;
    case 'won':
      lockDbControls(true, '🏆 HAI VINTO!');
      vibrate([80, 40, 80, 40, 120]);
      showToast('🏆 HAI VINTO!');
      break;
    case 'ability':
      if (dbAbilityBtn) {
        dbAbilityBtn.disabled = true;
        dbAbilityBtn.classList.add('arena-ability-used');
      }
      showToast(`⭐ ${s.name ?? 'ABILITÀ'}`);
      vibrate(70);
      break;
    case 'parry_ok':
      showToast("↩️ RIPIGLIATELA! Rimandata al mittente!");
      vibrate(110);
      break;
    case 'parry_miss':
      showToast('😵 Parata a vuoto...');
      break;
    case 'charged':
      showToast('💥 Tiro potenziato!');
      vibrate(60);
      break;
    case 'era_solo':
      showToast('🤦 ERA SOLO UN PERIODO.');
      vibrate(90);
      break;
    case 'truck_go':
      if (dbStatusEl) dbStatusEl.textContent = '🚚 BIP BIP BIP!';
      vibrate([60, 40, 60]);
      break;
    case 'scarica':
      if (dbStatusEl) dbStatusEl.textContent = '🔫 SCARICA! Spara i palloni!';
      vibrate(90);
      showToast('🔫 SCARICA!');
      break;
    case 'truck_fail':
      if (dbStatusEl) dbStatusEl.textContent = '💀 CONSEGNA FALLITA';
      vibrate([100, 60, 100]);
      showToast('💀 CONSEGNA FALLITA');
      break;
    case 'debt':
      if (dbStatusEl) dbStatusEl.textContent = '💸 DEBITO! Colpisci qualcuno!';
      vibrate([80, 40, 80]);
      showToast('💸 DEBITO! Colpisci qualcuno!');
      break;
    case 'debt_ok':
      if (dbStatusEl) dbStatusEl.textContent = '✅ DEBITO SALDATO!';
      showToast('✅ DEBITO SALDATO!');
      vibrate(60);
      break;
    case 'debt_due':
      if (dbStatusEl) dbStatusEl.textContent = '💀 ESATTORE!';
      vibrate([100, 60, 100]);
      showToast('💀 ESATTORE!');
      break;
    case 'gotBall':
      if (dbStatusEl) dbStatusEl.textContent = '🏐 HAI LA PALLA!';
      vibrate(35);
      break;
    case 'threwBall':
      if (dbStatusEl) dbStatusEl.textContent = 'cerca la palla...';
      break;
  }
}

/** Controller dedicato a DODGEBALL DEI COGLIONI (layout custom: dodgeball-tv). */
function renderDodgeballController(): void {
  dbJoystickEl = null;
  dbThumbEl = null;
  dbThrowBtn = null;
  dbDodgeBtn = null;
  dbAbilityBtn = null;
  dbStatusEl = null;
  dbLocked = false;
  dbJoy = null;

  const me: PlayerPublic | undefined =
    playerId && state ? state.players.find((p) => p.id === playerId) : undefined;
  const cid = me?.characterId ?? '';
  const ab = DODGEBALL_ABILITIES[cid];

  app.innerHTML = `
    <div class="arena-shell">
      <div class="arena-topbar">
        <div class="arena-brand">🎯 DODGEBALL DEI COGLIONI</div>
        <div id="db-status" class="arena-status">PRONTO</div>
      </div>
      <div class="arena-body">
        <div class="arena-joy">
          <div class="arena-joy-base">
            <div class="arena-joy-thumb"></div>
          </div>
        </div>
        <div class="arena-actions">
          <button id="db-throw" class="arena-dash db-throw">🏐<span>LANCIA</span></button>
          <button id="db-dodge" class="db-dodge">💨<span>SCHIVA</span></button>
          <button id="db-ability" class="arena-ability">⭐<span>${ab?.name ?? 'ABILITÀ'}</span></button>
          <p id="db-ability-desc" class="arena-ability-desc">${ab?.desc ?? ''}</p>
        </div>
      </div>
    </div>`;

  dbStatusEl = app.querySelector<HTMLElement>('#db-status')!;
  dbThrowBtn = app.querySelector<HTMLButtonElement>('#db-throw')!;
  dbDodgeBtn = app.querySelector<HTMLButtonElement>('#db-dodge')!;
  dbAbilityBtn = app.querySelector<HTMLButtonElement>('#db-ability')!;
  dbJoystickEl = app.querySelector<HTMLElement>('.arena-joy')!;
  dbThumbEl = app.querySelector<HTMLElement>('.arena-joy-thumb')!;
  const baseEl = app.querySelector<HTMLElement>('.arena-joy-base')!;

  dbThrowBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (dbThrowBtn!.disabled) return;
    sendInput({ kind: 'action', controlId: 'throw' });
  });
  dbDodgeBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (dbDodgeBtn!.disabled) return;
    sendInput({ kind: 'action', controlId: 'dodge' });
  });
  dbAbilityBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (dbAbilityBtn!.disabled) return;
    sendInput({ kind: 'action', controlId: 'ability' });
  });

  dbJoy = mountJoystick(baseEl, dbThumbEl, () => dbLocked, (x, y) => sendInput({ kind: 'axis', controlId: 'move', x, y }));
}

// ---- CALCIO DEI DISAGIATI (controller dedicato: joystick + tiro hold + tackle) ----

let soccerJoystickEl: HTMLElement | null = null;
let soccerThumbEl: HTMLElement | null = null;
let soccerShootBtn: HTMLButtonElement | null = null;
let soccerTackleBtn: HTMLButtonElement | null = null;
let soccerAbilityBtn: HTMLButtonElement | null = null;
let soccerStatusEl: HTMLElement | null = null;
let soccerTeam: string | null = null;
let soccerLocked = false;
let soccerJoy: VirtualJoystick | null = null;

function lockSoccerControls(locked: boolean, statusText?: string): void {
  soccerLocked = locked;
  if (soccerJoystickEl) soccerJoystickEl.classList.toggle('arena-locked', locked);
  if (soccerShootBtn) soccerShootBtn.disabled = locked;
  if (soccerTackleBtn) soccerTackleBtn.disabled = locked;
  if (soccerAbilityBtn) soccerAbilityBtn.disabled = locked;
  if (statusText && soccerStatusEl) soccerStatusEl.textContent = statusText;
  if (locked) soccerJoy?.reset();
}

function handleSoccerSignal(s: SignalPayload): void {
  switch (s.type) {
    case 'countdown':
      if (s.value === 0) {
        if (soccerStatusEl) soccerStatusEl.textContent = '⚡ VIA!';
        vibrate(110);
      } else if (s.value && s.value > 0) {
        if (soccerStatusEl) soccerStatusEl.textContent = `⏱ ${s.value}`;
        vibrate(35);
      }
      break;
    case 'team':
      soccerTeam = s.team ?? null;
      if (soccerStatusEl) {
        soccerStatusEl.textContent = s.team === 'red' ? '🔴 SEI ROSSO' : '🔵 SEI BLU';
      }
      break;
    case 'gotBall':
      if (soccerStatusEl) soccerStatusEl.textContent = '⚽ HAI LA PALLA!';
      vibrate(30);
      break;
    case 'threwBall':
      if (soccerStatusEl) soccerStatusEl.textContent = '⚽ TIRATA!';
      vibrate(40);
      break;
    case 'lostBall':
      if (soccerStatusEl) soccerStatusEl.textContent = '😵 palla persa!';
      vibrate(60);
      break;
    case 'goal':
      showToast(`⚽ GOOOL ${s.team === 'red' ? 'ROSSI' : 'BLU'}!`);
      vibrate([80, 40, 120]);
      break;
    case 'won':
      lockSoccerControls(true, '🏆 HAI VINTO!');
      vibrate([80, 40, 80, 40, 120]);
      showToast('🏆 HAI VINTO!');
      break;
    case 'matchEnd':
      if (s.winner && s.winner !== soccerTeam) {
        lockSoccerControls(true, '😞 hai perso...');
        showToast('😞 hai perso...');
      }
      break;
    case 'ability':
      if (soccerAbilityBtn) {
        soccerAbilityBtn.disabled = true;
        soccerAbilityBtn.classList.add('arena-ability-used');
      }
      showToast(`⭐ ${s.name ?? 'ABILITÀ'}`);
      vibrate(70);
      break;
    case 'charged':
      showToast('💥 Tiro potenziato!');
      vibrate(60);
      break;
    case 'heldBall':
      showToast('💸 PAGO DOMANI — palla trattenuta!');
      vibrate(80);
      break;
  }
}

/** Controller dedicato a CALCIO DEI DISAGIATI (layout custom: soccer-tv). */
function renderSoccerController(): void {
  soccerJoystickEl = null;
  soccerThumbEl = null;
  soccerShootBtn = null;
  soccerTackleBtn = null;
  soccerAbilityBtn = null;
  soccerStatusEl = null;
  soccerTeam = null;
  soccerLocked = false;
  soccerJoy = null;

  const me: PlayerPublic | undefined =
    playerId && state ? state.players.find((p) => p.id === playerId) : undefined;
  const cid = me?.characterId ?? '';
  const ab = SOCCER_ABILITIES[cid];

  app.innerHTML = `
    <div class="arena-shell">
      <div class="arena-topbar">
        <div class="arena-brand">⚽ CALCIO DEI DISAGIATI</div>
        <div id="soccer-status" class="arena-status">PRONTO</div>
      </div>
      <div class="arena-body">
        <div class="arena-joy">
          <div class="arena-joy-base">
            <div class="arena-joy-thumb"></div>
          </div>
        </div>
        <div class="arena-actions">
          <button id="soccer-shoot" class="arena-dash db-throw">⚽<span>TIRO/PASSA</span></button>
          <button id="soccer-tackle" class="db-dodge">💨<span>TACKLE</span></button>
          <button id="soccer-ability" class="arena-ability">⭐<span>${ab?.name ?? 'ABILITÀ'}</span></button>
          <p id="soccer-ability-desc" class="arena-ability-desc">${ab?.desc ?? ''}</p>
        </div>
      </div>
    </div>`;

  soccerStatusEl = app.querySelector<HTMLElement>('#soccer-status')!;
  soccerShootBtn = app.querySelector<HTMLButtonElement>('#soccer-shoot')!;
  soccerTackleBtn = app.querySelector<HTMLButtonElement>('#soccer-tackle')!;
  soccerAbilityBtn = app.querySelector<HTMLButtonElement>('#soccer-ability')!;
  soccerJoystickEl = app.querySelector<HTMLElement>('.arena-joy')!;
  soccerThumbEl = app.querySelector<HTMLElement>('.arena-joy-thumb')!;
  const baseEl = app.querySelector<HTMLElement>('.arena-joy-base')!;

  // TIRO/PASSA è "hold" (carica): down = inizia carica, up = tira.
  const shootDown = (e: PointerEvent): void => {
    e.preventDefault();
    if (soccerShootBtn!.disabled) return;
    sendInput({ kind: 'down', controlId: 'shoot' });
  };
  const shootUp = (e: PointerEvent): void => {
    e.preventDefault();
    sendInput({ kind: 'up', controlId: 'shoot' });
  };
  soccerShootBtn.addEventListener('pointerdown', shootDown);
  soccerShootBtn.addEventListener('pointerup', shootUp);
  soccerShootBtn.addEventListener('pointerleave', shootUp);
  soccerShootBtn.addEventListener('pointercancel', shootUp);

  soccerTackleBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (soccerTackleBtn!.disabled) return;
    sendInput({ kind: 'action', controlId: 'dash' });
  });
  soccerAbilityBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (soccerAbilityBtn!.disabled) return;
    sendInput({ kind: 'action', controlId: 'ability' });
  });

  soccerJoy = mountJoystick(baseEl, soccerThumbEl, () => soccerLocked, (x, y) => sendInput({ kind: 'axis', controlId: 'move', x, y }));
}

// ---- PALLAVOLO DEI DISAGIATI (controller dedicato: joystick + salta + colpisci) ----

let volleyJoystickEl: HTMLElement | null = null;
let volleyThumbEl: HTMLElement | null = null;
let volleyHitBtn: HTMLButtonElement | null = null;
let volleyJumpBtn: HTMLButtonElement | null = null;
let volleyAbilityBtn: HTMLButtonElement | null = null;
let volleyStatusEl: HTMLElement | null = null;
let volleyTeam: string | null = null;
let volleyLocked = false;
let volleyJoy: VirtualJoystick | null = null;

function lockVolleyControls(locked: boolean, statusText?: string): void {
  volleyLocked = locked;
  if (volleyJoystickEl) volleyJoystickEl.classList.toggle('arena-locked', locked);
  if (volleyHitBtn) volleyHitBtn.disabled = locked;
  if (volleyJumpBtn) volleyJumpBtn.disabled = locked;
  if (volleyAbilityBtn) volleyAbilityBtn.disabled = locked;
  if (statusText && volleyStatusEl) volleyStatusEl.textContent = statusText;
  if (locked) volleyJoy?.reset();
}

function handleVolleyballSignal(s: SignalPayload): void {
  switch (s.type) {
    case 'countdown':
      if (s.value === 0) {
        if (volleyStatusEl) volleyStatusEl.textContent = '⚡ VIA!';
        vibrate(110);
      } else if (s.value && s.value > 0) {
        if (volleyStatusEl) volleyStatusEl.textContent = `⏱ ${s.value}`;
        vibrate(35);
      }
      break;
    case 'team':
      volleyTeam = s.team ?? null;
      if (volleyStatusEl) volleyStatusEl.textContent = s.team === 'red' ? '🔴 SEI ROSSO' : '🔵 SEI BLU';
      break;
    case 'served':
      if (volleyStatusEl) volleyStatusEl.textContent = '🏐 HAI SERVITO!';
      vibrate(40);
      break;
    case 'receive':
      if (volleyStatusEl) volleyStatusEl.textContent = '🙌 ricezione!';
      vibrate(30);
      break;
    case 'smash':
      if (volleyStatusEl) volleyStatusEl.textContent = '💥 SMASH!';
      vibrate(80);
      showToast('💥 SMASH!');
      break;
    case 'point':
      showToast(`💥 PUNTO ${s.team === 'red' ? 'ROSSI' : 'BLU'}!`);
      vibrate([80, 40, 120]);
      break;
    case 'won':
      lockVolleyControls(true, '🏆 HAI VINTO!');
      vibrate([80, 40, 80, 40, 120]);
      showToast('🏆 HAI VINTO!');
      break;
    case 'matchEnd':
      if (s.winner && s.winner !== volleyTeam) {
        lockVolleyControls(true, '😞 hai perso...');
        showToast('😞 hai perso...');
      }
      break;
    case 'ability':
      if (volleyAbilityBtn) {
        volleyAbilityBtn.disabled = true;
        volleyAbilityBtn.classList.add('arena-ability-used');
      }
      showToast(`⭐ ${s.name ?? 'ABILITÀ'}`);
      vibrate(70);
      break;
    case 'jager_boom':
      showToast('💥 JÄGER BOMB!');
      vibrate(100);
      break;
    case 'jager_wasted':
      showToast('😵 JÄGER BOMB sprecata...');
      break;
    case 'stable':
      showToast('🧱 MURO DEL POLIGONO stabile!');
      break;
    case 'scarica':
      showToast('💥 SCARICA!');
      vibrate(70);
      break;
    case 'frozen':
      if (volleyStatusEl) volleyStatusEl.textContent = '⏳ PAGO DOMANI — salva!';
      vibrate([80, 40, 80]);
      showToast('⏳ PAGO DOMANI — salva!');
      break;
    case 'debt_ok':
      showToast('✅ DEBITO SALDATO!');
      vibrate(60);
      break;
    case 'debt_fail':
      showToast('💀 debito non saldato');
      break;
  }
}

/** Controller dedicato a PALLAVOLO DEI DISAGIATI (layout custom: volleyball-tv). */
function renderVolleyballController(): void {
  volleyJoystickEl = null;
  volleyThumbEl = null;
  volleyHitBtn = null;
  volleyJumpBtn = null;
  volleyAbilityBtn = null;
  volleyStatusEl = null;
  volleyTeam = null;
  volleyLocked = false;
  volleyJoy = null;

  const me: PlayerPublic | undefined =
    playerId && state ? state.players.find((p) => p.id === playerId) : undefined;
  const cid = me?.characterId ?? '';
  const ab = VOLLEYBALL_ABILITIES[cid];

  app.innerHTML = `
    <div class="arena-shell">
      <div class="arena-topbar">
        <div class="arena-brand">🏐 PALLAVOLO DEI DISAGIATI</div>
        <div id="volley-status" class="arena-status">PRONTO</div>
      </div>
      <div class="arena-body">
        <div class="arena-joy">
          <div class="arena-joy-base">
            <div class="arena-joy-thumb"></div>
          </div>
        </div>
        <div class="arena-actions">
          <button id="volley-hit" class="arena-dash">👊<span>COLPISCI</span></button>
          <button id="volley-jump" class="db-dodge">🦘<span>SALTA</span></button>
          <button id="volley-ability" class="arena-ability">⭐<span>${ab?.name ?? 'ABILITÀ'}</span></button>
          <p id="volley-ability-desc" class="arena-ability-desc">${ab?.desc ?? ''}</p>
        </div>
      </div>
    </div>`;

  volleyStatusEl = app.querySelector<HTMLElement>('#volley-status')!;
  volleyHitBtn = app.querySelector<HTMLButtonElement>('#volley-hit')!;
  volleyJumpBtn = app.querySelector<HTMLButtonElement>('#volley-jump')!;
  volleyAbilityBtn = app.querySelector<HTMLButtonElement>('#volley-ability')!;
  volleyJoystickEl = app.querySelector<HTMLElement>('.arena-joy')!;
  volleyThumbEl = app.querySelector<HTMLElement>('.arena-joy-thumb')!;
  const baseEl = app.querySelector<HTMLElement>('.arena-joy-base')!;

  volleyHitBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (volleyHitBtn!.disabled) return;
    sendInput({ kind: 'action', controlId: 'hit' });
  });
  volleyJumpBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (volleyJumpBtn!.disabled) return;
    sendInput({ kind: 'action', controlId: 'jump' });
  });
  volleyAbilityBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (volleyAbilityBtn!.disabled) return;
    sendInput({ kind: 'action', controlId: 'ability' });
  });

  volleyJoy = mountJoystick(baseEl, volleyThumbEl, () => volleyLocked, (x, y) => sendInput({ kind: 'axis', controlId: 'move', x, y }));
}

// ---- CULTURA O CAZZATA? (controller dedicato: scrivi bluff / vota) ----

function sendText(controlId: string, text: string): void {
  socket.emit(EVT.inputText, { controlId, text });
}

/** Controller dedicato a CULTURA O CAZZATA? (layout custom: cultura-tv). */
function renderCulturaController(): void {
  app.innerHTML = `<div class="cultura-shell" id="cultura-shell"></div>`;
}

function updateCulturaUI(s: CulturaState): void {
  const root = app.querySelector<HTMLElement>('#cultura-shell') ?? app;
  const letters = 'ABCDE';

  if (s.phase === 'intro' || s.phase === 'bluff') {
    root.innerHTML = `
      <div class="cultura-top">ROUND ${s.round}/${s.totalRounds} · ${s.category.toUpperCase()}</div>
      <div class="cultura-q">"${s.question}"</div>
      ${s.myBluff
        ? `<div class="cultura-done">✍️ RISPOSTA INVIATA ✅<br><span>${s.myBluff}</span></div>`
        : `<input id="cultura-bluff" class="cultura-input" placeholder="Scrivi una risposta falsa credibile..." maxlength="40" autocomplete="off" />
           <button id="cultura-confirm" class="cultura-btn">CONFERMA</button>`}
      <p class="cultura-hint">Scrivi una risposta falsa che possa sembrare vera.</p>`;
    const inp = root.querySelector<HTMLInputElement>('#cultura-bluff');
    const btn = root.querySelector<HTMLButtonElement>('#cultura-confirm');
    if (inp && btn) {
      const submit = (): void => {
        const t = inp.value.trim();
        if (!t) return;
        sendText('bluff', t);
        inp.disabled = true;
        btn.disabled = true;
      };
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        submit();
      });
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') submit();
      });
    }
    return;
  }

  if (s.phase === 'options' || s.phase === 'vote') {
    const opts = s.options
      .map((o, i) => {
        const locked = o.disabled || s.myVote !== null;
        return `<button class="cultura-opt ${o.disabled ? 'mine' : ''} ${s.myVote === i ? 'picked' : ''}" data-i="${i}" ${locked ? 'disabled' : ''}>
          <span class="cultura-opt-letter">${letters[i]}</span>
          <span class="cultura-opt-text">${o.text}${o.disabled ? ' <em>(LA TUA CAZZATA)</em>' : ''}</span>
        </button>`;
      })
      .join('');
    root.innerHTML = `
      <div class="cultura-top">🔥 SCEGLI LA RISPOSTA VERA</div>
      <div class="cultura-q">"${s.question}"</div>
      <div class="cultura-opts">${opts}</div>
      ${s.myVote !== null ? '<div class="cultura-done">🔒 RISPOSTA BLOCCATA</div>' : ''}
      ${s.isSecchione ? `<div class="cultura-secret">🤓 SEI IL SECCHIONE INFAME.<br>RISPOSTA VERA: ${s.correctAnswer ?? ''}</div>` : ''}
      ${s.isAdvocate && s.defendText ? `<div class="cultura-advocate">🎤 DIFENDI QUESTA RISPOSTA: ${s.defendText}</div>` : ''}
      ${s.teConoscoReveal ? `<div class="cultura-secret">👁️ ${s.teConoscoReveal}</div>` : ''}
      ${s.canTeConosco ? `<button id="cultura-teconosco" class="cultura-tebtn">👁️ TE CONOSCO</button>` : ''}`;

    root.querySelectorAll<HTMLButtonElement>('.cultura-opt').forEach((b) => {
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (b.disabled || s.myVote !== null) return;
        sendText('vote', b.dataset.i ?? '0');
      });
    });
    const te = root.querySelector<HTMLButtonElement>('#cultura-teconosco');
    if (te) {
      te.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        // Scegli un avversario
        root.innerHTML = `
          <div class="cultura-top">👁️ TE CONOSCO, COGLIONE</div>
          <div class="cultura-opts">${s.teConoscoTargets.map((t) => `<button class="cultura-opt" data-t="${t.id}">${t.name}</button>`).join('')}</div>`;
        root.querySelectorAll<HTMLButtonElement>('.cultura-opt').forEach((tb) => {
          tb.addEventListener('pointerdown', (e2) => {
            e2.preventDefault();
            sendText('teConosco', tb.dataset.t ?? '');
            tb.disabled = true;
          });
        });
      });
    }
    return;
  }

  if (s.phase === 'reveal' || s.phase === 'explanation') {
    const r = s.reveal;
    root.innerHTML = `
      <div class="cultura-top">📺 RISULTATO</div>
      ${r
        ? `<div class="cultura-result">Hai scelto: <b>${r.text}</b><br>${r.correct ? '✅ LA SAPEVI DAVVERO' : '❌ CI SEI CASCATO 💀'}</div>`
        : '<div class="cultura-result">Guarda lo schermo principale</div>'}
      <div class="cultura-score">Punteggio: ${s.myScore}</div>`;
    return;
  }

  // ranking / results
  root.innerHTML = `
    <div class="cultura-top">📊 CLASSIFICA</div>
    <div class="cultura-rank">${s.ranking.map((r2, i) => `${i + 1}. ${r2.avatar} ${r2.name} — ${r2.score}`).join('<br>')}</div>
    <div class="cultura-score">Il tuo punteggio: ${s.myScore}</div>`;
}

// ---- SPARATORIA DEI DISAGIATI (controller FPS completo su telefono) ----

let fpsClient: FpsClient | null = null;
let fpsPendingState: FpsStatePayload | null = null;
let fpsLookEl: HTMLElement | null = null;
let fpsFireBtn: HTMLButtonElement | null = null;
let fpsDashBtn: HTMLButtonElement | null = null;
let fpsReloadBtn: HTMLButtonElement | null = null;
let fpsLocked = false;

function handleFpsSignal(s: SignalPayload): void {
  switch (s.type) {
    case 'fpsState':
      if (fpsClient) fpsClient.updateState(s as unknown as FpsStatePayload);
      else fpsPendingState = s as unknown as FpsStatePayload;
      break;
    case 'hit': {
      // conferma dell'host: il danno e' stato davvero inflitto (dmg e kill vengono dall'host)
      const d = s as unknown as { dmg?: number; kill?: boolean };
      if (!d.kill) vibrate(d.dmg && d.dmg >= 40 ? 35 : 18); // la kill ha la sua vibrazione
      fpsClient?.hitMarker(d.dmg ?? 10, Boolean(d.kill));
      break;
    }
    case 'damaged': {
      const d = s as unknown as { from?: string; amount?: number };
      const amount = d.amount ?? 10;
      vibrate(amount >= 30 ? 80 : 40);
      fpsClient?.damageTaken(d.from ?? '', amount);
      break;
    }
    case 'killed': {
      const d = s as unknown as { name?: string };
      vibrate([60, 30, 80]);
      fpsClient?.killConfirm(d.name ?? '');
      break;
    }
    case 'eliminated': {
      const by = (s as unknown as { by?: string }).by;
      if (fpsClient) fpsClient.showDeath(`💀 ELIMINATO${by ? ` — ${by}` : ''}`);
      vibrate([100, 60, 100]);
      break;
    }
    case 'respawn':
      if (fpsClient) fpsClient.hideDeath();
      break;
    case 'reload': {
      const d = s as unknown as { duration?: number; weaponId?: string };
      fpsClient?.reloadStart(d.duration ?? 1.5, d.weaponId);
      break;
    }
    case 'equip':
      fpsClient?.equipped((s as unknown as { weaponId?: string }).weaponId ?? 'mitraglia');
      break;
    case 'dash':
      fpsClient?.dashed();
      break;
    case 'proj':
      fpsClient?.projectile(s as unknown as { ox: number; oy: number; oz: number; tx: number; ty: number; tz: number; dur: number });
      break;
    case 'boom':
      fpsClient?.boom(s as unknown as { x: number; y: number; z: number; r: number });
      break;
    case 'fpsEnd':
      if (fpsClient) fpsClient.showDeath('⏱ TEMPO!');
      break;
  }
}

/** Libera il motore Babylon del telefono (senza, ogni round FPS lascia un engine vivo in background). */
function disposeFps(): void {
  const c = fpsClient;
  fpsClient = null;
  fpsPendingState = null;
  if (!c) return;
  // Lo smontaggio dell'engine WebGL è pesante: si fa DOPO che la nuova schermata è stata mostrata,
  // così il telefono cambia vista subito invece di restare congelato sul vecchio controller.
  window.setTimeout(() => {
    try {
      c.dispose();
    } catch {
      /* ignora */
    }
  }, 150);
}

/** Controller dedicato a SPARATORIA DEI DISAGIATI (layout custom: fps-tv). */
function renderFpsController(): void {
  disposeFps();
  fpsLookEl = null;
  fpsFireBtn = null;
  fpsDashBtn = null;
  fpsReloadBtn = null;
  fpsLocked = false;

  app.innerHTML = `
    <div class="fps-shell">
      <div id="fps-canvas"></div>
      <div class="fps-look" id="fps-look"></div>
      <div class="fps-joy">
        <div class="arena-joy-base">
          <div class="arena-joy-thumb"></div>
        </div>
      </div>
      <div class="fps-btns">
        <button id="fps-fire" class="fps-fire">🔫<span>SPARA</span></button>
        <button id="fps-dash" class="fps-dash">💨<span>DASH</span></button>
        <button id="fps-reload" class="arena-ability fps-reload">🔄<span>RICARICA</span></button>
      </div>
    </div>`;

  const canvasHost = app.querySelector<HTMLElement>('#fps-canvas')!;
  fpsLookEl = app.querySelector<HTMLElement>('#fps-look')!;
  fpsFireBtn = app.querySelector<HTMLButtonElement>('#fps-fire')!;
  fpsDashBtn = app.querySelector<HTMLButtonElement>('#fps-dash')!;
  fpsReloadBtn = app.querySelector<HTMLButtonElement>('#fps-reload')!;
  const baseEl = app.querySelector<HTMLElement>('.arena-joy-base')!;
  const thumbEl = app.querySelector<HTMLElement>('.arena-joy-thumb')!;

  // Joystick movimento
  mountJoystick(baseEl, thumbEl, () => fpsLocked, (x, y) => sendInput({ kind: 'axis', controlId: 'move', x, y }));

  // Look touch (trascina per guardare)
  let lastX = -1;
  let lastY = -1;
  let activeLookPointer: number | null = null;
  fpsLookEl.addEventListener('pointerdown', (e) => {
    if (fpsLocked) return;
    activeLookPointer = e.pointerId;
    lastX = e.clientX;
    lastY = e.clientY;
    try {
      fpsLookEl!.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  });
  fpsLookEl.addEventListener('pointermove', (e) => {
    if (e.pointerId !== activeLookPointer || lastX < 0) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    fpsClient?.look(dx, dy);
  });
  const lookEnd = (e: PointerEvent): void => {
    if (e.pointerId !== activeLookPointer) return;
    activeLookPointer = null;
    lastX = -1;
    lastY = -1;
  };
  fpsLookEl.addEventListener('pointerup', lookEnd);
  fpsLookEl.addEventListener('pointercancel', lookEnd);

  // SPARA (hold)
  const fireDown = (e: PointerEvent): void => {
    e.preventDefault();
    if (fpsFireBtn!.disabled) return;
    fpsClient?.setFirePressed(true);
    sendInput({ kind: 'down', controlId: 'fire' });
  };
  const fireUp = (e: PointerEvent): void => {
    e.preventDefault();
    fpsClient?.setFirePressed(false);
    sendInput({ kind: 'up', controlId: 'fire' });
  };
  fpsFireBtn.addEventListener('pointerdown', fireDown);
  fpsFireBtn.addEventListener('pointerup', fireUp);
  fpsFireBtn.addEventListener('pointercancel', fireUp);
  fpsFireBtn.addEventListener('pointerleave', fireUp);

  fpsDashBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (fpsDashBtn!.disabled) return;
    sendInput({ kind: 'action', controlId: 'dash' });
  });
  fpsReloadBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (fpsReloadBtn!.disabled) return;
    sendInput({ kind: 'action', controlId: 'reload' });
  });

  // Client FPS (Babylon, caricato lazy)
  void (async () => {
    const { FpsClient } = await import('./fpsClient');
    if (!canvasHost.isConnected) return; // il controller è già cambiato mentre caricava
    fpsClient = new FpsClient(canvasHost, playerId ?? '', (yaw, pitch) =>
      sendInput({ kind: 'axis', controlId: 'look', x: yaw, y: pitch })
    );
    if (fpsPendingState) {
      fpsClient.updateState(fpsPendingState);
      fpsPendingState = null;
    }
  })();
}

socket.on(EVT.controllerSignal, (data) => {
  const s = data as SignalPayload;
  if (activeController === 'memory') {
    handleMemorySignal(s);
    return;
  }
  if (activeController === 'arena') {
    handleArenaSignal(s);
    return;
  }
  if (activeController === 'dodgeball') {
    handleDodgeballSignal(s);
    return;
  }
  if (activeController === 'soccer') {
    handleSoccerSignal(s);
    return;
  }
  if (activeController === 'volleyball') {
    handleVolleyballSignal(s);
    return;
  }
  if (activeController === 'fps') {
    handleFpsSignal(s);
    return;
  }
  const actionBtn =
    app.querySelector<HTMLButtonElement>('.ctl-action') ??
    app.querySelector<HTMLButtonElement>('.ctl-btn');
  const abilityBtn = app.querySelector<HTMLButtonElement>('.ctl-ability');

  switch (s.type) {
    case 'wait': {
      if (actionBtn) {
        actionBtn.textContent = 'ASPETTA...';
        actionBtn.disabled = false;
        actionBtn.classList.remove('go', 'ctl-drunk');
      }
      if (abilityBtn) abilityBtn.disabled = false;
      break;
    }
    case 'via': {
      if (actionBtn) {
        actionBtn.textContent = '⚡ PREMI!';
        actionBtn.classList.add('go');
        actionBtn.disabled = false;
      }
      vibrate(60);
      break;
    }
    case 'pressed': {
      if (actionBtn) {
        actionBtn.textContent = `${s.ms ?? '—'} ms`;
        actionBtn.disabled = true;
        actionBtn.classList.remove('go');
      }
      break;
    }
    case 'falseStart': {
      if (actionBtn) {
        actionBtn.textContent = '❌ FALSA PARTENZA';
        actionBtn.disabled = true;
        actionBtn.classList.remove('go');
      }
      vibrate([100, 60, 100]);
      break;
    }
    case 'secondChance': {
      if (actionBtn) {
        actionBtn.textContent = '🎯 SECONDA CHANCE (+120 ms)';
        actionBtn.disabled = false;
        actionBtn.classList.remove('go');
      }
      vibrate([80, 40, 80]);
      showToast('🎯 MO HO CAPITO — seconda chance');
      break;
    }
    case 'ability': {
      showToast(`⭐ ${s.name ?? 'ABILITÀ'}`);
      break;
    }
    case 'abilityUsed': {
      if (abilityBtn) {
        abilityBtn.disabled = true;
        abilityBtn.classList.add('ctl-ability-used');
      }
      break;
    }
    case 'drunk': {
      if (actionBtn) {
        actionBtn.classList.add('ctl-drunk');
        window.setTimeout(() => actionBtn.classList.remove('ctl-drunk'), 1500);
      }
      vibrate([60, 80, 60, 80]);
      showToast('🍻 NCULO! — troppo presto, effetto ubriaco');
      break;
    }
    case 'focusHit': {
      vibrate(150);
      showToast('👁 SONO PIÙ SVEGLIO — VIA rilevato!');
      break;
    }
    case 'notYet': {
      showToast('🛑 ORA NON È ANCORA', 1000);
      break;
    }
    case 'reset': {
      showToast('🔄 ASPETTA UN ATTIMO!', 800);
      vibrate(40);
      break;
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

interface CulturaState {
  type: 'cultura';
  phase: string;
  round: number;
  totalRounds: number;
  question: string;
  category: string;
  myScore: number;
  ranking: { name: string; avatar: string; score: number }[];
  myBluff?: string;
  options: { text: string; isMine: boolean; disabled: boolean }[];
  myVote: number | null;
  canTeConosco: boolean;
  teConoscoTargets: { id: string; name: string }[];
  teConoscoReveal: string | null;
  isSecchione: boolean;
  correctAnswer?: string;
  isAdvocate: boolean;
  defendText?: string;
  reveal: { text: string; correct: boolean } | null;
}

function isCulturaState(data: unknown): data is CulturaState {
  return typeof data === 'object' && data !== null && (data as { type?: unknown }).type === 'cultura';
}

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
  if (isCulturaState(data)) {
    updateCulturaUI(data);
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
  syncPauseOverlay(state);
  if (!state || state.phase !== 'MINIGAME_PLAYING') disposeFps();
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
  // Chiave = roundId + gioco: uno snapshot di un round NUOVO ricostruisce sempre il controller
  // (anche se il gioco è lo stesso o il telefono ha perso le fasi intermedie), mentre gli snapshot
  // dello stesso round durante la partita non lo rifanno.
  const roundKey = `${state.roundId ?? 0}:${mg.minigameId}`;
  if (lastMinigameId === roundKey) return;
  lastMinigameId = roundKey;
  vibrate(45);
  showControls(mg);
}

function showControls(mg: NonNullable<RoomState['currentMinigame']>): void {
  const layout = mg.controllerLayout;
  if (layout.type === 'custom' && layout.id === 'quiz-tv') {
    activeController = 'quiz';
    renderQuizController();
    return;
  }
  if (layout.type === 'custom' && layout.id === 'memory-tv') {
    activeController = 'memory';
    renderMemoryController();
    return;
  }
  if (layout.type === 'custom' && layout.id === 'arena-tv') {
    activeController = 'arena';
    renderArenaController();
    return;
  }
  if (layout.type === 'custom' && layout.id === 'dodgeball-tv') {
    activeController = 'dodgeball';
    renderDodgeballController();
    return;
  }
  if (layout.type === 'custom' && layout.id === 'soccer-tv') {
    activeController = 'soccer';
    renderSoccerController();
    return;
  }
  if (layout.type === 'custom' && layout.id === 'volleyball-tv') {
    activeController = 'volleyball';
    renderVolleyballController();
    return;
  }
  if (layout.type === 'custom' && layout.id === 'fps-tv') {
    activeController = 'fps';
    renderFpsController();
    return;
  }
  if (layout.type === 'custom' && layout.id === 'cultura-tv') {
    activeController = 'cultura';
    renderCulturaController();
    return;
  }
  activeController = null;
  app.innerHTML = `
    <div class="screen">
      <h1>${mg.name}</h1>
      <p id="info-line" class="sub info-line"></p>
      <div id="ctl"></div>
    </div>`;
  renderController(app.querySelector<HTMLDivElement>('#ctl')!, mg.controllerLayout, sendInput);
  renderInfoLine();
}

/** Controller dedicato a MEMORIA DA UBRIACO (layout custom: memory-tv). */
function renderMemoryController(): void {
  memoryTileEls = [];
  memoryAbilityBtn = null;
  memoryStatusEl = null;

  const me: PlayerPublic | undefined =
    playerId && state ? state.players.find((p) => p.id === playerId) : undefined;
  const cid = me?.characterId ?? '';
  const ab = MEMORY_ABILITIES[cid];

  app.innerHTML = `
    <div class="mem-shell">
      <div class="mem-topbar">
        <div class="mem-brand">🧠 MEMORIA DA UBRIACO</div>
        <div id="mem-status" class="mem-status">👀 OSSERVA...</div>
      </div>
      <div id="mem-grid" class="mem-grid"></div>
      <button id="mem-ability" class="mem-ability">
        <span class="mem-ability-icon">⭐</span>
        <span id="mem-ability-name">${ab?.name ?? 'ABILITÀ'}</span>
      </button>
      <p id="mem-ability-desc" class="mem-ability-desc">${ab?.desc ?? ''}</p>
    </div>`;

  memoryStatusEl = app.querySelector<HTMLElement>('#mem-status')!;

  const grid = app.querySelector<HTMLDivElement>('#mem-grid')!;
  for (const t of MEMORY_TILES) {
    const btn = document.createElement('button');
    btn.className = 'mem-tile';
    btn.dataset.index = String(t.index);
    btn.style.background = t.color;
    btn.innerHTML = `<span class="mem-tile-icon">${t.icon}</span><span class="mem-tile-label">${t.label}</span>`;
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (btn.disabled) return;
      vibrate(15);
      sendInput({ kind: 'action', controlId: `c${t.index}` });
    });
    grid.appendChild(btn);
    memoryTileEls.push(btn);
  }

  memoryAbilityBtn = app.querySelector<HTMLButtonElement>('#mem-ability')!;
  // Buttafuori: abilità passiva → pulsante non premibile (scatta da sola sull'errore).
  if (ab?.phase === 'passive') {
    memoryAbilityBtn.disabled = true;
    memoryAbilityBtn.classList.add('mem-ability-passive');
  }
  memoryAbilityBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (memoryAbilityBtn!.disabled) return;
    sendInput({ kind: 'action', controlId: 'ability' });
  });

  // Blocca le tile finché non arriva il segnale "repeat".
  setMemLocked(true, '👀 OSSERVA...');
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

let lastIntroKey = '';

function renderPreGame(state: RoomState): void {
  const mg = state.currentMinigame;
  // Durante il rullo il nome NON va rivelato (spoilera l'animazione sulla TV): solo dall'intro.
  const reveal = state.phase === 'MINIGAME_INTRO' && !!mg;
  const def = reveal ? getMinigame(mg!.minigameId) : undefined;
  app.innerHTML = `
    <div class="screen">
      ${def?.icon ? `<div class="pre-icon">${def.icon}</div>` : ''}
      <h1>${reveal ? mg!.name : 'PROSSIMO GIOCO...'}</h1>
      <p class="sub">${reveal ? (def?.description ?? 'Preparati! Tieni il telefono pronto') : 'Guarda lo schermo principale'}</p>
      ${reveal ? '<p class="pre-ready">📱 PREPARATI!</p>' : ''}
    </div>`;
  // un solo "toc" di vibrazione quando parte l'intro di un round nuovo
  if (reveal) {
    const key = `${state.roundId ?? 0}:${mg!.minigameId}`;
    if (key !== lastIntroKey) {
      lastIntroKey = key;
      vibrate(60);
    }
  }
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
  if (socket.connected) rejoinWithToken(); // altrimenti ci pensa l'handler 'connect'
} else {
  renderJoin();
}
