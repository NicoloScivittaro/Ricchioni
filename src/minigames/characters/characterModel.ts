import { Scene, Mesh, MeshBuilder, StandardMaterial, Color3, TransformNode, DynamicTexture } from '@babylonjs/core';
import type { AccessoryId, CharacterPresentation } from '../../../shared/characterPresentation';

/**
 * MODELLO PROCEDURALE DEI PERSONAGGI (solo grafica). Un corpo chibi comune — stessa struttura per tutti, quindi stesse
 * animazioni di base — con PROPORZIONI e ACCESSORI presi dal DNA del personaggio (shared/characterPresentation.ts):
 * cosi' i cinque si distinguono anche in silhouette, senza modelli esterni e con poche mesh semplici.
 * Niente qui tocca fisica o collider: il gioco muove `root`, il resto e' disegno.
 */

export interface CharMaterials {
  garment: StandardMaterial;
  pants: StandardMaterial;
  skin: StandardMaterial;
  white: StandardMaterial;
  dark: StandardMaterial;
  accent: StandardMaterial;
  accent2: StandardMaterial;
  gold: StandardMaterial;
  all: StandardMaterial[];
}

const NEUTRAL = '#9aa3b2';

function mat(scene: Scene, name: string, hex: string, emissive = 0): StandardMaterial {
  const m = new StandardMaterial(name, scene);
  m.diffuseColor = Color3.FromHexString(hex);
  m.specularColor = new Color3(0.06, 0.06, 0.06);
  if (emissive > 0) m.emissiveColor = Color3.FromHexString(hex).scale(emissive);
  return m;
}

/**
 * Materiali del personaggio. `garmentHex` = colore della maglia: il colore del giocatore, oppure quello della SQUADRA nei giochi a
 * squadre (team > personaggio: la squadra deve restare chiarissima). `neutral` = tutto grigio (test silhouette).
 */
export function makeCharMaterials(scene: Scene, pres: CharacterPresentation | null, garmentHex: string, neutral = false): CharMaterials {
  if (neutral) {
    const g = mat(scene, 'charNeutral', NEUTRAL);
    return { garment: g, pants: g, skin: g, white: g, dark: g, accent: g, accent2: g, gold: g, all: [g] };
  }
  const garment = mat(scene, 'charGarment', garmentHex);
  const pants = mat(scene, 'charPants', pres?.dark ?? '#2b2b33');
  const skin = mat(scene, 'charSkin', pres?.skin ?? '#e6b896');
  const white = mat(scene, 'charWhite', '#f4f4f5');
  const dark = mat(scene, 'charDark', '#141418');
  const accent = mat(scene, 'charAccent', pres?.accent ?? garmentHex);
  const accent2 = mat(scene, 'charAccent2', pres?.secondaryAccent ?? '#ffffff');
  const gold = mat(scene, 'charGold', '#f5c542', 0.35);
  return { garment, pants, skin, white, dark, accent, accent2, gold, all: [garment, pants, skin, white, dark, accent, accent2, gold] };
}

/** Parti animabili del corpo (pivot): le animazioni comuni muovono queste, il DNA sceglie ampiezze e pose. */
export interface CharRig {
  /** busto + testa + braccia: pivot all'anca (postura/inclinazione) */
  upper: TransformNode;
  torso: Mesh;
  head: TransformNode;
  headMesh: Mesh;
  eyes: Mesh[];
  legL: TransformNode;
  legR: TransformNode;
  armL: TransformNode;
  armR: TransformNode;
  /** oggetto tenuto nella mano sinistra (boccale, granita, moneta...): animabile a parte */
  prop: TransformNode | null;
  /** altezza della cima della testa (accessori compresi), per targhetta/bolle */
  topY: number;
  /** spalla y / x (locali), per le pose */
  shoulderY: number;
  /** altezza dell'anca */
  hipY: number;
  /** lunghezza del braccio (per agganciare oggetti in mano) */
  armLen: number;
}

