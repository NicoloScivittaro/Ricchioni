import Phaser from 'phaser';

/** Scoppio di coriandoli multicolore (usa una texture bianca generata + tint). */
export function confetti(scene: Phaser.Scene, x: number, y: number): void {
  if (!scene.textures.exists('confetti')) {
    const g = scene.make.graphics({ x: 0, y: 0 });
    g.fillStyle(0xffffff, 1);
    g.fillRect(0, 0, 6, 6);
    g.generateTexture('confetti', 6, 6);
    g.destroy();
  }
  const emitter = scene.add.particles(x, y, 'confetti', {
    speed: { min: 200, max: 520 },
    angle: { min: 0, max: 360 },
    gravityY: 400,
    lifespan: 2200,
    scale: { start: 1, end: 0 },
    tint: [0xff4b4b, 0x4b9fff, 0x4bff7a, 0xffe14b, 0xff4be1, 0x4be1ff],
    emitting: false
  });
  emitter.explode(140, x, y);
}
