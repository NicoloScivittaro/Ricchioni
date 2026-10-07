import { Engine, Scene, Color4, DynamicTexture, MeshBuilder, StandardMaterial, Color3, Mesh, ParticleSystem, Vector3 } from '@babylonjs/core';
import type { PlayerId, PlayerResult } from '../../../shared/types';
import type { MinigameContext } from '../types';
import { audio } from '../../core/AudioManager';
import { setGameIntensity } from '../../core/musicDirector';
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
  RECEIVE_RADIUS,
  RECEIVE_SPEED,
  LUNGE_REACH,
  LUNGE_ATTEMPT_RANGE,
  WHIFF_STUN,
  KICK_MIN,
  KICK_MAX,
  CHARGE_TIME,
  BALL_FRICTION,
  BALL_MAX_SPEED,
  MATCH_SECONDS,
  GOLDEN_GOAL_SECONDS,
  INTRO_SECONDS,
  GOAL_PAUSE_SECONDS,
  CURVE_RATE,
  TEAM_COLOR,
  TEAM_LABEL,
  createSoccerPlayer,
  createBall
} from './soccerTypes';
import type { SoccerPlayer, SoccerBall, Team } from './soccerTypes';
import { ArenaEntity } from '../arena/arenaEntity';
import { ArenaCamera } from '../arena/arenaCamera';
import { ShockRings, makeBallTrail } from '../arena/impactFx';
import { SoccerHud } from './soccerHud';
import { buildSoccerEnvironment } from './soccerEnvironment';
import { registerEnvScene } from '../env/envDebug';
import { SoccerAbilities, SOCCER_ACTIVATIONS, SOCCER_GOBLIN, SOCCER_JUDOKA, SOCCER_DOTTORE, SOCCER_CIRO } from './soccerAbilities';
import type { SoccerPressResult } from './soccerAbilities';
import { abilityHub } from '../../core/abilityHub';
import { readMove } from '../moveInput';
import type { SoccerAbilityFeedback } from './soccerAbilities';
import { SOCCER_ABILITIES } from '../../../shared/soccerAbilities';
import { abilityLabel } from '../characters/reactions';

