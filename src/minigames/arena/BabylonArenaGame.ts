import { Engine, Scene, Color4, DynamicTexture } from '@babylonjs/core';
import type { PlayerId, PlayerResult } from '../../../shared/types';
import type { MinigameContext } from '../types';
import { audio } from '../../core/AudioManager';
import { ShockRings, GroundMarkers } from './impactFx';
import {
  ARENA_R,
  ARENA_R_MIN,
  PLAYER_RADIUS,
  ACCEL,
  MAX_SPEED,
  FRICTION,
  DASH_SPEED,
  DASH_TIME,
  DASH_COOLDOWN,
  STUN_TIME,
  GRAVITY,
  KNOCKBACK_BASE,
  SHRINK_DELAY,
  SHRINK_DURATION,
  EDGE_WARN_DIST,
  createArenaPlayer
} from './arenaTypes';
import type { ArenaPlayer } from './arenaTypes';
import { ArenaEntity } from './arenaEntity';
import { buildEnvironment } from './arenaEnvironment';
import { ArenaCamera } from './arenaCamera';
import { ArenaHud } from './arenaHud';
import { ArenaAbilities, abilityDescription } from './arenaAbilities';
import type { ArenaAbilityFeedback } from './arenaAbilities';
import { readMove } from '../moveInput';
import { runSteps } from '../../core/frameClock';
import { guardLoop, safely } from '../../core/loopGuard';
import { applyQuality, engineOptions } from '../../core/quality';
import { say } from '../../core/announcer';
import { telemetry } from '../../core/telemetry';

const COUNTDOWN_S = 3.2;

type Phase = 'countdown' | 'playing' | 'celebrating';

/** Orchestratore del minigioco 3D ARENA DEL DISAGIO (Babylon.js su canvas dedicato). */
export class BabylonArenaGame {
  private engine: Engine;
  private scene: Scene;
  private players: ArenaPlayer[] = [];
  private entities = new Map<PlayerId, ArenaEntity>();
  private env: ReturnType<typeof buildEnvironment>;
  private camera: ArenaCamera;
  private hud: ArenaHud;
  private abilities: ArenaAbilities;
  private order: PlayerId[];

  private phase: Phase = 'countdown';
  /** false finche' la schermata CONTROLLI e' visibile. */
  private controlsDone = false;
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
  private shocks: ShockRings;
  private edgeMarkers: GroundMarkers;
  private hitStop = 0;
  private shrinkAnnounced = false;

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
    this.scene.clearColor = new Color4(0.07, 0.04, 0.12, 1);

    this.env = buildEnvironment(this.scene);
    this.camera = new ArenaCamera(this.scene, canvas);
    this.hud = new ArenaHud(this.scene);
    this.hud.setModifier(ctx.modifier?.name ?? null);

    // Texture pallino condivisa per le particelle.
    const dotTex = new DynamicTexture('arenaDot', 16, this.scene, false);
    const dc = dotTex.getContext() as unknown as CanvasRenderingContext2D;
    dc.fillStyle = 'white';
    dc.beginPath();
    dc.arc(8, 8, 7, 0, Math.PI * 2);
    dc.fill();
    dotTex.update();

    this.abilities = new ArenaAbilities((target, kx, kz, power, source) => this.applyKnockback(target, kx, kz, power, source));

    this.order = [...ctx.playerIds];
    const n = this.order.length;
    ctx.players.forEach((snap, i) => {
      const p = createArenaPlayer(snap.id, snap.characterId, snap.color, snap.avatar, snap.name);
      const ang = (Math.PI * 2 * i) / n - Math.PI / 2;
      p.x = Math.cos(ang) * ARENA_R * 0.5;
      p.z = Math.sin(ang) * ARENA_R * 0.5;
      p.facing = ang;
      this.players.push(p);
      const entity = new ArenaEntity(this.scene, dotTex, snap.color, snap.characterId, snap.avatar, snap.displayName);
      this.entities.set(p.id, entity);
    });

    this.shocks = new ShockRings(this.scene);
    this.edgeMarkers = new GroundMarkers(this.scene, n, 2.6, [1, 0.15, 0.2]);
    this.hud.setAlive(n);
    this.hud.setCountdown('3');

    // Schermata CONTROLLI: finche' e' su, countdown/fisica/timer restano fermi (vedi step()); alla fine gli input sono azzerati.
    if (ctx.showControls) void ctx.showControls().then(() => (this.controlsDone = true));
    else this.controlsDone = true;

