import Phaser from 'phaser';
import { audio } from '../../core/AudioManager';
import type { MinigameContext } from '../types';
import type { PlayerId } from '../../../shared/types';
import type { Rng } from '../../../shared/rng';

// Ispirato a Pixel Rush (Amazon GameLift workshop, licenza MIT-0). Reimplementato
// per l'architettura host/controller: split-screen a colonne, gara equa sullo
// stesso tracciato, tap sinistra/destra + tasto oggetto dal telefono.

const LENGTH = 7000;
const BASE_SPEED = 300;
const LANES = 3;
const LANE_CHANGE_TIME = 0.16;
const LANE_TOLERANCE = 0.45;
const CAR_HALF = 14;
const OBSTACLE_HALF = 16;
const ITEM_HALF = 28;
const CRASH_SLOWDOWN = 0.35;
const CRASH_RECOVERY = 1.8;
const NITRO_DURATION = 3;
const NITRO_FACTOR = 1.4;
const SHIELD_DURATION = 4;
const PX_PER_UNIT = 1;
const CAR_Y = 610;

interface Obstacle {
  d: number;
  lane: number;
  speed: number;
}
interface ItemBox {
  d: number;
  lane: number;
}
interface Track {
  obstacles: Obstacle[];
  items: ItemBox[];
}

interface PRCar {
  id: PlayerId;
  avatar: string;
  colorNum: number;
  lane: number;
  laneF: number;
  d: number;
  item: '' | 'nitro' | 'scudo';
  nitroT: number;
  shieldT: number;
  slowT: number;
  taken: Set<number>;
  finished: boolean;
  finishTime: number;
  pos: number;
}

/** PIXEL RUSH: corsie, traffico, nitro e scudi. Vince chi arriva più lontano. */
export class PixelRushScene extends Phaser.Scene {
  private ctx!: MinigameContext;
  private track!: Track;
  private cars: PRCar[] = [];
  private gfx: Phaser.GameObjects.Graphics[] = [];
  private hud: Phaser.GameObjects.Text[] = [];
  private colW = 0;
  private elapsed = 0;
  private finished = false;

  constructor() {
    super('pixelrush');
  }

