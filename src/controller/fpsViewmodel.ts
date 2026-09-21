import {
  Color3,
  DynamicTexture,
  Mesh,
  MeshBuilder,
  PointLight,
  StandardMaterial,
  TransformNode,
  Vector3
} from '@babylonjs/core';
import type { Scene, UniversalCamera } from '@babylonjs/core';

/**
 * VIEWMODEL DELLA SPARATORIA: l'arma in prima persona.
 *  - un modello diverso per ogni arma (solo primitive: leggero anche sui telefoni economici)
 *  - rinculo con MOLLE (rigidezza/smorzamento diversi per arma: la mitraglia vibra veloce, la bombarda "pesa")
 *  - idle (respiro), bob del passo, sway sul movimento della camera, estrazione, ricarica, reazione al dash
 *  - muzzle flash + scintille + fumo con POOL (nessuna allocazione per colpo) e luce puntuale solo su qualita' HIGH
 * Il mirino (HTML) e' indipendente da tutto questo: non segue il movimento cosmetico dell'arma.
 */

export interface RecoilProfile {
  back: number; // impulso verso il giocatore
  up: number; // impulso di rotazione verso l'alto
  side: number; // casualita' laterale
  k: number; // rigidezza della molla (alta = ritorno rapido)
  c: number; // smorzamento
  camPitch: number; // calcio visuale della camera (rad), NON cambia la mira
  camYaw: number;
  flash: number; // dimensione del lampo
  color: [number, number, number];
  smoke: boolean;
  sparks: number;
  wobble?: number; // oscillazione comica (sparapiselli)
  energy?: boolean; // bagliore emissivo (laser)
  pump?: boolean; // pompa che scorre (spaccatutto)
  /** Vibrazione del telefono per colpo (ms); 0 = nessuna (armi a raffica: sarebbe un ronzio continuo). */
  buzz: number;
  tracer: { color: [number, number, number]; thick: number; life: number };
}

export const RECOIL: Record<string, RecoilProfile> = {
  // piccoli rinculi rapidi
  mitraglia: { back: 0.3, up: 1.0, side: 0.05, k: 320, c: 26, camPitch: 0.004, camYaw: 0.002, flash: 0.3, color: [1, 0.8, 0.3], smoke: false, sparks: 3, buzz: 0, tracer: { color: [1, 0.85, 0.4], thick: 0.04, life: 0.06 } },
  // forte rinculo singolo + pompa
  spaccatutto: { back: 1.5, up: 5.2, side: 0.12, k: 85, c: 9.5, camPitch: 0.032, camYaw: 0.006, flash: 0.75, color: [1, 0.65, 0.2], smoke: true, sparks: 8, pump: true, buzz: 38, tracer: { color: [1, 0.7, 0.3], thick: 0.03, life: 0.05 } },
  // quasi nessun rinculo meccanico, molto bagliore
  laser: { back: 0.1, up: 0.45, side: 0, k: 300, c: 24, camPitch: 0.005, camYaw: 0, flash: 0.5, color: [0.35, 0.95, 1], smoke: false, sparks: 6, energy: true, buzz: 14, tracer: { color: [0.4, 0.95, 1], thick: 0.09, life: 0.16 } },
  // tre impulsi distinti (uno per colpo della raffica)
  raffica: { back: 0.55, up: 1.8, side: 0.08, k: 240, c: 20, camPitch: 0.008, camYaw: 0.003, flash: 0.45, color: [1, 0.55, 0.35], smoke: false, sparks: 4, buzz: 12, tracer: { color: [1, 0.55, 0.4], thick: 0.05, life: 0.07 } },
  // rinculo lento e pesante
  bombarda: { back: 1.7, up: 3.4, side: 0.05, k: 36, c: 8, camPitch: 0.045, camYaw: 0.005, flash: 1.0, color: [1, 0.55, 0.15], smoke: true, sparks: 10, buzz: 55, tracer: { color: [1, 0.6, 0.2], thick: 0.0, life: 0 } },
  // micro rinculo comico molto rapido
  sparapiselli: { back: 0.07, up: 0.25, side: 0.05, k: 520, c: 16, camPitch: 0.0008, camYaw: 0, flash: 0.22, color: [0.6, 1, 0.5], smoke: false, sparks: 1, wobble: 5, buzz: 0, tracer: { color: [0.55, 1, 0.45], thick: 0.035, life: 0.05 } }
};

