import { Mesh, VertexData, StandardMaterial, Color3, Scene } from '@babylonjs/core';
import type { TrackSpline } from './track';

/** Mesh sulla stessa superficie campionata della strada: funziona anche in curva e sulle rampe. */
export function itemSurface(scene: Scene, spline: TrackSpline, s: number, lateral: number, rs: number, rl: number, name = 'oilSurface', innerRatio = 0): Mesh {
  const mesh = new Mesh(name, scene), positions: number[] = [], indices: number[] = [];
  const center = spline.worldPoint(s, lateral); center.y += .085;
  positions.push(center.x, center.y, center.z);
  const segments = 48;
  for (let i = 0; i < segments; i++) {
    const angle = i / segments * Math.PI * 2;
    const p = spline.worldPoint(s + Math.cos(angle) * rs, lateral + Math.sin(angle) * rl);
    p.y += .085; positions.push(p.x, p.y, p.z);
    indices.push(0, 1 + i, 1 + (i + 1) % segments);
  }
  if(innerRatio>0){
    positions.splice(0,3);indices.length=0;
    for(let i=0;i<segments;i++){
      const angle=i/segments*Math.PI*2,p=spline.worldPoint(s+Math.cos(angle)*rs*innerRatio,lateral+Math.sin(angle)*rl*innerRatio);p.y+=.085;positions.push(p.x,p.y,p.z);
      const next=(i+1)%segments;indices.push(i,next,segments+i,next,segments+next,segments+i);
    }
  }
  const data = new VertexData(); data.positions = positions; data.indices = indices;
  VertexData.ComputeNormals(positions, indices, data.normals = []); data.applyToMesh(mesh);
  const mat = new StandardMaterial(name + 'Mat', scene);
  mat.diffuseColor = new Color3(.018, .022, .035); mat.specularColor = new Color3(.9, .9, 1);
  mat.specularPower = 100; mat.backFaceCulling = false; mat.twoSidedLighting = true; mat.zOffset = -2;
  mesh.material = mat; mesh.isPickable = false;
  return mesh;
}

export const trackDelta = (a: number, b: number, length: number): number => ((a - b + length / 2) % length + length) % length - length / 2;

/** Sweep in coordinate della pista; stessa zona visiva con margine del corpo del kart, mai un'intera corsia. */
export function crossesSurface(from: { distance: number; lateral: number }, to: { distance: number; lateral: number }, s: number, lateral: number, rs: number, rl: number, length: number): boolean {
  const x = trackDelta(from.distance, s, length) / rs, y = (from.lateral - lateral) / rl;
  const dx = (to.distance - from.distance) / rs, dy = (to.lateral - from.lateral) / rl;
  const t = Math.max(0, Math.min(1, -(x * dx + y * dy) / (dx * dx + dy * dy || 1)));
  return (x + dx * t) ** 2 + (y + dy * t) ** 2 <= 1;
}
