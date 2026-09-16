import Phaser from 'phaser';
import { audio } from '../../core/AudioManager';
import type { MinigameContext } from '../types';
import type { PlayerId } from '../../../shared/types';

// Pseudo-3D road racer (tecnica mode-7 stile Mario Kart SNES), reimplementato in
// Phaser con i nostri personaggi. Ispirato concettualmente a "Mario-Kart-html"
// (nessuna licenza esplicita): nessun codice né asset originale riutilizzato.

const NUM_SEGMENTS = 500;
const SEGMENT_LENGTH = 200;
const LAP_LENGTH = NUM_SEGMENTS * SEGMENT_LENGTH;
const MAX_SPEED = 3800; // unità/s → ~26s al giro
const ACCEL = 1600;
const STEER = 260; // px/s
const ROAD_HALF = 150; // px a scale=1
const CAR_MARGIN = 34;
const LAPS = 2;
const HORIZON = 0.42;
const DRAW_SEGMENTS = 120;
const FOG_START = 0.55; // frazione di DRAW_SEGMENTS da cui inizia la foschia atmosferica
const SKY_TOP = 0x1f7fd4;
const SKY_HORIZON = 0xa9e2ff;

/** Interpolazione lineare tra due colori interi 0xRRGGBB (senza allocazioni). */
function lerpColorInt(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff;
  const ag = (a >> 8) & 0xff;
  const ab = a & 0xff;
  const br = (b >> 16) & 0xff;
  const bg = (b >> 8) & 0xff;
  const bb = b & 0xff;
  const r = (ar + (br - ar) * t) | 0;
  const g = (ag + (bg - ag) * t) | 0;
  const bl = (ab + (bb - ab) * t) | 0;
  return (r << 16) | (g << 8) | bl;
}

interface Car {
  id: PlayerId;
  avatar: string;
  colorNum: number;
  position: number;
  speed: number;
  playerX: number;
  lap: number;
  finished: boolean;
  finishTime: number;
  pos: number;
  offRoad: boolean;
  tilt: number;
  kartGfx: Phaser.GameObjects.Graphics;
  kartShadow: Phaser.GameObjects.Ellipse;
  label: Phaser.GameObjects.Text;
}

interface View {
  x: number;
  y: number;
  w: number;
  h: number;
  gfx: Phaser.GameObjects.Graphics;
  hud: Phaser.GameObjects.Text;
}

/** KART 3D: racer pseudo-3D a curve, split-screen fino a 5 giocatori. */
export class Kart3dScene extends Phaser.Scene {
  private ctx!: MinigameContext;
  private curve: number[] = [];
  private roadX: number[] = [];
  private cars: Car[] = [];
  private views: View[] = [];
  private finished = false;
  private now = 0;

  constructor() {
    super('kart3d');
  }

  create(data: { ctx: MinigameContext }): void {
    this.ctx = data.ctx;
    this.cars = [];
    this.views = [];
    audio.unlock();

    // Tracciato: curve smooth (somma di seni con periodo intero → strada che torna su sé stessa)
    this.curve = [];
    this.roadX = [];
    for (let i = 0; i < NUM_SEGMENTS; i++) {
      const a = (2 * Math.PI * i) / NUM_SEGMENTS;
      this.curve.push(0.5 * Math.sin(a) + 0.25 * Math.sin(2 * a) + 0.15 * Math.sin(3 * a));
    }
    let acc = 0;
    for (let i = 0; i < NUM_SEGMENTS; i++) {
      acc += this.curve[i];
      this.roadX.push(acc);
    }
    const shift = this.roadX[0];
    for (let i = 0; i < NUM_SEGMENTS; i++) this.roadX[i] -= shift;

    const n = this.ctx.playerIds.length;
    const layout = this.cameraLayout(n);

    this.ctx.players.forEach((p, i) => {
      const cell = layout[i];
      const colorNum = Phaser.Display.Color.HexStringToColor(p.color).color;
      const centerX = cell.x + cell.w / 2;
      const bottom = cell.y + cell.h;

      const gfx = this.add.graphics();
      const hud = this.add
        .text(centerX, cell.y + 6, `${p.avatar}`, {
          fontFamily: '"Arial Black", Arial, sans-serif',
          fontSize: '14px',
          color: p.color,
          backgroundColor: 'rgba(10,12,20,0.5)',
          padding: { x: 8, y: 3 }
        })
        .setOrigin(0.5, 0);

      const kartShadow = this.add.ellipse(centerX, bottom - 6, 46, 14, 0x000000, 0.3);
      const kartGfx = this.add.graphics();
      this.drawKartShape(kartGfx, colorNum);
      kartGfx.setPosition(centerX, bottom - 28);

      const label = this.add
        .text(centerX, bottom - 78, '', {
          fontFamily: '"Arial Black", Arial, sans-serif',
          fontSize: '13px',
          color: '#ffffff',
          backgroundColor: 'rgba(10,12,20,0.55)',
          padding: { x: 10, y: 4 }
        })
        .setOrigin(0.5);

      this.views.push({ x: cell.x, y: cell.y, w: cell.w, h: cell.h, gfx, hud });
      this.cars.push({
        id: p.id,
        avatar: p.avatar,
        colorNum,
        position: 0,
        speed: 0,
        playerX: 0,
        lap: 0,
        finished: false,
        finishTime: 0,
        pos: i + 1,
        offRoad: false,
        tilt: 0,
        kartGfx,
        kartShadow,
        label
      });
    });
  }

