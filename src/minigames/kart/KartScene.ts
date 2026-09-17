import Phaser from 'phaser';
import { audio } from '../../core/AudioManager';
import { PauseMenu } from '../../core/PauseMenu';
import type { MinigameContext } from '../types';
import type { PlayerId } from '../../../shared/types';

// Mario-Kart-like top-down, ispirato al concept (reimplementato per host/controller).

const CX = 640;
const CY = 360;
const OUTER_RX = 500;
const OUTER_RY = 230;
const INNER_RX = 265;
const INNER_RY = 110;
const KART_R = 15;
const ACCEL = 440;
const BRAKE = 520;
const REVERSE_MAX = -130;
const MAX_SPEED = 340;
const DRAG = 0.55;
const STEER = 2.8;
const LAPS = 3;
const TURBO_MS = 1300;
const BOX_R = 16;

interface Kart {
  id: PlayerId;
  x: number;
  y: number;
  angle: number;
  speed: number;
  lastAngle: number;
  accAngle: number;
  lap: number;
  finished: boolean;
  turboUntil: number;
  avatar: string;
  triangle: Phaser.GameObjects.Triangle;
  label: Phaser.GameObjects.Text;
}

interface Box {
  x: number;
  y: number;
  active: boolean;
  circle: Phaser.GameObjects.Arc;
}

/** KART DEI COGLIONI: pista a anello, 3 giri, turbo dai box. */
export class KartScene extends Phaser.Scene {
  private ctx!: MinigameContext;
  private karts: Kart[] = [];
  private boxes: Box[] = [];
  private finishOrder: PlayerId[] = [];
  private finished = false;
  private invert = false;
  private hudText!: Phaser.GameObjects.Text;
  private pauseMenu!: PauseMenu;

  constructor() {
    super('kart');
  }

