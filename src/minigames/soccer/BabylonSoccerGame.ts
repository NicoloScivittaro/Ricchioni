import { Engine, Scene, Color4, DynamicTexture, MeshBuilder, StandardMaterial, Color3, Mesh } from '@babylonjs/core';
import type { PlayerId } from '../../../shared/types';
import type { MinigameContext } from '../types';
import { audio } from '../../core/AudioManager';
import {
  FIELD_HALF_W,
  FIELD_HALF_D,
  GOAL_HALF_W,
  PLAYER_RADIUS,
  BALL_RADIUS,
  ACCEL,
  MAX_SPEED,
  FRICTION,
  DASH_SPEED,
  DASH_TIME,
  DASH_COOLDOWN,
  POSSESSION_RADIUS,
  KICK_MIN,
  KICK_MAX,
  CHARGE_TIME,
  BALL_FRICTION,
  BALL_MAX_SPEED,
  MATCH_SECONDS,
  GOLDEN_GOAL_SECONDS,
  INTRO_SECONDS,
  GOAL_PAUSE_SECONDS,
  AIM_KICK_MULT,
  LIGHT_SPEED,
  CURVE_RATE,
  JUDOKA_CHARGE_SPEED,
  JUDOKA_CHARGE_POWER,
  TEAM_COLOR,
  TEAM_LABEL,
  createSoccerPlayer,
  createBall
} from './soccerTypes';
import type { SoccerPlayer, SoccerBall, Team } from './soccerTypes';
import { ArenaEntity } from '../arena/arenaEntity';
import { ArenaCamera } from '../arena/arenaCamera';
import { SoccerHud } from './soccerHud';
import { buildSoccerEnvironment } from './soccerEnvironment';
import { SoccerAbilities } from './soccerAbilities';
import { readMove } from '../moveInput';
import type { SoccerAbilityFeedback } from './soccerAbilities';
import { guardLoop } from '../../core/loopGuard';

const COUNTDOWN_S = 3.2;
const BALL_HEIGHT = 0.35;

type Phase = 'intro' | 'countdown' | 'playing' | 'goalPause' | 'goldenGoal' | 'ended';

export class BabylonSoccerGame {
  private engine: Engine;
  private scene: Scene;
  private players: SoccerPlayer[] = [];
  private entities = new Map<PlayerId, ArenaEntity>();
  private ball: SoccerBall = createBall();
  private ballMesh: Mesh;
  private env: ReturnType<typeof buildSoccerEnvironment>;
  private camera: ArenaCamera;
  private hud: SoccerHud;
  private abilities = new SoccerAbilities();
  private order: PlayerId[];

  private aimDots: Mesh[] = [];
  private aimMat: StandardMaterial;

