import {
  Engine,
  Scene,
  Vector3,
  Color4,
  Color3,
  HemisphericLight,
  DirectionalLight,
  ShadowGenerator,
  GlowLayer,
  MeshBuilder,
  StandardMaterial,
  DynamicTexture,
  Mesh
} from '@babylonjs/core';
import type { PlayerId } from '../../../shared/types';
import type { MinigameContext } from '../types';
import { audio } from '../../core/AudioManager';
import { buildTrack, buildTrackVisuals, buildCheckpoints, buildItemBoxes, LAPS, TrackSpline } from './track';
import { createKartState } from './raceTypes';
import type { KartState } from './raceTypes';
import { KartEntity } from './kartEntity';
import { stepKartPhysics, DRIFT_THRESHOLDS } from './kartPhysics';
import type { KartInputSnapshot } from './kartPhysics';
import { ItemManager } from './items';
import { RaceManager } from './race';
import type { RaceHudEvent } from './race';
import { CameraManager, KartHud } from './cameraHud';
import { CharacterAbilities, ChoiceManager } from './abilities';
import type { AbilityFeedback } from './abilities';

const KART_S_RADIUS = 2.6;
const KART_LAT_RADIUS = 1.7;

/** Orchestratore del minigioco 3D: una sola scena Babylon, più camere/viewport. */
export class BabylonKartGame {
  private engine: Engine;
  private scene: Scene;
  private spline: TrackSpline;
  private checkpoints: number[];
  private karts = new Map<PlayerId, KartState>();
  private entities = new Map<PlayerId, KartEntity>();
  private items: ItemManager;
  private race: RaceManager;
  private cameraManager: CameraManager;
  private hud: KartHud;
  private abilities: CharacterAbilities;
  private choices: ChoiceManager;
  private order: PlayerId[];
  private firstFinishPlayed = false;
  private resultsSent = false;
  private disposed = false;
  private onResize = (): void => this.engine.resize();
  private trackAngleAt = (d: number): number => this.spline.tangentAngleAt(d);

  constructor(
    private canvas: HTMLCanvasElement,
    private ctx: MinigameContext
  ) {
    this.engine = new Engine(canvas, true, { antialias: true, stencil: true, adaptToDeviceRatio: true });
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.55, 0.8, 0.94, 1);
    this.buildSky();

    const hemi = new HemisphericLight('hemi', new Vector3(0.1, 1, 0.15), this.scene);
    hemi.intensity = 0.68;
    hemi.groundColor = new Color3(0.45, 0.42, 0.38);
    const sun = new DirectionalLight('sun', new Vector3(-0.55, -1, -0.35), this.scene);
    sun.intensity = 0.85;
    sun.position = new Vector3(160, 160, 160);
    const shadowGen = new ShadowGenerator(1024, sun);
    shadowGen.usePoissonSampling = true;
    shadowGen.bias = 0.002;

    // Bloom economico: un GlowLayer illumina solo i materiali emissivi (item
    // box, effetto turbo, lampioni) invece di un bloom globale su tutta la
    // scena — molto più leggero con 5 viewport attive contemporaneamente.
    const glow = new GlowLayer('glow', this.scene, { mainTextureRatio: 0.5 });
    glow.intensity = 0.55;

    this.spline = buildTrack();
    buildTrackVisuals(this.scene, this.spline);
    this.checkpoints = buildCheckpoints(this.spline);
    const boxPlacements = buildItemBoxes(this.spline);

    this.choices = new ChoiceManager();
    this.abilities = new CharacterAbilities(this.choices);
    this.items = new ItemManager(this.scene, boxPlacements, this.spline, ctx.rng, this.abilities, this.choices, ctx, (pid, f) =>
      this.onAbilityFeedback(pid, f)
    );
    this.cameraManager = new CameraManager(this.scene);
    this.hud = new KartHud(this.scene, this.engine);
    this.race = new RaceManager(this.checkpoints, this.spline.totalLength, Math.max(60, ctx.durationSec), this.trackAngleAt, (ev) => this.onRaceEvent(ev));

    this.order = [...ctx.playerIds];
    ctx.players.forEach((p, i) => {
      const state = createKartState(p.id, p.characterId, p.color, p.avatar);
      const col = i % 2 === 0 ? -1 : 1;
      const row = Math.floor(i / 2);
      state.lateral = col * (2.3 + row * 0.15);
      state.distance = -row * 3.6 - 1;
      state.absHeading = this.trackAngleAt(state.distance);
      this.karts.set(p.id, state);

      const entity = new KartEntity(this.scene, p.color, p.characterId);
      entity.updateVisual(state, this.spline);
      this.entities.set(p.id, entity);
      for (const mesh of entity.root.getChildMeshes()) shadowGen.addShadowCaster(mesh, false);

      const camStart = this.spline.worldPoint(state.distance, state.lateral, 3.5);
      this.cameraManager.ensure(p.id, camStart);
      this.hud.ensure(p.id, p.color);
    });