  create(data: { ctx: MinigameContext }): void {
    this.ctx = data.ctx;
    // RICOMINCIA riusa la stessa istanza di scena: azzera tutto lo stato custom.
    this.karts = [];
    this.boxes = [];
    this.finishOrder = [];
    this.finished = false;

    audio.unlock();
    this.invert = this.ctx.modifier?.id === 'controlli_invertiti';
    this.cameras.main.setBackgroundColor('#0b1a0b');

    // Pista (anello ellittico)
    this.add.ellipse(CX, CY, OUTER_RX * 2, OUTER_RY * 2, 0x2f3b2f).setStrokeStyle(6, 0xffffff);
    this.add.ellipse(CX, CY, INNER_RX * 2, INNER_RY * 2, 0x12240f).setStrokeStyle(4, 0xffffff);
    // Linea di partenza (in alto)
    this.add
      .rectangle(CX, CY - (INNER_RY + OUTER_RY) / 2, 10, OUTER_RY - INNER_RY, 0xffffff)
      .setAlpha(0.85);

    this.add
      .text(640, 28, '🏎️ KART DEI COGLIONI', {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: '44px',
        color: '#ffffff'
      })
      .setOrigin(0.5);
    this.add
      .text(640, 72, '▲ gas · ▼ freno · ◀ ▶ sterza · box gialli = turbo', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '18px',
        color: '#9ca3af'
      })
      .setOrigin(0.5);
    this.hudText = this.add
      .text(640, 680, '', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '18px',
        color: '#e5e7eb'
      })
      .setOrigin(0.5);

    const n = this.ctx.playerIds.length;
    this.ctx.players.forEach((p, i) => {
      const offset = (i - (n - 1) / 2) * 42;
      const x = CX + offset;
      const y = CY - (INNER_RY + OUTER_RY) / 2;
      const color = Phaser.Display.Color.HexStringToColor(p.color).color;
      const triangle = this.add
        .triangle(x, y, 16, 0, -12, 12, -12, -12, color)
        .setStrokeStyle(2, 0xffffff);
      const label = this.add.text(x, y - 28, p.avatar, { fontFamily: 'Arial, sans-serif', fontSize: '16px' }).setOrigin(0.5);
      this.karts.push({
        id: p.id,
        x,
        y,
        angle: 0,
        speed: 0,
        lastAngle: 0,
        accAngle: 0,
        lap: 0,
        finished: false,
        turboUntil: 0,
        avatar: p.avatar,
        triangle,
        label
      });
    });

    const boxAngles = [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4];
    for (const a of boxAngles) {
      const bx = CX + Math.cos(a) * ((INNER_RX + OUTER_RX) / 2);
      const by = CY + Math.sin(a) * ((INNER_RY + OUTER_RY) / 2);
      const circle = this.add.circle(bx, by, BOX_R, 0xfbbf24).setStrokeStyle(2, 0x000000);
      this.boxes.push({ x: bx, y: by, active: true, circle });
    }

    this.time.delayedCall(this.ctx.durationSec * 1000, () => this.endGame());

    this.pauseMenu = new PauseMenu(this, '🏎️ KART DEI COGLIONI', this.ctx.input, () => this.scene.restart({ ctx: this.ctx }));
  }

  update(_t: number, delta: number): void {
    if (this.pauseMenu.update()) return;
    if (this.finished) return;
    const dt = Math.min(delta, 50) / 1000;
    const now = this.time.now;

    for (const k of this.karts) {
      if (k.finished) continue;
      const input = this.ctx.input.get(k.id);

      let left = input.pressed('left');
      let right = input.pressed('right');
      if (this.invert) [left, right] = [right, left];
      const up = input.pressed('up');
      const down = input.pressed('down');

      const turbo = now < k.turboUntil;
      const maxSpeed = turbo ? MAX_SPEED * 1.65 : MAX_SPEED;
      const accel = turbo ? ACCEL * 1.6 : ACCEL;

      if (up) k.speed += accel * dt;
      else if (down) k.speed -= (k.speed > 0 ? BRAKE : BRAKE * 0.6) * dt;
      else k.speed *= 1 - DRAG * dt;

      k.speed = Phaser.Math.Clamp(k.speed, REVERSE_MAX, maxSpeed);

      const steerAmt = STEER * dt * (0.4 + (0.6 * Math.abs(k.speed)) / MAX_SPEED);
      const dir = k.speed >= 0 ? 1 : -1;
      if (left) k.angle -= steerAmt * dir;
      if (right) k.angle += steerAmt * dir;

      k.x += Math.cos(k.angle) * k.speed * dt;
      k.y += Math.sin(k.angle) * k.speed * dt;

      // Muri (ellissi interna/esterna)
      const dx = k.x - CX;
      const dy = k.y - CY;
      const uOuter = (dx * dx) / (OUTER_RX * OUTER_RX) + (dy * dy) / (OUTER_RY * OUTER_RY);
      if (uOuter > 1) {
        const s = Math.sqrt(uOuter);
        k.x = CX + dx / s;
        k.y = CY + dy / s;
        k.speed *= 0.65;
        audio.tick();
      }
      const uInner = (dx * dx) / (INNER_RX * INNER_RX) + (dy * dy) / (INNER_RY * INNER_RY);
      if (uInner < 1) {
        const s = Math.sqrt(uInner) || 0.0001;
        k.x = CX + dx / s;
        k.y = CY + dy / s;
        k.speed *= 0.65;
      }

      // Conteggio giri
      const a = Math.atan2(k.y - CY, k.x - CX);
      let d = a - k.lastAngle;
      if (d > Math.PI) d -= 2 * Math.PI;
      else if (d < -Math.PI) d += 2 * Math.PI;
      k.accAngle += d;
      k.lastAngle = a;
      if (k.accAngle >= 2 * Math.PI) {
        k.lap += 1;
        k.accAngle -= 2 * Math.PI;
        audio.select();
      } else if (k.accAngle <= -2 * Math.PI) {
        k.lap += 1;
        k.accAngle += 2 * Math.PI;
        audio.select();
      }

      if (k.lap >= LAPS && !k.finished) {
        k.finished = true;
        this.finishOrder.push(k.id);
        audio.fanfare();
      }

      // Box turbo
      for (const box of this.boxes) {
        if (!box.active) continue;
        if (Math.hypot(k.x - box.x, k.y - box.y) < KART_R + BOX_R) {
          box.active = false;
          box.circle.setVisible(false);
          k.turboUntil = now + TURBO_MS;
          audio.correct();
          this.time.delayedCall(4000, () => {
            box.active = true;
            box.circle.setVisible(true);
          });
        }
      }

      k.triangle.setPosition(k.x, k.y).setRotation(k.angle);
      k.label.setPosition(k.x, k.y - 28);
    }

    const order = [...this.karts].sort((a, b) => this.progress(b) - this.progress(a));
    this.hudText.setText(
      order
        .map(
          (k, i) =>
            `${i + 1}° ${k.avatar} giro ${Math.min(k.lap + 1, LAPS)}/${LAPS}${k.finished ? ' ✅' : ''}`
        )
        .join('    ')
    );

    if (this.finishOrder.length >= this.karts.length) this.endGame();

    this.ctx.input.update();
  }

  private progress(k: Kart): number {
    if (k.finished) return 100000 - this.finishOrder.indexOf(k.id);
    return k.lap + Math.abs(k.accAngle) / (2 * Math.PI);
  }

  private endGame(): void {
    if (this.finished) return;
    this.finished = true;
    const rest = this.karts
      .filter((k) => !this.finishOrder.includes(k.id))
      .sort((a, b) => this.progress(b) - this.progress(a))
      .map((k) => k.id);
    const ranking = [...this.finishOrder, ...rest];
    const results = ranking.map((pid, i) => ({
      playerId: pid,
      placement: i + 1,
      score: this.karts.find((k) => k.id === pid)?.lap ?? 0
    }));
    this.ctx.finish({ results });
  }
}
