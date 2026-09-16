import Phaser from 'phaser';
import { GAME_CONFIG } from './config';
import { game as gm } from '../core/GameManager';
import { MINIGAME_SCENES } from '../minigames';
import { BootScene } from '../scenes/BootScene';
import { LobbyScene } from '../scenes/LobbyScene';
import { RoomScene } from '../scenes/RoomScene';
import { RouletteScene } from '../scenes/RouletteScene';
import { ResultsScene } from '../scenes/ResultsScene';
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
    ResultsScene,
    GameOverScene,
    ...MINIGAME_SCENES
  ]
};

const phaserGame = new Phaser.Game(config);
gm.attach(phaserGame);

// In dev l'host parla col server locale; in prod same-origin (il server serve anche la build).
gm.connect(import.meta.env.DEV ? `http://${location.hostname}:3001` : undefined);
