import {
  Engine,
  Scene,
  Color4,
  DynamicTexture,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Mesh
} from '@babylonjs/core';
import type { PlayerId } from '../../../shared/types';
import type { MinigameContext } from '../types';
import { audio } from '../../core/AudioManager';
import {
  ARENA_HALF_W,
  ARENA_HALF_D,
  PLAYER_RADIUS,
  BALL_RADIUS,
  ACCEL,
  MAX_SPEED,
  FRICTION,
  DODGE_SPEED,
  DODGE_TIME,
  DODGE_COOLDOWN,
  DODGE_INVULN,
  THROW_SPEED,
  BALL_BOUNCE_DAMP,
  BALL_MAX_BOUNCES,
  BALL_MAX_LIFE,
  PICKUP_RADIUS,
  KNOCKBACK_HIT,
  STUN_TIME,
  GRAVITY,
  BALL_COUNT_MAX,
  createDodgeballPlayer,
  createBall
} from './dodgeballTypes';
import type { DodgeballPlayer, Ball } from './dodgeballTypes';
import { ArenaEntity } from '../arena/arenaEntity';
import { ArenaCamera } from '../arena/arenaCamera';
import { ArenaHud } from '../arena/arenaHud';
import { buildDodgeballEnvironment } from './dodgeballEnvironment';
import { DodgeballAbilities } from './dodgeballAbilities';
import type { DodgeballAbilityFeedback } from './dodgeballAbilities';
import { DODGEBALL_ABILITIES } from '../../../shared/dodgeballAbilities';

const COUNTDOWN_S = 3.2;
const BALL_HEIGHT = 0.7;

type Phase = 'countdown' | 'playing' | 'celebrating';

/** Orchestratore del minigioco 3D DODGEBALL DEI COGLIONI (Babylon.js). */
export class BabylonDodgeballGame {
  private engine: Engine;
  private scene: Scene;
  private players: DodgeballPlayer[] = [];
  private entities = new Map<PlayerId, ArenaEntity>();
  private balls: Ball[] = [];
  private ballMeshes: Mesh[] = [];
  private env: ReturnType<typeof buildDodgeballEnvironment>;
  private camera: ArenaCamera;
  private hud: ArenaHud;
  private abilities: DodgeballAbilities;
  private order: PlayerId[];

  private phase: Phase = 'countdown';
  private countdown = COUNTDOWN_S;
  private lastCountInt = 4;
  private gameTime = 0;
  private durationSec: number;
  private invert: boolean;
  private gravityLow: boolean;

  private eliminationOrder: PlayerId[] = [];
  private resultsSent = false;
  private disposed = false;
  private paused = false;
  private celebrateTime = 0;

  private onResize = (): void => this.engine.resize();

  constructor(
    private canvas: HTMLCanvasElement,
    private ctx: MinigameContext
  ) {
    this.durationSec = Math.max(20, ctx.durationSec);
    this.invert = ctx.modifier?.id === 'controlli_invertiti';
    this.gravityLow = ctx.modifier?.id === 'gravita_bassa';

    this.engine = new Engine(canvas, true, { antialias: true, stencil: true, adaptToDeviceRatio: true });
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.05, 0.08, 0.16, 1);

    this.env = buildDodgeballEnvironment(this.scene);
    this.camera = new ArenaCamera(this.scene, canvas);
    this.hud = new ArenaHud(this.scene, '🎯 DODGEBALL DEI COGLIONI');
    this.hud.setModifier(ctx.modifier?.name ?? null);

    const dotTex = new DynamicTexture('dodgeDot', 16, this.scene, false);
    const dc = dotTex.getContext() as unknown as CanvasRenderingContext2D;
    dc.fillStyle = 'white';
    dc.beginPath();
    dc.arc(8, 8, 7, 0, Math.PI * 2);
    dc.fill();
    dotTex.update();

    this.abilities = new DodgeballAbilities((target, kx, kz, power, dropBall) =>
      this.applyKnockback(target, kx, kz, power, dropBall ?? false)
    );

