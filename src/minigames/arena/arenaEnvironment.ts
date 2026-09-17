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
import { ARENA_R } from './arenaTypes';

export interface ArenaEnvironment {
  platform: Mesh;
  edgeRing: Mesh;
  setShrink(scale: number, danger: boolean): void;
  update(now: number): void;
}

/** Gradiente del cielo su cupola (stesso approccio del kart 3D). */
function buildSky(scene: Scene): void {
  const dome = MeshBuilder.CreateSphere('skyDome', { diameter: 900, segments: 12, sideOrientation: Mesh.BACKSIDE }, scene);
  dome.infiniteDistance = true;
  const dt = new DynamicTexture('skyTex', { width: 4, height: 256 }, scene, false);
  const c = dt.getContext() as unknown as CanvasRenderingContext2D;
  const grad = c.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#170a33');
  grad.addColorStop(0.5, '#3b1666');
  grad.addColorStop(0.8, '#7b2fb3');
  grad.addColorStop(1, '#e17bf0');
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

/** Texture pavimento: bullseye centrale + fasce + anello esterno a strisce pericolose. */
function buildFloorTexture(scene: Scene): DynamicTexture {
  const dt = new DynamicTexture('arenaFloor', { width: 512, height: 512 }, scene, false);
  const c = dt.getContext() as unknown as CanvasRenderingContext2D;
  const S = 512;
  const cx = S / 2;
  const cy = S / 2;

  c.fillStyle = '#232846';
  c.fillRect(0, 0, S, S);

  // Anelli concentrici
  const rings = [
    { r: 0.34, color: '#3a4d9b' },
    { r: 0.52, color: '#4659b5' },
    { r: 0.7, color: '#4b5ec0' },
    { r: 0.82, color: '#313a75' }
  ];
  for (const ring of rings) {
    c.fillStyle = ring.color;
    c.beginPath();
    c.arc(cx, cy, S * ring.r * 0.5, 0, Math.PI * 2);
    c.fill();
  }

  // Bullseye centrale
  c.fillStyle = '#fbbf24';
  c.beginPath();
  c.arc(cx, cy, S * 0.16, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#7c2d12';
  c.beginPath();
  c.arc(cx, cy, S * 0.09, 0, Math.PI * 2);
  c.fill();

  // Anello esterno pericoloso: strisce bianco/rosse
  const stripes = 36;
  for (let i = 0; i < stripes; i++) {
    const a0 = (i / stripes) * Math.PI * 2;
    const a1 = ((i + 0.5) / stripes) * Math.PI * 2;
    c.fillStyle = i % 2 === 0 ? '#e11d48' : '#f8fafc';
    c.beginPath();
    c.moveTo(cx, cy);
    c.arc(cx, cy, S * 0.5, a0, a1);
    c.closePath();
    c.fill();
  }

  // Bordo finale scuro
  c.strokeStyle = '#0b0b14';
  c.lineWidth = 8;
  c.beginPath();
  c.arc(cx, cy, S * 0.5 - 4, 0, Math.PI * 2);
  c.stroke();

  dt.update();
  return dt;
}

/** Cartello neon billboard con testo. */
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

export function buildEnvironment(scene: Scene): ArenaEnvironment {
  buildSky(scene);

  // Luci
  const hemi = new HemisphericLight('hemi', new Vector3(0.15, 1, 0.1), scene);
  hemi.intensity = 0.55;
  hemi.groundColor = new Color3(0.32, 0.2, 0.38);
  const sun = new DirectionalLight('sun', new Vector3(-0.4, -1, -0.3), scene);
  sun.intensity = 0.9;
  sun.position = new Vector3(60, 90, 60);
  const shadowGen = new ShadowGenerator(1024, sun);
  shadowGen.usePoissonSampling = true;
  shadowGen.bias = 0.002;

  const glow = new GlowLayer('glow', scene, { mainTextureRatio: 0.5 });
  glow.intensity = 0.6;

  // Pavimento con spessore
  const floorTex = buildFloorTexture(scene);
  const floorMat = new StandardMaterial('floorMat', scene);
  floorMat.diffuseTexture = floorTex;
  floorMat.specularColor = new Color3(0.08, 0.08, 0.08);

  const platform = MeshBuilder.CreateCylinder('arenaPlatform', { diameter: ARENA_R * 2, height: 1.8, tessellation: 72 }, scene);
  platform.position.y = -0.9; // top a y=0
  platform.material = floorMat;
  platform.receiveShadows = true;

  // Anello neon sul bordo
  const edgeMat = new StandardMaterial('edgeMat', scene);
  edgeMat.diffuseColor = new Color3(0.05, 0.02, 0.06);
  edgeMat.emissiveColor = new Color3(0.35, 0.05, 0.6);
  edgeMat.disableLighting = true;
  const edgeRing = MeshBuilder.CreateTorus('edgeRing', { diameter: ARENA_R * 2, thickness: 0.5, tessellation: 80 }, scene);
  edgeRing.position.y = 0.04;
  edgeRing.material = edgeMat;

  // Folla stilizzata attorno (instancing per colore: template invisibili colorati).
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
  const crowdCount = 120;
  for (let i = 0; i < crowdCount; i++) {
    const ang = (i / crowdCount) * Math.PI * 2 + Math.random() * 0.03;
    const rad = ARENA_R * 1.85 + Math.random() * 4;
    const inst = templates[i % templates.length].createInstance(`crowd_${i}`);
    inst.position = new Vector3(Math.cos(ang) * rad, -2.4 - Math.random() * 3, Math.sin(ang) * rad);
    inst.rotation.y = Math.random() * Math.PI * 2;
    inst.scaling.y = 0.8 + Math.random() * 0.9;
    crowd.push({ inst, baseY: inst.position.y, phase: Math.random() * Math.PI * 2 });
  }

  // Cartelloni neon
  neonSign(scene, 'DISAGIO', '#f43f5e', new Vector3(0, 4.5, -ARENA_R * 1.7));
  neonSign(scene, 'PARTY', '#22d3ee', new Vector3(-ARENA_R * 1.7, 4.5, 0));
  neonSign(scene, 'FUORI!', '#fbbf24', new Vector3(ARENA_R * 1.7, 4.5, 0));

  // Speaker tower
  for (const sx of [-ARENA_R * 1.5, ARENA_R * 1.5]) {
    const tower = MeshBuilder.CreateBox('tower', { width: 2, height: 7, depth: 2 }, scene);
    tower.position = new Vector3(sx, 2.5, ARENA_R * 1.5);
    const towerMat = new StandardMaterial('towerMat', scene);
    towerMat.diffuseColor = new Color3(0.1, 0.1, 0.14);
    tower.material = towerMat;
    const speaker = MeshBuilder.CreateCylinder('speaker', { diameter: 1.4, height: 0.5, tessellation: 12 }, scene);
    speaker.position = new Vector3(sx, 5.6, ARENA_R * 1.5 + 0.4);
    speaker.rotation.x = Math.PI / 2;
    const spkMat = new StandardMaterial('spkMat', scene);
    spkMat.diffuseColor = new Color3(0.2, 0.2, 0.24);
    spkMat.emissiveColor = new Color3(0.5, 0.1, 0.8);
    speaker.material = spkMat;
    speaker.parent = tower;
  }

  // Spotlights finti (coni emissivi) sopra l'arena
  for (let i = 0; i < 5; i++) {
    const ang = (i / 5) * Math.PI * 2;
    const cone = MeshBuilder.CreateCylinder('spot', { diameterTop: 3.4, diameterBottom: 0.4, height: 10, tessellation: 16 }, scene);
    cone.position = new Vector3(Math.cos(ang) * ARENA_R * 0.7, 6, Math.sin(ang) * ARENA_R * 0.7);
    cone.rotation.x = Math.PI / 2 - 0.35;
    const coneMat = new StandardMaterial('spotMat', scene);
    coneMat.diffuseColor = new Color3(0.8, 0.8, 1);
    coneMat.emissiveColor = new Color3(0.35, 0.3, 0.5);
    coneMat.alpha = 0.16;
    coneMat.disableLighting = true;
    cone.material = coneMat;
  }

  // I giocatori e il pavimento proiettano ombre (la folla no, per performance).
  for (const m of [platform]) shadowGen.addShadowCaster(m, false);

  return {
    platform,
    edgeRing,
    setShrink(scale: number, danger: boolean): void {
      platform.scaling.x = scale;
      platform.scaling.z = scale;
      edgeRing.scaling.x = scale;
      edgeRing.scaling.z = scale;
      if (danger) {
        edgeMat.emissiveColor = new Color3(0.9, 0.15, 0.2);
      } else {
        edgeMat.emissiveColor = new Color3(0.35, 0.05, 0.6);
      }
    },
    update(now: number): void {
      const t = now * 0.001;
      for (const c of crowd) {
        c.inst.position.y = c.baseY + Math.sin(t * 2 + c.phase) * 0.06;
      }
    }
  };
}
