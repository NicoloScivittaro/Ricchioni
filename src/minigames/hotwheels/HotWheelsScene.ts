import Phaser from 'phaser';
import { audio } from '../../core/AudioManager';
import type { MinigameContext } from '../types';
import type { PlayerId } from '../../../shared/types';

// Ispirato a "Hot Wheels" (top-down racer, licenza ISC). Reimplementato per
// host/controller: split-screen fino a 5 giocatori, circuito a checkpoint,
// power-up che colpiscono gli avversari.

const TILE = 64;
const TRACK_W = 40;
const TRACK_H = 40;
const WORLD = TILE * TRACK_W; // 2560
const TOTAL_LAPS = 3;

const STATS = { maxSpeed: 600, accel: 340, turn: 1.9, friction: 0.975 };

const CAR_BODY = 16;

// ---- Tracciato (portato da trackData.js) ----

const TRACK_MAP: number[][] = generateTrackMap();

function generateTrackMap(): number[][] {
  const map: number[][] = [];
  for (let y = 0; y < TRACK_H; y++) {
    map[y] = [];
    for (let x = 0; x < TRACK_W; x++) map[y][x] = 4 + ((x * 3 + y * 7) % 4);
  }
  const setRoad = (x: number, y: number): void => {
    if (x >= 0 && x < TRACK_W && y >= 0 && y < TRACK_H) map[y][x] = 1;
  };
  const setSidewalk = (x: number, y: number): void => {
    if (x >= 0 && x < TRACK_W && y >= 0 && y < TRACK_H && map[y][x] !== 1 && map[y][x] !== 3) map[y][x] = 2;
  };
  const setStart = (x: number, y: number): void => {
    if (x >= 0 && x < TRACK_W && y >= 0 && y < TRACK_H) map[y][x] = 3;
  };
  const setGrass = (x: number, y: number): void => {
    if (x >= 0 && x < TRACK_W && y >= 0 && y < TRACK_H && map[y][x] !== 1 && map[y][x] !== 2 && map[y][x] !== 3) map[y][x] = 8;
  };
  const carveH = (y: number, x1: number, x2: number, w = 3): void => {
    for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) {
      for (let i = 0; i < w; i++) setRoad(x, y + i);
      setSidewalk(x, y - 1);
      setSidewalk(x, y + w);
    }
  };
  const carveV = (x: number, y1: number, y2: number, w = 3): void => {
    for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) {
      for (let i = 0; i < w; i++) setRoad(x + i, y);
      setSidewalk(x - 1, y);
      setSidewalk(x + w, y);
    }
  };
  const carveC = (cx: number, cy: number, w = 3): void => {
    for (let dy = 0; dy < w; dy++) for (let dx = 0; dx < w; dx++) setRoad(cx + dx, cy + dy);
    for (let d = -1; d <= w; d++) {
      setSidewalk(cx + d, cy - 1);
      setSidewalk(cx + d, cy + w);
      setSidewalk(cx - 1, cy + d);
      setSidewalk(cx + w, cy + d);
    }
  };

  carveH(32, 8, 22);
  setStart(14, 32);
  setStart(14, 33);
  setStart(14, 34);
  carveC(22, 32);
  carveV(22, 10, 32);
  carveC(22, 10);
  carveH(10, 8, 24);
  carveV(12, 7, 10);
  carveC(12, 7);
  carveH(7, 8, 14);
  carveC(8, 7);
  carveV(8, 7, 12);
  carveC(8, 10);
  carveV(8, 12, 32);
  carveC(8, 32);
  for (let y = 16; y < 28; y++) for (let x = 14; x < 20; x++) setGrass(x, y);
  return map;
}