  /** Disegna una volta sola la sagoma del kart (vista da dietro) attorno a (0,0). */
  private drawKartShape(g: Phaser.GameObjects.Graphics, colorNum: number): void {
    const dark = Phaser.Display.Color.IntegerToColor(colorNum).darken(30).color;
    const light = Phaser.Display.Color.IntegerToColor(colorNum).brighten(20).color;

    g.clear();

    // scocca posteriore (ombra di forma)
    g.fillStyle(dark, 1);
    g.fillRoundedRect(-19, -8, 38, 30, 6);

    // corpo principale
    g.fillStyle(colorNum, 1);
    g.fillRoundedRect(-17, -24, 34, 30, 8);

    // riflesso superiore
    g.fillStyle(light, 0.55);
    g.fillRoundedRect(-13, -22, 26, 8, 4);

    // seggiolino / roll-bar
    g.fillStyle(0x1f2430, 1);
    g.fillRoundedRect(-9, -34, 18, 12, 4);

    // alettone
    g.fillStyle(0x14161c, 1);
    g.fillRect(-22, -38, 44, 5);
    g.fillRect(-20, -38, 4, 10);
    g.fillRect(16, -38, 4, 10);

    // ruote posteriori
    g.fillStyle(0x0c0c0c, 1);
    g.fillCircle(-22, 10, 10);
    g.fillCircle(22, 10, 10);
    g.fillStyle(0x3a3a3a, 1);
    g.fillCircle(-22, 10, 5);
    g.fillCircle(22, 10, 5);

    // stop posteriori
    g.fillStyle(0xff3b3b, 1);
    g.fillRect(-17, 16, 6, 4);
    g.fillRect(11, 16, 6, 4);
  }

  private drawTree(g: Phaser.GameObjects.Graphics, x: number, groundY: number, scale: number, noise: number): void {
    const trunkH = 15 * scale;
    const trunkW = 4 * scale;
    const foliageH = (24 + noise * 16) * scale;
    const foliageW = (18 + noise * 12) * scale;

    g.fillStyle(0x5a4028, 1);
    g.fillRect(x - trunkW / 2, groundY - trunkH, trunkW, trunkH);

    g.fillStyle(noise > 0.5 ? 0x2f7d3a : 0x246a30, 1);
    g.fillTriangle(
      x - foliageW / 2, groundY - trunkH,
      x + foliageW / 2, groundY - trunkH,
      x, groundY - trunkH - foliageH
    );
    g.fillTriangle(
      x - foliageW * 0.4, groundY - trunkH - foliageH * 0.35,
      x + foliageW * 0.4, groundY - trunkH - foliageH * 0.35,
      x, groundY - trunkH - foliageH * 1.3
    );
  }

  private drawMountains(g: Phaser.GameObjects.Graphics, view: View, horizonY: number, shift: number): void {
    const layers: { color: number; height: number; freq: number; yOff: number }[] = [
      { color: 0xbfe0f0, height: 42, freq: 0.006, yOff: 0 },
      { color: 0x9bccdf, height: 30, freq: 0.011, yOff: 6 }
    ];
    for (const layer of layers) {
      g.fillStyle(layer.color, 1);
      g.beginPath();
      g.moveTo(view.x, horizonY + layer.yOff);
      for (let x = 0; x <= view.w; x += 24) {
        const worldX = view.x + x + shift;
        const h = layer.height * (0.4 + 0.6 * Math.abs(Math.sin(worldX * layer.freq) * Math.sin(worldX * layer.freq * 0.37 + 1.7)));
        g.lineTo(view.x + x, horizonY + layer.yOff - h);
      }
      g.lineTo(view.x + view.w, horizonY + layer.yOff);
      g.closePath();
      g.fillPath();
    }
  }

