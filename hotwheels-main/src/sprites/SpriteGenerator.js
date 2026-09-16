/**
 * Generates all pixel art sprites programmatically.
 * Each car is drawn top-down at 32x48 then registered as a Phaser texture.
 */
export class SpriteGenerator {

  static generateAll(scene) {
    this.generateMonsterTruck(scene);
    this.generateSportsCar(scene);
    this.generateTopHatCar(scene);
    this.generateItemBox(scene);
    this.generatePowerUpIcons(scene);
    this.generateTrafficLight(scene);
    this.generateTiles(scene);
    this.generateBarrier(scene);
    this.generateParticles(scene);
  }

  static generateMonsterTruck(scene) {
    const g = scene.make.graphics({ add: false });
    const w = 32, h = 48;

    // Big chunky wheels (dark gray)
    g.fillStyle(0x333333);
    g.fillRect(2, 4, 7, 14);   // top-left wheel
    g.fillRect(23, 4, 7, 14);  // top-right wheel
    g.fillRect(2, 30, 7, 14);  // bottom-left wheel
    g.fillRect(23, 30, 7, 14); // bottom-right wheel

    // Wheel tread marks
    g.fillStyle(0x555555);
    g.fillRect(3, 6, 5, 2);
    g.fillRect(3, 10, 5, 2);
    g.fillRect(3, 14, 5, 2);
    g.fillRect(24, 6, 5, 2);
    g.fillRect(24, 10, 5, 2);
    g.fillRect(24, 14, 5, 2);
    g.fillRect(3, 32, 5, 2);
    g.fillRect(3, 36, 5, 2);
    g.fillRect(3, 40, 5, 2);
    g.fillRect(24, 32, 5, 2);
    g.fillRect(24, 36, 5, 2);
    g.fillRect(24, 40, 5, 2);

    // Body (black)
    g.fillStyle(0x1a1a1a);
    g.fillRect(8, 2, 16, 44);

    // Red accents/stripe
    g.fillStyle(0xcc2222);
    g.fillRect(10, 4, 12, 3);  // front bumper
    g.fillRect(10, 41, 12, 3); // rear bumper
    g.fillRect(14, 8, 4, 32);  // center stripe

    // Headlights (yellow)
    g.fillStyle(0xffcc00);
    g.fillRect(10, 2, 4, 2);
    g.fillRect(18, 2, 4, 2);

    // Taillights (red glow)
    g.fillStyle(0xff4444);
    g.fillRect(10, 44, 4, 2);
    g.fillRect(18, 44, 4, 2);

    // Roll cage outline
    g.lineStyle(1, 0x444444);
    g.strokeRect(9, 14, 14, 12);

    g.generateTexture('car_monsterTruck', w, h);
    g.destroy();
  }

  static generateSportsCar(scene) {
    const g = scene.make.graphics({ add: false });
    const w = 32, h = 48;

    // Slim wheels
    g.fillStyle(0x222222);
    g.fillRect(4, 6, 5, 10);   // top-left
    g.fillRect(23, 6, 5, 10);  // top-right
    g.fillRect(4, 32, 5, 10);  // bottom-left
    g.fillRect(23, 32, 5, 10); // bottom-right

    // Body (red)
    g.fillStyle(0xcc2222);
    g.fillRect(9, 3, 14, 42);

    // Tapered nose
    g.fillStyle(0xcc2222);
    g.fillRect(11, 0, 10, 3);

    // Tapered rear
    g.fillRect(11, 45, 10, 3);

    // White racing stripes
    g.fillStyle(0xffffff);
    g.fillRect(13, 2, 2, 44);
    g.fillRect(17, 2, 2, 44);

    // Windshield (dark blue)
    g.fillStyle(0x223355);
    g.fillRect(11, 14, 10, 8);

    // Headlights
    g.fillStyle(0xffffcc);
    g.fillRect(11, 0, 3, 2);
    g.fillRect(18, 0, 3, 2);

    // Taillights
    g.fillStyle(0xff2222);
    g.fillRect(11, 46, 3, 2);
    g.fillRect(18, 46, 3, 2);

    // Spoiler
    g.fillStyle(0x991111);
    g.fillRect(9, 40, 14, 2);

    g.generateTexture('car_sportsCar', w, h);
    g.destroy();
  }