interface Gate {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

const CHECKPOINT_GATES: Gate[] = [
  { x1: 14 * TILE, y1: 31 * TILE, x2: 14 * TILE, y2: 35 * TILE },
  { x1: 21 * TILE, y1: 20 * TILE, x2: 25 * TILE, y2: 20 * TILE },
  { x1: 18 * TILE, y1: 9 * TILE, x2: 18 * TILE, y2: 13 * TILE },
  { x1: 7 * TILE, y1: 22 * TILE, x2: 11 * TILE, y2: 22 * TILE },
  { x1: 11 * TILE, y1: 31 * TILE, x2: 11 * TILE, y2: 35 * TILE }
];

const ITEM_BOXES = [
  { x: 19 * TILE, y: 33.5 * TILE },
  { x: 23.5 * TILE, y: 18 * TILE },
  { x: 17 * TILE, y: 11.5 * TILE },
  { x: 9.5 * TILE, y: 24 * TILE }
];

const POWERUPS = ['nitro', 'oil', 'shield', 'missile', 'tacks'] as const;

interface Car {
  id: PlayerId;
  avatar: string;
  colorNum: number;
  x: number;
  y: number;
  angle: number;
  speed: number;
  prevX: number;
  prevY: number;
  lap: number;
  nextGate: number;
  allMid: boolean;
  leftStart: boolean;
  finished: boolean;
  finishTime: number;
  held: string | null;
  shield: boolean;
  nitroUntil: number;
  slowUntil: number;
  spinUntil: number;
  triangle: Phaser.GameObjects.Triangle;
  label: Phaser.GameObjects.Text;
  pos: number;
}

interface Box {
  x: number;
  y: number;
  active: boolean;
  respawnAt: number;
  rect: Phaser.GameObjects.Rectangle;
}

interface Hazard {
  type: 'oil' | 'tacks';
  x: number;
  y: number;
  owner: PlayerId;
  until: number;
  radius: number;
  circles: Phaser.GameObjects.Arc[];
}

interface Missile {
  x: number;
  y: number;
  angle: number;
  owner: PlayerId;
  target: PlayerId;
  dist: number;
  circle: Phaser.GameObjects.Arc;
}

/** HOT WHEELS: circuito a checkpoint, 3 giri, power-up offensivi. */
export class HotWheelsScene extends Phaser.Scene {
  private ctx!: MinigameContext;
  private cars: Car[] = [];
  private boxes: Box[] = [];
  private hazards: Hazard[] = [];
  private missiles: Missile[] = [];
  private finished = false;
  private now = 0;

  constructor() {
    super('hotwheels');
  }

  create(data: { ctx: MinigameContext }): void {
    this.ctx = data.ctx;
    audio.unlock();

    // Tracciato come texture unica
    const g = this.add.graphics();
    const buildingColors = [0x20242e, 0x282c38, 0x1c1f28, 0x303440];
    for (let ty = 0; ty < TRACK_H; ty++) {
      for (let tx = 0; tx < TRACK_W; tx++) {
        const t = TRACK_MAP[ty][tx];
        let color: number;
        if (t === 1) color = 0x2b2f3a;
        else if (t === 2) color = 0x3a3f4a;
        else if (t === 3) color = 0xffffff;
        else if (t === 8) color = 0x2d5a2d;
        else color = buildingColors[t - 4];
        g.fillStyle(color, 1);
        g.fillRect(tx * TILE, ty * TILE, TILE, TILE);
      }
    }
    g.generateTexture('hotwheels_track', WORLD, WORLD);
    g.destroy();
    this.add.image(WORLD / 2, WORLD / 2, 'hotwheels_track').setDepth(0);

    // Item box
    for (const p of ITEM_BOXES) {
      const rect = this.add.rectangle(p.x, p.y, 40, 40, 0xfbbf24).setStrokeStyle(3, 0x000000).setDepth(2);
      this.boxes.push({ x: p.x, y: p.y, active: true, respawnAt: 0, rect });
    }

    // Auto dei giocatori
    const n = this.ctx.playerIds.length;
    this.ctx.players.forEach((p, i) => {
      const x = 13 * TILE + i * 22;
      const y = 34 * TILE;
      const colorNum = Phaser.Display.Color.HexStringToColor(p.color).color;
      const triangle = this.add
        .triangle(x, y, 18, 0, -14, 14, -14, -14, colorNum)
        .setStrokeStyle(2, 0xffffff)
        .setDepth(10);
      const label = this.add
        .text(x, y - 30, `${p.avatar}`, {
          fontFamily: 'Arial, sans-serif',
          fontSize: '18px',
          color: p.color
        })
        .setOrigin(0.5)
        .setDepth(12);
      this.cars.push({
        id: p.id,
        avatar: p.avatar,
        colorNum,
        x,
        y,
        angle: 0,
        speed: 0,
        prevX: x,
        prevY: y,
        lap: 0,
        nextGate: 0,
        allMid: false,
        leftStart: false,
        finished: false,
        finishTime: 0,
        held: null,
        shield: false,
        nitroUntil: 0,
        slowUntil: 0,
        spinUntil: 0,
        triangle,
        label,
        pos: i + 1
      });
    });

    // Split-screen cameras
    this.cameras.main.setBackgroundColor('#000000');
    const layout = this.cameraLayout(n);
    this.cars.forEach((c, i) => {
      const cell = layout[i];
      const cam = this.cameras.add(cell.x, cell.y, cell.w, cell.h);
      cam.setBackgroundColor('#000000');
      cam.setZoom(cell.zoom);
      cam.startFollow(c.triangle, true, 0.1, 0.1);
    });
  }

