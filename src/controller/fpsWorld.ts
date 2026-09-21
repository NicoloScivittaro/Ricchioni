import { Color3, DynamicTexture, Mesh, MeshBuilder, Scene, StandardMaterial, Texture } from '@babylonjs/core';
import { FPS_MAP } from '../../shared/fpsMap';
import type { Aabb } from '../../shared/fpsMap';

/**
 * MONDO DELLA SPARATORIA (solo aspetto: la geometria e' quella di FPS_MAP, condivisa con l'host).
 *  - texture procedurali (pavimento a piastrelle, container, casse, muri con strisce di pericolo)
 *  - i 4 muri perimetrali hanno un COLORE e un NOME (NORD magenta, SUD ciano, EST ambra, OVEST lime) e ogni spawn
 *    ha un faro colorato: ci si orienta a colpo d'occhio e si puo' dire "vengo da EST"
 *  - nebbia leggera per dare profondita' e nascondere il limite del mondo
 *  - le mesh statiche sono FUSE per materiale: poche draw call anche sui telefoni economici
 */

const ZONE_COLORS = ['#22c55e', '#06b6d4', '#f59e0b', '#ef4444', '#a855f7'];
const SIDES = [
  // indice dell'ostacolo perimetrale in FPS_MAP.obstacles: 0 = z-, 1 = z+, 2 = x-, 3 = x+
  { name: 'SUD', color: '#22d3ee', nx: 0, nz: 1 },
  { name: 'NORD', color: '#ec4899', nx: 0, nz: -1 },
  { name: 'OVEST', color: '#84cc16', nx: 1, nz: 0 },
  { name: 'EST', color: '#f59e0b', nx: -1, nz: 0 }
];

function canvasTex(scene: Scene, size: number, draw: (c: CanvasRenderingContext2D, s: number) => void, repeat = 1): DynamicTexture {
  const t = new DynamicTexture('fpsTex', { width: size, height: size }, scene, true);
  const c = t.getContext() as unknown as CanvasRenderingContext2D;
  draw(c, size);
  t.update();
  t.wrapU = Texture.WRAP_ADDRESSMODE;
  t.wrapV = Texture.WRAP_ADDRESSMODE;
  t.uScale = repeat;
  t.vScale = repeat;
  return t;
}

function textured(scene: Scene, tex: DynamicTexture): StandardMaterial {
  const m = new StandardMaterial('fpsMat', scene);
  m.diffuseTexture = tex;
  m.specularColor = new Color3(0.05, 0.05, 0.05);
  return m;
}

function emissive(scene: Scene, hex: string): StandardMaterial {
  const m = new StandardMaterial('fpsEmis', scene);
  m.emissiveColor = Color3.FromHexString(hex);
  m.diffuseColor = new Color3(0, 0, 0);
  m.disableLighting = true;
  return m;
}

function freeze(m: Mesh): Mesh {
  m.isPickable = false;
  m.freezeWorldMatrix();
  m.doNotSyncBoundingInfo = true;
  return m;
}

function merge(list: Mesh[], mat: StandardMaterial): void {
  if (list.length === 0) return;
  const merged = Mesh.MergeMeshes(list, true, false);
  if (merged) {
    merged.material = mat;
    freeze(merged);
  }
}

