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
import { MAX_SPEED, DRIFT_THRESHOLDS } from './kartPhysics';
import { presentationOf } from '../../../shared/characterPresentation';
import { decorateHead, makeCharMaterials, makeSymbolPlane } from '../characters/characterModel';

/** Colore del mini-turbo per livello (0 = nessuno): stesso codice colore di scintille, fanali e barra della HUD. */
export const DRIFT_LEVEL_COLORS: [number, number, number][] = [
  [0.9, 0.9, 0.75],
  [0.38, 0.65, 1],
  [1, 0.58, 0.15],
  [0.78, 0.4, 1]
];
export function driftLevelOf(driftCharge: number): number {
  return driftCharge >= DRIFT_THRESHOLDS[2] ? 3 : driftCharge >= DRIFT_THRESHOLDS[1] ? 2 : driftCharge >= DRIFT_THRESHOLDS[0] ? 1 : 0;
}

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

interface Shape {
  bodyW: number;
  bodyH: number;
  bodyD: number;
  noseD: number;
  spoilerW: number;
  wheelD: number;
}

const BASE_SHAPE: Shape = { bodyW: 1.3, bodyH: 0.48, bodyD: 2.0, noseD: 0.6, spoilerW: 1.35, wheelD: 0.76 };

/** Sagoma per personaggio: non solo colore, dimensioni/proporzioni diverse. */
const SHAPES: Record<string, Partial<Shape>> = {
  buttafuori: { bodyW: 1.58, bodyH: 0.56, bodyD: 2.1, noseD: 0.5, spoilerW: 1.6, wheelD: 0.84 }, // largo e tozzo
  dottore: { bodyW: 1.18, bodyH: 0.44, bodyD: 2.25, noseD: 0.85, spoilerW: 1.25, wheelD: 0.7 }, // affusolato, muso lungo
  judoka: { bodyW: 1.26, bodyH: 0.38, bodyD: 2.0, noseD: 0.55, spoilerW: 1.5, wheelD: 0.72 }, // basso e sportivo
  ciro: { bodyW: 1.16, bodyH: 0.44, bodyD: 1.85, noseD: 0.5, spoilerW: 1.2, wheelD: 0.7 } // compatto
};

function shapeFor(characterId: string | null): Shape {
  return { ...BASE_SHAPE, ...(characterId ? SHAPES[characterId] : undefined) };
}

export class KartEntity {
  readonly root: TransformNode;
  readonly body: Mesh;
  private readonly driftSmoke: ParticleSystem;
  private readonly boostFx: ParticleSystem;
  private readonly dustFx: ParticleSystem;
  private readonly sparkL: ParticleSystem;
  private readonly sparkR: ParticleSystem;
  private readonly tailMat: StandardMaterial;
  private slide = 0;
  private lastLevel = -1;
  private readonly frontPivots: TransformNode[];
  private readonly wheels: Mesh[];
  private readonly engine: EngineSound;
  private readonly bobSeed: number;
  private driverMats: StandardMaterial[] = [];
  /** braccia del pilota: [sinistro, destro] (pose di abilita'/arrivo) */
  private driverArms: Mesh[] = [];
  private symbol: Mesh | null = null;
  private abilityUntil = 0;
  private finishUntil = 0;
  private finishFirst = false;

