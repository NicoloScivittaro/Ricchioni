import {
  Scene,
  Mesh,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Color4,
  Vector3,
  TransformNode,
  ParticleSystem,
  Texture,
  DynamicTexture
} from '@babylonjs/core';
import { MAX_SPEED } from './arenaTypes';
import { getCharacter } from '../../../shared/characters';

/** Sottoinsieme di stato letto da updateVisual (condiviso tra arena e dodgeball). */
export interface VisualSubject {
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  facing: number;
  alive: boolean;
  falling: boolean;
  spin: number;
  dashing: boolean;
  stunTime: number;
  hitFlash: number;
}

/** Personaggio chibi low-poly costruito a partire da primitive. */
export class ArenaEntity {
  readonly root: TransformNode;
  private readonly torso: Mesh;
  private readonly head: Mesh;
  private readonly eyeL: Mesh;
  private readonly eyeR: Mesh;
  private readonly legLPivot: TransformNode;
  private readonly legRPivot: TransformNode;
  private readonly armLPivot: TransformNode;
  private readonly armRPivot: TransformNode;
  private readonly bodyMats: StandardMaterial[];
  private readonly dashFx: ParticleSystem;
  private readonly hitFx: ParticleSystem;
  private readonly baseColor: Color3;
  private readonly bobSeed: number;
  private visualFacing = 0;
  private readonly extras: Mesh[] = [];
  private throwPose = 0;

  constructor(
    scene: Scene,
    dotTexture: Texture,
    colorHex: string,
    characterId: string | null,
    avatar: string,
    name: string
  ) {
    this.root = new TransformNode('arenaChar', scene);
    this.bobSeed = Math.random() * 1000;
    this.baseColor = Color3.FromHexString(colorHex);

    const shirt = new StandardMaterial('shirt', scene);
    shirt.diffuseColor = this.baseColor;
    const pants = new StandardMaterial('pants', scene);
    pants.diffuseColor = this.baseColor.scale(0.45);
    const skin = new StandardMaterial('skin', scene);
    skin.diffuseColor = new Color3(0.9, 0.72, 0.58);
    const white = new StandardMaterial('white', scene);
    white.diffuseColor = new Color3(0.96, 0.96, 0.96);
    const dark = new StandardMaterial('dark', scene);
    dark.diffuseColor = new Color3(0.12, 0.12, 0.14);
    this.bodyMats = [shirt, pants, skin, white, dark];

    // Corpo
    this.torso = MeshBuilder.CreateBox('torso', { width: 1.15, height: 0.95, depth: 0.7 }, scene);
    this.torso.position.y = 1.05;
    this.torso.material = shirt;
    this.torso.parent = this.root;

    this.head = MeshBuilder.CreateSphere('head', { diameter: 0.85, segments: 12 }, scene);
    this.head.position = new Vector3(0, 1.72, 0);
    this.head.material = skin;
    this.head.parent = this.root;

    this.eyeL = MeshBuilder.CreateSphere('eyeL', { diameter: 0.16, segments: 6 }, scene);
    this.eyeL.position = new Vector3(-0.2, 1.78, 0.38);
    this.eyeL.material = white;
    this.eyeL.parent = this.head;
    this.eyeR = MeshBuilder.CreateSphere('eyeR', { diameter: 0.16, segments: 6 }, scene);
    this.eyeR.position = new Vector3(0.2, 1.78, 0.38);
    this.eyeR.material = white;
    this.eyeR.parent = this.head;

    for (const ex of [-0.2, 0.2]) {
      const pupil = MeshBuilder.CreateSphere('pupil', { diameter: 0.08, segments: 6 }, scene);
      pupil.position = new Vector3(ex, 1.78, 0.44);
      pupil.material = dark;
      pupil.parent = this.head;
    }

    // Gambe (pivot all'anca, mesh verso il basso)
    this.legLPivot = new TransformNode('legL', scene);
    this.legLPivot.position = new Vector3(-0.28, 0.62, 0);
    this.legLPivot.parent = this.root;
    this.legRPivot = new TransformNode('legR', scene);
    this.legRPivot.position = new Vector3(0.28, 0.62, 0);
    this.legRPivot.parent = this.root;
    for (const pivot of [this.legLPivot, this.legRPivot]) {
      const leg = MeshBuilder.CreateCylinder('leg', { diameter: 0.26, height: 0.62, tessellation: 8 }, scene);
      leg.position.y = -0.31;
      leg.material = pants;
      leg.parent = pivot;
    }

    // Braccia (pivot alla spalla)
    this.armLPivot = new TransformNode('armL', scene);
    this.armLPivot.position = new Vector3(-0.72, 1.45, 0);
    this.armLPivot.parent = this.root;
    this.armRPivot = new TransformNode('armR', scene);
    this.armRPivot.position = new Vector3(0.72, 1.45, 0);
    this.armRPivot.parent = this.root;
    for (const pivot of [this.armLPivot, this.armRPivot]) {
      const arm = MeshBuilder.CreateCylinder('arm', { diameter: 0.22, height: 0.72, tessellation: 8 }, scene);
      arm.position.y = -0.34;
      arm.material = shirt;
      arm.parent = pivot;
      const hand = MeshBuilder.CreateSphere('hand', { diameter: 0.24, segments: 8 }, scene);
      hand.position.y = -0.68;
      hand.material = skin;
      hand.parent = pivot;
    }

    this.buildCharacterExtras(scene, characterId, shirt, white, dark, skin);

    // Nameplate billboard (avatar + nome) sopra la testa.
    this.buildNameplate(scene, avatar, name, characterId);

    // Ancoraggio particelle (mesh invisibile che segue il personaggio).
    const fxAnchor = MeshBuilder.CreateBox('arenaFxAnchor', { size: 0.05 }, scene);
    fxAnchor.isVisible = false;
    fxAnchor.parent = this.root;

    // Particelle
    const dashMat = this.emitMat(scene, this.baseColor, 0.9);
    this.dashFx = this.makeParticles(scene, dotTexture, fxAnchor, dashMat, 0.16, 40);
    this.hitFx = this.makeParticles(scene, dotTexture, fxAnchor, new Color4(1, 0.95, 0.4, 1), 0.2, 60);
  }

