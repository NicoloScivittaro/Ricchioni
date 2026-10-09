import { MotionBots } from '../bots/MotionBots';
import {
  Engine,
  Scene,
  Color4,
  DynamicTexture,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Mesh,
  ParticleSystem
} from '@babylonjs/core';
import type { PlayerId, PlayerResult } from '../../../shared/types';
import type { MinigameContext } from '../types';
import { audio } from '../../core/AudioManager';
import { setGameIntensity } from '../../core/musicDirector';
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
import { ShockRings, makeBallTrail, tintBallTrail } from '../arena/impactFx';
import { SoccerHud } from '../soccer/soccerHud';
import { buildVolleyballEnvironment } from './volleyballEnvironment';
import { registerEnvScene } from '../env/envDebug';
import { VolleyballAbilities, JAGER_POWER_MULT, VOLLEYBALL_ACTIVATIONS, VOLLEY_BUTTAFUORI, VOLLEY_JUDOKA, VOLLEY_DOTTORE, VOLLEY_CIRO } from './volleyballAbilities';
import type { VolleyballAbilityFeedback, VolleyballPressResult } from './volleyballAbilities';
import { abilityHub } from '../../core/abilityHub';
import { VOLLEYBALL_ABILITIES } from '../../../shared/volleyballAbilities';
import { abilityLabel } from '../characters/reactions';

import { readMove } from '../moveInput';
import { runSteps } from '../../core/frameClock';
import { guardLoop, safely } from '../../core/loopGuard';
import { applyQuality, engineOptions } from '../../core/quality';
import { say } from '../../core/announcer';
import { debugEnabled } from '../../core/debug';
import { VolleyStats } from './volleyballStats';
import { telemetry } from '../../core/telemetry';

const COUNTDOWN_S = 3.2;
const INTRO_SECONDS = 3.4;
const POINT_PAUSE_SECONDS = 2.0;

type Phase = 'intro' | 'countdown' | 'playing' | 'pointPause' | 'ended';

export class BabylonVolleyballGame {
  private soloBots: MotionBots;
  private engine: Engine;
  private scene: Scene;
  private players: VolleyballPlayer[] = [];
  private entities = new Map<PlayerId, ArenaEntity>();
  private ball: VolleyballBall = createBall();
  private ballMesh: Mesh;
  private prevY = new Map<string, number>();
  private matchPointAnnounced = false;
  // ---- IMPATTO (solo grafica): scia della palla, lampo e onda del contatto dello smash
  private ballTrail!: ParticleSystem;
  private shocks!: ShockRings;
  private contactFlash!: Mesh;
  private contactFlashT = 0;
  private smashTrailT = 0;
  private landingRing: Mesh;
  private ballShadow: Mesh;
  private env: ReturnType<typeof buildVolleyballEnvironment>;
  private camera: ArenaCamera;
  private hud: SoccerHud;
  private abilities = new VolleyballAbilities();
  private unsubAbility: () => void = () => undefined;
  /** NO, ASPETTA! (Judoka): palla ferma in aria. Lo stato e' qui (il gioco e' l'autorita'): la palla riparte con la velocita' che aveva. */
  private freeze: { by: PlayerId; t: number; vx: number; vy: number; vz: number } | null = null;
  /** PAGO DOMANI (Ciro): squadra con un debito aperto: se perde lo scambio, l'avversario fa punti doppi. */
  private debtTeam: Team | null = null;
  private debtOwner: PlayerId | null = null;
  private order: PlayerId[];

  private phase: Phase = 'intro';
  /** Schermata CONTROLLI: richiesta una volta a fine intro, poi il countdown parte solo a schermata chiusa. */
  private controlsRequested = false;
  private controlsDone = false;
  private phaseTime = 0;
  private countdown = COUNTDOWN_S;
  private lastCountInt = 4;
  private rally = 0; // colpi (di entrambe le squadre) dal servizio: alimenta il telecronista
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
  private stats: VolleyStats | null = debugEnabled() ? new VolleyStats() : null; // statistiche di bilanciamento (solo debug)