    applyQuality(this.engine, this.scene); // preset LOW/MEDIUM/HIGH + risoluzione dinamica (core/quality)
    this.engine.runRenderLoop(guardLoop(() => {
      if (this.disposed) return;
      if (this.paused) return; // menu ESC: fermo totale, nessun input processato
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
      if (!this.controlsDone) dt = 0; // schermata CONTROLLI in corso: il countdown non parte
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
          this.ctx.sendPrivate(p.id, { type: 'info', ability: abilityDescription(p.characterId) });
        }
      }
    } else if (this.phase === 'playing') {
      if (this.hitStop > 0) {
        // HITSTOP leggero: pochi ms di fermo sul colpo (l'impatto "pesa"), poi la simulazione riprende identica
        this.hitStop -= dt;
        held = true;
      } else {
        this.gameTime += dt;
        this.updateShrink();
        for (const p of this.players) this.stepPlayer(p, dt);
        this.resolveCollisions();
        this.checkEliminations();
        this.updateEdgeWarnings(now);
        this.checkEndCondition();
      }
    } else if (this.phase === 'celebrating') {
      this.celebrateTime -= dt;
      if (this.celebrateTime <= 0 && !this.resultsSent) {
        this.resultsSent = true;
        this.ctx.finish({ results: this.buildResults() });
      }
    }

    // Aggiornamento visuale (anche durante il countdown, per posizionare i personaggi)
    for (const p of this.players) {
      this.entities.get(p.id)?.updateVisual(p, dt, now);
    }
    this.shocks.update(dt);
    this.camera.update(dt, this.players, now);
    this.env.update(now);

