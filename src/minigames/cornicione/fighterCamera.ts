import { ArcRotateCamera, Matrix, Scene, Vector3 } from '@babylonjs/core';

/** Chi la camera deve tenere in quadro (solo posizione). */
export interface CamSubject {
  x: number;
  y: number;
  /** in gioco e visibile (non in pausa di respawn, non eliminato) */
  active: boolean;
}

/**
 * Camera CONDIVISA di BOTTE SUL CORNICIONE. Una sola camera laterale che segue il centro dei giocatori vivi e allarga/stringe lo zoom:
 * vicini = piu' vicino, lontani = piu' largo. Non insegue MAI un singolo giocatore fuori dal palco: il centro e' limitato e lo zoom ha un
 * massimo, cosi' il palco e la zona di recupero restano sempre in quadro; chi vola oltre ha il suo indicatore sul bordo (fighterHud).
 * I KO avvengono MOLTO oltre l'inquadratura (fighterData.KO): uscire dal centro visivo non e' essere gia' morti.
 */
export const CAM = {
  /** mezzo campo visivo minimo (m): palco (13) + margine di recupero */
  minHalfW: 14,
  maxHalfW: 30,
  minHalfH: 8,
  maxHalfH: 19,
  /** il centro non si allontana mai di piu' dal palco */
  maxCenterX: 9,
  minCenterY: 2.5,
  maxCenterY: 9.5,
  /** chi e' piu' lontano di questo non fa piu' muovere la camera (vola verso il KO) */
  followX: 26,
  followYMin: -12,
  followYMax: 20,
  fov: 0.8,
  tilt: 0.07
} as const;

export class FighterCamera {
  readonly camera: ArcRotateCamera;
  private shakeUntil = 0;
  private shakeAmp = 0;
  private hw: number = CAM.minHalfW;
  private hh: number = CAM.minHalfH;
  private cx = 0;
  private cy = 5;
  private scene: Scene;

  constructor(scene: Scene, canvas: HTMLCanvasElement) {
    this.scene = scene;
    this.camera = new ArcRotateCamera('fighterCam', -Math.PI / 2, Math.PI / 2 - CAM.tilt, 24, new Vector3(0, 5, 0), scene);
    this.camera.fov = CAM.fov;
    this.camera.minZ = 0.1;
    this.camera.maxZ = 2500;
    this.camera.lowerRadiusLimit = 10;
    this.camera.upperRadiusLimit = 90;
    this.camera.lowerBetaLimit = 0.5;
    this.camera.upperBetaLimit = 1.7;
    this.camera.inputs.clear(); // nessun input: e' una camera da regia
    this.camera.attachControl(canvas, false);
    scene.activeCamera = this.camera;
    this.snap();
  }

  private snap(): void {
    this.camera.target.set(this.cx, this.cy, 0);
    this.camera.radius = this.radiusFor(this.hw, this.hh);
  }

  private aspect(): number {
    const e = this.scene.getEngine();
    return Math.max(0.5, e.getRenderWidth() / Math.max(1, e.getRenderHeight()));
  }

  private radiusFor(hw: number, hh: number): number {
    const t = Math.tan(CAM.fov / 2);
    return Math.max(hw / (t * this.aspect()), hh / t);
  }

  /** Mezzo campo visibile (m) alla profondita' dei personaggi: serve all'indicatore fuori schermo e ai test. */
  get view(): { cx: number; cy: number; hw: number; hh: number } {
    const t = Math.tan(CAM.fov / 2);
    const r = this.camera.radius;
    return { cx: this.camera.target.x, cy: this.camera.target.y, hw: r * t * this.aspect(), hh: r * t };
  }

  shake(amp: number, ms = 150): void {
    this.shakeAmp = Math.max(this.shakeAmp, amp);
    this.shakeUntil = performance.now() + ms;
  }

  update(dt: number, subjects: CamSubject[], now: number): void {
    const pts = subjects.filter((s) => s.active && Math.abs(s.x) <= CAM.followX && s.y >= CAM.followYMin && s.y <= CAM.followYMax);
    if (pts.length > 0) {
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      for (const p of pts) {
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
      }
      const tx = Math.max(-CAM.maxCenterX, Math.min(CAM.maxCenterX, (minX + maxX) / 2));
      const ty = Math.max(CAM.minCenterY, Math.min(CAM.maxCenterY, (minY + maxY) / 2 + 1.5));
      const tw = Math.max(CAM.minHalfW, Math.min(CAM.maxHalfW, (maxX - minX) / 2 + 6.5));
      const th = Math.max(CAM.minHalfH, Math.min(CAM.maxHalfH, (maxY - minY) / 2 + 4.5));
      const kp = Math.min(1, dt * 3.2);
      this.cx += (tx - this.cx) * kp;
      this.cy += (ty - this.cy) * kp;
      // allarga in fretta (nessuno deve uscire dal quadro), stringe piano
      this.hw += (tw - this.hw) * Math.min(1, dt * (tw > this.hw ? 5 : 1.8));
      this.hh += (th - this.hh) * Math.min(1, dt * (th > this.hh ? 5 : 1.8));
    }
    let ox = 0;
    let oy = 0;
    if (now < this.shakeUntil) {
      ox = (Math.random() - 0.5) * this.shakeAmp;
      oy = (Math.random() - 0.5) * this.shakeAmp;
    } else this.shakeAmp = 0;
    this.camera.target.set(this.cx + ox, this.cy + oy, 0);
    this.camera.radius = this.radiusFor(this.hw, this.hh);
  }

  /** Posizione sullo schermo (0..1, y verso il basso) di un punto del mondo. */
  project(x: number, y: number, z = 0): { nx: number; ny: number } {
    const e = this.scene.getEngine();
    const w = e.getRenderWidth();
    const h = e.getRenderHeight();
    const p = Vector3.Project(new Vector3(x, y, z), Matrix.IdentityReadOnly, this.scene.getTransformMatrix(), this.camera.viewport.toGlobal(w, h));
    return { nx: p.x / w, ny: p.y / h };
  }

  dispose(): void {
    this.camera.dispose();
  }
}