  private emitMat(scene: Scene, color: Color3, alpha: number): Color4 {
    return new Color4(color.r, color.g, color.b, alpha);
  }

  private buildCharacterExtras(
    scene: Scene,
    characterId: string | null,
    shirt: StandardMaterial,
    white: StandardMaterial,
    dark: StandardMaterial,
    skin: StandardMaterial
  ): void {
    const add = (m: Mesh): void => {
      this.extras.push(m);
    };
    switch (characterId) {
      case 'goblin': {
        // Bottiglia in mano + zigzag "da ubriaco" (inclinazione del busto gestita in update).
        const bottle = MeshBuilder.CreateCylinder('bottle', { diameter: 0.22, height: 0.5, tessellation: 8 }, scene);
        bottle.position = new Vector3(0.85, 0.9, 0.1);
        const glass = new StandardMaterial('glass', scene);
        glass.diffuseColor = new Color3(0.3, 0.8, 0.4);
        glass.alpha = 0.85;
        glass.emissiveColor = new Color3(0.1, 0.3, 0.15);
        bottle.material = glass;
        bottle.parent = this.root;
        add(bottle);
        break;
      }
      case 'buttafuori': {
        // Spallacci larghi → silhouette tozza.
        for (const sx of [-0.55, 0.55]) {
          const pad = MeshBuilder.CreateBox('pad', { width: 0.45, height: 0.3, depth: 0.6 }, scene);
          pad.position = new Vector3(sx, 1.5, 0);
          pad.material = dark;
          pad.parent = this.root;
          add(pad);
        }
        break;
      }
      case 'dottore': {
        // Camice bianco + provetta.
        const coat = MeshBuilder.CreateBox('coat', { width: 1.22, height: 1.05, depth: 0.78 }, scene);
        coat.position.y = 1.05;
        coat.material = white;
        coat.parent = this.root;
        add(coat);
        const flask = MeshBuilder.CreateCylinder('flask', { diameterTop: 0.12, diameterBottom: 0.3, height: 0.4, tessellation: 10 }, scene);
        flask.position = new Vector3(-0.85, 0.95, 0.05);
        const flaskMat = new StandardMaterial('flaskMat', scene);
        flaskMat.diffuseColor = new Color3(0.4, 0.85, 0.5);
        flaskMat.alpha = 0.75;
        flaskMat.emissiveColor = new Color3(0.15, 0.4, 0.2);
        flask.material = flaskMat;
        flask.parent = this.root;
        add(flask);
        break;
      }
      case 'judoka': {
        // Gi bianco + cintura colorata.
        const gi = MeshBuilder.CreateBox('gi', { width: 1.25, height: 1.0, depth: 0.8 }, scene);
        gi.position.y = 1.05;
        gi.material = white;
        gi.parent = this.root;
        add(gi);
        const belt = MeshBuilder.CreateBox('belt', { width: 1.22, height: 0.16, depth: 0.8 }, scene);
        belt.position.y = 0.85;
        belt.material = shirt;
        belt.parent = this.root;
        add(belt);
        const band = MeshBuilder.CreateCylinder('band', { diameter: 0.88, height: 0.16, tessellation: 12 }, scene);
        band.position.y = 2.1;
        band.material = shirt;
        band.parent = this.head;
        add(band);
        break;
      }
      case 'ciro': {
        // Testa pelata (skin) + catenina d'oro.
        const chain = MeshBuilder.CreateTorus('chain', { diameter: 0.42, thickness: 0.07, tessellation: 12 }, scene);
        chain.position = new Vector3(0, 1.35, 0.32);
        chain.rotation.x = Math.PI / 2;
        const gold = new StandardMaterial('gold', scene);
        gold.diffuseColor = new Color3(1, 0.78, 0.2);
        gold.emissiveColor = new Color3(0.4, 0.28, 0.05);
        chain.material = gold;
        chain.parent = this.root;
        add(chain);
        break;
      }
      default:
        void skin;
    }
  }

