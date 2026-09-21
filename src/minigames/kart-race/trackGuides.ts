import { Color3, DynamicTexture, Matrix, Mesh, MeshBuilder, Quaternion, StandardMaterial, TransformNode, Vector3 } from '@babylonjs/core';
import type { Scene } from '@babylonjs/core';
import { buildCheckpoints } from './track';
import type { TrackSpline } from './track';

/**
 * SEGNALI DI PISTA: un giocatore nuovo deve capire subito dove andare.
 *  - le curve importanti si trovano NUMERICAMENTE dalla spline (curvatura + angolo totale), non a mano
 *  - prima di ogni curva: cartello gigante sul lato ESTERNO con la freccia (giallo; rosso e "STRETTA" se e' un tornante),
 *    doppia freccia dipinta sull'asfalto, e chevron lungo la curva
 *  - portali azzurri ai checkpoint (il traguardo ha gia' il suo rosso)
 * Nessuna modifica alla fisica o alla geometria della pista: sono solo elementi visivi.
 */

export interface CurveInfo {
  s0: number; // inizio curva (m lungo il giro)
  sApex: number;
  s1: number;
  dir: 1 | -1; // 1 = a destra, -1 = a sinistra
  angle: number; // angolo totale percorso in curva (rad, positivo)
}

/** Trova le curve importanti: curvatura media > soglia con lo stesso segno e angolo complessivo > ~32 gradi. */
export function detectCurves(spline: TrackSpline): CurveInfo[] {
  const L = spline.totalLength;
  const ds = 4;
  const n = Math.floor(L / ds);
  const kappa: number[] = [];
  for (let i = 0; i < n; i++) {
    let d = spline.tangentAngleAt((i + 1) * ds) - spline.tangentAngleAt(i * ds);
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    kappa.push(d / ds); // > 0: la pista gira a destra
  }
  const sm = kappa.map((_, i) => {
    let sum = 0;
    for (let k = -3; k <= 3; k++) sum += kappa[(i + k + n) % n];
    return sum / 7;
  });
  const TH = 0.006; // rad/m: raggio < ~165 m
  const start = Math.max(0, sm.findIndex((k) => Math.abs(k) < TH));
  const out: CurveInfo[] = [];
  let cur: { i0: number; i1: number; dir: 1 | -1; ang: number; apex: number; maxK: number } | null = null;
  const close = (): void => {
    if (cur && Math.abs(cur.ang) > 0.55) out.push({ s0: cur.i0 * ds, s1: (cur.i1 + 1) * ds, sApex: cur.apex * ds, dir: cur.dir, angle: Math.abs(cur.ang) });
    cur = null;
  };
  for (let step = 1; step <= n; step++) {
    const i = (start + step) % n;
    const k = sm[i];
    const over = Math.abs(k) >= TH;
    const dir: 1 | -1 = k > 0 ? 1 : -1;
    if (over && cur && cur.dir !== dir) close();
    if (over) {
      if (!cur) cur = { i0: i, i1: i, dir, ang: 0, apex: i, maxK: 0 };
      cur.i1 = i;
      cur.ang += k * ds;
      if (Math.abs(k) > cur.maxK) {
        cur.maxK = Math.abs(k);
        cur.apex = i;
      }
    } else close();
  }
  close();
  return out;
}

// ---------------------------------------------------------------- texture

function tex(scene: Scene, w: number, h: number, draw: (c: CanvasRenderingContext2D) => void): DynamicTexture {
  const t = new DynamicTexture('guideTex', { width: w, height: h }, scene, false);
  draw(t.getContext() as unknown as CanvasRenderingContext2D);
  t.hasAlpha = true;
  t.update();
  return t;
}

/** Freccia "curva a destra" (per la sinistra si specchia). */
function bentArrow(c: CanvasRenderingContext2D, fg: string): void {
  c.fillStyle = fg;
  c.beginPath();
  c.moveTo(-50, 62);
  c.lineTo(-50, -8);
  c.quadraticCurveTo(-50, -40, -18, -40);
  c.lineTo(20, -40);
  c.lineTo(20, -62);
  c.lineTo(68, -28);
  c.lineTo(20, 6);
  c.lineTo(20, -16);
  c.lineTo(-10, -16);
  c.quadraticCurveTo(-26, -16, -26, 0);
  c.lineTo(-26, 62);
  c.closePath();
  c.fill();
}