import { runSteps } from '../../core/frameClock';
import { guardLoop, safely } from '../../core/loopGuard';
import { applyQuality, engineOptions } from '../../core/quality';
import { say } from '../../core/announcer';
import { telemetry } from '../../core/telemetry';

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
  private unsubAbility: () => void = () => undefined;
  private sweetMat!: StandardMaterial;
  private order: PlayerId[];

  private aimDots: Mesh[] = [];
  private aimMat: StandardMaterial;
  private chargeMidMat: StandardMaterial;
  private chargeFullMat: StandardMaterial;
  private shocks: ShockRings;
  private trail: ParticleSystem;
  private confetti: ParticleSystem;
  private confettiAnchor: Mesh;

  private phase: Phase = 'intro';
  private phaseTime = 0;
  /** Schermata CONTROLLI: richiesta una volta a fine intro, poi il countdown parte solo a schermata chiusa. */
  private controlsRequested = false;
  private controlsDone = false;
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
    this.engine = new Engine(canvas, engineOptions().antialias, engineOptions());
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.05, 0.1, 0.08, 1);

    this.env = buildSoccerEnvironment(this.scene);
    registerEnvScene(this.scene);
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
    // Linea di carica del tiro: ciano (debole) -> giallo (medio) -> arancio (massimo)
    const mkMat = (name: string, r: number, g: number, b: number): StandardMaterial => {
      const m = new StandardMaterial(name, this.scene);
      m.diffuseColor = new Color3(r, g, b);
      m.emissiveColor = new Color3(r, g, b);
      m.disableLighting = true;
      return m;
    };
    this.chargeMidMat = mkMat('chargeMid', 1, 0.9, 0.2);
    this.chargeFullMat = mkMat('chargeFull', 1, 0.45, 0.1);
    this.sweetMat = mkMat('chargeSweet', 0.25, 1, 0.3); // zona verde del tiro perfetto del Goblin
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
      this.abilities.init(p);
      this.players.push(p);
      // Colore maglia = colore squadra (identità personale via nameplate + tratti).
      const entity = new ArenaEntity(this.scene, dotTex, TEAM_COLOR[team], snap.characterId, snap.avatar, snap.displayName, team);
      this.entities.set(p.id, entity);
    });

    abilityHub.begin('soccer', ctx);
    this.unsubAbility = abilityHub.onStatus((id, st) => this.hud.setAbility(id, st));
    this.hud.playerStrip(this.players.map((q) => ({ id: q.id, name: q.name, characterId: q.characterId, color: TEAM_COLOR[q.team], team: q.team })));
    this.spawnTeams();
    this.positionBall(0, 0);

    // Palla
    const ballMat = new StandardMaterial('ballMat', this.scene);
    ballMat.diffuseColor = new Color3(0.98, 0.98, 0.99);
    ballMat.specularColor = new Color3(0.3, 0.3, 0.3);
    this.ballMesh = MeshBuilder.CreateSphere('soccerBall', { diameter: BALL_RADIUS * 2, segments: 12 }, this.scene);
    this.ballMesh.material = ballMat;
    this.trail = makeBallTrail(this.scene, this.ballMesh, dotTex, [1, 1, 0.9]);
    this.shocks = new ShockRings(this.scene, 3);
    this.confettiAnchor = MeshBuilder.CreateBox('confettiAnchor', { size: 0.05 }, this.scene);
    this.confettiAnchor.isVisible = false;
    const cf = new ParticleSystem('goalConfetti', 160, this.scene);
    cf.particleTexture = dotTex;
    cf.emitter = this.confettiAnchor;
    cf.minEmitBox = new Vector3(-0.6, 0, -GOAL_HALF_W);
    cf.maxEmitBox = new Vector3(0.6, 0.6, GOAL_HALF_W);
    cf.color1 = new Color4(1, 0.85, 0.2, 1);
    cf.color2 = new Color4(0.3, 0.9, 1, 1);
    cf.colorDead = new Color4(1, 1, 1, 0);
    cf.minSize = 0.18;
    cf.maxSize = 0.4;
    cf.minLifeTime = 0.9;
    cf.maxLifeTime = 1.7;
    cf.emitRate = 0;
    cf.direction1 = new Vector3(-2, 5, -3);
    cf.direction2 = new Vector3(2, 10, 3);
    cf.minEmitPower = 1;
    cf.maxEmitPower = 3;
    cf.gravity = new Vector3(0, -9, 0);
    cf.start();
    this.confetti = cf;

    this.hud.setScore(0, 0);
    this.hud.setTimer(MATCH_SECONDS);
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
    this.hud.feedMessage(`🔴 SQUADRA ROSSA: ${red}`, '#f87171', 3200);
    this.hud.feedMessage(`🔵 SQUADRA BLU: ${blue}`, '#60a5fa', 3200);
    if (this.handicappedTeam) {
      this.hud.setNote(`${TEAM_LABEL[this.handicappedTeam]} IN SUPERIORITÀ NUMERICA: DASH PIÙ LENTO`, '#fbbf24');
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
        audio.startCrowd(1); // letto di folla leggerissimo per tutta la partita
        this.ctx.signal(null, { type: 'countdown', value: 0 });
        this.timeOutClearCountdown();
      }
    } else if (this.phase === 'playing' || this.phase === 'goldenGoal') {
      if (this.phase === 'playing') {
        this.matchTime -= dt;
        if (this.matchTime <= 20) setGameIntensity(2); // ultimi 20 secondi: strato musicale finale
        this.hud.setTimer(this.matchTime);
        if (this.matchTime <= 0) {
          if (this.redScore === this.blueScore) {
            this.phase = 'goldenGoal';
            this.goldenTime = GOLDEN_GOAL_SECONDS;
            this.hud.setNote('⚡ GOLDEN GOAL — il primo gol vince', '#fbbf24');
            this.hud.banner('GOLDEN GOAL', 'IL PRIMO GOL VINCE', '#fbbf24', 1600);
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
      this.entities.get(p.id)?.setCharge(p.charging ? Math.min(1, p.chargeTime / CHARGE_TIME) : 0);
      this.entities.get(p.id)?.updateVisual(p, dt, now);
    }
    this.ballMesh.position.set(this.ball.x, BALL_HEIGHT, this.ball.z);
    // scia sui tiri veloci (leggibilita' della traiettoria): piu' fitta col crescere della velocita'
    const bsp = this.ball.ownerId ? 0 : Math.hypot(this.ball.vx, this.ball.vz);
    this.trail.emitRate = bsp > 9 ? 25 + 90 * Math.min(1, bsp / BALL_MAX_SPEED) : 0;
    this.shocks.update(dt);
    this.updateAimLine();
    for (const p of this.players) abilityHub.setStatus(p.id, this.abilities.status(p)); // HUD + Companion Card (solo presentazione)
    const subjects = this.players.map((p) => ({ alive: p.alive, falling: p.falling, x: p.x, z: p.z }));
    subjects.push({ alive: true, falling: false, x: this.ball.x, z: this.ball.z });
    this.camera.update(dt, subjects, now);
    this.env.update(now);

    this.ctx.input.update();
  }

  private timeOutClearCountdown(ms = 800): void {
    window.setTimeout(() => {
      if (!this.disposed) this.hud.clearCountdown();
    }, ms);
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

    const stunned = p.stunTime > 0;
    let dodging = p.dodgeTime > 0;
    p.dashing = dodging;

    // Tackle / dash
    if (!stunned && !dodging && input.justPressed('dash') && p.dodgeCooldown <= 0) {
      const dirX = mag > 0.15 ? ax : Math.sin(p.facing);
      const dirZ = mag > 0.15 ? az : Math.cos(p.facing);
      p.dodgeTime = DASH_TIME;
      dodging = true; // vale gia' in QUESTO passo: prima la velocita' del dash veniva subito tagliata al tetto di corsa (9 invece di 15)
      p.dashing = true;
      p.dodgeCooldown = DASH_COOLDOWN * p.dashCooldownMult;
      p.vx = dirX * DASH_SPEED;
      p.vz = dirZ * DASH_SPEED;
      audio.boost();
      this.ctx.vibrate(p.id, 25);
      this.ctx.signal(p.id, { type: 'dodged', cooldownMs: Math.round(DASH_COOLDOWN * p.dashCooldownMult * 1000) });
      // tackle: controllo istantaneo alla pressione; se non aggancia nessuno il dash resta una "scivolata" che ruba al contatto
      const hit = this.tryTackle(p);
      // scivolata: solo se c'e' davvero un portatore avversario a tiro (un dash per correre non e' un tackle e non si paga)
      p.lunge = !hit && this.players.some((v) => v.alive && v.team !== p.team && v.hasBall && Math.hypot(v.x - p.x, v.z - p.z) < LUNGE_ATTEMPT_RANGE);
    }

    // Abilità (premuta ma non partita: avviso privato, mai silenzio)
    if (input.justPressed('ability')) {
      let res: SoccerPressResult = 'busy';
      if (!stunned) {
        const carrier = p.characterId === 'judoka' ? this.nearestEnemyCarrier(p) : null;
        res = this.abilities.onAbilityPress(p, carrier, (f) => this.onAbilityFeedback(p, f));
        if (res === 'ok' && carrier) this.resolveJudoka(p, carrier);
      }
      if (res !== 'ok') abilityHub.failed(p.id, res === 'cooldown' ? 'IN RICARICA' : res === 'spent' ? 'ESAURITA' : res === 'noball' ? 'SERVE LA PALLA' : res === 'far' ? 'NESSUNO A PORTATA' : 'NON ORA');
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
    } else if (p.charging && !input.pressed('shoot')) {
      p.charging = false; // il tasto non e' piu' premuto ma non c'e' stato un rilascio (input azzerato da pausa/disconnessione): la carica si annulla, NON calcia
    }

    if (dodging) {
      // velocità impostata dal dash
    } else if (!stunned && mag > 0.15) {
      p.facing = Math.atan2(ax, az);
      const effSpeed = p.speedMult * this.abilities.speedFactor(p);
      p.vx += ax * ACCEL * effSpeed * dt;
      p.vz += az * ACCEL * effSpeed * dt;
    }

    if (!dodging) {
      const damp = Math.exp(-FRICTION * dt);
      p.vx *= damp;
      p.vz *= damp;
      const sp = Math.hypot(p.vx, p.vz);
      const effMax = MAX_SPEED * p.speedMult * this.abilities.speedFactor(p);
      if (sp > effMax) {
        p.vx = (p.vx / sp) * effMax;
        p.vz = (p.vz / sp) * effMax;
      }
    }

    p.x += p.vx * dt;
    p.z += p.vz * dt;
    p.x = Math.max(-FIELD_HALF_W + PLAYER_RADIUS, Math.min(FIELD_HALF_W - PLAYER_RADIUS, p.x));
    p.z = Math.max(-FIELD_HALF_D + PLAYER_RADIUS, Math.min(FIELD_HALF_D - PLAYER_RADIUS, p.z));

    if (p.lunge) {
      if (p.dodgeTime <= 0) {
        // scivolata a vuoto: inciampo breve (rischio/beneficio del tackle)
        p.lunge = false;
        p.stunTime = Math.max(p.stunTime, WHIFF_STUN);
      } else if (this.tryTackle(p, LUNGE_REACH)) {
        p.lunge = false;
      }
    }
  }

  private kick(p: SoccerPlayer, charge: number): void {
    const frac = Math.min(1, charge / CHARGE_TIME);
    let power = (KICK_MIN + (KICK_MAX - KICK_MIN) * frac) * p.kickMult;
    let dirX = Math.sin(p.facing);
    let dirZ = Math.cos(p.facing);
    let curve = 0;
    let abilityShot = false;

    // GOBLIN — N'CULO!: un TIRO (carica > 30%) nella zona verde = bomba a giro; fuori zona = moscio. Un tocco (passaggio) non la consuma.
    if (p.characterId === 'goblin' && p.perfectTime > 0 && frac > 0.3) {
      p.perfectTime = 0;
      if (this.abilities.inSweetSpot(frac)) {
        power *= SOCCER_GOBLIN.p.power;
        curve = CURVE_RATE * SOCCER_GOBLIN.p.curve * (this.ctx.rng.next() < 0.5 ? 1 : -1);
        abilityShot = true;
        this.onAbilityFeedback(p, { type: 'goblin_perfect' });
      } else {
        power *= SOCCER_GOBLIN.p.wobblePower;
        curve = (this.ctx.rng.next() - 0.5) * CURVE_RATE;
        this.onAbilityFeedback(p, { type: 'goblin_wobble' });
      }
    }

    // DOTTORE — M'HO SVEJATO: il TIRO va da solo nell'angolo meno coperto (un passaggio non la consuma)
    if (p.characterId === 'dottore' && p.lucidTime > 0 && frac >= SOCCER_DOTTORE.p.minCharge) {
      const t = this.lucidTarget(p);
      const dx = t.x - p.x;
      const dz = t.z - p.z;
      const d = Math.hypot(dx, dz) || 1;
      dirX = dx / d;
      dirZ = dz / d;
      power *= SOCCER_DOTTORE.p.power;
      p.lucidTime = 0;
      p.slowTime = SOCCER_DOTTORE.p.slowTime;
      abilityShot = true;
      this.onAbilityFeedback(p, { type: 'dottore_shot' });
    }

    // CIRO — il debito e' saldato appena passi o tiri
    if (p.characterId === 'ciro' && p.debtTime > 0) {
      p.debtTime = 0;
      this.onAbilityFeedback(p, { type: 'ciro_paid' });
    }

    this.ball.ownerId = null;
    this.ball.prevKickerId = this.ball.lastKickerId;
    this.ball.lastKickerId = p.id;
    this.ball.vx = dirX * power;
    this.ball.vz = dirZ * power;
    this.ball.freeGrace = 0.35;
    this.ball.curve = curve;
    this.ball.abilityKickerId = abilityShot ? p.id : null;
    p.hasBall = false;
    this.teamKicks[p.team]++;
    // contatto NELLO STESSO istante dell'impulso alla palla; la carica (wind-up) si e' vista prima, follow-through ∝ potenza
    this.entities.get(p.id)?.playKick(frac);
    audio.kick(0.6 + frac * 0.9, this.pan(p.x)); // passaggio (tocco) e tiro (caricato) suonano diversi
    if (frac > 0.7) this.camera.shake(0.04 + 0.08 * frac, 110);
    this.ctx.vibrate(p.id, 30 + Math.round(frac * 30));
    this.ctx.signal(p.id, { type: 'threwBall' });
  }

  /** Angolo meno coperto della porta avversaria: quello dove il difensore piu' vicino alla linea di tiro e' piu' lontano. */
  private lucidTarget(p: SoccerPlayer): { x: number; z: number } {
    const gx = p.team === 'red' ? FIELD_HALF_W : -FIELD_HALF_W;
    let best = { x: gx, z: 0 };
    let bestCover = -1;
    for (const zc of [-GOAL_HALF_W + 0.9, GOAL_HALF_W - 0.9]) {
      let near = Infinity;
      const sx = gx - p.x;
      const sz = zc - p.z;
      const len2 = sx * sx + sz * sz || 1;
      for (const q of this.players) {
        if (q.team === p.team || !q.alive) continue;
        const t = Math.max(0, Math.min(1, ((q.x - p.x) * sx + (q.z - p.z) * sz) / len2));
        near = Math.min(near, Math.hypot(q.x - (p.x + sx * t), q.z - (p.z + sz * t)));
      }
      if (near > bestCover) {
        bestCover = near;
        best = { x: gx, z: zc };
      }
    }
    return best;
  }

  /** Portatore di palla avversario piu' vicino (per l'IPPON del Judoka). */
  private nearestEnemyCarrier(p: SoccerPlayer): { player: SoccerPlayer; dist: number } | null {
    let best: { player: SoccerPlayer; dist: number } | null = null;
    for (const v of this.players) {
      if (v.team === p.team || !v.alive || !v.hasBall) continue;
      const d = Math.hypot(v.x - p.x, v.z - p.z);
      if (!best || d < best.dist) best = { player: v, dist: d };
    }
    return best;
  }

  /** IPPON: a portata (e il portatore non sta scattando) gli strappi la palla e lo butti a terra; altrimenti inciampi a vuoto. */
  private resolveJudoka(p: SoccerPlayer, carrier: { player: SoccerPlayer; dist: number }): void {
    const J = SOCCER_JUDOKA.p;
    const v = carrier.player;
    if (carrier.dist > J.reach || v.dodgeTime > 0) {
      p.stunTime = Math.max(p.stunTime, J.whiff);
      return;
    }
    v.hasBall = false;
    p.hasBall = true;
    this.ball.ownerId = p.id;
    p.tackles++;
    const d = carrier.dist || 1;
    const nx = (v.x - p.x) / d;
    const nz = (v.z - p.z) / d;
    v.vx += nx * J.push;
    v.vz += nz * J.push;
    v.stunTime = Math.max(v.stunTime, J.stun);
    v.hitFlash = 0.18;
    this.entities.get(p.id)?.playKick(0.9);
    this.entities.get(v.id)?.playHitFrom(nx, nz, 1);
    audio.tackle(this.pan(v.x));
    this.shocks.spawn(v.x, v.z, TEAM_COLOR[v.team], 1.1);
    this.camera.shake(0.18, 200);
    this.ctx.vibrate(p.id, 80);
    this.ctx.vibrate(v.id, 80);
    this.ctx.signal(v.id, { type: 'lostBall' });
    this.ctx.signal(p.id, { type: 'gotBall' });
    abilityHub.succeeded(p.id, 'palle rubate');
  }

  /** Tackle: ruba la palla al portatore a portata. true = ha agganciato un portatore (rubata, respinta dal Buttafuori o rimandata da Ciro). */
  private tryTackle(attacker: SoccerPlayer, reach = PLAYER_RADIUS * 2 + 0.5): boolean {
    for (const victim of this.players) {
      if (victim.id === attacker.id || !victim.alive || !victim.hasBall) continue;
      if (victim.dodgeTime > 0) continue; // chi scatta con la palla si divincola: non si tackla al volo
      const d = Math.hypot(victim.x - attacker.x, victim.z - attacker.z);
      if (d >= reach) continue;
      const result = this.abilities.resolveTackle(attacker, victim);
      if (result === 'steal') {
        victim.hasBall = false;
        attacker.hasBall = true;
        this.ball.ownerId = attacker.id;
        attacker.tackles++;
        const nx = (victim.x - attacker.x) / (d || 1);
        const nz = (victim.z - attacker.z) / (d || 1);
        victim.vx += nx * 6;
        victim.vz += nz * 6;
        victim.stunTime = Math.max(victim.stunTime, 0.3);
        victim.hitFlash = 0.14;
        // tackle riuscito: chi entra allunga la gamba, chi lo subisce barcolla dalla parte della spinta
        this.entities.get(attacker.id)?.playKick(0.55);
        this.entities.get(victim.id)?.playHitFrom(nx, nz, 0.7);
        audio.tackle(this.pan(victim.x));
        this.shocks.spawn(victim.x, victim.z, TEAM_COLOR[victim.team], 0.8);
        this.camera.shake(0.12, 150);
        this.ctx.vibrate(attacker.id, 50);
        this.ctx.vibrate(victim.id, 60);
        this.ctx.signal(victim.id, { type: 'lostBall' });
        this.ctx.signal(attacker.id, { type: 'gotBall' });
      } else if (result === 'wall') {
        this.onAbilityFeedback(victim, { type: 'buttafuori_bounce' });
        attacker.lunge = false;
      } else {
        this.onAbilityFeedback(victim, { type: 'ciro_hold' });
        attacker.lunge = false;
      }
      return true;
    }
    return false;
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
      this.bounceSfx();
    } else if (b.x < -FIELD_HALF_W) {
      if (Math.abs(b.z) < GOAL_HALF_W) {
        this.scoreGoal('blue');
        return;
      }
      b.x = -FIELD_HALF_W;
      b.vx = Math.abs(b.vx);
      this.bounceSfx();
    }
    if (b.z > FIELD_HALF_D) {
      b.z = FIELD_HALF_D;
      b.vz = -Math.abs(b.vz);
      this.bounceSfx();
    } else if (b.z < -FIELD_HALF_D) {
      b.z = -FIELD_HALF_D;
      b.vz = Math.abs(b.vz);
      this.bounceSfx();
    }

    const sp = Math.hypot(b.vx, b.vz);
    if (sp > BALL_MAX_SPEED) {
      b.vx = (b.vx / sp) * BALL_MAX_SPEED;
      b.vz = (b.vz / sp) * BALL_MAX_SPEED;
    }

    // RICEZIONE ASSISTITA: un compagno di chi ha calciato controlla al volo il passaggio (entro RECEIVE_RADIUS, sotto RECEIVE_SPEED)
    // invece di respingerlo. Non e' una palla incollata: serve averla a portata, e i tiri forti restano tiri (si respingono).
    const lastKicker = b.lastKickerId ? this.players.find((q) => q.id === b.lastKickerId) : undefined;
    if (lastKicker && b.freeGrace <= 0 && sp < RECEIVE_SPEED) {
      let mate: SoccerPlayer | null = null;
      let mateD = RECEIVE_RADIUS;
      for (const q of this.players) {
        if (!q.alive || q.hasBall || q.id === lastKicker.id || q.team !== lastKicker.team || q.stunTime > 0) continue;
        const d = Math.hypot(q.x - b.x, q.z - b.z);
        if (d < mateD) {
          mateD = d;
          mate = q;
        }
      }
      if (mate) {
        this.giveBall(mate);
        return;
      }
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
          if (-dot > 6) audio.kick(0.7); // parata / deviazione secca
          b.freeGrace = Math.max(b.freeGrace, 0.12); // dopo un rimpallo non si riprende subito (niente "respingi e incolla")
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
      if (best) this.giveBall(best);
    }
  }

  /** Un giocatore prende il controllo della palla. E' un INTERCETTO (statistica MVP) solo se l'ultimo tiro era di un avversario:
   *  riprendere la propria palla lunga non e' un contrasto (niente farming di punti). L'intercetto spezza la catena degli assist. */
  private giveBall(p: SoccerPlayer): void {
    const b = this.ball;
    const lk = b.lastKickerId ? this.players.find((q) => q.id === b.lastKickerId) : undefined;
    if (lk && lk.team !== p.team) {
      p.interceptions++;
      b.prevKickerId = null;
    }
    b.ownerId = p.id;
    p.hasBall = true;
    b.vx = 0;
    b.vz = 0;
    audio.pickupPop();
    this.ctx.vibrate(p.id, 30);
    this.ctx.signal(p.id, { type: 'gotBall' });
  }

  private bounceSfx(): void {
    audio.bounce(Math.min(1.2, Math.hypot(this.ball.vx, this.ball.vz) / 18 + 0.35));
  }

  /** Coriandoli di squadra dalla porta in cui e' entrata la palla. */
  private burstConfetti(scoringTeam: Team): void {
    const c = Color3.FromHexString(TEAM_COLOR[scoringTeam]);
    this.confetti.color1.set(c.r, c.g, c.b, 1);
    this.confetti.color2.set(1, 0.85, 0.2, 1);
    this.confettiAnchor.position.set(scoringTeam === 'red' ? FIELD_HALF_W : -FIELD_HALF_W, 1.2, 0);
    this.confetti.manualEmitCount = 140;
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
        if (this.ball.abilityKickerId === kicker.id) abilityHub.succeeded(kicker.id, 'gol da abilità');
        if (prev && prev.team === team && prev.id !== kicker.id) prev.assists++;
      } else {
        kicker.ownGoals++;
        ownGoal = true;
      }
    }

    if (team === 'red') this.redScore++;
    else this.blueScore++;
    this.hud.setScore(this.redScore, this.blueScore);

    // GOL: impatto in rete -> la folla si gonfia -> stinger del telecronista (musica giu') -> fischio
    audio.goalNet(this.pan(this.ball.x));
    audio.crowdSwell(1);
    audio.announcer('GOAL');
    audio.whistle();
    this.camera.shake(0.55, 360);
    this.burstConfetti(team);
    this.shocks.spawn(team === 'red' ? FIELD_HALF_W - 1 : -FIELD_HALF_W + 1, this.ball.z, TEAM_COLOR[team], 1.6);
    // annuncio grande e BREVE con chi ha segnato (o l'autogol) + punteggio; la frase del telecronista va nel feed
    const scorer = kicker ? kicker.name.toUpperCase() : TEAM_LABEL[team];
    this.hud.banner(ownGoal ? 'AUTOGOL!' : 'GOOOL!', `${ownGoal ? `${scorer} (AUTOGOL)` : scorer} · ROSSI ${this.redScore} — ${this.blueScore} BLU`, TEAM_COLOR[team], 1500);
    const label = say(ownGoal ? 'ownGoal' : 'goal', true);
    if (label) this.hud.feedMessage(label, team === 'red' ? '#f87171' : '#60a5fa', 2600);
    for (const p of this.players) this.ctx.vibrate(p.id, team === p.team ? 160 : 80);
    this.ctx.signal(null, { type: 'goal', team });
    this.env.goal(team === 'red' ? 1 : -1); // la rete si gonfia, gli amici dietro la recinzione esultano (solo spettacolo)
    // ESULTANZA PERSONALE: chi segna fa la sua (il Goblin da stadio, l'ippon del Judoka...), i compagni la breve, gli altri ci restano male
    const pause = GOAL_PAUSE_SECONDS - 0.2;
    for (const p of this.players) {
      const e = this.entities.get(p.id);
      if (!e) continue;
      if (kicker && p.id === kicker.id) {
        if (ownGoal) e.playDefeat(pause);
        else {
          e.playVictory(pause);
          e.react('victory');
        }
      } else if (p.team === team) e.playVictory(pause * 0.6);
      else e.playDefeat(pause * 0.6);
    }

    this.goalDuringGolden = this.phase === 'goldenGoal';
    this.phase = 'goalPause';
    this.phaseTime = GOAL_PAUSE_SECONDS;
    // la palla RESTA in rete (e la camera la segue) fino alla ripartenza: prima si teletrasportava a centrocampo
    const gx = team === 'red' ? FIELD_HALF_W + 0.8 : -FIELD_HALF_W - 0.8;
    const gz = Math.max(-GOAL_HALF_W + 0.6, Math.min(GOAL_HALF_W - 0.6, this.ball.z));
    this.ball = createBall();
    this.ball.x = gx;
    this.ball.z = gz;
    this.ball.freeGrace = 99;
  }

  private resetAfterGoal(): void {
    for (const p of this.players) this.abilities.clearEffects(p); // niente finestre aperte dopo una ripartenza (le cariche restano com'erano)
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
    const sum = (f: (p: SoccerPlayer) => number): number => this.players.reduce((a, p) => a + f(p), 0);
    telemetry.metrics('soccer', {
      score: `${this.redScore}-${this.blueScore}`,
      teams: `${this.players.filter((p) => p.team === 'red').length}v${this.players.filter((p) => p.team === 'blue').length}`,
      winner: this.winnerTeam === 'red' ? 'r' : 'b',
      handicap: this.handicappedTeam ?? 'nessuno',
      kicks: `${this.teamKicks.red}/${this.teamKicks.blue}`,
      tackles: sum((p) => p.tackles),
      interceptions: sum((p) => p.interceptions),
      ownGoals: sum((p) => p.ownGoals)
    });
    const wl = TEAM_LABEL[this.winnerTeam];
    this.hud.feedMessage(`🏆 VINCE LA SQUADRA ${wl}! ${this.redScore} — ${this.blueScore}`, '#fbbf24', 4000);
    this.ctx.signal(null, { type: 'matchEnd', winner: this.winnerTeam });
    for (const p of this.players) {
      if (p.team === this.winnerTeam) this.ctx.signal(p.id, { type: 'won' });
      if (p.team === this.winnerTeam) this.entities.get(p.id)?.playVictory();
      else this.entities.get(p.id)?.playDefeat();
    }
    audio.fanfare();
  }

  private mvp(p: SoccerPlayer): number {
    return p.goals * 3 + p.assists * 2 + p.tackles + p.interceptions - p.ownGoals * 2;
  }

  private buildResults(): PlayerResult[] {
    const winners = this.players.filter((p) => p.team === this.winnerTeam).sort((a, b) => this.mvp(b) - this.mvp(a));
    const losers = this.players.filter((p) => p.team !== this.winnerTeam).sort((a, b) => this.mvp(b) - this.mvp(a));
    const ranking = [...winners, ...losers];
    return ranking.map((p, i) => ({
      playerId: p.id,
      placement: i + 1,
      score: this.mvp(p),
      stats: [
        `${p.goals} gol · ${p.assists} assist`,
        `${p.tackles + p.interceptions} contrasti`,
        ...(p.ownGoals > 0 ? [`${p.ownGoals} autogol 😱`] : [])
      ]
    }));
  }

  // ---- Feedback abilità ----

  private onAbilityFeedback(p: SoccerPlayer, f: SoccerAbilityFeedback): void {
    const name = abilityLabel(SOCCER_ABILITIES, p.characterId) ?? 'ABILITÀ';
    if (SOCCER_ACTIVATIONS.has(f.type)) {
      this.entities.get(p.id)?.playAbility(f.type === 'judoka_whiff' ? 'A VUOTO!' : name);
      abilityHub.activated(p.id);
    }
    const shout = (text: string, color: string, vib = 70): void => {
      this.hud.feedMessage(`${p.avatar} ${text}`, color);
      this.ctx.vibrate(p.id, vib);
    };
    switch (f.type) {
      case 'goblin_nculo':
        this.ctx.signal(p.id, { type: 'ability', name });
        audio.select();
        shout(`${name} — TIRA NELLA ZONA VERDE!`, '#10b981', 60);
        break;
      case 'goblin_perfect':
        abilityHub.succeeded(p.id, 'tiri perfetti');
        this.hud.feedMessage(`${p.avatar} TIRO PERFETTO!`, '#a3e635');
        this.shocks.spawn(p.x, p.z, p.color, 1.6);
        this.camera.shake(0.2, 220);
        audio.boost();
        this.ctx.vibrate(p.id, 110);
        break;
      case 'goblin_wobble':
        abilityHub.wasted(p.id);
        this.hud.feedMessage(`${p.avatar} TIRO SBAGLIATO... MOSCIO`, '#9ca3af', 1800);
        break;
      case 'goblin_expired':
        abilityHub.wasted(p.id);
        break;
      case 'buttafuori_wall':
        this.ctx.signal(p.id, { type: 'ability', name });
        audio.select();
        shout(`${name}!`, '#f97316');
        break;
      case 'buttafuori_bounce':
        abilityHub.succeeded(p.id, 'contrasti respinti');
        this.hud.feedMessage(`${p.avatar} CONTRASTO RESPINTO!`, '#f97316');
        this.shocks.spawn(p.x, p.z, p.color, 1.2);
        this.camera.shake(0.14, 160);
        audio.hit();
        this.ctx.vibrate(p.id, 90);
        break;
      case 'judoka_ippon':
        this.ctx.signal(p.id, { type: 'ability', name });
        this.hud.feedMessage(`${p.avatar} IPPON!`, '#facc15');
        break;
      case 'judoka_whiff':
        abilityHub.wasted(p.id);
        this.hud.feedMessage(`${p.avatar} NO, ASPETTA! ...ERA LONTANO`, '#9ca3af', 1800);
        break;
      case 'dottore_awake':
        this.ctx.signal(p.id, { type: 'ability', name });
        audio.select();
        shout(`${name}!`, '#22d3ee');
        break;
      case 'dottore_shot':
        abilityHub.succeeded(p.id, 'tiri intuiti');
        this.hud.feedMessage(`${p.avatar} L'HA VISTO PRIMA!`, '#22d3ee');
        audio.boost();
        this.ctx.vibrate(p.id, 100);
        break;
      case 'dottore_drowsy':
        abilityHub.wasted(p.id);
        this.hud.feedMessage(`${p.avatar} SI È RIADDORMENTATO...`, '#9ca3af', 1800);
        break;
      case 'ciro_arm':
        this.ctx.signal(p.id, { type: 'ability', name });
        audio.select();
        shout(`${name}!`, '#a78bfa');
        break;
      case 'ciro_hold':
        abilityHub.impact(p.id, 'contrasti rimandati');
        this.hud.feedMessage(`${p.avatar} PAGO DOMANI — PALLA TRATTENUTA! DEBITO ${SOCCER_CIRO.p.debt} s`, '#a78bfa', 2600);
        this.ctx.signal(p.id, { type: 'heldBall' });
        this.shocks.spawn(p.x, p.z, p.color, 1.3);
        audio.hit();
        this.ctx.vibrate(p.id, 100);
        break;
      case 'ciro_paid':
        abilityHub.succeeded(p.id, 'debiti saldati');
        this.hud.feedMessage(`${p.avatar} DEBITO SALDATO!`, '#4ade80');
        audio.select();
        break;
      case 'ciro_collect':
        if (p.hasBall && p.alive) {
          // l'esattore: se ha ancora la palla, la perde (rotola davanti a lui, contendibile)
          abilityHub.wasted(p.id);
          p.hasBall = false;
          this.ball.ownerId = null;
          this.ball.vx = Math.sin(p.facing) * 4;
          this.ball.vz = Math.cos(p.facing) * 4;
          this.ball.freeGrace = 0.5;
          this.ball.lastKickerId = p.id;
          this.hud.feedMessage(`${p.avatar} È ARRIVATO L'ESATTORE! PALLA PERSA`, '#f472b6');
          this.ctx.vibrate(p.id, 120);
          audio.wrong();
        } else {
          abilityHub.succeeded(p.id, 'debiti saldati');
        }
        break;
    }
  }

  // ---- Linea di mira ----

  /**
   * Linea di mira sulla TV. Chi sta CARICANDO un tiro mostra una linea di pallini lunga quanto rotolera' la palla (la potenza si
   * legge dalla lunghezza) e colorata per livello: ciano debole, giallo medio, arancio = carica MASSIMA. Il Goblin col N'CULO! armato
   * vede VERDE la zona giusta in cui rilasciare. Il Dottore col M'HO SVEJATO armato vede la linea fissa verso l'angolo in cui andra' il tiro.
   */
  private updateAimLine(): void {
    const shooter = this.players.find((p) => p.charging && p.hasBall && p.alive);
    const lucid = this.players.find((p) => p.lucidTime > 0 && p.hasBall && p.alive);
    const aimer = shooter ?? lucid;
    if (!aimer) {
      for (const d of this.aimDots) d.isVisible = false;
      return;
    }
    const frac = shooter ? Math.min(1, shooter.chargeTime / CHARGE_TIME) : 1;
    let reach = 16;
    let dirX = Math.sin(aimer.facing);
    let dirZ = Math.cos(aimer.facing);
    let mat = this.aimMat;
    if (shooter) {
      const power = (KICK_MIN + (KICK_MAX - KICK_MIN) * frac) * shooter.kickMult;
      reach = (power / BALL_FRICTION) * 0.92; // distanza di rotolamento prima di fermarsi (senza rimbalzi)
      mat = frac >= 0.97 ? this.chargeFullMat : frac >= 0.5 ? this.chargeMidMat : this.aimMat;
      if (shooter.characterId === 'goblin' && shooter.perfectTime > 0) {
        mat = this.abilities.inSweetSpot(frac) ? this.sweetMat : frac > SOCCER_GOBLIN.p.sweetTo ? this.chargeFullMat : this.aimMat;
      }
    }
    if (aimer.lucidTime > 0 && aimer.characterId === 'dottore') {
      const t = this.lucidTarget(aimer);
      const dx = t.x - aimer.x;
      const dz = t.z - aimer.z;
      const d = Math.hypot(dx, dz) || 1;
      dirX = dx / d;
      dirZ = dz / d;
      reach = d; // la linea arriva fino all'angolo scelto
      mat = this.aimMat;
    }
    let x = aimer.x + dirX * (PLAYER_RADIUS + BALL_RADIUS);
    let z = aimer.z + dirZ * (PLAYER_RADIUS + BALL_RADIUS);
    const pts: { x: number; z: number }[] = [];
    for (let i = 0; i < this.aimDots.length && (i + 1) * 0.8 <= reach; i++) {
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
        if (d.material !== mat) d.material = mat;
        d.isVisible = true;
      } else {
        d.isVisible = false;
      }
    }
  }

  // ---- Ciclo di vita ----

  /** Pan stereo dalla posizione nel campo (sinistra/destra vista dalla TV). */
  private pan(x: number): number {
    return Math.max(-0.8, Math.min(0.8, x / FIELD_HALF_W));
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.unsubAbility();
    abilityHub.end(); // statistiche del round + card spenta sui telefoni
    audio.stopCrowd();
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
