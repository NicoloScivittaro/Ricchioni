import {
  Color3,
  DirectionalLight,
  DynamicTexture,
  Engine,
  HemisphericLight,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  UniversalCamera,
  Vector3
} from '@babylonjs/core';
import { getWeapon } from '../../shared/fpsWeapons';
import { audio } from '../core/AudioManager';
import { applyQuality, engineOptions, getQualityLevel } from '../core/quality';
import * as sfx from './fpsAudio';
import { FpsViewmodel, recoilOf } from './fpsViewmodel';
import { buildFpsWorld, makeBlobShadow } from './fpsWorld';

/**
 * CLIENT DELLA SPARATORIA (telefono): rendering in prima persona.
 * L'HOST e' l'autorita' (movimento, spari, danni, hit); qui ci sono la visuale, l'arma (fpsViewmodel), i suoni (fpsAudio),
 * il mondo (fpsWorld) e l'HUD. Regola d'oro del feedback: l'hitmarker, il suono di colpo a segno e il kill compaiono
 * SOLO quando l'host li conferma; rinculo, lampo, traccianti e suono di sparo sono invece predetti localmente.
 */

const EYE_HEIGHT = 1.5;
const SENSITIVITY_X = 0.004;
const SENSITIVITY_Y = 0.004;
const LOW_HP_THRESHOLD = 25;
const BASE_FOV = 0.8;

export interface FpsPlayerState {
  id: string;
  name: string;
  color: string;
  x: number;
  z: number;
  yaw: number;
  hp: number;
  alive: boolean;
  weaponId: string;
  firing: boolean;
  magazine?: number;
  reloading?: boolean;
  dashing?: boolean;
}

export interface FpsStatePayload {
  matchTime: number;
  players: FpsPlayerState[];
}

interface RemoteEntity {
  body: Mesh;
  head: Mesh;
  nameTag: Mesh;
  blob: Mesh;
  flash: Mesh;
  flashT: number;
  x: number;
  z: number;
  yaw: number;
  hp: number;
  alive: boolean;
  flinch: number;
  weaponId: string;
  firing: boolean;
  fireAcc: number;
}

interface Tracer {
  m: Mesh;
  life: number;
}

/** Nome e ruolo mostrati all'estrazione: cosa aspettarsi da quest'arma. */
const ROLE: Record<string, string> = {
  mitraglia: 'TUTTOFARE',
  spaccatutto: 'DA VICINO: DEVASTANTE',
  laser: 'PRECISIONE: 2 COLPI',
  raffica: 'RAFFICHE DA 3',
  bombarda: 'ESPLOSIONE AD AREA',
  sparapiselli: 'PIOGGIA DI PISELLI'
};

/** Vibrazione con feature detection: se il telefono non la supporta non succede nulla (nessun errore). */
function buzz(pattern: number | number[]): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(pattern);
  } catch {
    /* ignora */
  }
}

export class FpsClient {
  private engine: Engine;
  private scene: Scene;
  private camera: UniversalCamera;
  private vm: FpsViewmodel;
  private tracers: Tracer[] = [];
  private tracerIdx = 0;
  private remotes = new Map<string, RemoteEntity>();
  private lastPos = new Map<string, { x: number; z: number }>();
  private remoteFlashMat: StandardMaterial;
  private tmpTarget = new Vector3();
  private tmpStart = new Vector3();

  // proiettili lenti (bombarda) ed esplosioni, a pool
  private projs: { m: Mesh; t: number; dur: number; ox: number; oy: number; oz: number; tx: number; ty: number; tz: number; on: boolean }[] = [];
  private booms: { m: Mesh; t: number; r: number; on: boolean }[] = [];

  private selfId: string;
  private selfX = 0;
  private selfZ = 0;
  private selfSpeed = 0;
  private yaw = 0;
  private pitch = 0;
  private facingInit = false;
  private wasDead = false;
  private alive = true;
  private dashing = false;
  private weaponId = 'mitraglia';
  private mag = 30;

  // fuoco predetto in locale (stessa logica dell'host: cadenza, raffica, ricarica)
  private firePressed = false;
  private fireCooldown = 0;
  private burstLeft = 0;
  private burstTimer = 0;
  private emptyCd = 0;
  private reloading = false;
  private reloadT = 0;
  private reloadDur = 1.5;
  private lastLookDx = 0;
  private lastLookDy = 0;
  private stepAlt = false;

  // feedback visuali
  private bloom = 0;
  private dmgKickP = 0;
  private dmgKickR = 0;
  private shake = 0;
  private lastGap = -1;
  private hpShown = -1;
  private ammoShown = '';

  // HUD
  private crossEl!: HTMLElement;
  private crossBars: HTMLElement[] = [];
  private hitEl!: HTMLElement;
  private hpNumEl!: HTMLElement;
  private hpBarEl!: HTMLElement;
  private weaponEl!: HTMLElement;
  private ammoEl!: HTMLElement;
  private reloadWrapEl!: HTMLElement;
  private reloadFillEl!: HTMLElement;
  private timerEl!: HTMLElement;
  private feedEl!: HTMLElement;
  private deathEl!: HTMLElement;
  private killEl!: HTMLElement;
  private bannerEl!: HTMLElement;
  private vignetteEl!: HTMLElement;
  private lowHpEl!: HTMLElement;
  private dmgInds: HTMLElement[] = [];
  private dmgIndIdx = 0;

