import Phaser from 'phaser';
import { SpriteGenerator } from '../sprites/SpriteGenerator.js';

/**
 * Boot scene — generates all textures and shows a brief loading screen.
 */
export class BootScene extends Phaser.Scene {

  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    // Show loading bar
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    const loadingText = this.add.text(width / 2, height / 2 - 30, 'LOADING...', {
      fontFamily: 'monospace',
      fontSize: '24px',
      color: '#ffffff'
    }).setOrigin(0.5);

    const progressBar = this.add.graphics();
    const progressBox = this.add.graphics();
    progressBox.fillStyle(0x333333, 0.8);
    progressBox.fillRect(width / 2 - 160, height / 2, 320, 30);

    this.load.on('progress', (value) => {
      progressBar.clear();
      progressBar.fillStyle(0xff4444, 1);
      progressBar.fillRect(width / 2 - 155, height / 2 + 5, 310 * value, 20);
    });

    // Load music tracks
    this.load.audio('music_0', 'src/music/Neon Apex (1).mp3');
    this.load.audio('music_1', 'src/music/Neon Apex.mp3');
    this.load.audio('music_2', 'src/music/Turbo City Fever (1).mp3');
    this.load.audio('music_3', 'src/music/Turbo City Fever.mp3');
  }

  create() {
    // Generate all textures programmatically
    SpriteGenerator.generateAll(this);

    // Brief title flash
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    this.add.text(width / 2, height / 2 - 40, 'HOT WHEELS', {
      fontFamily: 'monospace',
      fontSize: '48px',
      color: '#ff4444',
      stroke: '#000000',
      strokeThickness: 6
    }).setOrigin(0.5);

    this.add.text(width / 2, height / 2 + 10, 'TOP DOWN RACING', {
      fontFamily: 'monospace',
      fontSize: '20px',
      color: '#ffcc00',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5);

    this.add.text(width / 2, height / 2 + 60, 'PRESS ANY KEY TO START', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#888888'
    }).setOrigin(0.5);

    // Wait for input to proceed
    this.input.keyboard.on('keydown', () => {
      this.scene.start('CarSelectScene');
    });

    this.input.on('pointerdown', () => {
      this.scene.start('CarSelectScene');
    });
  }
}
