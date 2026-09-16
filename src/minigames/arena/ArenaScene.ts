import Phaser from 'phaser';
import { audio } from '../../core/AudioManager';
import type { MinigameContext } from '../types';
import type { PlayerId } from '../../../shared/types';

const CENTER_X = 640;
const CENTER_Y = 360;
const ARENA_R = 290;
const PLAYER_R = 26;
const ACCEL = 1100;
const MAX_SPEED = 300;
const FRICTION = 0.9;

interface Body {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  alive: boolean;
  avatar: string;
  circle: Phaser.GameObjects.Arc;
  label: Phaser.GameObjects.Text;
}

/**
 * ARENA DEL DISAGIO — sumo: spingi gli altri fuori dal cerchio.
 * Supporta il modificatore "controlli invertiti".
 */
export class ArenaScene extends Phaser.Scene {
  private ctx!: MinigameContext;
  private bodies: Body[] = [];
  private finished = false;
  private eliminationOrder: PlayerId[] = [];
  private statusText!: Phaser.GameObjects.Text;
  private invert = false;

  constructor() {
    super('arena');
  }

  create(data: { ctx: MinigameContext }): void {
    this.ctx = data.ctx;
    audio.unlock();
    this.invert = this.ctx.modifier?.id === 'controlli_invertiti';
    this.cameras.main.setBackgroundColor('#111827');

    this.add.circle(CENTER_X, CENTER_Y, ARENA_R, 0x1f2937).setStrokeStyle(6, 0xffffff);
    this.add
      .text(640, 40, '🤼 ARENA DEL DISAGIO', {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: '48px',
        color: '#ffffff'
      })
      .setOrigin(0.5);
    this.statusText = this.add
      .text(640, 92, '', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '22px',
        color: '#9ca3af'
      })
      .setOrigin(0.5);
    if (this.invert) {
      this.statusText.setText('CONTROLLI INVERTITI!').setColor('#f87171');
    }

    const n = this.ctx.playerIds.length;
    this.ctx.players.forEach((p, i) => {
      const ang = (Math.PI * 2 * i) / n - Math.PI / 2;
      const dist = ARENA_R * 0.55;
      const x = CENTER_X + Math.cos(ang) * dist;
      const y = CENTER_Y + Math.sin(ang) * dist;
      const color = Phaser.Display.Color.HexStringToColor(p.color).color;
      const circle = this.add.circle(x, y, PLAYER_R, color).setStrokeStyle(3, 0xffffff);
      const label = this.add.text(x, y, p.avatar, { fontFamily: 'Arial, sans-serif', fontSize: '22px' }).setOrigin(0.5);
      this.bodies.push({ id: p.id, x, y, vx: 0, vy: 0, alive: true, avatar: p.avatar, circle, label });
    });

    this.time.delayedCall(this.ctx.durationSec * 1000, () => this.endGame());
  }

  update(_time: number, delta: number): void {
    if (this.finished) return;
    const dt = Math.min(delta, 50) / 1000;

    for (const b of this.bodies) {
      if (!b.alive) continue;
      const input = this.ctx.input.get(b.id);
      let left = input.pressed('left');
      let right = input.pressed('right');
      let up = input.pressed('up');
      let down = input.pressed('down');
      if (this.invert) {
        [left, right] = [right, left];
        [up, down] = [down, up];
      }

      let ax = 0;
      let ay = 0;
      if (left) ax -= 1;
      if (right) ax += 1;
      if (up) ay -= 1;
      if (down) ay += 1;

      const len = Math.hypot(ax, ay) || 1;
      b.vx += (ax / len) * ACCEL * dt;
      b.vy += (ay / len) * ACCEL * dt;
      b.vx *= FRICTION;
      b.vy *= FRICTION;
      const sp = Math.hypot(b.vx, b.vy);
      if (sp > MAX_SPEED) {
        b.vx = (b.vx / sp) * MAX_SPEED;
        b.vy = (b.vy / sp) * MAX_SPEED;
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      if (Math.hypot(b.x - CENTER_X, b.y - CENTER_Y) > ARENA_R) {
        b.alive = false;
        this.eliminationOrder.push(b.id);
        b.circle.setVisible(false);
        b.label.setVisible(false);
        audio.wrong();
      }
    }

    // Collisioni tra corpi vivi
    const alive = this.bodies.filter((b) => b.alive);
    for (let i = 0; i < alive.length; i++) {
      for (let j = i + 1; j < alive.length; j++) {
        const a = alive[i];
        const c = alive[j];
        const dx = c.x - a.x;
        const dy = c.y - a.y;
        const dist = Math.hypot(dx, dy);
        const minDist = PLAYER_R * 2;
        if (dist > 0 && dist < minDist) {
          const overlap = (minDist - dist) / 2;
          const nx = dx / dist;
          const ny = dy / dist;
          a.x -= nx * overlap;
          a.y -= ny * overlap;
          c.x += nx * overlap;
          c.y += ny * overlap;
          const relAlong = (c.vx - a.vx) * nx + (c.vy - a.vy) * ny;
          if (relAlong < 0) {
            const impulse = -relAlong * 0.9;
            a.vx -= nx * impulse;
            a.vy -= ny * impulse;
            c.vx += nx * impulse;
            c.vy += ny * impulse;
          }
        }
      }
    }

    for (const b of this.bodies) {
      if (b.alive) {
        b.circle.setPosition(b.x, b.y);
        b.label.setPosition(b.x, b.y);
      }
    }

    const remaining = this.bodies.filter((b) => b.alive);
    if (!this.invert) this.statusText.setText(`Spingi gli altri fuori! — in gioco: ${remaining.length}`);
    if (remaining.length <= 1) {
      this.endGame();
    }

    this.ctx.input.update();
  }

  private endGame(): void {
    if (this.finished) return;
    this.finished = true;

    const alive = this.bodies
      .filter((b) => b.alive)
      .sort(
        (a, b) =>
          Math.hypot(a.x - CENTER_X, a.y - CENTER_Y) - Math.hypot(b.x - CENTER_X, b.y - CENTER_Y)
      );
    const eliminated = this.eliminationOrder.slice().reverse();
    const aliveIds = alive.map((b) => b.id);
    const ranking = [...aliveIds, ...eliminated.filter((id) => !aliveIds.includes(id))];

    const results = ranking.map((pid, i) => ({ playerId: pid, placement: i + 1, score: 0 }));
    this.ctx.finish({ results });
  }
}
