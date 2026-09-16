import {
  Scene,
  Mesh,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Vector3,
  Matrix,
  Quaternion,
  Axis,
  Space,
  TransformNode,
  ParticleSystem,
  Texture,
  DynamicTexture,
  Color4
} from '@babylonjs/core';
import type { KartState } from './raceTypes';
import type { TrackSpline } from './track';
import { audio, EngineSound } from '../../core/AudioManager';
import { MAX_SPEED } from './kartPhysics';

let dotTexture: Texture | null = null;
function getDotTexture(scene: Scene): Texture {
  if (dotTexture) return dotTexture;
  const dt = new DynamicTexture('particleDot', 16, scene, false);
  const ctx = dt.getContext();
  ctx.fillStyle = 'white';
  ctx.beginPath();
  ctx.arc(8, 8, 7, 0, Math.PI * 2);
  ctx.fill();
  dt.update();
  dotTexture = dt;
  return dt;
}

const MAX_VISUAL_STEER_ANGLE = 0.42; // rad, angolo massimo di sterzata delle ruote anteriori (solo estetico)

export class KartEntity {
  readonly root: TransformNode;
  readonly body: Mesh;
  private readonly driftSmoke: ParticleSystem;
  private readonly boostFx: ParticleSystem;
  private readonly dustFx: ParticleSystem;
  private readonly frontPivots: TransformNode[];
  private readonly wheels: Mesh[];
  private readonly engine: EngineSound;
  private readonly bobSeed: number;

  constructor(scene: Scene, colorHex: string) {
    this.root = new TransformNode('kartRoot', scene);
    this.root.rotationQuaternion = Quaternion.Identity();
    this.bobSeed = Math.random() * 1000;

    const color = Color3.FromHexString(colorHex);

    const bodyMat = new StandardMaterial('kartBodyMat', scene);
    bodyMat.diffuseColor = color;
    const darkMat = new StandardMaterial('kartDarkMat', scene);
    darkMat.diffuseColor = new Color3(0.1, 0.11, 0.14);
    const wheelMat = new StandardMaterial('kartWheelMat', scene);
    wheelMat.diffuseColor = new Color3(0.07, 0.07, 0.08);
    const rimMat = new StandardMaterial('kartRimMat', scene);
    rimMat.diffuseColor = new Color3(0.55, 0.56, 0.6);

    const body = MeshBuilder.CreateBox('kartBody', { width: 1.3, height: 0.5, depth: 2.1 }, scene);
    body.position.y = 0.42;
    body.material = bodyMat;
    body.parent = this.root;
    this.body = body;

    const nose = MeshBuilder.CreateBox('kartNose', { width: 1.0, height: 0.32, depth: 0.6 }, scene);
    nose.position = new Vector3(0, 0.34, 1.25);
    nose.material = bodyMat;
    nose.parent = this.root;

    const cabin = MeshBuilder.CreateBox('kartCabin', { width: 0.72, height: 0.4, depth: 0.7 }, scene);
    cabin.position = new Vector3(0, 0.78, -0.15);
    cabin.material = darkMat;
    cabin.parent = this.root;

    const spoiler = MeshBuilder.CreateBox('kartSpoiler', { width: 1.35, height: 0.14, depth: 0.14 }, scene);
    spoiler.position = new Vector3(0, 0.78, -1.05);
    spoiler.material = darkMat;
    spoiler.parent = this.root;
    for (const sx of [-0.6, 0.6]) {
      const strut = MeshBuilder.CreateBox('spoilerStrut', { width: 0.08, height: 0.3, depth: 0.08 }, scene);
      strut.position = new Vector3(sx, 0.62, -1.05);
      strut.material = darkMat;
      strut.parent = this.root;
    }

    // Ruote: le anteriori hanno un pivot che sterza (rotazione Y), tutte
    // rotolano (rotazione X) in base alla velocità. La forma "a disco" è
    // cotta nei vertici così la rotazione di rotolamento resta pulita.
    this.frontPivots = [];
    this.wheels = [];
    const mountFront: [number, number][] = [
      [-0.72, 0.75],
      [0.72, 0.75]
    ];
    const mountRear: [number, number][] = [
      [-0.72, -0.85],
      [0.72, -0.85]
    ];

    const makeWheelMesh = (): Mesh => {
      const w = MeshBuilder.CreateCylinder('kartWheel', { diameter: 0.62, height: 0.34, tessellation: 14 }, scene);
      w.rotation.z = Math.PI / 2;
      w.bakeCurrentTransformIntoVertices();
      w.material = wheelMat;
      const hub = MeshBuilder.CreateCylinder('kartHub', { diameter: 0.24, height: 0.36, tessellation: 8 }, scene);
      hub.rotation.z = Math.PI / 2;
      hub.bakeCurrentTransformIntoVertices();
      hub.material = rimMat;
      hub.parent = w;
      return w;
    };

    for (const [x, z] of mountFront) {
      const pivot = new TransformNode('wheelPivot', scene);
      pivot.parent = this.root;
      pivot.position = new Vector3(x, 0.32, z);
      const w = makeWheelMesh();
      w.parent = pivot;
      this.frontPivots.push(pivot);
      this.wheels.push(w);
    }
    for (const [x, z] of mountRear) {
      const w = makeWheelMesh();
      w.parent = this.root;
      w.position = new Vector3(x, 0.32, z);
      this.wheels.push(w);
    }

    const fxAnchor = MeshBuilder.CreateBox('kartFxAnchor', { size: 0.05 }, scene);
    fxAnchor.isVisible = false;
    fxAnchor.position = new Vector3(0, 0.15, -1.0);
    fxAnchor.parent = this.root;

    this.driftSmoke = this.makeParticles(scene, fxAnchor, new Color4(0.75, 0.75, 0.78, 0.55), 0.18, 45);
    this.boostFx = this.makeParticles(scene, fxAnchor, new Color4(1, 0.55, 0.15, 0.85), 0.14, 60);
    this.dustFx = this.makeParticles(scene, fxAnchor, new Color4(0.78, 0.68, 0.42, 0.5), 0.16, 35);

    this.engine = audio.createEngine();
    this.engine.start();
  }

