import { ArcRotateCamera, Scene, Vector3 } from '@babylonjs/core';

/** Sottoinsieme di stato letto dalla camera (condiviso tra minigiochi 3D). */
export interface CameraSubject {
  alive: boolean;
  falling: boolean;
  x: number;
  z: number;
}

/**
 * Camera condivisa: una sola vista, inclinata, centrata sul gruppo di giocatori
 * ancora in gara. Zooma se si allargano, stringe se si avvicinano, senza
 * scatti (lerp smussato). Nessun input utente: è una camera "da regia".
 */
export class ArenaCamera {
  private camera: ArcRotateCamera;
  private shakeUntil = 0;
  private shakeAmp = 0;

  constructor(scene: Scene, canvas: HTMLCanvasElement) {
    this.camera = new ArcRotateCamera('arenaCam', -Math.PI / 2, 1.12, 24, new Vector3(0, 1.2, 0), scene);
    this.camera.lowerRadiusLimit = 14;
    this.camera.upperRadiusLimit = 42;
    this.camera.lowerBetaLimit = 0.75;
    this.camera.upperBetaLimit = 1.3;
    this.camera.minZ = 0.1;
    this.camera.maxZ = 2500;
    // Nessun input mouse/touch: l'inquadratura è automatica.
    this.camera.inputs.clear();
    this.camera.attachControl(canvas, false);
    scene.activeCamera = this.camera;
  }

  /** Piccolo shake da impatto (ampiezza in unità mondo). */
  shake(amp: number, ms = 180): void {
    this.shakeAmp = Math.max(this.shakeAmp, amp);
    this.shakeUntil = performance.now() + ms;
  }

  update(dt: number, players: CameraSubject[], now: number): void {
    const alive = players.filter((p) => p.alive && !p.falling);
    const src = alive.length > 0 ? alive : players;

    let cx = 0;
    let cz = 0;
    for (const p of src) {
      cx += p.x;
      cz += p.z;
    }
    cx /= Math.max(1, src.length);
    cz /= Math.max(1, src.length);

    let spread = 0;
    for (const p of src) {
      spread = Math.max(spread, Math.hypot(p.x - cx, p.z - cz));
    }

    // Raggio dinamico: abbastanza largo da inquadrare tutti + margine.
    const targetRadius = Math.max(16, Math.min(34, spread * 2.1 + 12));
    const k = Math.min(1, dt * 4);
    this.camera.target.x += (cx - this.camera.target.x) * k;
    this.camera.target.z += (cz - this.camera.target.z) * k;
    this.camera.target.y += (1.2 - this.camera.target.y) * k;
    this.camera.radius += (targetRadius - this.camera.radius) * k;

    // Shake leggero
    let ox = 0;
    let oy = 0;
    if (now < this.shakeUntil) {
      ox = (Math.random() - 0.5) * this.shakeAmp;
      oy = (Math.random() - 0.5) * this.shakeAmp;
    }
    this.camera.target.x += ox;
    this.camera.target.y += oy;
  }

  dispose(): void {
    this.camera.dispose();
  }
}
