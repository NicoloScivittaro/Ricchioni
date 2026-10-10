import { ArcRotateCamera, Scene, Vector3 } from '@babylonjs/core';
import { FIELD_HALF_W, FIELD_HALF_D } from './soccerTypes';
import type { SoccerBall, SoccerPlayer } from './soccerTypes';

/** Regia del solo Calcio: porte sempre orientate come lo stick, margine per HUD e nomi. */
export class SoccerCamera {
  private camera: ArcRotateCamera;
  private shakeUntil = 0;
  private shakeAmp = 0;
  constructor(private scene: Scene) {
    this.camera = new ArcRotateCamera('soccerCam', -Math.PI / 2, .72, 40, new Vector3(0, 1.2, 0), scene);
    this.camera.fov = .8;
    this.camera.minZ = .1;
    this.camera.maxZ = 2500;
    this.camera.inputs.clear();
    scene.activeCamera = this.camera;
  }
  shake(amp: number, ms = 180): void {
    this.shakeAmp = Math.max(this.shakeAmp, amp);
    this.shakeUntil = performance.now() + ms;
  }
  update(dt: number, players: SoccerPlayer[], ball: SoccerBall, now: number): void {
    const alive = players.filter(p => p.alive && !p.falling);
    const meanZ = alive.reduce((s, p) => s + p.z, 0) / Math.max(1, alive.length);
    const k = 1 - Math.exp(-dt * 4);
    // La palla conta più del singolo giocatore; porte e giocatori lontani restano nel frame.
    const tx = Math.max(-2, Math.min(2, ball.x * .18));
    const tz = Math.max(-2, Math.min(2, ball.z * .35 + meanZ * .15));
    this.camera.target.x += (tx - this.camera.target.x) * k;
    this.camera.target.z += (tz - this.camera.target.z) * k;
    this.camera.target.y = 1.2;
    if (now < this.shakeUntil) {
      this.camera.target.x += (Math.random() - .5) * this.shakeAmp;
      this.camera.target.y += (Math.random() - .5) * this.shakeAmp;
    }
    const points = alive.flatMap(p => [{ x: p.x, y: 0, z: p.z }, { x: p.x, y: 4, z: p.z }]);
    points.push({ x: ball.x, y: 0, z: ball.z });
    for (const x of [-FIELD_HALF_W - 2, FIELD_HALF_W + 2])
      for (const z of [-FIELD_HALF_D, FIELD_HALF_D]) points.push({ x, y: 0, z }, { x, y: 4, z });
    const tan = Math.tan(this.camera.fov / 2), aspect = this.scene.getEngine().getAspectRatio(this.camera);
    const sin = Math.sin(this.camera.beta), cos = Math.cos(this.camera.beta);
    let radius = 30;
    for (const p of points) {
      const x = p.x - this.camera.target.x, y = p.y - this.camera.target.y, z = p.z - this.camera.target.z;
      const depthOffset = cos * y - sin * z;
      radius = Math.max(radius, Math.abs(x) / (tan * aspect * .87) + depthOffset,
        Math.abs(sin * y + cos * z) / (tan * .68) + depthOffset);
    }
    // Allarga subito per evitare tagli; stringe gradualmente. Nessun limite che tagli schermi stretti.
    this.camera.radius = radius > this.camera.radius ? radius : this.camera.radius + (radius - this.camera.radius) * k;
  }
  dispose(): void { this.camera.dispose(); }
}