  constructor(
    private container: HTMLElement,
    selfId: string,
    private onLook: (yaw: number, pitch: number) => void
  ) {
    this.selfId = selfId;
    this.buildHud();
    audio.unlock();

    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;touch-action:none;';
    container.appendChild(canvas);

    // Telefoni: qualita' automatica (i dispositivi deboli renderizzano a risoluzione ridotta, con risoluzione dinamica)
    this.engine = new Engine(canvas, engineOptions().antialias, engineOptions());
    this.scene = new Scene(this.engine);

    const hemi = new HemisphericLight('hemi', new Vector3(0.1, 1, 0.1), this.scene);
    hemi.intensity = 0.85;
    hemi.diffuse = new Color3(1, 0.98, 0.94);
    hemi.groundColor = new Color3(0.4, 0.38, 0.36);
    const sun = new DirectionalLight('sun', new Vector3(-0.4, -1, -0.3), this.scene);
    sun.intensity = 0.7;
    sun.diffuse = new Color3(1, 0.95, 0.85);

    this.camera = new UniversalCamera('fpsCam', new Vector3(0, EYE_HEIGHT, 0), this.scene);
    this.camera.minZ = 0.05;
    this.camera.maxZ = 500;
    this.camera.fov = BASE_FOV;
    this.scene.activeCamera = this.camera;

    buildFpsWorld(this.scene);
    this.vm = new FpsViewmodel(this.scene, this.camera, getQualityLevel() === 'high');
    this.vm.equip(this.weaponId);

    // pool: traccianti, lampi dei nemici, proiettili ed esplosioni
    const tracerMat = new StandardMaterial('tracerMat', this.scene);
    tracerMat.emissiveColor = new Color3(1, 0.8, 0.3);
    tracerMat.diffuseColor = new Color3(0, 0, 0);
    tracerMat.disableLighting = true;
    for (let i = 0; i < 8; i++) {
      const m = MeshBuilder.CreateBox('tracer', { width: 1, height: 1, depth: 1 }, this.scene);
      m.material = tracerMat.clone(`tracerMat${i}`);
      m.isVisible = false;
      m.isPickable = false;
      this.tracers.push({ m, life: 0 });
    }
    this.remoteFlashMat = new StandardMaterial('remoteFlash', this.scene);
    this.remoteFlashMat.emissiveColor = new Color3(1, 0.85, 0.4);
    this.remoteFlashMat.diffuseColor = new Color3(0, 0, 0);
    this.remoteFlashMat.disableLighting = true;
    this.remoteFlashMat.backFaceCulling = false;
    const projMat = new StandardMaterial('projMat', this.scene);
    projMat.emissiveColor = new Color3(1, 0.55, 0.15);
    projMat.diffuseColor = new Color3(0, 0, 0);
    projMat.disableLighting = true;
    for (let i = 0; i < 4; i++) {
      const m = MeshBuilder.CreateSphere('proj', { diameter: 0.45, segments: 8 }, this.scene);
      m.material = projMat;
      m.isVisible = false;
      m.isPickable = false;
      this.projs.push({ m, t: 0, dur: 1, ox: 0, oy: 0, oz: 0, tx: 0, ty: 0, tz: 0, on: false });
    }
    const boomMat = new StandardMaterial('boomMat', this.scene);
    boomMat.emissiveColor = new Color3(1, 0.6, 0.2);
    boomMat.diffuseColor = new Color3(0, 0, 0);
    boomMat.disableLighting = true;
    for (let i = 0; i < 3; i++) {
      const m = MeshBuilder.CreateSphere('boom', { diameter: 2, segments: 10 }, this.scene);
      m.material = boomMat.clone(`boomMat${i}`);
      m.isVisible = false;
      m.isPickable = false;
      this.booms.push({ m, t: 0, r: 4, on: false });
    }

    applyQuality(this.engine, this.scene);

    const onResize = (): void => this.engine.resize();
    window.addEventListener('resize', onResize);

    this.engine.runRenderLoop(() => {
      const dt = Math.min(this.engine.getDeltaTime() / 1000, 0.05) || 0.016;
      this.tick(dt);
      this.scene.render();
    });
  }

  // ---------------------------------------------------------------- HUD

