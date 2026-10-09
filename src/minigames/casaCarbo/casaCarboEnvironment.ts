import { Color3, Color4, DynamicTexture, Mesh, MeshBuilder, ParticleSystem, Scene, StandardMaterial, Texture, Vector3 } from '@babylonjs/core';
import type { HemisphericLight } from '@babylonjs/core';
import { EnvKit, PAL, SIGN_FONT, mixHex, seeded } from '../env/envKit';
import { CELL_PX, COLS, DOORS, DRAINS, FURNITURE, GARDENS, GRID_X0, GRID_Y0, INNER_DOORS, INTERIOR, ROWS, WALLS, toWorldX, toWorldZ } from './mapData';
import type { Furniture, Rect } from './mapData';

/**
 * CASA CARBO — la casa vista dall'alto "a spaccato" (muri bassi), come nella planimetria dell'utente: pavimenti diversi per stanza,
 * porte rosse, mobili essenziali, giardino davanti e dietro col cancello CASA CARBO, magazzino, temporale (cielo scuro, pioggia,
 * lampi). Una casa modesta, abitata e un po' in disordine: niente lusso, niente abbandono.
 * L'ACQUA e' una sola texture (una cella = un pixel, filtrata) aggiornata dal simulatore: nessuna particella fisica.
 * Nessun elemento decorativo e' collidibile: le collisioni vere sono nel simulatore (waterCore), qui si disegna.
 */

export interface CasaCarboEnvironment {
  /** ridisegna l'acqua dalla griglia (chiamarlo qualche volta al secondo) */
  updateWater(h: Float32Array, interior: Uint8Array, blocked: Uint8Array): void;
  /** lampo del temporale (0..1) */
  flash(k: number): void;
  setRain(intensity: number): void;
  update(dt: number): void;
  /** il tappeto spostato (ostacolo) */
  showRug(rect: Rect | null): void;
}

const WALL_H = 1.05;
const wx = toWorldX;
const wz = toWorldZ;
/** rettangolo in px -> centro e misure in metri */
function box(r: Rect): { x: number; z: number; w: number; d: number } {
  return { x: (wx(r[0]) + wx(r[2])) / 2, z: (wz(r[1]) + wz(r[3])) / 2, w: (r[2] - r[0]) / 40, d: (r[3] - r[1]) / 40 };
}

/** Stanze (solo per il pavimento): ogni stanza ha il suo materiale. */
const ROOMS: { r: Rect; kind: 'wood' | 'tile' | 'kitchen' | 'gym' | 'bath' }[] = [
  { r: [85, 175, 778, 392], kind: 'wood' }, // camera + angolo mobile
  { r: [85, 330, 500, 392], kind: 'wood' }, // armadio
  { r: [85, 405, 262, 508], kind: 'bath' }, // doccia
  { r: [262, 405, 785, 508], kind: 'tile' }, // bagno
  { r: [785, 175, 962, 700], kind: 'wood' }, // corridoio
  { r: [85, 515, 340, 700], kind: 'kitchen' }, // cucina
  { r: [340, 515, 962, 700], kind: 'wood' }, // pranzo
  { r: [955, 175, 1390, 400], kind: 'gym' }, // palestra
  { r: [970, 405, 1390, 700], kind: 'wood' } // salotto
];

