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
import { FIELD_HALF_W, FIELD_HALF_D, GOAL_HALF_W, GOAL_DEPTH, TEAM_COLOR } from './soccerTypes';

export interface SoccerEnvironment {
  update(now: number): void;
}

function buildSky(scene: Scene): void {
  const dome = MeshBuilder.CreateSphere('skyDome', { diameter: 900, segments: 12, sideOrientation: Mesh.BACKSIDE }, scene);
  dome.infiniteDistance = true;
  const dt = new DynamicTexture('skyTex', { width: 4, height: 256 }, scene, false);
  const c = dt.getContext() as unknown as CanvasRenderingContext2D;
  const grad = c.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#0b1c3a');
  grad.addColorStop(0.5, '#1e3a8a');
  grad.addColorStop(0.8, '#3b82f6');
  grad.addColorStop(1, '#bfdbfe');
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

function buildFloorTexture(scene: Scene): DynamicTexture {
  const dt = new DynamicTexture('soccerFloor', { width: 512, height: 512 }, scene, false);
  const c = dt.getContext() as unknown as CanvasRenderingContext2D;
  const S = 512;
  // Strisce d'erba alternate
  for (let i = 0; i < 8; i++) {
    c.fillStyle = i % 2 === 0 ? '#1f8f3a' : '#1a7d32';
    c.fillRect(0, (S / 8) * i, S, S / 8);
  }
  // Linee bianche
  c.strokeStyle = 'rgba(255,255,255,0.9)';
  c.lineWidth = 5;
  c.strokeRect(10, 10, S - 20, S - 20);
  c.beginPath();
  c.moveTo(S / 2, 10);
  c.lineTo(S / 2, S - 10);
  c.stroke();
  c.beginPath();
  c.arc(S / 2, S / 2, S * 0.12, 0, Math.PI * 2);
  c.stroke();
  // Aree di rigore (sui lati corti X)
  for (const sx of [0, S]) {
    c.strokeRect(sx === 0 ? 10 : S - S * 0.24, S * 0.22, S * 0.23, S * 0.56);
  }
  dt.update();
  return dt;
}

function neonSign(scene: Scene, text: string, color: string, position: Vector3, width = 5, height = 1.8): void {
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

/** Porta 3D (pali + traversa + rete) sul lato indicato. */
function buildGoal(scene: Scene, side: 1 | -1, team: 'red' | 'blue'): void {
  const x = side * FIELD_HALF_W;
  const postMat = new StandardMaterial(`post_${team}`, scene);
  postMat.diffuseColor = Color3.FromHexString(TEAM_COLOR[team]);
  postMat.emissiveColor = Color3.FromHexString(TEAM_COLOR[team]).scale(0.4);

  for (const sz of [-GOAL_HALF_W, GOAL_HALF_W]) {
    const post = MeshBuilder.CreateCylinder('post', { diameter: 0.25, height: 2.3, tessellation: 8 }, scene);
    post.position = new Vector3(x, 1.15, sz);
    post.material = postMat;
  }
  const bar = MeshBuilder.CreateCylinder('crossbar', { diameter: 0.25, height: GOAL_HALF_W * 2, tessellation: 8 }, scene);
  bar.position = new Vector3(x, 2.3, 0);
  bar.rotation.z = Math.PI / 2;
  bar.material = postMat;

  const netMat = new StandardMaterial('net', scene);
  netMat.diffuseColor = new Color3(0.9, 0.92, 0.95);
  netMat.alpha = 0.35;
  netMat.disableLighting = true;
  const net = MeshBuilder.CreateBox('net', { width: GOAL_DEPTH, height: 2.2, depth: GOAL_HALF_W * 2 }, scene);
  net.position = new Vector3(x + side * GOAL_DEPTH / 2, 1.1, 0);
  net.material = netMat;
}

export function buildSoccerEnvironment(scene: Scene): SoccerEnvironment {
  buildSky(scene);

  const hemi = new HemisphericLight('hemi', new Vector3(0.1, 1, 0.1), scene);
  hemi.intensity = 0.6;
  hemi.groundColor = new Color3(0.35, 0.4, 0.3);
  const sun = new DirectionalLight('sun', new Vector3(-0.5, -1, -0.4), scene);
  sun.intensity = 0.9;
  sun.position = new Vector3(40, 90, 40);
  const shadowGen = new ShadowGenerator(1024, sun);
  shadowGen.usePoissonSampling = true;
  shadowGen.bias = 0.002;

  const glow = new GlowLayer('glow', scene, { mainTextureRatio: 0.5 });
  glow.intensity = 0.55;

  const W = FIELD_HALF_W * 2;
  const D = FIELD_HALF_D * 2;

  // Pavimento
  const floorTex = buildFloorTexture(scene);
  const floorMat = new StandardMaterial('floorMat', scene);
  floorMat.diffuseTexture = floorTex;
  floorMat.specularColor = new Color3(0.04, 0.04, 0.04);
  const floor = MeshBuilder.CreateBox('soccerFloor', { width: W, height: 1.2, depth: D }, scene);
  floor.position.y = -0.6;
  floor.material = floorMat;
  floor.receiveShadows = true;
  shadowGen.addShadowCaster(floor, false);

  // Porte
  buildGoal(scene, -1, 'blue');
  buildGoal(scene, 1, 'red');

  // Bande laterali basse (futsal): lasciano aperta la bocca delle porte.
  const boardMat = new StandardMaterial('boardMat', scene);
  boardMat.diffuseColor = new Color3(0.13, 0.16, 0.24);
  const boardH = 0.6;
  const boardT = 0.4;

  // Bande lungo X (lati corti) con buco per le porte
  for (const side of [-1, 1]) {
    const x = side * FIELD_HALF_W;
    const segLen = (D / 2 - GOAL_HALF_W) / 2;
    for (const sign of [-1, 1]) {
      const zCenter = sign * (GOAL_HALF_W + segLen);
      const board = MeshBuilder.CreateBox('boardX', { width: boardT, height: boardH, depth: segLen * 2 }, scene);
      board.position = new Vector3(x, boardH / 2, zCenter);
      board.material = boardMat;
    }
  }
  // Bande lungo Z (lati lunghi)
  for (const side of [-1, 1]) {
    const z = side * FIELD_HALF_D;
    const board = MeshBuilder.CreateBox('boardZ', { width: W + boardT * 2, height: boardH, depth: boardT }, scene);
    board.position = new Vector3(0, boardH / 2, z);
    board.material = boardMat;
  }

  // Folla stilizzata
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
  const perSide = 26;
  let idx = 0;
  for (let i = 0; i < perSide; i++) {
    const t = (i / perSide) * 2 - 1;
    for (const sign of [-1, 1]) {
      const inst = templates[idx % templates.length].createInstance(`crowd_${idx++}`);
      inst.position = new Vector3(t * (W / 2 + 3), -1.8 - Math.random() * 2, sign * (D / 2 + 3));
      inst.rotation.y = Math.random() * Math.PI * 2;
      inst.scaling.y = 0.8 + Math.random() * 0.9;
      crowd.push({ inst, baseY: inst.position.y, phase: Math.random() * Math.PI * 2 });
    }
  }

  // Cartelloni
  neonSign(scene, 'DISAGIO', '#f43f5e', new Vector3(0, 4.5, -D / 2 - 3));
  neonSign(scene, 'GOOOL!', '#22d3ee', new Vector3(-W / 2 - 3, 4.5, 0));
  neonSign(scene, 'FUORI!', '#fbbf24', new Vector3(W / 2 + 3, 4.5, 0));

  return {
    update(now: number): void {
      const t = now * 0.001;
      for (const c of crowd) {
        c.inst.position.y = c.baseY + Math.sin(t * 2 + c.phase) * 0.06;
      }
    }
  };
}