const BASE = { legLen: 0.62, torsoH: 0.95, torsoW: 1.15, torsoD: 0.7, headD: 0.85, legD: 0.26, armD: 0.22, armLen: 0.72 };

export function buildCharacterRig(scene: Scene, root: TransformNode, pres: CharacterPresentation | null, m: CharMaterials, team: boolean): CharRig {
  const b = pres?.body ?? { height: 1, width: 1, head: 1, shoulders: 1, stance: 1, crouch: 0, lean: 0 };
  const legLen = BASE.legLen * b.height;
  const torsoH = BASE.torsoH * b.height;
  const torsoW = BASE.torsoW * b.width;
  const headD = BASE.headD * b.head;
  const hipY = legLen - b.crouch * 0.5;

  // Gambe: pivot all'anca. Con stance > 1 le gambe si aprono (baricentro basso: Judoka, Buttafuori).
  const legX = 0.28 * b.width * Math.max(1, b.stance * 0.9);
  const splay = Math.max(0, b.stance - 1) * 0.42;
  const mkLeg = (side: -1 | 1): TransformNode => {
    const pivot = new TransformNode(side < 0 ? 'legL' : 'legR', scene);
    pivot.parent = root;
    pivot.position.set(side * legX, hipY, 0);
    pivot.rotation.z = side * splay;
    const leg = MeshBuilder.CreateCylinder('leg', { diameter: BASE.legD * Math.sqrt(b.width), height: legLen + b.crouch * 0.5, tessellation: 8 }, scene);
    leg.position.y = -(legLen + b.crouch * 0.5) / 2;
    leg.material = m.pants;
    leg.parent = pivot;
    const shoe = MeshBuilder.CreateBox('shoe', { width: 0.26 * Math.sqrt(b.width), height: 0.14, depth: 0.38 }, scene);
    shoe.position.set(0, -(legLen + b.crouch * 0.5) + 0.05, 0.06);
    shoe.material = m.dark;
    shoe.parent = pivot;
    return pivot;
  };
  const legL = mkLeg(-1);
  const legR = mkLeg(1);

  // Busto: tutto cio' che sta sopra l'anca ruota attorno all'anca (postura: Goblin proteso, Dottore all'indietro).
  const upper = new TransformNode('upper', scene);
  upper.parent = root;
  upper.position.y = hipY;
  upper.rotation.x = b.lean;

  const torso = MeshBuilder.CreateBox('torso', { width: torsoW, height: torsoH, depth: BASE.torsoD * Math.sqrt(b.width) }, scene);
  torso.position.y = torsoH / 2 - 0.04;
  torso.material = m.garment;
  torso.parent = upper;

  const head = new TransformNode('headPivot', scene);
  head.parent = upper;
  head.position.y = torsoH + headD * 0.46;
  const headMesh = MeshBuilder.CreateSphere('head', { diameter: headD, segments: 12 }, scene);
  headMesh.material = m.skin;
  headMesh.parent = head;
  const eyes: Mesh[] = [];
  for (const ex of [-1, 1]) {
    const eye = MeshBuilder.CreateSphere('eye', { diameter: headD * 0.19, segments: 6 }, scene);
    eye.position.set(ex * headD * 0.23, headD * 0.07, headD * 0.43);
    eye.material = m.white;
    eye.parent = head;
    const pupil = MeshBuilder.CreateSphere('pupil', { diameter: headD * 0.095, segments: 6 }, scene);
    pupil.position.set(0, 0, headD * 0.07);
    pupil.material = m.dark;
    pupil.parent = eye;
    eyes.push(eye);
  }

  const shoulderY = torsoH * 0.86;
  const shoulderX = (torsoW / 2 + 0.13) * Math.max(0.85, b.shoulders / Math.max(0.6, b.width));
  const armLen = BASE.armLen * Math.max(0.85, b.height);
  const mkArm = (side: -1 | 1): TransformNode => {
    const pivot = new TransformNode(side < 0 ? 'armL' : 'armR', scene);
    pivot.parent = upper;
    pivot.position.set(side * shoulderX, shoulderY, 0);
    const arm = MeshBuilder.CreateCylinder('arm', { diameter: BASE.armD * Math.sqrt(b.shoulders), height: armLen, tessellation: 8 }, scene);
    arm.position.y = -armLen / 2 + 0.02;
    arm.material = m.garment;
    arm.parent = pivot;
    if (!pres?.accessories.includes('boxingGloves')) {
      const hand = MeshBuilder.CreateSphere('hand', { diameter: 0.24, segments: 8 }, scene);
      hand.position.y = -armLen + 0.04;
      hand.material = m.skin;
      hand.parent = pivot;
    }
    return pivot;
  };
  const armL = mkArm(-1);
  const armR = mkArm(1);

  const rig: CharRig = { upper, torso, head, headMesh, eyes, legL, legR, armL, armR, prop: null, topY: hipY + torsoH + headD * 0.96, shoulderY, hipY, armLen };
  if (pres) {
    const ctx: AccCtx = { scene, m, rig, headD, torsoW, torsoH, team, pres };
    for (const id of pres.accessories) ACCESSORIES[id]?.(ctx);
  }
  return rig;
}

