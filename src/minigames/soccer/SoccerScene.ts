import Phaser from 'phaser';
import { audio } from '../../core/AudioManager';
import { PauseMenu } from '../../core/PauseMenu';
import type { MinigameContext } from '../types';
import type { PlayerId } from '../../../shared/types';

// Ispirato a Poro-Party (licenza ISC). Reimplementato come "chi segna di più".

const MIN_X = 40;
const MAX_X = 1240;
const MIN_Y = 90;
const MAX_Y = 570;
const PLAYER_R = 20;
const BALL_R = 13;
const SPEED = 340;
const GOAL_Y_MIN = 280;
const GOAL_Y_MAX = 500;
const GOAL_EDGE = 70;
const WIN_SCORE = 3;

interface Body {
  id: PlayerId;
  x: number;
  y: number;
  avatar: string;
  circle: Phaser.GameObjects.Arc;
  label: Phaser.GameObjects.Text;
}

/** CALCIO: spingi la palla in porta; segna chi l'ha toccata per ultimo. */
export class SoccerScene extends Phaser.Scene {
  private ctx!: MinigameContext;
  private bodies: Body[] = [];
  private ball = { x: 640, y: 330, vx: 0, vy: 0 };
  private ballCircle!: Phaser.GameObjects.Arc;
  private lastToucher: PlayerId | null = null;
  private goals = new Map<PlayerId, number>();
  private finished = false;
  private statusText!: Phaser.GameObjects.Text;
  private pauseMenu!: PauseMenu;

  constructor() {
    super('soccer');
  }

  create(data: { ctx: MinigameContext }): void {
    this.ctx = data.ctx;
    // RICOMINCIA riusa la stessa istanza di scena: azzera tutto lo stato custom.
    this.bodies = [];
    this.ball = { x: 640, y: 330, vx: 0, vy: 0 };
    this.lastToucher = null;
    this.goals = new Map();
    this.finished = false;

    audio.unlock();
    this.cameras.main.setBackgroundColor('#0a120a');

    this.add.rectangle(640, 330, 1240, 520, 0x1a2e1a).setStrokeStyle(4, 0xffffff);
    this.add.rectangle(20, 390, 40, 220, 0x7f1d1d).setStrokeStyle(3, 0xffffff);
    this.add.rectangle(1260, 390, 40, 220, 0x1d4ed8).setStrokeStyle(3, 0xffffff);

    this.add
      .text(640, 30, '⚽ CALCIO DEI DISAGIATI', {
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
      const label = this.add.text(x, y, p.avatar, { fontFamily: 'Arial, sans-serif', fontSize: '18px' }).setOrigin(0.5);
      this.bodies.push({ id: p.id, x, y, avatar: p.avatar, circle, label });
    });

    this.ballCircle = this.add.circle(640, 330, BALL_R, 0xffffff).setStrokeStyle(2, 0x000000);

    this.time.delayedCall(this.ctx.durationSec * 1000, () => this.endGame());

    this.pauseMenu = new PauseMenu(this, '⚽ CALCIO DEI DISAGIATI', this.ctx.input, () => this.scene.restart({ ctx: this.ctx }));
  }

  update(_t: number, delta: number): void {
    if (this.pauseMenu.update()) return;
    if (this.finished) return;
    const dt = Math.min(delta, 50) / 1000;

    for (const b of this.bodies) {
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

    this.ball.vx *= 0.995;
    this.ball.vy *= 0.995;
    this.ball.x += this.ball.vx * dt;
    this.ball.y += this.ball.vy * dt;

    if (this.ball.y < MIN_Y) {
      this.ball.y = MIN_Y;
      this.ball.vy = Math.abs(this.ball.vy);
    } else if (this.ball.y > MAX_Y) {
      this.ball.y = MAX_Y;
      this.ball.vy = -Math.abs(this.ball.vy);
    }

    // Porte
    if (this.ball.x < GOAL_EDGE && this.inGoal(this.ball.y)) this.score('left');
    else if (this.ball.x > MAX_X - GOAL_EDGE && this.inGoal(this.ball.y)) this.score('right');
    else {
      if (this.ball.x < MIN_X) {
        this.ball.x = MIN_X;
        this.ball.vx = Math.abs(this.ball.vx);
      } else if (this.ball.x > MAX_X) {
        this.ball.x = MAX_X;
        this.ball.vx = -Math.abs(this.ball.vx);
      }
    }

    // Spinta palla
    for (const b of this.bodies) {
      const dx = b.x - this.ball.x;
      const dy = b.y - this.ball.y;
      const dist = Math.hypot(dx, dy);
      const minDist = PLAYER_R + BALL_R;
      if (dist > 0 && dist < minDist) {
        const nx = dx / dist;
        const ny = dy / dist;
        this.ball.x -= nx * (minDist - dist);
        this.ball.y -= ny * (minDist - dist);
        this.ball.vx -= nx * 320;
        this.ball.vy -= ny * 320;
        this.lastToucher = b.id;
        audio.tick();
      }
    }

    const sp = Math.hypot(this.ball.vx, this.ball.vy);
    if (sp > 600) {
      this.ball.vx = (this.ball.vx / sp) * 600;
      this.ball.vy = (this.ball.vy / sp) * 600;
    }

    for (const b of this.bodies) {
      b.circle.setPosition(b.x, b.y);
      b.label.setPosition(b.x, b.y);
    }
    this.ballCircle.setPosition(this.ball.x, this.ball.y);

    const parts = this.ctx.playerIds
      .map((id) => `${this.ctx.players[this.ctx.playerIds.indexOf(id)].avatar} ${this.goals.get(id) ?? 0}`)
      .join('  ');
    this.statusText.setText(parts);

    this.ctx.input.update();
  }

  private inGoal(y: number): boolean {
    return y > GOAL_Y_MIN && y < GOAL_Y_MAX;
  }

  private score(_side: 'left' | 'right'): void {
    if (this.lastToucher) {
      this.goals.set(this.lastToucher, (this.goals.get(this.lastToucher) ?? 0) + 1);
      audio.correct();
      if ((this.goals.get(this.lastToucher) ?? 0) >= WIN_SCORE) {
        this.endGame();
        return;
      }
    }
    this.ball.x = 640;
    this.ball.y = 330;
    this.ball.vx = 0;
    this.ball.vy = 0;
    this.lastToucher = null;
  }

  private endGame(): void {
    if (this.finished) return;
    this.finished = true;
    const sorted = [...this.ctx.playerIds].sort(
      (a, b) => (this.goals.get(b) ?? 0) - (this.goals.get(a) ?? 0)
    );
    const results = sorted.map((pid, i) => ({
      playerId: pid,
      placement: i + 1,
      score: this.goals.get(pid) ?? 0
    }));
    this.ctx.finish({ results });
  }
}