    // Personaggi
    this.order = [...ctx.playerIds];
    const n = this.order.length;
    ctx.players.forEach((snap, i) => {
      const p = createDodgeballPlayer(snap.id, snap.characterId, snap.color, snap.avatar, snap.name);
      const t = n > 1 ? -1 + (2 * i) / (n - 1) : 0;
      p.x = t * (ARENA_HALF_W - 3);
      p.z = ARENA_HALF_D - 2;
      p.facing = Math.PI; // rivolti verso il campo (-Z)
      this.players.push(p);
      const entity = new ArenaEntity(this.scene, dotTex, snap.color, snap.characterId, snap.avatar, snap.displayName);
      this.entities.set(p.id, entity);
    });

    // Palloni
    const ballMat = new StandardMaterial('ballMat', this.scene);
    ballMat.diffuseColor = new Color3(0.95, 0.32, 0.2);
    ballMat.emissiveColor = new Color3(0.5, 0.12, 0.05);
    ballMat.specularColor = new Color3(0.4, 0.4, 0.4);
    const ballCount = Math.max(1, Math.min(BALL_COUNT_MAX, this.players.length - 1));
    const spawnPoints = [
      { x: 0, z: 0 },
      { x: -ARENA_HALF_W * 0.45, z: 0 },
      { x: ARENA_HALF_W * 0.45, z: 0 }
    ];
    for (let i = 0; i < ballCount; i++) {
      const b = createBall();
      const sp = spawnPoints[i % spawnPoints.length];
      b.x = sp.x;
      b.z = sp.z;
      this.balls.push(b);
      const mesh = MeshBuilder.CreateSphere('dodgeBall', { diameter: BALL_RADIUS * 2, segments: 10 }, this.scene);
      mesh.material = ballMat;
      mesh.position.set(b.x, BALL_HEIGHT, b.z);
      this.ballMeshes.push(mesh);
    }

    this.hud.setAlive(n);
    this.hud.setCountdown('3');

    this.engine.runRenderLoop(() => {
      if (this.disposed) return;
      if (this.paused) return;
      const dt = Math.min(this.engine.getDeltaTime() / 1000, 0.05) || 0.016;
      this.step(dt);
      this.scene.render();
    });
    window.addEventListener('resize', this.onResize);
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  // ---- Loop ----

  private step(dt: number): void {
    const now = performance.now();

    if (this.phase === 'countdown') {
      this.countdown -= dt;
      const n = Math.ceil(this.countdown);
      if (n < this.lastCountInt && n > 0) {
        this.lastCountInt = n;
        this.hud.setCountdown(String(n));
        audio.tick();
        this.ctx.signal(null, { type: 'countdown', value: n });
      } else if (this.countdown <= 0) {
        this.phase = 'playing';
        this.hud.setCountdown('VIA!', '#4ade80');
        audio.boost();
        this.ctx.signal(null, { type: 'countdown', value: 0 });
        this.timeOutClearCountdown();
        for (const p of this.players) {
          this.ctx.vibrate(p.id, 90);
          this.ctx.sendPrivate(p.id, { type: 'info', ability: DODGEBALL_ABILITIES[p.characterId ?? '']?.desc ?? '' });
        }
      }
    } else if (this.phase === 'playing') {
      this.gameTime += dt;
      for (const p of this.players) this.stepPlayer(p, dt);
      this.resolvePlayerCollisions();
      this.updateBalls(dt);
      this.checkEndCondition();
    } else if (this.phase === 'celebrating') {
      this.celebrateTime -= dt;
      if (this.celebrateTime <= 0 && !this.resultsSent) {
        this.resultsSent = true;
        this.ctx.finish({ results: this.buildResults() });
      }
    }

    // Aggiornamento visuale
    for (const p of this.players) {
      this.entities.get(p.id)?.updateVisual(p, dt, now);
    }
    this.syncBallMeshes();
    this.camera.update(dt, this.players, now);
    this.env.update(now);

    this.ctx.input.update();
  }

  private timeOutClearCountdown(): void {
    window.setTimeout(() => {
      if (!this.disposed) this.hud.clearCountdown();
    }, 700);
  }

  // ---- Giocatori ----

