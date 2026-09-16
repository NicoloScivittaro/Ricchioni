import {
  Vector3,
  Color4,
  Color3,
  Mesh,
  MeshBuilder,
  StandardMaterial,
  VertexData,
  Scene,
  TransformNode
} from '@babylonjs/core';

/**
 * "RIBALTATI — CIRCUITO DEL LITORALE"
 * Circuito chiuso originale ispirato vagamente a un lungomare: rettilineo di
 * partenza, curva larga, esse, tornante, rettilineo veloce, curva sopraelevata
 * (ampia e rapida), chicane stretta, curva finale. Nessun asset/nome Nintendo.
 */
// Nota: l'elevazione (Y) resta SEMPRE >= 0 e ben sopra il piano del terreno
// (vedi buildEnvironment) — un punto sotto il livello del terreno fa sparire
// la strada dietro di esso (il terreno, opaco, la occlude).
const CONTROL_POINTS: [number, number, number][] = [
  [0, 0, 0], // 0: START/FINISH
  [0, 0, 130], // 1: fine rettilineo
  [55, 0.4, 175], // 2: ingresso curva larga
  [125, 1.4, 168], // 3: curva larga
  [172, 2.2, 110], // 4: uscita curva larga
  [205, 2.2, 45], // 5: esse - primo bordo
  [172, 1.3, -25], // 6: esse - secondo bordo
  [118, 0.7, -68], // 7: ingresso tornante
  [55, 0.3, -96], // 8: apice tornante
  [-15, 0.3, -78], // 9: uscita tornante
  [-85, 0.2, -42], // 10: inizio rettilineo veloce
  [-158, 0.2, 18], // 11: rettilineo veloce (boost)
  [-168, 1.4, 92], // 12: ingresso curva ampia
  [-125, 2.8, 152], // 13: apice curva ampia
  [-62, 1.8, 164], // 14: uscita curva ampia
  [-30, 0.7, 122], // 15: chicane sx
  [-10, 0.2, 78] // 16: chicane dx -> rientro al finish
];

const CONTROL_WIDTHS = [18, 18, 20, 20, 18, 15, 15, 14, 13, 14, 16, 18, 18, 19, 16, 10, 12];

/** Sezioni "corner difficile" (per l'abilità EXPLOIT di Goblin): [sStart%, sEnd%] del giro. */
export const HARD_CORNER_RANGES: [number, number][] = [
  [0.42, 0.5], // tornante
  [0.86, 0.94] // chicane
];

export const LAPS = 3;
export const NUM_CHECKPOINTS = 8;
export const START_BOOST_WINDOW = [0.15, 0.35] as const; // secondi dopo "VIA!" per lo start boost

export interface TrackSample {
  pos: Vector3;
  tangent: Vector3;
  right: Vector3;
  up: Vector3;
  width: number;
}

/** Percorso a spline chiusa (Catmull-Rom) riparametrizzato per lunghezza d'arco. */
export class TrackSpline {
  readonly totalLength: number;
  private readonly samples: TrackSample[];
  private readonly sampleSpacing: number;