export function recoilOf(weaponId: string): RecoilProfile {
  return RECOIL[weaponId] ?? RECOIL.mitraglia;
}

interface WeaponModel {
  root: TransformNode;
  muzzle: TransformNode;
  mag?: Mesh;
  magBaseY: number;
  pump?: Mesh;
  pumpBaseZ: number;
  spin?: Mesh;
  glow: StandardMaterial[];
  glowBase: Color3[];
}

const matCache = new Map<string, StandardMaterial>();
function mat(scene: Scene, hex: string, emissive?: string): StandardMaterial {
  const key = `${hex}|${emissive ?? ''}`;
  let m = matCache.get(key);
  if (!m || m.getScene() !== scene) {
    m = new StandardMaterial(`vm_${key}`, scene);
    m.diffuseColor = Color3.FromHexString(hex);
    m.specularColor = new Color3(0.25, 0.25, 0.25);
    if (emissive) {
      m.emissiveColor = Color3.FromHexString(emissive);
      m.disableLighting = true;
    }
    matCache.set(key, m);
  }
  return m;
}

// posizione di riposo dell'arma (nel riquadro della camera): in basso, verso il centro-destra, TRA joystick e pulsanti
const BASE_X = 0.18;
const BASE_Y = -0.15;
const BASE_Z = 0.56;

const smooth = (t: number): number => t * t * (3 - 2 * t);
const clamp01 = (t: number): number => Math.max(0, Math.min(1, t));

function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

export class FpsViewmodel {
  private holder: TransformNode;
  private models = new Map<string, WeaponModel>();
  private current: WeaponModel | null = null;
  private weaponId = '';

  // molle del rinculo (offset e velocita')
  private z = 0;
  private vz = 0;
  private y = 0;
  private vy = 0;
  private rx = 0;
  private vrx = 0;
  private rz = 0;
  private vrz = 0;
  private x = 0;
  private vx = 0;
  // calcio visuale della camera
  private ckP = 0;
  private vckP = 0;
  private ckY = 0;
  private vckY = 0;

  private bobTime = 0;
  private lastBobSign = 1;
  private swayX = 0;
  private swayY = 0;
  private equipT = 1;
  private dashK = 0;
  private fovK = 0;
  private glowPulse = 0;
  /** Vero per un frame quando cade un passo (per il suono dei passi). */
  stepEvent = false;
  /** Larghezza/altezza dello schermo: in verticale l'arma va verso il centro (l'FOV orizzontale e' piu' stretto). */
  aspect = 2;

  // muzzle flash + effetti (tutti a pool)
  private flash: Mesh;
  private flashMat: StandardMaterial;
  private flashT = 0;
  private flashDur = 0.05;
  private flashSize = 0.3;
  private sparks: { m: Mesh; vx: number; vy: number; vz: number; life: number }[] = [];
  private sparkMat: StandardMaterial;
  private smokes: { m: Mesh; life: number }[] = [];
  private smokeMat: StandardMaterial;
  private light: PointLight | null = null;
  private lightK = 0;
  private profile: RecoilProfile = RECOIL.mitraglia;

