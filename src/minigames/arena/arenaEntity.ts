import { Scene, Mesh, MeshBuilder, StandardMaterial, Color3, Color4, Vector3, TransformNode, ParticleSystem, Texture, DynamicTexture } from '@babylonjs/core';
import { MAX_SPEED } from './arenaTypes';
import { getCharacter } from '../../../shared/characters';
import { presentationOf, bark } from '../../../shared/characterPresentation';
import type { CharacterPresentation, ReactionKind } from '../../../shared/characterPresentation';
import { buildCharacterRig, makeCharMaterials, makeSymbolPlane } from '../characters/characterModel';
import type { CharMaterials, CharRig } from '../characters/characterModel';
import { audio } from '../../core/AudioManager';

/** Sottoinsieme di stato letto da updateVisual (condiviso tra arena, dodgeball, calcio e pallavolo). */
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
  /** dodgeball: schivata in corso (solo per la posa) */
  dodgeTime?: number;
}

export interface EntityOptions {
  /** test silhouette: tutto grigio, nessuna targhetta (si devono riconoscere dalla forma) */
  neutral?: boolean;
  /** targhetta col nome sopra la testa (default sì) */
  nameplate?: boolean;
}

type ActionKind = 'throw' | 'kick' | 'spike';
type Celebration = 'victory' | 'defeat' | null;

const ABILITY_DUR = 0.8;
const HIT_DUR = 0.38;
const POPUP_ABILITY_DUR = 1.25;
const POPUP_BARK_DUR = 2.1;

/**
 * PERSONAGGIO 3D condiviso da Arena, Dodgeball, Calcio e Pallavolo. Il modello (proporzioni + accessori) viene dal DNA del
 * personaggio; le animazioni sono UNA base comune (idle, corsa, salto, dash, azione, colpo, stordimento, caduta, abilita',
 * vittoria, sconfitta) con la variazione di ciascuno (Goblin nervoso, Buttafuori pesante, Judoka basso, Dottore rilassato,
 * Ciro furbetto). Solo grafica: la fisica la fa il gioco, qui si legge lo stato e si disegna.
 */
export class ArenaEntity {
  readonly root: TransformNode;
  private readonly rig: CharRig;
  private readonly pres: CharacterPresentation | null;
  private readonly mats: CharMaterials;
  private readonly dashFx: ParticleSystem;
  private readonly hitFx: ParticleSystem;
  private readonly abilityFx: ParticleSystem;
  private readonly bobSeed: number;
  private visualFacing = 0;
  private readonly baseLean: number;
  // one-shot
  private actionT = 0;
  private actionKind: ActionKind = 'throw';
  private abilityT = 0;
  private hitT = 0;
  private hitBig = false;
  private prevHitFlash = 0;
  private celebration: Celebration = null;
  private celebrateT = 0;
  // VFX personali
  private readonly popup: Mesh;
  private readonly popupTex: DynamicTexture;
  private popupT = 0;
  private popupDur = 0;
  private readonly symbol: Mesh;
  private symbolT = 0;
  private readonly ring: Mesh | null;
  private ringT = 0;
  private stingQueue: { at: number; freq: number }[] = [];
  private clock = 0;
  private readonly nameplateY: number;