  private stepPlayer(p: DodgeballPlayer, dt: number): void {
    if (p.falling) {
      p.spin += dt * 9;
      p.vy -= GRAVITY * dt;
      p.y += p.vy * dt;
      p.x += p.vx * dt;
      p.z += p.vz * dt;
      return;
    }

    p.dodgeCooldown = Math.max(0, p.dodgeCooldown - dt);
    p.dodgeTime = Math.max(0, p.dodgeTime - dt);
    p.invulnTime = Math.max(0, p.invulnTime - dt);
    p.stunTime = Math.max(0, p.stunTime - dt);
    p.hitFlash = Math.max(0, p.hitFlash - dt);
    this.abilities.update(p, dt);

    const input = this.ctx.input.get(p.id);
    let ax = input.axis('move').x;
    let az = input.axis('move').y;
    if (this.invert) {
      ax = -ax;
      az = -az;
    }
    const mag = Math.hypot(ax, az);
    if (mag > 1) {
      ax /= mag;
      az /= mag;
    }

    const stunned = p.stunTime > 0;
    const dodging = p.dodgeTime > 0;
    p.dashing = dodging;

    // Schivata / dash
    if (!stunned && !dodging && input.justPressed('dodge') && p.dodgeCooldown <= 0) {
      const dirX = mag > 0.15 ? ax : Math.sin(p.facing);
      const dirZ = mag > 0.15 ? az : Math.cos(p.facing);
      p.dodgeTime = DODGE_TIME;
      p.dodgeCooldown = DODGE_COOLDOWN;
      p.invulnTime = DODGE_INVULN;
      p.vx = dirX * DODGE_SPEED;
      p.vz = dirZ * DODGE_SPEED;
      audio.boost();
      this.ctx.vibrate(p.id, 25);
    }

    // Abilità
    if (!stunned && input.justPressed('ability')) {
      this.abilities.onAbilityPress(p, this.players, (f) => this.onAbilityFeedback(p, f));
    }

    // Tiro
    if (!stunned && input.justPressed('throw') && p.hasBall) {
      this.throwBall(p);
    }

    if (dodging) {
      // il dash mantiene la velocità impostata
    } else if (!stunned && mag > 0.15) {
      p.facing = Math.atan2(ax, az);
      p.vx += ax * ACCEL * p.speedMult * dt;
      p.vz += az * ACCEL * p.speedMult * dt;
    }

    if (!dodging) {
      const damp = Math.exp(-FRICTION * dt);
      p.vx *= damp;
      p.vz *= damp;
      const sp = Math.hypot(p.vx, p.vz);
      const cap = MAX_SPEED * p.speedMult;
      if (sp > cap) {
        p.vx = (p.vx / sp) * cap;
        p.vz = (p.vz / sp) * cap;
      }
    }

    p.x += p.vx * dt;
    p.z += p.vz * dt;
    p.x = Math.max(-ARENA_HALF_W + PLAYER_RADIUS, Math.min(ARENA_HALF_W - PLAYER_RADIUS, p.x));
    p.z = Math.max(-ARENA_HALF_D + PLAYER_RADIUS, Math.min(ARENA_HALF_D - PLAYER_RADIUS, p.z));

    if (p.y > 0 || p.vy !== 0) {
      p.vy -= GRAVITY * dt;
      p.y += p.vy * dt;
      if (p.y <= 0) {
        p.y = 0;
        p.vy = 0;
      }
    }
  }

  private throwBall(p: DodgeballPlayer): void {
    const ball = this.balls.find((b) => b.state === 'held' && b.holderId === p.id);
    if (!ball) return;
    p.hasBall = false;
    ball.state = 'flying';
    ball.holderId = null;
    ball.throwerId = p.id;
    ball.bounces = 0;
    ball.life = 0;
    ball.vx = Math.sin(p.facing) * THROW_SPEED;
    ball.vz = Math.cos(p.facing) * THROW_SPEED;
    ball.x = p.x + Math.sin(p.facing) * (PLAYER_RADIUS + BALL_RADIUS + 0.2);
    ball.z = p.z + Math.cos(p.facing) * (PLAYER_RADIUS + BALL_RADIUS + 0.2);
    this.entities.get(p.id)?.playThrow();
    audio.select();
    this.ctx.vibrate(p.id, 40);
    this.ctx.signal(p.id, { type: 'threwBall' });
  }

