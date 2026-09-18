import {
  Engine,
  Scene,
  Vector3,
  Color3,
  Color4,
  MeshBuilder,
  StandardMaterial,
  Mesh,
  UniversalCamera,
  HemisphericLight,
  DirectionalLight,
  DynamicTexture
} from '@babylonjs/core';
import { FPS_MAP } from '../../shared/fpsMap';
import { getWeapon } from '../../shared/fpsWeapons';

const EYE_HEIGHT = 1.5;
const SENSITIVITY_X = 0.004;
const SENSITIVITY_Y = 0.004;

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
}

/**
 * Client FPS su telefono (Babylon.js). Renderizza la scena in prima persona,
 * applica lo stato ricevuto dall'host (posizioni/HP) con interpolazione morbida
 * e mantiene la propria camera (yaw/pitch) localmente reattiva.
 */
export class FpsClient {
  private engine: Engine;
  private scene: Scene;
  private camera: UniversalCamera;
  private gun: Mesh;
  private remotes = new Map<string, RemoteEntity>();

  private selfX = 0;
  private selfZ = 0;
  private yaw = 0;
  private pitch = 0;

  private hpEl!: HTMLElement;
  private ammoEl!: HTMLElement;
  private timerEl!: HTMLElement;
  private crossEl!: HTMLElement;
  private deathEl!: HTMLElement;
  private feedEl!: HTMLElement;

  constructor(
    private container: HTMLElement,
    private selfId: string,
    private onLook: (yaw: number, pitch: number) => void
  ) {
    this.buildHud();

    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;touch-action:none;';
    container.appendChild(canvas);

    this.engine = new Engine(canvas, true, { antialias: true, adaptToDeviceRatio: true });
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.55, 0.75, 0.95, 1);

    const hemi = new HemisphericLight('hemi', new Vector3(0.1, 1, 0.1), this.scene);
    hemi.intensity = 0.75;
    const sun = new DirectionalLight('sun', new Vector3(-0.5, -1, -0.3), this.scene);
    sun.intensity = 0.6;

    this.camera = new UniversalCamera('fpsCam', new Vector3(0, EYE_HEIGHT, 0), this.scene);
    this.camera.minZ = 0.1;
    this.camera.maxZ = 500;
    this.scene.activeCamera = this.camera;

    this.buildMap();
    this.gun = this.buildGun();

    const onResize = (): void => this.engine.resize();
    window.addEventListener('resize', onResize);