export function buildFpsWorld(scene: Scene): void {
  // ---- cielo e nebbia
  scene.clearColor.set(0.55, 0.75, 0.95, 1);
  scene.fogMode = Scene.FOGMODE_LINEAR;
  scene.fogColor.set(0.66, 0.8, 0.94);
  scene.fogStart = 38;
  scene.fogEnd = 110;

  // ---- pavimento a piastrelle
  const half = FPS_MAP.halfSize;
  const floorTex = canvasTex(
    scene,
    256,
    (c, s) => {
      for (let ty = 0; ty < 4; ty++) {
        for (let tx = 0; tx < 4; tx++) {
          c.fillStyle = (tx + ty) % 2 === 0 ? '#8d95a5' : '#7f8898';
          c.fillRect((tx * s) / 4, (ty * s) / 4, s / 4, s / 4);
        }
      }
      c.strokeStyle = '#69718a';
      c.lineWidth = 3;
      for (let i = 0; i <= 4; i++) {
        c.beginPath();
        c.moveTo((i * s) / 4, 0);
        c.lineTo((i * s) / 4, s);
        c.moveTo(0, (i * s) / 4);
        c.lineTo(s, (i * s) / 4);
        c.stroke();
      }
      for (let i = 0; i < 260; i++) {
        c.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
        c.fillRect(Math.random() * s, Math.random() * s, 2 + Math.random() * 4, 2 + Math.random() * 3);
      }
    },
    Math.ceil((half * 2 + 6) / 8)
  );
  const ground = MeshBuilder.CreateGround('ground', { width: half * 2 + 6, height: half * 2 + 6 }, scene);
  ground.material = textured(scene, floorTex);
  freeze(ground);

  // corsie gialle sul pavimento (come prima, ma sottili e fuse in una mesh)
  const lines: Mesh[] = [];
  for (let i = -20; i <= 20; i += 5) {
    const line = MeshBuilder.CreateBox('line', { width: 0.14, height: 0.02, depth: half * 2 }, scene);
    line.position.set(i, 0.012, 0);
    lines.push(line);
  }
  merge(lines, emissive(scene, '#c9b23a'));

  // ---- ostacoli: container / casse / muri, con texture e bordo chiaro in alto (silhouette leggibili)
  const containerTex = canvasTex(scene, 128, (c, s) => {
    c.fillStyle = '#d6602c';
    c.fillRect(0, 0, s, s);
    c.fillStyle = '#b34a1e';
    for (let x = 6; x < s; x += 16) c.fillRect(x, 8, 6, s - 16);
    c.fillStyle = '#8f3a17';
    c.fillRect(0, 0, s, 8);
    c.fillRect(0, s - 8, s, 8);
    c.fillStyle = 'rgba(255,255,255,0.7)';
    c.fillRect(s * 0.62, s * 0.4, s * 0.28, s * 0.14);
  });
  const crateTex = canvasTex(scene, 128, (c, s) => {
    c.fillStyle = '#c9964a';
    c.fillRect(0, 0, s, s);
    c.strokeStyle = '#8a6128';
    c.lineWidth = 7;
    c.strokeRect(4, 4, s - 8, s - 8);
    c.beginPath();
    c.moveTo(6, 6);
    c.lineTo(s - 6, s - 6);
    c.moveTo(s - 6, 6);
    c.lineTo(6, s - 6);
    c.stroke();
    c.lineWidth = 3;
    for (let y = 32; y < s; y += 32) {
      c.beginPath();
      c.moveTo(4, y);
      c.lineTo(s - 4, y);
      c.stroke();
    }
  });
  const wallTex = canvasTex(scene, 128, (c, s) => {
    c.fillStyle = '#8892a6';
    c.fillRect(0, 0, s, s);
    c.strokeStyle = '#6a7488';
    c.lineWidth = 3;
    c.strokeRect(2, 2, s - 4, s - 4);
    c.beginPath();
    c.moveTo(s / 2, 0);
    c.lineTo(s / 2, s - 26);
    c.stroke();
    // strisce di pericolo alla base
    c.fillStyle = '#1f2430';
    c.fillRect(0, s - 24, s, 24);
    c.fillStyle = '#facc15';
    for (let x = -24; x < s + 24; x += 32) {
      c.beginPath();
      c.moveTo(x, s);
      c.lineTo(x + 16, s);
      c.lineTo(x + 40, s - 24);
      c.lineTo(x + 24, s - 24);
      c.closePath();
      c.fill();
    }
  });
  const groups = { container: [] as Mesh[], crate: [] as Mesh[], wall: [] as Mesh[], edge: [] as Mesh[] };
  let idx = 0;
  FPS_MAP.obstacles.forEach((b: Aabb, i) => {
    const box = MeshBuilder.CreateBox('obstacle', { width: b.w, height: b.h, depth: b.d }, scene);
    box.position.set(b.x, b.h / 2, b.z);
    const isWall = i < 4 || b.h >= 4;
    (isWall ? groups.wall : idx % 2 === 0 ? groups.container : groups.crate).push(box);
    if (!isWall) idx++;
    // bordo chiaro in cima
    const edge = MeshBuilder.CreateBox('edge', { width: b.w + 0.06, height: 0.07, depth: b.d + 0.06 }, scene);
    edge.position.set(b.x, b.h + 0.02, b.z);
    groups.edge.push(edge);
  });
  merge(groups.container, textured(scene, containerTex));
  merge(groups.crate, textured(scene, crateTex));
  merge(groups.wall, textured(scene, wallTex));
  merge(groups.edge, emissive(scene, '#e2e8f0'));

  // ---- muri perimetrali: banda colorata + insegna col nome del lato
  FPS_MAP.obstacles.slice(0, 4).forEach((b, i) => {
    const side = SIDES[i];
    // faccia interna del muro
    const fx = b.x + side.nx * (b.w <= 2 ? b.w / 2 : 0);
    const fz = b.z + side.nz * (b.d <= 2 ? b.d / 2 : 0);
    const alongX = b.w > b.d;
    const len = alongX ? b.w : b.d;
    const band = MeshBuilder.CreateBox('band', { width: alongX ? len : 0.12, height: 0.45, depth: alongX ? 0.12 : len }, scene);
    band.position.set(fx + side.nx * 0.07, 3.1, fz + side.nz * 0.07);
    band.material = emissive(scene, side.color);
    freeze(band);
    const signTex = canvasTex(scene, 256, (c, s) => {
      c.fillStyle = 'rgba(15,17,28,0.92)';
      c.beginPath();
      c.roundRect(8, 60, s - 16, s - 120, 22);
      c.fill();
      c.strokeStyle = side.color;
      c.lineWidth = 8;
      c.stroke();
      c.fillStyle = side.color;
      c.font = '900 76px "Arial Black", Arial, sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(side.name, s / 2, s / 2);
    });
    const signMat = new StandardMaterial('signMat', scene);
    signMat.emissiveTexture = signTex;
    signMat.opacityTexture = signTex;
    signTex.hasAlpha = true;
    signMat.disableLighting = true;
    signMat.backFaceCulling = false;
    const sign = MeshBuilder.CreatePlane('sign', { width: 6, height: 6 }, scene);
    sign.material = signMat;
    sign.position.set(fx + side.nx * 0.09, 2.0, fz + side.nz * 0.09);
    // il piano guarda +z: si ruota verso l'interno dell'arena
    sign.rotation.y = Math.atan2(-side.nx, -side.nz);
    freeze(sign);
  });

  // ---- fari colorati agli spawn (zone): pilastro luminoso + piastra a terra
  FPS_MAP.spawns.forEach((sp, i) => {
    const hex = ZONE_COLORS[i % ZONE_COLORS.length];
    const mat = emissive(scene, hex);
    const pad = MeshBuilder.CreateDisc('pad', { radius: 2.4, tessellation: 24 }, scene);
    pad.rotation.x = Math.PI / 2;
    pad.position.set(sp.x, 0.02, sp.z);
    const padMat = emissive(scene, hex);
    padMat.alpha = 0.35;
    pad.material = padMat;
    freeze(pad);
    // il pilastro sta verso l'angolo (fuori dal passaggio) cosi' non da' fastidio a chi cammina
    const bx = sp.x + Math.sign(sp.x || 0) * 3.4;
    const bz = sp.z + Math.sign(sp.z || -1) * 3.4;
    const pole = MeshBuilder.CreateCylinder('beacon', { diameter: 0.45, height: 9, tessellation: 8 }, scene);
    pole.position.set(bx, 4.5, bz);
    pole.material = mat;
    freeze(pole);
    const orb = MeshBuilder.CreateSphere('orb', { diameter: 1.1, segments: 8 }, scene);
    orb.position.set(bx, 9.4, bz);
    orb.material = mat;
    freeze(orb);
  });

  // ---- torre centrale (landmark) con globo luminoso in cima
  const towerMat = new StandardMaterial('tower', scene);
  towerMat.diffuseColor = new Color3(0.9, 0.75, 0.2);
  towerMat.emissiveColor = new Color3(0.4, 0.3, 0.05);
  const tower = MeshBuilder.CreateBox('tower', { width: 1.2, height: 8, depth: 1.2 }, scene);
  tower.position.set(0, 4, 0);
  tower.material = towerMat;
  freeze(tower);
  const top = MeshBuilder.CreateSphere('towerTop', { diameter: 1.8, segments: 10 }, scene);
  top.position.set(0, 8.6, 0);
  top.material = emissive(scene, '#fde047');
  freeze(top);
}

/** Ombra "a macchia" sotto un giocatore (un disco scuro): aiuta a vedere dove sono i nemici. Materiale condiviso. */
let blobMat: StandardMaterial | null = null;
export function makeBlobShadow(scene: Scene): Mesh {
  if (!blobMat || blobMat.getScene() !== scene) {
    blobMat = new StandardMaterial('blobMat', scene);
    blobMat.diffuseColor = new Color3(0, 0, 0);
    blobMat.emissiveColor = new Color3(0, 0, 0);
    blobMat.disableLighting = true;
    blobMat.alpha = 0.35;
  }
  const d = MeshBuilder.CreateDisc('blob', { radius: 0.62, tessellation: 14 }, scene);
  d.rotation.x = Math.PI / 2;
  d.position.y = 0.03;
  d.material = blobMat;
  d.isPickable = false;
  return d;
}