  constructor(controlPoints: Vector3[], controlWidths: number[], rawResolution = 3000) {
    const n = controlPoints.length;
    const rawPositions: Vector3[] = [];
    for (let i = 0; i <= rawResolution; i++) {
      const t = (i / rawResolution) * n;
      rawPositions.push(TrackSpline.catmullAt(controlPoints, t));
    }
    const cumLen: number[] = [0];
    for (let i = 1; i < rawPositions.length; i++) {
      cumLen.push(cumLen[i - 1] + Vector3.Distance(rawPositions[i - 1], rawPositions[i]));
    }
    this.totalLength = cumLen[cumLen.length - 1];

    const sampleCount = Math.max(400, Math.round(this.totalLength / 1.5));
    this.sampleSpacing = this.totalLength / sampleCount;
    this.samples = [];
    let rawIdx = 0;
    for (let i = 0; i < sampleCount; i++) {
      const targetLen = i * this.sampleSpacing;
      while (rawIdx < cumLen.length - 2 && cumLen[rawIdx + 1] < targetLen) rawIdx++;
      const segLen = cumLen[rawIdx + 1] - cumLen[rawIdx];
      const localT = segLen > 0 ? (targetLen - cumLen[rawIdx]) / segLen : 0;
      const pos = Vector3.Lerp(rawPositions[rawIdx], rawPositions[rawIdx + 1], localT);
      this.samples.push({ pos, tangent: Vector3.Zero(), right: Vector3.Zero(), up: Vector3.Up(), width: 0 });
    }
    for (let i = 0; i < sampleCount; i++) {
      const prev = this.samples[(i - 1 + sampleCount) % sampleCount].pos;
      const next = this.samples[(i + 1) % sampleCount].pos;
      const tangent = next.subtract(prev).normalize();
      const right = Vector3.Cross(Vector3.Up(), tangent).normalize();
      const up = Vector3.Cross(tangent, right).normalize();
      this.samples[i].tangent = tangent;
      this.samples[i].right = right;
      this.samples[i].up = up;
    }
    for (let i = 0; i < sampleCount; i++) {
      const cf = (i / sampleCount) * n;
      const i0 = Math.floor(cf) % n;
      const i1 = (i0 + 1) % n;
      const lt = cf - Math.floor(cf);
      const smooth = lt * lt * (3 - 2 * lt);
      this.samples[i].width = controlWidths[i0] * (1 - smooth) + controlWidths[i1] * smooth;
    }
  }

  private static catmullAt(pts: Vector3[], t: number): Vector3 {
    const n = pts.length;
    const i = Math.floor(t) % n;
    const localT = t - Math.floor(t);
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    return Vector3.CatmullRom(p0, p1, p2, p3, localT);
  }

  wrap(s: number): number {
    let m = s % this.totalLength;
    if (m < 0) m += this.totalLength;
    return m;
  }

  private indexAt(s: number): { i0: number; i1: number; t: number } {
    const m = this.wrap(s);
    const f = m / this.sampleSpacing;
    const i0 = Math.floor(f) % this.samples.length;
    const i1 = (i0 + 1) % this.samples.length;
    return { i0, i1, t: f - Math.floor(f) };
  }

  positionAt(s: number): Vector3 {
    const { i0, i1, t } = this.indexAt(s);
    return Vector3.Lerp(this.samples[i0].pos, this.samples[i1].pos, t);
  }

  tangentAt(s: number): Vector3 {
    const { i0, i1, t } = this.indexAt(s);
    return Vector3.Lerp(this.samples[i0].tangent, this.samples[i1].tangent, t).normalize();
  }

  rightAt(s: number): Vector3 {
    const { i0, i1, t } = this.indexAt(s);
    return Vector3.Lerp(this.samples[i0].right, this.samples[i1].right, t).normalize();
  }

  widthAt(s: number): number {
    const { i0, i1, t } = this.indexAt(s);
    return this.samples[i0].width * (1 - t) + this.samples[i1].width * t;
  }

  /** Punto mondo dato s (lungo il percorso) e offset laterale (positivo = destra). */
  worldPoint(s: number, lateral: number, rideHeight = 0): Vector3 {
    const pos = this.positionAt(s);
    const right = this.rightAt(s);
    const { i0, i1, t } = this.indexAt(s);
    const up = Vector3.Lerp(this.samples[i0].up, this.samples[i1].up, t).normalize();
    return pos.add(right.scale(lateral)).add(up.scale(rideHeight));
  }

  get sampleCount(): number {
    return this.samples.length;
  }
}

export function buildTrack(): TrackSpline {
  const pts = CONTROL_POINTS.map(([x, y, z]) => new Vector3(x, y, z));
  return new TrackSpline(pts, CONTROL_WIDTHS);
}

/** Posizioni s (0..totalLength) dei checkpoint, equidistanti. */
export function buildCheckpoints(spline: TrackSpline): number[] {
  const out: number[] = [];
  for (let i = 0; i < NUM_CHECKPOINTS; i++) out.push((i / NUM_CHECKPOINTS) * spline.totalLength);
  return out;
}

export interface ItemBoxPlacement {
  s: number;
  lateral: number;
}

