import Phaser from 'phaser';

/** Precarica gli asset riutilizzabili (sfondo + volti dei personaggi). */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    this.load.image('bg', '/board_bg.jpg');
    this.load.image('goblin', '/characters/nicolo.jpg');
    this.load.image('buttafuori', '/characters/christian.jpg');
    this.load.image('dottore', '/characters/victor.jpg');
    this.load.image('judoka', '/characters/judoka.jpg');
    this.load.image('ciro', '/characters/ciro.jpg');
  }

  create(): void {
    this.scene.start('LobbyScene');
  }
}
