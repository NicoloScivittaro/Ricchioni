import {
  Vector3,
  Color3,
  Mesh,
  MeshBuilder,
  StandardMaterial,
  VertexData,
  Scene,
  TransformNode,
  DynamicTexture
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
//
// I punti sono generati ad angoli crescenti e regolari (18/giro) attorno a un
// centro, con raggio variabile: garantisce per costruzione che il tracciato
// non si autointersechi mai (un tracciato precedente aveva due tratti che si
// incrociavano vicino al traguardo — vedi PR precedente). Verificato anche
// numericamente campionando la curva risultante.
const CONTROL_POINTS: [number, number, number][] = [
  [95, 0, 0], // 0: START/FINISH
  [91.4, 0, 35.4], // 1: fine rettilineo
  [90.2, 0.4, 82.2], // 2: ingresso curva larga
  [64.6, 1.4, 129.8], // 3: curva larga
  [12.9, 2.1, 139.4], // 4: uscita curva larga
  [-39.7, 2.1, 139.5], // 5: esse - primo bordo
  [-72.3, 1.1, 95.8], // 6: esse - secondo bordo
  [-112.2, 0.5, 69.5], // 7: ingresso tornante
  [-135.7, 0.2, 25.4], // 8: apice tornante
  [-108.1, 0.2, -20.2], // 9: uscita tornante
  [-85, 0.2, -52.6], // 10: inizio rettilineo veloce
  [-62.7, 0.2, -83], // 11: rettilineo veloce (boost)
  [-26.8, 1.2, -94.3], // 12: ingresso curva ampia
  [8.5, 2.6, -91.6], // 13: apice curva ampia
  [39.2, 1.5, -78.8], // 14: uscita curva ampia
  [66.5, 0.6, -60.6], // 15: chicane sx
  [85.8, 0.2, -33.2] // 16: chicane dx -> rientro al finish
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

  /** Angolo (rad, piano X-Z) della tangente — usato per l'imbardata assoluta dei kart. */
  tangentAngleAt(s: number): number {
    const t = this.tangentAt(s);
    return Math.atan2(t.x, t.z);
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

/** Box bonus distribuiti lungo tutto il giro, al centro carreggiata (facili da prendere). */
export function buildItemBoxes(spline: TrackSpline): ItemBoxPlacement[] {
  const L = spline.totalLength;
  const spots = [0.04, 0.09, 0.22, 0.34, 0.46, 0.52, 0.58, 0.66, 0.78, 0.9, 0.97];
  return spots.map((f) => ({ s: f * L, lateral: 0 }));
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

    // Asfalto a bande leggere verso il centro + un po' di rumore (segni di
    // gomme/usura) così non è una superficie perfettamente piatta.
    const stripe = Math.floor(idx / 6) % 2 === 0 ? asphaltA : asphaltB;
    const noise = Math.abs(Math.sin(idx * 12.9898) * 43758.5453) % 1;
    const noise2 = Math.abs(Math.sin(idx * 78.233) * 12543.61) % 1;
    const wearL = 1 + (noise - 0.5) * 0.16;
    const wearR = 1 + (noise2 - 0.5) * 0.16;
    colors.push(stripe[0] * wearL, stripe[1] * wearL, stripe[2] * wearL, 1, stripe[0] * wearR, stripe[1] * wearR, stripe[2] * wearR, 1);
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

function bush(scene: Scene, pos: Vector3, parent: TransformNode, scale: number): void {
  const mat = new StandardMaterial('bushMat', scene);
  const tone = 0.36 + Math.random() * 0.18;
  mat.diffuseColor = new Color3(0.14, tone, 0.18);
  for (let i = 0; i < 3; i++) {
    const s = MeshBuilder.CreateSphere('bushBlob', { diameter: (0.85 + Math.random() * 0.45) * scale, segments: 6 }, scene);
    s.position = pos.add(new Vector3((Math.random() - 0.5) * 0.6 * scale, 0.32 * scale + Math.random() * 0.2, (Math.random() - 0.5) * 0.6 * scale));
    s.material = mat;
    s.parent = parent;
  }
}

function lampPost(scene: Scene, pos: Vector3, parent: TransformNode): void {
  const poleMat = new StandardMaterial('lampPoleMat', scene);
  poleMat.diffuseColor = new Color3(0.14, 0.14, 0.17);

  const pole = MeshBuilder.CreateCylinder('lampPole', { height: 4.2, diameter: 0.14, tessellation: 8 }, scene);
  pole.position = pos.add(new Vector3(0, 2.1, 0));
  pole.material = poleMat;
  pole.parent = parent;

  const arm = MeshBuilder.CreateCylinder('lampArm', { height: 0.7, diameter: 0.08, tessellation: 6 }, scene);
  arm.position = pos.add(new Vector3(0, 4.05, 0.3));
  arm.rotation.x = Math.PI / 2.4;
  arm.material = poleMat;
  arm.parent = parent;

  const headMat = new StandardMaterial('lampHeadMat', scene);
  headMat.diffuseColor = new Color3(1, 0.92, 0.7);
  headMat.emissiveColor = new Color3(0.85, 0.7, 0.32);
  const head = MeshBuilder.CreateSphere('lampHead', { diameter: 0.32, segments: 6 }, scene);
  head.position = pos.add(new Vector3(0, 4.35, 0.55));
  head.material = headMat;
  head.parent = parent;
}

let signPanelCounter = 0;

/** Pannello con testo renderizzato via canvas (DynamicTexture) — riusabile per cartelli/insegne. */
function buildSignPanel(
  scene: Scene,
  pos: Vector3,
  parent: TransformNode,
  text: string,
  bg: string,
  fg: string,
  width = 2.6,
  height = 1.3
): void {
  signPanelCounter++;
  const dt = new DynamicTexture(`signTex_${signPanelCounter}`, { width: 256, height: 128 }, scene, false);
  const c = dt.getContext() as unknown as CanvasRenderingContext2D;
  c.fillStyle = bg;
  c.fillRect(0, 0, 256, 128);
  c.strokeStyle = fg;
  c.lineWidth = 6;
  c.strokeRect(6, 6, 244, 116);
  c.fillStyle = fg;
  c.font = 'bold 40px Arial';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(text, 128, 66);
  dt.update();

  const panel = MeshBuilder.CreatePlane('signPanel', { width, height }, scene);
  panel.position = pos;
  const mat = new StandardMaterial(`signMat_${signPanelCounter}`, scene);
  mat.diffuseTexture = dt;
  mat.emissiveColor = new Color3(0.3, 0.3, 0.3);
  mat.backFaceCulling = false;
  panel.material = mat;
  panel.parent = parent;
}

/** Cartello autoportante su palo (insegne "inside joke": Gusto, Granita, Kebab...). */
function signpost(scene: Scene, pos: Vector3, parent: TransformNode, text: string, bg: string, fg: string): void {
  const postMat = new StandardMaterial('signPostMat', scene);
  postMat.diffuseColor = new Color3(0.28, 0.28, 0.3);
  const post = MeshBuilder.CreateCylinder('signPost', { height: 2.6, diameter: 0.16, tessellation: 8 }, scene);
  post.position = pos.add(new Vector3(0, 1.3, 0));
  post.material = postMat;
  post.parent = parent;
  buildSignPanel(scene, pos.add(new Vector3(0, 2.7, 0)), parent, text, bg, fg);
}

const KIOSK_STRIPES = [new Color3(0.86, 0.2, 0.22), new Color3(0.15, 0.5, 0.75), new Color3(0.95, 0.75, 0.15)];

function kiosk(scene: Scene, pos: Vector3, parent: TransformNode, label: string, stripeIdx: number): void {
  const bodyMat = new StandardMaterial('kioskBodyMat', scene);
  bodyMat.diffuseColor = new Color3(0.94, 0.91, 0.84);
  const body = MeshBuilder.CreateBox('kioskBody', { width: 2.6, height: 2, depth: 2 }, scene);
  body.position = pos.add(new Vector3(0, 1, 0));
  body.material = bodyMat;
  body.parent = parent;

  const stripe = KIOSK_STRIPES[stripeIdx % KIOSK_STRIPES.length];
  const awningMat = new StandardMaterial('kioskAwningMat', scene);
  awningMat.diffuseColor = stripe;
  const awning = MeshBuilder.CreateBox('kioskAwning', { width: 3, height: 0.16, depth: 1.3 }, scene);
  awning.position = pos.add(new Vector3(0, 2.15, 1.1));
  awning.rotation.x = -0.22;
  awning.material = awningMat;
  awning.parent = parent;

  buildSignPanel(scene, pos.add(new Vector3(0, 1.15, 1.02)), parent, label, '#14161c', '#fbbf24', 2, 0.9);
}

function boat(scene: Scene, pos: Vector3, rotY: number, parent: TransformNode, hull: Color3): void {
  const hullMat = new StandardMaterial('boatHullMat', scene);
  hullMat.diffuseColor = hull;
  const body = MeshBuilder.CreateCylinder('boatHull', { height: 4.4, diameterTop: 1.5, diameterBottom: 0.25, tessellation: 8 }, scene);
  body.rotation.x = Math.PI / 2;
  body.rotation.y = rotY;
  body.position = pos.add(new Vector3(0, 0.5, 0));
  body.material = hullMat;
  body.parent = parent;

  const cabinMat = new StandardMaterial('boatCabinMat', scene);
  cabinMat.diffuseColor = new Color3(0.92, 0.92, 0.9);
  const cabin = MeshBuilder.CreateBox('boatCabin', { width: 1, height: 0.8, depth: 1.1 }, scene);
  cabin.rotation.y = rotY;
  cabin.position = pos.add(new Vector3(0, 1.1, 0)).add(new Vector3(Math.sin(rotY), 0, Math.cos(rotY)).scale(0.5));
  cabin.material = cabinMat;
  cabin.parent = parent;

  const mastMat = new StandardMaterial('boatMastMat', scene);
  mastMat.diffuseColor = new Color3(0.8, 0.78, 0.72);
  const mast = MeshBuilder.CreateCylinder('boatMast', { height: 2.2, diameter: 0.06, tessellation: 6 }, scene);
  mast.rotation.y = rotY;
  mast.position = pos.add(new Vector3(0, 1.9, 0)).add(new Vector3(Math.sin(rotY), 0, Math.cos(rotY)).scale(-0.3));
  mast.material = mastMat;
  mast.parent = parent;
}

function pier(scene: Scene, pos: Vector3, rotY: number, parent: TransformNode): void {
  const mat = new StandardMaterial('pierMat', scene);
  mat.diffuseColor = new Color3(0.45, 0.33, 0.2);
  const deck = MeshBuilder.CreateBox('pierDeck', { width: 5, height: 0.3, depth: 18 }, scene);
  deck.position = pos;
  deck.rotation.y = rotY;
  deck.material = mat;
  deck.parent = parent;
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const piling = MeshBuilder.CreateCylinder('pierPiling', { height: 2.4, diameter: 0.3, tessellation: 6 }, scene);
      const local = new Vector3(side * 2.2, -1.2, -8 + i * 5.3);
      const rotated = new Vector3(
        local.x * Math.cos(rotY) + local.z * Math.sin(rotY),
        local.y,
        -local.x * Math.sin(rotY) + local.z * Math.cos(rotY)
      );
      piling.position = pos.add(rotated);
      piling.material = mat;
      piling.parent = parent;
    }
  }
}

const BUILDING_PALETTE: [Color3, Color3][] = [
  [new Color3(0.92, 0.74, 0.55), new Color3(0.75, 0.3, 0.26)], // terracotta / tetto rosso
  [new Color3(0.95, 0.92, 0.82), new Color3(0.35, 0.55, 0.68)], // bianco / tetto blu
  [new Color3(0.93, 0.78, 0.42), new Color3(0.6, 0.28, 0.22)], // ocra / tetto mattone
  [new Color3(0.96, 0.82, 0.8), new Color3(0.4, 0.42, 0.46)], // rosa pallido / tetto grigio
  [new Color3(0.88, 0.88, 0.9), new Color3(0.72, 0.32, 0.3)] // grigio chiaro / tetto rosso
];

function building(scene: Scene, pos: Vector3, parent: TransformNode, paletteIdx: number, w: number, h: number, d: number): void {
  const [wallColor, roofColor] = BUILDING_PALETTE[paletteIdx % BUILDING_PALETTE.length];
  const wallMat = new StandardMaterial('buildingMat', scene);
  wallMat.diffuseColor = wallColor;
  const box = MeshBuilder.CreateBox('building', { width: w, height: h, depth: d }, scene);
  box.position = pos.add(new Vector3(0, h / 2, 0));
  box.material = wallMat;
  box.parent = parent;

  const roofMat = new StandardMaterial('roofMat', scene);
  roofMat.diffuseColor = roofColor;
  const roof = MeshBuilder.CreateBox('roof', { width: w + 0.6, height: 0.9, depth: d + 0.6 }, scene);
  roof.position = box.position.add(new Vector3(0, h / 2 + 0.45, 0));
  roof.material = roofMat;
  roof.parent = parent;

  // Finestrelle: piccoli riquadri scuri, giusto per rompere la superficie piatta.
  const winMat = new StandardMaterial('windowMat', scene);
  winMat.diffuseColor = new Color3(0.15, 0.2, 0.26);
  winMat.emissiveColor = new Color3(0.08, 0.1, 0.13);
  const rows = h > 7 ? 2 : 1;
  for (let row = 0; row < rows; row++) {
    for (const wx of [-w * 0.25, w * 0.25]) {
      const win = MeshBuilder.CreateBox('window', { width: w * 0.22, height: 0.7, depth: 0.05 }, scene);
      win.position = box.position.add(new Vector3(wx, h * 0.2 + row * 1.6 - h * 0.1, d / 2 + 0.03));
      win.material = winMat;
      win.parent = parent;
    }
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

  // Vegetazione: palme + cespugli alternati, più fitta di prima.
  for (let i = 0; i < slices; i += 11) {
    const s = (i / slices) * spline.totalLength;
    const pos = spline.positionAt(s);
    const right = spline.rightAt(s);
    const half = spline.widthAt(s) / 2;
    const side = i % 22 === 0 ? -1 : 1;
    const off = half + 5.5 + Math.random() * 6;
    if (i % 33 < 11) {
      palmTree(scene, pos.add(right.scale(side * off)), parent, 0.85 + Math.random() * 0.45);
    } else {
      bush(scene, pos.add(right.scale(side * off * 0.7)), parent, 0.8 + Math.random() * 0.5);
    }
  }

  // Lampioni lungo la pista, passo regolare, lato alternato.
  for (let i = 0; i < slices; i += 26) {
    const s = (i / slices) * spline.totalLength;
    const pos = spline.positionAt(s);
    const right = spline.rightAt(s);
    const half = spline.widthAt(s) / 2;
    const side = i % 52 === 0 ? -1 : 1;
    lampPost(scene, pos.add(right.scale(side * (half + 2.2))), parent);
  }

  // Edifici mediterranei colorati, molti di più e più vicini alla pista.
  const buildingSpots = [0.015, 0.06, 0.47, 0.5, 0.53, 0.56, 0.7, 0.73, 0.93, 0.965];
  buildingSpots.forEach((f, idx) => {
    const s = f * spline.totalLength;
    const pos = spline.positionAt(s);
    const right = spline.rightAt(s);
    const half = spline.widthAt(s) / 2;
    const bx = pos.add(right.scale(-(half + 12 + Math.random() * 4)));
    const w = 7 + Math.random() * 5;
    const h = 5 + Math.random() * 6;
    const d = 7 + Math.random() * 3;
    building(scene, bx, parent, idx, w, h, d);
  });

  // Chioschi con le insegne inside-joke, sui rettilinei.
  const kioskSpots: [number, string, number][] = [
    [0.09, 'GUSTO', 0],
    [0.46, 'GRANITA', 1],
    [0.6, 'KEBAB', 2],
    [0.75, 'CASA DI CARBO', 0]
  ];
  for (const [f, label, stripeIdx] of kioskSpots) {
    const s = f * spline.totalLength;
    const pos = spline.positionAt(s);
    const right = spline.rightAt(s);
    const half = spline.widthAt(s) / 2;
    kiosk(scene, pos.add(right.scale(half + 4.5)), parent, label, stripeIdx);
  }

  // Cartelli stradali sparsi (nomi delle località + un'insegna assurda).
  const signSpots: [number, string][] = [
    [0.2, 'NETTUNO'],
    [0.38, 'ANZIO'],
    [0.63, 'LIDL →']
  ];
  for (const [f, label] of signSpots) {
    const s = f * spline.totalLength;
    const pos = spline.positionAt(s);
    const right = spline.rightAt(s);
    const half = spline.widthAt(s) / 2;
    const side = Math.random() < 0.5 ? -1 : 1;
    signpost(scene, pos.add(right.scale(side * (half + 3))), parent, label, '#0b3d2e', '#ffffff');
  }

  // Piccolo porticciolo sul rettilineo veloce: molo + un paio di barche.
  {
    const s = 0.33 * spline.totalLength;
    const pos = spline.positionAt(s);
    const right = spline.rightAt(s);
    const tangentAngle = spline.tangentAngleAt(s);
    const half = spline.widthAt(s) / 2;
    const dockPos = pos.add(right.scale(-(half + 20)));
    pier(scene, dockPos, tangentAngle, parent);
    boat(scene, dockPos.add(right.scale(-9)).add(new Vector3(0, 0, 3)), tangentAngle + 0.3, parent, new Color3(0.85, 0.25, 0.25));
    boat(scene, dockPos.add(right.scale(-9)).add(new Vector3(0, 0, -4)), tangentAngle - 0.2, parent, new Color3(0.2, 0.4, 0.75));
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