  constructor(
    scene: Scene,
    dotTexture: Texture,
    colorHex: string,
    characterId: string | null,
    avatar: string,
    name: string,
    /** squadra (calcio/pallavolo): maglia del colore della squadra + distintivo con FORMA e PAROLA sul cartellino */
    team: 'red' | 'blue' | null = null,
    opts: EntityOptions = {}
  ) {
    this.root = new TransformNode('arenaChar', scene);
    this.bobSeed = Math.random() * 1000;
    this.pres = presentationOf(characterId);
    this.mats = makeCharMaterials(scene, this.pres, colorHex, !!opts.neutral);
    this.rig = buildCharacterRig(scene, this.root, this.pres, this.mats, !!team);
    this.baseLean = this.pres?.body.lean ?? 0;

    const top = team ? 26 : 0;
    this.nameplateY = this.rig.topY + 0.42 + top / 320;
    if (opts.nameplate !== false && !opts.neutral) this.buildNameplate(scene, avatar, name, characterId, team);

    // Ancoraggio particelle (mesh invisibile che segue il personaggio).
    const fxAnchor = MeshBuilder.CreateBox('arenaFxAnchor', { size: 0.05 }, scene);
    fxAnchor.isVisible = false;
    fxAnchor.parent = this.root;

    const trail = Color3.FromHexString(this.pres?.trail ?? colorHex);
    this.dashFx = this.makeParticles(scene, dotTexture, fxAnchor, new Color4(trail.r, trail.g, trail.b, 0.9), 0.16, 40);
    this.hitFx = this.makeParticles(scene, dotTexture, fxAnchor, new Color4(1, 0.95, 0.4, 1), 0.2, 60);
    const a1 = Color3.FromHexString(this.pres?.accent ?? colorHex);
    const a2 = Color3.FromHexString(this.pres?.secondaryAccent ?? '#ffffff');
    this.abilityFx = this.makeParticles(scene, dotTexture, fxAnchor, new Color4(a1.r, a1.g, a1.b, 1), 0.24, 40);
    this.abilityFx.color2 = new Color4(a2.r, a2.g, a2.b, 1);
    this.abilityFx.minEmitPower = 2.5;
    this.abilityFx.maxEmitPower = 4.5;

    // Popup (nome abilita' / battuta) e simbolo dell'abilita': create una volta, riusate (niente allocazioni durante il gioco)
    this.popupTex = new DynamicTexture('charPopup', { width: 512, height: 128 }, scene, false);
    this.popupTex.hasAlpha = true;
    const pm = new StandardMaterial('charPopupMat', scene);
    pm.diffuseTexture = this.popupTex;
    pm.emissiveColor = new Color3(1, 1, 1);
    pm.disableLighting = true;
    pm.backFaceCulling = false;
    pm.useAlphaFromDiffuseTexture = true;
    this.popup = MeshBuilder.CreatePlane('charPopupPlane', { width: 3.4, height: 0.85 }, scene);
    this.popup.material = pm;
    this.popup.billboardMode = Mesh.BILLBOARDMODE_ALL;
    this.popup.parent = this.root;
    this.popup.isVisible = false;
    this.popup.isPickable = false;

    this.symbol = makeSymbolPlane(scene, this.pres?.symbol ?? '✨', 0.8);
    this.symbol.parent = this.root;

    // Onda d'urto personale (Buttafuori: l'abilita' "pesa")
    if (this.pres?.abilityStyle === 'focus') {
      this.ring = MeshBuilder.CreateTorus('charRing', { diameter: 1.2, thickness: 0.07, tessellation: 24 }, scene);
      const rm = new StandardMaterial('charRingMat', scene);
      rm.emissiveColor = a1;
      rm.diffuseColor = a1;
      rm.disableLighting = true;
      this.ring.material = rm;
      this.ring.parent = this.root;
      this.ring.position.y = 0.08;
      this.ring.isVisible = false;
      this.ring.isPickable = false;
    } else this.ring = null;
  }