/** Coppie di box bonus sui rettilinei (partenza e boost). */
export function buildItemBoxes(spline: TrackSpline): ItemBoxPlacement[] {
  const L = spline.totalLength;
  const spots = [0.06, 0.1, 0.56, 0.6, 0.64];
  const out: ItemBoxPlacement[] = [];
  for (const f of spots) {
    const s = f * L;
    const w = spline.widthAt(s);
    out.push({ s, lateral: -w * 0.22 });
    out.push({ s, lateral: w * 0.22 });
  }
  return out;
}

export interface TrackVisuals {
  root: TransformNode;
  road: Mesh;
}

/** Costruisce le mesh stilizzate low-poly: strada, cordoli, ambientazione da lungomare. */
export function buildTrackVisuals(scene: Scene, spline: TrackSpline): TrackVisuals {
  const root = new TransformNode('trackRoot', scene);
  const road = buildRibbon(scene, spline, root);
  buildBarriers(scene, spline, root);
  buildEnvironment(scene, spline, root);
  buildStartGate(scene, spline, root);
  return { root, road };
}

function buildRibbon(scene: Scene, spline: TrackSpline, parent: TransformNode): Mesh {
  const slices = spline.sampleCount;
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const asphaltA = [0.29, 0.3, 0.34];
  const asphaltB = [0.26, 0.27, 0.31];
  const curbRed = [0.85, 0.16, 0.16];
  const curbWhite = [0.92, 0.92, 0.9];
  const laneYellow = [0.95, 0.78, 0.15];

  for (let i = 0; i <= slices; i++) {
    const idx = i % slices;
    const s = (idx / slices) * spline.totalLength;
    const pos = spline.positionAt(s);
    const right = spline.rightAt(s);
    const half = spline.widthAt(s) / 2;
    const left = pos.add(right.scale(-half));
    const rightP = pos.add(right.scale(half));
    positions.push(left.x, left.y, left.z, rightP.x, rightP.y, rightP.z);

    // Asfalto a bande leggere verso il centro, cordolo rosso/bianco ai bordi esterni.
    const stripe = Math.floor(idx / 6) % 2 === 0 ? asphaltA : asphaltB;
    colors.push(stripe[0], stripe[1], stripe[2], 1, stripe[0], stripe[1], stripe[2], 1);
  }

  // Sovrascrive un piccolo margine ai bordi con il colore del cordolo.
  for (let i = 0; i <= slices; i++) {
    const idx = i % slices;
    const curbOn = Math.floor(idx / 5) % 2 === 0;
    const edgeColor = curbOn ? curbRed : curbWhite;
    const baseL = i * 8;
    const baseR = baseL + 4;
    colors[baseL] = edgeColor[0];
    colors[baseL + 1] = edgeColor[1];
    colors[baseL + 2] = edgeColor[2];
    colors[baseR] = edgeColor[0];
    colors[baseR + 1] = edgeColor[1];
    colors[baseR + 2] = edgeColor[2];
  }

  for (let i = 0; i < slices; i++) {
    const a = i * 2;
    const b = i * 2 + 1;
    const c = (i + 1) * 2;
    const d = (i + 1) * 2 + 1;
    indices.push(a, c, b, b, c, d);
  }

  const mesh = new Mesh('road', scene);
  const vertexData = new VertexData();
  vertexData.positions = positions;
  vertexData.indices = indices;
  vertexData.colors = colors;
  VertexData.ComputeNormals(positions, indices, (vertexData.normals = []));
  vertexData.applyToMesh(mesh);
  mesh.parent = parent;
  mesh.receiveShadows = true;

  const mat = new StandardMaterial('roadMat', scene);
  mat.specularColor = new Color3(0.05, 0.05, 0.06);
  mat.backFaceCulling = false;
  mesh.material = mat;

  // Striscia centrale tratteggiata gialla, leggermente sollevata per evitare z-fighting.
  const lanePositions: number[] = [];
  const laneIndices: number[] = [];
  const laneColors: number[] = [];
  let laneVert = 0;
  for (let i = 0; i < slices; i += 2) {
    if (Math.floor(i / 2) % 2 !== 0) continue;
    for (let k = 0; k <= 1; k++) {
      const idx = (i + k) % slices;
      const s = (idx / slices) * spline.totalLength;
      const pos = spline.positionAt(s).add(spline.rightAt(s).scale(0)).add(new Vector3(0, 0.03, 0));
      const right = spline.rightAt(s);
      const l = pos.add(right.scale(-0.35));
      const r = pos.add(right.scale(0.35));
      lanePositions.push(l.x, l.y, l.z, r.x, r.y, r.z);
      laneColors.push(laneYellow[0], laneYellow[1], laneYellow[2], 1, laneYellow[0], laneYellow[1], laneYellow[2], 1);
    }
    laneIndices.push(laneVert, laneVert + 2, laneVert + 1, laneVert + 1, laneVert + 2, laneVert + 3);
    laneVert += 4;
  }
  if (laneIndices.length > 0) {
    const laneMesh = new Mesh('laneLine', scene);
    const lvd = new VertexData();
    lvd.positions = lanePositions;
    lvd.indices = laneIndices;
    lvd.colors = laneColors;
    VertexData.ComputeNormals(lanePositions, laneIndices, (lvd.normals = []));
    lvd.applyToMesh(laneMesh);
    laneMesh.parent = parent;
    const laneMat = new StandardMaterial('laneMat', scene);
    laneMat.disableLighting = true;
    laneMat.emissiveColor = new Color3(laneYellow[0], laneYellow[1], laneYellow[2]);
    laneMat.backFaceCulling = false;
    laneMesh.material = laneMat;
  }

  return mesh;
}