  constructor(scene: Scene, colorHex: string, characterId: string | null = null) {
    this.root = new TransformNode('kartRoot', scene);
    this.root.rotationQuaternion = Quaternion.Identity();
    this.bobSeed = Math.random() * 1000;

    const shape = shapeFor(characterId);
    const color = Color3.FromHexString(colorHex);
    const accent = color.scale(1.25);

    const bodyMat = new StandardMaterial('kartBodyMat', scene);
    bodyMat.diffuseColor = color;
    const darkMat = new StandardMaterial('kartDarkMat', scene);
    darkMat.diffuseColor = new Color3(0.1, 0.11, 0.14);
    const wheelMat = new StandardMaterial('kartWheelMat', scene);
    wheelMat.diffuseColor = new Color3(0.07, 0.07, 0.08);
    const rimMat = new StandardMaterial('kartRimMat', scene);
    rimMat.diffuseColor = new Color3(0.55, 0.56, 0.6);
    const accentMat = new StandardMaterial('kartAccentMat', scene);
    accentMat.diffuseColor = accent;
    accentMat.emissiveColor = accent.scale(0.25);

    const body = MeshBuilder.CreateBox('kartBody', { width: shape.bodyW, height: shape.bodyH, depth: shape.bodyD }, scene);
    body.position.y = 0.42;
    body.material = bodyMat;
    body.parent = this.root;
    this.body = body;

    const nose = MeshBuilder.CreateBox('kartNose', { width: shape.bodyW * 0.78, height: 0.32, depth: shape.noseD }, scene);
    nose.position = new Vector3(0, 0.34, shape.bodyD / 2 + shape.noseD / 2 - 0.05);
    nose.material = bodyMat;
    nose.parent = this.root;

    const cabin = MeshBuilder.CreateBox('kartCabin', { width: 0.72, height: 0.4, depth: 0.7 }, scene);
    cabin.position = new Vector3(0, 0.78, -0.15);
    cabin.material = darkMat;
    cabin.parent = this.root;

    this.buildDriver(scene, accentMat, characterId, colorHex);

    const spoiler = MeshBuilder.CreateBox('kartSpoiler', { width: shape.spoilerW, height: 0.14, depth: 0.14 }, scene);
    spoiler.position = new Vector3(0, 0.78, -1.05);
    spoiler.material = darkMat;
    spoiler.parent = this.root;
    for (const sx of [-shape.spoilerW * 0.44, shape.spoilerW * 0.44]) {
      const strut = MeshBuilder.CreateBox('spoilerStrut', { width: 0.08, height: 0.3, depth: 0.08 }, scene);
      strut.position = new Vector3(sx, 0.62, -1.05);
      strut.material = darkMat;
      strut.parent = this.root;
    }

    this.buildCharacterExtras(scene, characterId, shape, bodyMat, darkMat, accentMat);

    // Ruote grandi in stile arcade: le anteriori hanno un pivot che sterza
    // (rotazione Y), tutte rotolano (rotazione X) in base alla velocità. La
    // forma "a disco" è cotta nei vertici così il rotolamento resta pulito.
    this.frontPivots = [];
    this.wheels = [];
    const halfW = shape.bodyW / 2 - 0.02;
    const mountFront: [number, number][] = [
      [-halfW, shape.bodyD / 2 - 0.3],
      [halfW, shape.bodyD / 2 - 0.3]
    ];
    const mountRear: [number, number][] = [
      [-halfW, -shape.bodyD / 2 + 0.25],
      [halfW, -shape.bodyD / 2 + 0.25]
    ];

    const makeWheelMesh = (): Mesh => {
      const w = MeshBuilder.CreateCylinder('kartWheel', { diameter: shape.wheelD, height: 0.36, tessellation: 14 }, scene);
      w.rotation.z = Math.PI / 2;
      w.bakeCurrentTransformIntoVertices();
      w.material = wheelMat;
      const hub = MeshBuilder.CreateCylinder('kartHub', { diameter: shape.wheelD * 0.4, height: 0.38, tessellation: 8 }, scene);
      hub.rotation.z = Math.PI / 2;
      hub.bakeCurrentTransformIntoVertices();
      hub.material = rimMat;
      hub.parent = w;
      return w;
    };

    const wheelY = shape.wheelD / 2;
    for (const [x, z] of mountFront) {
      const pivot = new TransformNode('wheelPivot', scene);
      pivot.parent = this.root;
      pivot.position = new Vector3(x, wheelY, z);
      const w = makeWheelMesh();
      w.parent = pivot;
      this.frontPivots.push(pivot);
      this.wheels.push(w);
    }
    for (const [x, z] of mountRear) {
      const w = makeWheelMesh();
      w.parent = this.root;
      w.position = new Vector3(x, wheelY, z);
      this.wheels.push(w);
    }

    const fxAnchor = MeshBuilder.CreateBox('kartFxAnchor', { size: 0.05 }, scene);
    fxAnchor.isVisible = false;
    fxAnchor.position = new Vector3(0, 0.15, -1.0);
    fxAnchor.parent = this.root;

    this.driftSmoke = this.makeParticles(scene, fxAnchor, new Color4(0.75, 0.75, 0.78, 0.55), 0.18, 45);
    this.boostFx = this.makeParticles(scene, fxAnchor, new Color4(1, 0.55, 0.15, 0.85), 0.14, 60);
    this.dustFx = this.makeParticles(scene, fxAnchor, new Color4(0.78, 0.68, 0.42, 0.5), 0.16, 35);

    // Scintille dalle ruote posteriori: cambiano colore col livello del mini-turbo (blu, arancio, viola)
    const sparkAnchor = (x: number): Mesh => {
      const a = MeshBuilder.CreateBox('sparkAnchor', { size: 0.04 }, scene);
      a.isVisible = false;
      a.position = new Vector3(x, 0.2, -0.95);
      a.parent = this.root;
      return a;
    };
    const mkSpark = (anchor: Mesh): ParticleSystem => {
      const ps = new ParticleSystem('kartSpark', 40, scene);
      ps.particleTexture = getDotTexture(scene);
      ps.emitter = anchor;
      ps.minEmitBox = new Vector3(-0.05, 0, -0.05);
      ps.maxEmitBox = new Vector3(0.05, 0.05, 0.05);
      ps.color1 = new Color4(0.9, 0.9, 0.75, 1);
      ps.color2 = new Color4(0.9, 0.9, 0.75, 1);
      ps.colorDead = new Color4(0.9, 0.9, 0.75, 0);
      ps.minSize = 0.06;
      ps.maxSize = 0.14;
      ps.minLifeTime = 0.12;
      ps.maxLifeTime = 0.28;
      ps.emitRate = 0;
      ps.direction1 = new Vector3(-0.6, 0.5, -1);
      ps.direction2 = new Vector3(0.6, 1.1, -1.8);
      ps.minEmitPower = 2.2;
      ps.maxEmitPower = 4.2;
      ps.gravity = new Vector3(0, -7, 0);
      ps.blendMode = ParticleSystem.BLENDMODE_ONEONE; // luminose: si leggono anche di giorno
      ps.start();
      return ps;
    };
    const halfRear = shape.bodyW / 2 - 0.02;
    this.sparkL = mkSpark(sparkAnchor(-halfRear));
    this.sparkR = mkSpark(sparkAnchor(halfRear));

    // Fanali posteriori: si accendono del colore del livello di mini-turbo (segnale visivo anche per gli avversari)
    this.tailMat = new StandardMaterial('tailMat', scene);
    this.tailMat.diffuseColor = new Color3(0.2, 0.02, 0.02);
    this.tailMat.emissiveColor = new Color3(0.35, 0.02, 0.02);
    this.tailMat.disableLighting = true;
    for (const x of [-shape.bodyW * 0.32, shape.bodyW * 0.32]) {
      const lamp = MeshBuilder.CreateSphere('tailLamp', { diameter: 0.2, segments: 6 }, scene);
      lamp.position = new Vector3(x, 0.52, -shape.bodyD / 2 - 0.02);
      lamp.material = this.tailMat;
      lamp.parent = this.root;
    }

    this.engine = audio.createEngine();
    this.engine.start();
  }