  constructor(private scene: Scene, camera: UniversalCamera, highQuality: boolean) {
    this.holder = new TransformNode('vmHolder', scene);
    this.holder.parent = camera;
    this.holder.position.set(BASE_X, BASE_Y, BASE_Z);

    // lampo: piano billboard con texture a stella (una sola, riutilizzata)
    const tex = new DynamicTexture('flashTex', { width: 128, height: 128 }, scene, false);
    const c = tex.getContext() as unknown as CanvasRenderingContext2D;
    c.clearRect(0, 0, 128, 128);
    const g = c.createRadialGradient(64, 64, 3, 64, 64, 62);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.22, 'rgba(255,225,130,0.95)');
    g.addColorStop(1, 'rgba(255,120,20,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 128, 128);
    c.strokeStyle = 'rgba(255,245,210,0.9)';
    c.lineWidth = 5;
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3 + 0.2;
      c.beginPath();
      c.moveTo(64, 64);
      c.lineTo(64 + Math.cos(a) * 62, 64 + Math.sin(a) * 62);
      c.stroke();
    }
    tex.hasAlpha = true;
    tex.update();
    this.flashMat = new StandardMaterial('flashMat', scene);
    this.flashMat.emissiveTexture = tex;
    this.flashMat.opacityTexture = tex;
    this.flashMat.diffuseColor = new Color3(0, 0, 0);
    this.flashMat.disableLighting = true;
    this.flashMat.backFaceCulling = false;
    this.flash = MeshBuilder.CreatePlane('muzzleFlash', { size: 1 }, scene);
    this.flash.material = this.flashMat;
    this.flash.billboardMode = Mesh.BILLBOARDMODE_ALL;
    this.flash.isPickable = false;
    this.flash.isVisible = false;

