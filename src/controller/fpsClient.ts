import {
  Engine,
  Scene,
  Vector3,
  Color3,
  Color4,
  MeshBuilder,
  StandardMaterial,
  Mesh,
  TransformNode,
  UniversalCamera,
  HemisphericLight,
  DirectionalLight,
  DynamicTexture
} from '@babylonjs/core';
import { FPS_MAP } from '../../shared/fpsMap';
import { getWeapon } from '../../shared/fpsWeapons';
import { audio } from '../core/AudioManager';

const EYE_HEIGHT = 1.5;
const SENSITIVITY_X = 0.004;
const SENSITIVITY_Y = 0.004;
const LOW_HP_THRESHOLD = 25;

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
}

export interface FpsStatePayload {
  matchTime: number;
  players: FpsPlayerState[];
}

interface RemoteEntity {
  body: Mesh;
  head: Mesh;
  nameTag: Mesh;
  x: number;
  z: number;
  yaw: number;
  hp: number;
  alive: boolean;
  flinch: number;
}

interface WeaponFeel {
  recoil: number;
  kick: number;
  freq: number;
  flash: number;
}

function feelFor(weaponId: string): WeaponFeel {
  switch (weaponId) {
    case 'spaccatutto':
      return { recoil: 0.13, kick: 0.2, freq: 110, flash: 0.26 };
    case 'laser':
      return { recoil: 0.03, kick: 0.05, freq: 900, flash: 0.18 };
    case 'raffica':
      return { recoil: 0.05, kick: 0.08, freq: 460, flash: 0.15 };
    case 'bombarda':
      return { recoil: 0.17, kick: 0.24, freq: 75, flash: 0.34 };
    case 'sparapiselli':
      return { recoil: 0.02, kick: 0.03, freq: 720, flash: 0.1 };
    default:
      return { recoil: 0.06, kick: 0.09, freq: 300, flash: 0.15 };
  }
}

export class FpsClient {
  private engine: Engine;
  private scene: Scene;
  private camera: UniversalCamera;
  private gunRoot!: TransformNode;
  private muzzle!: Mesh;
  private tracers: Mesh[] = [];
  private remotes = new Map<string, RemoteEntity>();
  private lastPos = new Map<string, { x: number; z: number }>();

  private selfId: string;
  private selfX = 0;
  private selfZ = 0;
  private selfSpeed = 0;
  private yaw = 0;
  private pitch = 0;
  private weaponId = 'mitraglia';

  // viewmodel animation
  private bobTime = 0;
  private recoil = 0;
  private recoilX = 0;
  private swayX = 0;
  private swayY = 0;
  private fireCooldown = 0;
  private firePressed = false;
  private muzzleTimer = 0;
  private tracerIdx = 0;
  private reloading = false;
  private reloadTimer = 0;
  private reloadDuration = 1.5;
  private dashKick = 0;
  private lastLookDx = 0;
  private lastLookDy = 0;

  // HUD
  private crossEl!: HTMLElement;
  private hitmarkEl!: HTMLElement;
  private hpEl!: HTMLElement;
  private ammoEl!: HTMLElement;
  private timerEl!: HTMLElement;
  private feedEl!: HTMLElement;
  private deathEl!: HTMLElement;
  private killEl!: HTMLElement;
  private vignetteEl!: HTMLElement;
  private dmgIndEl!: HTMLElement;
  private lowHpEl!: HTMLElement;

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