  private buildHud(): void {
    const mk = (css: string, html = '', parent: HTMLElement = this.container): HTMLElement => {
      const el = document.createElement('div');
      el.style.cssText = css;
      if (html) el.innerHTML = html;
      parent.appendChild(el);
      return el;
    };
    const text = 'font-family:Arial,sans-serif;text-shadow:0 1px 3px #000,0 0 6px rgba(0,0,0,.6);pointer-events:none;';

    // mirino: quattro tacche + puntino, SEMPRE al centro (non segue il movimento cosmetico dell'arma)
    this.crossEl = mk('position:absolute;left:50%;top:50%;width:0;height:0;z-index:30;pointer-events:none;filter:drop-shadow(0 0 2px rgba(0,0,0,.9));transition:filter 90ms;');
    for (let i = 0; i < 4; i++) {
      const bar = mk(`position:absolute;left:0;top:0;background:#fff;border-radius:1px;width:${i < 2 ? 2 : 8}px;height:${i < 2 ? 8 : 2}px;`, '', this.crossEl);
      this.crossBars.push(bar);
    }
    mk('position:absolute;left:-1.5px;top:-1.5px;width:3px;height:3px;border-radius:50%;background:#fff;', '', this.crossEl);
    this.setGap(6);

    // hitmarker (X a quattro tacche)
    this.hitEl = mk(
      'position:absolute;left:50%;top:50%;z-index:31;pointer-events:none;opacity:0;transform:translate(-50%,-50%);color:#fff;',
      '<svg width="46" height="46" viewBox="-23 -23 46 46"><g stroke="currentColor" stroke-width="3.2" stroke-linecap="round"><line x1="-14" y1="-14" x2="-6" y2="-6"/><line x1="14" y1="-14" x2="6" y2="-6"/><line x1="-14" y1="14" x2="-6" y2="6"/><line x1="14" y1="14" x2="6" y2="6"/></g></svg>'
    );

    // in alto a sinistra: HP e arma/munizioni (i pulsanti stanno a destra e in basso: qui non vengono coperti)
    const hp = mk(`position:absolute;left:14px;top:10px;z-index:30;${text}`);
    this.hpNumEl = mk('color:#fff;font:800 20px Arial;', '❤️ 100', hp);
    const bar = mk('margin-top:4px;width:118px;height:8px;border-radius:5px;background:rgba(0,0,0,.55);border:1px solid rgba(255,255,255,.35);overflow:hidden;', '', hp);
    this.hpBarEl = mk('height:100%;width:100%;background:#4ade80;transition:width 120ms,background 120ms;', '', bar);
    const weapon = mk(`position:absolute;left:14px;top:62px;z-index:30;${text}`);
    this.weaponEl = mk('color:#fbbf24;font:800 12px Arial;letter-spacing:.04em;', '', weapon);
    this.ammoEl = mk('color:#fff;font:900 28px "Arial Black",Arial;line-height:1.05;', '', weapon);

    this.timerEl = mk(`position:absolute;left:50%;top:10px;transform:translateX(-50%);color:#fbbf24;font:800 24px Arial;z-index:30;${text}`);
    this.feedEl = mk(`position:absolute;right:12px;top:10px;color:#fff;font:700 13px Arial;z-index:30;text-align:right;${text}`);

    // ricarica: barra di avanzamento al centro-basso (tra joystick e pulsanti)
    this.reloadWrapEl = mk('position:absolute;left:50%;bottom:16%;transform:translateX(-50%);z-index:30;pointer-events:none;opacity:0;transition:opacity 100ms;text-align:center;');
    mk(`color:#fff;font:900 15px "Arial Black",Arial;letter-spacing:.08em;margin-bottom:5px;${text}`, '🔄 RICARICA', this.reloadWrapEl);
    const rb = mk('width:150px;height:9px;border-radius:6px;background:rgba(0,0,0,.6);border:1px solid rgba(255,255,255,.45);overflow:hidden;margin:0 auto;', '', this.reloadWrapEl);
    this.reloadFillEl = mk('height:100%;width:0%;background:linear-gradient(90deg,#22d3ee,#4ade80);', '', rb);

    this.bannerEl = mk(`position:absolute;left:50%;top:60%;transform:translate(-50%,-50%);z-index:33;pointer-events:none;opacity:0;text-align:center;color:#fbbf24;${text}`);
    this.killEl = mk(`position:absolute;left:50%;top:32%;transform:translate(-50%,-50%);color:#fbbf24;font:900 28px "Arial Black",Arial;z-index:32;pointer-events:none;opacity:0;white-space:nowrap;${text}`);

    this.vignetteEl = mk('position:absolute;inset:0;z-index:25;pointer-events:none;opacity:0;background:radial-gradient(ellipse at center, transparent 50%, rgba(230,30,30,0.6) 100%);');
    this.lowHpEl = mk('position:absolute;inset:0;z-index:24;pointer-events:none;opacity:0;transition:opacity 400ms;background:radial-gradient(ellipse at center, transparent 62%, rgba(200,20,20,0.3) 100%);');
    // indicatori direzionali del danno (3 a rotazione: piu' colpi ravvicinati restano visibili)
    for (let i = 0; i < 3; i++) {
      const ind = mk('position:absolute;left:50%;top:50%;width:0;height:0;z-index:26;pointer-events:none;opacity:0;');
      mk(
        'position:absolute;left:0;top:0;width:0;height:0;transform:translate(-50%,-38vmin);border-left:17px solid transparent;border-right:17px solid transparent;border-bottom:30px solid rgba(255,50,50,0.95);filter:drop-shadow(0 0 7px rgba(255,0,0,0.85));',
        '',
        ind
      );
      this.dmgInds.push(ind);
    }
    this.deathEl = mk('position:absolute;inset:0;display:none;align-items:center;justify-content:center;flex-direction:column;background:rgba(0,0,0,0.55);color:#f87171;font:900 34px Arial;z-index:40;');
  }

  private setGap(g: number): void {
    if (Math.abs(g - this.lastGap) < 0.4) return;
    this.lastGap = g;
    const [t, b, l, r] = this.crossBars;
    t.style.transform = `translate(-1px,${-(8 + g)}px)`;
    b.style.transform = `translate(-1px,${g}px)`;
    l.style.transform = `translate(${-(8 + g)}px,-1px)`;
    r.style.transform = `translate(${g}px,-1px)`;
  }