export function buildCasaCarboEnvironment(scene: Scene): CasaCarboEnvironment & { hemi: HemisphericLight } {
  const kit = new EnvKit(scene);
  scene.fogMode = Scene.FOGMODE_LINEAR;
  scene.fogColor = Color3.FromHexString('#3a4252');
  scene.fogStart = 60;
  scene.fogEnd = 160;
  scene.clearColor = new Color4(0.2, 0.23, 0.29, 1);
  kit.sky([[0, '#1d2230'], [0.5, '#323a4c'], [1, '#56607a']]);
  const lights = kit.lightRig({
    key: [0.25, -1, 0.35],
    keyColor: '#dfe6f2',
    keyI: 0.75,
    sky: '#c7d2e6',
    ground: '#4a4a40',
    fillI: 0.72
  });

  // ---- giardini (erba) e vialetto
  const grassTex = kit.texture('ccGrass', 256, 256, (c, w, h) => {
    const rnd = seeded(5);
    c.fillStyle = '#4c7a3e';
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      c.fillStyle = rnd() < 0.5 ? 'rgba(30,60,25,0.35)' : 'rgba(120,170,90,0.25)';
      c.fillRect(rnd() * w, rnd() * h, 2, 3 + rnd() * 4);
    }
  }, { wrap: true });
  grassTex.uScale = 8;
  grassTex.vScale = 3;
  const grassMat = kit.mat('#ffffff', { tex: grassTex, emissive: 0.35, key: 'ccGrassMat' });
  const ground = MeshBuilder.CreateGround('ccLawn', { width: 60, height: 40 }, scene);
  ground.position.set(0, -0.06, wz(470));
  ground.material = grassMat;
  kit.freeze(ground);
  // vialetto di pietre fino al cancello e davanti alla porta
  const stoneMat = kit.mat('#a7a39a', { emissive: 0.3 });
  const stones: Mesh[] = [];
  const rnd = seeded(9);
  for (let y = 730; y < 930; y += 26) for (const dx of [-14, 14]) stones.push(kit.box('stone', 0.5 + rnd() * 0.15, 0.04, 0.45, { x: wx(712 + dx + (rnd() - 0.5) * 8), y: -0.02, z: wz(y + (rnd() - 0.5) * 6), ry: rnd() }, stoneMat));
  for (let y = 40; y < 150; y += 26) stones.push(kit.box('stone', 0.5, 0.04, 0.45, { x: wx(860 + (rnd() - 0.5) * 30), y: -0.02, z: wz(y), ry: rnd() }, stoneMat));
  kit.merge('ccStones', stones, stoneMat);

  // ---- recinzione con cancello CASA CARBO (in fondo, oltre il giardino posteriore)
  const fenceMat = kit.mat(PAL.woodDark, { emissive: 0.3 });
  const fence: Mesh[] = [];
  for (let x = 40; x < 1420; x += 26) if (x < 600 || x > 840) fence.push(kit.box('fencePost', 0.12, 0.9, 0.12, { x: wx(x), y: 0.45, z: wz(935) }, fenceMat));
  fence.push(kit.box('fenceRail', wx(600) - wx(40), 0.1, 0.08, { x: (wx(40) + wx(600)) / 2, y: 0.65, z: wz(935) }, fenceMat));
  fence.push(kit.box('fenceRail2', wx(1420) - wx(840), 0.1, 0.08, { x: (wx(840) + wx(1420)) / 2, y: 0.65, z: wz(935) }, fenceMat));
  kit.merge('ccFence', fence, fenceMat);
  const gate = kit.sign('CASA CARBO', { style: 'board', w: 3.6, h: 0.9, x: wx(720), y: 1.3, z: wz(935) - 0.1, twoSided: true });
  void gate;

  // ---- magazzino (scenografico, nel giardino anteriore a sinistra)
  const shedMat = kit.mat('#6b5847', { emissive: 0.3 });
  kit.box('shed', (395 - 40) / 40, 1.1, (145 - 10) / 40, { x: wx(218), y: 0.55, z: wz(80) }, shedMat);
  kit.sign('MAGAZZINO', { style: 'board', w: 2.4, h: 0.55, x: wx(218), y: 1.25, z: wz(150) - 0.02 });

  // ---- pavimenti delle stanze
  const floorMats: Record<string, StandardMaterial> = {};
  const floorTex = (kind: string): DynamicTexture =>
    kit.texture(`ccFloor_${kind}`, 128, 128, (c, w, h) => {
      const r2 = seeded(kind.length * 7);
      if (kind === 'wood') {
        c.fillStyle = '#b07d4c';
        c.fillRect(0, 0, w, h);
        for (let y = 0; y < h; y += 16) {
          c.fillStyle = r2() < 0.5 ? '#a4713f' : '#ba8756';
          c.fillRect(0, y, w, 15);
          c.fillStyle = 'rgba(0,0,0,0.25)';
          c.fillRect(0, y + 15, w, 1);
          c.fillRect(r2() * w, y, 1, 15);
        }
      } else if (kind === 'tile' || kind === 'bath' || kind === 'kitchen') {
        c.fillStyle = kind === 'kitchen' ? '#d9cfb8' : kind === 'bath' ? '#c9d6dc' : '#dfe3e2';
        c.fillRect(0, 0, w, h);
        c.strokeStyle = 'rgba(80,80,80,0.35)';
        c.lineWidth = 2;
        for (let i = 0; i <= w; i += 32) {
          c.beginPath();
          c.moveTo(i, 0);
          c.lineTo(i, h);
          c.stroke();
          c.beginPath();
          c.moveTo(0, i);
          c.lineTo(w, i);
          c.stroke();
        }
        for (let i = 0; i < 6; i++) {
          c.fillStyle = 'rgba(120,110,80,0.12)';
          c.fillRect(r2() * w, r2() * h, 20, 14);
        }
      } else {
        c.fillStyle = '#5a5c60';
        c.fillRect(0, 0, w, h);
        for (let i = 0; i < 300; i++) {
          c.fillStyle = r2() < 0.5 ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.06)';
          c.fillRect(r2() * w, r2() * h, 2, 2);
        }
      }
    }, { wrap: true });
  for (const room of ROOMS) {
    const b = box(room.r);
    if (!floorMats[room.kind]) floorMats[room.kind] = kit.mat('#ffffff', { tex: floorTex(room.kind), emissive: 0.4, key: `ccFloorMat_${room.kind}` });
    const m = MeshBuilder.CreateGround(`ccFloor_${room.kind}`, { width: b.w, height: b.d }, scene);
    m.position.set(b.x, 0.001, b.z);
    const t = floorMats[room.kind].diffuseTexture as Texture;
    t.uScale = 1;
    t.vScale = 1;
    m.material = floorMats[room.kind];
    // ripetizione per metro (UV scalati sulla mesh)
    const uv = m.getVerticesData('uv');
    if (uv) {
      for (let i = 0; i < uv.length; i += 2) {
        uv[i] *= b.w / 2.4;
        uv[i + 1] *= b.d / 2.4;
      }
      m.setVerticesData('uv', uv);
    }
    kit.freeze(m);
  }
  // tappeti (decorativi, piatti: non sono ostacoli)
  const rugMat = kit.mat('#9a3a32', { emissive: 0.35 });
  const rugs: Mesh[] = [];
  for (const r of [[645, 600, 830, 665], [1025, 495, 1290, 690], [555, 225, 765, 360], [195, 225, 280, 315]] as Rect[]) {
    const b = box(r);
    rugs.push(kit.box('rug', b.w, 0.02, b.d, { x: b.x, y: 0.012, z: b.z }, rugMat));
  }
  kit.merge('ccRugs', rugs, rugMat);

  // ---- muri bassi (spaccato) e porte rosse
  const wallMat = kit.mat('#2b2d33', { emissive: 0.25 });
  const wallTop = kit.mat('#e8dfcf', { emissive: 0.45 });
  const walls: Mesh[] = [];
  const tops: Mesh[] = [];
  for (const r of WALLS) {
    const b = box(r);
    walls.push(kit.box('wall', b.w, WALL_H, b.d, { x: b.x, y: WALL_H / 2, z: b.z }, wallMat));
    tops.push(kit.box('wallTop', b.w + 0.02, 0.04, b.d + 0.02, { x: b.x, y: WALL_H + 0.02, z: b.z }, wallTop));
  }
  kit.merge('ccWalls', walls, wallMat);
  kit.merge('ccWallTops', tops, wallTop);
  const doorMat = kit.mat('#c0392b', { emissive: 0.45 });
  const frames: Mesh[] = [];
  for (const d of [...INNER_DOORS, ...DOORS.map((x) => x.gap)]) {
    const b = box(d);
    const vertical = b.d > b.w;
    // due stipiti rossi ai lati del varco
    if (vertical) {
      frames.push(kit.box('jamb', 0.42, WALL_H + 0.1, 0.12, { x: b.x, y: (WALL_H + 0.1) / 2, z: b.z + b.d / 2 }, doorMat));
      frames.push(kit.box('jamb', 0.42, WALL_H + 0.1, 0.12, { x: b.x, y: (WALL_H + 0.1) / 2, z: b.z - b.d / 2 }, doorMat));
    } else {
      frames.push(kit.box('jamb', 0.12, WALL_H + 0.1, 0.42, { x: b.x + b.w / 2, y: (WALL_H + 0.1) / 2, z: b.z }, doorMat));
      frames.push(kit.box('jamb', 0.12, WALL_H + 0.1, 0.42, { x: b.x - b.w / 2, y: (WALL_H + 0.1) / 2, z: b.z }, doorMat));
    }
  }
  kit.merge('ccDoors', frames, doorMat);

  // ---- mobili (forme semplici, colori di casa)
  const furnColor: Record<Furniture['kind'], string> = {
    desk: '#8a5a36', bed: '#e2c27a', night: '#7a5030', fridge: '#e9e6dc', counter: '#c7b79a', stove: '#3b3b40', table: '#8b5a2b', sofa: '#6f7a4c', coffee: '#7a4a2a', tv: '#2a2a2e', bench: '#2c2f36', rack: '#3a3d45', ball: '#202226', toilet: '#f4f4f0', sink: '#eef2f2', cabinet: '#7a5434', shelf: '#8a6a44'
  };
  const byMat = new Map<string, Mesh[]>();
  for (const f of FURNITURE) {
    const b = box(f.r);
    const col = furnColor[f.kind];
    const list = byMat.get(col) ?? [];
    if (f.kind === 'ball') list.push(kit.cyl('ball', b.w, b.w, f.h, { x: b.x, y: f.h / 2, z: b.z }, kit.mat(col, { emissive: 0.3 }), 12));
    else list.push(kit.box(f.kind, b.w, f.h, b.d, { x: b.x, y: f.h / 2, z: b.z }, kit.mat(col, { emissive: 0.3 })));
    byMat.set(col, list);
    if (f.kind === 'bed') {
      // cuscini e coperta a fiori
      list.push(kit.box('pillow', b.w * 0.38, 0.12, 0.35, { x: b.x - b.w * 0.22, y: f.h + 0.06, z: b.z + b.d / 2 - 0.3 }, kit.mat(col, { emissive: 0.3 })));
      list.push(kit.box('pillow', b.w * 0.38, 0.12, 0.35, { x: b.x + b.w * 0.22, y: f.h + 0.06, z: b.z + b.d / 2 - 0.3 }, kit.mat(col, { emissive: 0.3 })));
    }
    if (f.kind === 'tv') {
      const screen = kit.box('tvScreen', 0.1, 0.9, b.d * 0.8, { x: b.x - b.w * 0.2, y: f.h + 0.45, z: b.z }, kit.mat('#101014', { emissive: 0.2, spec: 0.5 }));
      list.push(screen);
    }
  }
  for (const [col, list] of byMat) kit.merge(`ccFurn_${col}`, list, list[0].material ?? undefined);
  // la TV vera (sopra il mobile): un riferimento per spostarla in salvo
  // (il mobile resta; la TV salva si "alza" sul mobile: vedi setTvSafe nel gioco)

  // ---- scarichi: griglia del bagno, lavello, tombino
  const drainMat = kit.mat('#9aa2a8', { emissive: 0.35, spec: 0.4 });
  for (const d of DRAINS) {
    const x = wx(d.cx);
    const z = wz(d.cy);
    if (d.id === 'bagno') kit.cyl('bathDrain', 0.45, 0.45, 0.02, { x, y: 0.012, z }, drainMat, 16);
    else if (d.id === 'tombino') kit.box('tombino', 0.7, 0.03, 0.7, { x, y: 0.01, z }, kit.mat('#3c3f44', { emissive: 0.3 }));
    else kit.box('lavelloBasin', 0.55, 0.06, 0.4, { x, y: 0.93, z: wz(545) }, drainMat);
  }

  // ---- ACQUA: una texture COLS x ROWS stesa sull'intera griglia
  const waterTex = new DynamicTexture('ccWater', { width: COLS, height: ROWS }, scene, false, Texture.BILINEAR_SAMPLINGMODE);
  waterTex.hasAlpha = true;
  waterTex.wrapU = Texture.CLAMP_ADDRESSMODE;
  waterTex.wrapV = Texture.CLAMP_ADDRESSMODE;
  const wctx = waterTex.getContext() as unknown as CanvasRenderingContext2D;
  const img = wctx.createImageData(COLS, ROWS);
  const waterMat = new StandardMaterial('ccWaterMat', scene);
  waterMat.diffuseTexture = waterTex;
  waterMat.useAlphaFromDiffuseTexture = true;
  waterMat.diffuseColor = Color3.White();
  waterMat.emissiveColor = new Color3(0.12, 0.3, 0.55);
  waterMat.specularColor = new Color3(0.6, 0.7, 0.8);
  waterMat.specularPower = 48;
  waterMat.backFaceCulling = false;
  const gw = (COLS * CELL_PX) / 40;
  const gd = (ROWS * CELL_PX) / 40;
  const water = MeshBuilder.CreateGround('ccWater', { width: gw, height: gd }, scene);
  water.position.set(wx(GRID_X0) + gw / 2, 0.035, wz(GRID_Y0) - gd / 2);
  water.material = waterMat;
  water.isPickable = false;
  kit.excludeFromGlow(water);

  // ---- tappeto spostato (ostacolo temporaneo)
  const movedRug = MeshBuilder.CreateBox('ccMovedRug', { width: 1, height: 0.35, depth: 1 }, scene);
  movedRug.material = kit.mat('#a5443a', { emissive: 0.4, dynamic: true });
  movedRug.isVisible = false;
  movedRug.isPickable = false;

  // ---- pioggia: un solo sistema di particelle sopra tutta la scena
  const dropTex = new DynamicTexture('ccDrop', { width: 8, height: 32 }, scene, false);
  const dc = dropTex.getContext() as unknown as CanvasRenderingContext2D;
  const g = dc.createLinearGradient(0, 0, 0, 32);
  g.addColorStop(0, 'rgba(200,220,255,0)');
  g.addColorStop(1, 'rgba(200,220,255,0.9)');
  dc.fillStyle = g;
  dc.fillRect(3, 0, 2, 32);
  dropTex.update();
  dropTex.hasAlpha = true;
  const rain = new ParticleSystem('ccRain', 900, scene);
  rain.particleTexture = dropTex;
  rain.emitter = new Vector3(0, 14, wz(450));
  rain.minEmitBox = new Vector3(-20, 0, -12);
  rain.maxEmitBox = new Vector3(20, 0, 12);
  rain.direction1 = new Vector3(-0.6, -18, -0.2);
  rain.direction2 = new Vector3(-0.3, -22, 0.2);
  rain.minEmitPower = 1;
  rain.maxEmitPower = 1;
  rain.minLifeTime = 0.6;
  rain.maxLifeTime = 0.8;
  rain.minSize = 0.18;
  rain.maxSize = 0.3;
  rain.minScaleY = 3;
  rain.maxScaleY = 4;
  rain.billboardMode = ParticleSystem.BILLBOARDMODE_STRETCHED;
  rain.color1 = new Color4(0.8, 0.85, 1, 0.55);
  rain.color2 = new Color4(0.7, 0.8, 1, 0.4);
  rain.colorDead = new Color4(0.7, 0.8, 1, 0);
  rain.gravity = Vector3.Zero();
  rain.emitRate = 250;
  rain.start();

  const hemi = lights.hemi;
  const baseHemi = hemi.intensity;
  const baseKey = lights.sun.intensity;
  let flashK = 0;
  return {
    hemi,
    updateWater(h: Float32Array, interior: Uint8Array, blocked: Uint8Array): void {
      const d = img.data;
      for (let k = 0; k < COLS * ROWS; k++) {
        const o = k * 4;
        const v = interior[k] ? h[k] : 0;
        if (v < 0.04 || blocked[k]) {
          d[o + 3] = 0;
          continue;
        }
        const depth = Math.min(1, v / 1.2);
        d[o] = Math.round(70 - 50 * depth);
        d[o + 1] = Math.round(165 - 75 * depth);
        d[o + 2] = Math.round(255 - 25 * depth);
        d[o + 3] = Math.round(255 * Math.min(0.9, 0.5 + 0.55 * depth));
      }
      wctx.putImageData(img, 0, 0);
      waterTex.update(false);
    },
    flash(k: number): void {
      flashK = Math.max(flashK, k);
    },
    setRain(intensity: number): void {
      rain.emitRate = 150 + 650 * Math.max(0, Math.min(1, intensity));
    },
    update(dt: number): void {
      if (flashK > 0) flashK = Math.max(0, flashK - dt * 3);
      hemi.intensity = baseHemi + flashK * 1.2;
      lights.sun.intensity = baseKey + flashK * 0.8;
    },
    showRug(rect: Rect | null): void {
      if (!rect) {
        movedRug.isVisible = false;
        return;
      }
      const b = box(rect);
      movedRug.scaling.set(b.w, 1, b.d);
      movedRug.position.set(b.x, 0.18, b.z);
      movedRug.isVisible = true;
    }
  };
}

void mixHex;
void SIGN_FONT;
void GARDENS;
void INTERIOR;
