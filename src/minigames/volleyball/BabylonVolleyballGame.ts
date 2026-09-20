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
  FIELD_HALF_W,
  FIELD_HALF_D,
  NET_HEIGHT,
  PLAYER_RADIUS,
  BALL_RADIUS,
  ACCEL,
  MAX_SPEED,
  FRICTION,
  JUMP_VY,
  GRAVITY,
  HIT_RADIUS,
  HIT_REACH,
  HIT_COOLDOWN,
  BALL_GRAVITY,
  BALL_NORMAL_UP,
  BALL_NORMAL_SPEED,
  BALL_SMASH_DOWN,
  BALL_SMASH_SPEED,
  BALL_SERVE_UP,
  BALL_SERVE_SPEED,
  clampBallSpeed,
  hitDirection,
  WIN_SCORE,
  MATCH_POINT_AT,
  TEAM_COLOR,
  TEAM_LABEL,
  createVolleyballPlayer,
  createBall
} from './volleyballTypes';
import type { VolleyballPlayer, VolleyballBall, Team } from './volleyballTypes';
import { ArenaEntity } from '../arena/arenaEntity';
import { ArenaCamera } from '../arena/arenaCamera';
import { SoccerHud } from '../soccer/soccerHud';
import { buildVolleyballEnvironment } from './volleyballEnvironment';
import { VolleyballAbilities, JAGER_POWER_MULT, JUDOKA_ACCEL_MULT, JUDOKA_HIT_MULT } from './volleyballAbilities';
import type { VolleyballAbilityFeedback } from './volleyballAbilities';
import { readMove } from '../moveInput';
import { runSteps } from '../../core/frameClock';
import { guardLoop, safely } from '../../core/loopGuard';

const COUNTDOWN_S = 3.2;
const INTRO_SECONDS = 3.4;
const POINT_PAUSE_SECONDS = 2.0;
const SAVE_RADIUS = 3.2;

type Phase = 'intro' | 'countdown' | 'playing' | 'pointPause' | 'ended';

export class BabylonVolleyballGame {
  private engine: Engine;
  private scene: Scene;
  private players: VolleyballPlayer[] = [];
  private entities = new Map<PlayerId, ArenaEntity>();
  private ball: VolleyballBall = createBall();
  private ballMesh: Mesh;
  private landingRing: Mesh;
  private ballShadow: Mesh;
  private env: ReturnType<typeof buildVolleyballEnvironment>;
  private camera: ArenaCamera;
  private hud: SoccerHud;
  private abilities = new VolleyballAbilities();
  private order: PlayerId[];

  private phase: Phase = 'intro';
  private phaseTime = 0;
  private countdown = COUNTDOWN_S;
  private lastCountInt = 4;
  private redScore = 0;
  private blueScore = 0;
  private servingTeam: Team = 'red';
  private serverId: PlayerId | null = null;
  private serveOrderIdx = 0;
  private gravityScale = 1;
  private handicappedTeam: Team | null = null;

  private resultsSent = false;
  private disposed = false;
  private paused = false;
  private celebrateTime = 0;
  private winnerTeam: Team | null = null;

  private onResize = (): void => this.engine.resize();

  constructor(
    private canvas: HTMLCanvasElement,
    private ctx: MinigameContext
  ) {
    this.gravityScale = ctx.modifier?.id === 'gravita_bassa' ? 0.5 : 1;

    this.engine = new Engine(canvas, true, { antialias: true, stencil: true, adaptToDeviceRatio: true });
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.6, 0.82, 0.95, 1);

    this.env = buildVolleyballEnvironment(this.scene);
    this.camera = new ArenaCamera(this.scene, canvas);
    this.hud = new SoccerHud(this.scene, '🏐 PALLAVOLO DEI DISAGIATI');
    this.hud.setNote(ctx.modifier?.name ? `⚠️ ${ctx.modifier.name}` : '');

    const dotTex = new DynamicTexture('volleyDot', 16, this.scene, false);
    const dc = dotTex.getContext() as unknown as CanvasRenderingContext2D;
    dc.fillStyle = 'white';
    dc.beginPath();
    dc.arc(8, 8, 7, 0, Math.PI * 2);
    dc.fill();
    dotTex.update();