  private cameraLayout(n: number): { x: number; y: number; w: number; h: number; zoom: number }[] {
    if (n === 2) {
      return [
        { x: 0, y: 0, w: 640, h: 720, zoom: 0.7 },
        { x: 640, y: 0, w: 640, h: 720, zoom: 0.7 }
      ];
    }
    if (n === 3) {
      return [
        { x: 0, y: 0, w: 427, h: 720, zoom: 0.5 },
        { x: 427, y: 0, w: 426, h: 720, zoom: 0.5 },
        { x: 853, y: 0, w: 427, h: 720, zoom: 0.5 }
      ];
    }
    if (n === 4) {
      return [
        { x: 0, y: 0, w: 640, h: 360, zoom: 0.62 },
        { x: 640, y: 0, w: 640, h: 360, zoom: 0.62 },
        { x: 0, y: 360, w: 640, h: 360, zoom: 0.62 },
        { x: 640, y: 360, w: 640, h: 360, zoom: 0.62 }
      ];
    }
    const cw = 1280 / 3;
    const ch = 360;
    const cells: { x: number; y: number; w: number; h: number; zoom: number }[] = [];
    for (let i = 0; i < 6; i++) {
      cells.push({
        x: (i % 3) * cw,
        y: Math.floor(i / 3) * ch,
        w: cw,
        h: ch,
        zoom: 0.5
      });
    }
    return cells;
  }

  update(_t: number, delta: number): void {
    if (this.finished) return;
    const dt = Math.min(delta, 50) / 1000;
    this.now += dt;

    for (const c of this.cars) this.stepCar(c, dt);
    this.updateBoxes();
    this.updateHazards();
    this.updateMissiles(dt);
    this.rank();

    if (this.cars.every((c) => c.finished) || this.now >= this.ctx.durationSec) {
      this.endGame();
    }
    this.ctx.input.update();
  }

  private stepCar(c: Car, dt: number): void {
    if (c.finished) return;
    const input = this.ctx.input.get(c.id);

    // Spin-out
    if (this.now < c.spinUntil) {
      c.angle += 8 * dt;
      c.speed *= 0.95;
      this.applyMotion(c, dt, false, false, false, false);
      this.updateCarVisual(c);
      return;
    }

    const accel = input.pressed('up');
    const brake = input.pressed('down');
    const left = input.pressed('left');
    const right = input.pressed('right');
    const useItem = input.justPressed('action');

    if (useItem && c.held) this.usePowerUp(c, c.held);

    this.applyMotion(c, dt, accel, brake, left, right);

    // Checkpoint
    this.updateCheckpoints(c);
    this.updateCarVisual(c);
  }

  private applyMotion(c: Car, dt: number, accel: boolean, brake: boolean, left: boolean, right: boolean): void {
    const speedFactor = Math.max(0.7, Math.min(Math.abs(c.speed) / 50, 1));
    if (left) c.angle -= STATS.turn * speedFactor * dt;
    if (right) c.angle += STATS.turn * speedFactor * dt;
    if (accel) c.speed += STATS.accel * dt;
    if (brake) c.speed -= STATS.accel * 1.5 * dt;
    c.speed *= STATS.friction;

    let max = STATS.maxSpeed;
    if (this.now < c.nitroUntil) max *= 1.6;
    if (this.now < c.slowUntil) max *= 0.5;
    c.speed = Phaser.Math.Clamp(c.speed, -max * 0.3, max);
    if (Math.abs(c.speed) < 0.5) c.speed = 0;

    const nx = c.x + Math.cos(c.angle) * c.speed * dt;
    const ny = c.y + Math.sin(c.angle) * c.speed * dt;

    if (!this.isOnRoad(nx, ny)) {
      const xOnly = !this.isOnRoad(nx, c.y);
      const yOnly = !this.isOnRoad(c.x, ny);
      if (xOnly && yOnly) {
        c.speed *= 0.8;
      } else if (xOnly) {
        c.y = ny;
        c.speed *= 0.88;
      } else if (yOnly) {
        c.x = nx;
        c.speed *= 0.88;
      } else {
        c.speed *= 0.85;
      }
    } else {
      c.x = nx;
      c.y = ny;
    }
  }