  /**
   * Sagoma minimale del personaggio alla guida, seduto nell'abitacolo: stessa pelle e stessi tratti della testa del modello
   * intero (orecchie del Goblin, occhiali scuri del Buttafuori, capelli del Judoka, occhiali tondi del Dottore, i due capelli di Ciro).
   */
  private buildDriver(scene: Scene, shirtMat: StandardMaterial, characterId: string | null, colorHex: string): void {
    const pres = presentationOf(characterId);
    const skinMat = new StandardMaterial('driverSkinMat', scene);
    skinMat.diffuseColor = pres ? Color3.FromHexString(pres.skin) : new Color3(0.85, 0.66, 0.52);

    const torso = MeshBuilder.CreateBox('driverTorso', { width: 0.42, height: 0.4, depth: 0.28 }, scene);
    torso.position = new Vector3(0, 0.86, -0.22);
    torso.material = shirtMat;
    torso.parent = this.root;

    // testa un po' piu' grande del vero: e' l'unica parte del personaggio che si vede dal kart
    const headNode = new TransformNode('driverHeadNode', scene);
    headNode.parent = this.root;
    headNode.position = new Vector3(0, 1.2, -0.22);
    const head = MeshBuilder.CreateSphere('driverHead', { diameter: 0.38, segments: 8 }, scene);
    head.material = skinMat;
    head.parent = headNode;
    if (pres) {
      const mats = makeCharMaterials(scene, pres, colorHex);
      mats.skin.dispose();
      mats.skin = skinMat;
      decorateHead(scene, headNode, 0.38, pres, mats);
      this.driverMats = mats.all.filter((x) => x !== skinMat);
    }

    for (const sx of [-0.26, 0.26]) {
      const arm = MeshBuilder.CreateCylinder('driverArm', { diameter: 0.1, height: 0.4, tessellation: 6 }, scene);
      arm.position = new Vector3(sx, 0.82, 0.05);
      arm.rotation.x = -Math.PI / 2.6;
      arm.material = shirtMat;
      arm.parent = this.root;
      this.driverArms.push(arm);
    }
    if (pres) {
      this.symbol = makeSymbolPlane(scene, pres.symbol, 0.7);
      this.symbol.parent = this.root;
    }
  }