    // Squadre casuali
    this.order = this.shuffle([...ctx.playerIds]);
    const n = this.order.length;
    const redGetsExtra = this.ctx.rng.next() < 0.5;
    const redCount = redGetsExtra ? Math.ceil(n / 2) : Math.floor(n / 2);
    this.handicappedTeam = redCount > n - redCount ? 'red' : n - redCount > redCount ? 'blue' : null;

    ctx.players.forEach((snap) => {
      const idx = this.order.indexOf(snap.id);
      const team: Team = idx < redCount ? 'red' : 'blue';
      const p = createVolleyballPlayer(snap.id, snap.characterId, snap.color, snap.avatar, snap.name, team, team === this.handicappedTeam);
      this.players.push(p);
      const entity = new ArenaEntity(this.scene, dotTex, TEAM_COLOR[team], snap.characterId, snap.avatar, snap.displayName);
      this.entities.set(p.id, entity);
    });

    this.spawnTeams();

    // Palla
    const ballMat = new StandardMaterial('ballMat', this.scene);
    ballMat.diffuseColor = new Color3(0.98, 0.95, 0.9);
    ballMat.specularColor = new Color3(0.3, 0.3, 0.3);
    this.ballMesh = MeshBuilder.CreateSphere('volleyBall', { diameter: BALL_RADIUS * 2, segments: 12 }, this.scene);
    this.ballMesh.material = ballMat;

    // Anello zona di caduta
    const ringMat = new StandardMaterial('ringMat', this.scene);
    ringMat.diffuseColor = new Color3(1, 0.9, 0.3);
    ringMat.emissiveColor = new Color3(1, 0.6, 0.1);
    ringMat.disableLighting = true;
    this.landingRing = MeshBuilder.CreateTorus('landingRing', { diameter: 1.3, thickness: 0.12, tessellation: 24 }, this.scene);
    this.landingRing.rotation.x = Math.PI / 2;
    this.landingRing.material = ringMat;
    this.landingRing.isVisible = false;

    // Ombra della palla sul campo: aiuta a leggere altezza e posizione (più piccola/scura quando la palla è alta).
    const shadowMat = new StandardMaterial('ballShadowMat', this.scene);
    shadowMat.diffuseColor = new Color3(0, 0, 0);
    shadowMat.emissiveColor = new Color3(0, 0, 0);
    shadowMat.specularColor = new Color3(0, 0, 0);
    shadowMat.alpha = 0.4;
    shadowMat.disableLighting = true;
    this.ballShadow = MeshBuilder.CreateDisc('ballShadow', { radius: BALL_RADIUS * 1.1, tessellation: 20 }, this.scene);
    this.ballShadow.rotation.x = Math.PI / 2;
    this.ballShadow.material = shadowMat;
    this.ballShadow.isPickable = false;

    this.hud.setScore(0, 0);
    this.hud.setTimer(0);
    this.showTeamIntro();

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

  private shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.ctx.rng.next() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  private showTeamIntro(): void {
    this.phase = 'intro';
    this.phaseTime = INTRO_SECONDS;
    const red = this.players.filter((p) => p.team === 'red').map((p) => `${p.avatar} ${p.name}`).join(' · ');
    const blue = this.players.filter((p) => p.team === 'blue').map((p) => `${p.avatar} ${p.name}`).join(' · ');
    this.hud.feedMessage(`🔴 ROSSI: ${red}`, '#f87171', 3400);
    this.hud.feedMessage(`🔵 BLU: ${blue}`, '#60a5fa', 3400);
    if (this.handicappedTeam) {
      this.hud.setNote(`⚠️ SUPERIORITÀ NUMERICA: ${TEAM_LABEL[this.handicappedTeam]} CON MALUS`, '#fbbf24');
    }
    for (const p of this.players) {
      this.ctx.signal(p.id, { type: 'team', team: p.team });
    }
  }