  static generateTopHatCar(scene) {
    const g = scene.make.graphics({ add: false });
    const w = 32, h = 48;

    // Small wheels
    g.fillStyle(0x222222);
    g.fillRect(4, 8, 5, 8);
    g.fillRect(23, 8, 5, 8);
    g.fillRect(4, 32, 5, 8);
    g.fillRect(23, 32, 5, 8);

    // Hat brim (wide, rainbow gradient)
    g.fillStyle(0xff3366);
    g.fillRect(3, 22, 26, 6);

    // Hat body (cylinder shape, rainbow stripes)
    const stripeColors = [0xff3366, 0xff9933, 0xffcc00, 0x33cc66, 0x3399ff, 0x9933ff];
    for (let i = 0; i < 6; i++) {
      g.fillStyle(stripeColors[i]);
      g.fillRect(8, 3 + i * 4, 16, 4);
    }

    // Hat band (gold)
    g.fillStyle(0xffcc00);
    g.fillRect(8, 19, 16, 3);

    // Axle / undercarriage
    g.fillStyle(0x444444);
    g.fillRect(6, 28, 20, 4);
    g.fillRect(6, 36, 20, 4);

    // Tiny headlights on the brim
    g.fillStyle(0xffffcc);
    g.fillRect(5, 22, 3, 2);
    g.fillRect(24, 22, 3, 2);

    // Tiny taillights
    g.fillStyle(0xff4444);
    g.fillRect(5, 26, 3, 2);
    g.fillRect(24, 26, 3, 2);

    g.generateTexture('car_topHatCar', w, h);
    g.destroy();
  }

  static generateItemBox(scene) {
    const g = scene.make.graphics({ add: false });
    const s = 20;

    // Outer box
    g.fillStyle(0xffcc00);
    g.fillRect(0, 0, s, s);

    // Inner dark
    g.fillStyle(0xaa8800);
    g.fillRect(2, 2, s - 4, s - 4);

    // Question mark
    g.fillStyle(0xffcc00);
    g.fillRect(7, 4, 6, 2);
    g.fillRect(11, 6, 2, 4);
    g.fillRect(9, 10, 2, 2);
    g.fillRect(9, 14, 2, 2);

    g.generateTexture('itemBox', s, s);
    g.destroy();
  }

  static generatePowerUpIcons(scene) {
    const iconSize = 24;

    // Nitro Boost
    let g = scene.make.graphics({ add: false });
    g.fillStyle(0xff6600);
    g.fillRect(6, 2, 12, 20);
    g.fillStyle(0xffcc00);
    g.fillRect(8, 4, 8, 6);
    g.fillStyle(0xff3300);
    g.fillTriangle(12, 22, 6, 14, 18, 14);
    g.generateTexture('icon_nitro', iconSize, iconSize);
    g.destroy();

    // Oil Slick
    g = scene.make.graphics({ add: false });
    g.fillStyle(0x332211);
    g.fillCircle(12, 12, 10);
    g.fillStyle(0x554433);
    g.fillCircle(10, 10, 5);
    g.fillStyle(0x221100);
    g.fillCircle(14, 14, 4);
    g.generateTexture('icon_oil', iconSize, iconSize);
    g.destroy();

    // Shield
    g = scene.make.graphics({ add: false });
    g.fillStyle(0x3399ff);
    g.fillRect(4, 2, 16, 18);
    g.fillRect(6, 18, 12, 2);
    g.fillRect(8, 20, 8, 2);
    g.fillStyle(0x66bbff);
    g.fillRect(6, 4, 12, 8);
    g.generateTexture('icon_shield', iconSize, iconSize);
    g.destroy();

    // Missile
    g = scene.make.graphics({ add: false });
    g.fillStyle(0xcc0000);
    g.fillRect(9, 2, 6, 16);
    g.fillStyle(0xff4444);
    g.fillRect(10, 4, 4, 6);
    g.fillStyle(0xcccccc);
    g.fillRect(7, 14, 10, 4);
    g.fillStyle(0xff6600);
    g.fillTriangle(12, 22, 8, 18, 16, 18);
    g.generateTexture('icon_missile', iconSize, iconSize);
    g.destroy();

    // Tacks
    g = scene.make.graphics({ add: false });
    g.fillStyle(0xaaaaaa);
    g.fillRect(4, 10, 4, 4);
    g.fillRect(12, 4, 4, 4);
    g.fillRect(18, 12, 4, 4);
    g.fillRect(8, 18, 4, 4);
    g.fillRect(16, 18, 4, 4);
    g.fillStyle(0xcccccc);
    g.fillRect(5, 11, 2, 2);
    g.fillRect(13, 5, 2, 2);
    g.fillRect(19, 13, 2, 2);
    g.generateTexture('icon_tacks', iconSize, iconSize);
    g.destroy();
  }