    this.engine = new Engine(canvas, true, { antialias: true, adaptToDeviceRatio: true });
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.55, 0.75, 0.95, 1);

    const hemi = new HemisphericLight('hemi', new Vector3(0.1, 1, 0.1), this.scene);
    hemi.intensity = 0.8;
    hemi.groundColor = new Color3(0.35, 0.32, 0.28);
    const sun = new DirectionalLight('sun', new Vector3(-0.4, -1, -0.3), this.scene);
    sun.intensity = 0.7;

    this.camera = new UniversalCamera('fpsCam', new Vector3(0, EYE_HEIGHT, 0), this.scene);
    this.camera.minZ = 0.1;
    this.camera.maxZ = 500;
    this.scene.activeCamera = this.camera;

    this.buildMap();
    this.gunRoot = this.buildGun();

    const onResize = (): void => this.engine.resize();
    window.addEventListener('resize', onResize);

    this.engine.runRenderLoop(() => {
      const dt = Math.min(this.engine.getDeltaTime() / 1000, 0.05) || 0.016;
      this.updateGun(dt);
      this.updateCamera();
      this.interpolateRemotes();
      this.scene.render();
    });
  }

  // ---- HUD ----

  private buildHud(): void {
    const mk = (css: string): HTMLElement => {
      const el = document.createElement('div');
      el.style.cssText = css;
      this.container.appendChild(el);
      return el;
    };
    this.crossEl = mk('position:absolute;left:50%;top:50%;width:10px;height:10px;margin:-5px;border:2px solid #fff;border-radius:50%;z-index:30;pointer-events:none;box-shadow:0 0 4px rgba(0,0,0,0.7);transition:transform 80ms linear;');
    this.hitmarkEl = mk('position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);color:#fff;font:900 26px Arial;z-index:31;pointer-events:none;opacity:0;text-shadow:0 1px 3px #000;');
    this.hpEl = mk('position:absolute;left:14px;bottom:14px;color:#fff;font:800 20px Arial;z-index:30;text-shadow:0 1px 3px #000;');
    this.ammoEl = mk('position:absolute;right:14px;bottom:14px;color:#fff;font:800 20px Arial;z-index:30;text-shadow:0 1px 3px #000;text-align:right;');
    this.timerEl = mk('position:absolute;left:50%;top:12px;transform:translateX(-50%);color:#fbbf24;font:800 24px Arial;z-index:30;text-shadow:0 1px 3px #000;');
    this.feedEl = mk('position:absolute;right:12px;top:56px;color:#fff;font:700 13px Arial;z-index:30;text-align:right;text-shadow:0 1px 2px #000;');
    this.killEl = mk('position:absolute;left:50%;top:34%;transform:translate(-50%,-50%);color:#fbbf24;font:900 28px Arial;z-index:32;pointer-events:none;opacity:0;text-shadow:0 2px 6px #000;transition:opacity 120ms;');
    this.vignetteEl = mk('position:absolute;inset:0;z-index:25;pointer-events:none;opacity:0;transition:opacity 180ms;background:radial-gradient(ellipse at center, transparent 55%, rgba(220,30,30,0.55) 100%);');
    this.lowHpEl = mk('position:absolute;inset:0;z-index:24;pointer-events:none;opacity:0;transition:opacity 400ms;background:radial-gradient(ellipse at center, transparent 62%, rgba(200,20,20,0.28) 100%);');
    this.dmgIndEl = mk('position:absolute;left:50%;top:50%;width:0;height:0;border-left:14px solid transparent;border-right:14px solid transparent;border-bottom:22px solid rgba(255,60,60,0.9);z-index:26;pointer-events:none;opacity:0;transform-origin:center;filter:drop-shadow(0 0 4px rgba(255,0,0,0.6));');
    this.deathEl = mk('position:absolute;inset:0;display:none;align-items:center;justify-content:center;flex-direction:column;background:rgba(0,0,0,0.55);color:#f87171;font:900 34px Arial;z-index:40;');
  }

  // ---- Mondo ----

  private buildMap(): void {
    const groundMat = new StandardMaterial('g', this.scene);
    groundMat.diffuseColor = new Color3(0.42, 0.4, 0.38);
    const ground = MeshBuilder.CreateBox('ground', { width: FPS_MAP.halfSize * 2 + 6, height: 0.4, depth: FPS_MAP.halfSize * 2 + 6 }, this.scene);
    ground.position.y = -0.2;
    ground.material = groundMat;

    // Linee della pavimentazione (decals semplici)
    const lineMat = new StandardMaterial('line', this.scene);
    lineMat.diffuseColor = new Color3(0.85, 0.75, 0.25);
    lineMat.disableLighting = true;
    for (let i = -20; i <= 20; i += 5) {
      const line = MeshBuilder.CreateBox('line', { width: 0.15, height: 0.02, depth: FPS_MAP.halfSize * 2 }, this.scene);
      line.position = new Vector3(i, 0.01, 0);
      line.material = lineMat;
    }

    const wallMat = new StandardMaterial('wall', this.scene);
    wallMat.diffuseColor = new Color3(0.5, 0.53, 0.6);
    const containerMat = new StandardMaterial('container', this.scene);
    containerMat.diffuseColor = new Color3(0.82, 0.4, 0.25);
    const crateMat = new StandardMaterial('crate', this.scene);
    crateMat.diffuseColor = new Color3(0.72, 0.55, 0.25);

    let idx = 0;
    for (const b of FPS_MAP.obstacles) {
      const box = MeshBuilder.CreateBox('obstacle', { width: b.w, height: b.h, depth: b.d }, this.scene);
      box.position = new Vector3(b.x, b.h / 2, b.z);
      box.material = b.h >= 4 ? wallMat : idx % 3 === 0 ? containerMat : idx % 3 === 1 ? crateMat : wallMat;
      idx++;
    }

    // Landmark: torre centrale luminosa
    const towerMat = new StandardMaterial('tower', this.scene);
    towerMat.diffuseColor = new Color3(0.9, 0.75, 0.2);
    towerMat.emissiveColor = new Color3(0.4, 0.3, 0.05);
    const tower = MeshBuilder.CreateBox('tower', { width: 1.2, height: 8, depth: 1.2 }, this.scene);
    tower.position = new Vector3(0, 4, 0);
    tower.material = towerMat;
  }

  private buildGun(): TransformNode {
    const root = new TransformNode('gunRoot', this.scene);
    root.parent = this.camera;
    root.position = new Vector3(0.28, -0.24, 0.6);

    const body = MeshBuilder.CreateBox('gunBody', { width: 0.14, height: 0.14, depth: 0.5 }, this.scene);
    body.material = new StandardMaterial('gunBodyMat', this.scene);
    (body.material as StandardMaterial).diffuseColor = new Color3(0.2, 0.22, 0.26);
    body.parent = root;

    const barrel = MeshBuilder.CreateBox('barrel', { width: 0.06, height: 0.06, depth: 0.35 }, this.scene);
    barrel.material = body.material;
    barrel.parent = root;
    barrel.position = new Vector3(0, 0.03, -0.4);

    // Muzzle flash (piccola sfera emissiva al vivo di volata)
    const flashMat = new StandardMaterial('muzzleMat', this.scene);
    flashMat.diffuseColor = new Color3(1, 0.8, 0.3);
    flashMat.emissiveColor = new Color3(1, 0.7, 0.2);
    flashMat.disableLighting = true;
    this.muzzle = MeshBuilder.CreateSphere('muzzle', { diameter: 0.16, segments: 6 }, this.scene);
    this.muzzle.material = flashMat;
    this.muzzle.parent = root;
    this.muzzle.position = new Vector3(0, 0.03, -0.62);
    this.muzzle.isVisible = false;

    // Pool di tracer (linee brevi emissive)
    const tracerMat = new StandardMaterial('tracerMat', this.scene);
    tracerMat.diffuseColor = new Color3(1, 0.85, 0.4);
    tracerMat.emissiveColor = new Color3(1, 0.8, 0.3);
    tracerMat.disableLighting = true;
    for (let i = 0; i < 6; i++) {
      const t = MeshBuilder.CreateBox('tracer', { width: 0.05, height: 0.05, depth: 2.4 }, this.scene);
      t.material = tracerMat;
      t.isVisible = false;
      this.tracers.push(t);
    }

    return root;
  }

  private updateCamera(): void {
    const dx = Math.sin(this.yaw) * Math.cos(this.pitch);
    const dy = Math.sin(this.pitch);
    const dz = Math.cos(this.yaw) * Math.cos(this.pitch);
    this.camera.position.set(this.selfX, EYE_HEIGHT, this.selfZ);
    this.camera.setTarget(new Vector3(this.selfX + dx, EYE_HEIGHT + dy, this.selfZ + dz));
  }

  private updateGun(dt: number): void {
    const feel = feelFor(this.weaponId);
    const speedFrac = Math.min(1, this.selfSpeed / 8);

    // Bob
    if (speedFrac > 0.05) this.bobTime += dt * (6 + speedFrac * 8);
    const bobY = Math.sin(this.bobTime * 2) * 0.008 * speedFrac;
    const bobX = Math.cos(this.bobTime) * 0.006 * speedFrac;

    // Recoil (decadimento morbido)
    this.recoil = Math.max(0, this.recoil - dt * 5);
    this.recoilX = this.recoilX * 0.8;

    // Sway (leggero ritardo sulla rotazione camera)
    this.swayX = this.swayX * 0.85 + this.lastLookDx * 0.00012;
    this.swayY = this.swayY * 0.85 + this.lastLookDy * 0.00012;

    // Muzzle flash
    if (this.muzzleTimer > 0) {
      this.muzzleTimer -= dt;
      const s = Math.max(0.01, this.muzzleTimer / 0.05);
      this.muzzle.isVisible = true;
      this.muzzle.scaling.setAll(0.5 + s * 2);
    } else {
      this.muzzle.isVisible = false;
    }

    // Reload: arma si abbassa e ruota
    let reloadOffsetY = 0;
    let reloadRotX = 0;
    if (this.reloading) {
      this.reloadTimer -= dt;
      const k = Math.min(1, (this.reloadDuration - this.reloadTimer) / (this.reloadDuration * 0.4));
      reloadOffsetY = -0.18 * Math.min(1, k * 2) + (this.reloadTimer <= 0 ? 0 : 0);
      reloadRotX = 0.5 * Math.min(1, k);
      if (this.reloadTimer <= 0) {
        this.reloading = false;
        this.ammoEl.textContent = getWeapon(this.weaponId).icon + ' ' + getWeapon(this.weaponId).name;
      }
    }

    // Fuoco continuo (viewmodel locale, cadenza dell'arma)
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    if (this.firePressed && this.fireCooldown <= 0 && !this.reloading) {
      this.fireCooldown = 1 / getWeapon(this.weaponId).fireRate;
      this.recoil += feel.recoil;
      this.recoilX += (Math.random() - 0.5) * feel.recoil * 2;
      this.muzzleTimer = 0.05;
      this.dashKick = 0.02;
      this.spawnTracer();
      audio.playTone(feel.freq, 0.06, 'square', 0.05);
    }

    const bob = speedFrac;
    void bob;
    const baseZ = 0.6 - this.recoil * 1.4 - this.dashKick;
    const baseY = -0.24 + bobY + this.recoil * 0.5 + reloadOffsetY;
    const baseX = 0.28 + bobX + this.swayX + this.recoilX;
    this.gunRoot.position.set(baseX, baseY, baseZ);
    this.gunRoot.rotation.x = reloadRotX + this.recoil * 0.6;
    this.gunRoot.rotation.z = -this.swayY * 4;
    this.dashKick = Math.max(0, this.dashKick - dt * 0.1);

    // Crosshair spread
    const spread = 1 + this.recoil * 2.2 + speedFrac * 0.4;
    this.crossEl.style.transform = `translate(-50%,-50%) scale(${spread})`;
    this.crossEl.style.margin = '0';
    this.crossEl.style.left = '50%';
    this.crossEl.style.top = '50%';
  }

  private spawnTracer(): void {
    const t = this.tracers[this.tracerIdx % this.tracers.length];
    this.tracerIdx++;
    const dx = Math.sin(this.yaw) * Math.cos(this.pitch);
    const dy = Math.sin(this.pitch);
    const dz = Math.cos(this.yaw) * Math.cos(this.pitch);
    const start = new Vector3(this.selfX + dx * 0.6, EYE_HEIGHT - 0.2 + dy * 0.6, this.selfZ + dz * 0.6);
    t.position = start;
    t.lookAt(start.add(new Vector3(dx * 10, dy * 10, dz * 10)));
    t.isVisible = true;
    window.setTimeout(() => {
      t.isVisible = false;
    }, 70);
  }

  private interpolateRemotes(): void {
    for (const e of this.remotes.values()) {
      const k = 0.2;
      const cx = e.body.position.x;
      const cz = e.body.position.z;
      e.body.position.set(cx + (e.x - cx) * k, e.body.position.y, cz + (e.z - cz) * k);
      e.head.position.x = e.body.position.x;
      e.head.position.z = e.body.position.z;
      e.nameTag.position.x = e.body.position.x;
      e.nameTag.position.z = e.body.position.z;
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
    }
  }

  // ---- API pubblica ----

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

  /** Hit confermato dal server. */
  hitMarker(): void {
    this.hitmarkEl.textContent = '✕';
    this.hitmarkEl.style.opacity = '1';
    audio.hit();
    window.setTimeout(() => {
      this.hitmarkEl.style.opacity = '0';
    }, 110);
  }

  /** Subito danno: vignetta + indicatore direzionale + camera kick + suono. */
  damageTaken(fromId: string, amount: number): void {
    audio.wrong();
    // camera kick leggero
    this.pitch += 0.01;
    // vignetta
    this.vignetteEl.style.opacity = String(0.5 + Math.min(0.5, amount / 80));
    window.setTimeout(() => {
      this.vignetteEl.style.opacity = '0';
    }, 220);
    // direzione
    const from = this.lastPos.get(fromId);
    if (from) {
      const dx = from.x - this.selfX;
      const dz = from.z - this.selfZ;
      const worldAng = Math.atan2(dx, dz);
      const rel = worldAng - this.yaw;
      const ang = rel + Math.PI / 2; // 0 = davanti (alto)
      const dist = Math.min(1, Math.hypot(dx, dz) / 30);
      const r = 150;
      const px = 50 + Math.sin(ang) * (r + 40 * (1 - dist));
      const py = 50 - Math.cos(ang) * (r + 40 * (1 - dist));
      this.dmgIndEl.style.opacity = '1';
      this.dmgIndEl.style.left = Math.max(4, Math.min(96, px)) + '%';
      this.dmgIndEl.style.top = Math.max(4, Math.min(96, py)) + '%';
      this.dmgIndEl.style.transform = `translate(-50%,-50%) rotate(${ang + Math.PI / 2}rad)`;
      window.setTimeout(() => {
        this.dmgIndEl.style.opacity = '0';
      }, 300);
    }
  }

  /** Kill confermata: conferma visiva breve. */
  killConfirm(name: string): void {
    this.killEl.textContent = `ELIMINATO ${name}`;
    this.killEl.style.opacity = '1';
    this.hitmarkEl.textContent = '✕';
    this.hitmarkEl.style.opacity = '1';
    audio.fanfare();
    window.setTimeout(() => {
      this.killEl.style.opacity = '0';
      this.hitmarkEl.style.opacity = '0';
    }, 900);
  }

  reloadStart(duration = 1.5): void {
    if (this.reloading) return;
    this.reloading = true;
    this.reloadDuration = duration;
    this.reloadTimer = duration;
    this.ammoEl.textContent = '🔄 RICARICA...';
    audio.select();
  }

  setHp(hp: number): void {
    this.hpEl.textContent = `❤️ ${Math.max(0, Math.round(hp))}`;
    this.lowHpEl.style.opacity = hp < LOW_HP_THRESHOLD && hp > 0 ? '1' : '0';
    if (hp <= 0) this.lowHpEl.style.opacity = '0';
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

  updateState(state: FpsStatePayload): void {
    this.timerEl.textContent = `⏱ ${Math.max(0, Math.ceil(state.matchTime))}`;
    for (const ps of state.players) {
      this.lastPos.set(ps.id, { x: ps.x, z: ps.z });
      if (ps.id === this.selfId) {
        const dx = ps.x - this.selfX;
        const dz = ps.z - this.selfZ;
        this.selfSpeed = Math.hypot(dx, dz) / 0.05; // ~velocità (tick 20Hz)
        this.selfX = ps.x;
        this.selfZ = ps.z;
        this.weaponId = ps.weaponId;
        this.setHp(ps.hp);
        if (!ps.alive) this.showDeath('💀 ELIMINATO');
        else this.hideDeath();
        if (ps.alive && !ps.firing) this.setFirePressed(false);
        continue;
      }
      let e = this.remotes.get(ps.id);
      if (!e) e = this.spawnRemote(ps);
      if (e) {
        const wasAlive = e.alive;
        e.x = ps.x;
        e.z = ps.z;
        e.yaw = ps.yaw;
        if (ps.hp < e.hp) e.flinch = 1; // ha subito danno
        e.hp = ps.hp;
        e.alive = ps.alive;
        if (wasAlive && !ps.alive) {
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

    const e: RemoteEntity = { body, head, nameTag: tag, x: ps.x, z: ps.z, yaw: ps.yaw, hp: ps.hp, alive: ps.alive, flinch: 0 };
    this.remotes.set(ps.id, e);
    return e;
  }

  private makeNameTag(ps: FpsPlayerState): Mesh {
    const dt = new DynamicTexture('tag', { width: 256, height: 64 }, this.scene, false);
    dt.hasAlpha = true;
    const c = dt.getContext() as unknown as CanvasRenderingContext2D;
    c.clearRect(0, 0, 256, 64);
    c.fillStyle = 'rgba(0,0,0,0.6)';
    c.beginPath();
    c.roundRect(4, 4, 248, 56, 14);
    c.fill();
    c.fillStyle = '#fff';
    c.font = '800 28px Arial';
    c.textAlign = 'center';
    c.fillText(ps.name.length > 12 ? ps.name.slice(0, 12) + '…' : ps.name, 128, 42);
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

  dispose(): void {
    this.engine.stopRenderLoop();
    this.scene.dispose();
    this.engine.dispose();
  }
}
