import Phaser from 'phaser';
import { Color4, Engine, FreeCamera, Scene, Vector3 } from '@babylonjs/core';
import { game as gm } from '../core/GameManager';
import { CHARACTER_ORDER, getCharacter } from '../../shared/characters';
import { getMinigame } from '../../shared/minigames';
import type { MinigameSelectedPayload } from '../../shared/protocol';
import type { PlayerPublic, RoomState } from '../../shared/types';
import type { MinigameContext } from '../minigames/types';
import { InputManager } from '../network/InputManager';
import { Rng } from '../../shared/rng';
import { ArenaHud } from '../minigames/arena/arenaHud';
import { SoccerHud } from '../minigames/soccer/soccerHud';
import { previewControls } from '../input/ControlsHelp';
import { showMinigameError, hideMinigameError } from '../core/HostOverlay';
import { ensureUiCss } from '../core/uiDom';

/**
 * GALLERIA UI — SOLO SVILUPPO (`npm run dev`) o `?debug=1`, aperta con `?ui=1`. Ogni schermata del gioco con dati
 * finti (5 giocatori, un nome lungo, punteggi alti), per controllare in un colpo d'occhio coerenza, gerarchia e
 * leggibilita' (anche a 720p e 4K). Nessuna stanza, nessun server: lo stato e' finto e resta locale.
 * `window.__uiGallery.show(id)` per i test (scripts/e2e/ui-selftest.mjs).
 */

const NAMES = ['Nicolò', 'Christian', 'Carbo', 'Victor', 'Massimiliano Esposito'];
const SCORES = [104, 98, 87, 61, 33];

function players(): PlayerPublic[] {
  return CHARACTER_ORDER.map((cid, i) => ({ id: `p${i + 1}`, displayName: NAMES[i], characterId: cid, ready: i !== 4, connected: i !== 3, score: SCORES[i], pad: i < 4 ? 'Xbox' : undefined }));
}

function fakeState(phase: RoomState['phase'], minigameId = 'soccer'): RoomState {
  const ps = players();
  const def = getMinigame(minigameId)!;
  const deltas: Record<string, number> = { p1: 10, p2: 7, p3: 5, p4: 3, p5: 1 };
  return {
    roomCode: 'KX7QP',
    phase,
    round: 7,
    targetScore: 120,
    playerCount: 5,
    players: ps,
    charactersLocked: [...CHARACTER_ORDER],
    currentMinigame: { minigameId, name: def.name, category: def.category } as RoomState['currentMinigame'],
    lastResults: {
      results: ps.map((p, i) => ({ playerId: p.id, placement: i + 1, score: 10 - i, stats: ['7 colpi a segno', 'miglior tempo 0.31s', 'statistica in piu'] })),
      ranking: ps.map((p) => p.id),
      deltas,
      double: true
    },
    winner: 'p1',
    suddenDeath: false,
    selectedMinigameId: null,
    roundId: 7,
    lastPlayedMinigameId: 'quiz',
    lastRound: { minigameId: 'quiz', winnerId: 'p1', deltas }
  };
}

function pick(minigameId: string): MinigameSelectedPayload {
  const def = getMinigame(minigameId)!;
  return { roundId: 7, minigameId, name: def.name, category: def.category, modifierId: 'punti_doppi', modifierName: 'PUNTI DOPPI', modifierDescription: 'questo round vale il doppio', durationSec: 60, controllerLayout: def.controllerLayout, players: players(), activeModifiers: {} };
}

function fakeCtx(): MinigameContext {
  const ps = players();
  return {
    players: ps.map((p) => {
      const c = getCharacter(p.characterId!);
      return { id: p.id, displayName: p.displayName, characterId: p.characterId, name: c.name, roleTitle: c.roleTitle, avatar: c.avatar, color: c.color, quote: c.quote, score: p.score };
    }),
    playerIds: ps.map((p) => p.id),
    rng: new Rng(),
    durationSec: 60,
    modifier: null,
    modifiers: new Map(),
    input: new InputManager(),
    showControls: () => Promise.resolve(),
    consume: () => false,
    sendPrivate: () => {},
    vibrate: () => {},
    signal: () => {},
    finish: () => {}
  };
}

let hudEngine: Engine | null = null;
let hudCanvas: HTMLCanvasElement | null = null;
let phoneFrame: HTMLIFrameElement | null = null;

function clearOverlays(): void {
  hudEngine?.dispose();
  hudEngine = null;
  hudCanvas?.remove();
  hudCanvas = null;
  phoneFrame?.remove();
  phoneFrame = null;
  hideMinigameError();
  document.getElementById('ui-gal-alert')?.remove();
  document.getElementById('pad-controls')?.remove();
}

function startScene(key: string, data?: object): void {
  const game = (gm as unknown as { game: Phaser.Game | null }).game;
  if (!game) return;
  for (const s of game.scene.getScenes(false)) {
    const k = s.sys.settings.key;
    if (k !== key && s.sys.settings.status >= Phaser.Scenes.START && s.sys.settings.status <= Phaser.Scenes.SLEEPING) game.scene.stop(k);
  }
  game.scene.start(key, data);
}

