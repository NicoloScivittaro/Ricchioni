import Phaser from 'phaser';
import { GAME_CONFIG } from './config';
import { game as gm } from '../core/GameManager';
import { audio } from '../core/AudioManager';
import { initAudioSettings } from '../core/audioSettings';
import { initMusicDirector } from '../core/musicDirector';
import { initDebug, debugEnabled } from '../core/debug';
import { initTelemetry } from '../core/telemetry';
import { initFlowTrace } from '../core/flowTrace';
import { pads } from '../input/GamepadManager';
import { initPairingPanel } from '../input/PairingPanel';
import { initControlsHelp } from '../input/ControlsHelp';
import { MINIGAME_SCENES } from '../minigames';
import { BootScene } from '../scenes/BootScene';
import { LobbyScene } from '../scenes/LobbyScene';
import { RoomScene } from '../scenes/RoomScene';
import { RouletteScene } from '../scenes/RouletteScene';
import { IntroScene } from '../scenes/IntroScene';
import { FinishedScene } from '../scenes/FinishedScene';
import { ResultsScene } from '../scenes/ResultsScene';
import { LeaderboardScene } from '../scenes/LeaderboardScene';
import { NextRoundScene } from '../scenes/NextRoundScene';
import { GameOverScene } from '../scenes/GameOverScene';

/**
 * NITIDEZZA DEL TESTO. Il canvas resta 1280x720 logico (nessuna coordinata cambia), ma su TV 1080p/4K e schermi HiDPI il browser lo
 * ingrandisce e i testi (rasterizzati a risoluzione 1) sfocano. Ogni Text viene quindi creato a risoluzione 2 quando ogni pixel
 * logico occupa piu' di ~1.2 pixel fisici, a risoluzione 3 su 4K; su un monitor 720p resta 1 (nessun costo).
 * Override di prova: `?textres=1|2|3`.
 */
function textResolution(): number {
  try {
    const forced = Number(new URLSearchParams(location.search).get('textres'));
    if (forced === 1 || forced === 2 || forced === 3) return forced;
    const canvas = document.querySelector('#app canvas') as HTMLCanvasElement | null;
    const shown = canvas ? canvas.getBoundingClientRect().width : GAME_CONFIG.width;
    // 720p: 1 · 1080p/1440p: 2 · 4K (o HiDPI molto denso): 3. Solo i testi, mai il canvas intero.
    const ratio = (shown / GAME_CONFIG.width) * (window.devicePixelRatio || 1);
    return ratio > 2.6 ? 3 : ratio > 1.2 ? 2 : 1;
  } catch {
    return 1;
  }
}

type TextFactory = (x: number, y: number, text: string | string[], style?: Phaser.Types.GameObjects.Text.TextStyle) => Phaser.GameObjects.Text;
const factoryProto = Phaser.GameObjects.GameObjectFactory.prototype as unknown as { text: TextFactory };
const originalText = factoryProto.text;
factoryProto.text = function (this: unknown, x, y, text, style) {
  const res = textResolution();
  return originalText.call(this, x, y, text, res > 1 && style?.resolution === undefined ? { ...style, resolution: res } : style);
};

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'app',
  width: GAME_CONFIG.width,
  height: GAME_CONFIG.height,
  backgroundColor: GAME_CONFIG.backgroundColor,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  scene: [
    BootScene,
    LobbyScene,
    RoomScene,
    RouletteScene,
    IntroScene,
    FinishedScene,
    ResultsScene,
    LeaderboardScene,
    NextRoundScene,
    GameOverScene,
    ...MINIGAME_SCENES
  ]
};

