import {
  Scene,
  Mesh,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Vector3,
  DynamicTexture,
  InstancedMesh,
  HemisphericLight,
  DirectionalLight,
  ShadowGenerator,
  GlowLayer
} from '@babylonjs/core';
import { ARENA_HALF_W, ARENA_HALF_D } from './dodgeballTypes';

export interface DodgeballEnvironment {
  update(now: number): void;
}

function buildSky(scene: Scene): void {
  const dome = MeshBuilder.CreateSphere('skyDome', { diameter: 900, segments: 12, sideOrientation: Mesh.BACKSIDE }, scene);
  dome.infiniteDistance = true;
  const dt = new DynamicTexture('skyTex', { width: 4, height: 256 }, scene, false);
  const c = dt.getContext() as unknown as CanvasRenderingContext2D;
  const grad = c.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#10233f');
  grad.addColorStop(0.5, '#1d4ed8');
  grad.addColorStop(0.8, '#60a5fa');
  grad.addColorStop(1, '#dbeafe');
  c.fillStyle = grad;
  c.fillRect(0, 0, 4, 256);
  dt.update();
  const mat = new StandardMaterial('skyMat', scene);
  mat.diffuseTexture = dt;
  mat.emissiveColor = new Color3(1, 1, 1);
  mat.disableLighting = true;
  mat.backFaceCulling = false;
  dome.material = mat;
  dome.isPickable = false;
}

/** Pavimento da campo da dodgeball: linee di campo, metà colorate, centro. */
function buildFloorTexture(scene: Scene): DynamicTexture {
  const dt = new DynamicTexture('dodgeFloor', { width: 512, height: 512 }, scene, false);
  const c = dt.getContext() as unknown as CanvasRenderingContext2D;
  const S = 512;

  // Fondo
  c.fillStyle = '#2a3f6e';
  c.fillRect(0, 0, S, S);

  // Metà campo (due tonalità)
  c.fillStyle = '#31477d';
  c.fillRect(0, 0, S / 2, S);
  c.fillStyle = '#283c6b';
  c.fillRect(S / 2, 0, S / 2, S);

  // Linee bianche
  c.strokeStyle = 'rgba(255,255,255,0.85)';
  c.lineWidth = 8;
  c.strokeRect(14, 14, S - 28, S - 28); // bordo
  c.beginPath();
  c.moveTo(S / 2, 14);
  c.lineTo(S / 2, S - 14); // linea centrale
  c.stroke();
  c.beginPath();
  c.arc(S / 2, S / 2, S * 0.22, 0, Math.PI * 2); // cerchio centrale
  c.stroke();

  // Zone di spawn (punti)
  c.fillStyle = '#fbbf24';
  for (const [fx, fy] of [
    [0.5, 0.2],
    [0.2, 0.5],
    [0.8, 0.5],
    [0.5, 0.8],
    [0.5, 0.5]
  ]) {
    c.beginPath();
    c.arc(S * fx, S * fy, 10, 0, Math.PI * 2);
    c.fill();
  }

  dt.update();
  return dt;
}

function neonSign(scene: Scene, text: string, color: string, position: Vector3, width = 6, height = 2.2): void {
  const dt = new DynamicTexture(`sign_${text}`, { width: 512, height: 160 }, scene, false);
  dt.hasAlpha = true;
  const c = dt.getContext() as unknown as CanvasRenderingContext2D;
  c.clearRect(0, 0, 512, 160);
  c.fillStyle = 'rgba(8,8,16,0.82)';
  c.beginPath();
  c.roundRect(10, 10, 492, 140, 24);
  c.fill();
  c.strokeStyle = color;
  c.lineWidth = 6;
  c.beginPath();
  c.roundRect(10, 10, 492, 140, 24);
  c.stroke();
  c.fillStyle = color;
  c.font = '900 72px "Arial Black", Arial, sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(text, 256, 82);
  dt.update();
  const mat = new StandardMaterial(`signMat_${text}`, scene);
  mat.diffuseTexture = dt;
  mat.emissiveColor = Color3.FromHexString(color);
  mat.emissiveTexture = dt;
  mat.disableLighting = true;
  mat.backFaceCulling = false;
  const plane = MeshBuilder.CreatePlane(`sign_${text}`, { width, height }, scene);
  plane.position = position;
  plane.material = mat;
  plane.billboardMode = Mesh.BILLBOARDMODE_ALL;
}

