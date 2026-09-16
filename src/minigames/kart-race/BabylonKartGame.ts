import {
  Engine,
  Scene,
  Vector3,
  Color4,
  Color3,
  HemisphericLight,
  DirectionalLight,
  ShadowGenerator
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
import { AbilityHooks } from './abilities';

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
  private abilities: AbilityHooks;
  private order: PlayerId[];
  private firstFinishPlayed = false;
  private resultsSent = false;
  private disposed = false;
  private onResize = (): void => this.engine.resize();

  constructor(
    private canvas: HTMLCanvasElement,
    private ctx: MinigameContext
  ) {
    this.engine = new Engine(canvas, true, { antialias: true, stencil: true, adaptToDeviceRatio: true });
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.55, 0.8, 0.94, 1);

    const hemi = new HemisphericLight('hemi', new Vector3(0.1, 1, 0.15), this.scene);
    hemi.intensity = 0.68;
    hemi.groundColor = new Color3(0.45, 0.42, 0.38);
    const sun = new DirectionalLight('sun', new Vector3(-0.55, -1, -0.35), this.scene);
    sun.intensity = 0.85;
    sun.position = new Vector3(160, 160, 160);
    const shadowGen = new ShadowGenerator(1024, sun);
    shadowGen.usePoissonSampling = true;
    shadowGen.bias = 0.002;

    this.spline = buildTrack();
    buildTrackVisuals(this.scene, this.spline);
    this.checkpoints = buildCheckpoints(this.spline);
    const boxPlacements = buildItemBoxes(this.spline);

    this.abilities = new AbilityHooks(ctx, this.spline.totalLength);
    this.items = new ItemManager(this.scene, boxPlacements, this.spline, ctx.rng, this.abilities);
    this.cameraManager = new CameraManager(this.scene);
    this.hud = new KartHud(this.scene, this.engine);
    this.race = new RaceManager(this.checkpoints, this.spline.totalLength, Math.max(60, ctx.durationSec), (ev) => this.onRaceEvent(ev));

    this.order = [...ctx.playerIds];
    ctx.players.forEach((p, i) => {
      const state = createKartState(p.id, p.characterId, p.color, p.avatar);
      const col = i % 2 === 0 ? -1 : 1;
      const row = Math.floor(i / 2);
      state.lateral = col * (2.3 + row * 0.15);
      state.distance = -row * 3.6 - 1;
      this.karts.set(p.id, state);

      const entity = new KartEntity(this.scene, p.color);
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
        }

        const wasDrifting = state.drifting;
        const wasCharge = state.driftCharge;
        stepKartPhysics(state, snapshot, dt, (d) => this.spline.widthAt(d) / 2, invertModifier);
        this.abilities.updateCornerAssist(state);
        if (wasDrifting && !state.drifting && wasCharge >= DRIFT_THRESHOLDS[0]) audio.boost();
      }
      this.resolveKartCollisions();
      this.items.update(dt, kartsList, (pid) => this.race.rankOf(kartsList, pid), this.karts.size);
    }

    for (const [pid, state] of this.karts) {
      this.entities.get(pid)?.updateVisual(state, this.spline);
      this.cameraManager.update(dt, pid, state, this.spline);
      this.hud.update(pid, state, this.karts.size, LAPS, DRIFT_THRESHOLDS);
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
          a.lateral += dir * overlap * 0.5;
          b.lateral -= dir * overlap * 0.5;
          a.speed *= 0.93;
          b.speed *= 0.93;
        }
      }
    }
  }

  private onRaceEvent(ev: RaceHudEvent): void {
    if (this.disposed) return;
    if (ev.type === 'countdown') {
      if (ev.value && ev.value > 0) {
        this.hud.setCountdown(String(ev.value));
        audio.tick();
      } else {
        this.hud.setCountdown('VIA!');
        audio.boost();
        setTimeout(() => {
          if (!this.disposed) this.hud.setCountdown('');
        }, 700);
      }
    } else if (ev.type === 'lap') {
      audio.select();
    } else if (ev.type === 'finish') {
      if (!this.firstFinishPlayed) {
        this.firstFinishPlayed = true;
        audio.fanfare();
      } else {
        audio.select();
      }
    }
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