interface AccCtx {
  scene: Scene;
  m: CharMaterials;
  rig: CharRig;
  headD: number;
  torsoW: number;
  torsoH: number;
  team: boolean;
  pres: CharacterPresentation;
}

function part(mesh: Mesh, parent: TransformNode, material: StandardMaterial, x = 0, y = 0, z = 0): Mesh {
  mesh.parent = parent;
  mesh.position.set(x, y, z);
  mesh.material = material;
  return mesh;
}

/** Testo fisso disegnato una volta su una piccola texture (targhetta "DOTT.", piastra di carico). */
function labelPlane(scene: Scene, w: number, h: number, draw: (c: CanvasRenderingContext2D, W: number, H: number) => void): Mesh {
  const W = 128;
  const H = Math.round((128 * h) / w);
  const dt = new DynamicTexture('charLabel', { width: W, height: H }, scene, false);
  dt.hasAlpha = true;
  draw(dt.getContext() as unknown as CanvasRenderingContext2D, W, H);
  dt.update();
  const mt = new StandardMaterial('charLabelMat', scene);
  mt.diffuseTexture = dt;
  mt.emissiveColor = new Color3(0.55, 0.55, 0.55);
  mt.backFaceCulling = false;
  const p = MeshBuilder.CreatePlane('charLabelPlane', { width: w, height: h }, scene);
  p.material = mt;
  return p;
}