  private cameraLayout(n: number): { x: number; y: number; w: number; h: number }[] {
    if (n === 2) return [
      { x: 0, y: 0, w: 640, h: 720 },
      { x: 640, y: 0, w: 640, h: 720 }
    ];
    if (n === 3) return [
      { x: 0, y: 0, w: 427, h: 720 },
      { x: 427, y: 0, w: 426, h: 720 },
      { x: 853, y: 0, w: 427, h: 720 }
    ];
    if (n === 4) return [
      { x: 0, y: 0, w: 640, h: 360 },
      { x: 640, y: 0, w: 640, h: 360 },
      { x: 0, y: 360, w: 640, h: 360 },
      { x: 640, y: 360, w: 640, h: 360 }
    ];
    const cw = 1280 / 3;
    const ch = 360;
    const cells: { x: number; y: number; w: number; h: number }[] = [];
    for (let i = 0; i < 6; i++) {
      cells.push({ x: (i % 3) * cw, y: Math.floor(i / 3) * ch, w: cw, h: ch });
    }
    return cells;
  }

  update(_t: number, delta: number): void {
    if (this.finished) return;
    const dt = Math.min(delta, 50) / 1000;
    this.now += dt;

    for (const c of this.cars) this.stepCar(c, dt);

    const order = [...this.cars].sort((a, b) => this.progress(b) - this.progress(a));
    order.forEach((c, i) => {
      c.pos = i + 1;
    });

    this.cars.forEach((c, i) => this.renderView(c, this.views[i]));

    if (this.cars.every((c) => c.finished) || this.now >= this.ctx.durationSec) {
      this.endGame();
    }
    this.ctx.input.update();
  }

  private stepCar(c: Car, dt: number): void {
    if (c.finished) return;
    const input = this.ctx.input.get(c.id);
    const left = input.pressed('left');
    const right = input.pressed('right');
    const up = input.pressed('up');
    const down = input.pressed('down');

    const steerDir = (right ? 1 : 0) - (left ? 1 : 0);
    c.playerX += steerDir * STEER * dt;
    c.tilt = Phaser.Math.Linear(c.tilt, steerDir * 9, 0.15);

    if (up) c.speed += ACCEL * dt;
    if (down) c.speed -= ACCEL * 1.5 * dt;
    c.speed *= 0.99;

    const baseIndex = Math.floor(c.position / SEGMENT_LENGTH) % NUM_SEGMENTS;
    const roadHere = this.roadX[baseIndex];
    const offRoad = Math.abs(c.playerX - roadHere) > ROAD_HALF - CAR_MARGIN;
    c.offRoad = offRoad;

    let max = MAX_SPEED;
    if (offRoad) {
      max = MAX_SPEED * 0.35;
      c.speed *= 0.98;
    }
    c.speed = Phaser.Math.Clamp(c.speed, -max * 0.3, max);

    c.playerX = Phaser.Math.Clamp(c.playerX, -ROAD_HALF - 120, ROAD_HALF + 120);

    c.position += c.speed * dt;
    if (c.position < 0) c.position = 0;

    const newLap = Math.floor(c.position / LAP_LENGTH);
    if (newLap > c.lap) {
      c.lap = newLap;
      if (c.lap >= LAPS) {
        c.finished = true;
        c.finishTime = this.now;
        audio.fanfare();
      } else {
        audio.select();
      }
    }
  }

  private progress(c: Car): number {
    if (c.finished) return 1e9 - c.finishTime;
    return c.position;
  }

