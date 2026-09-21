import { Scene, Mesh, MeshBuilder, StandardMaterial, Color3, Color4, ParticleSystem, Texture, Vector3 } from '@babylonjs/core';

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

/**
 * Scia luminosa dietro una palla (particelle additive che seguono la mesh). Nasce ferma (emitRate 0): chi la usa imposta
 * `emitRate` a ogni frame in base alla velocita'. Con la qualita' LOW le particelle sono spente dal preset (scene.particlesEnabled).
 */
export function makeBallTrail(scene: Scene, mesh: Mesh, tex: Texture, rgb: [number, number, number] = [1, 0.7, 0.35]): ParticleSystem {
  const ps = new ParticleSystem('ballTrail', 60, scene);
  ps.particleTexture = tex;
  ps.emitter = mesh;
  ps.minEmitBox = new Vector3(-0.08, -0.08, -0.08);
  ps.maxEmitBox = new Vector3(0.08, 0.08, 0.08);
  ps.color1 = new Color4(rgb[0], rgb[1], rgb[2], 0.9);
  ps.color2 = new Color4(rgb[0] * 0.85, rgb[1] * 0.85, rgb[2] * 0.85, 0.75);
  ps.colorDead = new Color4(rgb[0], rgb[1], rgb[2], 0);
  ps.minSize = 0.28;
  ps.maxSize = 0.55;
  ps.minLifeTime = 0.16;
  ps.maxLifeTime = 0.32;
  ps.emitRate = 0;
  ps.direction1 = new Vector3(-0.2, -0.05, -0.2);
  ps.direction2 = new Vector3(0.2, 0.15, 0.2);
  ps.minEmitPower = 0.1;
  ps.maxEmitPower = 0.5;
  ps.gravity = Vector3.Zero();
  ps.blendMode = ParticleSystem.BLENDMODE_ONEONE;
  ps.start();
  return ps;
}

/** Colora la scia col colore di un giocatore (mescolato un po' col bianco: si legge anche con i colori scuri). */
export function tintBallTrail(ps: ParticleSystem, colorHex: string): void {
  const c = Color3.FromHexString(colorHex);
  const r = 0.22 + c.r * 0.78;
  const g = 0.22 + c.g * 0.78;
  const b = 0.22 + c.b * 0.78;
  ps.color1.set(r, g, b, 0.9);
  ps.color2.set(r * 0.85, g * 0.85, b * 0.85, 0.75);
  ps.colorDead.set(r, g, b, 0);
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
