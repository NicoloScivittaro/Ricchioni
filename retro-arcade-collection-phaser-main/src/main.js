import Phaser from './lib/phaser.esm.min.js';

import LauncherScene   from './scenes/LauncherScene.js';
import SnakeScene      from './scenes/SnakeScene.js';
import TetrisScene     from './scenes/TetrisScene.js';
import PongScene       from './scenes/PongScene.js';
import BreakoutScene   from './scenes/BreakoutScene.js';
import SpaceInvScene   from './scenes/SpaceInvadersScene.js';
import MazeScene       from './scenes/MazeRunnerScene.js';
import MemoryScene     from './scenes/MemoryGameScene.js';
import Puzzle15Scene   from './scenes/Puzzle15Scene.js';
import TicTacToeScene  from './scenes/TicTacToeScene.js';

// Expose Phaser globally so scenes can use it without re-importing
window.Phaser = Phaser;

const config = {
  type: Phaser.WEBGL,
  width: 800,
  height: 600,
  backgroundColor: '#14142a',
  scene: [
    LauncherScene,
    SnakeScene,
    TetrisScene,
    PongScene,
    BreakoutScene,
    SpaceInvScene,
    MazeScene,
    MemoryScene,
    Puzzle15Scene,
    TicTacToeScene,
  ],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};

new Phaser.Game(config);