  static generateTrafficLight(scene) {
    const g = scene.make.graphics({ add: false });
    // Housing
    g.fillStyle(0x333333);
    g.fillRect(0, 0, 40, 100);
    g.fillStyle(0x222222);
    g.fillRect(2, 2, 36, 96);

    // Red light (top)
    g.fillStyle(0x440000);
    g.fillCircle(20, 20, 12);
    // Yellow light (middle)
    g.fillStyle(0x443300);
    g.fillCircle(20, 50, 12);
    // Green light (bottom)
    g.fillStyle(0x004400);
    g.fillCircle(20, 80, 12);

    g.generateTexture('trafficLight_off', 40, 100);
    g.destroy();

    // Red ON
    const gr = scene.make.graphics({ add: false });
    gr.fillStyle(0x333333);
    gr.fillRect(0, 0, 40, 100);
    gr.fillStyle(0x222222);
    gr.fillRect(2, 2, 36, 96);
    gr.fillStyle(0xff0000);
    gr.fillCircle(20, 20, 12);
    gr.fillStyle(0x443300);
    gr.fillCircle(20, 50, 12);
    gr.fillStyle(0x004400);
    gr.fillCircle(20, 80, 12);
    gr.generateTexture('trafficLight_red', 40, 100);
    gr.destroy();

    // Green ON
    const gg = scene.make.graphics({ add: false });
    gg.fillStyle(0x333333);
    gg.fillRect(0, 0, 40, 100);
    gg.fillStyle(0x222222);
    gg.fillRect(2, 2, 36, 96);
    gg.fillStyle(0x440000);
    gg.fillCircle(20, 20, 12);
    gg.fillStyle(0x443300);
    gg.fillCircle(20, 50, 12);
    gg.fillStyle(0x00ff00);
    gg.fillCircle(20, 80, 12);
    gg.generateTexture('trafficLight_green', 40, 100);
    gg.destroy();
  }

  static generateTiles(scene) {
    const ts = 64; // tile size

    // Road tile
    let g = scene.make.graphics({ add: false });
    g.fillStyle(0x3a3a3a);
    g.fillRect(0, 0, ts, ts);
    // Lane dashes
    g.fillStyle(0x666666);
    g.fillRect(30, 4, 4, 12);
    g.fillRect(30, 24, 4, 12);
    g.fillRect(30, 44, 4, 12);
    g.generateTexture('tile_road', ts, ts);
    g.destroy();

    // Sidewalk tile
    g = scene.make.graphics({ add: false });
    g.fillStyle(0x888888);
    g.fillRect(0, 0, ts, ts);
    g.fillStyle(0x777777);
    for (let i = 0; i < ts; i += 16) {
      g.fillRect(i, 0, 1, ts);
      g.fillRect(0, i, ts, 1);
    }
    g.generateTexture('tile_sidewalk', ts, ts);
    g.destroy();

    // Grass/park tile
    g = scene.make.graphics({ add: false });
    g.fillStyle(0x2d5a1e);
    g.fillRect(0, 0, ts, ts);
    g.fillStyle(0x3a6b2a);
    g.fillRect(8, 8, 4, 4);
    g.fillRect(40, 20, 4, 4);
    g.fillRect(20, 44, 4, 4);
    g.generateTexture('tile_grass', ts, ts);
    g.destroy();

    // Start/finish line
    g = scene.make.graphics({ add: false });
    g.fillStyle(0x3a3a3a);
    g.fillRect(0, 0, ts, ts);
    // Checkered pattern
    const cs = 8;
    for (let row = 0; row < ts / cs; row++) {
      for (let col = 0; col < ts / cs; col++) {
        if ((row + col) % 2 === 0) {
          g.fillStyle(0xffffff);
        } else {
          g.fillStyle(0x111111);
        }
        g.fillRect(col * cs, row * cs, cs, cs);
      }
    }
    g.generateTexture('tile_startFinish', ts, ts);
    g.destroy();

    // Building tiles (variety)
    const buildingColors = [
      { wall: 0x6b4c3b, roof: 0x8b6b5a, window: 0x88ccff },
      { wall: 0x5a5a6b, roof: 0x7a7a8b, window: 0xffcc44 },
      { wall: 0x7b5a4b, roof: 0x9b7a6b, window: 0x88ccff },
      { wall: 0x4b5a6b, roof: 0x6b7a8b, window: 0xffee88 },
    ];

    buildingColors.forEach((bc, i) => {
      g = scene.make.graphics({ add: false });
      g.fillStyle(bc.wall);
      g.fillRect(0, 0, ts, ts);
      // Roof edge
      g.fillStyle(bc.roof);
      g.fillRect(0, 0, ts, 4);
      g.fillRect(0, 0, 4, ts);
      // Windows
      g.fillStyle(bc.window);
      g.fillRect(10, 12, 8, 10);
      g.fillRect(10, 34, 8, 10);
      g.fillRect(36, 12, 8, 10);
      g.fillRect(36, 34, 8, 10);
      // Window frames
      g.fillStyle(bc.roof);
      g.fillRect(13, 12, 2, 10);
      g.fillRect(10, 16, 8, 2);
      g.fillRect(39, 12, 2, 10);
      g.fillRect(36, 16, 8, 2);
      g.fillRect(13, 34, 2, 10);
      g.fillRect(10, 38, 8, 2);
      g.fillRect(39, 34, 2, 10);
      g.fillRect(36, 38, 8, 2);
      g.generateTexture(`tile_building${i}`, ts, ts);
      g.destroy();
    });
  }

