import { Scene, Mesh, MeshBuilder, StandardMaterial, Color3 } from '@babylonjs/core';

/**
 * Effetti di contatto a terra condivisi da arena / dodgeball / calcio. Sono pool creati una volta sola: nessuna
 * allocazione durante la partita e nessun costo quando non c'e' niente da mostrare.
 */

const SHOCK_TIME = 0.4;

/** Onde d'urto: anelli che si allargano e sfumano nel punto di un colpo, del colore del giocatore colpito. */
export class ShockRings {
  private rings: { mesh: Mesh; t: number; size: number }[] = [];

  constructor(scene: Scene, count = 4) {
    for (let i = 0; i < count; i++) {
      const mesh = MeshBuilder.CreateTorus('shockRing', { diameter: 2, thickness: 0.16, tessellation: 28 }, scene);
      const mat = new StandardMaterial('shockRingMat', scene);
      mat.disableLighting = true;
      mat.emissiveColor = new Color3(1, 1, 1);
      mesh.material = mat;
      mesh.isPickable = false;
      mesh.isVisible = false;
      this.rings.push({ mesh, t: SHOCK_TIME, size: 1 });
    }
  }

  /** `size` 1 = onda media (raggio finale ~1.9 unita'); il colore e' mescolato col bianco per leggersi anche se scuro. */
  spawn(x: number, z: number, colorHex: string, size = 1): void {
    const r = this.rings.find((k) => k.t >= SHOCK_TIME) ?? this.rings[0];
    if (!r) return;
    r.t = 0;
    r.size = size;
    r.mesh.position.set(x, 0.12, z);
    const c = Color3.FromHexString(colorHex);
    (r.mesh.material as StandardMaterial).emissiveColor.set(0.4 + c.r * 0.6, 0.4 + c.g * 0.6, 0.4 + c.b * 0.6);
    r.mesh.scaling.set(0.5 * size, 1, 0.5 * size);
    r.mesh.visibility = 0.9;
    r.mesh.isVisible = true;
  }

  update(dt: number): void {
    for (const r of this.rings) {
      if (r.t >= SHOCK_TIME) {
        if (r.mesh.isVisible) r.mesh.isVisible = false;
        continue;
      }
      r.t += dt;
      const k = Math.min(1, r.t / SHOCK_TIME);
      const sc = (0.5 + k * 3.4) * r.size;
      r.mesh.scaling.set(sc, 1, sc);
      r.mesh.visibility = 0.9 * (1 - k);
    }
  }
}

/** Anelli pulsanti a terra sotto un giocatore (uno per giocatore): pericolo bordo, area di presa, ecc. */
export class GroundMarkers {
  private meshes: Mesh[] = [];

  constructor(scene: Scene, count: number, diameter: number, rgb: [number, number, number]) {
    const mat = new StandardMaterial('groundMarkerMat', scene);
    mat.disableLighting = true;
    mat.emissiveColor = new Color3(rgb[0], rgb[1], rgb[2]);
    mat.alpha = 0.9;
    for (let i = 0; i < count; i++) {
      const m = MeshBuilder.CreateTorus('groundMarker', { diameter, thickness: 0.14, tessellation: 32 }, scene);
      m.material = mat;
      m.isPickable = false;
      m.isVisible = false;
      this.meshes.push(m);
    }
  }

  show(i: number, x: number, z: number, now: number): void {
    const m = this.meshes[i];
    if (!m) return;
    m.position.set(x, 0.08, z);
    const k = 1 + Math.sin(now * 0.014) * 0.12;
    m.scaling.set(k, 1, k);
    if (!m.isVisible) m.isVisible = true;
  }

  hide(i: number): void {
    const m = this.meshes[i];
    if (m && m.isVisible) m.isVisible = false;
  }
}