function boardTexture(scene: Scene, dir: 1 | -1, tight: boolean): DynamicTexture {
  return tex(scene, 256, 192, (c) => {
    const bg = tight ? '#dc2626' : '#facc15';
    const fg = tight ? '#ffffff' : '#111827';
    c.fillStyle = bg;
    c.fillRect(0, 0, 256, 192);
    c.strokeStyle = fg;
    c.lineWidth = 10;
    c.strokeRect(6, 6, 244, 180);
    c.save();
    c.translate(128, tight ? 88 : 96);
    c.scale(dir, 1);
    bentArrow(c, fg);
    c.restore();
    if (tight) {
      c.fillStyle = fg;
      c.font = '900 30px "Arial Black", Arial';
      c.textAlign = 'center';
      c.fillText('STRETTA!', 128, 176);
    }
  });
}

function chevronTexture(scene: Scene, dir: 1 | -1): DynamicTexture {
  return tex(scene, 128, 128, (c) => {
    c.fillStyle = '#111827';
    c.fillRect(0, 0, 128, 128);
    c.fillStyle = '#facc15';
    c.fillRect(6, 6, 116, 116);
    c.save();
    c.translate(64, 64);
    c.scale(dir, 1);
    c.fillStyle = '#111827';
    for (const dx of [-20, 18]) {
      c.beginPath();
      c.moveTo(dx - 16, -46);
      c.lineTo(dx + 12, 0);
      c.lineTo(dx - 16, 46);
      c.lineTo(dx - 30, 46);
      c.lineTo(dx - 2, 0);
      c.lineTo(dx - 30, -46);
      c.closePath();
      c.fill();
    }
    c.restore();
  });
}

/** Doppio chevron dipinto sull'asfalto (immagine trasparente); dir>0 inclina verso destra. */
function roadArrowTexture(scene: Scene, dir: 1 | -1): DynamicTexture {
  return tex(scene, 128, 256, (c) => {
    c.clearRect(0, 0, 128, 256);
    c.save();
    c.translate(64, 128);
    c.rotate(dir * 0.3);
    for (const dy of [-46, 34]) {
      c.beginPath();
      c.moveTo(-44, dy + 40);
      c.lineTo(0, dy - 4);
      c.lineTo(44, dy + 40);
      c.lineTo(44, dy + 62);
      c.lineTo(0, dy + 18);
      c.lineTo(-44, dy + 62);
      c.closePath();
      c.fillStyle = 'rgba(255,255,255,0.95)';
      c.fill();
      c.strokeStyle = 'rgba(20,20,20,0.75)';
      c.lineWidth = 5;
      c.stroke();
    }
    c.restore();
  });
}

// ---------------------------------------------------------------- costruzione

