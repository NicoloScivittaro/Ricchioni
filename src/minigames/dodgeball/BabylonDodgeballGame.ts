import {
  Engine,
  Scene,
  Color4,
  DynamicTexture,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Mesh,
  ParticleSystem,
  Vector3
} from '@babylonjs/core';
import type { PlayerId, PlayerResult } from '../../../shared/types';
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
  PARRY_RADIUS,
  REFLECT_SPEED_MULT,
  AIM_THROW_SPEED_MULT,
  AIM_BOUNCE_DAMP,
  TRUCK_SPEED,
  TRUCK_PICKUP_RADIUS,
  TRUCK_MAX_BALLS,
  TRUCK_WALL_STUN,
  TRUCK_PUSH_POWER,
  createDodgeballPlayer,
  createBall
} from './dodgeballTypes';
import type { DodgeballPlayer, Ball } from './dodgeballTypes';
import { ArenaEntity } from '../arena/arenaEntity';
import { ShockRings, makeBallTrail, tintBallTrail } from '../arena/impactFx';
import { ArenaCamera } from '../arena/arenaCamera';
import { ArenaHud } from '../arena/arenaHud';
import { buildDodgeballEnvironment } from './dodgeballEnvironment';
import { DodgeballAbilities } from './dodgeballAbilities';
import type { DodgeballAbilityFeedback } from './dodgeballAbilities';
import { readMove } from '../moveInput';
import { DODGEBALL_ABILITIES } from '../../../shared/dodgeballAbilities';
import { runSteps } from '../../core/frameClock';
import { guardLoop, safely } from '../../core/loopGuard';
import { applyQuality, engineOptions } from '../../core/quality';
import { say } from '../../core/announcer';
import { telemetry } from '../../core/telemetry';