function buildBarriers(scene: Scene, spline: TrackSpline, parent: TransformNode): void {
  const slices = spline.sampleCount;
  const height = 1.1;
  for (const side of [-1, 1]) {
    const positions: number[] = [];
    const indices: number[] = [];
    const colors: number[] = [];
    for (let i = 0; i <= slices; i++) {
      const idx = i % slices;
      const s = (idx / slices) * spline.totalLength;
      const pos = spline.positionAt(s);
      const right = spline.rightAt(s);
      const half = spline.widthAt(s) / 2 + 0.4;
      const base = pos.add(right.scale(side * half));
      const top = base.add(new Vector3(0, height, 0));
      positions.push(base.x, base.y, base.z, top.x, top.y, top.z);
      const stripe = Math.floor(idx / 4) % 2 === 0 ? [0.88, 0.18, 0.18] : [0.95, 0.95, 0.93];
      colors.push(stripe[0], stripe[1], stripe[2], 1, stripe[0], stripe[1], stripe[2], 1);
    }
    for (let i = 0; i < slices; i++) {
      const a = i * 2;
      const b = i * 2 + 1;
      const c = (i + 1) * 2;
      const d = (i + 1) * 2 + 1;
      if (side < 0) indices.push(a, b, c, b, d, c);
      else indices.push(a, c, b, b, c, d);
    }
    const mesh = new Mesh(`barrier${side}`, scene);
    const vd = new VertexData();
    vd.positions = positions;
    vd.indices = indices;
    vd.colors = colors;
    VertexData.ComputeNormals(positions, indices, (vd.normals = []));
    vd.applyToMesh(mesh);
    mesh.parent = parent;
    const mat = new StandardMaterial(`barrierMat${side}`, scene);
    mat.specularColor = new Color3(0, 0, 0);
    mat.backFaceCulling = false;
    mesh.material = mat;
  }
}

function palmTree(scene: Scene, pos: Vector3, parent: TransformNode, scale: number): void {
  const trunk = MeshBuilder.CreateCylinder('palmTrunk', { height: 4 * scale, diameterTop: 0.22 * scale, diameterBottom: 0.34 * scale, tessellation: 6 }, scene);
  trunk.position = pos.add(new Vector3(0, 2 * scale, 0));
  trunk.rotation.z = (Math.random() - 0.5) * 0.15;
  trunk.parent = parent;
  const trunkMat = new StandardMaterial('palmTrunkMat', scene);
  trunkMat.diffuseColor = new Color3(0.5, 0.36, 0.22);
  trunk.material = trunkMat;

  const foliageMat = new StandardMaterial('palmLeafMat', scene);
  foliageMat.diffuseColor = new Color3(0.16, 0.55, 0.24);
  for (let i = 0; i < 5; i++) {
    const leaf = MeshBuilder.CreateCylinder('palmLeaf', { height: 2.4 * scale, diameterTop: 0.05, diameterBottom: 0.6 * scale, tessellation: 4 }, scene);
    leaf.parent = parent;
    leaf.position = pos.add(new Vector3(0, 4 * scale, 0));
    leaf.rotation.x = Math.PI / 2.3;
    leaf.rotation.y = (i / 5) * Math.PI * 2;
    leaf.material = foliageMat;
  }
}