    this.engine.runRenderLoop(() => {
      this.updateCamera();
      this.interpolateRemotes();
      this.scene.render();
    });
  }

  private buildHud(): void {
    const mk = (id: string, css: string): HTMLElement => {
      const el = document.createElement('div');
      el.id = id;
      el.style.cssText = css;
      this.container.appendChild(el);
      return el;
    };
    this.crossEl = mk('fps-cross', 'position:absolute;left:50%;top:50%;width:14px;height:14px;margin:-7px;border:2px solid #fff;border-radius:50%;z-index:30;pointer-events:none;box-shadow:0 0 4px rgba(0,0,0,0.7);');
    this.hpEl = mk('fps-hp', 'position:absolute;left:14px;bottom:14px;color:#fff;font:800 20px Arial;z-index:30;text-shadow:0 1px 3px #000;');
    this.ammoEl = mk('fps-ammo', 'position:absolute;right:14px;bottom:14px;color:#fff;font:800 22px Arial;z-index:30;text-shadow:0 1px 3px #000;');
    this.timerEl = mk('fps-timer', 'position:absolute;left:50%;top:12px;transform:translateX(-50%);color:#fbbf24;font:800 24px Arial;z-index:30;text-shadow:0 1px 3px #000;');
    this.feedEl = mk('fps-feed', 'position:absolute;right:12px;top:60px;color:#fff;font:700 14px Arial;z-index:30;text-align:right;text-shadow:0 1px 2px #000;');
    this.deathEl = mk('fps-death', 'position:absolute;inset:0;display:none;align-items:center;justify-content:center;flex-direction:column;background:rgba(0,0,0,0.55);color:#f87171;font:900 34px Arial;z-index:40;');
  }

  private buildMap(): void {
    const groundMat = new StandardMaterial('g', this.scene);
    groundMat.diffuseColor = new Color3(0.3, 0.33, 0.38);
    const ground = MeshBuilder.CreateBox('ground', { width: FPS_MAP.halfSize * 2 + 6, height: 0.4, depth: FPS_MAP.halfSize * 2 + 6 }, this.scene);
    ground.position.y = -0.2;
    ground.material = groundMat;

    const crateMat = new StandardMaterial('crate', this.scene);
    crateMat.diffuseColor = new Color3(0.85, 0.6, 0.25);
    const wallMat = new StandardMaterial('wall', this.scene);
    wallMat.diffuseColor = new Color3(0.45, 0.48, 0.55);

    for (const b of FPS_MAP.obstacles) {
      const box = MeshBuilder.CreateBox('obstacle', { width: b.w, height: b.h, depth: b.d }, this.scene);
      box.position = new Vector3(b.x, b.h / 2, b.z);
      box.material = b.h >= 4 ? wallMat : crateMat;
    }
  }

  private buildGun(): Mesh {
    const gun = MeshBuilder.CreateBox('gun', { width: 0.14, height: 0.14, depth: 0.5 }, this.scene);
    const mat = new StandardMaterial('gunMat', this.scene);
    mat.diffuseColor = new Color3(0.2, 0.22, 0.26);
    gun.material = mat;
    gun.parent = this.camera;
    gun.position = new Vector3(0.28, -0.24, 0.6);
    return gun;
  }

  private updateCamera(): void {
    const dx = Math.sin(this.yaw) * Math.cos(this.pitch);
    const dy = Math.sin(this.pitch);
    const dz = Math.cos(this.yaw) * Math.cos(this.pitch);
    this.camera.position.set(this.selfX, EYE_HEIGHT, this.selfZ);
    this.camera.setTarget(new Vector3(this.selfX + dx, EYE_HEIGHT + dy, this.selfZ + dz));
  }

  /** Look locale (chiamato dal touch handler). dx/dy in pixel. */
  look(dx: number, dy: number): void {
    this.yaw += dx * SENSITIVITY_X;
    this.pitch -= dy * SENSITIVITY_Y;
    this.pitch = Math.max(-1.35, Math.min(1.35, this.pitch));
    this.onLook(this.yaw, this.pitch);
  }

  setSelfPosition(x: number, z: number): void {
    this.selfX = x;
    this.selfZ = z;
  }

  setAmmo(text: string): void {
    this.ammoEl.textContent = text;
  }

  setHp(hp: number): void {
    this.hpEl.textContent = `❤️ ${Math.max(0, Math.round(hp))}`;
  }

  setTimer(t: number): void {
    this.timerEl.textContent = `⏱ ${Math.max(0, Math.ceil(t))}`;
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

  /** Applica lo stato ricevuto dall'host. */
  updateState(state: FpsStatePayload): void {
    this.setTimer(state.matchTime);
    for (const ps of state.players) {
      if (ps.id === this.selfId) {
        this.setSelfPosition(ps.x, ps.z);
        this.setHp(ps.hp);
        const w = getWeapon(ps.weaponId);
        this.setAmmo(`${w.icon} ${w.name}`);
        if (!ps.alive) this.showDeath('💀 ELIMINATO');
        else this.hideDeath();
        continue;
      }
      let e = this.remotes.get(ps.id);
      if (!e) e = this.spawnRemote(ps);
      if (e) {
        e.x = ps.x;
        e.z = ps.z;
        e.yaw = ps.yaw;
        e.hp = ps.hp;
        e.alive = ps.alive;
        e.body.isVisible = ps.alive;
        e.head.isVisible = ps.alive;
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

    const e: RemoteEntity = { body, head, nameTag: tag, x: ps.x, z: ps.z, yaw: ps.yaw, hp: ps.hp, alive: ps.alive };
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

  private interpolateRemotes(): void {
    for (const e of this.remotes.values()) {
      const k = 0.18;
      const cx = e.body.position.x;
      const cz = e.body.position.z;
      e.body.position.set(cx + (e.x - cx) * k, e.body.position.y, cz + (e.z - cz) * k);
      e.head.position.x = e.body.position.x;
      e.head.position.z = e.body.position.z;
      e.nameTag.position.x = e.body.position.x;
      e.nameTag.position.z = e.body.position.z;
      e.body.rotation.y = e.yaw;
      e.head.rotation.y = e.yaw;
    }
  }

  dispose(): void {
    this.engine.stopRenderLoop();
    this.scene.dispose();
    this.engine.dispose();
  }
}