  private phase: Phase = 'intro';
  private phaseTime = 0;
  private countdown = COUNTDOWN_S;
  private lastCountInt = 4;
  private matchTime = MATCH_SECONDS;
  private goldenTime = GOLDEN_GOAL_SECONDS;
  private redScore = 0;
  private blueScore = 0;
  private teamKicks: Record<Team, number> = { red: 0, blue: 0 };
  private handicappedTeam: Team | null = null;
  private goalDuringGolden = false;

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
    this.engine = new Engine(canvas, true, { antialias: true, stencil: true, adaptToDeviceRatio: true });
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.05, 0.1, 0.08, 1);

    this.env = buildSoccerEnvironment(this.scene);
    this.camera = new ArenaCamera(this.scene, canvas);
    this.hud = new SoccerHud(this.scene);
    this.hud.setNote(ctx.modifier?.name ? `⚠️ ${ctx.modifier.name}` : '');

    const dotTex = new DynamicTexture('soccerDot', 16, this.scene, false);
    const dc = dotTex.getContext() as unknown as CanvasRenderingContext2D;
    dc.fillStyle = 'white';
    dc.beginPath();
    dc.arc(8, 8, 7, 0, Math.PI * 2);
    dc.fill();
    dotTex.update();

    this.aimMat = new StandardMaterial('aimMat', this.scene);
    this.aimMat.diffuseColor = new Color3(0.2, 0.9, 1);
    this.aimMat.emissiveColor = new Color3(0.3, 0.9, 1);
    this.aimMat.disableLighting = true;
    for (let i = 0; i < 20; i++) {
      const d = MeshBuilder.CreateSphere('aimDot', { diameter: 0.22, segments: 6 }, this.scene);
      d.material = this.aimMat;
      d.isVisible = false;
      this.aimDots.push(d);
    }

    // Squadre casuali
    this.order = this.shuffle([...ctx.playerIds]);
    const n = this.order.length;
    const redGetsExtra = this.ctx.rng.next() < 0.5;
    const redCount = redGetsExtra ? Math.ceil(n / 2) : Math.floor(n / 2);
    this.handicappedTeam = redCount > n - redCount ? 'red' : n - redCount > redCount ? 'blue' : null;

    ctx.players.forEach((snap) => {
      const idx = this.order.indexOf(snap.id);
      const team: Team = idx < redCount ? 'red' : 'blue';
      const handicapped = team === this.handicappedTeam;
      const p = createSoccerPlayer(snap.id, snap.characterId, snap.color, snap.avatar, snap.name, team, handicapped);
      this.players.push(p);
      // Colore maglia = colore squadra (identità personale via nameplate + tratti).
      const entity = new ArenaEntity(this.scene, dotTex, TEAM_COLOR[team], snap.characterId, snap.avatar, snap.displayName);
      this.entities.set(p.id, entity);
    });

    this.spawnTeams();
    this.positionBall(0, 0);

    // Palla
    const ballMat = new StandardMaterial('ballMat', this.scene);
    ballMat.diffuseColor = new Color3(0.98, 0.98, 0.99);
    ballMat.specularColor = new Color3(0.3, 0.3, 0.3);
    this.ballMesh = MeshBuilder.CreateSphere('soccerBall', { diameter: BALL_RADIUS * 2, segments: 12 }, this.scene);
    this.ballMesh.material = ballMat;

    this.hud.setScore(0, 0);
    this.hud.setTimer(MATCH_SECONDS);
    this.showTeamIntro();

    this.engine.runRenderLoop(guardLoop(() => {
      if (this.disposed) return;
      if (this.paused) return;
      const dt = Math.min(this.engine.getDeltaTime() / 1000, 0.05) || 0.016;
      this.step(dt);
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
    this.hud.feedMessage(`🔴 SQUADRA ROSSA: ${red}`, '#f87171', 3200);
    this.hud.feedMessage(`🔵 SQUADRA BLU: ${blue}`, '#60a5fa', 3200);
    if (this.handicappedTeam) {
      this.hud.setNote(`${TEAM_LABEL[this.handicappedTeam]} IN SUPERIORITÀ NUMERICA: MALUS ATTIVO`, '#fbbf24');
    }
    for (const p of this.players) {
      this.ctx.signal(p.id, { type: 'team', team: p.team });
    }
  }

  private spawnTeams(): void {
    const reds = this.players.filter((p) => p.team === 'red');
    const blues = this.players.filter((p) => p.team === 'blue');
    reds.forEach((p, i) => {
      p.x = -FIELD_HALF_W * 0.55 - i * 1.2;
      p.z = (i % 2 === 0 ? 1 : -1) * 3;
      p.facing = Math.PI / 2; // verso +X (attacca destra)
      p.hasBall = false;
    });
    blues.forEach((p, i) => {
      p.x = FIELD_HALF_W * 0.55 + i * 1.2;
      p.z = (i % 2 === 0 ? 1 : -1) * 3;
      p.facing = -Math.PI / 2; // verso -X
      p.hasBall = false;
    });
  }

  private positionBall(x: number, z: number): void {
    this.ball = createBall();
    this.ball.x = x;
    this.ball.z = z;
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
    } else if (this.phase === 'playing' || this.phase === 'goldenGoal') {
      if (this.phase === 'playing') {
        this.matchTime -= dt;
        this.hud.setTimer(this.matchTime);
        if (this.matchTime <= 0) {
          if (this.redScore === this.blueScore) {
            this.phase = 'goldenGoal';
            this.goldenTime = GOLDEN_GOAL_SECONDS;
            this.hud.setNote('⚡ GOLDEN GOAL — il primo gol vince', '#fbbf24');
            this.hud.setCountdown('GOLDEN GOAL', '#fbbf24');
            this.timeOutClearCountdown();
          } else {
            this.startEnd();
          }
        }
      } else {
        this.goldenTime -= dt;
        this.hud.setTimer(this.goldenTime);
        if (this.goldenTime <= 0) {
          this.tiebreaker();
        }
      }
      // Se una transizione ha terminato il match, non processare altro gameplay.
      if (this.phase === 'playing' || this.phase === 'goldenGoal') {
        this.updateGameplay(dt, now);
      }
    } else if (this.phase === 'goalPause') {
      this.phaseTime -= dt;
      if (this.phaseTime <= 0) {
        this.resetAfterGoal();
      }
    } else if (this.phase === 'ended') {
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
    this.ballMesh.position.set(this.ball.x, BALL_HEIGHT + (this.ball.ownerId ? 0 : 0), this.ball.z);
    this.updateAimLine();
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

  private stepPlayer(p: SoccerPlayer, dt: number): void {
    p.dodgeCooldown = Math.max(0, p.dodgeCooldown - dt);
    p.dodgeTime = Math.max(0, p.dodgeTime - dt);
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

    const stunned = p.stunTime > 0;
    const dodging = p.dodgeTime > 0;
    p.dashing = dodging;

    // Tackle / dash
    if (!stunned && !dodging && input.justPressed('dash') && p.dodgeCooldown <= 0) {
      const dirX = mag > 0.15 ? ax : Math.sin(p.facing);
      const dirZ = mag > 0.15 ? az : Math.cos(p.facing);
      const charge = p.judokaCharge;
      p.dodgeTime = DASH_TIME;
      p.dodgeCooldown = DASH_COOLDOWN * p.dashCooldownMult;
      p.vx = dirX * (charge ? JUDOKA_CHARGE_SPEED : DASH_SPEED);
      p.vz = dirZ * (charge ? JUDOKA_CHARGE_SPEED : DASH_SPEED);
      audio.boost();
      this.ctx.vibrate(p.id, 25);
      this.tryTackle(p, charge);
      if (charge) {
        p.judokaCharge = false;
        this.onAbilityFeedback(p, { type: 'judoka_charge' });
      }
    }

    // Abilità
    if (!stunned && input.justPressed('ability')) {
      this.abilities.onAbilityPress(p, (f) => this.onAbilityFeedback(p, f));
    }

    // Carica tiro
    if (input.justPressed('shoot') && p.hasBall) {
      p.charging = true;
      p.chargeTime = 0;
    }
    if (p.charging) {
      p.chargeTime = Math.min(CHARGE_TIME, p.chargeTime + dt);
    }
    if (input.justReleased('shoot')) {
      if (p.hasBall && p.charging) this.kick(p, p.chargeTime);
      p.charging = false;
    }

    if (dodging) {
      // velocità impostata dal dash
    } else if (!stunned && mag > 0.15) {
      p.facing = Math.atan2(ax, az);
      const effSpeed = p.speedMult * (p.lightTime > 0 ? LIGHT_SPEED : 1);
      p.vx += ax * ACCEL * effSpeed * dt;
      p.vz += az * ACCEL * effSpeed * dt;
    }

    if (!dodging) {
      const damp = Math.exp(-FRICTION * dt);
      p.vx *= damp;
      p.vz *= damp;
      const sp = Math.hypot(p.vx, p.vz);
      const effMax = MAX_SPEED * p.speedMult * (p.lightTime > 0 ? LIGHT_SPEED : 1);
      if (sp > effMax) {
        p.vx = (p.vx / sp) * effMax;
        p.vz = (p.vz / sp) * effMax;
      }
    }

    p.x += p.vx * dt;
    p.z += p.vz * dt;
    p.x = Math.max(-FIELD_HALF_W + PLAYER_RADIUS, Math.min(FIELD_HALF_W - PLAYER_RADIUS, p.x));
    p.z = Math.max(-FIELD_HALF_D + PLAYER_RADIUS, Math.min(FIELD_HALF_D - PLAYER_RADIUS, p.z));
  }

  private kick(p: SoccerPlayer, charge: number): void {
    const frac = Math.min(1, charge / CHARGE_TIME);
    let power = (KICK_MIN + (KICK_MAX - KICK_MIN) * frac) * p.kickMult;

    if (p.characterId === 'buttafuori' && p.aimTime > 0 && !p.aimThrown) {
      p.aimThrown = true;
      power *= AIM_KICK_MULT;
      this.onAbilityFeedback(p, { type: 'buttafuori_charged' });
    }

    const dirX = Math.sin(p.facing);
    const dirZ = Math.cos(p.facing);
    this.ball.ownerId = null;
    this.ball.prevKickerId = this.ball.lastKickerId;
    this.ball.lastKickerId = p.id;
    this.ball.vx = dirX * power;
    this.ball.vz = dirZ * power;
    this.ball.freeGrace = 0.35;
    this.ball.curve = p.curveNext ? CURVE_RATE : 0;
    p.curveNext = false;
    p.hasBall = false;
    this.teamKicks[p.team]++;
    this.entities.get(p.id)?.playThrow();
    audio.select();
    this.ctx.vibrate(p.id, 40);
    this.ctx.signal(p.id, { type: 'threwBall' });
  }

  private tryTackle(attacker: SoccerPlayer, charge: boolean): void {
    // Il tackle ruba la palla al portatore vicino.
    for (const victim of this.players) {
      if (victim.id === attacker.id || !victim.alive || !victim.hasBall) continue;
      const d = Math.hypot(victim.x - attacker.x, victim.z - attacker.z);
      if (d < PLAYER_RADIUS * 2 + 0.5) {
        const result = this.abilities.resolveTackle(attacker, victim);
        if (result === 'steal') {
          victim.hasBall = false;
          attacker.hasBall = true;
          this.ball.ownerId = attacker.id;
          attacker.tackles++;
          const nx = (victim.x - attacker.x) / (d || 1);
          const nz = (victim.z - attacker.z) / (d || 1);
          victim.vx += nx * (charge ? JUDOKA_CHARGE_POWER : 6);
          victim.vz += nz * (charge ? JUDOKA_CHARGE_POWER : 6);
          victim.stunTime = Math.max(victim.stunTime, 0.3);
          victim.hitFlash = 0.14;
          audio.hit();
          this.ctx.vibrate(attacker.id, 50);
          this.ctx.signal(victim.id, { type: 'lostBall' });
          this.ctx.signal(attacker.id, { type: 'gotBall' });
          if (charge) this.onAbilityFeedback(attacker, { type: 'judoka_charge' });
        } else {
          this.onAbilityFeedback(victim, { type: 'ciro_hold' });
        }
        break;
      }
    }
  }

  // ---- Palla ----

  private updateBall(dt: number): void {
    const b = this.ball;
    if (b.ownerId) {
      const owner = this.players.find((p) => p.id === b.ownerId);
      if (owner && owner.alive && owner.hasBall) {
        b.x = owner.x + Math.sin(owner.facing) * (PLAYER_RADIUS + BALL_RADIUS + 0.15);
        b.z = owner.z + Math.cos(owner.facing) * (PLAYER_RADIUS + BALL_RADIUS + 0.15);
        b.vx = 0;
        b.vz = 0;
      } else {
        b.ownerId = null;
      }
      return;
    }

    b.freeGrace = Math.max(0, b.freeGrace - dt);

    // Curva (Goblin trivela)
    if (b.curve > 0) {
      const ang = b.curve * dt;
      const cos = Math.cos(ang);
      const sin = Math.sin(ang);
      const nx = b.vx * cos - b.vz * sin;
      const nz = b.vx * sin + b.vz * cos;
      b.vx = nx;
      b.vz = nz;
      b.curve = Math.max(0, b.curve - dt * 0.8);
    }

    // Attrito
    const damp = Math.exp(-BALL_FRICTION * dt);
    b.vx *= damp;
    b.vz *= damp;

    b.x += b.vx * dt;
    b.z += b.vz * dt;

    // Rimbalzi sui muri (con buchi per le porte sui lati X)
    if (b.x > FIELD_HALF_W) {
      if (Math.abs(b.z) < GOAL_HALF_W) {
        this.scoreGoal('red');
        return;
      }
      b.x = FIELD_HALF_W;
      b.vx = -Math.abs(b.vx);
      audio.tick();
    } else if (b.x < -FIELD_HALF_W) {
      if (Math.abs(b.z) < GOAL_HALF_W) {
        this.scoreGoal('blue');
        return;
      }
      b.x = -FIELD_HALF_W;
      b.vx = Math.abs(b.vx);
      audio.tick();
    }
    if (b.z > FIELD_HALF_D) {
      b.z = FIELD_HALF_D;
      b.vz = -Math.abs(b.vz);
      audio.tick();
    } else if (b.z < -FIELD_HALF_D) {
      b.z = -FIELD_HALF_D;
      b.vz = Math.abs(b.vz);
      audio.tick();
    }

    const sp = Math.hypot(b.vx, b.vz);
    if (sp > BALL_MAX_SPEED) {
      b.vx = (b.vx / sp) * BALL_MAX_SPEED;
      b.vz = (b.vz / sp) * BALL_MAX_SPEED;
    }

    // Deflessione sui giocatori (bloccare i tiri)
    for (const p of this.players) {
      if (!p.alive) continue;
      if (b.lastKickerId === p.id && b.freeGrace > 0) continue;
      const dx = b.x - p.x;
      const dz = b.z - p.z;
      const dist = Math.hypot(dx, dz);
      if (dist < PLAYER_RADIUS + BALL_RADIUS && dist > 0.001) {
        const nx = dx / dist;
        const nz = dz / dist;
        const dot = b.vx * nx + b.vz * nz;
        if (dot < 0) {
          b.vx -= 2 * dot * nx;
          b.vz -= 2 * dot * nz;
          b.vx *= 0.88;
          b.vz *= 0.88;
          b.x += nx * (PLAYER_RADIUS + BALL_RADIUS - dist);
          b.z += nz * (PLAYER_RADIUS + BALL_RADIUS - dist);
        }
      }
    }

    // Raccolta (solo se lenta)
    if (sp < 8 && b.freeGrace <= 0) {
      let best: SoccerPlayer | null = null;
      let bestD = POSSESSION_RADIUS;
      for (const p of this.players) {
        if (!p.alive || p.hasBall) continue;
        const d = Math.hypot(p.x - b.x, p.z - b.z);
        if (d < bestD) {
          bestD = d;
          best = p;
        }
      }
      if (best) {
        b.ownerId = best.id;
        best.hasBall = true;
        best.interceptions++;
        b.vx = 0;
        b.vz = 0;
        audio.select();
        this.ctx.vibrate(best.id, 30);
        this.ctx.signal(best.id, { type: 'gotBall' });
      }
    }
  }

  private scoreGoal(team: Team): void {
    const kickerId = this.ball.lastKickerId;
    const kicker = this.players.find((p) => p.id === kickerId);
    const prevId = this.ball.prevKickerId;
    const prev = this.players.find((p) => p.id === prevId);

    let ownGoal = false;
    if (kicker) {
      if (kicker.team === team) {
        kicker.goals++;
        if (prev && prev.team === team && prev.id !== kicker.id) prev.assists++;
      } else {
        kicker.ownGoals++;
        ownGoal = true;
      }
    }

    if (team === 'red') this.redScore++;
    else this.blueScore++;
    this.hud.setScore(this.redScore, this.blueScore);

    audio.fanfare();
    this.camera.shake(0.4, 300);
    const label = ownGoal ? 'AUTOGOL! 😱' : 'GOOOOL!';
    this.hud.feedMessage(`${label} ${TEAM_LABEL[team]} ${this.redScore} — ${this.blueScore}`, team === 'red' ? '#f87171' : '#60a5fa', 3000);
    for (const p of this.players) this.ctx.vibrate(p.id, team === p.team ? 160 : 80);
    this.ctx.signal(null, { type: 'goal', team });

    this.goalDuringGolden = this.phase === 'goldenGoal';
    this.phase = 'goalPause';
    this.phaseTime = GOAL_PAUSE_SECONDS;
    this.ball = createBall();
    this.ball.x = 0;
    this.ball.z = 0;
  }

  private resetAfterGoal(): void {
    this.spawnTeams();
    this.positionBall(0, 0);
    if (this.goalDuringGolden) {
      // Golden goal: il gol appena segnato chiude la partita.
      this.startEnd();
    } else if (this.matchTime <= 0) {
      this.startEnd();
    } else {
      this.phase = 'playing';
    }
  }

  private tiebreaker(): void {
    this.winnerTeam = this.teamKicks.red >= this.teamKicks.blue ? 'red' : 'blue';
    this.hud.feedMessage(`Pareggio! Vince ${TEAM_LABEL[this.winnerTeam]} (più tiri)`, '#fbbf24', 3000);
    this.startEnd();
  }

  private startEnd(): void {
    if (this.phase === 'ended') return;
    if (this.winnerTeam === null) {
      this.winnerTeam = this.redScore > this.blueScore ? 'red' : this.blueScore > this.redScore ? 'blue' : this.teamKicks.red >= this.teamKicks.blue ? 'red' : 'blue';
    }
    this.phase = 'ended';
    this.celebrateTime = 2.4;
    const wl = TEAM_LABEL[this.winnerTeam];
    this.hud.feedMessage(`🏆 VINCE LA SQUADRA ${wl}! ${this.redScore} — ${this.blueScore}`, '#fbbf24', 4000);
    this.ctx.signal(null, { type: 'matchEnd', winner: this.winnerTeam });
    for (const p of this.players) {
      if (p.team === this.winnerTeam) this.ctx.signal(p.id, { type: 'won' });
    }
    audio.fanfare();
  }

  private mvp(p: SoccerPlayer): number {
    return p.goals * 3 + p.assists * 2 + p.tackles + p.interceptions - p.ownGoals * 2;
  }

  private buildResults(): { playerId: PlayerId; placement: number; score: number }[] {
    const winners = this.players.filter((p) => p.team === this.winnerTeam).sort((a, b) => this.mvp(b) - this.mvp(a));
    const losers = this.players.filter((p) => p.team !== this.winnerTeam).sort((a, b) => this.mvp(b) - this.mvp(a));
    const ranking = [...winners, ...losers];
    return ranking.map((p, i) => ({ playerId: p.id, placement: i + 1, score: this.mvp(p) }));
  }

  // ---- Feedback abilità ----

  private onAbilityFeedback(p: SoccerPlayer, f: SoccerAbilityFeedback): void {
    switch (f.type) {
      case 'goblin_trivela':
        this.hud.feedMessage(`${p.avatar} TRIVELA DEL GOBLIN!`, '#10b981');
        this.ctx.signal(p.id, { type: 'ability', name: 'TRIVELA DEL GOBLIN' });
        audio.select();
        this.ctx.vibrate(p.id, 60);
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
      case 'dottore_light':
        this.hud.feedMessage(`${p.avatar} 20 KG IN UN MESE!`, '#22d3ee');
        this.ctx.signal(p.id, { type: 'ability', name: '20 KG IN UN MESE' });
        audio.select();
        this.ctx.vibrate(p.id, 70);
        break;
      case 'judoka_charge':
        this.hud.feedMessage(`${p.avatar} CARICO E SCARICO!`, '#facc15');
        this.ctx.signal(p.id, { type: 'ability', name: 'CARICO E SCARICO' });
        break;
      case 'ciro_arm':
        this.hud.feedMessage(`${p.avatar} PAGO DOMANI!`, '#a78bfa');
        this.ctx.signal(p.id, { type: 'ability', name: 'PAGO DOMANI' });
        audio.select();
        this.ctx.vibrate(p.id, 70);
        break;
      case 'ciro_hold':
        this.hud.feedMessage(`${p.avatar} PAGO DOMANI — palla trattenuta!`, '#a78bfa');
        this.ctx.signal(p.id, { type: 'heldBall' });
        audio.hit();
        break;
    }
  }

  // ---- Mira (Buttafuori) ----

  private updateAimLine(): void {
    const aimer = this.players.find((p) => p.aimTime > 0 && !p.aimThrown && p.alive && p.hasBall);
    if (aimer) {
      const dirX = Math.sin(aimer.facing);
      const dirZ = Math.cos(aimer.facing);
      let x = aimer.x;
      let z = aimer.z;
      const pts: { x: number; z: number }[] = [];
      for (let i = 0; i < 20; i++) {
        x += dirX * 0.8;
        z += dirZ * 0.8;
        if (Math.abs(z) > FIELD_HALF_D) break;
        if (x > FIELD_HALF_W || x < -FIELD_HALF_W) break;
        pts.push({ x, z });
      }
      for (let i = 0; i < this.aimDots.length; i++) {
        const d = this.aimDots[i];
        if (i < pts.length) {
          d.position.set(pts[i].x, 0.35, pts[i].z);
          d.isVisible = true;
        } else {
          d.isVisible = false;
        }
      }
    } else {
      for (const d of this.aimDots) d.isVisible = false;
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
