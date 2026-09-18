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
import { FIELD_HALF_W, FIELD_HALF_D, NET_HEIGHT } from './volleyballTypes';

export interface VolleyballEnvironment {
  update(now: number): void;
}

function buildSky(scene: Scene): void {
  const dome = MeshBuilder.CreateSphere('skyDome', { diameter: 900, segments: 12, sideOrientation: Mesh.BACKSIDE }, scene);
  dome.infiniteDistance = true;
  const dt = new DynamicTexture('skyTex', { width: 4, height: 256 }, scene, false);
  const c = dt.getContext() as unknown as CanvasRenderingContext2D;
  const grad = c.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#1e6fd0');
  grad.addColorStop(0.55, '#7cc4f8');
  grad.addColorStop(0.8, '#cfe8ff');
  grad.addColorStop(1, '#fff3d6');
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

function buildSandTexture(scene: Scene): DynamicTexture {
  const dt = new DynamicTexture('sandTex', { width: 512, height: 512 }, scene, false);
  const c = dt.getContext() as unknown as CanvasRenderingContext2D;
  const S = 512;
  c.fillStyle = '#e8c887';
  c.fillRect(0, 0, S, S);
  // Granulosità sabbia
  for (let i = 0; i < 1200; i++) {
    c.fillStyle = Math.random() < 0.5 ? 'rgba(255,240,210,0.25)' : 'rgba(180,140,80,0.2)';
    c.fillRect(Math.random() * S, Math.random() * S, 2, 2);
  }
  // Linee del campo (bianche)
  c.strokeStyle = 'rgba(255,255,255,0.9)';
  c.lineWidth = 5;
  // campo: la porzione centrale della texture rappresenta il campo (X=width, Z=height)
  const margin = 24;
  c.strokeRect(margin, margin, S - margin * 2, S - margin * 2);
  c.beginPath();
  c.moveTo(S / 2, margin);
  c.lineTo(S / 2, S - margin); // linea centrale (rete)
  c.stroke();
  dt.update();
  return dt;
}

function neonSign(scene: Scene, text: string, color: string, position: Vector3, width = 5, height = 1.8): void {
  const dt = new DynamicTexture(`sign_${text}`, { width: 512, height: 160 }, scene, false);
  dt.hasAlpha = true;
  const c = dt.getContext() as unknown as CanvasRenderingContext2D;
  c.clearRect(0, 0, 512, 160);
  c.fillStyle = 'rgba(10,10,20,0.8)';
  c.beginPath();
  c.roundRect(10, 10, 492, 140, 24);
  c.fill();
  c.strokeStyle = color;
  c.lineWidth = 6;
  c.beginPath();
  c.roundRect(10, 10, 492, 140, 24);
  c.stroke();
  c.fillStyle = color;
  c.font = '900 66px "Arial Black", Arial, sans-serif';
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

function buildPalm(scene: Scene, x: number, z: number, scale: number): void {
  const trunkMat = new StandardMaterial('trunkMat', scene);
  trunkMat.diffuseColor = new Color3(0.55, 0.38, 0.22);
  const leafMat = new StandardMaterial('leafMat', scene);
  leafMat.diffuseColor = new Color3(0.2, 0.62, 0.28);

  const trunk = MeshBuilder.CreateCylinder('trunk', { diameter: 0.5, height: 4.4, tessellation: 6 }, scene);
  trunk.position = new Vector3(x, 2.2 * scale, z);
  trunk.rotation.z = (Math.random() - 0.5) * 0.3;
  trunk.scaling.setAll(scale);
  trunk.material = trunkMat;

  const top = new Vector3(x, 4.4 * scale, z);
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2;
    const leaf = MeshBuilder.CreateBox('leaf', { width: 0.5, height: 0.08, depth: 2.4 }, scene);
    leaf.position = top.add(new Vector3(Math.cos(ang) * 1.1 * scale, 0, Math.sin(ang) * 1.1 * scale));
    leaf.rotation.y = -ang;
    leaf.rotation.x = -0.5;
    leaf.material = leafMat;
    leaf.scaling.setAll(scale);
  }
}

export function buildVolleyballEnvironment(scene: Scene): VolleyballEnvironment {
  buildSky(scene);

  const hemi = new HemisphericLight('hemi', new Vector3(0.1, 1, 0.1), scene);
  hemi.intensity = 0.65;
  hemi.groundColor = new Color3(0.55, 0.45, 0.3);
  const sun = new DirectionalLight('sun', new Vector3(-0.5, -1, -0.4), scene);
  sun.intensity = 1.0;
  sun.position = new Vector3(40, 90, 40);
  const shadowGen = new ShadowGenerator(1024, sun);
  shadowGen.usePoissonSampling = true;
  shadowGen.bias = 0.002;

  const glow = new GlowLayer('glow', scene, { mainTextureRatio: 0.5 });
  glow.intensity = 0.55;

  // Sabbia (grande)
  const sandTex = buildSandTexture(scene);
  const sandMat = new StandardMaterial('sandMat', scene);
  sandMat.diffuseTexture = sandTex;
  sandMat.specularColor = new Color3(0.03, 0.03, 0.03);
  const sand = MeshBuilder.CreateBox('sand', { width: 90, height: 1, depth: 70 }, scene);
  sand.position.y = -0.5;
  sand.material = sandMat;
  sand.receiveShadows = true;
  shadowGen.addShadowCaster(sand, false);

  // Mare sullo sfondo (+Z)
  const seaMat = new StandardMaterial('seaMat', scene);
  seaMat.diffuseColor = new Color3(0.1, 0.45, 0.7);
  seaMat.emissiveColor = new Color3(0.02, 0.08, 0.12);
  seaMat.specularColor = new Color3(0.4, 0.4, 0.4);
  const sea = MeshBuilder.CreateBox('sea', { width: 120, height: 1, depth: 60 }, scene);
  sea.position = new Vector3(0, -0.6, FIELD_HALF_D + 34);
  sea.material = seaMat;

  // Rete 3D
  const postMat = new StandardMaterial('postMat', scene);
  postMat.diffuseColor = new Color3(0.9, 0.9, 0.95);
  for (const sx of [-FIELD_HALF_W - 0.5, FIELD_HALF_W + 0.5]) {
    const post = MeshBuilder.CreateCylinder('post', { diameter: 0.25, height: NET_HEIGHT + 0.6, tessellation: 8 }, scene);
    post.position = new Vector3(sx, (NET_HEIGHT + 0.6) / 2, 0);
    post.material = postMat;
  }
  const netMat = new StandardMaterial('netMat', scene);
  netMat.diffuseColor = new Color3(0.95, 0.95, 1);
  netMat.alpha = 0.35;
  netMat.disableLighting = true;
  const net = MeshBuilder.CreateBox('net', { width: FIELD_HALF_W * 2 + 1, height: NET_HEIGHT, depth: 0.12 }, scene);
  net.position = new Vector3(0, NET_HEIGHT / 2, 0);
  net.material = netMat;
  const bandMat = new StandardMaterial('bandMat', scene);
  bandMat.diffuseColor = new Color3(1, 1, 1);
  const band = MeshBuilder.CreateBox('band', { width: FIELD_HALF_W * 2 + 1, height: 0.16, depth: 0.14 }, scene);
  band.position = new Vector3(0, NET_HEIGHT, 0);
  band.material = bandMat;

  // Palme
  buildPalm(scene, -FIELD_HALF_W - 6, -FIELD_HALF_D - 5, 1.1);
  buildPalm(scene, FIELD_HALF_W + 6, -FIELD_HALF_D - 5, 0.9);
  buildPalm(scene, -FIELD_HALF_W - 7, FIELD_HALF_D + 8, 1.0);
  buildPalm(scene, FIELD_HALF_W + 7, FIELD_HALF_D + 8, 1.15);

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
  let idx = 0;
  for (let i = 0; i < 40; i++) {
    const t = (i / 40) * 2 - 1;
    const inst = templates[idx % templates.length].createInstance(`crowd_${idx++}`);
    inst.position = new Vector3(t * (FIELD_HALF_W + 4), -0.1, -FIELD_HALF_D - 5 - Math.random() * 3);
    inst.rotation.y = Math.random() * Math.PI * 2;
    inst.scaling.y = 0.8 + Math.random() * 0.9;
    crowd.push({ inst, baseY: inst.position.y, phase: Math.random() * Math.PI * 2 });
  }

  // Cartelloni
  neonSign(scene, 'GRANITA', '#fbbf24', new Vector3(-FIELD_HALF_W - 5, 4, -FIELD_HALF_D - 2));
  neonSign(scene, 'KEBAB', '#f97316', new Vector3(FIELD_HALF_W + 5, 4, -FIELD_HALF_D - 2));
  neonSign(scene, 'GOBLINS GAME', '#22d3ee', new Vector3(0, 4.5, -FIELD_HALF_D - 4));
  neonSign(scene, 'NETTUNO', '#a78bfa', new Vector3(-FIELD_HALF_W - 5, 4, FIELD_HALF_D + 3));
  neonSign(scene, 'ANZIO', '#fb7185', new Vector3(FIELD_HALF_W + 5, 4, FIELD_HALF_D + 3));

  return {
    update(now: number): void {
      const t = now * 0.001;
      for (const c of crowd) {
        c.inst.position.y = c.baseY + Math.sin(t * 2 + c.phase) * 0.06;
      }
    }
  };
}