export function buildTrackGuides(scene: Scene, spline: TrackSpline): TransformNode {
  const root = new TransformNode('trackGuides', scene);
  const mats = new Map<string, StandardMaterial>();
  const board = (key: string, make: () => DynamicTexture): StandardMaterial => {
    let m = mats.get(key);
    if (!m) {
      const t = make();
      m = new StandardMaterial(`guideMat_${key}`, scene);
      m.diffuseTexture = t;
      m.emissiveTexture = t;
      m.opacityTexture = t;
      m.disableLighting = true;
      m.backFaceCulling = false;
      mats.set(key, m);
    }
    return m;
  };
  const postMat = new StandardMaterial('guidePostMat', scene);
  postMat.diffuseColor = new Color3(0.25, 0.26, 0.3);

  const place = (s: number, side: number, extra: number): Vector3 => {
    const pos = spline.positionAt(s);
    const half = spline.widthAt(s) / 2;
    return pos.add(spline.rightAt(s).scale(side * (half + extra)));
  };

  const standingBoard = (s: number, side: number, key: string, make: () => DynamicTexture, w: number, h: number, poleH: number): void => {
    const base = place(s, side, 2.6);
    const post = MeshBuilder.CreateCylinder('guidePost', { height: poleH, diameter: 0.14, tessellation: 6 }, scene);
    post.position = base.add(new Vector3(0, poleH / 2, 0));
    post.material = postMat;
    post.parent = root;
    post.isPickable = false;
    const plane = MeshBuilder.CreatePlane('guideBoard', { width: w, height: h }, scene);
    plane.position = base.add(new Vector3(0, poleH + h / 2 - 0.15, 0));
    // il fronte del cartello guarda chi arriva (il kart avanza lungo +tangente)
    plane.rotation.y = spline.tangentAngleAt(s);
    plane.material = board(key, make);
    plane.parent = root;
    plane.isPickable = false;
  };

  for (const curve of detectCurves(spline)) {
    const tight = curve.angle > 1.5; // tornante: piu' di ~85 gradi
    const dirKey = curve.dir > 0 ? 'R' : 'L';
    const outside = -curve.dir; // il cartello sta sul lato ESTERNO della curva
    // 1) cartello grande di avvicinamento, ~55 m prima
    const sSign = spline.wrap(curve.s0 - 55);
    standingBoard(sSign, outside, `board${dirKey}${tight ? 'T' : ''}`, () => boardTexture(scene, curve.dir, tight), 4.2, 3.15, 2.6);
    // 2) frecce dipinte sull'asfalto, 34 e 16 m prima
    for (const back of [34, 16]) {
      const s = spline.wrap(curve.s0 - back);
      const t = spline.tangentAt(s);
      const r = spline.rightAt(s);
      const u = Vector3.Cross(t, r).normalize();
      const basis = Matrix.Identity();
      Matrix.FromXYZAxesToRef(r, u, t, basis);
      const q = Quaternion.FromRotationMatrix(basis);
      const g = MeshBuilder.CreateGround('roadArrow', { width: 5.2, height: 8.6 }, scene);
      g.position = spline.worldPoint(s, 0, 0.09);
      g.rotationQuaternion = q;
      const m = board(`road${dirKey}`, () => roadArrowTexture(scene, curve.dir));
      m.zOffset = -3;
      g.material = m;
      g.parent = root;
      g.isPickable = false;
    }
    // 3) chevron lungo la curva, sempre sul lato esterno
    const span = Math.max(20, curve.s1 - curve.s0);
    const count = Math.min(5, Math.max(3, Math.round(span / 22)));
    for (let i = 0; i < count; i++) {
      const s = spline.wrap(curve.s0 + (span * (i + 0.5)) / count);
      standingBoard(s, outside, `chev${dirKey}`, () => chevronTexture(scene, curve.dir), 2.2, 2.2, 1.0);
    }
  }

  // portali dei checkpoint (il numero 0 e' il traguardo, gia' con il suo cancello rosso)
  const cps = buildCheckpoints(spline);
  const gateMat = new StandardMaterial('cpGateMat', scene);
  gateMat.emissiveColor = new Color3(0.2, 0.85, 1);
  gateMat.diffuseColor = new Color3(0, 0, 0);
  gateMat.disableLighting = true;
  gateMat.alpha = 0.85;
  for (let i = 1; i < cps.length; i++) {
    const s = cps[i];
    const half = spline.widthAt(s) / 2 + 3.6; // pali OLTRE le barriere: fuori pista la camera non ci finisce dentro
    const pos = spline.positionAt(s);
    const right = spline.rightAt(s);
    const parts: Mesh[] = [];
    for (const side of [-1, 1]) {
      const post = MeshBuilder.CreateCylinder('cpPost', { height: 4.2, diameter: 0.28, tessellation: 8 }, scene);
      post.position = pos.add(right.scale(side * half)).add(new Vector3(0, 2.1, 0));
      parts.push(post);
    }
    const bar = MeshBuilder.CreateBox('cpBar', { width: half * 2, height: 0.3, depth: 0.3 }, scene);
    bar.position = pos.add(new Vector3(0, 4.2, 0));
    bar.rotation.y = spline.tangentAngleAt(s);
    parts.push(bar);
    const merged = Mesh.MergeMeshes(parts, true, false);
    if (merged) {
      merged.material = gateMat;
      merged.parent = root;
      merged.isPickable = false;
    }
  }
  return root;
}