  private buildNameplate(scene: Scene, avatar: string, name: string, characterId: string | null): void {
    const dt = new DynamicTexture('nameplate', { width: 256, height: 96 }, scene, false);
    dt.hasAlpha = true;
    const c = dt.getContext() as unknown as CanvasRenderingContext2D;
    c.clearRect(0, 0, 256, 96);
    c.fillStyle = 'rgba(10,10,18,0.72)';
    c.beginPath();
    c.roundRect(8, 8, 240, 80, 18);
    c.fill();
    c.font = '900 34px "Arial Black", Arial, sans-serif';
    c.textAlign = 'center';
    c.fillText(avatar, 44, 60);
    c.fillStyle = '#ffffff';
    c.font = '800 30px Arial, sans-serif';
    c.textAlign = 'left';
    c.fillText(name.length > 12 ? name.slice(0, 12) + '…' : name, 76, 62);
    // Barra col COLORE DEL GIOCATORE: nelle partite a squadre la maglia è del colore della squadra, l'identità si legge qui
    // (stesso colore del telefono, della classifica e dei risultati).
    const idColor = characterId ? getCharacter(characterId)?.color : undefined;
    if (idColor) {
      c.fillStyle = idColor;
      c.beginPath();
      c.roundRect(20, 74, 216, 8, 4);
      c.fill();
    }
    dt.update();

    const mat = new StandardMaterial('nameplateMat', scene);
    mat.diffuseTexture = dt;
    mat.emissiveColor = new Color3(1, 1, 1);
    mat.disableLighting = true;
    mat.backFaceCulling = false;

    const plate = MeshBuilder.CreatePlane('nameplatePlane', { width: 1.6, height: 0.6 }, scene);
    plate.position.y = 2.5;
    plate.material = mat;
    plate.billboardMode = Mesh.BILLBOARDMODE_ALL;
    plate.parent = this.root;
    this.extras.push(plate);
  }

  private makeParticles(scene: Scene, tex: Texture, emitter: Mesh, color: Color4, size: number, capacity: number): ParticleSystem {
    const ps = new ParticleSystem('arenaFx', capacity, scene);
    ps.particleTexture = tex;
    ps.emitter = emitter;
    ps.minEmitBox = new Vector3(-0.4, 0.4, -0.4);
    ps.maxEmitBox = new Vector3(0.4, 1.2, 0.4);
    ps.color1 = color;
    ps.color2 = color;
    ps.colorDead = new Color4(color.r, color.g, color.b, 0);
    ps.minSize = size * 0.6;
    ps.maxSize = size;
    ps.minLifeTime = 0.25;
    ps.maxLifeTime = 0.5;
    ps.emitRate = 0;
    ps.direction1 = new Vector3(-1, 1, -1);
    ps.direction2 = new Vector3(1, 2, 1);
    ps.minEmitPower = 1.5;
    ps.maxEmitPower = 3;
    ps.gravity = new Vector3(0, -2, 0);
    ps.start();
    return ps;
  }

