import Phaser from 'phaser';
import { GAME_CONFIG } from './config';
import { game as gm } from '../core/GameManager';
import { audio } from '../core/AudioManager';
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