const ACCESSORIES: Partial<Record<AccessoryId, (c: AccCtx) => void>> = {
  // ---------------- GOBLIN: orecchie a punta (la silhouette), riccioli, boccale, polsino
  goblinEars: ({ scene, m, rig, headD }) => {
    for (const s of [-1, 1]) {
      const ear = MeshBuilder.CreateCylinder('goblinEar', { diameterTop: 0, diameterBottom: headD * 0.4, height: headD * 1.0, tessellation: 6 }, scene);
      part(ear, rig.head, m.skin, s * headD * 0.68, headD * 0.14, -headD * 0.04);
      ear.rotation.z = -s * (Math.PI / 2 - 0.3);
      ear.scaling.z = 0.4;
    }
  },
  curlyHair: ({ scene, m, rig, headD }) => {
    const hair = m.pants;
    const spots: [number, number, number][] = [[0, 0.46, -0.05], [-0.2, 0.42, 0.06], [0.2, 0.42, 0.04], [-0.12, 0.38, -0.25], [0.14, 0.4, -0.24], [0, 0.4, 0.2]];
    for (const [x, y, z] of spots) part(MeshBuilder.CreateSphere('curl', { diameter: headD * 0.3, segments: 6 }, scene), rig.head, hair, x * headD, y * headD, z * headD);
  },
  tankard: ({ scene, m, rig }) => {
    const hold = new TransformNode('prop', scene);
    hold.parent = rig.armL;
    hold.position.set(0, -rig.armLen - 0.02, 0.12);
    const wood = new StandardMaterial('wood', scene);
    wood.diffuseColor = new Color3(0.45, 0.28, 0.14);
    if (m.all.length === 1) wood.diffuseColor = m.garment.diffuseColor;
    part(MeshBuilder.CreateCylinder('mug', { diameter: 0.3, height: 0.36, tessellation: 10 }, scene), hold, wood, 0, 0.05, 0);
    const foam = part(MeshBuilder.CreateSphere('foam', { diameter: 0.32, segments: 8 }, scene), hold, m.white, 0, 0.25, 0);
    foam.scaling.y = 0.45;
    const handle = part(MeshBuilder.CreateTorus('mugHandle', { diameter: 0.2, thickness: 0.05, tessellation: 10 }, scene), hold, wood, -0.17, 0.05, 0);
    handle.rotation.x = Math.PI / 2;
    handle.rotation.y = Math.PI / 2;
    rig.prop = hold;
  },
  wristband: ({ scene, m, rig }) => {
    const band = part(MeshBuilder.CreateCylinder('wristband', { diameter: 0.27, height: 0.12, tessellation: 10 }, scene), rig.armR, m.accent2, 0, -rig.armLen + 0.2, 0);
    void band;
  },

  // ---------------- BUTTAFUORI: rasato, occhiali scuri, auricolare, guantoni, cappotto lungo
  buzzCut: ({ scene, m, rig, headD }) => {
    const cap = part(MeshBuilder.CreateSphere('buzz', { diameter: headD * 1.04, segments: 10 }, scene), rig.head, m.dark, 0, headD * 0.2, -headD * 0.05);
    cap.scaling.set(1, 0.72, 1);
  },
  shades: ({ scene, m, rig, headD }) => {
    const glass = new StandardMaterial('shadesGlass', scene);
    glass.diffuseColor = new Color3(0.04, 0.04, 0.05);
    glass.specularColor = new Color3(0.9, 0.9, 0.9);
    if (m.all.length === 1) glass.diffuseColor = m.garment.diffuseColor;
    part(MeshBuilder.CreateBox('shades', { width: headD * 0.78, height: headD * 0.17, depth: 0.06 }, scene), rig.head, glass, 0, headD * 0.08, headD * 0.47);
    for (const s of [-1, 1]) part(MeshBuilder.CreateBox('shadesArm', { width: 0.03, height: 0.04, depth: headD * 0.5 }, scene), rig.head, m.dark, s * headD * 0.42, headD * 0.08, headD * 0.22);
  },
  earpiece: ({ scene, m, rig, headD }) => {
    part(MeshBuilder.CreateSphere('earpiece', { diameter: 0.11, segments: 6 }, scene), rig.head, m.dark, headD * 0.5, 0, 0.02);
    const wire = part(MeshBuilder.CreateCylinder('earWire', { diameter: 0.025, height: headD * 0.55, tessellation: 4 }, scene), rig.head, m.dark, headD * 0.5, -headD * 0.3, -0.04);
    wire.rotation.z = 0.15;
  },
  boxingGloves: ({ scene, m, rig }) => {
    for (const arm of [rig.armL, rig.armR]) {
      const glove = part(MeshBuilder.CreateSphere('glove', { diameter: 0.42, segments: 10 }, scene), arm, m.accent, 0, -rig.armLen + 0.02, 0.04);
      glove.scaling.set(1, 1.05, 1.15);
      part(MeshBuilder.CreateCylinder('cuff', { diameter: 0.3, height: 0.1, tessellation: 10 }, scene), arm, m.white, 0, -rig.armLen + 0.22, 0);
    }
  },
  longCoat: ({ scene, m, rig, torsoW }) => {
    // falda del cappotto dalla vita alle ginocchia: allarga la base (silhouette "a campana" tozza)
    const coatMat = m.all.length === 1 ? m.garment : m.dark;
    const skirt = part(
      MeshBuilder.CreateCylinder('coatSkirt', { diameterTop: torsoW * 1.0, diameterBottom: torsoW * 1.32, height: 0.5, tessellation: 12 }, scene),
      rig.upper,
      coatMat,
      0,
      -0.18,
      0
    );
    skirt.scaling.z = 0.72;
    part(MeshBuilder.CreateTorus('coatTrim', { diameter: torsoW * 1.3, thickness: 0.07, tessellation: 16 }, scene), rig.upper, m.accent, 0, -0.42, 0).scaling.z = 0.72;
    // colletto alto scuro
    const collar = part(MeshBuilder.CreateCylinder('coatCollar', { diameterTop: 0.6, diameterBottom: 0.74, height: 0.12, tessellation: 10 }, scene), rig.upper, coatMat, 0, rig.shoulderY + 0.09, -0.04);
    collar.scaling.z = 0.8;
  },

  // ---------------- JUDOKA: risvolti del judogi, cintura con le code, occhiali, granita, piastra "carico e scarico"
  giLapels: ({ scene, m, rig, torsoW, torsoH }) => {
    const lap = m.white;
    for (const s of [-1, 1]) {
      const l = part(MeshBuilder.CreateBox('lapel', { width: 0.2, height: torsoH * 0.98, depth: 0.05 }, scene), rig.upper, lap, s * torsoW * 0.13, torsoH * 0.52, 0.39);
      l.rotation.z = s * 0.45;
    }
  },
  beltEnds: ({ scene, m, rig, torsoW }) => {
    const belt = part(MeshBuilder.CreateBox('belt', { width: torsoW * 1.04, height: 0.13, depth: 0.78 }, scene), rig.upper, m.dark, 0, 0.12, 0);
    void belt;
    for (const s of [-1, 1]) {
      const end = part(MeshBuilder.CreateBox('beltEnd', { width: 0.09, height: 0.36, depth: 0.04 }, scene), rig.upper, m.dark, s * 0.12, -0.08, 0.41);
      end.rotation.z = s * 0.25;
    }
  },
  glasses: ({ scene, m, rig, headD }) => {
    // montatura rettangolare (4 bacchette per lente): si vedono gli occhi, a differenza degli occhiali scuri del Buttafuori
    const w = headD * 0.3;
    const h = headD * 0.21;
    const t = 0.032;
    for (const s of [-1, 1]) {
      const cx = s * headD * 0.21;
      const cy = headD * 0.08;
      const z = headD * 0.5;
      part(MeshBuilder.CreateBox('frameT', { width: w, height: t, depth: t }, scene), rig.head, m.dark, cx, cy + h / 2, z);
      part(MeshBuilder.CreateBox('frameB', { width: w, height: t, depth: t }, scene), rig.head, m.dark, cx, cy - h / 2, z);
      part(MeshBuilder.CreateBox('frameS', { width: t, height: h, depth: t }, scene), rig.head, m.dark, cx - w / 2, cy, z);
      part(MeshBuilder.CreateBox('frameS', { width: t, height: h, depth: t }, scene), rig.head, m.dark, cx + w / 2, cy, z);
    }
    part(MeshBuilder.CreateBox('bridge', { width: headD * 0.14, height: t, depth: t }, scene), rig.head, m.dark, 0, headD * 0.12, headD * 0.5);
  },
  shortHair: ({ scene, m, rig, headD }) => {
    // capelli corti castani con ciuffo sparato in avanti (Judoka): mai calvo come Ciro
    const hair = m.all.length === 1 ? m.garment : mat(scene, 'judokaHair', '#4a2f1d');
    const cap = part(MeshBuilder.CreateSphere('hairCap', { diameter: headD * 1.07, segments: 10 }, scene), rig.head, hair, 0, headD * 0.22, -headD * 0.05);
    cap.scaling.set(1, 0.7, 1);
    for (const [x, z, rz] of [[-0.18, 0.32, 0.4], [0, 0.36, 0], [0.18, 0.32, -0.4]] as [number, number, number][]) {
      const spike = part(MeshBuilder.CreateCylinder('fringe', { diameterTop: 0, diameterBottom: headD * 0.2, height: headD * 0.3, tessellation: 5 }, scene), rig.head, hair, x * headD, headD * 0.4, z * headD);
      spike.rotation.x = 1.0;
      spike.rotation.z = rz;
    }
  },
  granita: ({ scene, m, rig }) => {
    const hold = new TransformNode('prop', scene);
    hold.parent = rig.armL;
    hold.position.set(0, -rig.armLen - 0.02, 0.12);
    const cupMat = new StandardMaterial('cup', scene);
    cupMat.diffuseColor = new Color3(0.95, 0.95, 0.97);
    cupMat.alpha = m.all.length === 1 ? 1 : 0.8;
    if (m.all.length === 1) cupMat.diffuseColor = m.garment.diffuseColor;
    part(MeshBuilder.CreateCylinder('cup', { diameterTop: 0.28, diameterBottom: 0.2, height: 0.34, tessellation: 10 }, scene), hold, cupMat, 0, 0.06, 0);
    const slush = new StandardMaterial('slush', scene);
    slush.diffuseColor = new Color3(0.9, 0.12, 0.25);
    if (m.all.length === 1) slush.diffuseColor = m.garment.diffuseColor;
    const top = part(MeshBuilder.CreateSphere('slush', { diameter: 0.28, segments: 8 }, scene), hold, slush, 0, 0.24, 0);
    top.scaling.y = 0.6;
    const straw = part(MeshBuilder.CreateCylinder('straw', { diameter: 0.035, height: 0.36, tessellation: 4 }, scene), hold, m.accent2, 0.05, 0.38, 0);
    straw.rotation.z = -0.25;
    rig.prop = hold;
  },
  hazardPlate: ({ scene, rig, torsoH, m }) => {
    if (m.all.length === 1) {
      part(MeshBuilder.CreateBox('plate', { width: 0.56, height: 0.36, depth: 0.05 }, scene), rig.upper, m.garment, 0, torsoH * 0.55, -0.4);
      return;
    }
    const p = labelPlane(scene, 0.56, 0.36, (c, W, H) => {
      c.fillStyle = '#facc15';
      c.fillRect(0, 0, W, H);
      c.fillStyle = '#111111';
      for (let x = -H; x < W; x += 26) {
        c.beginPath();
        c.moveTo(x, H);
        c.lineTo(x + 13, H);
        c.lineTo(x + 13 + H, 0);
        c.lineTo(x + H, 0);
        c.fill();
      }
      c.fillStyle = '#facc15';
      c.fillRect(W * 0.12, H * 0.28, W * 0.76, H * 0.44);
      c.fillStyle = '#111111';
      c.font = '900 20px Arial';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('CARICO', W / 2, H / 2 + 1);
    });
    // un piano Babylon guarda verso -z: sulla schiena (-z) si legge gia' dritto
    p.parent = rig.upper;
    p.position.set(0, torsoH * 0.55, -0.4);
  },

  // ---------------- DOTTORE: capelli arruffati, occhiali tondi, sigaretta, targhetta "DOTT.", pancia (massiccio, rilassato)
  messyHair: ({ scene, m, rig, headD }) => {
    const hair = m.pants === m.garment ? m.garment : mat(scene, 'messyHair', '#5b3a22');
    const spots: [number, number, number, number][] = [[0, 0.44, 0, 0.42], [-0.3, 0.32, 0.05, 0.3], [0.32, 0.3, 0.02, 0.32], [-0.15, 0.36, -0.28, 0.32], [0.18, 0.34, -0.3, 0.3], [0.05, 0.5, 0.18, 0.26], [-0.36, 0.12, -0.12, 0.24], [0.38, 0.1, -0.1, 0.24]];
    for (const [x, y, z, d] of spots) part(MeshBuilder.CreateSphere('messy', { diameter: headD * d, segments: 6 }, scene), rig.head, hair, x * headD, y * headD, z * headD);
  },
  roundGlasses: ({ scene, m, rig, headD }) => {
    for (const s of [-1, 1]) {
      const r = part(MeshBuilder.CreateTorus('roundLens', { diameter: headD * 0.3, thickness: 0.035, tessellation: 14 }, scene), rig.head, m.dark, s * headD * 0.22, headD * 0.08, headD * 0.48);
      r.rotation.x = Math.PI / 2;
    }
    part(MeshBuilder.CreateBox('bridge', { width: headD * 0.14, height: 0.03, depth: 0.03 }, scene), rig.head, m.dark, 0, headD * 0.1, headD * 0.5);
  },
  cigarette: ({ scene, m, rig, headD }) => {
    const cig = part(MeshBuilder.CreateCylinder('cig', { diameter: 0.045, height: 0.26, tessellation: 6 }, scene), rig.head, m.white, headD * 0.16, -headD * 0.2, headD * 0.52);
    cig.rotation.x = Math.PI / 2 - 0.25;
    cig.rotation.z = -0.35;
    const ember = new StandardMaterial('ember', scene);
    ember.diffuseColor = new Color3(1, 0.4, 0.1);
    ember.emissiveColor = new Color3(1, 0.35, 0.05);
    if (m.all.length === 1) ember.emissiveColor = new Color3(0, 0, 0);
    part(MeshBuilder.CreateSphere('ember', { diameter: 0.06, segments: 4 }, scene), cig, ember, 0, 0.13, 0);
  },
  dottBadge: ({ scene, rig, torsoW, torsoH, m }) => {
    if (m.all.length === 1) return;
    // targhetta assurda: "DOTT." scritto in grande, sotto in piccolo "(forse)". Niente camice, niente medicina.
    const p = labelPlane(scene, 0.46, 0.27, (c, W, H) => {
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.roundRect(2, 2, W - 4, H - 4, 8);
      c.fill();
      c.strokeStyle = '#1e3a8a';
      c.lineWidth = 4;
      c.stroke();
      c.fillStyle = '#1e3a8a';
      c.textAlign = 'center';
      c.font = '900 34px Arial';
      c.fillText('DOTT.', W / 2, H * 0.58);
      c.font = '700 14px Arial';
      c.fillText('(forse)', W / 2, H * 0.88);
    });
    // sul petto (+z) il piano va girato, altrimenti la scritta si legge a specchio
    p.parent = rig.upper;
    p.position.set(-torsoW * 0.26, torsoH * 0.86, 0.42);
    p.rotation.y = Math.PI;
  },
  belly: ({ scene, m, rig, torsoW, torsoH }) => {
    const b = part(MeshBuilder.CreateSphere('belly', { diameter: torsoW * 0.92, segments: 12 }, scene), rig.upper, m.garment, 0, torsoH * 0.36, 0.2);
    b.scaling.set(1, 0.85, 0.62);
  },

  // ---------------- CIRO: i due capelli, barba corta, catenina, moneta in mano
  twoHairs: ({ scene, m, rig, headD }) => {
    // cranio lucido + due ciuffetti sottili e storti: leggibili da lontano, mai grotteschi
    for (const s of [-1, 1]) {
      const h = part(MeshBuilder.CreateCylinder('hairTuft', { diameterTop: 0.012, diameterBottom: 0.07, height: headD * 0.42, tessellation: 5 }, scene), rig.head, m.dark, s * headD * 0.09, headD * 0.62, headD * 0.02);
      h.rotation.z = -s * 0.38;
      h.rotation.x = 0.15;
    }
    // basette corte: solo ai lati, il cranio resta nudo (stempiatura)
    for (const s of [-1, 1]) {
      const side = part(MeshBuilder.CreateSphere('sideburn', { diameter: headD * 0.36, segments: 6 }, scene), rig.head, m.dark, s * headD * 0.42, headD * 0.02, -headD * 0.1);
      side.scaling.set(0.35, 0.8, 0.9);
    }
  },
  beard: ({ scene, m, rig, headD }) => {
    const bd = part(MeshBuilder.CreateSphere('beard', { diameter: headD * 0.8, segments: 10 }, scene), rig.head, m.dark, 0, -headD * 0.24, headD * 0.17);
    bd.scaling.set(0.95, 0.5, 0.8);
  },
  goldChain: ({ scene, m, rig, torsoH }) => {
    const chain = part(MeshBuilder.CreateTorus('chain', { diameter: 0.46, thickness: 0.07, tessellation: 14 }, scene), rig.upper, m.gold, 0, torsoH * 0.82, 0.3);
    chain.rotation.x = Math.PI / 2 - 0.5;
    part(MeshBuilder.CreateCylinder('medal', { diameter: 0.14, height: 0.03, tessellation: 10 }, scene), rig.upper, m.gold, 0, torsoH * 0.66, 0.4).rotation.x = Math.PI / 2;
  },
  coin: ({ scene, m, rig }) => {
    const hold = new TransformNode('prop', scene);
    hold.parent = rig.armL;
    hold.position.set(0, -rig.armLen - 0.06, 0.1);
    const c = part(MeshBuilder.CreateCylinder('coin', { diameter: 0.24, height: 0.04, tessellation: 14 }, scene), hold, m.gold, 0, 0, 0);
    c.rotation.x = Math.PI / 2;
    rig.prop = hold;
  }
};

