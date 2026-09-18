/**
 * CANTIERE DEL DISAGIO — mappa condivisa del minigioco FPS.
 * La stessa geometria è usata dall'HOST (collisioni + hitscan) e dai TELEFONI
 * (rendering): ostacoli come AABB, limiti mappa, spawn point.
 *
 * Convenzioni 3D (condivise con Babylon e col resto del progetto):
 *   piano X/Z (Y = alto), yaw = rotazione attorno a Y, forward = (sin(yaw), cos(yaw)).
 */

export interface Aabb {
  x: number; // centro X
  z: number; // centro Z
  w: number; // larghezza (X)
  d: number; // profondità (Z)
  h: number; // altezza (Y)
}

export interface FpsMap {
  name: string;
  halfSize: number; // limite quadrato della mappa (-halfSize..+halfSize)
  obstacles: Aabb[];
  spawns: { x: number; z: number }[];
}

export const FPS_MAP: FpsMap = {
  name: 'CANTIERE DEL DISAGIO',
  halfSize: 26,
  obstacles: [
    // Perimetro (muri bassi)
    { x: 0, z: -26, w: 54, d: 2, h: 4 },
    { x: 0, z: 26, w: 54, d: 2, h: 4 },
    { x: -26, z: 0, w: 2, d: 54, h: 4 },
    { x: 26, z: 0, w: 2, d: 54, h: 4 },
    // Area centrale rischiosa: container disposti a croce
    { x: 0, z: 0, w: 5, d: 5, h: 3 },
    { x: 8, z: 0, w: 4, d: 3, h: 3 },
    { x: -8, z: 0, w: 4, d: 3, h: 3 },
    { x: 0, z: 8, w: 3, d: 4, h: 3 },
    { x: 0, z: -8, w: 3, d: 4, h: 3 },
    // Corridoi laterali: casse e furgoni
    { x: 16, z: 10, w: 5, d: 5, h: 3 },
    { x: -16, z: 10, w: 5, d: 5, h: 3 },
    { x: 16, z: -10, w: 5, d: 5, h: 3 },
    { x: -16, z: -10, w: 5, d: 5, h: 3 },
    // Coperture sparse
    { x: 10, z: 16, w: 3, d: 2, h: 2 },
    { x: -10, z: 16, w: 3, d: 2, h: 2 },
    { x: 10, z: -16, w: 3, d: 2, h: 2 },
    { x: -10, z: -16, w: 3, d: 2, h: 2 },
    { x: 20, z: 0, w: 2, d: 6, h: 2.5 },
    { x: -20, z: 0, w: 2, d: 6, h: 2.5 }
  ],
  spawns: [
    { x: -20, z: -20 },
    { x: 20, z: -20 },
    { x: -20, z: 20 },
    { x: 20, z: 20 },
    { x: 0, z: -18 }
  ]
};

/** Overlap cerchio (giocatore) vs AABB (ostacolo) sul piano X/Z. Ritorna la spinta di risoluzione. */
export function circleVsAabb(px: number, pz: number, r: number, b: Aabb): { x: number; z: number } | null {
  const cx = Math.max(b.x - b.w / 2, Math.min(px, b.x + b.w / 2));
  const cz = Math.max(b.z - b.d / 2, Math.min(pz, b.z + b.d / 2));
  const dx = px - cx;
  const dz = pz - cz;
  const dist2 = dx * dx + dz * dz;
  if (dist2 >= r * r) return null;
  const dist = Math.sqrt(dist2) || 0.0001;
  const push = r - dist;
  return { x: (dx / dist) * push, z: (dz / dist) * push };
}

/** Risolve il movimento del giocatore contro tutti gli ostacoli (cerchio vs AABB). */
export function resolveCollisions(px: number, pz: number, r: number, obstacles: Aabb[]): { x: number; z: number } {
  let x = px;
  let z = pz;
  for (let iter = 0; iter < 2; iter++) {
    for (const b of obstacles) {
      const push = circleVsAabb(x, z, r, b);
      if (push) {
        x += push.x;
        z += push.z;
      }
    }
  }
  return { x, z };
}

/** Ray vs AABB (slab method). Ritorna la distanza `t` lungo il raggio, o null. */
export function rayVsAabb(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, b: Aabb): number | null {
  const minX = b.x - b.w / 2;
  const maxX = b.x + b.w / 2;
  const minY = 0;
  const maxY = b.h;
  const minZ = b.z - b.d / 2;
  const maxZ = b.z + b.d / 2;

  let tmin = 0;
  let tmax = Infinity;

  // X
  if (Math.abs(dx) < 1e-6) {
    if (ox < minX || ox > maxX) return null;
  } else {
    let t1 = (minX - ox) / dx;
    let t2 = (maxX - ox) / dx;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
  }
  // Y
  if (Math.abs(dy) < 1e-6) {
    if (oy < minY || oy > maxY) return null;
  } else {
    let t1 = (minY - oy) / dy;
    let t2 = (maxY - oy) / dy;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
  }
  // Z
  if (Math.abs(dz) < 1e-6) {
    if (oz < minZ || oz > maxZ) return null;
  } else {
    let t1 = (minZ - oz) / dz;
    let t2 = (maxZ - oz) / dz;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
  }

  if (tmax < tmin || tmax < 0) return null;
  return tmin;
}