  private pulse(el: HTMLElement, keyframes: Keyframe[], ms: number): void {
    if (typeof el.animate === 'function') el.animate(keyframes, { duration: ms, easing: 'ease-out' });
  }

  private flashCross(color: string): void {
    this.crossEl.style.filter = `drop-shadow(0 0 3px ${color}) drop-shadow(0 0 7px ${color})`;
    window.setTimeout(() => {
      this.crossEl.style.filter = 'drop-shadow(0 0 2px rgba(0,0,0,.9))';
    }, 130);
  }

  // ---------------------------------------------------------------- frame

  private tick(dt: number): void {
    const w = getWeapon(this.weaponId);
    const speedFrac = Math.min(1, this.selfSpeed / 8);

    // fuoco predetto (stessa logica dell'host)
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    this.emptyCd = Math.max(0, this.emptyCd - dt);
    if (this.burstLeft > 0) {
      this.burstTimer -= dt;
      if (this.burstTimer <= 0) {
        if (this.mag > 0 && !this.reloading && this.alive) {
          this.localShot(w);
          this.burstLeft--;
          this.burstTimer = w.burstGap ?? 0.07;
        } else {
          this.burstLeft = 0;
        }
      }
    }
    if (this.firePressed && this.alive && !this.reloading && this.fireCooldown <= 0 && this.burstLeft <= 0) {
      if (this.mag > 0) {
        const burst = w.burst ?? 1;
        this.fireCooldown = burst / w.fireRate;
        this.localShot(w);
        this.burstLeft = burst - 1;
        this.burstTimer = w.burstGap ?? 0.07;
      } else if (this.emptyCd <= 0) {
        sfx.empty();
        buzz(8);
        this.emptyCd = 0.4;
      }
    }

    // ricarica (avanzamento locale; l'host resta l'autorita' sul caricatore)
    let reloadP = 0;
    if (this.reloading) {
      this.reloadT += dt;
      reloadP = Math.min(1, this.reloadT / this.reloadDur);
      this.reloadFillEl.style.width = `${(reloadP * 100).toFixed(0)}%`;
      if (this.reloadT >= this.reloadDur) this.finishReload();
    }

    this.vm.aspect = this.engine.getRenderWidth() / Math.max(1, this.engine.getRenderHeight());
    this.vm.update(dt, speedFrac, this.lastLookDx, this.lastLookDy, reloadP, this.dashing);
    this.lastLookDx *= 0.6;
    this.lastLookDy *= 0.6;
    if (this.vm.stepEvent && this.alive) {
      this.stepAlt = !this.stepAlt;
      sfx.step(this.stepAlt);
    }

    // mirino: si allarga con la dispersione dell'arma, il movimento e i colpi (mai col rinculo cosmetico)
    this.bloom = Math.max(0, this.bloom - dt * 5);
    this.setGap(5 + w.spread * 90 + speedFrac * 6 + this.bloom * 9);

    this.updateCamera(dt);
    this.interpolateRemotes(dt);
    this.updateEffects(dt);
    this.updateHudText();
  }

  /** Un colpo predetto in locale: rinculo, lampo, tracciante, suono. Il danno lo decide (e conferma) l'host. */
  private localShot(w: ReturnType<typeof getWeapon>): void {
    const p = recoilOf(w.id);
    this.mag = Math.max(0, this.mag - 1);
    this.vm.fire();
    this.bloom = Math.min(1, this.bloom + (w.burst ? 0.5 : 0.35));
    sfx.shot(w.id);
    if (p.buzz > 0) buzz(p.buzz);
    if (w.splashRadius === 0) this.spawnTracer(p.tracer);
  }

  private spawnTracer(style: { color: [number, number, number]; thick: number; life: number }): void {
    const t = this.tracers[this.tracerIdx % this.tracers.length];
    this.tracerIdx++;
    const cp = Math.cos(this.pitch);
    const dx = Math.sin(this.yaw) * cp;
    const dy = Math.sin(this.pitch);
    const dz = Math.cos(this.yaw) * cp;
    const rx = Math.cos(this.yaw);
    const rz = -Math.sin(this.yaw);
    // dal vivo di volata, verso il punto mirato
    this.tmpStart.set(this.selfX + dx * 0.95 + rx * 0.2, EYE_HEIGHT - 0.13 + dy * 0.95, this.selfZ + dz * 0.95 + rz * 0.2);
    const len = style.thick > 0.06 ? 16 : 2.6;
    t.m.position.copyFrom(this.tmpStart);
    t.m.scaling.set(style.thick, style.thick, len);
    this.tmpTarget.set(this.tmpStart.x + dx * 10, this.tmpStart.y + dy * 10, this.tmpStart.z + dz * 10);
    t.m.lookAt(this.tmpTarget);
    t.m.position.x += dx * len * 0.5;
    t.m.position.y += dy * len * 0.5;
    t.m.position.z += dz * len * 0.5;
    (t.m.material as StandardMaterial).emissiveColor.set(style.color[0], style.color[1], style.color[2]);
    t.m.isVisible = true;
    t.life = style.life;
  }

