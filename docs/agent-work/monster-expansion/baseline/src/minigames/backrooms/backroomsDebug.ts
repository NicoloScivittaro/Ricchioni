import { MeshBuilder, Vector3, Color3, type Scene, type LinesMesh } from '@babylonjs/core';
import type { BackroomsMatch } from './backroomsRules';

/** Constructed only by a DEV query. No DOM, cones or sensory internals in normal matches. */
export class BackroomsPerceptionDebug {
  private text = document.createElement('pre'); private lines: LinesMesh[] = [];
  private lastDraw = -Infinity;
  constructor(private scene: Scene, private match: BackroomsMatch) {
    this.text.id = 'backrooms-debug'; this.text.style.cssText = 'position:fixed;left:8px;top:35px;z-index:10005;pointer-events:none;background:#000b;color:#cfb;font:10px monospace;max-width:95vw;white-space:pre-wrap';
    document.body.appendChild(this.text);
  }
  update(): void {
    if (performance.now() - this.lastDraw < 100) return;
    this.lastDraw = performance.now();
    const rows: string[] = [];
    this.match.monsters.forEach((m, i) => {
      const senses = this.match.senses[m.kind], v = new Vector3(m.x, .08, m.z), half = senses.fov * Math.PI / 360;
      const fan = Array.from({ length: 13 }, (_, n) => { const angle = m.yaw - half + n * half / 6; return new Vector3(m.x + Math.sin(angle) * senses.range, .08, m.z + Math.cos(angle) * senses.range); });
      const segments = [[v, fan[0]], fan, [fan[12], v]];
      if (m.memory) segments.push([v, new Vector3(m.memory.x, .15, m.memory.z)]);
      if (m.noiseArea) { const a = m.noiseArea; segments.push(Array.from({ length: 25 }, (_, n) => new Vector3(a.x + Math.sin(n * Math.PI / 12) * a.radius, .1, a.z + Math.cos(n * Math.PI / 12) * a.radius))); }
      // Variable point counts (sight/noise acquired/lost) require replacing this small DEV mesh.
      this.lines[i]?.dispose(); const line = MeshBuilder.CreateLineSystem(`perception-${i}`, { lines: segments }, this.scene); line.color = m.state === 'chase' ? Color3.Red() : Color3.Green(); this.lines[i] = line;
      rows.push(`${m.kind} ${m.state.toUpperCase()} target=${m.target ?? '—'} FOV=${senses.fov}°\nseen=${m.memory ? `${m.memory.x.toFixed(1)},${m.memory.z.toFixed(1)}` : '—'} noise=${m.noiseArea ? `${m.noiseArea.x.toFixed(1)},${m.noiseArea.z.toFixed(1)} ±${m.noiseArea.radius}` : '—'} reason=${m.reason}\n${this.match.players.map(p => { const s = this.match.perception(m, p); return `${p.name}: LOS=${s.los} ${s.reason}`; }).join(' | ')}`);
    });
    this.text.textContent = rows.join('\n\n');
  }
  dispose(): void { this.lines.forEach(l => l.dispose()); this.text.remove(); }
}
