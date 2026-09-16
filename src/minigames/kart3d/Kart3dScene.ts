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
  kart: Phaser.GameObjects.Rectangle;
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
    audio.unlock();

    // Tracciato: curve smooth (somma di seni con periodo intero → strada che torna su sé stessa)
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

      const gfx = this.add.graphics();
      const hud = this.add
        .text(cell.x + cell.w / 2, cell.y + 6, `${p.avatar}`, {
          fontFamily: '"Arial Black", Arial, sans-serif',
          fontSize: '14px',
          color: p.color
        })
        .setOrigin(0.5, 0);

      const kart = this.add.rectangle(
        cell.x + cell.w / 2,
        cell.y + cell.h - 30,
        44,
        66,
        colorNum
      ).setStrokeStyle(3, 0xffffff);
      const label = this.add
        .text(cell.x + cell.w / 2, cell.y + cell.h - 72, '', {
          fontFamily: 'Arial, sans-serif',
          fontSize: '13px',
          color: '#ffffff'
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
        kart,
        label
      });
    });
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

    c.playerX += ((right ? 1 : 0) - (left ? 1 : 0)) * STEER * dt;

    if (up) c.speed += ACCEL * dt;
    if (down) c.speed -= ACCEL * 1.5 * dt;
    c.speed *= 0.99;

    const baseIndex = Math.floor(c.position / SEGMENT_LENGTH) % NUM_SEGMENTS;
    const roadHere = this.roadX[baseIndex];
    const offRoad = Math.abs(c.playerX - roadHere) > ROAD_HALF - CAR_MARGIN;

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

    // Cielo
    g.fillStyle(0x6fc3f0, 1);
    g.fillRect(view.x, view.y, w, horizonY - view.y);

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

      // Erba (alternata per dare profondità)
      g.fillStyle(n % 2 === 0 ? 0x3a9d3a : 0x379137, 1);
      g.fillRect(view.x, top, w, stripH + 1);

      // Strada
      const screenX = centerX + (rx - c.playerX) * scale;
      const screenW = ROAD_HALF * 2 * scale;
      g.fillStyle(0x474c58, 1);
      g.fillRect(screenX - screenW / 2, top, screenW, stripH + 1);

      // Cordoli bianchi ai bordi
      g.fillStyle(0xe8e8e8, 1);
      g.fillRect(screenX - screenW / 2 - 5 * scale, top, 5 * scale, stripH + 1);
      g.fillRect(screenX + screenW / 2, top, 5 * scale, stripH + 1);

      // Linea centrale tratteggiata
      if (n % 4 < 2) {
        g.fillStyle(0xf6c445, 1);
        g.fillRect(screenX - 1.5 * scale, top, 3 * scale, stripH + 1);
      }

      y = top;
      if (y <= horizonY) break;
    }

    // Kart (il giocatore resta al centro, la strada si muove intorno)
    c.kart.setPosition(centerX, bottom - 28);
    c.label.setText(`${c.avatar} L${Math.min(c.lap + 1, LAPS)}/${LAPS} · ${c.pos}°`).setPosition(centerX, bottom - 66);
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