  private updateCamera(dt: number): void {
    // il calcio (rinculo, danno) e' solo visivo: yaw/pitch inviati all'host restano quelli reali
    this.dmgKickP *= Math.max(0, 1 - dt * 9);
    this.dmgKickR *= Math.max(0, 1 - dt * 7);
    this.shake = Math.max(0, this.shake - dt * 2.5);
    const yaw = this.yaw + this.vm.cameraKickYaw;
    const pitch = Math.max(-1.45, Math.min(1.45, this.pitch + this.vm.cameraKickPitch + this.dmgKickP));
    const cp = Math.cos(pitch);
    const sh = this.shake * 0.12;
    this.camera.position.set(this.selfX + (Math.random() - 0.5) * sh, EYE_HEIGHT + (Math.random() - 0.5) * sh, this.selfZ + (Math.random() - 0.5) * sh);
    this.tmpTarget.set(this.camera.position.x + Math.sin(yaw) * cp, this.camera.position.y + Math.sin(pitch), this.camera.position.z + Math.cos(yaw) * cp);
    this.camera.upVector.set(Math.sin(this.dmgKickR), Math.cos(this.dmgKickR), 0);
    this.camera.setTarget(this.tmpTarget);
    this.camera.fov = BASE_FOV + 0.17 * this.vm.fovKick;
  }

  private interpolateRemotes(dt: number): void {
    for (const e of this.remotes.values()) {
      const k = 0.2;
      const cx = e.body.position.x;
      const cz = e.body.position.z;
      e.body.position.set(cx + (e.x - cx) * k, e.body.position.y, cz + (e.z - cz) * k);
      e.head.position.x = e.body.position.x;
      e.head.position.z = e.body.position.z;
      e.nameTag.position.x = e.body.position.x;
      e.nameTag.position.z = e.body.position.z;
      e.blob.position.x = e.body.position.x;
      e.blob.position.z = e.body.position.z;
      e.blob.isVisible = e.alive;
      e.body.rotation.y = e.yaw;
      e.head.rotation.y = e.yaw;
      // Flinch
      if (e.flinch > 0) {
        e.flinch -= 0.06;
        e.body.rotation.x = Math.sin(e.flinch * 40) * 0.12;
        e.head.rotation.x = Math.sin(e.flinch * 40) * 0.12;
      } else {
        e.body.rotation.x = 0;
        e.head.rotation.x = 0;
      }
      // Morte: caduta stilizzata (ruota e scende)
      if (!e.alive) {
        e.body.rotation.x = Math.min(1.4, e.body.rotation.x + 0.08);
        e.body.position.y = Math.max(0.3, e.body.position.y - 0.05);
        e.head.position.y = Math.max(0.3, e.head.position.y - 0.05);
      }
      // spari dei nemici: lampo + suono attenuato dalla distanza e spostato a destra/sinistra (si sente da dove arrivano)
      if (e.firing && e.alive) {
        const w = getWeapon(e.weaponId);
        e.fireAcc += dt;
        const interval = Math.max(0.09, 1 / w.fireRate);
        if (e.fireAcc >= interval) {
          e.fireAcc = 0;
          const dx = e.x - this.selfX;
          const dz = e.z - this.selfZ;
          const dist = Math.hypot(dx, dz);
          e.flashT = 0.06;
          if (dist < 38) {
            const rel = Math.atan2(dx, dz) - this.yaw;
            sfx.shot(e.weaponId, { gain: Math.pow(Math.max(0, 1 - dist / 38), 1.6) * 0.85, pan: Math.max(-0.9, Math.min(0.9, Math.sin(rel))) });
          }
        }
      }
      if (e.flashT > 0) {
        e.flashT -= dt;
        e.flash.isVisible = e.flashT > 0;
        e.flash.position.set(e.body.position.x + Math.sin(e.yaw) * 0.75, 1.1, e.body.position.z + Math.cos(e.yaw) * 0.75);
      }
    }
  }

  private updateEffects(dt: number): void {
    for (const t of this.tracers) {
      if (t.life <= 0) continue;
      t.life -= dt;
      if (t.life <= 0) t.m.isVisible = false;
    }
    for (const p of this.projs) {
      if (!p.on) continue;
      p.t += dt;
      const k = Math.min(1, p.t / p.dur);
      p.m.position.set(p.ox + (p.tx - p.ox) * k, p.oy + (p.ty - p.oy) * k - Math.sin(k * Math.PI) * 0.4, p.oz + (p.tz - p.oz) * k);
      if (k >= 1) {
        p.on = false;
        p.m.isVisible = false;
      }
    }
    for (const b of this.booms) {
      if (!b.on) continue;
      b.t += dt;
      const k = Math.min(1, b.t / 0.4);
      b.m.scaling.setAll(0.3 + k * b.r * 0.55);
      (b.m.material as StandardMaterial).alpha = 1 - k;
      if (k >= 1) {
        b.on = false;
        b.m.isVisible = false;
      }
    }
  }

  private updateHudText(): void {
    const w = getWeapon(this.weaponId);
    const ammo = this.reloading ? '— / ' + w.magazine : `${this.mag} / ${w.magazine}`;
    if (ammo !== this.ammoShown) {
      this.ammoShown = ammo;
      this.ammoEl.textContent = ammo;
      const low = !this.reloading && this.mag <= Math.ceil(w.magazine * 0.25);
      this.ammoEl.style.color = this.mag === 0 && !this.reloading ? '#f87171' : low ? '#fb923c' : '#fff';
    }
  }

