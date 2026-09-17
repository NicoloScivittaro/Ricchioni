import Phaser from 'phaser';
import { audio } from '../../core/AudioManager';
import { PauseMenu } from '../../core/PauseMenu';
import type { MinigameContext } from '../types';
import type { PlayerId } from '../../../shared/types';

// Ispirato a Poro-Party (licenza ISC). Reimplementato come "chi colpisce di più".

const MIN_X = 40;
const MAX_X = 1240;
const MIN_Y = 90;
const MAX_Y = 560;
const PLAYER_R = 20;
const BALL_R = 13;
const SPEED = 360;
const GRAVITY = 750;
const BOUNCE = 0.82;

interface Body {
  id: PlayerId;
  x: number;
  y: number;
  avatar: string;
  circle: Phaser.GameObjects.Arc;
  label: Phaser.GameObjects.Text;
}

/** PALLAVOLO: colpisci la palla (movimento o tasto COLPO), chi la tocca segna. */
export class VolleyballScene extends Phaser.Scene {
  private ctx!: MinigameContext;
  private bodies: Body[] = [];
  private ball = { x: 640, y: 200, vx: 140, vy: -100 };
  private ballCircle!: Phaser.GameObjects.Arc;
  private hits = new Map<PlayerId, number>();
  private finished = false;
  private statusText!: Phaser.GameObjects.Text;
  private lowGravity = false;
  private pauseMenu!: PauseMenu;

  constructor() {
    super('volleyball');
  }

  create(data: { ctx: MinigameContext }): void {
    this.ctx = data.ctx;
    // RICOMINCIA riusa la stessa istanza di scena: azzera tutto lo stato custom.
    this.bodies = [];
    this.ball = { x: 640, y: 200, vx: 140, vy: -100 };
    this.hits = new Map();
    this.finished = false;

    audio.unlock();
    this.lowGravity = this.ctx.modifier?.id === 'gravita_bassa';
    this.cameras.main.setBackgroundColor('#0b1220');

    this.add.rectangle(640, 330, 1240, 520, 0x111c2e).setStrokeStyle(4, 0xffffff);
    this.add.rectangle(640, 330, 8, 520, 0xffffff).setAlpha(0.4); // rete

    this.add
      .text(640, 30, '🏐 PALLAVOLO DEI DISAGIATI', {
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

    this.ballCircle = this.add.circle(640, 200, BALL_R, 0xfbbf24).setStrokeStyle(2, 0x000000);

    this.time.delayedCall(this.ctx.durationSec * 1000, () => this.endGame());

    this.pauseMenu = new PauseMenu(this, '🏐 PALLAVOLO DEI DISAGIATI', this.ctx.input, () => this.scene.restart({ ctx: this.ctx }));
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

    this.ball.vy += (this.lowGravity ? GRAVITY * 0.45 : GRAVITY) * dt;
    this.ball.x += this.ball.vx * dt;
    this.ball.y += this.ball.vy * dt;

    if (this.ball.x < MIN_X) {
      this.ball.x = MIN_X;
      this.ball.vx = Math.abs(this.ball.vx);
    } else if (this.ball.x > MAX_X) {
      this.ball.x = MAX_X;
      this.ball.vx = -Math.abs(this.ball.vx);
    }
    if (this.ball.y < MIN_Y) {
      this.ball.y = MIN_Y;
      this.ball.vy = Math.abs(this.ball.vy);
    } else if (this.ball.y > MAX_Y) {
      this.ball.y = MAX_Y;
      this.ball.vy = -Math.abs(this.ball.vy) * BOUNCE;
      this.ball.vx *= 0.96;
    }

    for (const b of this.bodies) {
      const input = this.ctx.input.get(b.id);
      const dx = b.x - this.ball.x;
      const dy = b.y - this.ball.y;
      const dist = Math.hypot(dx, dy);
      const minDist = PLAYER_R + BALL_R;
      const wantHit = input.justPressed('action');

      if (dist > 0 && dist < minDist + 14) {
        const nx = dx / dist;
        const ny = dy / dist;
        this.ball.x -= nx * (minDist - dist);
        this.ball.y -= ny * (minDist - dist);
        this.ball.vx = -nx * 420;
        this.ball.vy = -ny * 420;
        this.hits.set(b.id, (this.hits.get(b.id) ?? 0) + 1);
        audio.tick();
      } else if (wantHit && dist < 130) {
        const nx = dx / dist;
        const ny = dy / dist;
        this.ball.vx = nx * 520;
        this.ball.vy = -Math.abs(ny) * 620 - 260;
        this.hits.set(b.id, (this.hits.get(b.id) ?? 0) + 1);
        audio.select();
      }
    }

    for (const b of this.bodies) {
      b.circle.setPosition(b.x, b.y);
      b.label.setPosition(b.x, b.y);
    }
    this.ballCircle.setPosition(this.ball.x, this.ball.y);

    const parts = this.ctx.playerIds
      .map((id) => `${this.ctx.players[this.ctx.playerIds.indexOf(id)].avatar} ${this.hits.get(id) ?? 0}`)
      .join('  ');
    this.statusText.setText(parts);

    this.ctx.input.update();
  }

  private endGame(): void {
    if (this.finished) return;
    this.finished = true;
    const sorted = [...this.ctx.playerIds].sort(
      (a, b) => (this.hits.get(b) ?? 0) - (this.hits.get(a) ?? 0)
    );
    const results = sorted.map((pid, i) => ({
      playerId: pid,
      placement: i + 1,
      score: this.hits.get(pid) ?? 0
    }));
    this.ctx.finish({ results });
  }
}