const COUNTDOWN_S = 3.2;
const BALL_HEIGHT = 0.7;
/** Avviso di pericolo: la palla passera' a portata di corpo entro questo tempo (s). Lascia margine a un dash reattivo (invulnerabilita' 0.3 s). */
const DANGER_TIME = 0.42;
/** Il Dottore con TRE MESI DOPO attivo vede il pericolo molto prima (la sua abilita' resta unica ora che l'avviso base e' per tutti). */
const DANGER_TIME_VISION = 0.95;
/** Hitstop all'eliminazione (s): la simulazione si ferma un attimo, l'impatto "pesa". Gli input restano in coda. */
const HITSTOP_S = 0.07;

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

  private aimDots: Mesh[] = [];
  private visionDots: Mesh[] = [];
  private aimMat: StandardMaterial;
  private visionMat: StandardMaterial;
  private dangerMat: StandardMaterial;
  private lastDangerWarn = 0;
  private trails: ParticleSystem[] = [];
  private pickRings: Mesh[] = [];
  private ringMat: StandardMaterial | null = null;
  private shocks: ShockRings;
  private warned = new Map<string, number>();
  private hitStop = 0;

  private phase: Phase = 'countdown';
  private countdown = COUNTDOWN_S;
  private lastCountInt = 4;
  private gameTime = 0;
  private durationSec: number;
  private invert: boolean;
  private gravityLow: boolean;

  private eliminationOrder: PlayerId[] = [];
  private eliminatedAt = new Map<PlayerId, number>(); // secondi di gioco alla caduta (statistica risultati)
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

    this.engine = new Engine(canvas, engineOptions().antialias, engineOptions());
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

    this.abilities = new DodgeballAbilities();

    // Pallini di traiettoria (mira Buttafuori + visione Dottore)
    this.aimMat = new StandardMaterial('aimMat', this.scene);
    this.aimMat.diffuseColor = new Color3(0.2, 0.9, 1);
    this.aimMat.emissiveColor = new Color3(0.3, 0.9, 1);
    this.aimMat.disableLighting = true;
    this.visionMat = new StandardMaterial('visMat', this.scene);
    this.visionMat.diffuseColor = new Color3(1, 0.85, 0.2);
    this.visionMat.emissiveColor = new Color3(1, 0.8, 0.15);
    this.visionMat.disableLighting = true;
    this.dangerMat = new StandardMaterial('dangerMat', this.scene);
    this.dangerMat.diffuseColor = new Color3(1, 0.15, 0.15);
    this.dangerMat.emissiveColor = new Color3(1, 0.1, 0.1);
    this.dangerMat.disableLighting = true;
    for (let i = 0; i < 20; i++) {
      const d = MeshBuilder.CreateSphere('aimDot', { diameter: 0.24, segments: 6 }, this.scene);
      d.material = this.aimMat;
      d.isVisible = false;
      this.aimDots.push(d);
    }
    for (let i = 0; i < 24; i++) {
      const d = MeshBuilder.CreateSphere('visDot', { diameter: 0.22, segments: 6 }, this.scene);
      d.material = this.visionMat;
      d.isVisible = false;
      this.visionDots.push(d);
    }

    // Personaggi
    this.order = [...ctx.playerIds];
    const n = this.order.length;
    ctx.players.forEach((snap, i) => {
      const p = createDodgeballPlayer(snap.id, snap.characterId, snap.color, snap.avatar, snap.name);
      const t = n > 1 ? -1 + (2 * i) / (n - 1) : 0;
      p.x = t * (ARENA_HALF_W - 3);
      p.z = ARENA_HALF_D - 2;
      p.facing = Math.PI;
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
      this.trails.push(this.makeTrail(mesh, dotTex));
      this.pickRings.push(this.makeRing());
    }
    this.shocks = new ShockRings(this.scene);

    this.hud.setAlive(n);
    this.hud.setCountdown('3');

    applyQuality(this.engine, this.scene); // preset LOW/MEDIUM/HIGH + risoluzione dinamica (core/quality)
    this.engine.runRenderLoop(guardLoop(() => {
      if (this.disposed) return;
      if (this.paused) return;
      // Sotto-passi in tempo reale: timer/countdown/durata non dipendono dagli FPS (vedi core/frameClock).
      runSteps(this.engine.getDeltaTime(), (dt) => this.step(dt));
      this.scene.render();
    }));
    window.addEventListener('resize', this.onResize);
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  // ---- Loop ----

  private step(dt: number): void {
    const now = performance.now();
    let held = false; // hitstop in corso: gli edge degli input (justPressed) restano per il prossimo passo di simulazione

    if (this.phase === 'countdown') {
      this.countdown -= dt;
      const n = Math.ceil(this.countdown);
      if (n < this.lastCountInt && n > 0) {
        this.lastCountInt = n;
        this.hud.setCountdown(String(n));
        audio.tick(1 + (3 - n) * 0.25); // tono crescente: 3 → 2 → 1 → VIA
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
      if (this.hitStop > 0) {
        this.hitStop -= dt;
        held = true;
      } else {
        this.gameTime += dt;
        for (const p of this.players) this.stepPlayer(p, dt);
        this.resolvePlayerCollisions();
        this.updateBalls(dt);
        this.checkEndCondition();
      }
    } else if (this.phase === 'celebrating') {
      this.celebrateTime -= dt;
      if (this.celebrateTime <= 0 && !this.resultsSent) {
        this.resultsSent = true;
        this.ctx.finish({ results: this.buildResults() });
      }
    }

    // Visuali
    for (const p of this.players) {
      this.entities.get(p.id)?.updateVisual(p, dt, now);
    }
    this.syncBallMeshes(now);
    this.shocks.update(dt);
    this.updateTrajectories(now);
    this.camera.update(dt, this.players, now);
    this.env.update(now);

    if (!held) this.ctx.input.update();
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
    this.abilities.update(p, dt, (f) => this.onAbilityFeedback(p, f));

    // Ciro: esattore.
    if (p.debtActive && p.debtTimer <= 0) {
      this.debtCollector(p);
      return;
    }

    const input = this.ctx.input.get(p.id);
    const mv = readMove(input);
    let ax = mv.x;
    let az = mv.z;
    if (this.invert) {
      ax = -ax;
      az = -az;
    }
    const mag = Math.hypot(ax, az);
    if (mag > 1) {
      ax /= mag;
      az /= mag;
    }

    // ---- Modalità camion (Judoka) ----
    if (p.truckBeepTimer > 0) {
      p.vx = 0;
      p.vz = 0;
      this.integratePlayer(p, dt, false);
      return;
    }
    if (p.truckTime > 0) {
      p.vx = p.truckDirX * TRUCK_SPEED;
      p.vz = p.truckDirZ * TRUCK_SPEED;
      this.integratePlayer(p, dt, true);
      let hitWall = false;
      if (p.x >= ARENA_HALF_W - PLAYER_RADIUS || p.x <= -ARENA_HALF_W + PLAYER_RADIUS) hitWall = true;
      if (p.z >= ARENA_HALF_D - PLAYER_RADIUS || p.z <= -ARENA_HALF_D + PLAYER_RADIUS) hitWall = true;
      if (hitWall) {
        this.truckFail(p);
      } else {
        this.truckPickup(p);
        this.truckPush(p);
      }
      return;
    }

    const stunned = p.stunTime > 0;
    let dodging = p.dodgeTime > 0;
    p.dashing = dodging;

    // Schivata
    if (!stunned && !dodging && input.justPressed('dodge') && p.dodgeCooldown <= 0) {
      const dirX = mag > 0.15 ? ax : Math.sin(p.facing);
      const dirZ = mag > 0.15 ? az : Math.cos(p.facing);
      p.dodgeTime = DODGE_TIME;
      dodging = true; // vale gia' in QUESTO passo: prima la velocita' del dash veniva subito tagliata al tetto di corsa (9 invece di 16)
      p.dashing = true;
      p.dodgeCooldown = DODGE_COOLDOWN;
      p.invulnTime = DODGE_INVULN;
      p.vx = dirX * DODGE_SPEED;
      p.vz = dirZ * DODGE_SPEED;
      audio.boost();
      this.ctx.vibrate(p.id, 25);
      this.ctx.signal(p.id, { type: 'dodged', cooldownMs: Math.round(DODGE_COOLDOWN * 1000) });
    }

    // Abilità
    if (!stunned && input.justPressed('ability')) {
      const dirX = mag > 0.15 ? ax : Math.sin(p.facing);
      const dirZ = mag > 0.15 ? az : Math.cos(p.facing);
      this.abilities.onAbilityPress(p, dirX, dirZ, (f) => this.onAbilityFeedback(p, f));
    }

    // Tiro (palloni del camion O palla normale)
    if (!stunned && input.justPressed('throw')) {
      if (p.truckBalls.length > 0) this.fireTruckBall(p);
      else if (p.hasBall) this.throwBall(p);
    }

    if (dodging) {
      // velocità impostata dalla schivata
    } else if (!stunned && mag > 0.15) {
      p.facing = Math.atan2(ax, az);
      p.vx += ax * ACCEL * dt;
      p.vz += az * ACCEL * dt;
    }

    if (!dodging) {
      const damp = Math.exp(-FRICTION * dt);
      p.vx *= damp;
      p.vz *= damp;
      const sp = Math.hypot(p.vx, p.vz);
      if (sp > MAX_SPEED) {
        p.vx = (p.vx / sp) * MAX_SPEED;
        p.vz = (p.vz / sp) * MAX_SPEED;
      }
    }

    this.integratePlayer(p, dt, true);
  }

  private integratePlayer(p: DodgeballPlayer, dt: number, clampToArena: boolean): void {
    p.x += p.vx * dt;
    p.z += p.vz * dt;
    if (clampToArena) {
      p.x = Math.max(-ARENA_HALF_W + PLAYER_RADIUS, Math.min(ARENA_HALF_W - PLAYER_RADIUS, p.x));
      p.z = Math.max(-ARENA_HALF_D + PLAYER_RADIUS, Math.min(ARENA_HALF_D - PLAYER_RADIUS, p.z));
    }
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
    ball.bounceDamp = BALL_BOUNCE_DAMP;

    let speed = THROW_SPEED;
    if (p.characterId === 'buttafuori' && p.aimTime > 0 && !p.aimThrown) {
      // Primo tiro durante OCCHIO DA POLIGONO: più teso e veloce.
      p.aimThrown = true;
      speed = THROW_SPEED * AIM_THROW_SPEED_MULT;
      ball.bounceDamp = AIM_BOUNCE_DAMP;
      this.onAbilityFeedback(p, { type: 'buttafuori_charged' });
    }

    const dirX = Math.sin(p.facing);
    const dirZ = Math.cos(p.facing);
    ball.vx = dirX * speed;
    ball.vz = dirZ * speed;
    ball.x = p.x + dirX * (PLAYER_RADIUS + BALL_RADIUS + 0.2);
    ball.z = p.z + dirZ * (PLAYER_RADIUS + BALL_RADIUS + 0.2);
    this.entities.get(p.id)?.playThrow();
    this.tintTrail(this.balls.indexOf(ball), p.color);
    const charged = speed > THROW_SPEED * 1.05;
    audio.throwWhoosh(charged ? 1.35 : 1);
    this.camera.shake(charged ? 0.1 : 0.05, 90);
    this.ctx.vibrate(p.id, 40);
    this.ctx.signal(p.id, { type: 'threwBall' });
  }

  private fireTruckBall(p: DodgeballPlayer): void {
    const idx = p.truckBalls.shift();
    if (idx === undefined) return;
    const ball = this.balls[idx];
    if (!ball || ball.state !== 'held') return;
    ball.state = 'flying';
    ball.holderId = null;
    ball.throwerId = p.id;
    ball.bounces = 0;
    ball.life = 0;
    ball.bounceDamp = BALL_BOUNCE_DAMP;
    const dirX = Math.sin(p.facing);
    const dirZ = Math.cos(p.facing);
    ball.vx = dirX * THROW_SPEED;
    ball.vz = dirZ * THROW_SPEED;
    ball.x = p.x + dirX * (PLAYER_RADIUS + BALL_RADIUS + 0.2);
    ball.z = p.z + dirZ * (PLAYER_RADIUS + BALL_RADIUS + 0.2);
    this.entities.get(p.id)?.playThrow();
    this.tintTrail(idx, p.color);
    audio.throwWhoosh(1);
    this.camera.shake(0.05, 90);
    this.ctx.vibrate(p.id, 45);
    this.ctx.signal(p.id, { type: 'threwBall' });
  }

  private resolvePlayerCollisions(): void {
    const list = this.players.filter((p) => p.alive && !p.falling && p.truckTime <= 0 && p.truckBeepTimer <= 0);
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

  // ---- Effetti di contatto ----

  /** Scia luminosa dietro la palla in volo. Si colora del giocatore che ha tirato (tintTrail): si capisce di CHI e' la palla. */
  private makeTrail(mesh: Mesh, tex: DynamicTexture): ParticleSystem {
    return makeBallTrail(this.scene, mesh, tex);
  }

  private tintTrail(ballIndex: number, colorHex: string): void {
    const ps = this.trails[ballIndex];
    if (ps) tintBallTrail(ps, colorHex);
  }

  /** Anello a terra sotto una palla libera: quando il CORPO del giocatore lo tocca, la palla e' sua (PICKUP_RADIUS = corpo + anello). */
  private makeRing(): Mesh {
    if (!this.ringMat) {
      this.ringMat = new StandardMaterial('dbRingMat', this.scene);
      this.ringMat.disableLighting = true;
      this.ringMat.emissiveColor = new Color3(1, 0.85, 0.3);
      this.ringMat.alpha = 0.85;
    }
    const m = MeshBuilder.CreateTorus('dbPickRing', { diameter: (PICKUP_RADIUS - PLAYER_RADIUS) * 2, thickness: 0.14, tessellation: 32 }, this.scene);
    m.material = this.ringMat;
    m.isPickable = false;
    m.isVisible = false;
    return m;
  }

  private bounceSfx(ball: Ball): void {
    audio.bounce(Math.max(0.4, Math.min(1.2, Math.hypot(ball.vx, ball.vz) / THROW_SPEED)));
  }

  /**
   * AVVISO DI PERICOLO: una palla in volo passera' a portata di corpo di un giocatore entro DANGER_TIME (~0.42 s, prima del punto di
   * massimo avvicinamento, ignorando i rimbalzi). Il telefono vibra e il pulsante SCHIVA lampeggia. Non e' un auto-schivata: il
   * giocatore deve comunque premere, ma le palle di rimbalzo e quelle "da dietro" smettono di essere ingiuste.
   */
  private warnIncoming(ball: Ball, ballIndex: number): void {
    const sp2 = ball.vx * ball.vx + ball.vz * ball.vz;
    if (sp2 < 25) return;
    for (const p of this.players) {
      if (!p.alive || p.falling || p.stunTime > 0 || p.invulnTime > 0 || p.dodgeTime > 0 || p.parryTime > 0) continue;
      const rx = p.x - ball.x;
      const rz = p.z - ball.z;
      const t = (rx * ball.vx + rz * ball.vz) / sp2;
      if (t <= 0 || t > (p.visionTime > 0 ? DANGER_TIME_VISION : DANGER_TIME)) continue;
      if (Math.hypot(rx - ball.vx * t, rz - ball.vz * t) > PLAYER_RADIUS + BALL_RADIUS + 0.3) continue;
      const key = `${ballIndex}|${p.id}`;
      const last = this.warned.get(key);
      if (last !== undefined && this.gameTime - last < 0.9) continue;
      this.warned.set(key, this.gameTime);
      this.ctx.signal(p.id, { type: 'danger' });
    }
  }

  // ---- Camion (Judoka) ----

  private truckPickup(p: DodgeballPlayer): void {
    if (p.truckBalls.length >= TRUCK_MAX_BALLS) return;
    for (let i = 0; i < this.balls.length; i++) {
      const b = this.balls[i];
      if (b.state !== 'free') continue;
      const d = Math.hypot(b.x - p.x, b.z - p.z);
      if (d < TRUCK_PICKUP_RADIUS) {
        b.state = 'held';
        b.holderId = p.id;
        b.throwerId = null;
        p.truckBalls.push(i);
        audio.select();
        this.ctx.vibrate(p.id, 30);
        if (p.truckBalls.length >= TRUCK_MAX_BALLS) return;
      }
    }
  }

  private truckPush(p: DodgeballPlayer): void {
    for (const other of this.players) {
      if (other.id === p.id || !other.alive || other.falling) continue;
      const dx = other.x - p.x;
      const dz = other.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d < PLAYER_RADIUS * 2 + 0.3 && d > 0.001) {
        const front = (dx / d) * p.truckDirX + (dz / d) * p.truckDirZ;
        if (front > 0.2) {
          other.vx += (dx / d) * TRUCK_PUSH_POWER;
          other.vz += (dz / d) * TRUCK_PUSH_POWER;
          other.stunTime = Math.max(other.stunTime, 0.15);
        }
      }
    }
  }

  private truckFail(p: DodgeballPlayer): void {
    p.truckTime = 0;
    p.stunTime = Math.max(p.stunTime, TRUCK_WALL_STUN);
    for (const idx of p.truckBalls) {
      const b = this.balls[idx];
      if (b) this.dropBall(b);
    }
    p.truckBalls = [];
    this.onAbilityFeedback(p, { type: 'judoka_wall' });
  }

  // ---- Ciro: esattore ----

  private debtCollector(p: DodgeballPlayer): void {
    p.debtActive = false;
    p.debtTimer = 0;
    this.eliminate(p, 0, 1, null);
    this.onAbilityFeedback(p, { type: 'ciro_debt_due' });
  }

  // ---- Palloni ----

  private updateBalls(dt: number): void {
    for (const ball of this.balls) {
      if (ball.state === 'flying') {
        ball.life += dt;
        ball.x += ball.vx * dt;
        ball.z += ball.vz * dt;

        if (ball.x > ARENA_HALF_W - BALL_RADIUS) {
          ball.x = ARENA_HALF_W - BALL_RADIUS;
          ball.vx = -Math.abs(ball.vx) * ball.bounceDamp;
          ball.bounces++;
          this.bounceSfx(ball);
        } else if (ball.x < -ARENA_HALF_W + BALL_RADIUS) {
          ball.x = -ARENA_HALF_W + BALL_RADIUS;
          ball.vx = Math.abs(ball.vx) * ball.bounceDamp;
          ball.bounces++;
          this.bounceSfx(ball);
        }
        if (ball.z > ARENA_HALF_D - BALL_RADIUS) {
          ball.z = ARENA_HALF_D - BALL_RADIUS;
          ball.vz = -Math.abs(ball.vz) * ball.bounceDamp;
          ball.bounces++;
          this.bounceSfx(ball);
        } else if (ball.z < -ARENA_HALF_D + BALL_RADIUS) {
          ball.z = -ARENA_HALF_D + BALL_RADIUS;
          ball.vz = Math.abs(ball.vz) * ball.bounceDamp;
          ball.bounces++;
          this.bounceSfx(ball);
        }

        for (const p of this.players) {
          if (!p.alive || p.falling) continue;
          if (ball.throwerId === p.id && ball.life < 0.15) continue;
          const dx = p.x - ball.x;
          const dz = p.z - ball.z;
          const dist = Math.hypot(dx, dz);

          // Parata di Goblin
          if (p.parryTime > 0 && dist < PARRY_RADIUS) {
            this.reflectBall(ball, p);
            break;
          }

          if (dist < PLAYER_RADIUS + BALL_RADIUS) {
            this.onBallHitPlayer(ball, p, dx, dz, dist);
            break;
          }
        }

        if (ball.state === 'flying') this.warnIncoming(ball, this.balls.indexOf(ball));

        const speed = Math.hypot(ball.vx, ball.vz);
        if (ball.bounces >= BALL_MAX_BOUNCES || ball.life >= BALL_MAX_LIFE || speed < 1.5) {
          this.dropBall(ball);
        }
      } else if (ball.state === 'free') {
        let best: DodgeballPlayer | null = null;
        let bestD = PICKUP_RADIUS;
        for (const p of this.players) {
          if (!p.alive || p.falling || p.hasBall || p.stunTime > 0) continue;
          if (p.truckTime > 0 || p.truckBeepTimer > 0 || p.truckBalls.length > 0) continue;
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
          audio.pickupPop();
          this.ctx.vibrate(best.id, 35);
          this.ctx.signal(best.id, { type: 'gotBall' });
        }
      }
    }
  }

  private reflectBall(ball: Ball, goblin: DodgeballPlayer): void {
    const target = this.reflectTarget(goblin, ball.throwerId);
    const dx = target.x - goblin.x;
    const dz = target.z - goblin.z;
    const d = Math.hypot(dx, dz) || 1;
    ball.vx = (dx / d) * THROW_SPEED * REFLECT_SPEED_MULT;
    ball.vz = (dz / d) * THROW_SPEED * REFLECT_SPEED_MULT;
    ball.throwerId = goblin.id;
    ball.bounces = 0;
    ball.life = 0;
    ball.bounceDamp = BALL_BOUNCE_DAMP;
    ball.x = goblin.x + (dx / d) * (PLAYER_RADIUS + BALL_RADIUS + 0.2);
    ball.z = goblin.z + (dz / d) * (PLAYER_RADIUS + BALL_RADIUS + 0.2);
    goblin.parryTime = 0;
    this.tintTrail(this.balls.indexOf(ball), goblin.color);
    audio.thump(0.9);
    this.ctx.vibrate(goblin.id, 80);
    this.camera.shake(0.2, 160);
    this.onAbilityFeedback(goblin, { type: 'goblin_reflect' });
  }

  private reflectTarget(goblin: DodgeballPlayer, originalThrowerId: PlayerId | null): { x: number; z: number } {
    if (originalThrowerId) {
      const orig = this.players.find((p) => p.id === originalThrowerId && p.alive && !p.falling);
      if (orig) return { x: orig.x, z: orig.z };
    }
    let best: DodgeballPlayer | null = null;
    let bestD = Infinity;
    for (const other of this.players) {
      if (other.id === goblin.id || !other.alive || other.falling) continue;
      const d = Math.hypot(other.x - goblin.x, other.z - goblin.z);
      if (d < bestD) {
        bestD = d;
        best = other;
      }
    }
    if (best) return { x: best.x, z: best.z };
    return { x: goblin.x + Math.sin(goblin.facing), z: goblin.z + Math.cos(goblin.facing) };
  }

  private onBallHitPlayer(ball: Ball, p: DodgeballPlayer, dx: number, dz: number, dist: number): void {
    const nx = dist > 0.001 ? dx / dist : 0;
    const nz = dist > 0.001 ? dz / dist : 0;
    const result = this.abilities.handleIncomingHit(p, (f) => this.onAbilityFeedback(p, f));

    if (result === 'survive') {
      this.applyKnockback(p, nx, nz, KNOCKBACK_HIT);
      // La palla rimbalza via.
      const dot = ball.vx * nx + ball.vz * nz;
      ball.vx -= 2 * dot * nx;
      ball.vz -= 2 * dot * nz;
      ball.vx *= 0.8;
      ball.vz *= 0.8;
      ball.bounces++;
      return;
    }

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
    ball.x = Math.max(-ARENA_HALF_W + BALL_RADIUS, Math.min(ARENA_HALF_W - BALL_RADIUS, ball.x));
    ball.z = Math.max(-ARENA_HALF_D + BALL_RADIUS, Math.min(ARENA_HALF_D - BALL_RADIUS, ball.z));
  }

  private applyKnockback(target: DodgeballPlayer, kx: number, kz: number, power: number): void {
    if (!target.alive || target.falling) return;
    target.vx += kx * power * target.knockbackResist;
    target.vz += kz * power * target.knockbackResist;
    target.vy = this.gravityLow ? 5 : 3;
    target.stunTime = Math.max(target.stunTime, STUN_TIME);
    target.hitFlash = 0.16;
    this.entities.get(target.id)?.burstHit();
    this.shocks.spawn(target.x, target.z, target.color);
    audio.thump(0.8);
    this.ctx.vibrate(target.id, 60);
    this.camera.shake(0.15, 160);
  }

  private eliminate(p: DodgeballPlayer, nx: number, nz: number, throwerId: PlayerId | null): void {
    p.alive = false;
    p.falling = true;
    p.spin = 0;
    this.eliminationOrder.push(p.id);
    this.eliminatedAt.set(p.id, this.gameTime);
    p.vx = nx * 8;
    p.vz = nz * 8;
    p.vy = 5;
    if (p.hasBall) {
      const held = this.balls.find((b) => b.state === 'held' && b.holderId === p.id);
      if (held) this.dropBall(held);
      p.hasBall = false;
      this.ctx.signal(p.id, { type: 'threwBall' });
    }
    // Palle del camion perse
    for (const idx of p.truckBalls) {
      const b = this.balls[idx];
      if (b) this.dropBall(b);
    }
    p.truckBalls = [];

    if (throwerId && throwerId !== p.id) {
      const thrower = this.players.find((x) => x.id === throwerId);
      if (thrower) {
        thrower.eliminations++;
        // Ciro: cancella il debito se colpisce un avversario.
        if (thrower.debtActive) {
          thrower.debtActive = false;
          thrower.debtTimer = 0;
          this.onAbilityFeedback(thrower, { type: 'ciro_debt_cancelled' });
        }
      }
    }
    if (p.characterId === 'dottore' && p.visionTime > 0) {
      this.onAbilityFeedback(p, { type: 'dottore_hit_anyway' });
    }
    audio.thump(1.3);
    audio.wrong();
    this.entities.get(p.id)?.burstHit();
    this.shocks.spawn(p.x, p.z, p.color);
    this.camera.shake(0.42, 260);
    this.hitStop = HITSTOP_S;
    // CHI / COME: chi ti ha colpito (nome sul telefono e nel feed), oppure "colpo di rimbalzo" / debito
    const thrower = throwerId && throwerId !== p.id ? this.players.find((x) => x.id === throwerId) : undefined;
    if (thrower) this.ctx.vibrate(thrower.id, 70);
    const feed = thrower
      ? `🎯 ${thrower.name.toUpperCase()} → ${p.avatar} ${p.name.toUpperCase()} È FUORI!`
      : throwerId === p.id
        ? `🤦 ${p.avatar} ${p.name.toUpperCase()} SI È COLPITO DA SOLO!`
        : `${p.avatar} ${p.name.toUpperCase()} È FUORI!`;
    this.hud.feedMessage(feed, '#f87171');
    this.ctx.signal(p.id, { type: 'eliminated', by: thrower?.name ?? null });
    const aliveNow = this.players.filter((x) => x.alive).length;
    this.hud.setAlive(aliveNow);
    const duel = aliveNow === 2 && this.players.length > 2 ? say('lastTwo', true) : null;
    if (duel) this.hud.feedMessage(duel, '#fbbf24', 2200);
  }

  // ---- Traiettorie (mira / visione) ----

  private computePath(sx: number, sz: number, dirX: number, dirZ: number): { x: number; z: number }[] {
    const pts: { x: number; z: number }[] = [];
    let x = sx;
    let z = sz;
    let dx = dirX;
    let dz = dirZ;
    let bounces = 0;
    for (let i = 0; i < 20; i++) {
      x += dx * 0.7;
      z += dz * 0.7;
      if (x > ARENA_HALF_W - BALL_RADIUS) {
        x = ARENA_HALF_W - BALL_RADIUS;
        dx = -Math.abs(dx);
        bounces++;
      } else if (x < -ARENA_HALF_W + BALL_RADIUS) {
        x = -ARENA_HALF_W + BALL_RADIUS;
        dx = Math.abs(dx);
        bounces++;
      }
      if (z > ARENA_HALF_D - BALL_RADIUS) {
        z = ARENA_HALF_D - BALL_RADIUS;
        dz = -Math.abs(dz);
        bounces++;
      } else if (z < -ARENA_HALF_D + BALL_RADIUS) {
        z = -ARENA_HALF_D + BALL_RADIUS;
        dz = Math.abs(dz);
        bounces++;
      }
      if (bounces > 2) break;
      pts.push({ x, z });
    }
    return pts;
  }

  private setDots(dots: Mesh[], pts: { x: number; z: number }[], mat: StandardMaterial, y: number): void {
    for (let i = 0; i < dots.length; i++) {
      const d = dots[i];
      if (i < pts.length) {
        d.position.set(pts[i].x, y, pts[i].z);
        if (d.material !== mat) d.material = mat;
        d.isVisible = true;
      } else {
        d.isVisible = false;
      }
    }
  }

  private updateTrajectories(now: number): void {
    const aimer = this.players.find((p) => p.aimTime > 0 && !p.aimThrown && p.alive && !p.falling);
    if (aimer) {
      const dirX = Math.sin(aimer.facing);
      const dirZ = Math.cos(aimer.facing);
      const sx = aimer.x + dirX * (PLAYER_RADIUS + BALL_RADIUS + 0.2);
      const sz = aimer.z + dirZ * (PLAYER_RADIUS + BALL_RADIUS + 0.2);
      this.setDots(this.aimDots, this.computePath(sx, sz, dirX, dirZ), this.aimMat, BALL_HEIGHT);
    } else {
      this.setDots(this.aimDots, [], this.aimMat, BALL_HEIGHT);
    }

    const doc = this.players.find((p) => p.visionTime > 0 && p.alive && !p.falling);
    if (doc) {
      let idx = 0;
      let dangerNear = false;
      for (const ball of this.balls) {
        if (ball.state !== 'flying') continue;
        const speed = Math.hypot(ball.vx, ball.vz) || 1;
        const bx = ball.vx / speed;
        const bz = ball.vz / speed;
        const toX = doc.x - ball.x;
        const toZ = doc.z - ball.z;
        const toD = Math.hypot(toX, toZ) || 1;
        const danger = (bx * toX + bz * toZ) / toD > 0.85 && toD < 9;
        if (danger) dangerNear = true;
        let x = ball.x;
        let z = ball.z;
        for (let k = 0; k < 6 && idx < this.visionDots.length; k++) {
          x += bx * 0.8;
          z += bz * 0.8;
          const d = this.visionDots[idx];
          d.position.set(x, BALL_HEIGHT, z);
          d.material = danger ? this.dangerMat : this.visionMat;
          d.isVisible = true;
          idx++;
        }
      }
      for (let i = idx; i < this.visionDots.length; i++) this.visionDots[i].isVisible = false;

      if (dangerNear && now - this.lastDangerWarn > 450) {
        this.lastDangerWarn = now;
        this.ctx.vibrate(doc.id, 45);
        doc.hitFlash = Math.max(doc.hitFlash, 0.1);
      }
    } else {
      this.setDots(this.visionDots, [], this.visionMat, BALL_HEIGHT);
    }
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

  private buildResults(): PlayerResult[] {
    const firstOut = [...this.eliminatedAt.values()].sort((a, b) => a - b)[0];
    telemetry.metrics('dodgeball', { durationSec: Math.round(this.gameTime), limitSec: Math.round(this.durationSec), out: this.eliminatedAt.size, firstOutSec: firstOut === undefined ? '-' : Math.round(firstOut), byThrow: this.players.reduce((a, p) => a + p.eliminations, 0) });
    const alive = this.players.filter((p) => p.alive);
    const eliminated = this.eliminationOrder.slice().reverse();
    const aliveIds = alive.map((p) => p.id);
    const ranking = [...aliveIds, ...eliminated.filter((id) => !aliveIds.includes(id))];
    return ranking.map((pid, i) => {
      const elim = this.players.find((p) => p.id === pid)?.eliminations ?? 0;
      const t = this.eliminatedAt.get(pid);
      return {
        playerId: pid,
        placement: i + 1,
        score: elim,
        stats: [`${elim} ${elim === 1 ? 'eliminazione' : 'eliminazioni'}`, t === undefined ? 'ultimo in piedi' : `fuori dopo ${Math.round(t)}s`]
      };
    });
  }

  // ---- Feedback abilità ----

  private onAbilityFeedback(p: DodgeballPlayer, f: DodgeballAbilityFeedback): void {
    switch (f.type) {
      case 'goblin_parry':
        this.hud.feedMessage(`${p.avatar} N'CULO, RIPIGLIATELA!`, '#10b981');
        this.ctx.signal(p.id, { type: 'ability', name: "N'CULO, RIPIGLIATELA!" });
        audio.select();
        this.ctx.vibrate(p.id, 60);
        break;
      case 'goblin_reflect':
        this.hud.feedMessage(`${p.avatar} RIPIGLIATELA! → rimandata!`, '#10b981');
        this.ctx.signal(p.id, { type: 'parry_ok' });
        break;
      case 'goblin_whiff':
        this.ctx.signal(p.id, { type: 'parry_miss' });
        break;
      case 'buttafuori_aim':
        this.hud.feedMessage(`${p.avatar} OCCHIO DA POLIGONO!`, '#f97316');
        this.ctx.signal(p.id, { type: 'ability', name: 'OCCHIO DA POLIGONO' });
        audio.select();
        this.ctx.vibrate(p.id, 70);
        break;
      case 'buttafuori_charged':
        this.ctx.signal(p.id, { type: 'charged' });
        audio.boost();
        break;
      case 'dottore_vision':
        this.hud.feedMessage(`${p.avatar} TRE MESI DOPO!`, '#22d3ee');
        this.ctx.signal(p.id, { type: 'ability', name: 'TRE MESI DOPO' });
        audio.select();
        this.ctx.vibrate(p.id, 70);
        break;
      case 'dottore_hit_anyway':
        this.hud.feedMessage(`${p.avatar} ERA SOLO UN PERIODO.`, '#22d3ee');
        this.ctx.signal(p.id, { type: 'era_solo' });
        break;
      case 'judoka_beep':
        this.hud.feedMessage(`${p.avatar} 🚚 CARICO E SCARICO!`, '#facc15');
        this.ctx.signal(p.id, { type: 'ability', name: 'CARICO E SCARICO' });
        this.playTruckBeeps();
        break;
      case 'judoka_truck':
        this.hud.feedMessage(`🚚 BIP BIP BIP!`, '#facc15');
        this.ctx.signal(p.id, { type: 'truck_go' });
        audio.boost();
        break;
      case 'judoka_scarica':
        this.hud.feedMessage(`${p.avatar} SCARICA!`, '#facc15');
        this.ctx.signal(p.id, { type: 'scarica' });
        break;
      case 'judoka_wall':
        this.hud.feedMessage(`${p.avatar} CONSEGNA FALLITA 💀`, '#f87171');
        this.ctx.signal(p.id, { type: 'truck_fail' });
        audio.hit();
        this.ctx.vibrate(p.id, 120);
        break;
      case 'ciro_arm':
        this.hud.feedMessage(`${p.avatar} PAGO DOMANI!`, '#a78bfa');
        this.ctx.signal(p.id, { type: 'ability', name: 'PAGO DOMANI' });
        audio.select();
        this.ctx.vibrate(p.id, 70);
        break;
      case 'ciro_debt':
        this.hud.feedMessage(`${p.avatar} DEBITO! Colpisci qualcuno!`, '#a78bfa');
        this.ctx.signal(p.id, { type: 'debt' });
        audio.hit();
        this.ctx.vibrate(p.id, 110);
        break;
      case 'ciro_debt_cancelled':
        this.hud.feedMessage(`${p.avatar} DEBITO SALDATO!`, '#4ade80');
        this.ctx.signal(p.id, { type: 'debt_ok' });
        audio.select();
        break;
      case 'ciro_debt_due':
        this.hud.feedMessage(`${p.avatar} ESATTORE! DEBITO RISCOSSO 💀`, '#f472b6');
        this.ctx.signal(p.id, { type: 'debt_due' });
        audio.wrong();
        this.ctx.vibrate(p.id, 130);
        break;
    }
  }

  private playTruckBeeps(): void {
    for (let i = 0; i < 3; i++) {
      window.setTimeout(() => {
        if (!this.disposed) audio.tick();
      }, i * 300);
    }
  }

  // ---- Visual ----

  private syncBallMeshes(now: number): void {
    for (let i = 0; i < this.balls.length; i++) {
      const ball = this.balls[i];
      const mesh = this.ballMeshes[i];
      if (!mesh) continue;
      if (ball.state === 'held' && ball.holderId) {
        const holder = this.players.find((p) => p.id === ball.holderId);
        const entity = holder ? this.entities.get(holder.id) : null;
        if (entity && holder) {
          const h = entity.handAnchor;
          const sinF = Math.sin(holder.facing);
          const cosF = Math.cos(holder.facing);
          const lx = h.x * cosF + h.z * sinF;
          const lz = -h.x * sinF + h.z * cosF;
          // Palloni del camion: leggermente sfalsati.
          let off = 0;
          if (holder.truckBalls.length > 1) {
            const pos = holder.truckBalls.indexOf(i);
            off = pos * 0.45;
          }
          mesh.position.set(holder.x + lx + off, holder.y + h.y, holder.z + lz + off * 0.3);
        }
      } else if (ball.state === 'free') {
        // palla libera: ondeggia piano ("prendimi") e ha un anello a terra
        mesh.position.set(ball.x, BALL_HEIGHT + Math.sin(now * 0.005 + i * 2) * 0.09, ball.z);
      } else {
        mesh.position.set(ball.x, BALL_HEIGHT, ball.z);
      }
      mesh.rotation.y += 0.08;
      mesh.rotation.x += 0.05;
      const trail = this.trails[i];
      if (trail) trail.emitRate = ball.state === 'flying' ? 40 + 80 * Math.min(1, Math.hypot(ball.vx, ball.vz) / THROW_SPEED) : 0;
      const ring = this.pickRings[i];
      if (ring) {
        const free = ball.state === 'free';
        if (ring.isVisible !== free) ring.isVisible = free;
        if (free) {
          ring.position.set(ball.x, 0.07, ball.z);
          const k = 1 + Math.sin(now * 0.006 + i) * 0.09;
          ring.scaling.set(k, 1, k);
        }
      }
    }
  }

  // ---- Ciclo di vita ----

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    window.removeEventListener('resize', this.onResize);
    safely('entities', () => {
      for (const e of this.entities.values()) e.dispose();
    });
    safely('camera.dispose', () => this.camera.dispose());
    safely('hud.dispose', () => this.hud.dispose());
    safely('engine.stopRenderLoop', () => this.engine.stopRenderLoop());
    safely('scene.dispose', () => this.scene.dispose());
    safely('engine.dispose', () => this.engine.dispose());
  }
}