function buildEnvironment(scene: Scene, spline: TrackSpline, parent: TransformNode): void {
  const ground = MeshBuilder.CreateGround('ground', { width: 900, height: 900, subdivisions: 2 }, scene);
  ground.position.y = -1.8;
  const groundMat = new StandardMaterial('groundMat', scene);
  groundMat.diffuseColor = new Color3(0.75, 0.68, 0.42);
  ground.material = groundMat;
  ground.receiveShadows = true;

  const sea = MeshBuilder.CreateGround('sea', { width: 1400, height: 1400 }, scene);
  sea.position.set(-450, -2, 40);
  const seaMat = new StandardMaterial('seaMat', scene);
  seaMat.diffuseColor = new Color3(0.14, 0.45, 0.62);
  seaMat.specularColor = new Color3(0.3, 0.4, 0.45);
  sea.material = seaMat;

  const slices = spline.sampleCount;
  for (let i = 0; i < slices; i += 18) {
    const s = (i / slices) * spline.totalLength;
    const pos = spline.positionAt(s);
    const right = spline.rightAt(s);
    const half = spline.widthAt(s) / 2;
    const side = i % 36 === 0 ? -1 : 1;
    const off = half + 6 + Math.random() * 6;
    palmTree(scene, pos.add(right.scale(side * off)), parent, 0.9 + Math.random() * 0.4);
  }

  const buildingMat = new StandardMaterial('buildingMat', scene);
  buildingMat.diffuseColor = new Color3(0.92, 0.74, 0.55);
  const roofMat = new StandardMaterial('roofMat', scene);
  roofMat.diffuseColor = new Color3(0.75, 0.3, 0.26);
  const buildingSpots = [0.02, 0.5, 0.52, 0.98];
  for (const f of buildingSpots) {
    const s = f * spline.totalLength;
    const pos = spline.positionAt(s);
    const right = spline.rightAt(s);
    const half = spline.widthAt(s) / 2;
    const bx = pos.add(right.scale(-(half + 14)));
    const w = 8 + Math.random() * 6;
    const h = 6 + Math.random() * 5;
    const box = MeshBuilder.CreateBox('building', { width: w, height: h, depth: 8 }, scene);
    box.position = bx.add(new Vector3(0, h / 2, 0));
    box.material = buildingMat;
    box.parent = parent;
    const roof = MeshBuilder.CreateBox('roof', { width: w + 0.6, height: 1, depth: 8.6 }, scene);
    roof.position = box.position.add(new Vector3(0, h / 2 + 0.5, 0));
    roof.material = roofMat;
    roof.parent = parent;
  }
}

function buildStartGate(scene: Scene, spline: TrackSpline, parent: TransformNode): void {
  const pos = spline.positionAt(0);
  const right = spline.rightAt(0);
  const half = spline.widthAt(0) / 2 + 1;
  const matPost = new StandardMaterial('gatePostMat', scene);
  matPost.diffuseColor = new Color3(0.95, 0.95, 0.9);
  const matBanner = new StandardMaterial('gateBannerMat', scene);
  matBanner.diffuseColor = new Color3(0.9, 0.2, 0.35);

  for (const side of [-1, 1]) {
    const post = MeshBuilder.CreateCylinder('gatePost', { height: 6, diameter: 0.5 }, scene);
    post.position = pos.add(right.scale(side * half)).add(new Vector3(0, 3, 0));
    post.material = matPost;
    post.parent = parent;
  }
  const banner = MeshBuilder.CreateBox('gateBanner', { width: half * 2 + 1, height: 1.4, depth: 0.3 }, scene);
  banner.position = pos.add(new Vector3(0, 5.6, 0));
  banner.material = matBanner;
  banner.parent = parent;
}

export function itemBoxSpin(mesh: Mesh, dt: number): void {
  mesh.rotation.y += dt * 2.4;
  mesh.position.y += Math.sin(performance.now() * 0.003 + mesh.uniqueId) * 0.002;
}

export { Color4 };