  private isOnRoad(x: number, y: number): boolean {
    const tx = Math.floor(x / TILE);
    const ty = Math.floor(y / TILE);
    if (tx < 0 || tx >= TRACK_W || ty < 0 || ty >= TRACK_H) return false;
    const t = TRACK_MAP[ty][tx];
    return t === 1 || t === 3;
  }

  private updateCheckpoints(c: Car): void {
    const curX = c.x;
    const curY = c.y;
    const finish = CHECKPOINT_GATES[0];
    const midGates = CHECKPOINT_GATES.slice(1);

    if (!c.leftStart) {
      const dx = curX - finish.x1;
      const dy = curY - (finish.y1 + finish.y2) / 2;
      if (Math.hypot(dx, dy) > 3 * TILE) c.leftStart = true;
    }
    if (!c.allMid && c.nextGate < midGates.length) {
      const gate = midGates[c.nextGate];
      if (this.crossed(c.prevX, c.prevY, curX, curY, gate)) {
        c.nextGate++;
        if (c.nextGate >= midGates.length) c.allMid = true;
      }
    }
    if (c.allMid && c.leftStart) {
      if (this.crossed(c.prevX, c.prevY, curX, curY, finish)) {
        c.lap++;
        if (c.lap >= TOTAL_LAPS) {
          c.finished = true;
          c.finishTime = this.now;
          audio.fanfare();
        } else {
          audio.select();
        }
        c.nextGate = 0;
        c.allMid = false;
        c.leftStart = false;
      }
    }
    c.prevX = curX;
    c.prevY = curY;
  }

  private crossed(ax1: number, ay1: number, ax2: number, ay2: number, g: Gate): boolean {
    const d1 = this.side(g.x1, g.y1, g.x2, g.y2, ax1, ay1);
    const d2 = this.side(g.x1, g.y1, g.x2, g.y2, ax2, ay2);
    const d3 = this.side(ax1, ay1, ax2, ay2, g.x1, g.y1);
    const d4 = this.side(ax1, ay1, ax2, ay2, g.x2, g.y2);
    return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
  }

  private side(ax: number, ay: number, bx: number, by: number, cx: number, cy: number): number {
    return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  }

  // ---- Power-up ----

  private updateBoxes(): void {
    for (const b of this.boxes) {
      if (!b.active) {
        if (this.now >= b.respawnAt) {
          b.active = true;
          b.rect.setVisible(true);
        }
        continue;
      }
      for (const c of this.cars) {
        if (c.held) continue;
        if (Math.hypot(c.x - b.x, c.y - b.y) < 40) {
          b.active = false;
          b.rect.setVisible(false);
          b.respawnAt = this.now + 5;
          c.held = POWERUPS[Math.floor(Math.random() * POWERUPS.length)];
          audio.correct();
        }
      }
    }
  }

  private usePowerUp(c: Car, type: string): void {
    c.held = null;
    audio.select();
    if (type === 'nitro') {
      c.nitroUntil = this.now + 2;
    } else if (type === 'shield') {
      c.shield = true;
    } else if (type === 'oil') {
      const ox = c.x - Math.cos(c.angle) * 40;
      const oy = c.y - Math.sin(c.angle) * 40;
      const circles = [this.add.circle(ox, oy, 30, 0x111111, 0.8).setDepth(3)];
      this.hazards.push({ type: 'oil', x: ox, y: oy, owner: c.id, until: this.now + 8, radius: 50, circles });
    } else if (type === 'tacks') {
      const bx = c.x - Math.cos(c.angle) * 40;
      const by = c.y - Math.sin(c.angle) * 40;
      const circles: Phaser.GameObjects.Arc[] = [];
      for (let i = 0; i < 6; i++) {
        const tx = bx + (Math.random() - 0.5) * 34;
        const ty = by + (Math.random() - 0.5) * 34;
        circles.push(this.add.circle(tx, ty, 5, 0xd1d5db, 1).setDepth(3));
      }
      this.hazards.push({ type: 'tacks', x: bx, y: by, owner: c.id, until: this.now + 10, radius: 50, circles });
    } else if (type === 'missile') {
      this.fireMissile(c);
    }
  }