  private spawnTeams(): void {
    for (const p of this.players) {
      p.y = 0;
      p.vy = 0;
      p.vx = 0;
      p.vz = 0;
      p.hitCooldown = 0;
      const teamIdx = this.players.filter((q) => q.team === p.team).indexOf(p);
      const count = this.players.filter((q) => q.team === p.team).length;
      p.x = count > 1 ? -FIELD_HALF_W * 0.7 + teamIdx * ((FIELD_HALF_W * 1.4) / (count - 1)) : 0;
      p.z = p.team === 'red' ? -FIELD_HALF_D + 2 : FIELD_HALF_D - 2;
      p.facing = p.team === 'red' ? 0 : Math.PI; // rossi guardano +Z (rete), blu -Z
    }
    this.resetBall();
  }

  private resetBall(): void {
    this.ball = createBall();
    // La palla parte dal battitore.
    const team = this.players.filter((p) => p.team === this.servingTeam);
    const server = team[this.serveOrderIdx % Math.max(1, team.length)] ?? this.players[0];
    this.serverId = server.id;
    this.serveOrderIdx++;
    this.ball.state = 'held';
    this.ball.holderId = server.id;
    this.ball.x = server.x;
    this.ball.z = server.z + (server.team === 'red' ? -1.2 : 1.2);
    this.ball.y = 2.4;
    this.ball.vx = 0;
    this.ball.vy = 0;
    this.ball.vz = 0;
    this.ball.teamTouches = 0;
    this.ball.crossedNet = false;
  }

  // ---- Loop ----

  private step(dt: number): void {
    const now = performance.now();

    if (this.phase === 'intro') {
      this.phaseTime -= dt;
      if (this.phaseTime <= 0) {
        this.phase = 'countdown';
        this.countdown = COUNTDOWN_S;
        this.hud.setCountdown('3');
      }
    } else if (this.phase === 'countdown') {
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
      }
    } else if (this.phase === 'playing') {
      this.updateGameplay(dt, now);
    } else if (this.phase === 'pointPause') {
      this.phaseTime -= dt;
      if (this.phaseTime <= 0) {
        this.resetBall();
        this.phase = 'playing';
      }
    } else if (this.phase === 'ended') {
      this.celebrateTime -= dt;
      if (this.celebrateTime <= 0 && !this.resultsSent) {
        this.resultsSent = true;
        this.ctx.finish({ results: this.buildResults() });
      }
    }

    // Palla tenuta dal battitore: segue il giocatore.
    if (this.ball.state === 'held' && this.ball.holderId) {
      const holder = this.players.find((p) => p.id === this.ball.holderId);
      if (holder) {
        this.ball.x = holder.x;
        this.ball.z = holder.z + (holder.team === 'red' ? -1.2 : 1.2);
        this.ball.y = 2.4;
      }
    }

    // Visuali
    for (const p of this.players) {
      this.entities.get(p.id)?.updateVisual(p, dt, now);
    }
    this.ballMesh.position.set(this.ball.x, this.ball.y, this.ball.z);
    this.ballShadow.position.set(this.ball.x, 0.03, this.ball.z);
    const shadowScale = Math.max(0.45, 1 - this.ball.y / 9);
    this.ballShadow.scaling.set(shadowScale, shadowScale, 1);
    this.updateLandingRing();
    const subjects = this.players.map((p) => ({ alive: p.alive, falling: p.falling, x: p.x, z: p.z }));
    subjects.push({ alive: true, falling: false, x: this.ball.x, z: this.ball.z });
    this.camera.update(dt, subjects, now);
    this.env.update(now);