const phaserGame = new Phaser.Game(config);
gm.attach(phaserGame);
audio.enableHotkeys(); // M = muto, [ ] = volume generale (solo host)
initAudioSettings(); // V = volumi (generale/musica/effetti/telecronista); debug audio in F3 e con ?audio=1
initMusicDirector(); // musica procedurale guidata dalle fasi della partita (solo TV, mai sui telefoni)
initDebug(); // overlay F3 (solo dev o ?debug=1)
initFlowTrace(); // traccia di flusso per diagnosticare blocchi (solo debug)
initTelemetry(); // telemetria locale di sessione + SESSION REPORT (F4), solo debug: niente esce dal browser
// Controller fisici (Gamepad API): rilevamento, associazione ai giocatori, input verso i minigiochi. Inerte finche' nessun controller compare.
pads.init();
initPairingPanel();
initControlsHelp(); // schermata CONTROLLI prima del countdown (o "PRENDETE I TELEFONI" per Cultura)
if (debugEnabled()) (window as unknown as Record<string, unknown>).__pads = pads;

// Rete di sicurezza: se update() lancia, Phaser NON ripianifica il frame → host congelato per sempre.
// Dal primo frame in poi il callback è avvolto: l'errore viene loggato (max 1 ogni 3s) e, durante un
// minigioco, mostra l'overlay con [RIPROVA]/[SALTA GIOCO]; il loop continua.
phaserGame.events.once(Phaser.Core.Events.PRE_STEP, () => {
  const raf = (phaserGame.loop as unknown as { raf?: { callback: (t: number) => void } }).raf;
  if (!raf || typeof raf.callback !== 'function') return;
  const inner = raf.callback;
  let lastReport = 0;
  raf.callback = (t: number): void => {
    try {
      inner(t);
    } catch (e) {
      const now = Date.now();
      if (now - lastReport < 3000) return;
      lastReport = now;
      console.error('[phaser loop]', e);
      if (gm.state?.phase === 'MINIGAME_PLAYING') gm.reportMinigameError(e);
    }
  };
});

// URL del server WebSocket: da VITE_SERVER_URL in prod (es. Render/Railway), locale in dev.
const serverUrl = (import.meta.env.VITE_SERVER_URL as string | undefined)?.trim();
gm.connect(serverUrl || (import.meta.env.DEV ? `http://${location.hostname}:3001` : undefined));

// Galleria dei personaggi: SOLO sviluppo o ?debug=1, aperta con ?characters=1 (src/dev/characterGallery.ts). Nella UX normale non esiste.
if (debugEnabled() && new URLSearchParams(location.search).get('characters') === '1') void import('../dev/characterGallery').then((m) => m.openCharacterGallery());
// Impact Lab: SOLO sviluppo o ?debug=1, aperto con ?impact=1 (src/dev/impactLab.ts): feedback delle azioni a confronto, anche al rallentatore.
if (debugEnabled() && new URLSearchParams(location.search).get('impact') === '1') void import('../dev/impactLab').then((m) => m.openImpactLab());
// Fighter Lab: SOLO sviluppo o ?debug=1, aperto con ?fighter=1 (src/dev/fighterLab.ts): BOTTE SUL CORNICIONE con spawn, % di danno, fuori dal palco, hitbox, rallentatore.
if (debugEnabled() && new URLSearchParams(location.search).get('fighter') === '1') void import('../dev/fighterLab').then((m) => m.openFighterLab());
// Audio Lab: SOLO sviluppo o ?debug=1, aperto con ?audiolab=1 (src/dev/audioLab.ts): tutti i suoni e le musiche a portata di click.
if (debugEnabled() && new URLSearchParams(location.search).get('audiolab') === '1') void import('../dev/audioLab').then((m) => m.openAudioLab());
// Galleria AMBIENTI: SOLO sviluppo o ?debug=1, aperta con ?environments=1 (src/dev/environmentGallery.ts): ogni ambiente senza HUD, vista di gioco o panoramica, test in grigi.
if (debugEnabled() && new URLSearchParams(location.search).get('environments') === '1') void import('../dev/environmentGallery').then((m) => m.openEnvironmentGallery());
// Galleria UI: SOLO sviluppo o ?debug=1, aperta con ?ui=1 (src/dev/uiGallery.ts): tutte le schermate con dati finti (5 giocatori, nomi lunghi).
if (debugEnabled() && new URLSearchParams(location.search).get('ui') === '1') void import('../dev/uiGallery').then((m) => m.openUiGallery());