  /** Dettaglio che distingue visivamente il kart di ogni personaggio, oltre a colore/sagoma. */
  private buildCharacterExtras(
    scene: Scene,
    characterId: string | null,
    shape: Shape,
    bodyMat: StandardMaterial,
    darkMat: StandardMaterial,
    accentMat: StandardMaterial
  ): void {
    switch (characterId) {
      case 'goblin': {
        // Scarico "a lattina" storto sul retro.
        const exhaust = MeshBuilder.CreateCylinder('exhaust', { diameter: 0.16, height: 0.5, tessellation: 8 }, scene);
        exhaust.position = new Vector3(0.45, 0.55, -1.0);
        exhaust.rotation.z = -0.5;
        exhaust.material = darkMat;
        exhaust.parent = this.root;
        break;
      }
      case 'buttafuori': {
        // Bull-bar anteriore: protegge e minaccia.
        for (const [x] of [[-0.5], [0], [0.5]] as [number][]) {
          const bar = MeshBuilder.CreateCylinder('bullbar', { diameter: 0.09, height: 0.4, tessellation: 6 }, scene);
          bar.position = new Vector3(x, 0.4, shape.bodyD / 2 + shape.noseD - 0.05);
          bar.rotation.x = Math.PI / 2;
          bar.material = darkMat;
          bar.parent = this.root;
        }
        break;
      }
      case 'dottore': {
        // Lampadina su un'antennina dietro: "ogni tanto si sveglia" (niente laboratorio: non e' un medico ne' uno scienziato).
        const rod = MeshBuilder.CreateCylinder('bulbRod', { diameter: 0.04, height: 0.5, tessellation: 5 }, scene);
        rod.position = new Vector3(-0.4, 0.82, -0.95);
        rod.material = darkMat;
        rod.parent = this.root;
        const bulb = MeshBuilder.CreateSphere('bulb', { diameter: 0.24, segments: 8 }, scene);
        bulb.position = new Vector3(-0.4, 1.12, -0.95);
        const bulbMat = new StandardMaterial('bulbMat', scene);
        bulbMat.diffuseColor = new Color3(1, 0.93, 0.55);
        bulbMat.emissiveColor = new Color3(0.75, 0.65, 0.25);
        bulb.material = bulbMat;
        bulb.parent = this.root;
        break;
      }
      case 'judoka': {
        // Fascette laterali basse, più aggressive.
        for (const sx of [-shape.bodyW / 2 - 0.03, shape.bodyW / 2 + 0.03]) {
          const skirt = MeshBuilder.CreateBox('sideSkirt', { width: 0.06, height: 0.16, depth: shape.bodyD * 0.7 }, scene);
          skirt.position = new Vector3(sx, 0.24, 0);
          skirt.material = accentMat;
          skirt.parent = this.root;
        }
        // Lampeggiante arancione da camion dietro al pilota (carico e scarico).
        const beacon = MeshBuilder.CreateCylinder('beacon', { diameter: 0.18, height: 0.16, tessellation: 10 }, scene);
        beacon.position = new Vector3(0, 1.0, -0.75);
        const beaconMat = new StandardMaterial('beaconMat', scene);
        beaconMat.diffuseColor = new Color3(1, 0.55, 0.05);
        beaconMat.emissiveColor = new Color3(0.9, 0.45, 0.02);
        beacon.material = beaconMat;
        beacon.parent = this.root;
        break;
      }
      case 'ciro': {
        // Monetona d'oro appesa dietro: tutto torna (prima o poi).
        const charm = MeshBuilder.CreateCylinder('charm', { diameter: 0.26, height: 0.04, tessellation: 14 }, scene);
        charm.position = new Vector3(0.35, 0.55, -1.0);
        charm.rotation.x = Math.PI / 2;
        const goldMat = new StandardMaterial('charmGold', scene);
        goldMat.diffuseColor = new Color3(0.96, 0.77, 0.26);
        goldMat.emissiveColor = new Color3(0.35, 0.27, 0.05);
        charm.material = goldMat;
        charm.parent = this.root;
        break;
      }
      default:
        void bodyMat;
    }
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
  updateVisual(state: KartState, spline: TrackSpline, throttle = 0): void {
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

    // Derapata: il kart si inclina e il MUSO punta dentro la curva (scivola di traverso), con morbidezza in entrata/uscita
    this.slide += ((state.drifting ? 1 : 0) - this.slide) * 0.22;
    if (this.slide > 0.01) this.root.rotate(Axis.Y, state.driftDir * 0.24 * this.slide, Space.LOCAL);
    const roll = state.drifting ? -state.driftDir * 0.16 : 0;
    if (roll !== 0) this.root.rotate(Axis.Z, roll, Space.LOCAL);

    const squash = state.stunTimer > 0 ? 0.82 : 1;
    this.root.scaling.set(squash, squash, squash);

    // Ruote anteriori: sterzano visivamente seguendo l'input smussato.
    for (const pivot of this.frontPivots) pivot.rotation.y = state.steerVisual * MAX_VISUAL_STEER_ANGLE;
    // Tutte le ruote rotolano in base alla velocità percorsa.
    for (const w of this.wheels) w.rotation.x = state.wheelSpin;

    const level = state.drifting ? driftLevelOf(state.driftCharge) : 0;
    this.driftSmoke.emitRate = state.drifting && state.driftCharge > 0.15 ? 26 : 0;
    // scintille: sempre visibili in derapata, piu' fitte e colorate man mano che sale il livello
    const sparkRate = state.drifting && Math.abs(state.speed) > 10 ? 34 + level * 46 : 0;
    this.sparkL.emitRate = this.sparkR.emitRate = sparkRate;
    if (level !== this.lastLevel) {
      this.lastLevel = level;
      const c = DRIFT_LEVEL_COLORS[level];
      for (const ps of [this.sparkL, this.sparkR]) {
        ps.color1.set(c[0], c[1], c[2], 1);
        ps.color2.set(c[0], c[1], c[2], 1);
        ps.colorDead.set(c[0], c[1], c[2], 0);
      }
      const lamp = level > 0 ? DRIFT_LEVEL_COLORS[level] : [0.35, 0.02, 0.02];
      this.tailMat.emissiveColor.set(lamp[0], lamp[1], lamp[2]);
    }
    this.boostFx.emitRate = state.boostTimer > 0 ? 70 : 0;
    this.dustFx.emitRate = state.offRoad && Math.abs(state.speed) > 8 ? 30 : 0;

    this.engine.update(speedFrac, state.boostTimer > 0, throttle, state.drifting ? Math.min(1, 0.45 + state.driftCharge * 0.5) : 0);
    this.updateDriver();
  }

  /** Abilita' attivata: il pilota alza il braccio e sopra il kart compare il simbolo del personaggio (lo vedono anche gli avversari). */
  playAbility(): void {
    this.abilityUntil = performance.now() + 900;
  }

  /** Arrivo: il primo esulta con entrambe le braccia, gli altri alzano un braccio. */
  playFinish(first: boolean): void {
    this.finishUntil = performance.now() + 2600;
    this.finishFirst = first;
  }

  private updateDriver(): void {
    const now = performance.now();
    const ability = now < this.abilityUntil;
    const finish = now < this.finishUntil;
    const [armL, armR] = this.driverArms;
    if (armL && armR) {
      const wheel = -Math.PI / 2.6;
      const wave = Math.sin(now * 0.02) * 0.25;
      armR.rotation.x = ability || finish ? -Math.PI * 0.95 + wave : wheel;
      armL.rotation.x = finish && this.finishFirst ? -Math.PI * 0.95 - wave : wheel;
    }
    if (this.symbol) {
      this.symbol.isVisible = ability;
      if (ability) {
        const life = 1 - (this.abilityUntil - now) / 900;
        this.symbol.position.set(0, 1.7 + life * 0.8, -0.22);
        this.symbol.visibility = life > 0.7 ? (1 - life) / 0.3 : 1;
      }
    }
  }

  /** Partenza di un boost: raffica di particelle dallo scarico e colpo di giri del motore. */
  burstBoost(): void {
    this.boostFx.manualEmitCount = 46;
    this.engine.boostKick();
  }

  dispose(): void {
    this.sparkL.dispose();
    this.sparkR.dispose();
    this.driftSmoke.dispose();
    this.boostFx.dispose();
    this.dustFx.dispose();
    this.engine.stop();
    for (const m of this.driverMats) m.dispose();
    this.root.dispose();
  }
}
