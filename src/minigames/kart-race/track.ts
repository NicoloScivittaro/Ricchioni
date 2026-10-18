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
import {TRACK_RAMPS,EXPRESS,SWEEPER_AT,expressLateral,sweeperLateral} from './trackDynamics';

/** Coastal circuit 2.0: 25 ordered control points retain the original closed-spline race.
 * Two elevated promenades, a port descent and the paddock S add length and distinct driving phases.
 * Widths follow the original Catmull parameter when resampled by arc length; road, items,
 * barriers and karts share the same banked frame. Non-adjacent ribbons are checked by selftest.
 */
export const CONTROL_POINTS: [number, number, number][] = [
 [170,0,0],[178,0,45],[184,1,95],[169,4,148],[130,8,188],
 [72,11,211],[10,12,212],[-48,11,207],[-100,7,198],[-145,3,165],
 [-170,1,120],[-203,0,75],[-221,0,20],[-213,0,-40],[-180,2,-86],
 [-155,6,-120],[-112,10,-155],[-63,12,-176],[-8,10,-184],[38,7,-174],
 [62,4,-142],[108,2,-149],[148,1,-116],[150,.5,-72],[172,0,-36]
];
const CONTROL_WIDTHS = [20,20,22,22,21,20,19,18,18,17,16,18,20,21,23,24,23,22,23,25,24,20,17,16,18];

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

  constructor(controlPoints: Vector3[], controlWidths: number[], rawResolution = 3000, ramps = false) {
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
    if(ramps){
      const initialLength=cumLen[cumLen.length-1];
      for(let i=0;i<rawPositions.length;i++)for(const ramp of TRACK_RAMPS){
        const d=cumLen[i]-ramp.at*initialLength;
        if(d>=-14&&d<=7){const t=d<=0?(d+14)/14:1-d/7;rawPositions[i].y+=2.1*t*t*(3-2*t);}
      }
      for(let i=1;i<rawPositions.length;i++)cumLen[i]=cumLen[i-1]+Vector3.Distance(rawPositions[i-1],rawPositions[i]);
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
      this.samples.push({ pos, tangent: Vector3.Zero(), right: Vector3.Zero(), up: Vector3.Up(), width: (()=>{const f=(rawIdx+localT)/rawResolution*n,j=Math.floor(f)%n,u=f-Math.floor(f),q=u*u*(3-2*u);return controlWidths[j]*(1-q)+controlWidths[(j+1)%n]*q;})() });
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
    // Gentle banking from local curvature, same frame for road, kart, items and barriers.
    for(let i=0;i<sampleCount;i++){
      const p=this.samples[(i-4+sampleCount)%sampleCount].tangent;
      const q=this.samples[(i+4)%sampleCount].tangent;
      const turn=Math.atan2(p.z*q.x-p.x*q.z,p.x*q.x+p.z*q.z);
      const bank=Math.max(-.14,Math.min(.14,turn*.8));
      const frame=this.samples[i],right=frame.right,up=frame.up;
      frame.right=right.scale(Math.cos(bank)).add(up.scale(Math.sin(bank))).normalize();
      frame.up=Vector3.Cross(frame.tangent,frame.right).normalize();
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

  /** Bots choose a lane through the same steering input as players, never teleport. */
  botLateralAt(distance:number,id:string,time:number):number {
    const f=this.wrap(distance)/this.totalLength,lead=40/this.totalLength;
    if(f>=EXPRESS[0]-lead && f<=EXPRESS[1])return id.charCodeAt(id.length-1)%2?expressLateral(this.widthAt(distance)):this.widthAt(distance)*.25;
    if(f>=SWEEPER_AT-lead && f<=SWEEPER_AT+.012)return sweeperLateral(time+.7,this.widthAt(distance))>0?-this.widthAt(distance)*.27:this.widthAt(distance)*.27;
    return 0;
  }

  get sampleCount(): number {
    return this.samples.length;
  }
}

export function buildTrack(): TrackSpline {
  const pts = CONTROL_POINTS.map(([x, y, z]) => new Vector3(x, y, z));
  return new TrackSpline(pts, CONTROL_WIDTHS,3000,true);
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

/** Costruisce le mesh della PISTA: strada, cordoli, muretti, portale di partenza. Il mondo intorno (settori, landmark) e' in kartEnvironment.ts. */
export function buildTrackVisuals(scene: Scene, spline: TrackSpline): TrackVisuals {
  const root = new TransformNode('trackRoot', scene);
  const road = buildRibbon(scene, spline, root);
  buildBarriers(scene, spline, root);
  buildStartGate(scene, spline, root);
  buildDeck(scene,spline,root);
  for(const m of root.getChildMeshes()){m.isPickable=false;m.freezeWorldMatrix();}
  return { root, road };
}

function buildRibbon(scene: Scene, spline: TrackSpline, parent: TransformNode): Mesh {
  const slices = spline.sampleCount;
  const positions: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const asphaltA = [0.29, 0.3, 0.34];
  const asphaltB = [0.26, 0.27, 0.31];
  const curbRed = [0.85, 0.16, 0.16];
  const curbWhite = [0.92, 0.92, 0.9];
  const laneYellow = [0.95, 0.78, 0.15];

  // Sei vertici per fetta: [bordo sx | fine cordolo sx] [inizio asfalto sx | inizio asfalto dx] [fine cordolo dx | bordo dx].
  // I vertici a cavallo tra cordolo e asfalto sono doppi, cosi' i colori restano netti (prima il cordolo copriva tutta la strada).
  const VERTS = 6;
  for (let i = 0; i <= slices; i++) {
    const idx = i % slices;
    const s = (idx / slices) * spline.totalLength;
    const pos = spline.positionAt(s);
    const right = spline.rightAt(s);
    const half = spline.widthAt(s) / 2;
    const cw = Math.min(1.1, half * 0.22); // larghezza del cordolo
    const pl = pos.add(right.scale(-half));
    const pli = pos.add(right.scale(-half + cw));
    const pri = pos.add(right.scale(half - cw));
    const pr = pos.add(right.scale(half));
    positions.push(pl.x, pl.y, pl.z, pli.x, pli.y, pli.z, pli.x, pli.y, pli.z, pri.x, pri.y, pri.z, pri.x, pri.y, pri.z, pr.x, pr.y, pr.z);

    for(const u of [0,.06,.06,.94,.94,1])uvs.push(u,(i/slices)*spline.totalLength/18);

    // Asfalto a bande leggere + un po' di rumore (segni di gomme/usura); cordoli alternati rosso/bianco.
    const stripe = Math.floor(idx / 6) % 2 === 0 ? asphaltA : asphaltB;
    const noise = Math.abs(Math.sin(idx * 12.9898) * 43758.5453) % 1;
    const noise2 = Math.abs(Math.sin(idx * 78.233) * 12543.61) % 1;
    const wearL = 1 + (noise - 0.5) * 0.16;
    const wearR = 1 + (noise2 - 0.5) * 0.16;
    const curb = Math.floor(idx / 5) % 2 === 0 ? curbRed : curbWhite;
    const c4 = (c: number[], k = 1): number[] => [c[0] * k, c[1] * k, c[2] * k, 1];
    colors.push(
      ...c4(curb), ...c4(curb), // cordolo sinistro
      ...c4(stripe, wearL), ...c4(stripe, wearR), // asfalto
      ...c4(curb), ...c4(curb) // cordolo destro
    );
  }

  for (let i = 0; i < slices; i++) {
    const base = i * VERTS;
    const next = (i + 1) * VERTS;
    for (const [l, r] of [[0, 1], [2, 3], [4, 5]] as const) {
      indices.push(base + l, next + l, base + r, base + r, next + l, next + r);
    }
  }

  const mesh = new Mesh('road', scene);
  const vertexData = new VertexData();
  vertexData.positions = positions;
  vertexData.indices = indices;
  vertexData.colors = colors;
  vertexData.uvs = uvs;
  VertexData.ComputeNormals(positions, indices, (vertexData.normals = []));
  vertexData.applyToMesh(mesh);
  mesh.parent = parent;
  mesh.receiveShadows = true;

  const mat = new StandardMaterial('roadMat', scene);
  mat.specularColor = new Color3(0.05, 0.05, 0.06);
  mat.backFaceCulling = false;
  // le normali calcolate dal winding puntano verso il basso: senza questo la strada veniva illuminata come se fosse capovolta (nera)
  mat.twoSidedLighting = true;
  const grain=new DynamicTexture('coastalAsphalt',256,scene,false);
  const ctx=grain.getContext();ctx.fillStyle='#d3dae0';ctx.fillRect(0,0,256,256);
  for(let i=0;i<4500;i++){const x=(i*73.131)%256,y=(i*37.717)%256;ctx.fillStyle=i%2?'rgba(30,45,65,.12)':'rgba(255,255,255,.18)';ctx.fillRect(x,y,1.5,1.5);}
  grain.update();grain.wrapU=grain.wrapV=1;mat.diffuseTexture=grain;
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


function buildDeck(scene:Scene,spline:TrackSpline,parent:TransformNode):void {
 const positions:number[]=[],indices:number[]=[];let v=0;
 for(let s=0;s<spline.totalLength;s+=3){
  const end=Math.min(s+3,spline.totalLength);
  for(const side of [-1,1]){
   for(const d of [s,end]){const p=spline.worldPoint(d,side*spline.widthAt(d)/2);positions.push(p.x,p.y-.04,p.z,p.x,p.y-.85,p.z);}
   indices.push(v,v+1,v+2,v+1,v+3,v+2);v+=4;
  }
 }
 const mesh=new Mesh('viaductDeck',scene),vd=new VertexData();vd.positions=positions;vd.indices=indices;VertexData.ComputeNormals(positions,indices,vd.normals=[]);vd.applyToMesh(mesh);
 const mat=new StandardMaterial('deckConcrete',scene);mat.diffuseColor=Color3.FromHexString('#153449');mat.specularColor=Color3.Black();mat.backFaceCulling=false;mesh.material=mat;mesh.parent=parent;
}