  private buildNameplate(scene: Scene, avatar: string, name: string, characterId: string | null, team: 'red' | 'blue' | null): void {
    // con la squadra il cartellino cresce di una fascia in alto (distintivo); altrimenti resta identico
    const top = team ? 26 : 0;
    const dt = new DynamicTexture('nameplate', { width: 256, height: 96 + top }, scene, false);
    dt.hasAlpha = true;
    const c = dt.getContext() as unknown as CanvasRenderingContext2D;
    c.clearRect(0, 0, 256, 96 + top);
    if (team) {
      const col = team === 'red' ? '#ef4444' : '#3b82f6';
      c.fillStyle = 'rgba(10,10,18,0.85)';
      c.beginPath();
      c.roundRect(60, 2, 136, 26, 13);
      c.fill();
      c.fillStyle = col;
      c.font = '900 20px "Arial Black", Arial, sans-serif';
      c.textAlign = 'center';
      c.fillText(team === 'red' ? '▲ ROSSI' : '● BLU', 128, 22);
    }
    c.fillStyle = 'rgba(10,10,18,0.72)';
    c.beginPath();
    c.roundRect(8, 8 + top, 240, 80, 18);
    c.fill();
    c.font = '900 34px "Arial Black", Arial, sans-serif';
    c.textAlign = 'center';
    c.fillText(avatar, 44, 60 + top);
    c.fillStyle = '#ffffff';
    c.font = '800 30px Arial, sans-serif';
    c.textAlign = 'left';
    c.fillText(name.length > 12 ? name.slice(0, 12) + '…' : name, 76, 62 + top);
    // Barra col COLORE DEL GIOCATORE: nelle partite a squadre la maglia è del colore della squadra, l'identità si legge qui
    // (stesso colore del telefono, della classifica e dei risultati).
    const idColor = characterId ? getCharacter(characterId)?.color : undefined;
    if (idColor) {
      c.fillStyle = idColor;
      c.beginPath();
      c.roundRect(20, 74 + top, 216, 8, 4);
      c.fill();
    }
    dt.update();

    const mat = new StandardMaterial('nameplateMat', scene);
    mat.diffuseTexture = dt;
    mat.emissiveColor = new Color3(1, 1, 1);
    mat.disableLighting = true;
    mat.backFaceCulling = false;

    const plate = MeshBuilder.CreatePlane('nameplatePlane', { width: 1.6, height: (96 + top) / 160 }, scene);
    plate.position.y = this.nameplateY;
    plate.material = mat;
    plate.billboardMode = Mesh.BILLBOARDMODE_ALL;
    plate.parent = this.root;
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

  // ------------------------------------------------------------------ API per i giochi (solo grafica)

  burstHit(): void {
    this.hitFx.emitRate = 0;
    this.hitFx.manualEmitCount = 40;
    this.hitFx.start();
  }

  /** Posizione locale della mano destra (per agganciare una palla tenuta in mano). */
  get handAnchor(): { x: number; y: number; z: number } {
    return { x: this.rig.armR.position.x * 0.86, y: this.rig.hipY + this.rig.shoulderY - this.rig.armLen * 0.42, z: 0.3 };
  }

  /** Breve posa di tiro (braccia in avanti). */
  playThrow(): void {
    this.actionKind = 'throw';
    this.actionT = 0.35;
  }

  /** Calcio al pallone: gamba destra in avanti. */
  playKick(): void {
    this.actionKind = 'kick';
    this.actionT = 0.32;
  }

  /** Colpo / schiacciata a pallavolo: braccio destro in alto. */
  playSpike(): void {
    this.actionKind = 'spike';
    this.actionT = 0.32;
  }

  /**
   * ATTIVAZIONE ABILITA' (linguaggio comune): posa del personaggio + piccolo VFX personale + nome dell'abilita' sopra la testa +
   * sting sonoro breve. Il feedback di gioco (testo nel feed, vibrazione, effetto) resta quello del gioco. Non blocca i controlli.
   */
  playAbility(label?: string): void {
    this.abilityT = ABILITY_DUR;
    this.abilityFx.manualEmitCount = 26;
    this.abilityFx.start();
    this.symbolT = 0.95;
    this.symbol.isVisible = true;
    if (this.ring) {
      this.ringT = 0.5;
      this.ring.isVisible = true;
    }
    if (label) this.showPopup(label, 'ability');
    const notes = this.pres?.sting.notes ?? [];
    this.stingQueue = notes.map((n, i) => ({ at: this.clock + i * 0.07, freq: 440 * Math.pow(2, n / 12) }));
  }

  /** Posa di vittoria del personaggio: per `sec` secondi (gol, punto) o fino alla fine (fine round). */
  playVictory(sec = Infinity): void {
    this.celebration = 'victory';
    this.celebrateT = 0;
    this.celebrateUntil = sec;
  }

  /** Posa di sconfitta del personaggio: per `sec` secondi (gol subito, autogol) o fino alla fine (eliminato, fine round). */
  playDefeat(sec = Infinity): void {
    this.celebration = 'defeat';
    this.celebrateT = 0;
    this.celebrateUntil = sec;
  }

  /** Esultanza breve (gol, punto): vittoria per `sec` secondi, poi si torna a giocare. */
  celebrate(sec = 1.6): void {
    this.playVictory(sec);
  }
  private celebrateUntil = Infinity;

  /** Battuta del personaggio (rara: decide shared/characterPresentation.bark); true se e' stata detta. */
  react(kind: ReactionKind, force = false): boolean {
    const line = bark(this.pres?.id, kind, { force });
    if (!line) return false;
    this.showPopup(line, 'bark');
    return true;
  }

  private showPopup(text: string, kind: 'ability' | 'bark'): void {
    // un nome d'abilita' ha la precedenza su una battuta gia' a schermo (non il contrario)
    if (kind === 'bark' && this.popupT > 0 && this.popupKind === 'ability') return;
    this.popupKind = kind;
    const c = this.popupTex.getContext() as unknown as CanvasRenderingContext2D;
    c.clearRect(0, 0, 512, 128);
    const accent = this.pres?.accent ?? '#fbbf24';
    let size = 64;
    c.font = `900 ${size}px "Arial Black", Arial, sans-serif`;
    while (c.measureText(text).width > 470 && size > 26) {
      size -= 4;
      c.font = `900 ${size}px "Arial Black", Arial, sans-serif`;
    }
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    if (kind === 'bark') {
      // fumetto bianco con codina: e' il personaggio che parla
      const w = Math.min(500, c.measureText(text).width + 50);
      c.fillStyle = 'rgba(255,255,255,0.95)';
      c.strokeStyle = accent;
      c.lineWidth = 6;
      c.beginPath();
      c.roundRect(256 - w / 2, 10, w, 92, 30);
      c.fill();
      c.stroke();
      c.beginPath();
      c.moveTo(236, 98);
      c.lineTo(256, 124);
      c.lineTo(270, 98);
      c.fill();
      c.fillStyle = '#111827';
      c.fillText(text, 256, 58);
    } else {
      // nome dell'abilita': lettere grandi nel colore del personaggio, bordo scuro (leggibile su ogni campo)
      c.lineWidth = 12;
      c.lineJoin = 'round';
      c.strokeStyle = '#0b0b14';
      c.strokeText(text, 256, 64);
      c.fillStyle = accent;
      c.fillText(text, 256, 64);
    }
    this.popupTex.update();
    this.popupDur = kind === 'bark' ? POPUP_BARK_DUR : POPUP_ABILITY_DUR;
    this.popupT = this.popupDur;
    this.popup.isVisible = true;
  }
  private popupKind: 'ability' | 'bark' = 'bark';

  // ------------------------------------------------------------------ animazione

  /** Sincronizza mesh + animazioni procedurali con lo stato fisico. */
  updateVisual(p: VisualSubject, dt: number, now: number): void {
    this.clock += dt;
    const r = this.rig;
    const pres = this.pres;
    const gait = pres?.gait ?? { step: 1, swing: 1, bob: 1, jitter: 0, sway: 0 };

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
    const t = now * 0.001 + this.bobSeed;
    const runPhase = t * (6 + speedFrac * 10) * gait.step;

    // timer one-shot
    if (p.hitFlash > 0 && this.prevHitFlash <= 0) {
      this.hitT = HIT_DUR;
      this.hitBig = p.stunTime > 0.35 || speed > 7;
    }
    this.prevHitFlash = p.hitFlash;
    this.actionT = Math.max(0, this.actionT - dt);
    this.abilityT = Math.max(0, this.abilityT - dt);
    this.hitT = Math.max(0, this.hitT - dt);
    if (this.celebration) {
      this.celebrateT += dt;
      if (this.celebrateT > this.celebrateUntil) {
        this.celebration = null;
        this.celebrateUntil = Infinity;
      }
    }

    // ---- BASE: corsa / idle (stessa per tutti), ampiezze dal DNA
    const bob = Math.sin(t * (2 + speedFrac * 8) * gait.step) * (0.02 + speedFrac * 0.05) * gait.bob;
    r.upper.position.y = r.hipY + bob;
    r.upper.position.x = 0;
    r.upper.rotation.x = this.baseLean;
    r.upper.rotation.z = Math.sin(runPhase * 0.5) * 0.07 * gait.sway * (0.4 + speedFrac);
    r.upper.rotation.y = 0;
    r.head.rotation.set(0, gait.jitter ? Math.sin(t * 11) * 0.05 * gait.jitter : 0, 0);
    for (const e of r.eyes) e.scaling.setAll(1);

    // Lean del corpo intero (corsa/dash)
    this.root.rotation.x = p.dashing ? 0.42 : speedFrac * 0.18;

    const swing = (p.dashing ? 0.25 : speedFrac * 0.7) * gait.swing;
    r.legL.rotation.x = Math.sin(runPhase) * swing;
    r.legR.rotation.x = -Math.sin(runPhase) * swing;
    let aLx = -Math.sin(runPhase) * swing;
    let aRx = Math.sin(runPhase) * swing;
    let aLz = Math.sin(runPhase * 0.5) * 0.1;
    let aRz = -Math.sin(runPhase * 0.5) * 0.1;
    if (p.dashing) {
      aLz = -0.9;
      aRz = 0.9;
    }

    const still = speedFrac < 0.12 && !p.dashing && p.alive && !p.falling;
    const busy = this.actionT > 0 || this.abilityT > 0 || this.hitT > 0 || this.celebration !== null;
    // ---- IDLE con personalita'
    if (still && !busy && pres) {
      const cyc = (period: number, len: number): number => {
        const ph = (t % period) / period;
        return ph < len ? Math.sin((ph / len) * Math.PI) : 0;
      };
      switch (pres.idleStyle) {
        case 'impatient': {
          // Goblin: saltella sulle punte, si guarda intorno, ogni tanto un sorso
          r.upper.position.y += Math.abs(Math.sin(t * 7)) * 0.05;
          r.head.rotation.y = Math.sin(t * 1.7) * 0.4;
          aLx = -0.35;
          aRx = -0.35 + Math.sin(t * 7) * 0.15;
          const sip = cyc(4.2, 0.18);
          aLx -= sip * 1.9;
          aLz = sip * -0.5;
          r.head.rotation.x = -sip * 0.3;
          break;
        }
        case 'guard': {
          // Buttafuori: guardia da pugile leggera, pesa da un piede all'altro
          aLx = -1.25 + Math.sin(t * 5) * 0.06;
          aRx = -1.4 - Math.sin(t * 5) * 0.06;
          aLz = -0.4;
          aRz = 0.4;
          r.upper.position.y += Math.sin(t * 5) * 0.025;
          r.upper.rotation.z = Math.sin(t * 2.5) * 0.06;
          break;
        }
        case 'belt': {
          // Judoka: pronto a sbilanciare, ogni tanto si sistema la cintura
          aLx = -0.55;
          aRx = -0.55;
          aLz = -0.3;
          aRz = 0.3;
          const fix = cyc(3.6, 0.25);
          aLx = aLx * (1 - fix) - 0.2 * fix;
          aRx = aRx * (1 - fix) - 0.2 * fix;
          aLz = aLz * (1 - fix) + 0.75 * fix;
          aRz = aRz * (1 - fix) - 0.75 * fix;
          r.head.rotation.x = fix * 0.35;
          r.upper.position.y += Math.sin(t * 3) * 0.015;
          break;
        }
        case 'relaxed': {
          // Dottore: tranquillo e convinto, dondola piano, ogni tanto un tiro di sigaretta
          r.upper.rotation.z = Math.sin(t * 0.9) * 0.06;
          aLz = -0.22;
          aRz = 0.22;
          const smoke = cyc(5, 0.22);
          aRx = -smoke * 2.1;
          aRz = 0.22 - smoke * 0.75;
          r.head.rotation.x = -0.08 - smoke * 0.1;
          break;
        }
        case 'pockets': {
          // Ciro: mani vicino alle tasche, controlla gli spicci, lancia la monetina
          aLx = 0.32;
          aRx = 0.32;
          aLz = 0.12;
          aRz = -0.12;
          const flip = cyc(3.2, 0.3);
          aLx = aLx * (1 - flip) - 1.1 * flip;
          if (r.prop) {
            r.prop.position.y = -r.armLen - 0.06 + flip * 0.45;
            r.prop.rotation.x = flip * Math.PI * 4;
          }
          r.head.rotation.z = Math.sin(t * 1.3) * 0.08;
          r.upper.rotation.z = Math.sin(t * 1.3) * 0.05;
          break;
        }
      }
    } else if (r.prop && pres?.idleStyle === 'pockets') {
      r.prop.position.y = -r.armLen - 0.06;
      r.prop.rotation.x = 0;
    }

    // ---- SALTO (pallavolo): gambe raccolte, braccia su
    if (p.alive && !p.falling && p.y > 0.08) {
      r.legL.rotation.x = -0.7;
      r.legR.rotation.x = 0.35;
      aLx = -2.5;
      aRx = -2.7;
    }
    // ---- SCHIVATA (dodgeball): busto di lato, variazione per personaggio
    if ((p.dodgeTime ?? 0) > 0) {
      const amt = pres?.hitStyle === 'dodge' ? 0.55 : pres?.hitStyle === 'absorb' ? 0.25 : 0.4;
      r.upper.rotation.z = amt;
      aLz = -1;
      aRz = 1;
    }
    // ---- AZIONE (tiro / calcio / schiacciata)
    if (this.actionT > 0) {
      if (this.actionKind === 'throw') {
        aLx = -1.6;
        aRx = -1.6;
      } else if (this.actionKind === 'kick') {
        r.legR.rotation.x = -1.25;
        r.legL.rotation.x = 0.3;
        aLz = -0.7;
        aRz = 0.7;
      } else {
        aRx = -2.95;
        aLx = -1.2;
      }
    }
    // ---- COLPO SUBITO (dallo stato: hitFlash appena acceso)
    if (this.hitT > 0 && pres) {
      const k = Math.sin((this.hitT / HIT_DUR) * Math.PI) * (this.hitBig ? 1 : 0.6);
      switch (pres.hitStyle) {
        case 'flinch':
          r.upper.rotation.x -= 0.55 * k;
          aLx = -1.1 * k;
          aRx = -1.1 * k;
          break;
        case 'absorb':
          // incassa bene: si piega appena, la guardia resta su
          r.upper.rotation.x -= 0.15 * k;
          aLx = -1.3;
          aRx = -1.3;
          break;
        case 'stagger':
          r.upper.rotation.z = 0.4 * k;
          r.upper.rotation.x -= 0.25 * k;
          break;
        case 'wobble':
          r.head.rotation.z = Math.sin(this.hitT * 40) * 0.35 * k;
          r.upper.rotation.x -= 0.3 * k;
          break;
        case 'dodge':
          r.upper.rotation.z = -0.45 * k;
          aLx = -2.2 * k;
          aRx = -2.2 * k;
          break;
      }
    }
    // ---- ABILITA'
    if (this.abilityT > 0 && pres) {
      const e = 1 - this.abilityT / ABILITY_DUR; // 0 -> 1
      const k = Math.sin(e * Math.PI);
      switch (pres.abilityStyle) {
        case 'burst':
          // Goblin: si carica e scatta col pugno al cielo
          if (e < 0.3) {
            r.upper.position.y -= 0.14 * (e / 0.3);
            aLx = 0.3;
            aRx = 0.3;
          } else {
            r.upper.position.y += 0.12 * k;
            aRx = -3.05;
            aLx = -0.8;
          }
          break;
        case 'focus':
          // Buttafuori: improvvisamente concentrato, guardia stretta, peso in avanti
          r.upper.rotation.x += 0.3 * k;
          aLx = -1.45;
          aRx = -1.45;
          aLz = -0.6;
          aRz = 0.6;
          this.root.scaling.setAll(1 + 0.07 * k);
          break;
        case 'wait':
          // Judoka: "aspetta, aspetta!" — mani avanti che sventolano
          aLx = -1.5;
          aRx = -1.5;
          aLz = -0.25 + Math.sin(this.abilityT * 26) * 0.3;
          aRz = 0.25 - Math.sin(this.abilityT * 26) * 0.3;
          r.head.rotation.z = Math.sin(this.abilityT * 13) * 0.15;
          break;
        case 'lightbulb':
          // Dottore: lampo — testa indietro, occhi spalancati, braccia su
          r.head.rotation.x = -0.35 * k;
          for (const eye of r.eyes) eye.scaling.setAll(1 + 0.7 * k);
          aLx = -2.4 * k;
          aRx = -2.4 * k;
          aLz = -0.5 * k;
          aRz = 0.5 * k;
          break;
        case 'timer':
          // Ciro: guarda il polso (il debito parte), monetina che gira
          aLx = -1.75;
          aLz = -0.95;
          r.head.rotation.x = 0.3 * k;
          r.head.rotation.y = -0.3 * k;
          if (r.prop) r.prop.rotation.x = this.abilityT * 30;
          break;
      }
    }
    // ---- VITTORIA / SCONFITTA (fine round, gol, punto)
    if (this.celebration && pres) {
      const c = this.celebrateT;
      if (this.celebration === 'victory') {
        switch (pres.victoryStyle) {
          case 'football':
            // Goblin: esultanza da stadio, pugni alternati e saltelli
            aLx = -2.6 - Math.sin(c * 12) * 0.35;
            aRx = -2.6 + Math.sin(c * 12) * 0.35;
            r.upper.position.y += Math.abs(Math.sin(c * 8)) * 0.12;
            r.upper.rotation.x = -0.2;
            r.head.rotation.x = -0.25;
            break;
          case 'gotIt':
            // Buttafuori: prima sorpreso... poi "MO HO CAPITO" a pugni alzati
            if (c < 0.8) {
              aLz = -1.2;
              aRz = 1.2;
              aLx = -0.3;
              aRx = -0.3;
              r.head.rotation.x = -0.3;
            } else {
              aLx = -2.9 + Math.sin(c * 9) * 0.2;
              aRx = -2.9 - Math.sin(c * 9) * 0.2;
              r.upper.position.y += Math.abs(Math.sin(c * 6)) * 0.06;
            }
            break;
          case 'ippon':
            // Judoka: braccio teso al cielo (ippon), l'altro sul fianco
            aRx = -3.1;
            aRz = -0.08;
            aLx = 0.3;
            aLz = 0.75;
            r.head.rotation.x = -0.15;
            break;
          case 'toldYou':
            // Dottore: braccia conserte, annuisce: "ve l'avevo detto"
            aLx = -1.35;
            aRx = -1.35;
            aLz = 0.95;
            aRz = -0.95;
            r.upper.rotation.x = this.baseLean - 0.12;
            r.head.rotation.x = Math.sin(c * 4) * 0.15;
            break;
          case 'dodgedPayment':
            // Ciro: balletto furbo, si strofina le mani come se l'avesse scampata
            r.upper.rotation.z = Math.sin(c * 6) * 0.22;
            r.upper.position.y += Math.abs(Math.sin(c * 6)) * 0.05;
            aLx = -1.2;
            aRx = -1.2;
            aLz = 0.5 + Math.sin(c * 14) * 0.15;
            aRz = -0.5 + Math.sin(c * 14) * 0.15;
            break;
        }
      } else {
        switch (pres.defeatStyle) {
          case 'nculo': {
            // Goblin: mani in testa, poi il gesto "ma n'culo"
            const ph = c % 1.6;
            if (ph < 0.7) {
              aLx = -2.6;
              aRx = -2.6;
              aLz = 0.55;
              aRz = -0.55;
            } else {
              aLx = 0.35;
              aRx = 0.35;
              aLz = -0.85;
              aRz = 0.85;
            }
            r.head.rotation.y = Math.sin(c * 7) * 0.2;
            break;
          }
          case 'confused':
            // Buttafuori: si guarda intorno, ancora a capire cos'e' successo; ogni tanto si gratta la testa
            r.head.rotation.y = Math.sin(c * 1.8) * 0.65;
            aLz = -0.25;
            aRz = 0.25;
            if (c % 3 > 2) {
              aRx = -2.5;
              aRz = -0.4;
            }
            break;
          case 'protest':
            // Judoka: protesta e spiega la regola, indice puntato
            aRx = -1.5 + Math.sin(c * 9) * 0.28;
            aLx = 0.3;
            aLz = 0.75;
            r.upper.rotation.x = this.baseLean + 0.15;
            r.head.rotation.y = Math.sin(c * 5) * 0.15;
            break;
          case 'shrug':
            // Dottore: spallucce, continua a fare quello che sa tutto
            aLx = -0.6;
            aRx = -0.6;
            aLz = -1.0;
            aRz = 1.0;
            r.upper.position.y += Math.max(0, Math.sin(c * 5)) * 0.05;
            r.head.rotation.z = 0.15;
            break;
          case 'clause':
            // Ciro: braccia su, "c'e' una clausola!"
            aLx = -2.5;
            aRx = -2.5;
            aLz = -0.4 - Math.sin(c * 7) * 0.3;
            aRz = 0.4 - Math.sin(c * 7) * 0.3;
            r.head.rotation.z = Math.sin(c * 3.5) * 0.12;
            break;
        }
      }
    }

    r.armL.rotation.x = aLx;
    r.armR.rotation.x = aRx;
    r.armL.rotation.z = aLz;
    r.armR.rotation.z = aRz;

    // Stordimento: squash + tremore
    if (p.stunTime > 0) {
      const shake = Math.sin(now * 0.06) * 0.06;
      this.root.rotation.z = shake;
      this.root.scaling.set(0.82, 0.82, 0.82);
    } else {
      this.root.rotation.z = 0;
      if (!(this.abilityT > 0 && pres?.abilityStyle === 'focus')) {
        const s = p.dashing ? 1.08 : 1;
        this.root.scaling.set(p.dashing ? 0.94 : s, p.dashing ? 0.94 : s, p.dashing ? 1.1 : s);
      }
    }

    // Flash bianco sul colpo subito
    const flash = p.hitFlash > 0 ? 1 : 0;
    for (const m of this.mats.all) m.emissiveColor.set(flash, flash, flash);
    if (!flash && this.mats.all.length > 1) this.mats.gold.emissiveColor.set(0.34, 0.27, 0.05);
    // Dottore: lampo "M'HO SVEJATO" sulla testa
    if (this.abilityT > 0 && pres?.abilityStyle === 'lightbulb') {
      const k = Math.sin((1 - this.abilityT / ABILITY_DUR) * Math.PI);
      this.mats.skin.emissiveColor.set(0.6 * k, 0.55 * k, 0.2 * k);
    }

    // Particelle: scia in dash e, piu' rada, mentre vieni sbalzato via da un colpo (si vede chi vola e in che direzione)
    const knocked = p.stunTime > 0.12 && speed > 6.5;
    this.dashFx.emitRate = p.dashing ? 90 : knocked ? 60 : 0;

    // Caduta: spin
    if (p.falling) {
      this.root.rotation.x = Math.sin(now * 0.01) * 0.5;
      const s = Math.max(0.2, 1 - p.spin * 0.05);
      this.root.scaling.setAll(s);
      if (p.y < -22 && this.root.isEnabled()) this.root.setEnabled(false); // caduto nel vuoto: non si disegna piu'
    }

    this.updateFx(dt);
  }

  private updateFx(dt: number): void {
    // popup (nome abilita' / battuta): sale piano e sfuma alla fine
    if (this.popupT > 0) {
      this.popupT -= dt;
      const life = 1 - this.popupT / this.popupDur;
      this.popup.position.y = this.nameplateY + 0.85 + life * 0.25;
      this.popup.visibility = this.popupT < 0.3 ? Math.max(0, this.popupT / 0.3) : Math.min(1, life * 8);
      const pop = life < 0.12 ? 0.7 + (life / 0.12) * 0.3 : 1;
      this.popup.scaling.setAll(pop);
      if (this.popupT <= 0) this.popup.isVisible = false;
    }
    // simbolo dell'abilita'
    if (this.symbolT > 0) {
      this.symbolT -= dt;
      const life = 1 - this.symbolT / 0.95;
      this.symbol.position.set(0.55, this.rig.topY + 0.1 + life * 0.9, 0);
      this.symbol.scaling.setAll(life < 0.15 ? 0.4 + (life / 0.15) * 0.8 : 1.2 - life * 0.3);
      this.symbol.visibility = this.symbolT < 0.3 ? Math.max(0, this.symbolT / 0.3) : 1;
      if (this.symbolT <= 0) this.symbol.isVisible = false;
    }
    // onda d'urto
    if (this.ring && this.ringT > 0) {
      this.ringT -= dt;
      const life = 1 - this.ringT / 0.5;
      this.ring.scaling.set(1 + life * 2.6, 1, 1 + life * 2.6);
      this.ring.visibility = 1 - life;
      if (this.ringT <= 0) this.ring.isVisible = false;
    }
    // sting sonoro (note in fila, senza timer JS)
    while (this.stingQueue.length && this.stingQueue[0].at <= this.clock) {
      const n = this.stingQueue.shift()!;
      audio.playTone(n.freq, 0.08, this.pres?.sting.wave ?? 'triangle', 0.035);
    }
  }

  dispose(): void {
    this.dashFx.dispose();
    this.hitFx.dispose();
    this.abilityFx.dispose();
    this.stingQueue = [];
    for (const m of this.mats.all) m.dispose();
    this.root.dispose(false, true);
  }
}
