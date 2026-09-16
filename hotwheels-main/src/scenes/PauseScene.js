import Phaser from 'phaser';

/**
 * Pause menu overlay — rendered on top of the frozen RaceScene.
 */
export class PauseScene extends Phaser.Scene {

  constructor() {
    super({ key: 'PauseScene' });
  }

  init(data) {
    this.raceScene = data.raceScene;
  }

  create() {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Dim overlay
    this.overlay = this.add.graphics();
    this.overlay.fillStyle(0x000000, 0.7);
    this.overlay.fillRect(0, 0, width, height);

    // Pause title
    this.add.text(width / 2, height / 2 - 60, 'PAUSED', {
      fontFamily: 'monospace',
      fontSize: '40px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 5
    }).setOrigin(0.5);

    // Quit prompt
    this.add.text(width / 2, height / 2 + 10, 'Quit to menu?', {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: '#cccccc'
    }).setOrigin(0.5);

    // Hints
    this.add.text(width / 2, height / 2 + 55, 'ENTER  QUIT          ESC  RESUME', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#888888'
    }).setOrigin(0.5);

    // Keyboard
    this.input.keyboard.on('keydown-ENTER', () => {
      this.scene.stop();
      this.raceScene.quitToTitle();
    });

    this.input.keyboard.on('keydown-ESC', () => {
      this.scene.stop();
      this.raceScene.closePauseMenu();
    });
  }
}