    this.cameraManager.applyLayout(this.order);
    this.hud.layout(this.order);
    this.hud.setCountdown('3');

    this.engine.runRenderLoop(() => {
      if (this.disposed) return;
      const dt = Math.min(this.engine.getDeltaTime() / 1000, 0.05) || 0.016;
      this.step(dt);
      this.scene.render();
    });
    window.addEventListener('resize', this.onResize);
  }

  private step(dt: number): void {
    const kartsList = [...this.karts.values()];
    const invertModifier = this.ctx.modifier?.id === 'controlli_invertiti';
    this.abilities.setRaceTime(this.race.raceTime);
    this.choices.update(dt, this.ctx);

    if (this.race.phase !== 'ended') {
      this.race.update(dt, kartsList, (pid) => this.ctx.input.get(pid).pressed('up'));
    }

    if (this.race.phase === 'racing') {
      for (const [pid, state] of this.karts) {
        if (state.finished) continue;
        const pin = this.ctx.input.get(pid);
        const snapshot: KartInputSnapshot = {
          left: pin.pressed('left'),
          right: pin.pressed('right'),
          up: pin.pressed('up'),
          down: pin.pressed('down'),
          drift: pin.pressed('drift'),
          item: pin.justPressed('item')
        };
        if (snapshot.item && state.heldItem) {
          this.items.useItem(state, kartsList, (id) => this.race.rankOf(kartsList, id));
          audio.select();
          this.ctx.vibrate(pid, 45);
        }
        if (pin.justPressed('ability')) {
          this.abilities.onAbilityPress(this.ctx, state, kartsList, (f) => this.onAbilityFeedback(pid, f));
        }

        const wasDrifting = state.drifting;
        const wasCharge = state.driftCharge;
        const wasStunned = state.stunTimer > 0;
        const hadItem = state.heldItem !== null;
        const prevIpponWindow = state.ipponWindow;
        stepKartPhysics(state, snapshot, dt, (d) => this.spline.widthAt(d) / 2, this.trackAngleAt, invertModifier);
        this.abilities.update(dt, state, kartsList, (f) => this.onAbilityFeedback(pid, f));

        if (wasDrifting && !state.drifting && wasCharge >= DRIFT_THRESHOLDS[0]) {
          audio.boost();
          this.ctx.vibrate(pid, 65);
          if (wasCharge >= DRIFT_THRESHOLDS[1]) this.abilities.addMeter(state, 0.22);
        }
        if (!wasStunned && state.stunTimer > 0) {
          audio.hit();
          this.ctx.vibrate(pid, 90);
        }
        if (!hadItem && state.heldItem !== null) {
          this.ctx.vibrate(pid, 40);
        }
        if (!prevIpponWindow && state.ipponWindow) {
          this.ctx.vibrate(pid, 55);
        }
      }
      this.resolveKartCollisions();
      this.items.update(dt, kartsList, (pid) => this.race.rankOf(kartsList, pid), this.karts.size);
    }

    for (const [pid, state] of this.karts) {
      this.entities.get(pid)?.updateVisual(state, this.spline);
      this.cameraManager.update(dt, pid, state, this.spline);
      this.hud.update(pid, state, this.karts.size, LAPS, DRIFT_THRESHOLDS, dt);
    }
    this.hud.layout(this.order);

    if (this.race.phase === 'ended' && !this.resultsSent) {
      this.resultsSent = true;
      this.ctx.finish({ results: this.race.buildResults(kartsList) });
    }

    // Azzera gli edge (justPressed/justReleased) qui: questa scena pilota il proprio
    // render loop (Babylon), non quello di Phaser, quindi non possiamo fare
    // affidamento sull'update() della Scene Phaser per il timing corretto.
    this.ctx.input.update();
  }

  private resolveKartCollisions(): void {
    const list = [...this.karts.values()].filter((k) => !k.finished && k.respawnTimer <= 0);
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        const ds = a.distance - b.distance;
        const dl = a.lateral - b.lateral;
        if (Math.abs(ds) < KART_S_RADIUS && Math.abs(dl) < KART_LAT_RADIUS * 2) {
          const overlap = KART_LAT_RADIUS * 2 - Math.abs(dl);
          const dir = dl === 0 ? (Math.random() < 0.5 ? -1 : 1) : Math.sign(dl);
          // Buttafuori in "MO M'IMPEGNO": quasi immobile, spinge l'altro molto di più.
          const aShare = a.tankMode && !b.tankMode ? 0.12 : b.tankMode && !a.tankMode ? 0.88 : 0.5;
          a.lateral += dir * overlap * aShare;
          b.lateral -= dir * overlap * (1 - aShare);
          a.speed *= a.tankMode ? 0.99 : 0.93;
          b.speed *= b.tankMode ? 0.99 : 0.93;
        }
      }
    }
  }

  private onAbilityFeedback(playerId: PlayerId, f: AbilityFeedback): void {
    switch (f.type) {
      case 'exploit_start':
        this.hud.flash(playerId, 'EXPLOIT!', '#4ade80');
        audio.boost();
        this.ctx.vibrate(playerId, 100);
        break;
      case 'tank_start':
        this.hud.flash(playerId, "MO M'IMPEGNO!", '#f97316');
        audio.hit();
        this.ctx.vibrate(playerId, 140);
        break;
      case 'tank_end':
        break;
      case 'dottore_effect':
        this.hud.flash(playerId, 'TRATTAMENTO SPERIMENTALE!', '#22d3ee');
        audio.select();
        this.ctx.vibrate(playerId, 90);
        break;
      case 'ippon_window':
        break;
      case 'ippon_hit':
        this.hud.flash(playerId, 'IPPON!', '#facc15');
        audio.hit();
        this.ctx.vibrate(playerId, 110);
        break;
      case 'ippon_miss':
        this.hud.flash(playerId, 'IPPON MANCATO...', '#9ca3af');
        audio.wrong();
        this.ctx.vibrate(playerId, 50);
        break;
      case 'ciro_pelato':
        this.hud.flash(playerId, "CIRO È UFFICIALMENTE PELATO", '#f472b6', 2.2);
        audio.fanfare();
        this.ctx.vibrate(playerId, 180);
        break;
    }
  }

  private onRaceEvent(ev: RaceHudEvent): void {
    if (this.disposed) return;
    if (ev.type === 'countdown') {
      if (ev.value && ev.value > 0) {
        this.hud.setCountdown(String(ev.value));
        audio.tick();
        for (const pid of this.order) this.ctx.vibrate(pid, 35);
      } else {
        this.hud.setCountdown('VIA!');
        audio.boost();
        for (const pid of this.order) this.ctx.vibrate(pid, 110);
        setTimeout(() => {
          if (!this.disposed) this.hud.setCountdown('');
        }, 700);
      }
    } else if (ev.type === 'lap') {
      audio.select();
    } else if (ev.type === 'finish') {
      if (ev.playerId) this.ctx.vibrate(ev.playerId, 160);
      if (!this.firstFinishPlayed) {
        this.firstFinishPlayed = true;
        audio.fanfare();
      } else {
        audio.select();
      }
    } else if (ev.type === 'checkpoint_clean' && ev.playerId) {
      const k = this.karts.get(ev.playerId);
      if (k) this.abilities.addMeter(k, 0.08);
    } else if (ev.type === 'overtake' && ev.playerId) {
      const k = this.karts.get(ev.playerId);
      if (k) this.abilities.addMeter(k, 0.18);
    }
  }

  /** Cupola del cielo con gradiente verticale (canvas) invece del colore piatto di prima. */
  private buildSky(): void {
    const dome = MeshBuilder.CreateSphere('skyDome', { diameter: 850, segments: 12, sideOrientation: Mesh.BACKSIDE }, this.scene);
    dome.infiniteDistance = true;

    const dt = new DynamicTexture('skyTex', { width: 4, height: 256 }, this.scene, false);
    const c = dt.getContext() as unknown as CanvasRenderingContext2D;
    const grad = c.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#1f7fd4');
    grad.addColorStop(0.55, '#a9e2ff');
    grad.addColorStop(1, '#eef8ff');
    c.fillStyle = grad;
    c.fillRect(0, 0, 4, 256);
    dt.update();

    const mat = new StandardMaterial('skyMat', this.scene);
    mat.diffuseTexture = dt;
    mat.emissiveColor = new Color3(1, 1, 1);
    mat.disableLighting = true;
    mat.backFaceCulling = false;
    dome.material = mat;
    dome.isPickable = false;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    window.removeEventListener('resize', this.onResize);
    for (const e of this.entities.values()) e.dispose();
    this.items.dispose();
    this.cameraManager.dispose();
    this.hud.dispose();
    this.engine.stopRenderLoop();
    this.scene.dispose();
    this.engine.dispose();
  }
}