  // ---------------------------------------------------------------- eventi dall'host

  private startReloadUi(duration: number, weaponId: string): void {
    this.reloading = true;
    this.reloadT = 0;
    this.reloadDur = Math.max(0.3, duration);
    this.burstLeft = 0;
    this.reloadWrapEl.style.opacity = '1';
    this.reloadFillEl.style.width = '0%';
    sfx.reload(weaponId, this.reloadDur);
  }

  private finishReload(): void {
    if (!this.reloading) return;
    this.reloading = false;
    this.mag = getWeapon(this.weaponId).magazine;
    this.reloadWrapEl.style.opacity = '0';
  }

  /** Ricarica avviata dall'host (manuale o automatica): parte animazione, barra e suono per la durata reale. */
  reloadStart(duration = 1.5, weaponId?: string): void {
    if (this.reloading) return;
    this.startReloadUi(duration, weaponId ?? this.weaponId);
    buzz(12);
  }

  /** Arma estratta (nuova vita): banner con nome e ruolo, suono di estrazione. */
  equipped(weaponId: string): void {
    const w = getWeapon(weaponId);
    this.bannerEl.innerHTML = `<div style="font:900 30px 'Arial Black',Arial">${w.icon} ${w.name}</div><div style="font:800 14px Arial;color:#e2e8f0;margin-top:2px">${ROLE[weaponId] ?? ''}</div>`;
    this.pulse(this.bannerEl, [{ opacity: 0, transform: 'translate(-50%,-50%) scale(1.5)' }, { opacity: 1, transform: 'translate(-50%,-50%) scale(1)', offset: 0.18 }, { opacity: 1, offset: 0.75 }, { opacity: 0 }], 1700);
    sfx.equip(weaponId);
  }

  dashed(): void {
    this.vm.dash();
    sfx.dash();
    buzz(20);
  }

  /** Hit confermato dall'host (danno reale inflitto). Se e' una kill, il feedback completo arriva da killConfirm. */
  hitMarker(dmg = 10, kill = false): void {
    const heavy = dmg >= 40;
    this.hitEl.style.color = kill ? '#ff4d4d' : heavy ? '#fbbf24' : '#ffffff';
    const s = kill ? 1.6 : heavy ? 1.3 : 1;
    this.pulse(this.hitEl, [{ opacity: 1, transform: `translate(-50%,-50%) scale(${s * 1.5})` }, { opacity: 1, transform: `translate(-50%,-50%) scale(${s})`, offset: 0.35 }, { opacity: 0, transform: `translate(-50%,-50%) scale(${s})` }], kill ? 420 : heavy ? 260 : 170);
    this.flashCross(kill ? '#ff4d4d' : '#ffffff');
    if (!kill) sfx.hitTick(dmg);
  }

  /** Subito danno: vignetta, freccia dalla parte giusta, calcio di camera, suono. */
  damageTaken(fromId: string, amount: number): void {
    sfx.hurt(amount);
    this.dmgKickP += Math.min(0.09, 0.02 + amount * 0.0012);
    this.dmgKickR += (Math.random() < 0.5 ? -1 : 1) * Math.min(0.07, 0.02 + amount * 0.001);
    this.shake = Math.min(1, this.shake + amount / 70);
    // vignetta: compare subito, resta un attimo e sfuma piano (visibile anche con colpi ravvicinati)
    this.vignetteEl.style.transition = 'none';
    this.vignetteEl.style.opacity = String(Math.min(1, 0.6 + amount / 90));
    window.setTimeout(() => {
      this.vignetteEl.style.transition = 'opacity 520ms ease-out';
      this.vignetteEl.style.opacity = '0';
    }, 90);
    this.pulse(this.hpNumEl, [{ transform: 'scale(1.35)', color: '#f87171' }, { transform: 'scale(1)', color: '#ffffff' }], 320);

    const from = this.lastPos.get(fromId);
    if (from) {
      // angolo dell'attaccante rispetto a dove guardi: 0 = davanti (in alto), positivo = a destra
      const rel = Math.atan2(from.x - this.selfX, from.z - this.selfZ) - this.yaw;
      const ind = this.dmgInds[this.dmgIndIdx++ % this.dmgInds.length];
      ind.style.transform = `rotate(${rel}rad)`;
      this.pulse(ind, [{ opacity: 1 }, { opacity: 1, offset: 0.4 }, { opacity: 0 }], 1000);
      ind.style.opacity = '0';
    }
  }

  /** Kill confermata: feedback piu' forte e diverso dal semplice hit. */
  killConfirm(name: string): void {
    this.killEl.textContent = `ELIMINATO ${name}`;
    this.pulse(this.killEl, [{ opacity: 0, transform: 'translate(-50%,-50%) scale(1.7)' }, { opacity: 1, transform: 'translate(-50%,-50%) scale(1)', offset: 0.2 }, { opacity: 1, offset: 0.75 }, { opacity: 0 }], 1200);
    this.hitMarker(100, true);
    sfx.kill();
  }