  create(data: { ctx: MinigameContext }): void {
    this.ctx = data.ctx;
    audio.unlock();
    this.cameras.main.setBackgroundColor('#0b0b14');
    this.track = this.genTrack(this.ctx.rng);

    const n = this.ctx.playerIds.length;
    this.colW = 1280 / n;

    this.ctx.players.forEach((p, i) => {
      const colX = i * this.colW;
      this.add
        .text(colX + this.colW / 2, 6, `${p.avatar} ${p.displayName}`, {
          fontFamily: '"Arial Black", Arial, sans-serif',
          fontSize: '16px',
          color: p.color
        })
        .setOrigin(0.5, 0);
      this.hud.push(
        this.add
          .text(colX + this.colW / 2, 26, '', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '14px',
            color: '#e5e7eb'
          })
          .setOrigin(0.5, 0)
      );
      this.gfx.push(this.add.graphics());
      this.cars.push({
        id: p.id,
        avatar: p.avatar,
        colorNum: Phaser.Display.Color.HexStringToColor(p.color).color,
        lane: 1,
        laneF: 1,
        d: 0,
        item: '',
        nitroT: 0,
        shieldT: 0,
        slowT: 0,
        taken: new Set<number>(),
        finished: false,
        finishTime: 0,
        pos: i + 1
      });
    });
  }

  update(_t: number, delta: number): void {
    if (this.finished) return;
    const dt = Math.min(delta, 50) / 1000;
    this.elapsed += dt;

    for (const c of this.cars) this.stepCar(c, dt);

    const order = [...this.cars].sort((a, b) => this.progress(b) - this.progress(a));
    order.forEach((c, i) => {
      c.pos = i + 1;
    });

    this.cars.forEach((c, i) => this.renderColumn(c, i));

    if (this.cars.every((c) => c.finished) || this.elapsed >= this.ctx.durationSec) {
      this.endGame();
    }

    this.ctx.input.update();
  }

  // ---- Simulazione (da Pixel Rush sim) ----

  private stepCar(c: PRCar, dt: number): void {
    if (c.finished) return;
    const input = this.ctx.input.get(c.id);

    if (input.justPressed('left')) c.lane = Math.max(0, c.lane - 1);
    if (input.justPressed('right')) c.lane = Math.min(LANES - 1, c.lane + 1);

    const slide = dt / LANE_CHANGE_TIME;
    const diff = c.lane - c.laneF;
    c.laneF = Math.abs(diff) <= slide ? c.lane : c.laneF + Math.sign(diff) * slide;

    if (c.nitroT > 0) c.nitroT -= dt;
    if (c.shieldT > 0) c.shieldT -= dt;
    if (c.slowT > 0) c.slowT -= dt;

    if (input.justPressed('action') && c.item) {
      if (c.item === 'nitro') c.nitroT = NITRO_DURATION;
      else c.shieldT = SHIELD_DURATION;
      audio.select();
      c.item = '';
    }

    let speed = BASE_SPEED;
    if (c.nitroT > 0) speed *= NITRO_FACTOR;
    if (c.slowT > 0) {
      const frac = 1 - c.slowT / CRASH_RECOVERY;
      speed *= CRASH_SLOWDOWN + (1 - CRASH_SLOWDOWN) * frac;
    }

    const oldD = c.d;
    c.d += speed * dt;

    if (c.slowT <= 0 && c.shieldT <= 0) {
      for (const o of this.track.obstacles) {
        if (Math.abs(c.laneF - o.lane) > LANE_TOLERANCE) continue;
        const od = this.obstacleD(o);
        if (c.d + CAR_HALF > od - OBSTACLE_HALF && oldD - CAR_HALF < od + OBSTACLE_HALF) {
          c.slowT = CRASH_RECOVERY;
          c.d = od - OBSTACLE_HALF - CAR_HALF;
          audio.wrong();
          break;
        }
      }
    }

    for (let i = 0; i < this.track.items.length; i++) {
      const it = this.track.items[i];
      if (it.lane !== Math.round(c.laneF)) continue;
      if (c.taken.has(i)) continue;
      if (Math.abs(c.d - it.d) < ITEM_HALF + CAR_HALF) {
        c.taken.add(i);
        c.item = this.ctx.rng.chance(0.5) ? 'nitro' : 'scudo';
        audio.correct();
      }
    }

    if (c.d >= LENGTH) {
      c.finished = true;
      c.finishTime = this.elapsed;
      audio.fanfare();
    }
  }

  private obstacleD(o: Obstacle): number {
    if (o.speed <= 0) return o.d;
    return (o.d + o.speed * this.elapsed) % (LENGTH + 400);
  }

  private progress(c: PRCar): number {
    return c.finished ? 1e9 - c.finishTime : c.d;
  }

  // ---- Rendering per colonna ----

  private renderColumn(c: PRCar, idx: number): void {
    const g = this.gfx[idx];
    g.clear();

    const colX = idx * this.colW;
    const roadX = colX + 6;
    const roadW = this.colW - 12;
    const laneW = roadW / LANES;

    g.fillStyle(0x1b2430, 1);
    g.fillRect(roadX, 0, roadW, 720);

    // Bordi strada
    g.lineStyle(3, 0x475569, 1);
    g.lineBetween(roadX, 0, roadX, 720);
    g.lineBetween(roadX + roadW, 0, roadX + roadW, 720);

    // Linee di corsia tratteggiate (scorrono)
    g.lineStyle(2, 0x64748b, 0.8);
    const offset = (c.d * PX_PER_UNIT) % 64;
    for (let l = 1; l < LANES; l++) {
      const x = roadX + l * laneW;
      for (let y = -64 + offset; y < 720; y += 64) {
        g.lineBetween(x, y, x, y + 34);
      }
    }

    // Traguardo
    if (LENGTH - c.d < 700) {
      const fy = CAR_Y - (LENGTH - c.d) * PX_PER_UNIT;
      if (fy > -20 && fy < 740) {
        g.fillStyle(0xffffff, 0.85);
        g.fillRect(roadX, fy - 6, roadW, 12);
      }
    }

    // Ostacoli
    for (const o of this.track.obstacles) {
      const y = CAR_Y - (this.obstacleD(o) - c.d) * PX_PER_UNIT;
      if (y < -50 || y > 750) continue;
      const x = roadX + (o.lane + 0.5) * laneW;
      g.fillStyle(o.speed !== 0 ? 0xf97316 : 0xef4444, 1);
      g.fillRect(x - OBSTACLE_HALF, y - OBSTACLE_HALF, OBSTACLE_HALF * 2, OBSTACLE_HALF * 2);
      g.lineStyle(2, 0x111827, 1);
      g.strokeRect(x - OBSTACLE_HALF, y - OBSTACLE_HALF, OBSTACLE_HALF * 2, OBSTACLE_HALF * 2);
    }

    // Oggetti
    for (let i = 0; i < this.track.items.length; i++) {
      if (c.taken.has(i)) continue;
      const it = this.track.items[i];
      const y = CAR_Y - (it.d - c.d) * PX_PER_UNIT;
      if (y < -40 || y > 750) continue;
      const x = roadX + (it.lane + 0.5) * laneW;
      g.fillStyle(0xfbbf24, 1);
      g.fillRect(x - ITEM_HALF / 2, y - ITEM_HALF / 2, ITEM_HALF, ITEM_HALF);
      g.lineStyle(2, 0x000000, 0.6);
      g.strokeRect(x - ITEM_HALF / 2, y - ITEM_HALF / 2, ITEM_HALF, ITEM_HALF);
    }

    // Auto del giocatore
    const carX = roadX + (c.laneF + 0.5) * laneW;
    g.fillStyle(c.colorNum, 1);
    g.fillRect(carX - 14, CAR_Y - 22, 28, 44);
    g.fillStyle(0x0b0b14, 1);
    g.fillRect(carX - 9, CAR_Y - 14, 18, 14);

    if (c.nitroT > 0) {
      g.fillStyle(0x60a5fa, 1);
      g.fillRect(carX - 8, CAR_Y + 22, 16, 16);
    }
    if (c.shieldT > 0) {
      g.lineStyle(3, 0x60a5fa, 0.9);
      g.strokeRect(carX - 19, CAR_Y - 27, 38, 54);
    }
    if (c.slowT > 0) {
      g.fillStyle(0xf87171, 0.45);
      g.fillRect(carX - 16, CAR_Y - 24, 32, 48);
    }

    const itemIcon = c.item === 'nitro' ? '🚀' : c.item === 'scudo' ? '🛡️' : '';
    this.hud[idx].setText(
      `${c.pos}° · ${Math.floor(c.d)}m ${c.finished ? '🏁' : ''} ${itemIcon}`.trim()
    );
  }

  // ---- Tracciato procedurale ----

  private genTrack(rng: Rng): Track {
    const obstacles: Obstacle[] = [];
    let d = 700;
    while (d < LENGTH - 400) {
      const lane = rng.int(0, LANES - 1);
      const moving = rng.chance(0.22);
      obstacles.push({
        d,
        lane,
        speed: moving ? rng.int(40, 90) * (rng.chance(0.5) ? 1 : -1) : 0
      });
      if (rng.chance(0.4)) {
        let other = rng.int(0, LANES - 1);
        if (other === lane) other = (lane + 1) % LANES;
        obstacles.push({ d: d + rng.int(-30, 30), lane: other, speed: 0 });
      }
      d += rng.int(220, 430);
    }

    const items: ItemBox[] = [];
    for (let i = 0; i < 9; i++) {
      items.push({
        d: 900 + (i * (LENGTH - 1400)) / 9 + rng.int(-120, 120),
        lane: rng.int(0, LANES - 1)
      });
    }

    return { obstacles, items };
  }

  private endGame(): void {
    if (this.finished) return;
    this.finished = true;
    const sorted = [...this.cars].sort((a, b) => this.progress(b) - this.progress(a));
    const results = sorted.map((c, i) => ({
      playerId: c.id,
      placement: i + 1,
      score: Math.floor(c.d)
    }));
    this.ctx.finish({ results });
  }
}
