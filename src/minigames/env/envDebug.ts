import { BlackAndWhitePostProcess } from '@babylonjs/core';
import type { Camera, Scene } from '@babylonjs/core';
import { debugEnabled, isDebugOverlayVisible, registerDebugSection } from '../../core/debug';

/**
 * STRUMENTI AMBIENTE (solo debug, solo host):
 *  - VALIDATORE: conteggi della scena 3D corrente nell'overlay F3 (mesh, materiali, texture, luci, particelle,
 *    mesh decorative collidibili — devono essere 0 — e draw call dell'ultimo frame)
 *  - TEST DEI VALORI: tasto G con F3 aperto = scena in scala di grigi. Giocatori, palla, obiettivi e pericoli devono
 *    restare leggibili anche senza colore.
 * In produzione normale (`debugEnabled()` falso) non fa nulla.
 */

export interface EnvStats {
  meshes: number;
  visibleMeshes: number;
  instances: number;
  thinInstances: number;
  activeMeshes: number;
  materials: number;
  textures: number;
  dupTextures: number;
  lights: number;
  particleSystems: number;
  collidable: number;
  drawCalls: number;
}

let current: Scene | null = null;
let gray = false;
let installed = false;
const pps = new Map<Camera, BlackAndWhitePostProcess>();
let lastDraw = 0;

/** Conteggi della scena (anche per i test E2E: `window.__envStats()`). */
export function envStats(scene: Scene): EnvStats {
  const tex = new Map<string, number>();
  for (const t of scene.textures) tex.set(t.name, (tex.get(t.name) ?? 0) + 1);
  let thin = 0;
  for (const m of scene.meshes) thin += (m as unknown as { thinInstanceCount?: number }).thinInstanceCount ?? 0;
  return {
    meshes: scene.meshes.length,
    visibleMeshes: scene.meshes.filter((m) => m.isEnabled() && m.isVisible).length,
    instances: scene.meshes.filter((m) => m.getClassName() === 'InstancedMesh').length,
    thinInstances: thin,
    activeMeshes: scene.getActiveMeshes().length,
    materials: scene.materials.length,
    textures: scene.textures.length,
    dupTextures: [...tex.values()].filter((n) => n > 1).reduce((a, b) => a + b, 0),
    lights: scene.lights.length,
    particleSystems: scene.particleSystems.length,
    collidable: scene.meshes.filter((m) => m.checkCollisions).length,
    drawCalls: lastDraw
  };
}

function applyGray(): void {
  const sc = current;
  if (!sc) return;
  const cams = sc.activeCameras && sc.activeCameras.length > 0 ? sc.activeCameras : sc.activeCamera ? [sc.activeCamera] : [];
  for (const cam of cams) {
    const has = pps.get(cam);
    if (gray && !has) pps.set(cam, new BlackAndWhitePostProcess('envGray', 1, cam));
    if (!gray && has) {
      has.dispose(cam);
      pps.delete(cam);
    }
  }
}

/** Da chiamare dai giochi 3D dell'host dopo aver costruito la scena. */
export function registerEnvScene(scene: Scene): void {
  if (!debugEnabled()) return;
  current = scene;
  pps.clear();
  const eng = scene.getEngine() as unknown as { _drawCalls?: { fetchNewFrame(): void; current: number } };
  scene.onBeforeRenderObservable.add(() => eng._drawCalls?.fetchNewFrame());
  scene.onAfterRenderObservable.add(() => (lastDraw = eng._drawCalls?.current ?? 0));
  scene.onDisposeObservable.add(() => {
    if (current === scene) current = null;
    pps.clear();
  });
  if (gray) applyGray();
  (window as unknown as { __envStats?: () => EnvStats | null }).__envStats = () => (current ? envStats(current) : null);
  (window as unknown as { __envGray?: (on: boolean) => void }).__envGray = (on: boolean) => {
    gray = on;
    applyGray();
  };
  if (installed) return;
  installed = true;
  registerDebugSection(() => {
    if (!current) return [];
    const s = envStats(current);
    return [
      `AMBIENTE · G scala di grigi ${gray ? 'ON' : 'off'}`,
      `  mesh ${s.meshes} (attive ${s.activeMeshes}, istanze ${s.instances}, thin ${s.thinInstances}) · draw ${s.drawCalls}`,
      `  materiali ${s.materials} · texture ${s.textures}${s.dupTextures ? ` (nomi doppi ${s.dupTextures})` : ''} · luci ${s.lights} · particelle ${s.particleSystems}` +
        `${s.collidable ? ` · ⚠ collidibili ${s.collidable}` : ''}`
    ];
  });
  window.addEventListener('keydown', (e) => {
    if ((e.key === 'g' || e.key === 'G') && !e.repeat && isDebugOverlayVisible()) {
      gray = !gray;
      applyGray();
    }
  });
}