  /** Bombarda: proiettile lento in volo (visibile a tutti). */
  projectile(p: { ox: number; oy: number; oz: number; tx: number; ty: number; tz: number; dur: number }): void {
    const slot = this.projs.find((q) => !q.on);
    if (!slot) return;
    Object.assign(slot, p, { t: 0, on: true });
    slot.dur = Math.max(0.1, p.dur);
    slot.m.position.set(p.ox, p.oy, p.oz);
    slot.m.isVisible = true;
    if (p.dur > 0.4) sfx.whistle(p.dur);
  }

  /** Esplosione della bombarda: palla di fuoco, botto attenuato dalla distanza, scossa se sei vicino. */
  boom(b: { x: number; y: number; z: number; r: number }): void {
    const slot = this.booms.find((q) => !q.on) ?? this.booms[0];
    slot.on = true;
    slot.t = 0;
    slot.r = b.r;
    slot.m.position.set(b.x, Math.max(0.6, b.y), b.z);
    slot.m.isVisible = true;
    const dist = Math.hypot(b.x - this.selfX, b.z - this.selfZ);
    const rel = Math.atan2(b.x - this.selfX, b.z - this.selfZ) - this.yaw;
    sfx.boom({ gain: Math.max(0.15, 1 - dist / 45), pan: Math.max(-0.9, Math.min(0.9, Math.sin(rel))) });
    if (dist < 12) {
      this.shake = Math.min(1, this.shake + (1 - dist / 12));
      buzz(dist < 5 ? 60 : 25);
    }
  }

  // ---------------------------------------------------------------- API pubblica

  look(dx: number, dy: number): void {
    this.yaw += dx * SENSITIVITY_X;
    this.pitch -= dy * SENSITIVITY_Y;
    this.pitch = Math.max(-1.35, Math.min(1.35, this.pitch));
    this.lastLookDx = dx;
    this.lastLookDy = dy;
    this.onLook(this.yaw, this.pitch);
  }

  setFirePressed(pressed: boolean): void {
    this.firePressed = pressed;
  }

  setHp(hp: number): void {
    const v = Math.max(0, Math.round(hp));
    if (v === this.hpShown) return;
    this.hpShown = v;
    this.hpNumEl.textContent = `❤️ ${v}`;
    this.hpBarEl.style.width = `${v}%`;
    this.hpBarEl.style.background = v <= LOW_HP_THRESHOLD ? '#ef4444' : v <= 55 ? '#fbbf24' : '#4ade80';
    this.lowHpEl.style.opacity = v < LOW_HP_THRESHOLD && v > 0 ? '1' : '0';
  }

  showDeath(text: string): void {
    this.deathEl.textContent = text;
    this.deathEl.style.display = 'flex';
  }

  hideDeath(): void {
    this.deathEl.style.display = 'none';
  }

  feed(text: string): void {
    this.feedEl.textContent = text;
    window.setTimeout(() => {
      if (this.feedEl.textContent === text) this.feedEl.textContent = '';
    }, 2200);
  }

  /** Numeri per il pannello di debug dei dispositivi (solo con ?debug=1). */
  getDebugStats(): { fps: number; scale: number; weapon: string; mag: number; remotes: number } {
    return { fps: Math.round(this.engine.getFps()), scale: this.engine.getHardwareScalingLevel(), weapon: this.weaponId, mag: this.mag, remotes: this.remotes.size };
  }

  updateState(state: FpsStatePayload): void {
    this.timerEl.textContent = `⏱ ${Math.max(0, Math.ceil(state.matchTime))}`;
    for (const ps of state.players) {
      this.lastPos.set(ps.id, { x: ps.x, z: ps.z });
      if (ps.id === this.selfId) {
        const dx = ps.x - this.selfX;
        const dz = ps.z - this.selfZ;
        this.selfSpeed = Math.hypot(dx, dz) / 0.05; // ~velocita' (tick 20Hz)
        this.selfX = ps.x;
        this.selfZ = ps.z;
        // Spawn equo: la visuale e' comandata dal telefono, quindi al primo stato e a ogni rinascita ci si gira verso il
        // centro della mappa.
        if (ps.alive && (!this.facingInit || this.wasDead)) {
          this.yaw = Math.atan2(-ps.x, -ps.z);
          this.pitch = 0;
          this.facingInit = true;
          this.onLook(this.yaw, this.pitch);
        }
        this.wasDead = !ps.alive;
        this.alive = ps.alive;
        this.dashing = Boolean(ps.dashing);
        if (ps.weaponId !== this.weaponId) {
          this.weaponId = ps.weaponId;
          this.vm.equip(ps.weaponId);
          this.reloading = false;
          this.reloadWrapEl.style.opacity = '0';
          this.weaponEl.textContent = `${getWeapon(ps.weaponId).icon} ${getWeapon(ps.weaponId).name}`;
          this.mag = ps.magazine ?? getWeapon(ps.weaponId).magazine;
        } else if (ps.magazine !== undefined && (!this.firePressed || ps.magazine < this.mag)) {
          this.mag = ps.magazine;
        }
        if (this.weaponEl.textContent === '') this.weaponEl.textContent = `${getWeapon(this.weaponId).icon} ${getWeapon(this.weaponId).name}`;
        // sincronizza la ricarica con l'host (utile dopo un calo di rete o un riavvio della vista)
        if (ps.reloading && !this.reloading && ps.alive) this.startReloadUi(getWeapon(this.weaponId).reload, this.weaponId);
        else if (ps.reloading === false && this.reloading && this.reloadT > 0.25) this.finishReload();
        this.setHp(ps.hp);
        if (!ps.alive) this.showDeath('💀 ELIMINATO');
        else this.hideDeath();
        if (ps.alive && !ps.firing) this.setFirePressed(false);
        continue;
      }
      let e = this.remotes.get(ps.id);
      if (!e) e = this.spawnRemote(ps);
      if (e) {
        e.x = ps.x;
        e.z = ps.z;
        e.yaw = ps.yaw;
        if (ps.hp < e.hp) e.flinch = 1; // ha subito danno
        e.hp = ps.hp;
        e.weaponId = ps.weaponId;
        e.firing = ps.firing;
        const wasAlive = e.alive;
        e.alive = ps.alive;
        if (wasAlive && !ps.alive) {
          e.body.position.y = 0.7;
          e.head.position.y = 1.55;
        }
        if (!wasAlive && ps.alive) {
          // rinasce: rimette il corpo in piedi
          e.body.rotation.x = 0;
          e.body.position.y = 0.7;
          e.head.position.y = 1.55;
        }
        e.body.isVisible = true;
        e.head.isVisible = true;
        e.nameTag.isVisible = ps.alive;
      }
    }
  }

