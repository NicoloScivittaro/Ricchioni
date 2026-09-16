import Phaser from 'phaser';
import { game as gm } from '../core/GameManager';
import { audio } from '../core/AudioManager';
import { CHARACTERS, CHARACTER_ORDER } from '../characters';

export class CharacterSelectScene extends Phaser.Scene {
  constructor() {
    super('CharacterSelectScene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#0b0b14');
    const count = gm.playerCount;

    this.add
      .text(640, 50, 'SQUADRA', {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: '56px',
        color: '#ffffff'
      })
      .setOrigin(0.5);

    this.add
      .text(640, 110, `Modalità ${gm.mode} · obiettivo ${gm.target} punti`, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '22px',
        color: '#fbbf24'
      })
      .setOrigin(0.5);

    CHARACTER_ORDER.forEach((cid, i) => {
      const c = CHARACTERS[cid];
      const x = 160 + i * 240;
      const y = 380;
      const active = i < count;
      const color = active ? Phaser.Display.Color.HexStringToColor(c.color).color : 0x1f2937;

      this.add
        .rectangle(x, y, 200, 300, color, active ? 0.95 : 0.4)
        .setStrokeStyle(3, active ? 0xffffff : 0x4b5563);
      this.add.image(x, y - 80, c.id).setDisplaySize(150, 150);
      this.add
        .text(x, y + 55, c.name, {
          fontFamily: '"Arial Black", Arial, sans-serif',
          fontSize: '24px',
          color: '#ffffff'
        })
        .setOrigin(0.5);
      this.add
        .text(x, y + 85, c.roleTitle, {
          fontFamily: 'Arial, sans-serif',
          fontSize: '13px',
          color: '#e5e7eb',
          align: 'center',
          wordWrap: { width: 190 }
        })
        .setOrigin(0.5);

      if (active) {
        this.add
          .text(x, y - 155, `P${i + 1}`, {
            fontFamily: '"Arial Black", Arial, sans-serif',
            fontSize: '30px',
            color: c.color
          })
          .setOrigin(0.5);
      }
    });

    this.add
      .text(640, 660, 'Premi INVIO per andare al rullo', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '24px',
        color: '#4ade80'
      })
      .setOrigin(0.5);

    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        audio.select();
        gm.startMatch();
        this.scene.start('RouletteScene');
      }
    });
  }
}
