import Phaser from 'phaser';
import { GAME_CONFIG } from './config';
import { game as gm } from '../core/GameManager';
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

// URL del server WebSocket: da VITE_SERVER_URL in prod (es. Render/Railway), locale in dev.
const serverUrl = (import.meta.env.VITE_SERVER_URL as string | undefined)?.trim();
gm.connect(serverUrl || (import.meta.env.DEV ? `http://${location.hostname}:3001` : undefined));