export function buildDodgeballEnvironment(scene: Scene): DodgeballEnvironment {
  buildSky(scene);

  const hemi = new HemisphericLight('hemi', new Vector3(0.1, 1, 0.1), scene);
  hemi.intensity = 0.55;
  hemi.groundColor = new Color3(0.3, 0.32, 0.42);
  const sun = new DirectionalLight('sun', new Vector3(-0.5, -1, -0.4), scene);
  sun.intensity = 0.9;
  sun.position = new Vector3(50, 90, 40);
  const shadowGen = new ShadowGenerator(1024, sun);
  shadowGen.usePoissonSampling = true;
  shadowGen.bias = 0.002;

  const glow = new GlowLayer('glow', scene, { mainTextureRatio: 0.5 });
  glow.intensity = 0.6;

  const W = ARENA_HALF_W * 2;
  const D = ARENA_HALF_D * 2;

  // Pavimento
  const floorTex = buildFloorTexture(scene);
  const floorMat = new StandardMaterial('floorMat', scene);
  floorMat.diffuseTexture = floorTex;
  floorMat.specularColor = new Color3(0.06, 0.06, 0.06);
  const floor = MeshBuilder.CreateBox('dodgeFloor', { width: W, height: 1.4, depth: D }, scene);
  floor.position.y = -0.7; // top a y=0
  floor.material = floorMat;
  floor.receiveShadows = true;
  shadowGen.addShadowCaster(floor, false);

  // Muri / bordi del campo
  const wallMat = new StandardMaterial('wallMat', scene);
  wallMat.diffuseColor = new Color3(0.16, 0.2, 0.34);
  const stripeMat = new StandardMaterial('stripeMat', scene);
  stripeMat.diffuseColor = new Color3(0.1, 0.1, 0.16);
  stripeMat.emissiveColor = new Color3(0.4, 0.2, 0.9);
  stripeMat.disableLighting = true;

  const wallH = 2.2;
  const wallT = 0.5;
  const walls: { x: number; z: number; w: number; d: number }[] = [
    { x: 0, z: -D / 2 - wallT / 2, w: W + wallT * 2, d: wallT },
    { x: 0, z: D / 2 + wallT / 2, w: W + wallT * 2, d: wallT },
    { x: -W / 2 - wallT / 2, z: 0, w: wallT, d: D },
    { x: W / 2 + wallT / 2, z: 0, w: wallT, d: D }
  ];
  for (const w of walls) {
    const wall = MeshBuilder.CreateBox('wall', { width: w.w, height: wallH, depth: w.d }, scene);
    wall.position = new Vector3(w.x, wallH / 2, w.z);
    wall.material = wallMat;
    const stripe = MeshBuilder.CreateBox('wallStripe', { width: w.w, height: 0.25, depth: w.d + 0.05 }, scene);
    stripe.position = new Vector3(w.x, wallH - 0.12, w.z);
    stripe.material = stripeMat;
  }

  // Folla stilizzata (instancing per colore)
  const crowdColors = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#f97316', '#a855f7', '#ec4899', '#14b8a6'];
  const templates = crowdColors.map((hex, i) => {
    const t = MeshBuilder.CreateBox(`crowdBox_${i}`, { width: 0.8, height: 1.1, depth: 0.8 }, scene);
    t.isVisible = false;
    const m = new StandardMaterial(`crowdMat_${i}`, scene);
    m.diffuseColor = Color3.FromHexString(hex);
    t.material = m;
    return t;
  });
  const crowd: { inst: InstancedMesh; baseY: number; phase: number }[] = [];
  const perSide = 30;
  let idx = 0;
  for (let i = 0; i < perSide; i++) {
    const t = (i / perSide) * 2 - 1; // -1..1
    const ox = t * (W / 2 + 3);
    const oz = D / 2 + 3;
    for (const sign of [-1, 1]) {
      const inst1 = templates[idx % templates.length].createInstance(`crowd_${idx++}`);
      inst1.position = new Vector3(ox, -1.8 - Math.random() * 2, sign * oz);
      inst1.rotation.y = Math.random() * Math.PI * 2;
      inst1.scaling.y = 0.8 + Math.random() * 0.9;
      crowd.push({ inst: inst1, baseY: inst1.position.y, phase: Math.random() * Math.PI * 2 });
    }
  }
  for (let i = 0; i < perSide; i++) {
    const t = (i / perSide) * 2 - 1;
    const oz = t * (D / 2 + 3);
    const ox = W / 2 + 3;
    for (const sign of [-1, 1]) {
      const inst1 = templates[idx % templates.length].createInstance(`crowd_${idx++}`);
      inst1.position = new Vector3(sign * ox, -1.8 - Math.random() * 2, oz);
      inst1.rotation.y = Math.random() * Math.PI * 2;
      inst1.scaling.y = 0.8 + Math.random() * 0.9;
      crowd.push({ inst: inst1, baseY: inst1.position.y, phase: Math.random() * Math.PI * 2 });
    }
  }

  // Cartelloni neon
  neonSign(scene, 'DODGEBALL', '#f43f5e', new Vector3(0, 5, -D / 2 - 3));
  neonSign(scene, 'COGLIONI', '#22d3ee', new Vector3(-W / 2 - 3, 5, 0));
  neonSign(scene, 'FUORI!', '#fbbf24', new Vector3(W / 2 + 3, 5, 0));

  // Torri luce
  for (const sx of [-W / 2 - 2, W / 2 + 2]) {
    for (const sz of [-D / 2 - 2, D / 2 + 2]) {
      const tower = MeshBuilder.CreateBox('tower', { width: 1.4, height: 8, depth: 1.4 }, scene);
      tower.position = new Vector3(sx, 4, sz);
      const towerMat = new StandardMaterial('towerMat', scene);
      towerMat.diffuseColor = new Color3(0.1, 0.1, 0.14);
      tower.material = towerMat;
      const lamp = MeshBuilder.CreateBox('lamp', { width: 2.6, height: 0.6, depth: 1 }, scene);
      lamp.position = new Vector3(sx, 7.6, sz);
      const lampMat = new StandardMaterial('lampMat', scene);
      lampMat.diffuseColor = new Color3(0.95, 0.96, 1);
      lampMat.emissiveColor = new Color3(1, 1, 1);
      lamp.material = lampMat;
    }
  }

  return {
    update(now: number): void {
      const t = now * 0.001;
      for (const c of crowd) {
        c.inst.position.y = c.baseY + Math.sin(t * 2 + c.phase) * 0.06;
      }
    }
  };
}