    this.sparkMat = new StandardMaterial('sparkMat', scene);
    this.sparkMat.emissiveColor = new Color3(1, 0.7, 0.2);
    this.sparkMat.diffuseColor = new Color3(0, 0, 0);
    this.sparkMat.disableLighting = true;
    for (let i = 0; i < 10; i++) {
      const m = MeshBuilder.CreateBox(`spark${i}`, { size: 0.016 }, scene);
      m.material = this.sparkMat;
      m.parent = camera;
      m.isPickable = false;
      m.isVisible = false;
      this.sparks.push({ m, vx: 0, vy: 0, vz: 0, life: 0 });
    }
    this.smokeMat = new StandardMaterial('smokeMat', scene);
    this.smokeMat.emissiveColor = new Color3(0.75, 0.75, 0.78);
    this.smokeMat.diffuseColor = new Color3(0, 0, 0);
    this.smokeMat.disableLighting = true;
    this.smokeMat.alpha = 0.22;
    for (let i = 0; i < 4; i++) {
      const m = MeshBuilder.CreateSphere(`smoke${i}`, { diameter: 0.1, segments: 6 }, scene);
      m.material = this.smokeMat;
      m.parent = camera;
      m.isPickable = false;
      m.isVisible = false;
      this.smokes.push({ m, life: 0 });
    }
    // piccola luce del lampo: SOLO su HIGH (una luce in piu' costa su GPU deboli)
    if (highQuality) {
      this.light = new PointLight('muzzleLight', new Vector3(0.25, -0.05, 0.9), scene);
      this.light.parent = camera;
      this.light.range = 7;
      this.light.intensity = 0;
    }
  }

  // ---------------------------------------------------------------- modelli

  private build(id: string): WeaponModel {
    const s = this.scene;
    const root = new TransformNode(`vm_${id}`, s);
    root.parent = this.holder;
    const muzzle = new TransformNode(`vmMuzzle_${id}`, s);
    muzzle.parent = root;
    const glow: StandardMaterial[] = [];
    const part = (m: Mesh, x: number, y: number, z: number): Mesh => {
      m.parent = root;
      m.position.set(x, y, z);
      m.isPickable = false;
      return m;
    };
    const box = (w: number, h: number, d: number, hex: string, x: number, y: number, z: number): Mesh => {
      const m = MeshBuilder.CreateBox('b', { width: w, height: h, depth: d }, s);
      m.material = mat(s, hex);
      return part(m, x, y, z);
    };
    /** Cilindro con l'asse lungo z (la direzione di tiro). */
    const cyl = (d: number, len: number, hex: string, x: number, y: number, z: number, emissive?: string): Mesh => {
      const m = MeshBuilder.CreateCylinder('c', { diameter: d, height: len, tessellation: 10 }, s);
      m.rotation.x = Math.PI / 2;
      m.material = mat(s, hex, emissive);
      if (emissive) glow.push(m.material as StandardMaterial);
      return part(m, x, y, z);
    };
    const ring = (d: number, thick: number, hex: string, x: number, y: number, z: number, emissive?: string): Mesh => {
      const m = MeshBuilder.CreateTorus('r', { diameter: d, thickness: thick, tessellation: 14 }, s);
      m.rotation.x = Math.PI / 2;
      m.material = mat(s, hex, emissive);
      if (emissive && !glow.includes(m.material as StandardMaterial)) glow.push(m.material as StandardMaterial);
      return part(m, x, y, z);
    };
    const ball = (d: number, hex: string, x: number, y: number, z: number, emissive?: string): Mesh => {
      const m = MeshBuilder.CreateSphere('s', { diameter: d, segments: 8 }, s);
      m.material = mat(s, hex, emissive);
      if (emissive && !glow.includes(m.material as StandardMaterial)) glow.push(m.material as StandardMaterial);
      return part(m, x, y, z);
    };

    let mag: Mesh | undefined;
    let pump: Mesh | undefined;
    let spin: Mesh | undefined;
    switch (id) {
      case 'spaccatutto': {
        cyl(0.05, 0.5, '#3b4048', -0.03, 0.02, 0.22);
        cyl(0.05, 0.5, '#3b4048', 0.03, 0.02, 0.22);
        box(0.11, 0.12, 0.16, '#6b4428', 0, -0.01, -0.08);
        pump = box(0.1, 0.07, 0.17, '#8a5a34', 0, -0.05, 0.18);
        box(0.05, 0.1, 0.06, '#4a2f1c', 0, -0.1, -0.1).rotation.x = 0.3;
        muzzle.position.set(0, 0.02, 0.5);
        break;
      }
      case 'laser': {
        cyl(0.09, 0.36, '#e6edf7', 0, 0, 0.05);
        cyl(0.05, 0.4, '#0e7490', 0, 0, 0.07, '#22d3ee');
        ring(0.13, 0.014, '#0e7490', 0, 0, -0.02, '#22d3ee');
        spin = ring(0.13, 0.014, '#0e7490', 0, 0, 0.09, '#22d3ee');
        ring(0.13, 0.014, '#0e7490', 0, 0, 0.19, '#22d3ee');
        ball(0.065, '#a5f3fc', 0, 0, 0.28, '#67e8f9');
        box(0.05, 0.1, 0.06, '#1f2f3f', 0, -0.09, -0.06).rotation.x = 0.25;
        muzzle.position.set(0, 0, 0.33);
        break;
      }
      case 'raffica': {
        box(0.1, 0.1, 0.36, '#4a2e2e', 0, 0, 0);
        cyl(0.03, 0.26, '#2a2f38', -0.03, 0, 0.3);
        cyl(0.03, 0.26, '#2a2f38', 0.03, 0, 0.3);
        cyl(0.03, 0.26, '#2a2f38', 0, 0.05, 0.3);
        ring(0.1, 0.012, '#7f1d1d', 0, 0.01, 0.2, '#ef4444');
        ring(0.1, 0.012, '#7f1d1d', 0, 0.01, 0.12, '#ef4444');
        mag = box(0.05, 0.13, 0.06, '#7f1d1d', 0, -0.11, 0.04);
        box(0.05, 0.09, 0.06, '#2a2f38', 0, -0.09, -0.11).rotation.x = 0.3;
        muzzle.position.set(0, 0.015, 0.44);
        break;
      }
      case 'bombarda': {
        cyl(0.17, 0.4, '#2f3640', 0, 0, 0.14);
        ring(0.21, 0.04, '#ff7f11', 0, 0, 0.34);
        ball(0.19, '#1f2430', 0, 0, -0.06);
        cyl(0.02, 0.09, '#7f1d1d', 0, 0.105, 0.0, '#f87171');
        box(0.06, 0.12, 0.06, '#1f2430', 0, -0.13, 0.04);
        muzzle.position.set(0, 0, 0.38);
        break;
      }
      case 'sparapiselli': {
        cyl(0.11, 0.34, '#4ade80', 0, 0, 0.1);
        ring(0.115, 0.014, '#86efac', 0, 0, -0.02);
        ring(0.115, 0.014, '#86efac', 0, 0, 0.1);
        ring(0.115, 0.014, '#86efac', 0, 0, 0.22);
        spin = ball(0.13, '#bbf7d0', 0, 0.1, -0.02, '#4ade80');
        const nozzle = MeshBuilder.CreateCylinder('n', { diameterBottom: 0.05, diameterTop: 0.02, height: 0.1, tessellation: 8 }, s);
        nozzle.rotation.x = Math.PI / 2;
        nozzle.material = mat(s, '#166534');
        part(nozzle, 0, 0, 0.32);
        box(0.05, 0.09, 0.06, '#166534', 0, -0.09, -0.02).rotation.x = 0.2;
        muzzle.position.set(0, 0, 0.38);
        break;
      }
      default: {
        // mitraglia
        box(0.09, 0.11, 0.36, '#3b4252', 0, 0, 0);
        box(0.05, 0.03, 0.3, '#1f2430', 0, 0.07, 0.02);
        cyl(0.035, 0.22, '#2a2f38', 0, 0.02, 0.28);
        box(0.092, 0.02, 0.1, '#ff9f1c', 0, 0, -0.02);
        mag = box(0.05, 0.15, 0.07, '#ff9f1c', 0, -0.12, 0.02);
        mag.rotation.x = -0.15;
        box(0.05, 0.1, 0.06, '#1f2430', 0, -0.09, -0.1).rotation.x = 0.3;
        muzzle.position.set(0, 0.02, 0.4);
      }
    }
    root.scaling.setAll(id === 'bombarda' ? 0.72 : 0.86); // proporzioni da schermo di telefono: l'arma non deve riempire la vista
    root.setEnabled(false);
    return {
      root,
      muzzle,
      mag,
      magBaseY: mag ? mag.position.y : 0,
      pump,
      pumpBaseZ: pump ? pump.position.z : 0,
      spin,
      glow,
      glowBase: glow.map((m) => m.emissiveColor.clone())
    };
  }

  /** Cambia arma: il modello viene creato la prima volta e poi riusato; parte l'animazione di estrazione. */
  equip(weaponId: string): void {
    if (weaponId === this.weaponId) return;
    let m = this.models.get(weaponId);
    if (!m) {
      m = this.build(weaponId);
      this.models.set(weaponId, m);
    }
    if (this.current) this.current.root.setEnabled(false);
    this.current = m;
    m.root.setEnabled(true);
    this.weaponId = weaponId;
    this.profile = recoilOf(weaponId);
    this.flash.parent = m.muzzle;
    this.flash.position.set(0, 0, 0.04);
    this.flash.isVisible = false;
    this.equipT = 0;
    this.z = this.vz = this.y = this.vy = this.rx = this.vrx = this.rz = this.vrz = this.x = this.vx = 0;
  }

  // ---------------------------------------------------------------- eventi

  /** Un colpo: impulso di rinculo, lampo, scintille, fumo, luce. Nessuna allocazione. */
  fire(): void {
    const p = this.profile;
    this.vz -= p.back;
    this.vrx += p.up;
    this.vx += (Math.random() - 0.5) * 2 * p.side;
    if (p.wobble) this.vrz += (Math.random() < 0.5 ? -1 : 1) * p.wobble;
    this.vckP += p.camPitch * 60;
    this.vckY += (Math.random() - 0.5) * 2 * p.camYaw * 60;
    if (p.energy) this.glowPulse = 1;
    this.flashT = this.flashDur = p.energy ? 0.09 : 0.055;
    this.flashSize = p.flash;
    this.flashMat.emissiveColor.set(p.color[0] * 0.45, p.color[1] * 0.45, p.color[2] * 0.45);
    this.sparkMat.emissiveColor.set(p.color[0], p.color[1], p.color[2]);
    this.flash.rotation.z = Math.random() * Math.PI;
    this.flash.isVisible = true;
    if (this.light) {
      this.light.diffuse.set(p.color[0], p.color[1], p.color[2]);
      this.lightK = 1;
    }
    // scintille dal vivo di volata (coordinate della camera)
    let n = p.sparks;
    for (const sp of this.sparks) {
      if (n <= 0) break;
      if (sp.life > 0) continue;
      sp.life = 0.12 + Math.random() * 0.08;
      sp.m.position.set(BASE_X + 0.01, BASE_Y + 0.02, BASE_Z + 0.44);
      sp.vx = (Math.random() - 0.3) * 1.6;
      sp.vy = (Math.random() - 0.4) * 1.2;
      sp.vz = 1 + Math.random() * 1.4;
      sp.m.isVisible = true;
      n--;
    }
    if (p.smoke) {
      for (const sm of this.smokes) {
        if (sm.life > 0) continue;
        sm.life = 0.55;
        sm.m.position.set(BASE_X, BASE_Y + 0.03, BASE_Z + 0.42);
        sm.m.scaling.setAll(0.3);
        sm.m.isVisible = true;
        break;
      }
    }
    // pompa dello spaccatutto: scorre indietro e avanti subito dopo lo sparo
    this.pumpT = p.pump ? 0.001 : 0;
  }

  private pumpT = 0;

  dash(): void {
    this.dashK = 1;
    this.fovK = 1;
  }

  /** Calcio della camera (rad) da sommare a visuale: solo estetico, la mira inviata all'host non cambia. */
  get cameraKickPitch(): number {
    return this.ckP;
  }
  get cameraKickYaw(): number {
    return this.ckY;
  }
  /** 0..1: allargamento del campo visivo per il dash. */
  get fovKick(): number {
    return this.fovK;
  }

  // ---------------------------------------------------------------- frame

  /**
   * `reloadP`: 0 = non sta ricaricando, altrimenti avanzamento 0..1 della ricarica.
   * `speedFrac`: 0..1 velocita' di movimento; `lookDx/Dy`: ultimo movimento di camera (sway).
   */
  update(dt: number, speedFrac: number, lookDx: number, lookDy: number, reloadP: number, dashing: boolean): void {
    const m = this.current;
    if (!m) return;
    dt = Math.min(dt, 0.05);
    const p = this.profile;

    // molle del rinculo (semi-implicito, 2 sotto-passi se il frame e' lungo)
    const steps = dt > 0.025 ? 2 : 1;
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      this.vz += (-p.k * this.z - p.c * this.vz) * h;
      this.z += this.vz * h;
      this.vy += (-p.k * this.y - p.c * this.vy) * h;
      this.y += this.vy * h;
      this.vrx += (-p.k * this.rx - p.c * this.vrx) * h;
      this.rx += this.vrx * h;
      this.vrz += (-p.k * 1.4 * this.rz - p.c * 0.6 * this.vrz) * h;
      this.rz += this.vrz * h;
      this.vx += (-p.k * this.x - p.c * this.vx) * h;
      this.x += this.vx * h;
      this.vckP += (-140 * this.ckP - 16 * this.vckP) * h;
      this.ckP += this.vckP * h;
      this.vckY += (-140 * this.ckY - 16 * this.vckY) * h;
      this.ckY += this.vckY * h;
    }

    // bob del passo + respiro
    this.stepEvent = false;
    if (speedFrac > 0.05) {
      this.bobTime += dt * (6 + speedFrac * 8);
      const sign = Math.sin(this.bobTime) >= 0 ? 1 : -1;
      if (sign !== this.lastBobSign) {
        this.lastBobSign = sign;
        if (speedFrac > 0.2) this.stepEvent = true;
      }
    }
    const idle = performance.now() * 0.0016;
    const bobY = Math.sin(this.bobTime * 2) * 0.009 * speedFrac + Math.sin(idle) * 0.0025;
    const bobX = Math.cos(this.bobTime) * 0.007 * speedFrac + Math.cos(idle * 0.7) * 0.0015;

    // sway: l'arma "ritarda" rispetto alla camera
    this.swayX = this.swayX * 0.85 + lookDx * 0.00012;
    this.swayY = this.swayY * 0.85 + lookDy * 0.00012;

    // estrazione
    let eoY = 0;
    let eoRx = 0;
    if (this.equipT < 1) {
      this.equipT = Math.min(1, this.equipT + dt / 0.38);
      const e = easeOutBack(this.equipT);
      eoY = -0.34 * (1 - e);
      eoRx = 0.95 * (1 - e);
    }

    // ricarica: l'arma si abbassa e ruota, il caricatore esce e rientra, la pompa scorre
    let rdY = 0;
    let rdRx = 0;
    let rdRz = 0;
    let magOff = 0;
    let charge = 0;
    if (reloadP > 0) {
      const down = smooth(clamp01(reloadP / 0.2));
      const up = smooth(clamp01((reloadP - 0.82) / 0.18));
      const k = down - up;
      rdY = -0.15 * k;
      rdRx = 0.55 * k;
      rdRz = -0.32 * k;
      magOff = -0.24 * (reloadP < 0.5 ? smooth(clamp01((reloadP - 0.2) / 0.22)) : 1 - smooth(clamp01((reloadP - 0.55) / 0.22)));
      charge = reloadP;
    }
    if (m.mag) m.mag.position.y = m.magBaseY + magOff;
    if (m.spin) m.spin.rotation.z += dt * (reloadP > 0 ? 9 : 1.5 + this.glowPulse * 12);

    // pompa
    if (m.pump) {
      let pz = 0;
      if (this.pumpT > 0) {
        this.pumpT += dt;
        const t = this.pumpT;
        if (t > 0.28 && t < 0.62) pz = -0.12 * Math.sin(((t - 0.28) / 0.34) * Math.PI);
        if (t >= 0.62) this.pumpT = 0;
      }
      if (reloadP > 0.7) pz = -0.1 * Math.sin(clamp01((reloadP - 0.7) / 0.3) * Math.PI);
      m.pump.position.z = m.pumpBaseZ + pz;
    }

    // dash: l'arma si tira indietro e si inclina
    this.dashK = Math.max(0, this.dashK - dt * 3.2);
    const dk = Math.max(this.dashK, dashing ? 0.5 : 0);
    this.fovK = Math.max(0, this.fovK - dt * 3.5);

    // glow energetico (laser, raffica, bombarda: anelli emissivi che pulsano; in ricarica si "caricano")
    this.glowPulse = Math.max(0, this.glowPulse - dt * 5);
    if (m.glow.length) {
      const gk = 0.65 + this.glowPulse * 1.4 + charge * 0.6;
      for (let i = 0; i < m.glow.length; i++) m.glowBase[i].scaleToRef(gk, m.glow[i].emissiveColor);
    }

    this.holder.position.set(
      BASE_X * Math.max(0.3, Math.min(1, this.aspect / 1.9)) + bobX + this.swayX + this.x,
      BASE_Y + bobY + eoY + rdY + this.y * 0.5 - 0.03 * dk,
      BASE_Z + this.z - 0.07 * dk
    );
    this.holder.rotation.x = this.rx + eoRx + rdRx + 0.04 * dk;
    this.holder.rotation.z = -this.swayY * 4 + this.rz + rdRz + 0.3 * dk;
    this.holder.rotation.y = -0.07 - this.x * 0.6; // la canna punta un filo verso il centro

    // lampo, scintille, fumo, luce
    if (this.flashT > 0) {
      this.flashT -= dt;
      const k = Math.max(0, this.flashT / this.flashDur);
      this.flash.scaling.setAll(this.flashSize * (0.55 + k * 0.9));
      this.flash.visibility = Math.min(1, 0.3 + k);
      if (this.flashT <= 0) this.flash.isVisible = false;
    }
    for (const sp of this.sparks) {
      if (sp.life <= 0) continue;
      sp.life -= dt;
      if (sp.life <= 0) {
        sp.m.isVisible = false;
        continue;
      }
      sp.vy -= 2.4 * dt;
      sp.m.position.x += sp.vx * dt;
      sp.m.position.y += sp.vy * dt;
      sp.m.position.z += sp.vz * dt;
    }
    for (const sm of this.smokes) {
      if (sm.life <= 0) continue;
      sm.life -= dt;
      if (sm.life <= 0) {
        sm.m.isVisible = false;
        continue;
      }
      sm.m.position.y += 0.18 * dt;
      sm.m.position.z += 0.25 * dt;
      sm.m.scaling.addInPlaceFromFloats(dt * 1.6, dt * 1.6, dt * 1.6);
    }
    if (this.light && this.lightK > 0) {
      this.lightK = Math.max(0, this.lightK - dt * 22);
      this.light.intensity = this.lightK * 1.6;
    }
  }

  dispose(): void {
    // le mesh appartengono alla scena, che viene distrutta dal client
    this.models.clear();
    this.current = null;
    this.light = null;
    matCache.clear();
  }
}