  private resolvePlayerCollisions(): void {
    const list = this.players.filter((p) => p.alive && !p.falling);
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const dist = Math.hypot(dx, dz);
        const minDist = PLAYER_RADIUS * 2;
        if (dist >= minDist || dist < 0.001) continue;
        const nx = dx / dist;
        const nz = dz / dist;
        const overlap = (minDist - dist) / 2;
        a.x -= nx * overlap;
        a.z -= nz * overlap;
        b.x += nx * overlap;
        b.z += nz * overlap;
        const relAlong = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
        if (relAlong < 0) {
          const impulse = -relAlong * 0.5;
          a.vx -= nx * impulse;
          a.vz -= nz * impulse;
          b.vx += nx * impulse;
          b.vz += nz * impulse;
        }
      }
    }
  }

  // ---- Palloni ----

  private updateBalls(dt: number): void {
    for (let i = 0; i < this.balls.length; i++) {
      const ball = this.balls[i];

      if (ball.state === 'flying') {
        ball.life += dt;
        ball.x += ball.vx * dt;
        ball.z += ball.vz * dt;

        // Rimbalzi sui muri
        if (ball.x > ARENA_HALF_W - BALL_RADIUS) {
          ball.x = ARENA_HALF_W - BALL_RADIUS;
          ball.vx = -Math.abs(ball.vx) * BALL_BOUNCE_DAMP;
          ball.bounces++;
          audio.tick();
        } else if (ball.x < -ARENA_HALF_W + BALL_RADIUS) {
          ball.x = -ARENA_HALF_W + BALL_RADIUS;
          ball.vx = Math.abs(ball.vx) * BALL_BOUNCE_DAMP;
          ball.bounces++;
          audio.tick();
        }
        if (ball.z > ARENA_HALF_D - BALL_RADIUS) {
          ball.z = ARENA_HALF_D - BALL_RADIUS;
          ball.vz = -Math.abs(ball.vz) * BALL_BOUNCE_DAMP;
          ball.bounces++;
          audio.tick();
        } else if (ball.z < -ARENA_HALF_D + BALL_RADIUS) {
          ball.z = -ARENA_HALF_D + BALL_RADIUS;
          ball.vz = Math.abs(ball.vz) * BALL_BOUNCE_DAMP;
          ball.bounces++;
          audio.tick();
        }

        // Colpo su giocatore
        for (const p of this.players) {
          if (!p.alive || p.falling) continue;
          if (ball.throwerId === p.id && ball.life < 0.15) continue; // non colpisce il lanciatore subito
          const dx = p.x - ball.x;
          const dz = p.z - ball.z;
          const dist = Math.hypot(dx, dz);
          if (dist < PLAYER_RADIUS + BALL_RADIUS) {
            this.onBallHitPlayer(ball, p, dx, dz, dist);
            break;
          }
        }

        // Decadimento a palla libera
        const speed = Math.hypot(ball.vx, ball.vz);
        if (ball.bounces >= BALL_MAX_BOUNCES || ball.life >= BALL_MAX_LIFE || speed < 1.5) {
          this.dropBall(ball);
        }
      } else if (ball.state === 'free') {
        // Pickup: il giocatore più vicino senza palla la raccoglie.
        let best: DodgeballPlayer | null = null;
        let bestD = PICKUP_RADIUS;
        for (const p of this.players) {
          if (!p.alive || p.falling || p.hasBall || p.stunTime > 0) continue;
          const d = Math.hypot(p.x - ball.x, p.z - ball.z);
          if (d < bestD) {
            bestD = d;
            best = p;
          }
        }
        if (best) {
          ball.state = 'held';
          ball.holderId = best.id;
          best.hasBall = true;
          audio.select();
          this.ctx.vibrate(best.id, 35);
          this.ctx.signal(best.id, { type: 'gotBall' });
        }
      }
    }
  }

  private onBallHitPlayer(ball: Ball, p: DodgeballPlayer, dx: number, dz: number, dist: number): void {
    const nx = dist > 0.001 ? dx / dist : 0;
    const nz = dist > 0.001 ? dz / dist : 0;
    const result = this.abilities.handleIncomingHit(p, (f) => this.onAbilityFeedback(p, f));

    if (result === 'survive') {
      // Colpo assorbito: knockback + palla cade a terra.
      this.applyKnockback(p, nx, nz, KNOCKBACK_HIT, true);
      this.dropBall(ball);
      return;
    }

    // Eliminazione
    this.eliminate(p, nx, nz, ball.throwerId);
    this.dropBall(ball);
  }

  private dropBall(ball: Ball): void {
    ball.state = 'free';
    ball.holderId = null;
    ball.throwerId = null;
    ball.vx = 0;
    ball.vz = 0;
    ball.bounces = 0;
    ball.life = 0;
    // Rimane dentro il campo.
    ball.x = Math.max(-ARENA_HALF_W + BALL_RADIUS, Math.min(ARENA_HALF_W - BALL_RADIUS, ball.x));
    ball.z = Math.max(-ARENA_HALF_D + BALL_RADIUS, Math.min(ARENA_HALF_D - BALL_RADIUS, ball.z));
  }

  private applyKnockback(target: DodgeballPlayer, kx: number, kz: number, power: number, dropBall = false): void {
    if (!target.alive || target.falling) return;
    const mult = target.knockbackResist;
    target.vx += kx * power * mult;
    target.vz += kz * power * mult;
    target.vy = this.gravityLow ? 5 : 3;
    target.stunTime = Math.max(target.stunTime, STUN_TIME);
    target.hitFlash = 0.16;
    if (dropBall && target.hasBall) {
      const held = this.balls.find((b) => b.state === 'held' && b.holderId === target.id);
      if (held) {
        target.hasBall = false;
        held.state = 'free';
        held.holderId = null;
        held.throwerId = null;
        held.vx = 0;
        held.vz = 0;
        this.ctx.signal(target.id, { type: 'threwBall' });
      }
    }
    this.entities.get(target.id)?.burstHit();
    audio.hit();
    this.ctx.vibrate(target.id, 60);
    this.camera.shake(0.15, 160);
  }

  private eliminate(p: DodgeballPlayer, nx: number, nz: number, throwerId: PlayerId | null): void {
    p.alive = false;
    p.falling = true;
    p.spin = 0;
    this.eliminationOrder.push(p.id);
    p.vx = nx * 8;
    p.vz = nz * 8;
    p.vy = 5;
    if (p.hasBall) {
      // lascia cadere la palla
      const held = this.balls.find((b) => b.state === 'held' && b.holderId === p.id);
      if (held) this.dropBall(held);
      p.hasBall = false;
      this.ctx.signal(p.id, { type: 'threwBall' });
    }
    if (throwerId) {
      const thrower = this.players.find((x) => x.id === throwerId);
      if (thrower) thrower.eliminations++;
    }
    audio.wrong();
    this.entities.get(p.id)?.burstHit();
    this.camera.shake(0.3, 240);
    this.hud.feedMessage(`${p.avatar} ${p.name.toUpperCase()} È FUORI!`, '#f87171');
    this.ctx.signal(p.id, { type: 'eliminated' });
    this.hud.setAlive(this.players.filter((x) => x.alive).length);
  }

  // ---- Vittoria / risultati ----

  private checkEndCondition(): void {
    const aliveCount = this.players.filter((p) => p.alive).length;
    const over = this.players.length > 1 ? aliveCount <= 1 : aliveCount === 0;
    if (over || this.gameTime >= this.durationSec) {
      this.startCelebration();
    }
  }

  private startCelebration(): void {
    if (this.phase === 'celebrating') return;
    this.phase = 'celebrating';
    this.celebrateTime = 1.8;
    const winner = this.players.find((p) => p.alive);
    if (winner) {
      winner.vy = 6;
      audio.fanfare();
      this.hud.feedMessage(`🏆 ${winner.avatar} ${winner.name.toUpperCase()} VINCE!`, '#fbbf24', 4000);
      this.ctx.signal(winner.id, { type: 'won' });
      this.entities.get(winner.id)?.burstHit();
    } else {
      audio.select();
      this.hud.feedMessage('Nessun sopravvissuto!', '#9ca3af', 3000);
    }
  }

  private buildResults(): { playerId: PlayerId; placement: number; score: number }[] {
    const alive = this.players.filter((p) => p.alive);
    const eliminated = this.eliminationOrder.slice().reverse();
    const aliveIds = alive.map((p) => p.id);
    const ranking = [...aliveIds, ...eliminated.filter((id) => !aliveIds.includes(id))];
    return ranking.map((pid, i) => ({ playerId: pid, placement: i + 1, score: this.players.find((p) => p.id === pid)?.eliminations ?? 0 }));
  }

  // ---- Feedback abilità ----

  private onAbilityFeedback(p: DodgeballPlayer, f: DodgeballAbilityFeedback): void {
    switch (f.type) {
      case 'goblin_nculo':
        this.hud.feedMessage(`${p.avatar} NCULO!`, '#10b981');
        this.ctx.signal(p.id, { type: 'ability', name: 'NCULO!' });
        audio.boost();
        this.ctx.vibrate(p.id, 80);
        break;
      case 'buttafuori_impegno':
        this.hud.feedMessage(`${p.avatar} MO M'IMPEGNO!`, '#f97316');
        this.ctx.signal(p.id, { type: 'ability', name: "MO M'IMPEGNO" });
        audio.select();
        this.ctx.vibrate(p.id, 80);
        break;
      case 'dottore_light':
        this.hud.feedMessage(`${p.avatar} 20 KG IN UN MESE!`, '#22d3ee');
        this.ctx.signal(p.id, { type: 'ability', name: '20 KG IN UN MESE' });
        audio.select();
        this.ctx.vibrate(p.id, 80);
        break;
      case 'judoka_ippon':
        this.hud.feedMessage(`${p.avatar} IPPON!`, '#facc15');
        this.ctx.signal(p.id, { type: 'ability', name: 'IPPON' });
        audio.hit();
        this.ctx.vibrate(p.id, 110);
        break;
      case 'ciro_arm':
        this.hud.feedMessage(`${p.avatar} PAGO DOPO!`, '#a78bfa');
        this.ctx.signal(p.id, { type: 'ability', name: 'PAGO DOPO' });
        audio.select();
        this.ctx.vibrate(p.id, 70);
        break;
      case 'buttafuori_saved':
        this.hud.feedMessage(`${p.avatar} RIBALTATO MA NON MORTO!`, '#f97316');
        this.ctx.signal(p.id, { type: 'saved' });
        audio.hit();
        this.ctx.vibrate(p.id, 120);
        break;
      case 'ciro_saved':
        this.hud.feedMessage(`${p.avatar} PAGO DOPO — colpo respinto!`, '#a78bfa');
        this.ctx.signal(p.id, { type: 'saved' });
        audio.hit();
        this.ctx.vibrate(p.id, 110);
        break;
    }
  }

  // ---- Visual ----

  private syncBallMeshes(): void {
    for (let i = 0; i < this.balls.length; i++) {
      const ball = this.balls[i];
      const mesh = this.ballMeshes[i];
      if (!mesh) continue;
      if (ball.state === 'held' && ball.holderId) {
        const holder = this.players.find((p) => p.id === ball.holderId);
        const entity = holder ? this.entities.get(holder.id) : null;
        if (entity && holder) {
          const h = entity.handAnchor;
          // Ruota l'ancora locale della mano secondo l'orientamento del personaggio.
          const sinF = Math.sin(holder.facing);
          const cosF = Math.cos(holder.facing);
          const lx = h.x * cosF + h.z * sinF;
          const lz = -h.x * sinF + h.z * cosF;
          mesh.position.set(holder.x + lx, holder.y + h.y, holder.z + lz);
        }
      } else {
        mesh.position.set(ball.x, BALL_HEIGHT, ball.z);
      }
      // rotazione decorativa
      mesh.rotation.y += 0.08;
      mesh.rotation.x += 0.05;
    }
  }

  // ---- Ciclo di vita ----

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    window.removeEventListener('resize', this.onResize);
    for (const e of this.entities.values()) e.dispose();
    this.camera.dispose();
    this.hud.dispose();
    this.engine.stopRenderLoop();
    this.scene.dispose();
    this.engine.dispose();
  }
}