/** HUD 3D di esempio (Arena o squadre) su un cielo neutro: la grafica del gioco non serve per giudicare l'HUD. */
function hudSample(kind: 'arena' | 'team'): void {
  hudCanvas = document.createElement('canvas');
  hudCanvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;z-index:20000';
  document.body.appendChild(hudCanvas);
  hudEngine = new Engine(hudCanvas, true, { stencil: true });
  const sc = new Scene(hudEngine);
  sc.clearColor = new Color4(0.22, 0.26, 0.34, 1);
  new FreeCamera('uiGalCam', new Vector3(0, 0, -10), sc);
  const ps = fakeCtx().players;
  if (kind === 'arena') {
    const h = new ArenaHud(sc, '🤼 ARENA DEL DISAGIO');
    h.setPlayers(ps.map((p) => ({ id: p.id, name: p.displayName, characterId: p.characterId, color: p.color })));
    h.setAlive(4, 5);
    h.setPlayerOut('p4', true);
    h.setModifier('CONTROLLI INVERTITI');
    h.feedMessage('🥊 CHRISTIAN → VICTOR È FUORI!', '#f87171', 60000);
    h.setCountdown('3');
  } else {
    const h = new SoccerHud(sc, '⚽ CALCIO DEI DISAGIATI');
    h.setScore(2, 1);
    h.setTimer(42);
    h.setNote('⚡ GOLDEN GOAL — il primo gol vince', '#fbbf24');
    h.banner('GOOOL!', 'NICOLÒ · ROSSI 2 — 1 BLU', '#ef4444', 60000);
  }
  hudEngine.runRenderLoop(() => sc.render());
}

/** Telefono (controller.html?preview=...) in una cornice da 390x800. */
function phone(preview: string): void {
  phoneFrame = document.createElement('iframe');
  phoneFrame.src = `/controller.html?preview=${preview}`;
  phoneFrame.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:390px;height:800px;border:10px solid #111;border-radius:36px;z-index:20000;background:#0b0b14';
  document.body.appendChild(phoneFrame);
}

const SCREENS: Record<string, () => void> = {
  lobby: () => startScene('LobbyScene'),
  room: () => {
    gm.roomCode = 'KX7QP';
    gm.state = fakeState('LOBBY');
    startScene('RoomScene');
  },
  roulette: () => {
    gm.state = fakeState('MINIGAME_ROULETTE');
    gm.pendingMinigame = pick('soccer');
    startScene('RouletteScene');
  },
  intro: () => {
    gm.state = fakeState('MINIGAME_INTRO');
    gm.pendingMinigame = pick('volleyball');
    startScene('IntroScene');
  },
  controls: () => {
    startScene('NextRoundScene');
    previewControls('dodgeball', 'pad');
  },
  'controls-phone': () => {
    startScene('NextRoundScene');
    previewControls('cultura', 'phone');
  },
  'hud-arena': () => hudSample('arena'),
  'hud-team': () => hudSample('team'),
  memory: () => startScene('memory', { ctx: fakeCtx() }),
  reaction: () => startScene('reaction', { ctx: fakeCtx() }),
  quiz: () => startScene('quiz', { ctx: fakeCtx() }),
  cultura: () => startScene('cultura', { ctx: fakeCtx() }),
  results: () => {
    gm.state = fakeState('ROUND_RESULTS');
    startScene('ResultsScene');
  },
  leaderboard: () => {
    gm.state = fakeState('GLOBAL_LEADERBOARD');
    startScene('LeaderboardScene');
  },
  podium: () => {
    gm.state = fakeState('GAME_FINISHED');
    gm.roundLog = [{ roundId: 1, minigameId: 'quiz', name: 'CHI CAZZO LO SA?', results: fakeState('GAME_FINISHED').lastResults!.results, deltas: { p1: 10, p2: 7, p3: 5, p4: 3, p5: 1 } }];
    startScene('GameOverScene');
  },
  disconnect: () => {
    gm.state = fakeState('MINIGAME_PLAYING');
    startScene('NextRoundScene');
    ensureUiCss();
    const el = document.createElement('div');
    el.id = 'ui-gal-alert';
    el.innerHTML = '<div class="ui-alert" style="z-index:99000">⚠️ CONTROLLER DI VICTOR DISCONNESSO — PREMI A / ✕ PER RICONNETTERE</div><div style="position:fixed;left:50%;bottom:5vh;transform:translateX(-50%);z-index:99500;display:flex;flex-direction:column;gap:8px;align-items:center"><div class="ui-toast warn">⚠️ CONTROLLER DI VICTOR DISCONNESSO</div><div class="ui-toast ok">✅ CONTROLLER DI CARBO RICONNESSO</div></div>';
    document.body.appendChild(el);
  },
  error: () => showMinigameError('TypeError: impossibile leggere "mesh" di undefined\n  at Kart.build (kart.ts:120)', () => hideMinigameError(), () => hideMinigameError()),
  'phone-join': () => phone('join'),
  'phone-passive': () => phone('passive'),
  'phone-private': () => phone('private'),
  'phone-cultura': () => phone('cultura')
};

export function openUiGallery(): void {
  const bar = document.createElement('div');
  bar.id = 'ui-gallery-bar';
  bar.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:2147480000;display:flex;flex-wrap:wrap;gap:4px;padding:6px 8px;background:rgba(2,6,23,.92);font:700 12px Consolas,monospace;border-top:2px dashed #22d3ee';
  const tag = document.createElement('span');
  tag.textContent = 'DEV · GALLERIA UI';
  tag.style.cssText = 'color:#22d3ee;padding:4px 8px';
  bar.appendChild(tag);
  const show = (id: string): void => {
    clearOverlays();
    SCREENS[id]?.();
  };
  for (const id of Object.keys(SCREENS)) {
    const b = document.createElement('button');
    b.textContent = id;
    b.style.cssText = 'padding:4px 8px;border-radius:4px;border:1px solid #334155;background:#0f172a;color:#e2e8f0;cursor:pointer;font:inherit';
    b.onclick = () => show(id);
    bar.appendChild(b);
  }
  document.body.appendChild(bar);
  (window as unknown as { __uiGallery: unknown }).__uiGallery = { ids: () => Object.keys(SCREENS), show, hideBar: (h: boolean) => (bar.style.display = h ? 'none' : 'flex') };
}