  static generateBarrier(scene) {
    const g = scene.make.graphics({ add: false });
    const w = 64, h = 16;
    // Jersey barrier
    g.fillStyle(0xcccccc);
    g.fillRect(0, 0, w, h);
    g.fillStyle(0xff4400);
    g.fillRect(0, 4, w, 8);
    g.fillStyle(0xffffff);
    g.fillRect(0, 6, w, 4);
    // Segment lines
    g.fillStyle(0x999999);
    for (let x = 0; x < w; x += 16) {
      g.fillRect(x, 0, 2, h);
    }
    g.generateTexture('barrier', w, h);
    g.destroy();
  }

  static generateParticles(scene) {
    // Spark particle
    let g = scene.make.graphics({ add: false });
    g.fillStyle(0xffcc00);
    g.fillRect(0, 0, 4, 4);
    g.generateTexture('particle_spark', 4, 4);
    g.destroy();

    // Smoke particle
    g = scene.make.graphics({ add: false });
    g.fillStyle(0x888888);
    g.fillCircle(4, 4, 4);
    g.generateTexture('particle_smoke', 8, 8);
    g.destroy();

    // Oil puddle
    g = scene.make.graphics({ add: false });
    g.fillStyle(0x332211);
    g.fillCircle(16, 16, 14);
    g.fillStyle(0x443322);
    g.fillCircle(12, 12, 6);
    g.generateTexture('oilPuddle', 32, 32);
    g.destroy();

    // Tack
    g = scene.make.graphics({ add: false });
    g.fillStyle(0xcccccc);
    g.fillRect(2, 0, 2, 6);
    g.fillRect(0, 2, 6, 2);
    g.generateTexture('tack', 6, 6);
    g.destroy();

    // Missile projectile
    g = scene.make.graphics({ add: false });
    g.fillStyle(0xcc0000);
    g.fillRect(2, 0, 4, 10);
    g.fillStyle(0xff4444);
    g.fillRect(3, 1, 2, 4);
    g.fillStyle(0xff6600);
    g.fillTriangle(4, 12, 1, 10, 7, 10);
    g.generateTexture('missileProjectile', 8, 12);
    g.destroy();

    // Shield bubble
    g = scene.make.graphics({ add: false });
    g.lineStyle(2, 0x3399ff, 0.7);
    g.strokeCircle(24, 24, 22);
    g.lineStyle(1, 0x66ccff, 0.4);
    g.strokeCircle(24, 24, 18);
    g.generateTexture('shieldBubble', 48, 48);
    g.destroy();

    // Nitro flame
    g = scene.make.graphics({ add: false });
    g.fillStyle(0xff6600);
    g.fillTriangle(6, 0, 0, 16, 12, 16);
    g.fillStyle(0xffcc00);
    g.fillTriangle(6, 4, 2, 14, 10, 14);
    g.generateTexture('nitroFlame', 12, 16);
    g.destroy();
  }
}