    if (!held) this.ctx.input.update();
  }

  private timeOutClearCountdown(): void {
    window.setTimeout(() => {
      if (!this.disposed) this.hud.clearCountdown();
    }, 700);
  }

  // ---- Fisica ----

  private updateShrink(): void {
    const t = Math.max(0, this.gameTime - SHRINK_DELAY);
    const frac = Math.min(1, t / SHRINK_DURATION);
    const radius = ARENA_R + (ARENA_R_MIN - ARENA_R) * frac;
    const scale = radius / ARENA_R;
    this.env.setShrink(scale, frac > 0);
    this.currentRadius = radius;
    if (!this.shrinkAnnounced && this.gameTime >= SHRINK_DELAY) {
      // il PERCHE' di molte cadute: il bordo si stringe. Prima annuncio (feed + botto), poi l'anello diventa rosso.
      this.shrinkAnnounced = true;
      this.hud.feedMessage('⭕ IL BORDO SI STRINGE! STAI LONTANO DAL VUOTO', '#f87171', 3200);
      audio.thump(0.7);
      this.camera.shake(0.12, 400);
      this.ctx.signal(null, { type: 'shrink' });
    }
  }

  /** Bordo vicino: anello rosso pulsante sotto il giocatore + avviso sul telefono (max 1 ogni 1.5 s). */
  private updateEdgeWarnings(now: number): void {
    this.players.forEach((p, i) => {
      if (!p.alive || p.falling) {
        this.edgeMarkers.hide(i);
        return;
      }
      if (this.currentRadius - Math.hypot(p.x, p.z) < EDGE_WARN_DIST) {
        this.edgeMarkers.show(i, p.x, p.z, now);
        if (now - p.edgeWarnAt > 1500) {
          p.edgeWarnAt = now;
          this.ctx.signal(p.id, { type: 'edge' });
        }
      } else {
        this.edgeMarkers.hide(i);
      }
    });
  }

  private currentRadius = ARENA_R;

  private stepPlayer(p: ArenaPlayer, dt: number): void {
    if (p.falling) {
      p.spin += dt * 9;
      p.vy -= GRAVITY * dt;
      p.y += p.vy * dt;
      p.x += p.vx * dt;
      p.z += p.vz * dt;
      return;
    }

    // Timer
    p.dashCooldown = Math.max(0, p.dashCooldown - dt);
    p.stunTime = Math.max(0, p.stunTime - dt);
    p.hitFlash = Math.max(0, p.hitFlash - dt);
    this.abilities.update(p, dt, (f) => this.onAbilityFeedback(p, f));

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

    const stunned = p.stunTime > 0;

    // Dash
    if (!stunned && input.justPressed('dash') && p.dashCooldown <= 0 && !p.dashing) {
      const dirX = mag > 0.15 ? ax : Math.sin(p.facing);
      const dirZ = mag > 0.15 ? az : Math.cos(p.facing);
      p.dashing = true;
      p.dashTime = DASH_TIME;
      p.dashCooldown = DASH_COOLDOWN;
      p.vx = dirX * DASH_SPEED;
      p.vz = dirZ * DASH_SPEED;
      audio.boost();
      this.ctx.vibrate(p.id, 30);
      this.ctx.signal(p.id, { type: 'dash_used', cooldownMs: Math.round(DASH_COOLDOWN * 1000) });
    }

    // Abilità
    if (!stunned && input.justPressed('ability')) {
      this.abilities.onAbilityPress(p, this.players, (f) => this.onAbilityFeedback(p, f));
    }

    if (p.dashing) {
      p.dashTime -= dt;
      if (p.dashTime <= 0) p.dashing = false;
    } else if (!stunned && mag > 0.15) {
      p.facing = Math.atan2(ax, az);
      const accel = ACCEL * p.speedMult;
      p.vx += ax * accel * dt;
      p.vz += az * accel * dt;
    }

    // Attrito + limite velocità (solo in movimento normale, non in dash/knockback)
    if (!p.dashing) {
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

    // Integrazione
    p.x += p.vx * dt;
    p.z += p.vz * dt;
    if (p.y > 0 || p.vy !== 0) {
      p.vy -= GRAVITY * dt;
      p.y += p.vy * dt;
      if (p.y <= 0) {
        p.y = 0;
        p.vy = 0;
      }
    }
  }

  private applyKnockback(target: ArenaPlayer, kx: number, kz: number, power: number, source?: ArenaPlayer): void {
    if (!target.alive || target.falling) return;
    if (source && source.id !== target.id) {
      // CHI: ricordo l'ultimo che ti ha spinto (anche se la spinta e' rimandata da Ciro): a lui va l'eliminazione
      target.lastHitBy = source.id;
      target.lastHitAt = this.gameTime;
    }
    const k = this.abilities.shieldIncoming(target, kx * power, kz * power);
    if (k.x === 0 && k.z === 0) return; // Ciro: rimandata
    target.vx += k.x;
    target.vz += k.z;
    target.vy = this.gravityLow ? 5 : 3;
    target.stunTime = Math.max(target.stunTime, STUN_TIME);
    target.hitFlash = 0.16;
    this.entities.get(target.id)?.burstHit();
    // impatto proporzionale al colpo EFFETTIVO (resistenze incluse): onda d'urto nel punto di contatto, botto, hitstop leggero
    const heavy = Math.min(1.5, Math.hypot(k.x, k.z) / KNOCKBACK_BASE + 0.2);
    this.shocks.spawn(target.x - kx * 0.6, target.z - kz * 0.6, target.color, 0.7 + heavy * 0.5);
    audio.thump(heavy);
    this.hitStop = Math.max(this.hitStop, 0.035 + 0.03 * Math.min(1, heavy));
    this.ctx.vibrate(target.id, 60);
    if (source) this.ctx.vibrate(source.id, 35); // conferma di colpo per chi ha spinto
    this.camera.shake(0.1 + 0.1 * heavy, 170);
  }

  private resolveCollisions(): void {
    const list = this.players.filter((p) => p.alive && !p.falling);
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const dist = Math.hypot(dx, dz);
        const minDist = PLAYER_RADIUS * 2;
        if (dist >= minDist) continue;
        const nx = dist > 0.001 ? dx / dist : (Math.random() < 0.5 ? -1 : 1);
        const nz = dist > 0.001 ? dz / dist : 0;
        const overlap = (minDist - dist) / 2;
        a.x -= nx * overlap;
        a.z -= nz * overlap;
        b.x += nx * overlap;
        b.z += nz * overlap;

        const aDash = a.dashing;
        const bDash = b.dashing;
        if (aDash && !bDash) {
          this.applyKnockback(b, nx, nz, KNOCKBACK_BASE * a.knockMult, a);
          a.dashing = false;
          a.vx *= 0.35;
          a.vz *= 0.35;
        } else if (bDash && !aDash) {
          this.applyKnockback(a, -nx, -nz, KNOCKBACK_BASE * b.knockMult, b);
          b.dashing = false;
          b.vx *= 0.35;
          b.vz *= 0.35;
        } else {
          // Contatto semplice: separa + piccolo impulso proporzionale alla velocità relativa.
          const relAlong = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
          if (relAlong < 0) {
            const impulse = -relAlong * 0.6;
            a.vx -= nx * impulse;
            a.vz -= nz * impulse;
            b.vx += nx * impulse;
            b.vz += nz * impulse;
          }
        }
      }
    }
  }

  private checkEliminations(): void {
    for (const p of this.players) {
      if (!p.alive || p.falling) continue;
      if (Math.hypot(p.x, p.z) > this.currentRadius) {
        this.eliminate(p);
      }
    }
  }

  private eliminate(p: ArenaPlayer): void {
    p.alive = false;
    p.falling = true;
    p.spin = 0;
    this.eliminationOrder.push(p.id);
    this.eliminatedAt.set(p.id, this.gameTime);
    // Lancio fuori: spinta radiale + salto + rotazione.
    const d = Math.hypot(p.x, p.z) || 1;
    p.vx = (p.x / d) * 7;
    p.vz = (p.z / d) * 7;
    p.vy = 5;
    // CHI / COME / PERCHE': chi ti ha spinto negli ultimi 3 s, oppure il bordo che si stringe, oppure sei caduto da solo
    const pusher = p.lastHitBy && this.gameTime - p.lastHitAt < 3 ? this.players.find((x) => x.id === p.lastHitBy) : undefined;
    if (pusher) pusher.eliminations++;
    const shrinking = this.gameTime > SHRINK_DELAY;
    const how = pusher ? 'push' : shrinking ? 'edge' : 'fall';
    const feed = pusher
      ? `🥊 ${pusher.name.toUpperCase()} → ${p.avatar} ${p.name.toUpperCase()} È FUORI!`
      : shrinking
        ? `⭕ ${p.avatar} ${p.name.toUpperCase()} INGHIOTTITO DAL BORDO!`
        : `${p.avatar} ${p.name.toUpperCase()} È CADUTO!`;
    audio.fall();
    audio.thump(1.1);
    this.entities.get(p.id)?.burstHit();
    this.shocks.spawn(p.x, p.z, p.color, 1.5);
    this.camera.shake(0.42, 280);
    this.hitStop = Math.max(this.hitStop, 0.08);
    this.hud.feedMessage(feed, '#f87171');
    this.ctx.signal(p.id, { type: 'eliminated', by: pusher?.name ?? null, how });
    if (pusher) {
      this.ctx.signal(pusher.id, { type: 'kill', name: p.name });
      this.ctx.vibrate(pusher.id, 90);
    }
    const aliveNow = this.players.filter((x) => x.alive).length;
    this.hud.setAlive(aliveNow);
    const duel = aliveNow === 2 && this.players.length > 2 ? say('lastTwo', true) : null;
    if (duel) this.hud.feedMessage(duel, '#fbbf24', 2200);
  }

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
    for (let i = 0; i < this.players.length; i++) this.edgeMarkers.hide(i);

    const winner = this.players.find((p) => p.alive);
    if (winner) {
      winner.vy = 6; // salto di vittoria
      audio.fanfare();
      this.hud.feedMessage(`🏆 ${winner.avatar} ${winner.name.toUpperCase()} VINCE!`, '#fbbf24', 4000);
      this.ctx.signal(winner.id, { type: 'won' });
      const e = this.entities.get(winner.id);
      e?.burstHit();
    } else {
      audio.select();
      this.hud.feedMessage('Nessun sopravvissuto!', '#9ca3af', 3000);
    }
  }

  private buildResults(): PlayerResult[] {
    const pushed = this.players.reduce((a, p) => a + p.eliminations, 0);
    telemetry.metrics('arena', { durationSec: Math.round(this.gameTime), out: this.eliminatedAt.size, pushOuts: pushed, edgeOrFallOuts: this.eliminatedAt.size - pushed });
    const alive = this.players
      .filter((p) => p.alive)
      .sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z));
    const eliminated = this.eliminationOrder.slice().reverse();
    const aliveIds = alive.map((p) => p.id);
    const ranking = [...aliveIds, ...eliminated.filter((id) => !aliveIds.includes(id))];
    return ranking.map((pid, i) => {
      const t = this.eliminatedAt.get(pid);
      const elim = this.players.find((p) => p.id === pid)?.eliminations ?? 0;
      return {
        playerId: pid,
        placement: i + 1,
        score: 0,
        stats: [t === undefined ? 'ultimo in piedi' : `caduto dopo ${Math.round(t)}s`, ...(elim > 0 ? [`${elim} ${elim === 1 ? 'buttato fuori' : 'buttati fuori'}`] : [])]
      };
    });
  }

  // ---- Feedback abilità ----

  private onAbilityFeedback(p: ArenaPlayer, f: ArenaAbilityFeedback): void {
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
      case 'ciro_due':
        this.hud.feedMessage(`${p.avatar} DEBITO RISCOSSO!`, '#f472b6');
        this.ctx.signal(p.id, { type: 'ciro_due' });
        audio.hit();
        this.ctx.vibrate(p.id, 90);
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