  private renderView(c: Car, view: View): void {
    const g = view.gfx;
    g.clear();
    const w = view.w;
    const h = view.h;
    const centerX = view.x + w / 2;
    const bottom = view.y + h;
    const horizonY = view.y + h * HORIZON;

    // Cielo con gradiente atmosferico + sole
    g.fillGradientStyle(SKY_TOP, SKY_TOP, SKY_HORIZON, SKY_HORIZON);
    g.fillRect(view.x, view.y, w, horizonY - view.y);

    const sunX = view.x + w * 0.78;
    const sunY = view.y + (horizonY - view.y) * 0.3;
    g.fillStyle(0xfff6d8, 0.85);
    g.fillCircle(sunX, sunY, 28);
    g.fillStyle(0xffffff, 0.55);
    g.fillCircle(sunX, sunY, 14);

    this.drawMountains(g, view, horizonY, -c.playerX * 0.15);

    const baseIndex = Math.floor(c.position / SEGMENT_LENGTH) % NUM_SEGMENTS;
    const basePercent = (c.position % SEGMENT_LENGTH) / SEGMENT_LENGTH;
    const r0 = this.roadX[baseIndex];
    const r1 = this.roadX[(baseIndex + 1) % NUM_SEGMENTS];
    const roadHere = r0 * (1 - basePercent) + r1 * basePercent;

    let y = bottom;
    for (let n = 0; n < DRAW_SEGMENTS; n++) {
      const idx = (baseIndex + n) % NUM_SEGMENTS;
      const rx = this.roadX[idx];

      const scale = 1 / (1 + n * 0.06);
      const stripH = Math.max(1, 11 / (1 + n * 0.06) + 0.5);
      const top = y - stripH;

      const fogT = Phaser.Math.Clamp(
        (n - DRAW_SEGMENTS * FOG_START) / (DRAW_SEGMENTS * (1 - FOG_START)),
        0,
        1
      ) * 0.85;

      // Erba (alternata per dare profondità), sfumata verso l'orizzonte
      const grassBase = n % 2 === 0 ? 0x3a9d3a : 0x379137;
      g.fillStyle(lerpColorInt(grassBase, SKY_HORIZON, fogT), 1);
      g.fillRect(view.x, top, w, stripH + 1);

      // Alberi a bordo strada (solo nei segmenti vicini, per contenere i draw call)
      if (idx % 6 === 0 && n < 70) {
        const side = Math.floor(idx / 6) % 2 === 0 ? -1 : 1;
        const noise = Math.abs(Math.sin(idx * 12.9898));
        const treeOffset = 55 + noise * 65;
        const screenXForTree = centerX + (rx - c.playerX) * scale;
        const roadHalfScreen = ROAD_HALF * scale;
        const treeX = screenXForTree + side * (roadHalfScreen + treeOffset * scale);
        if (treeX > view.x - 30 && treeX < view.x + w + 30) {
          this.drawTree(g, treeX, top + stripH, scale, noise);
        }
      }

      // Strada
      const screenX = centerX + (rx - c.playerX) * scale;
      const screenW = ROAD_HALF * 2 * scale;
      g.fillStyle(lerpColorInt(0x474c58, SKY_HORIZON, fogT), 1);
      g.fillRect(screenX - screenW / 2, top, screenW, stripH + 1);

      // Cordoli (rosso/bianco alternati come nei racer moderni)
      const curbColor = n % 4 < 2 ? 0xe8e8e8 : 0xd23b3b;
      g.fillStyle(lerpColorInt(curbColor, SKY_HORIZON, fogT), 1);
      g.fillRect(screenX - screenW / 2 - 5 * scale, top, 5 * scale, stripH + 1);
      g.fillRect(screenX + screenW / 2, top, 5 * scale, stripH + 1);

      // Linea centrale tratteggiata
      if (n % 4 < 2) {
        g.fillStyle(lerpColorInt(0xf6c445, SKY_HORIZON, fogT), 1);
        g.fillRect(screenX - 1.5 * scale, top, 3 * scale, stripH + 1);
      }

      y = top;
      if (y <= horizonY) break;
    }

    // Kart (il giocatore resta al centro, la strada si muove intorno)
    const jitter = c.offRoad ? Phaser.Math.Between(-2, 2) : 0;
    c.kartShadow.setPosition(centerX + jitter * 0.5, bottom - 6);
    c.kartGfx.setPosition(centerX + jitter, bottom - 28);
    c.kartGfx.setAngle(c.tilt);
    c.label.setText(`${c.avatar} L${Math.min(c.lap + 1, LAPS)}/${LAPS} · ${c.pos}°`).setPosition(centerX, bottom - 78);
    view.hud.setText(`${c.avatar} ${c.finished ? '🏁' : ''}`).setPosition(centerX, view.y + 6);
  }

  private endGame(): void {
    if (this.finished) return;
    this.finished = true;
    const sorted = [...this.cars].sort((a, b) => this.progress(b) - this.progress(a));
    const results = sorted.map((c, i) => ({
      playerId: c.id,
      placement: i + 1,
      score: c.lap
    }));
    this.ctx.finish({ results });
  }
}