/**
 * Solo la TESTA del personaggio (pilota del Kart, avatar della Sparatoria): stessa pelle e stessi tratti del modello
 * intero, in piccolo. `head` e' il nodo da decorare, `headD` il suo diametro.
 */
export function decorateHead(scene: Scene, head: TransformNode, headD: number, pres: CharacterPresentation | null, m: CharMaterials): void {
  if (!pres) return;
  const rig = { head, upper: head, armL: head, armR: head } as unknown as CharRig;
  const ctx: AccCtx = { scene, m, rig, headD, torsoW: headD, torsoH: headD, team: false, pres };
  const HEAD_ONLY: AccessoryId[] = ['goblinEars', 'curlyHair', 'buzzCut', 'shades', 'earpiece', 'glasses', 'shortHair', 'messyHair', 'roundGlasses', 'cigarette', 'twoHairs', 'beard'];
  for (const id of pres.accessories) if (HEAD_ONLY.includes(id)) ACCESSORIES[id]?.(ctx);
}

/** Simbolo del personaggio (emoji su una piccola texture) come billboard: compare sopra la testa quando usa l'abilita'. */
export function makeSymbolPlane(scene: Scene, symbol: string, size: number): Mesh {
  const st = new DynamicTexture('charSymbol', { width: 128, height: 128 }, scene, false);
  st.hasAlpha = true;
  const sc = st.getContext() as unknown as CanvasRenderingContext2D;
  sc.clearRect(0, 0, 128, 128);
  sc.font = '96px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';
  sc.textAlign = 'center';
  sc.textBaseline = 'middle';
  sc.fillText(symbol, 64, 70);
  st.update();
  const sm = new StandardMaterial('charSymbolMat', scene);
  sm.diffuseTexture = st;
  sm.emissiveColor = new Color3(1, 1, 1);
  sm.disableLighting = true;
  sm.useAlphaFromDiffuseTexture = true;
  sm.backFaceCulling = false;
  const plane = MeshBuilder.CreatePlane('charSymbolPlane', { size }, scene);
  plane.material = sm;
  plane.billboardMode = Mesh.BILLBOARDMODE_ALL;
  plane.isVisible = false;
  plane.isPickable = false;
  return plane;
}
