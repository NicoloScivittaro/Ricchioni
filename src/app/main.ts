import Phaser from 'phaser';
import { GAME_CONFIG } from './config';
import { game as gm } from '../core/GameManager';
import { MINIGAME_SCENES } from '../minigames';
import '../modifiers'; // registra i modificatori (side effect)
import { BootScene } from '../scenes/BootScene';
import { LobbyScene } from '../scenes/LobbyScene';
import { CharacterSelectScene } from '../scenes/CharacterSelectScene';
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
    CharacterSelectScene,
    RouletteScene,
    ResultsScene,
    GameOverScene,
    ...MINIGAME_SCENES
  ]
};

const phaserGame = new Phaser.Game(config);
gm.attach(phaserGame);