  burstHit(): void {
    this.hitFx.emitRate = 0;
    this.hitFx.manualEmitCount = 40;
    this.hitFx.start();
  }

  /** Posizione locale della mano destra (per agganciare una palla tenuta in mano). */
  get handAnchor(): { x: number; y: number; z: number } {
    return { x: 0.62, y: 1.15, z: 0.3 };
  }

  /** Breve posa di tiro (braccia in avanti). */
  playThrow(): void {
    this.throwPose = 0.35;
  }

  /** Sincronizza mesh + animazioni procedurali con lo stato fisico. */
  updateVisual(p: VisualSubject, dt: number, now: number): void {
    // Posizione
    this.root.position.set(p.x, p.y, p.z);

    // Rotazione smussata verso la direzione di movimento.
    let targetFacing = p.facing;
    if (!p.alive) targetFacing += p.spin;
    let diff = targetFacing - this.visualFacing;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.visualFacing += diff * Math.min(1, dt * 12);
    this.root.rotation.y = this.visualFacing;

    const speed = Math.hypot(p.vx, p.vz);
    const speedFrac = Math.min(1, speed / MAX_SPEED);
    const t = now * 0.001;
    const runPhase = t * (6 + speedFrac * 10);

    // Rimbalzo idle / corsa
    const bob = Math.sin(t * (2 + speedFrac * 8) + this.bobSeed) * (0.02 + speedFrac * 0.05);
    this.torso.position.y = 1.05 + bob;

    // Lean
    const lean = p.dashing ? 0.42 : speedFrac * 0.18;
    this.root.rotation.x = lean;

    // Gambe e braccia
    const swing = p.dashing ? 0.25 : speedFrac * 0.7;
    this.legLPivot.rotation.x = Math.sin(runPhase) * swing;
    this.legRPivot.rotation.x = -Math.sin(runPhase) * swing;
    this.armLPivot.rotation.x = -Math.sin(runPhase) * swing;
    this.armRPivot.rotation.x = Math.sin(runPhase) * swing;
    if (p.dashing) {
      this.armLPivot.rotation.z = -0.9;
      this.armRPivot.rotation.z = 0.9;
    } else {
      this.armLPivot.rotation.z = Math.sin(runPhase * 0.5) * 0.1;
      this.armRPivot.rotation.z = -Math.sin(runPhase * 0.5) * 0.1;
    }

    // Posa di tiro (braccia in avanti), usata da dodgeball.
    if (this.throwPose > 0) {
      this.throwPose -= dt;
      this.armLPivot.rotation.x = -1.6;
      this.armRPivot.rotation.x = -1.6;
    }

    // Stordimento: squash + tremore
    if (p.stunTime > 0) {
      const shake = Math.sin(now * 0.06) * 0.06;
      this.root.rotation.z = shake;
      this.root.scaling.set(0.82, 0.82, 0.82);
    } else {
      this.root.rotation.z = 0;
      const s = p.dashing ? 1.08 : 1;
      this.root.scaling.set(p.dashing ? 0.94 : s, p.dashing ? 0.94 : s, p.dashing ? 1.1 : s);
    }

    // Flash bianco sul colpo subito
    const flash = p.hitFlash > 0 ? 1 : 0;
    for (const m of this.bodyMats) m.emissiveColor = new Color3(flash, flash, flash);

    // Particelle: scia in dash e, piu' rada, mentre vieni sbalzato via da un colpo (si vede chi vola e in che direzione)
    const knocked = p.stunTime > 0.12 && speed > 6.5;
    this.dashFx.emitRate = p.dashing ? 90 : knocked ? 60 : 0;

    // Caduta / vittoria: spin
    if (p.falling) {
      this.root.rotation.x = Math.sin(now * 0.01) * 0.5;
      const s = Math.max(0.2, 1 - p.spin * 0.05);
      this.root.scaling.setAll(s);
      if (p.y < -22 && this.root.isEnabled()) this.root.setEnabled(false); // caduto nel vuoto: non si disegna piu'
    }
  }

  dispose(): void {
    this.dashFx.dispose();
    this.hitFx.dispose();
    for (const m of this.bodyMats) m.dispose();
    this.root.dispose();
  }
}