  private spawnRemote(ps: FpsPlayerState): RemoteEntity {
    const bodyMat = new StandardMaterial('b', this.scene);
    bodyMat.diffuseColor = Color3.FromHexString(ps.color);
    const body = MeshBuilder.CreateBox('body', { width: 0.8, height: 1.4, depth: 0.8 }, this.scene);
    body.material = bodyMat;
    body.position.y = 0.7;
    const head = MeshBuilder.CreateSphere('head', { diameter: 0.55, segments: 8 }, this.scene);
    const skin = new StandardMaterial('skin', this.scene);
    skin.diffuseColor = new Color3(0.9, 0.72, 0.58);
    head.material = skin;
    head.position.y = 1.55;

    const tag = this.makeNameTag(ps);
    tag.position.y = 2.1;
    tag.billboardMode = Mesh.BILLBOARDMODE_ALL;

    const flash = MeshBuilder.CreatePlane('rflash', { size: 0.7 }, this.scene);
    flash.material = this.remoteFlashMat;
    flash.billboardMode = Mesh.BILLBOARDMODE_ALL;
    flash.isVisible = false;
    flash.isPickable = false;

    const e: RemoteEntity = {
      body,
      head,
      nameTag: tag,
      blob: makeBlobShadow(this.scene),
      flash,
      flashT: 0,
      x: ps.x,
      z: ps.z,
      yaw: ps.yaw,
      hp: ps.hp,
      alive: ps.alive,
      flinch: 0,
      weaponId: ps.weaponId,
      firing: false,
      fireAcc: 0
    };
    this.remotes.set(ps.id, e);
    return e;
  }

  /** Targhetta col nome E il colore del giocatore (barra), cosi' non ci si affida al solo colore del corpo. */
  private makeNameTag(ps: FpsPlayerState): Mesh {
    const dt = new DynamicTexture('tag', { width: 256, height: 64 }, this.scene, false);
    dt.hasAlpha = true;
    const c = dt.getContext() as unknown as CanvasRenderingContext2D;
    c.clearRect(0, 0, 256, 64);
    c.fillStyle = 'rgba(0,0,0,0.65)';
    c.beginPath();
    c.roundRect(4, 4, 248, 56, 14);
    c.fill();
    c.fillStyle = ps.color;
    c.beginPath();
    c.roundRect(14, 50, 228, 6, 3);
    c.fill();
    c.fillStyle = '#fff';
    c.font = '800 28px Arial';
    c.textAlign = 'center';
    c.fillText(ps.name.length > 12 ? ps.name.slice(0, 12) + '…' : ps.name, 128, 40);
    dt.update();
    const mat = new StandardMaterial('tagMat', this.scene);
    mat.diffuseTexture = dt;
    mat.emissiveColor = new Color3(1, 1, 1);
    mat.disableLighting = true;
    mat.backFaceCulling = false;
    const plane = MeshBuilder.CreatePlane('tagPlane', { width: 1.8, height: 0.45 }, this.scene);
    plane.material = mat;
    return plane;
  }

  /** Ferma SUBITO il ciclo di rendering (leggerissimo): il resto dello smontaggio puo' aspettare. */
  stop(): void {
    this.engine.stopRenderLoop();
  }

  /** Durata (ms) dei pezzi dell'ultimo smontaggio: serve alla diagnostica (?debug=1), non cambia nulla. */
  static lastDispose: { stop: number; vm: number; scene: number; engine: number } | null = null;

  dispose(): void {
    const t0 = performance.now();
    this.engine.stopRenderLoop();
    const t1 = performance.now();
    this.vm.dispose();
    const t2 = performance.now();
    this.scene.dispose();
    const t3 = performance.now();
    this.engine.dispose();
    const t4 = performance.now();
    FpsClient.lastDispose = { stop: +(t1 - t0).toFixed(1), vm: +(t2 - t1).toFixed(1), scene: +(t3 - t2).toFixed(1), engine: +(t4 - t3).toFixed(1) };
  }
}

