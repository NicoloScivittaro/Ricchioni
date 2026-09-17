import Phaser from 'phaser';
import { audio } from '../../core/AudioManager';
import { PauseMenu } from '../../core/PauseMenu';
import type { MinigameContext } from '../types';
import type { PlayerId } from '../../../shared/types';

// Ispirato a Poro-Party (licenza ISC). Reimplementato per il modello host/controller.

const MIN_X = 40;
const MAX_X = 1240;
const MIN_Y = 100;
const MAX_Y = 570;
const PLAYER_R = 22;
const BALL_R = 12;
const SPEED = 360;
const BALL_SPEED = 380;

interface Body {
  id: PlayerId;
  x: number;
  y: number;
  alive: boolean;
  avatar: string;
  circle: Phaser.GameObjects.Arc;
  label: Phaser.GameObjects.Text;
}
interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  circle: Phaser.GameObjects.Arc;
}

/** DODGEBALL: schiva le palle, chi viene colpito è fuori. Vince l'ultimo in piedi. */
export class DodgeballScene extends Phaser.Scene {
  private ctx!: MinigameContext;
  private bodies: Body[] = [];
  private balls: Ball[] = [];
  private eliminationOrder: PlayerId[] = [];
  private finished = false;
  private statusText!: Phaser.GameObjects.Text;
  private pauseMenu!: PauseMenu;

  constructor() {
    super('dodgeball');
  }

  create(data: { ctx: MinigameContext }): void {
    this.ctx = data.ctx;
    // RICOMINCIA riusa la stessa istanza di scena: azzera tutto lo stato custom.
    this.bodies = [];
    this.balls = [];
    this.eliminationOrder = [];
    this.finished = false;

    audio.unlock();
    this.cameras.main.setBackgroundColor('#0c0f1d');

    this.add.rectangle(640, 335, 1240, 520, 0x111827).setStrokeStyle(4, 0xffffff);
    this.add
      .text(640, 30, '🎯 DODGEBALL DEI COGLIONI', {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: '46px',
        color: '#ffffff'
      })
      .setOrigin(0.5);
    this.statusText = this.add
      .text(640, 80, '', { fontFamily: 'Arial, sans-serif', fontSize: '22px', color: '#9ca3af' })
      .setOrigin(0.5);

    const n = this.ctx.playerIds.length;
    this.ctx.players.forEach((p, i) => {
      const x = MIN_X + ((MAX_X - MIN_X) * (i + 1)) / (n + 1);
      const y = MAX_Y - 30;
      const color = Phaser.Display.Color.HexStringToColor(p.color).color;
      const circle = this.add.circle(x, y, PLAYER_R, color).setStrokeStyle(3, 0xffffff);
      const label = this.add.text(x, y, p.avatar, { fontFamily: 'Arial, sans-serif', fontSize: '20px' }).setOrigin(0.5);
      this.bodies.push({ id: p.id, x, y, alive: true, avatar: p.avatar, circle, label });
    });

    const ballColors = [0xf87171, 0xfbbf24, 0x60a5fa];
    for (let i = 0; i < 3; i++) {
      const ang = Math.random() * Math.PI * 2;
      const circle = this.add.circle(640, 250, BALL_R, ballColors[i]).setStrokeStyle(2, 0xffffff);
      this.balls.push({ x: 640, y: 250, vx: Math.cos(ang) * BALL_SPEED, vy: Math.sin(ang) * BALL_SPEED, circle });
    }

    this.time.delayedCall(this.ctx.durationSec * 1000, () => this.endGame());

    this.pauseMenu = new PauseMenu(this, '🎯 DODGEBALL DEI COGLIONI', this.ctx.input, () => this.scene.restart({ ctx: this.ctx }));
  }

  update(_t: number, delta: number): void {
    if (this.pauseMenu.update()) return;
    if (this.finished) return;
    const dt = Math.min(delta, 50) / 1000;

    for (const b of this.bodies) {
      if (!b.alive) continue;
      const input = this.ctx.input.get(b.id);
      let ax = 0;
      let ay = 0;
      if (input.pressed('left')) ax -= 1;
      if (input.pressed('right')) ax += 1;
      if (input.pressed('up')) ay -= 1;
      if (input.pressed('down')) ay += 1;
      const len = Math.hypot(ax, ay) || 1;
      b.x += (ax / len) * SPEED * dt;
      b.y += (ay / len) * SPEED * dt;
      b.x = Phaser.Math.Clamp(b.x, MIN_X, MAX_X);
      b.y = Phaser.Math.Clamp(b.y, MIN_Y, MAX_Y);
    }

    for (const ball of this.balls) {
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;
      if (ball.x < MIN_X) {
        ball.x = MIN_X;
        ball.vx = Math.abs(ball.vx);
      } else if (ball.x > MAX_X) {
        ball.x = MAX_X;
        ball.vx = -Math.abs(ball.vx);
      }
      if (ball.y < MIN_Y) {
        ball.y = MIN_Y;
        ball.vy = Math.abs(ball.vy);
      } else if (ball.y > MAX_Y) {
        ball.y = MAX_Y;
        ball.vy = -Math.abs(ball.vy);
      }
    }

    for (const b of this.bodies) {
      if (!b.alive) continue;
      for (const ball of this.balls) {
        const dx = b.x - ball.x;
        const dy = b.y - ball.y;
        const dist = Math.hypot(dx, dy);
        const minDist = PLAYER_R + BALL_R;
        if (dist > 0 && dist < minDist) {
          b.alive = false;
          this.eliminationOrder.push(b.id);
          b.circle.setVisible(false);
          b.label.setVisible(false);
          audio.wrong();
          const nx = dx / dist;
          const ny = dy / dist;
          const dot = ball.vx * nx + ball.vy * ny;
          ball.vx -= 2 * dot * nx;
          ball.vy -= 2 * dot * ny;
          ball.x += nx * (minDist - dist);
          ball.y += ny * (minDist - dist);
          break;
        }
      }
    }

    for (const b of this.bodies) {
      if (b.alive) {
        b.circle.setPosition(b.x, b.y);
        b.label.setPosition(b.x, b.y);
      }
    }
    for (const ball of this.balls) ball.circle.setPosition(ball.x, ball.y);

    const alive = this.bodies.filter((b) => b.alive);
    this.statusText.setText(`In gioco: ${alive.length}`);
    if (alive.length <= 1) this.endGame();

    this.ctx.input.update();
  }

  private endGame(): void {
    if (this.finished) return;
    this.finished = true;
    const alive = this.bodies.filter((b) => b.alive);
    const eliminated = this.eliminationOrder.slice().reverse();
    const ranking = [...alive.map((b) => b.id), ...eliminated.filter((id) => !alive.some((b) => b.id === id))];
    const results = ranking.map((pid, i) => ({ playerId: pid, placement: i + 1, score: 0 }));
    this.ctx.finish({ results });
  }
}