  private fireMissile(c: Car): void {
    // Bersaglio: il leader (o il secondo se chi spara è primo)
    const others = this.cars.filter((x) => x.id !== c.id && !x.finished);
    if (others.length === 0) return;
    const target = [...others].sort((a, b) => this.progress(b) - this.progress(a))[0];
    const circle = this.add.circle(c.x, c.y, 8, 0xef4444, 1).setDepth(12);
    this.missiles.push({
      x: c.x + Math.cos(c.angle) * 30,
      y: c.y + Math.sin(c.angle) * 30,
      angle: c.angle,
      owner: c.id,
      target: target.id,
      dist: 0,
      circle
    });
  }

  private updateHazards(): void {
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const h = this.hazards[i];
      if (this.now >= h.until) {
        h.circles.forEach((s) => s.destroy());
        this.hazards.splice(i, 1);
        continue;
      }
      for (const c of this.cars) {
        if (c.id === h.owner || c.finished) continue;
        if (Math.hypot(c.x - h.x, c.y - h.y) < h.radius) {
          if (h.type === 'oil') c.spinUntil = this.now + 1.0;
          else c.slowUntil = this.now + 2;
          audio.wrong();
          h.circles.forEach((s) => s.destroy());
          this.hazards.splice(i, 1);
          break;
        }
      }
    }
  }

  private updateMissiles(dt: number): void {
    for (let i = this.missiles.length - 1; i >= 0; i--) {
      const m = this.missiles[i];
      const target = this.cars.find((c) => c.id === m.target);
      if (!target || target.finished) {
        m.circle.destroy();
        this.missiles.splice(i, 1);
        continue;
      }
      const toX = target.x - m.x;
      const toY = target.y - m.y;
      const targetAngle = Math.atan2(toY, toX);
      let diff = targetAngle - m.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      m.angle += diff * 3.0 * dt;

      m.x += Math.cos(m.angle) * 900 * dt;
      m.y += Math.sin(m.angle) * 900 * dt;
      m.dist += 900 * dt;
      m.circle.setPosition(m.x, m.y);

      if (m.dist >= 1200) {
        m.circle.destroy();
        this.missiles.splice(i, 1);
        continue;
      }
      for (const c of this.cars) {
        if (c.id === m.owner || c.finished) continue;
        if (Math.hypot(c.x - m.x, c.y - m.y) < 45) {
          if (c.shield) c.shield = false;
          else {
            c.speed *= 0.15;
            c.spinUntil = this.now + 1.2;
          }
          audio.wrong();
          m.circle.destroy();
          this.missiles.splice(i, 1);
          break;
        }
      }
    }
  }

  private updateCarVisual(c: Car): void {
    c.triangle.setPosition(c.x, c.y).setRotation(c.angle);
    const icon = c.held ? (c.held === 'nitro' ? '🚀' : c.held === 'shield' ? '🛡️' : c.held === 'oil' ? '🛢️' : c.held === 'missile' ? '🚀' : '📌') : '';
    c.label.setText(`${c.avatar} L${Math.min(c.lap + 1, TOTAL_LAPS)} ${icon}`).setPosition(c.x, c.y - 30);
  }

  private progress(c: Car): number {
    if (c.finished) return 1e9 - c.finishTime;
    const total = CHECKPOINT_GATES.length;
    return c.lap + (c.nextGate + (c.allMid ? CHECKPOINT_GATES.length - 1 : 0)) / total;
  }

  private rank(): void {
    const order = [...this.cars].sort((a, b) => this.progress(b) - this.progress(a));
    order.forEach((c, i) => {
      c.pos = i + 1;
    });
  }

  private endGame(): void {
    if (this.finished) return;
    this.finished = true;
    const sorted = [...this.cars].sort((a, b) => this.progress(b) - this.progress(a));
    const results = sorted.map((c, i) => ({ playerId: c.id, placement: i + 1, score: c.lap }));
    this.ctx.finish({ results });
  }
}