  private makeParticles(scene: Scene, emitter: Mesh, color: Color4, size: number, capacity: number): ParticleSystem {
    const ps = new ParticleSystem('kartFx', capacity, scene);
    ps.particleTexture = getDotTexture(scene);
    ps.emitter = emitter;
    ps.minEmitBox = new Vector3(-0.42, 0, -0.1);
    ps.maxEmitBox = new Vector3(0.42, 0.06, 0.1);
    ps.color1 = color;
    ps.color2 = color;
    ps.colorDead = new Color4(color.r, color.g, color.b, 0);
    ps.minSize = size * 0.6;
    ps.maxSize = size;
    ps.minLifeTime = 0.25;
    ps.maxLifeTime = 0.5;
    ps.emitRate = 0;
    ps.direction1 = new Vector3(-0.3, 0.3, -1);
    ps.direction2 = new Vector3(0.3, 0.6, -1.6);
    ps.minEmitPower = 1.2;
    ps.maxEmitPower = 2.4;
    ps.gravity = new Vector3(0, -1.2, 0);
    ps.start();
    return ps;
  }

  /** Sincronizza mesh + effetti con lo stato fisico del kart. */
  updateVisual(state: KartState, spline: TrackSpline): void {
    const pos = spline.worldPoint(state.distance, state.lateral, 0.05);
    const speedFrac = Math.min(1, Math.abs(state.speed) / MAX_SPEED);
    const bob = Math.sin(performance.now() * 0.018 + this.bobSeed) * 0.01 * (0.3 + speedFrac);
    pos.y += bob;
    this.root.position.copyFrom(pos);

    const tangent = spline.tangentAt(state.distance);
    const right = spline.rightAt(state.distance);
    const cosH = Math.cos(state.heading);
    const sinH = Math.sin(state.heading);
    const forward = tangent.scale(cosH).add(right.scale(sinH)).normalize();
    const newRight = Vector3.Cross(Vector3.Up(), forward).normalize();
    const up = Vector3.Cross(forward, newRight).normalize();

    const m = Matrix.Identity();
    Matrix.FromXYZAxesToRef(newRight, up, forward, m);
    this.root.rotationQuaternion = Quaternion.FromRotationMatrix(m);

    const roll = state.drifting ? -state.driftDir * 0.16 : 0;
    if (roll !== 0) this.root.rotate(Axis.Z, roll, Space.LOCAL);

    const squash = state.stunTimer > 0 ? 0.82 : 1;
    this.root.scaling.set(squash, squash, squash);

    // Ruote anteriori: sterzano visivamente seguendo l'input smussato.
    for (const pivot of this.frontPivots) pivot.rotation.y = state.steerVisual * MAX_VISUAL_STEER_ANGLE;
    // Tutte le ruote rotolano in base alla velocità percorsa.
    for (const w of this.wheels) w.rotation.x = state.wheelSpin;

    this.driftSmoke.emitRate = state.drifting && state.driftCharge > 0.15 ? 40 : 0;
    this.boostFx.emitRate = state.boostTimer > 0 ? 70 : 0;
    this.dustFx.emitRate = state.offRoad && Math.abs(state.speed) > 8 ? 30 : 0;

    this.engine.update(speedFrac, state.boostTimer > 0);
  }

  dispose(): void {
    this.driftSmoke.dispose();
    this.boostFx.dispose();
    this.dustFx.dispose();
    this.engine.stop();
    this.root.dispose();
  }
}