  private onResize = (): void => this.engine.resize();

  constructor(
    private canvas: HTMLCanvasElement,
    private ctx: MinigameContext
  ) {
    this.gravityScale = ctx.modifier?.id === 'gravita_bassa' ? 0.5 : 1;

    this.soloBots = new MotionBots(ctx);
    this.engine = new Engine(canvas, engineOptions().antialias, engineOptions());
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.6, 0.82, 0.95, 1);

    this.env = buildVolleyballEnvironment(this.scene);
    registerEnvScene(this.scene);
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
      this.abilities.init(p);
      this.players.push(p);
      const entity = new ArenaEntity(this.scene, dotTex, TEAM_COLOR[team], snap.characterId, snap.avatar, snap.displayName, team,{context:'volley'});
      this.entities.set(p.id, entity);
    });

    abilityHub.begin('volleyball', ctx);
    this.unsubAbility = abilityHub.onStatus((id, st) => this.hud.setAbility(id, st));
    this.hud.playerStrip(this.players.map((q) => ({ id: q.id, name: q.name, characterId: q.characterId, color: TEAM_COLOR[q.team], team: q.team })));
    this.spawnTeams();

    // Palla
    const ballMat = new StandardMaterial('ballMat', this.scene);
    ballMat.diffuseColor = new Color3(0.98, 0.95, 0.9);
    ballMat.specularColor = new Color3(0.3, 0.3, 0.3);
    this.ballMesh = MeshBuilder.CreateSphere('volleyBall', { diameter: BALL_RADIUS * 2, segments: 12 }, this.scene);
    this.ballMesh.material = ballMat;
    this.ballTrail = makeBallTrail(this.scene, this.ballMesh, dotTex);
    this.shocks = new ShockRings(this.scene, 3);
    const flashMat = new StandardMaterial('contactFlashMat', this.scene);
    flashMat.emissiveColor = new Color3(1, 1, 0.92);
    flashMat.disableLighting = true;
    this.contactFlash = MeshBuilder.CreateSphere('contactFlash', { diameter: 1, segments: 10 }, this.scene);
    this.contactFlash.material = flashMat;
    this.contactFlash.isPickable = false;
    this.contactFlash.isVisible = false;

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
    this.hud.setCenter(`A ${WIN_SCORE}`); // niente timer in pallavolo: al centro i punti per vincere
    this.showTeamIntro();

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
        // Schermata CONTROLLI dopo l'intro e PRIMA del countdown: finche' e' su, il gioco resta fermo (fase intro, nessun timer)
        if (!this.controlsRequested) {
          this.controlsRequested = true;
          if (this.ctx.showControls) void this.ctx.showControls().then(() => (this.controlsDone = true));
          else this.controlsDone = true;
        }
        if (this.controlsDone) {
          this.phase = 'countdown';
          this.countdown = COUNTDOWN_S;
          this.hud.setCountdown('3');
        }
      }
    } else if (this.phase === 'countdown') {
      this.countdown -= dt;
      const n = Math.ceil(this.countdown);
      if (n < this.lastCountInt && n > 0) {
        this.lastCountInt = n;
        this.hud.setCountdown(String(n));
        audio.countdown(n); // toni crescenti comuni a tutti i giochi: 3 → 2 → 1 → VIA
        this.ctx.signal(null, { type: 'countdown', value: n });
      } else if (this.countdown <= 0) {
        this.phase = 'playing';
        this.hud.setCountdown('VIA!', '#4ade80');
        audio.go();
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
      // atterraggio sulla sabbia: un "pff" sordo (solo suono, il salto e' del gioco)
      const py = this.prevY.get(p.id) ?? 0;
      if (py > 0.25 && p.y <= 0.02) audio.sand(this.pan(p.x));
      this.prevY.set(p.id, p.y);
    }
    this.ballMesh.position.set(this.ball.x, this.ball.y, this.ball.z);
    // scia: dopo uno smash e' piena per un attimo (si vede la palla "partire"), poi solo se la palla e' veloce
    this.smashTrailT = Math.max(0, this.smashTrailT - dt);
    const ballSpeed = Math.hypot(this.ball.vx, this.ball.vy, this.ball.vz);
    this.ballTrail.emitRate = this.ball.state === 'flying' ? (this.smashTrailT > 0 ? 160 : ballSpeed > 9 ? 45 : 0) : 0;
    this.shocks.update(dt);
    if (this.contactFlashT > 0) {
      this.contactFlashT -= dt;
      const k = Math.max(0, this.contactFlashT / 0.09);
      this.contactFlash.scaling.setAll(0.6 + (1 - k) * 1.4);
      this.contactFlash.visibility = k;
      if (this.contactFlashT <= 0) this.contactFlash.isVisible = false;
    }
    this.ballShadow.position.set(this.ball.x, 0.03, this.ball.z);
    const shadowScale = Math.max(0.45, 1 - this.ball.y / 9);
    this.ballShadow.scaling.set(shadowScale, shadowScale, 1);
    this.updateLandingRing();
    for (const p of this.players) abilityHub.setStatus(p.id, this.abilities.status(p, this.freeze?.by === p.id ? this.freeze.t : 0, this.debtOwner === p.id && this.debtTeam !== null)); // HUD + Companion Card
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
    this.soloBots.volleyball(dt, this.players, this.ball);
    this.stats?.tick(dt);
    for (const p of this.players) this.stepPlayer(p, dt);
    this.updateBall(dt);
    void now;
  }

  // ---- Giocatore ----

  private stepPlayer(p: VolleyballPlayer, dt: number): void {
    p.hitCooldown = Math.max(0, p.hitCooldown - dt);
    p.stunTime = Math.max(0, p.stunTime - dt);
    p.hitFlash = Math.max(0, p.hitFlash - dt);
    this.abilities.update(p, dt, (f) => this.onAbilityFeedback(p, f));

    const input = this.ctx.input.get(p.id);
    const mv = readMove(input);
    let ax = mv.x;
    let az = mv.z;
    const mag = Math.hypot(ax, az);
    if (mag > 1) {
      ax /= mag;
      az /= mag;
    }

    // NO, ASPETTA!: mentre la palla e' ferma solo il Judoka si muove (e piu' veloce); gli altri restano fermi dove sono
    const frozenOut = this.freeze !== null && this.freeze.by !== p.id;
    if (frozenOut) {
      p.vx = 0;
      p.vz = 0;
      ax = 0;
      az = 0;
    }
    const effSpeed = p.speedMult * this.abilities.speedFactor(p) * (this.freeze?.by === p.id ? VOLLEY_JUDOKA.p.speed : 1);
    const effAccel = ACCEL * effSpeed;
    const effMax = MAX_SPEED * effSpeed;

    // Movimento (non attraversare la rete)
    if (!frozenOut && mag > 0.15) p.facing = Math.atan2(ax, az);
    p.vx += ax * effAccel * dt;
    p.vz += az * effAccel * dt;
    const damp = Math.exp(-FRICTION * dt * (p.dizzyTime > 0 ? 0.35 : 1)); // Dottore dopo M'HO SVEJATO: scivola
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
    if (!frozenOut && input.justPressed('jump') && p.y <= 0.01) {
      p.vy = JUMP_VY * p.jumpMult * this.abilities.jumpFactor(p);
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
    if (!frozenOut && input.justPressed('hit')) {
      if (this.ball.state === 'held' && this.ball.holderId === p.id) {
        this.serve(p);
      } else {
        this.tryHit(p);
      }
    }

    // Abilità (premuta ma non partita: avviso privato, mai silenzio)
    if (input.justPressed('ability')) {
      const res: VolleyballPressResult = frozenOut ? 'busy' : this.abilities.onAbilityPress(p, this.ball.state === 'flying' && !this.freeze, (f) => this.onAbilityFeedback(p, f));
      if (res !== 'ok') abilityHub.failed(p.id, res === 'spent' ? 'ESAURITA' : res === 'noball' ? 'SERVE LA PALLA IN ARIA' : 'NON ORA');
    }
  }

  private serve(p: VolleyballPlayer): void {
    this.ball.state = 'flying';
    this.ball.holderId = null;
    this.ball.lastTouchId = p.id;
    this.ball.teamTouches = 1;
    this.ball.crossedNet = false;
    this.rally = 1;
    this.stats?.rallyStart();
    const dirZ = p.team === 'red' ? 1 : -1;
    this.ball.vx = (Math.random() - 0.5) * 3;
    this.ball.vy = BALL_SERVE_UP;
    this.ball.vz = dirZ * BALL_SERVE_SPEED;
    this.ball.x = p.x;
    this.ball.z = p.z + dirZ * 0.6;
    audio.serve(this.pan(p.x));
    this.entities.get(p.id)?.playThrow();
    this.ctx.vibrate(p.id, 40);
    this.ctx.signal(p.id, { type: 'served' });
  }

  private tryHit(p: VolleyballPlayer): void {
    if (this.ball.state !== 'flying') return;
    if (p.hitCooldown > 0) return;
    // MURO DEL POLIGONO: a rete le braccia del Buttafuori arrivano piu' lontano
    const muroZone = p.muroTime > 0 && Math.abs(p.z) < VOLLEY_BUTTAFUORI.p.netZone;
    const dist = Math.hypot(this.ball.x - p.x, this.ball.z - p.z);
    if (dist > HIT_RADIUS * (muroZone ? VOLLEY_BUTTAFUORI.p.reach : 1)) return;
    if (this.ball.y < p.y - 0.4 || this.ball.y > p.y + HIT_REACH) return;

    p.hitCooldown = HIT_COOLDOWN * p.hitCooldownMult;
    const incoming = Math.hypot(this.ball.vx, this.ball.vy, this.ball.vz); // solo per la posa di ricezione

    // NO, ASPETTA!: il Judoka ha raggiunto la palla ferma: l'abilita' e' servita (palla recuperata), il tempo riparte
    if (this.freeze && this.freeze.by === p.id) {
      this.freeze = null;
      abilityHub.succeeded(p.id, 'palle recuperate');
      this.onAbilityFeedback(p, { type: 'judoka_resume' });
    }

    const wall = muroZone && this.ball.y > 1.2; // muro: colpo in alto davanti alla rete
    const isSmash = wall || (p.y > 0.4 && this.ball.y > NET_HEIGHT * 0.8 && Math.abs(p.z) < 2.4);
    const perfect = this.ball.y > p.y + 1.1 && this.ball.y < p.y + 2.2;
    const dirZ = p.team === 'red' ? 1 : -1;
    // Direzione orizzontale unitaria (avanti + lieve assist verso il centro): la velocità orizzontale
    // del colpo è quella nominale, non dipende più da dove si trova la palla.
    let aim = hitDirection(this.ball.x, dirZ);
    // DOTTORE — M'HO SVEJATO: lo smash va da solo dove nessuno difende
    if (isSmash && p.characterId === 'dottore' && p.lucidTime > 0) {
      const t = this.lucidSmashTarget(p, dirZ);
      const dx = t.x - this.ball.x;
      const dz = t.z - this.ball.z;
      const d = Math.hypot(dx, dz) || 1;
      aim = { dx: dx / d, dz: dz / d };
      p.lucidTime = 0;
      p.dizzyTime = VOLLEY_DOTTORE.p.dizzy;
      this.onAbilityFeedback(p, { type: 'dottore_shot' });
    }

    let vx = aim.dx;
    let vy: number;
    let vz = aim.dz;

    if (isSmash) {
      let speed = BALL_SMASH_SPEED;
      let down = BALL_SMASH_DOWN;
      if (wall) {
        // MURO: la palla torna giu' dall'altra parte, secca
        speed *= VOLLEY_BUTTAFUORI.p.speed;
        down = VOLLEY_BUTTAFUORI.p.down;
        this.onAbilityFeedback(p, { type: 'buttafuori_block' });
      }
      if (p.jagerTime > 0) {
        if (perfect) {
          speed *= JAGER_POWER_MULT;
          down *= 1.3;
          this.onAbilityFeedback(p, { type: 'goblin_jager_boom' });
        } else {
          this.onAbilityFeedback(p, { type: 'goblin_jager_wasted' });
        }
        p.jagerTime = 0;
      }
      vx *= speed;
      vz *= speed;
      vy = down;
      p.smashes++;
      audio.smash(this.pan(p.x)); // transiente + aria + impatto, nello stesso istante della nuova velocita' della palla
      this.camera.shake(0.25, 200);
      this.ctx.signal(p.id, { type: 'smash' });
    } else {
      const up = BALL_NORMAL_UP;
      const speed = BALL_NORMAL_SPEED;
      vx *= speed;
      vz *= speed;
      vy = up;
      p.receives++;
      audio.bump(this.pan(p.x));
      this.ctx.signal(p.id, { type: 'receive' });
    }

    this.ball.vx = vx;
    this.ball.vy = vy;
    this.ball.vz = vz;
    clampBallSpeed(this.ball);
    this.stats?.hit(p.team, p.id, isSmash, Math.hypot(this.ball.vx, this.ball.vy, this.ball.vz));
    this.ball.lastTouchId = p.id;
    this.ball.teamTouches++;
    this.rally++;
    this.announceRally();
    if (isSmash) {
      // SMASH: il braccio caricato in salto scatta giu' (contatto = adesso, stesso istante della nuova velocita'), lampo bianco
      // sulla palla, onda a terra sotto chi schiaccia, scia piena della squadra
      this.entities.get(p.id)?.playSpike();
      this.contactFlash.position.set(this.ball.x, this.ball.y, this.ball.z);
      this.contactFlash.isVisible = true;
      this.contactFlashT = 0.09;
      this.shocks.spawn(p.x, p.z, TEAM_COLOR[p.team], 0.9);
      tintBallTrail(this.ballTrail, TEAM_COLOR[p.team]);
      this.smashTrailT = 0.6;
    } else if (incoming > BALL_NORMAL_SPEED * 1.6) {
      // ricezione di una palla forte: il corpo assorbe
      this.entities.get(p.id)?.playAbsorb();
      tintBallTrail(this.ballTrail, '#ffffff');
    } else {
      this.entities.get(p.id)?.playThrow();
      tintBallTrail(this.ballTrail, '#ffffff');
    }
    this.ctx.vibrate(p.id, perfect ? 80 : 40);
  }

  /** Punto del campo avversario piu' lontano dai difensori (per lo smash del Dottore): massimizza la distanza minima da chi difende. */
  private lucidSmashTarget(p: VolleyballPlayer, dirZ: number): { x: number; z: number } {
    let best = { x: 0, z: dirZ * 5 };
    let bestD = -1;
    for (const x of [-8, -4, 0, 4, 8]) {
      for (const depth of [3, 6]) {
        const z = dirZ * depth;
        let near = Infinity;
        for (const q of this.players) {
          if (q.team === p.team) continue;
          near = Math.min(near, Math.hypot(q.x - x, q.z - z));
        }
        if (near > bestD) {
          bestD = near;
          best = { x, z };
        }
      }
    }
    return best;
  }

  /** Pan stereo dalla posizione (larghezza del campo vista dalla TV). */
  private pan(x: number): number {
    return Math.max(-0.8, Math.min(0.8, x / 6));
  }

  /** Frasi del telecronista sugli scambi lunghi (5 / 8 / 12 colpi). */
  private announceRally(): void {
    const kind = this.rally === 5 ? 'rally5' : this.rally === 8 ? 'rally8' : this.rally === 12 ? 'rally12' : null;
    const line = kind ? say(kind, true) : null;
    if (line) this.hud.feedMessage(line, '#fbbf24', 1500);
  }

  // ---- Palla ----

  private updateBall(dt: number): void {
    const b = this.ball;
    if (b.state !== 'flying') return;

    // JUDOKA — NO, ASPETTA!: la palla resta ferma in aria; scaduto il tempo riparte con la velocita' che aveva
    if (this.freeze) {
      this.freeze.t -= dt;
      if (this.freeze.t <= 0) {
        const f = this.freeze;
        this.freeze = null;
        b.vx = f.vx;
        b.vy = f.vy;
        b.vz = f.vz;
        const owner = this.players.find((q) => q.id === f.by);
        if (owner) {
          abilityHub.wasted(f.by);
          this.onAbilityFeedback(owner, { type: 'judoka_resume' });
        }
      }
      return;
    }

    const prevZ = b.z;
    b.vy -= BALL_GRAVITY * this.gravityScale * dt;
    clampBallSpeed(b);
    this.stats?.ball(Math.hypot(b.vx, b.vy, b.vz));
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
      // CIRO — PAGO DOMANI: la prima palla a terra nel campo di Ciro rimbalza e lo scambio continua; il debito si paga dopo
      const ciro = this.players.find((p) => p.armTime > 0 && p.team === this.landingTeam(b.z));
      if (ciro) {
        ciro.armTime = 0;
        b.y = 0.3;
        b.vy = 7;
        b.vx *= 0.4;
        b.vz *= 0.4;
        this.debtTeam = ciro.team;
        this.debtOwner = ciro.id;
        this.onAbilityFeedback(ciro, { type: 'ciro_saved' });
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

    // CIRO — il debito: se la squadra che ha usato PAGO DOMANI perde comunque lo scambio, l'avversario ne guadagna di piu'
    let pts = 1;
    if (this.debtTeam) {
      const owner = this.players.find((q) => q.id === this.debtOwner);
      if (scoringTeam !== this.debtTeam) {
        pts += VOLLEY_CIRO.p.debtPoints;
        if (owner) this.onAbilityFeedback(owner, { type: 'ciro_collect' });
      } else if (owner) this.onAbilityFeedback(owner, { type: 'ciro_paid' });
      this.debtTeam = null;
      this.debtOwner = null;
    }
    if (scoringTeam === 'red') this.redScore += pts;
    else this.blueScore += pts;
    this.hud.setScore(this.redScore, this.blueScore);
    for (const q of this.players) this.abilities.clearEffects(q); // fine scambio: nessuna finestra aperta (le cariche restano com'erano)
    this.freeze = null;

    // MVP: chi ha fatto il punto (ultimo tocco della squadra che segna) o errore.
    const last = this.ball.lastTouchId;
    if (last) {
      const toucher = this.players.find((p) => p.id === last);
      if (toucher && toucher.team === scoringTeam) toucher.points++;
      else if (toucher) toucher.errors++;
    }

    audio.pointSting(); // ogni punto: stinger corto (la fanfara e' per la fine partita)
    this.camera.shake(0.3, 260);
    const rallyLen = this.rally;
    this.rally = 0;
    this.stats?.point(scoringTeam);
    this.hud.feedMessage(`💥 PUNTO${pts > 1 ? ' DOPPIO' : ''} ${TEAM_LABEL[scoringTeam]}! ${this.redScore} — ${this.blueScore}${rallyLen >= 6 ? ` · scambio da ${rallyLen} colpi` : ''}`, scoringTeam === 'red' ? '#f87171' : '#60a5fa', 2600);
    for (const p of this.players) this.ctx.vibrate(p.id, p.team === scoringTeam ? 150 : 70);
    this.ctx.signal(null, { type: 'point', team: scoringTeam });
    // ESULTANZA DEL PUNTO: breve, nello stile di ciascuno (chi l'ha fatto un po' di piu'); chi l'ha subito ci resta male
    for (const p of this.players) {
      const e = this.entities.get(p.id);
      if (p.team === scoringTeam) e?.playVictory(p.id === last ? POINT_PAUSE_SECONDS * 0.8 : POINT_PAUSE_SECONDS * 0.5);
      else e?.playDefeat(POINT_PAUSE_SECONDS * 0.5);
    }

    this.servingTeam = scoringTeam;
    this.phase = 'pointPause';
    this.phaseTime = POINT_PAUSE_SECONDS;

    if (this.redScore >= WIN_SCORE || this.blueScore >= WIN_SCORE) {
      this.winnerTeam = scoringTeam;
      this.stats?.report(new Map(this.players.map((p) => [p.id, p.name])));
      if (this.stats) telemetry.metrics('volleyball', this.stats.summary());
      // partita finita: dopo la pausa punto si chiude
      this.phase = 'ended';
      this.celebrateTime = 2.6;
      this.hud.feedMessage(`🏆 VINCE LA SQUADRA ${TEAM_LABEL[scoringTeam]}! ${this.redScore} — ${this.blueScore}`, '#fbbf24', 4000);
      audio.fanfare();
      audio.duck(0.5, 1300);
      this.ctx.signal(null, { type: 'matchEnd', winner: scoringTeam });
      for (const p of this.players) {
        if (p.team === scoringTeam) this.ctx.signal(p.id, { type: 'won' });
        if (p.team === scoringTeam) this.entities.get(p.id)?.playVictory();
        else this.entities.get(p.id)?.playDefeat();
      }
      const best = this.players.filter((p) => p.team === scoringTeam).sort((a, b) => b.points - a.points)[0];
      if (best) this.entities.get(best.id)?.react('victory');
    } else if (this.redScore >= MATCH_POINT_AT || this.blueScore >= MATCH_POINT_AT) {
      this.hud.setNote('🔥 MATCH POINT', '#fbbf24');
      if (!this.matchPointAnnounced) this.hud.banner('MATCH POINT', `ROSSI ${this.redScore} — ${this.blueScore} BLU`, '#fbbf24', 1500);
      if (!this.matchPointAnnounced) {
        this.matchPointAnnounced = true;
        audio.announcer('MATCH_POINT');
        setGameIntensity(2);
      }
    }
  }

  private updateLandingRing(): void {
    const b = this.ball;
    // Visibile per TUTTO il volo (anche in salita): il ricevente ha subito dove andare.
    if (b.state !== 'flying' || this.freeze) {
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

  private buildResults(): PlayerResult[] {
    const winners = this.players.filter((p) => p.team === this.winnerTeam).sort((a, b) => this.mvp(b) - this.mvp(a));
    const losers = this.players.filter((p) => p.team !== this.winnerTeam).sort((a, b) => this.mvp(b) - this.mvp(a));
    const ranking = [...winners, ...losers];
    return ranking.map((p, i) => ({
      playerId: p.id,
      placement: i + 1,
      score: this.mvp(p),
      stats: [`${p.points} punti · ${p.smashes} smash`, `${p.receives} ricezioni`, ...(p.errors > 0 ? [`${p.errors} errori`] : [])]
    }));
  }

  // ---- Feedback abilità ----

  private onAbilityFeedback(p: VolleyballPlayer, f: VolleyballAbilityFeedback): void {
    const name = abilityLabel(VOLLEYBALL_ABILITIES, p.characterId) ?? 'ABILITÀ';
    if (VOLLEYBALL_ACTIVATIONS.has(f.type)) {
      this.entities.get(p.id)?.playAbility(name);
      abilityHub.activated(p.id);
    }
    const shout = (text: string, color: string, vib = 70): void => {
      this.hud.feedMessage(`${p.avatar} ${text}`, color);
      this.ctx.vibrate(p.id, vib);
    };
    switch (f.type) {
      case 'goblin_jager':
        this.ctx.signal(p.id, { type: 'ability', name });
        audio.select();
        shout(`${name} — SCHIACCIA A MEZZ'ARIA!`, '#10b981', 60);
        break;
      case 'goblin_jager_boom':
        abilityHub.succeeded(p.id, 'bombe');
        this.hud.feedMessage(`${p.avatar} JÄGER BOMB! 💥 SMASH!`, '#10b981');
        this.ctx.signal(p.id, { type: 'jager_boom' });
        this.camera.shake(0.35, 260);
        break;
      case 'goblin_jager_wasted':
        abilityHub.wasted(p.id);
        this.hud.feedMessage(`${p.avatar} JÄGER BOMB sprecata...`, '#9ca3af');
        this.ctx.signal(p.id, { type: 'jager_wasted' });
        break;
      case 'goblin_jager_expired':
        abilityHub.wasted(p.id);
        break;
      case 'buttafuori_muro':
        this.ctx.signal(p.id, { type: 'ability', name });
        audio.select();
        shout(`${name}!`, '#f97316');
        break;
      case 'buttafuori_block':
        abilityHub.succeeded(p.id, 'muri');
        this.hud.feedMessage(`${p.avatar} MURO!`, '#f97316', 1400);
        this.ctx.signal(p.id, { type: 'stable' });
        break;
      case 'judoka_freeze': {
        const b = this.ball;
        this.freeze = { by: p.id, t: VOLLEY_JUDOKA.p.freeze, vx: b.vx, vy: b.vy, vz: b.vz };
        this.ctx.signal(p.id, { type: 'ability', name });
        audio.select();
        shout(`${name}`, '#facc15', 90);
        break;
      }
      case 'judoka_resume':
        this.ctx.signal(p.id, { type: 'scarica' });
        break;
      case 'dottore_awake':
        this.ctx.signal(p.id, { type: 'ability', name });
        audio.select();
        shout(`${name}!`, '#22d3ee');
        break;
      case 'dottore_shot':
        abilityHub.succeeded(p.id, 'smash intuiti');
        this.hud.feedMessage(`${p.avatar} L'HA VISTO PRIMA!`, '#22d3ee');
        break;
      case 'dottore_dizzy':
        abilityHub.wasted(p.id);
        this.hud.feedMessage(`${p.avatar} GLI GIRA LA TESTA...`, '#9ca3af', 1800);
        break;
      case 'ciro_arm':
        this.ctx.signal(p.id, { type: 'ability', name });
        audio.select();
        shout(`${name}!`, '#a78bfa');
        break;
      case 'ciro_saved':
        abilityHub.impact(p.id, 'palle salvate');
        this.hud.feedMessage(`${p.avatar} PAGO DOMANI — LA PALLA RIMBALZA! DEBITO APERTO`, '#a78bfa', 2600);
        this.ctx.signal(p.id, { type: 'frozen' });
        this.shocks.spawn(this.ball.x, this.ball.z, p.color, 1.4);
        audio.bounce(0.9);
        this.ctx.vibrate(p.id, 110);
        break;
      case 'ciro_paid':
        abilityHub.succeeded(p.id, 'debiti saldati');
        this.hud.feedMessage(`${p.avatar} DEBITO SALDATO! SCAMBIO VINTO`, '#4ade80', 2200);
        this.ctx.signal(p.id, { type: 'debt_ok' });
        break;
      case 'ciro_collect':
        abilityHub.wasted(p.id);
        this.hud.feedMessage(`${p.avatar} È ARRIVATO L'ESATTORE: PUNTO DOPPIO!`, '#f472b6', 2600);
        this.ctx.signal(p.id, { type: 'debt_fail' });
        break;
    }
  }

  // ---- Ciclo di vita ----

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.unsubAbility();
    abilityHub.end(); // statistiche del round + card spenta sui telefoni
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