    this.ctx.input.update();
  }

  private timeOutClearCountdown(): void {
    window.setTimeout(() => {
      if (!this.disposed) this.hud.clearCountdown();
    }, 800);
  }

  private updateGameplay(dt: number, now: number): void {
    for (const p of this.players) this.stepPlayer(p, dt);
    this.updateBall(dt);
    void now;
  }

  // ---- Giocatore ----

  private stepPlayer(p: VolleyballPlayer, dt: number): void {
    p.hitCooldown = Math.max(0, p.hitCooldown - dt);
    p.stunTime = Math.max(0, p.stunTime - dt);
    p.hitFlash = Math.max(0, p.hitFlash - dt);
    this.abilities.update(p, dt);

    const input = this.ctx.input.get(p.id);
    const mv = readMove(input);
    let ax = mv.x;
    let az = mv.z;
    const mag = Math.hypot(ax, az);
    if (mag > 1) {
      ax /= mag;
      az /= mag;
    }

    const effSpeed = p.speedMult * (p.lightTime > 0 ? 1.3 : 1);
    const effAccel = ACCEL * effSpeed * (p.judokaCharge ? JUDOKA_ACCEL_MULT : 1);
    const effMax = MAX_SPEED * effSpeed;

    // Movimento (non attraversare la rete)
    p.facing = mag > 0.15 ? Math.atan2(ax, az) : p.facing;
    p.vx += ax * effAccel * dt;
    p.vz += az * effAccel * dt;
    const damp = Math.exp(-FRICTION * dt * (p.lightTime > 0 ? 0.5 : 1));
    p.vx *= damp;
    p.vz *= damp;
    const sp = Math.hypot(p.vx, p.vz);
    if (sp > effMax) {
      p.vx = (p.vx / sp) * effMax;
      p.vz = (p.vz / sp) * effMax;
    }
    p.x += p.vx * dt;
    p.z += p.vz * dt;
    p.x = Math.max(-FIELD_HALF_W + PLAYER_RADIUS, Math.min(FIELD_HALF_W - PLAYER_RADIUS, p.x));
    // Blocco rete
    if (p.team === 'red') p.z = Math.min(-PLAYER_RADIUS - 0.2, p.z);
    else p.z = Math.max(PLAYER_RADIUS + 0.2, p.z);
    p.z = Math.max(-FIELD_HALF_D + PLAYER_RADIUS, Math.min(FIELD_HALF_D - PLAYER_RADIUS, p.z));

    // Salto
    if (input.justPressed('jump') && p.y <= 0.01) {
      p.vy = JUMP_VY * p.jumpMult * (p.lightTime > 0 ? 1.3 : 1);
      p.y = 0.02;
      audio.select();
      this.ctx.vibrate(p.id, 20);
    }

    // Gravità salto
    if (p.y > 0 || p.vy !== 0) {
      p.vy -= GRAVITY * this.gravityScale * dt;
      p.y += p.vy * dt;
      if (p.y <= 0) {
        p.y = 0;
        p.vy = 0;
      }
    }

    // Colpo / servizio
    if (input.justPressed('hit')) {
      if (this.ball.state === 'held' && this.ball.holderId === p.id) {
        this.serve(p);
      } else {
        this.tryHit(p);
      }
    }

    // Abilità
    if (input.justPressed('ability')) {
      this.abilities.onAbilityPress(p, (f) => this.onAbilityFeedback(p, f));
    }
  }

  private serve(p: VolleyballPlayer): void {
    this.ball.state = 'flying';
    this.ball.holderId = null;
    this.ball.lastTouchId = p.id;
    this.ball.teamTouches = 1;
    this.ball.crossedNet = false;
    const dirZ = p.team === 'red' ? 1 : -1;
    this.ball.vx = (Math.random() - 0.5) * 3;
    this.ball.vy = BALL_SERVE_UP;
    this.ball.vz = dirZ * BALL_SERVE_SPEED;
    this.ball.x = p.x;
    this.ball.z = p.z + dirZ * 0.6;
    audio.select();
    this.entities.get(p.id)?.playThrow();
    this.ctx.vibrate(p.id, 40);
    this.ctx.signal(p.id, { type: 'served' });
  }

  private tryHit(p: VolleyballPlayer): void {
    if (this.ball.state !== 'flying') return;
    if (p.hitCooldown > 0) return;
    const dist = Math.hypot(this.ball.x - p.x, this.ball.z - p.z);
    if (dist > HIT_RADIUS) return;
    if (this.ball.y < p.y - 0.4 || this.ball.y > p.y + HIT_REACH) return;

    p.hitCooldown = HIT_COOLDOWN * p.hitCooldownMult;

    // Salvataggio disperato (Ciro "PAGO DOMANI"): palla congelata vicino a terra.
    if (this.ball.frozenTimer > 0) {
      this.ball.frozenTimer = 0;
      p.saves++;
      if (p.characterId === 'ciro') this.onAbilityFeedback(p, { type: 'ciro_saved' });
      else this.hud.feedMessage(`${p.avatar} SALVATAGGIO!`, '#4ade80', 1200);
    }

    const isSmash = p.y > 0.4 && this.ball.y > NET_HEIGHT * 0.8 && Math.abs(p.z) < 2.4;
    const perfect = this.ball.y > p.y + 1.1 && this.ball.y < p.y + 2.2;
    const dirZ = p.team === 'red' ? 1 : -1;
    // Direzione orizzontale unitaria (avanti + lieve assist verso il centro): la velocità orizzontale
    // del colpo è quella nominale, non dipende più da dove si trova la palla.
    const aim = hitDirection(this.ball.x, dirZ);

    let vx = aim.dx;
    let vy: number;
    let vz = aim.dz;

    if (isSmash) {
      let speed = BALL_SMASH_SPEED;
      let down = BALL_SMASH_DOWN;
      if (p.jagerBomb) {
        if (perfect) {
          speed *= JAGER_POWER_MULT;
          down *= 1.3;
          this.onAbilityFeedback(p, { type: 'goblin_jager_boom' });
        } else {
          this.onAbilityFeedback(p, { type: 'goblin_jager_wasted' });
        }
        p.jagerBomb = false;
      }
      if (p.judokaCharge) {
        speed *= JUDOKA_HIT_MULT;
        p.judokaCharge = false;
        p.judokaTime = 0;
        this.onAbilityFeedback(p, { type: 'judoka_strong' });
      }
      vx *= speed;
      vz *= speed;
      vy = down;
      p.smashes++;
      audio.hit();
      this.camera.shake(0.25, 200);
      this.ctx.signal(p.id, { type: 'smash' });
    } else {
      let up = BALL_NORMAL_UP;
      let speed = BALL_NORMAL_SPEED;
      if (p.muroTime > 0) {
        up *= 1.1;
        if (!p.muroStableDone) {
          p.muroStableDone = true;
          this.onAbilityFeedback(p, { type: 'buttafuori_stable' });
        }
      }
      if (p.judokaCharge) {
        speed *= JUDOKA_HIT_MULT;
        up *= 1.2;
        p.judokaCharge = false;
        p.judokaTime = 0;
        this.onAbilityFeedback(p, { type: 'judoka_strong' });
      }
      vx *= speed;
      vz *= speed;
      vy = up;
      p.receives++;
      audio.select();
      this.ctx.signal(p.id, { type: 'receive' });
    }

    this.ball.vx = vx;
    this.ball.vy = vy;
    this.ball.vz = vz;
    clampBallSpeed(this.ball);
    this.ball.lastTouchId = p.id;
    this.ball.teamTouches++;
    this.entities.get(p.id)?.playThrow();
    this.ctx.vibrate(p.id, perfect ? 80 : 40);
  }

  // ---- Palla ----

  private updateBall(dt: number): void {
    const b = this.ball;
    if (b.state !== 'flying') return;

    // Ciro: congelamento punto (salvataggio disperato)
    if (b.frozenTimer > 0) {
      b.frozenTimer -= dt;
      b.vy = 0;
      if (b.y < 0.15) b.y = 0.15;
      if (b.frozenTimer <= 0) {
        b.frozenTimer = 0;
        this.scorePoint();
      }
      return;
    }

    const prevZ = b.z;
    b.vy -= BALL_GRAVITY * this.gravityScale * dt;
    clampBallSpeed(b);
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.z += b.vz * dt;

    // Rete: attraversamento a z=0 sotto l'altezza della rete
    if ((prevZ < 0 && b.z >= 0) || (prevZ > 0 && b.z <= 0)) {
      if (b.y < NET_HEIGHT) {
        b.z = prevZ;
        b.vz = -b.vz * 0.55;
        b.vx *= 0.8;
        audio.tick();
        this.hud.feedMessage('RETE! 🕸️', '#fbbf24', 900);
        if (b.lastTouchId) {
          const toucher = this.players.find((p) => p.id === b.lastTouchId);
          if (toucher) toucher.errors++;
        }
      } else {
        b.crossedNet = true;
      }
    }

    // Bordi campo
    if (b.x > FIELD_HALF_W) {
      b.x = FIELD_HALF_W;
      b.vx = -Math.abs(b.vx);
    } else if (b.x < -FIELD_HALF_W) {
      b.x = -FIELD_HALF_W;
      b.vx = Math.abs(b.vx);
    }
    if (b.z > FIELD_HALF_D) {
      b.z = FIELD_HALF_D;
      b.vz = -Math.abs(b.vz);
    } else if (b.z < -FIELD_HALF_D) {
      b.z = -FIELD_HALF_D;
      b.vz = Math.abs(b.vz);
    }

    // Terra: punto
    if (b.y <= 0) {
      // Ciro: congelamento punto
      const ciro = this.players.find((p) => p.deferArmed && p.team === this.landingTeam(b.z) && Math.hypot(p.x - b.x, p.z - b.z) < SAVE_RADIUS);
      if (ciro) {
        ciro.deferArmed = false;
        ciro.armTimer = 0;
        b.y = 0.15;
        b.vy = 0;
        b.frozenTimer = 1.0;
        this.hud.feedMessage(`${ciro.avatar} PAGO DOMANI — salvataggio disperato!`, '#a78bfa', 1600);
        this.ctx.signal(ciro.id, { type: 'frozen' });
        return;
      }
      this.scorePoint();
    }
  }

  private landingTeam(z: number): Team {
    return z < 0 ? 'red' : 'blue';
  }

  private scorePoint(): void {
    const landingZ = this.ball.z;
    const landingTeam = this.landingTeam(landingZ);
    const scoringTeam: Team = landingTeam === 'red' ? 'blue' : 'red';

    if (scoringTeam === 'red') this.redScore++;
    else this.blueScore++;
    this.hud.setScore(this.redScore, this.blueScore);

    // MVP: chi ha fatto il punto (ultimo tocco della squadra che segna) o errore.
    const last = this.ball.lastTouchId;
    if (last) {
      const toucher = this.players.find((p) => p.id === last);
      if (toucher && toucher.team === scoringTeam) toucher.points++;
      else if (toucher) toucher.errors++;
    }

    audio.fanfare();
    this.camera.shake(0.3, 260);
    this.hud.feedMessage(`💥 PUNTO ${TEAM_LABEL[scoringTeam]}! ${this.redScore} — ${this.blueScore}`, scoringTeam === 'red' ? '#f87171' : '#60a5fa', 2600);
    for (const p of this.players) this.ctx.vibrate(p.id, p.team === scoringTeam ? 150 : 70);
    this.ctx.signal(null, { type: 'point', team: scoringTeam });

    this.servingTeam = scoringTeam;
    this.phase = 'pointPause';
    this.phaseTime = POINT_PAUSE_SECONDS;

    if (this.redScore >= WIN_SCORE || this.blueScore >= WIN_SCORE) {
      this.winnerTeam = scoringTeam;
      // partita finita: dopo la pausa punto si chiude
      this.phase = 'ended';
      this.celebrateTime = 2.6;
      this.hud.feedMessage(`🏆 VINCE LA SQUADRA ${TEAM_LABEL[scoringTeam]}! ${this.redScore} — ${this.blueScore}`, '#fbbf24', 4000);
      this.ctx.signal(null, { type: 'matchEnd', winner: scoringTeam });
      for (const p of this.players) {
        if (p.team === scoringTeam) this.ctx.signal(p.id, { type: 'won' });
      }
    } else if (this.redScore >= MATCH_POINT_AT || this.blueScore >= MATCH_POINT_AT) {
      this.hud.setNote('🔥 MATCH POINT', '#fbbf24');
      this.hud.feedMessage('🔥 MATCH POINT!', '#fbbf24', 2000);
    }
  }

  private updateLandingRing(): void {
    const b = this.ball;
    // Visibile per TUTTO il volo (anche in salita): il ricevente ha subito dove andare.
    if (b.state !== 'flying' || b.frozenTimer > 0) {
      this.landingRing.isVisible = false;
      return;
    }
    const g = BALL_GRAVITY * this.gravityScale;
    const disc = b.vy * b.vy + 2 * g * b.y;
    if (disc < 0) {
      this.landingRing.isVisible = false;
      return;
    }
    const t = (b.vy + Math.sqrt(disc)) / g;
    const lx = b.x + b.vx * t;
    const lz = b.z + b.vz * t;
    this.landingRing.position.set(Math.max(-FIELD_HALF_W, Math.min(FIELD_HALF_W, lx)), 0.04, Math.max(-FIELD_HALF_D, Math.min(FIELD_HALF_D, lz)));
    this.landingRing.isVisible = true;
  }

  private mvp(p: VolleyballPlayer): number {
    return p.points * 3 + p.smashes * 2 + p.receives + p.saves - p.errors * 2;
  }

  private buildResults(): { playerId: PlayerId; placement: number; score: number }[] {
    const winners = this.players.filter((p) => p.team === this.winnerTeam).sort((a, b) => this.mvp(b) - this.mvp(a));
    const losers = this.players.filter((p) => p.team !== this.winnerTeam).sort((a, b) => this.mvp(b) - this.mvp(a));
    const ranking = [...winners, ...losers];
    return ranking.map((p, i) => ({ playerId: p.id, placement: i + 1, score: this.mvp(p) }));
  }

  // ---- Feedback abilità ----

  private onAbilityFeedback(p: VolleyballPlayer, f: VolleyballAbilityFeedback): void {
    switch (f.type) {
      case 'goblin_jager':
        this.hud.feedMessage(`${p.avatar} JÄGER BOMB!`, '#10b981');
        this.ctx.signal(p.id, { type: 'ability', name: 'JÄGER BOMB' });
        audio.select();
        this.ctx.vibrate(p.id, 60);
        break;
      case 'goblin_jager_boom':
        this.hud.feedMessage(`${p.avatar} JÄGER BOMB! 💥 SMASH!`, '#10b981');
        this.ctx.signal(p.id, { type: 'jager_boom' });
        break;
      case 'goblin_jager_wasted':
        this.hud.feedMessage(`${p.avatar} JÄGER BOMB sprecata...`, '#9ca3af');
        this.ctx.signal(p.id, { type: 'jager_wasted' });
        break;
      case 'buttafuori_muro':
        this.hud.feedMessage(`${p.avatar} MURO DEL POLIGONO!`, '#f97316');
        this.ctx.signal(p.id, { type: 'ability', name: 'MURO DEL POLIGONO' });
        audio.select();
        this.ctx.vibrate(p.id, 70);
        break;
      case 'buttafuori_stable':
        this.ctx.signal(p.id, { type: 'stable' });
        break;
      case 'dottore_light':
        this.hud.feedMessage(`${p.avatar} 20 KG IN UN MESE!`, '#22d3ee');
        this.ctx.signal(p.id, { type: 'ability', name: '20 KG IN UN MESE' });
        audio.select();
        this.ctx.vibrate(p.id, 70);
        break;
      case 'judoka_charge':
        this.hud.feedMessage(`${p.avatar} CARICO E SCARICO!`, '#facc15');
        this.ctx.signal(p.id, { type: 'ability', name: 'CARICO E SCARICO' });
        audio.select();
        this.ctx.vibrate(p.id, 70);
        break;
      case 'judoka_strong':
        this.hud.feedMessage(`${p.avatar} SCARICA! 💥`, '#facc15');
        this.ctx.signal(p.id, { type: 'scarica' });
        break;
      case 'ciro_arm':
        this.hud.feedMessage(`${p.avatar} PAGO DOMANI!`, '#a78bfa');
        this.ctx.signal(p.id, { type: 'ability', name: 'PAGO DOMANI' });
        audio.select();
        this.ctx.vibrate(p.id, 70);
        break;
      case 'ciro_saved':
        this.hud.feedMessage(`${p.avatar} DEBITO SALDATO!`, '#4ade80');
        this.ctx.signal(p.id, { type: 'debt_ok' });
        break;
      case 'ciro_failed':
        this.ctx.signal(p.id, { type: 'debt_fail' });
        break;
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
