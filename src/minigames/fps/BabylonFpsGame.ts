import { Engine, Scene, Color4, Color3, StandardMaterial, MeshBuilder, Mesh, UniversalCamera, Viewport, Vector3, TransformNode, DynamicTexture, HemisphericLight, DirectionalLight } from '@babylonjs/core';
import { AdvancedDynamicTexture, TextBlock, Rectangle, Control } from '@babylonjs/gui';
import type { PlayerId } from '../../../shared/types';
import { buildFpsWorld, buildFpsLights } from '../../controller/fpsWorld';
import { registerEnvScene } from '../env/envDebug';
import { splitScreenLayout } from '../kart-race/cameraHud';
import { getWeapon } from '../../../shared/fpsWeapons';
import { guardLoop, safely } from '../../core/loopGuard';
import { applyQuality, engineOptions, getQualityInfo } from '../../core/quality';
import { debugEnabled } from '../../core/debug';
import { presentationOf } from '../../../shared/characterPresentation';
import { decorateHead, makeCharMaterials } from '../characters/characterModel';
import { FpsViewmodel, recoilOf } from '../../controller/fpsViewmodel';
import * as sfx from '../../controller/fpsAudio';
import { audio } from '../../core/AudioManager';
import { getQualityLevel } from '../../core/quality';
import { CHAR_ICONS, drawIcon, iconDataUrl } from '../../../shared/charIcons';
import { Image as GuiImage } from '@babylonjs/gui';
import { FONT_DISPLAY } from '../../core/uiTokens';
import { stateLabel, abilityFor } from '../../../shared/abilityCatalog';
import type { AbilityStatus } from '../../../shared/abilityCatalog';

/** Chi ha una finestra nello split-screen: identita' visiva = nome + colore del giocatore, mai l'indice del controller. */
export interface FpsLocalPlayer {
  id: PlayerId;
  name: string;
  color: string;
  /** per l'icona vettoriale accanto al nome della finestra */
  characterId?: string | null;
}

// Avviso SOLO in debug (mai durante una serata normale): FPS sotto soglia per qualche secondo con l'auto-quality gia' al minimo.
const PERF_WARN_FPS = 20;
const PERF_WARN_AFTER_MS = 3000;

/**
 * SPLIT-SCREEN HOST per la Sparatoria dei Disagiati (Milestone 6). Una SOLA scena Babylon, più camere/viewport —
 * stessa tecnica di kart-race/cameraHud.ts (splitScreenLayout, riusata da lì: nessun secondo layout duplicato).
 *
 * Questo livello NON simula nulla (niente fisica/danno/respawn: quello resta in FpsScene.ts, unica autorità, già
 * testato). Ogni frame legge uno snapshot di sola lettura di FpsScene e disegna: livello statico (buildFpsWorld,
 * riusata identica dal client telefono), una capsula per giocatore, una camera in prima persona per ogni giocatore
 * col controller CHE HA ALL'AVVIO del round (i giocatori senza controller continuano a giocare dal telefono come
 * sempre: questo layer è additivo, non li sostituisce).
 */

export interface FpsRenderSnapshot {
  id: PlayerId;
  name: string;
  color: string;
  avatar?: string;
  characterId?: string | null;
  /** nome scelto dal giocatore (targhetta); `name` resta quello usato dalla simulazione */
  displayName?: string;
  x: number;
  z: number;
  yaw: number;
  pitch: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  kills: number;
  weaponId: string;
  magazine: number;
  reloading: boolean;
  /** stato dell'abilita' (da FpsScene via fpsAbilities: il disegno legge solo questo) */
  ability?: AbilityStatus;
  /** giubbotto del Buttafuori attivo */
  guard?: boolean;
  /** il Dottore vede tutti attraverso i muri */
  wall?: boolean;
  /** NO, ASPETTA! subito: non puo' sparare ne' ricaricare */
  locked?: boolean;
  /** avanzamento della ricarica 0..1 e inizio della zona verde del Goblin (null = nessuna barra) */
  reloadFrac?: number;
  sweetFrom?: number | null;
}

// Layer HUD: stessa tecnica di kart-race (bit su layerMask), scena separata quindi nessuna collisione possibile
// con gli indici usati la'.
const HUD_LAYER_BIT0 = 20; // 20..24: HUD di ciascun giocatore
// Bit "identita' capsula" (M6.1): ogni capsula porta SOLO questo bit (non la maschera di default) — la propria
// camera lo toglie dalla propria maschera (non vede la propria capsula da vicino), le altre camere lo mantengono
// (la vedono normalmente). Fascia separata dall'HUD (10..14, mai 20..24): nessuna collisione, fino a 5 giocatori.
const AVATAR_LAYER_BIT0 = 10;
// Bit "vista a raggi X" (Dottore, M'HO SVEJATO): 5..9, uno per finestra. La camera i vede SOLO il proprio bit (tolti tutti gli altri dalla
// sua maschera); i "fantasmi" degli avversari portano il bit di chi sta vedendo attraverso i muri, e sono disegnati senza test di profondita'.
const WALL_LAYER_BIT0 = 5;
const wallBit = (i: number): number => 1 << (WALL_LAYER_BIT0 + i);
const DEFAULT_LAYER_MASK = 0x0fffffff;
const hudBit = (i: number): number => 1 << (HUD_LAYER_BIT0 + i);
// Bit "viewmodel" (arma in prima persona): 15..19, uno per finestra. L'arma e' figlia della SUA camera: le altre non devono
// vederla (galleggerebbe nel mondo).
const VM_LAYER_BIT0 = 15;
const vmBit = (i: number): number => 1 << (VM_LAYER_BIT0 + i);
const avatarBit = (i: number): number => 1 << (AVATAR_LAYER_BIT0 + i);

const EYE_HEIGHT = 1.5;
const PLAYER_SPEED = 9; // solo per normalizzare il bob dell'arma (la velocita' vera la decide FpsScene)
const BASE_FOV = 1.05;

interface CamRig {
  index: number;
  playerId: PlayerId;
  camera: UniversalCamera;
  /** arma in prima persona (stessa del telefono: rinculo a molle per arma, lampo, ricarica, estrazione, dash) */
  vm: FpsViewmodel;
  /** posizione stereo della finestra (-0.6 sinistra .. +0.6 destra): i suoni di QUESTO giocatore arrivano dal suo lato */
  pan: number;
  prevX: number;
  prevZ: number;
  prevYaw: number;
  prevPitch: number;
  weaponId: string;
  reloadAt: number;
  reloadDur: number;
  dashT: number;
  /** calcio di camera da danno/esplosione (solo visivo) */
  kickP: number;
  kickR: number;
  shake: number;
}

interface Tracer {
  m: Mesh;
  mat: StandardMaterial;
  life: number;
  max: number;
}
interface Proj {
  m: Mesh;
  t: number;
  dur: number;
  ox: number;
  oy: number;
  oz: number;
  tx: number;
  ty: number;
  tz: number;
  on: boolean;
}
interface Boom {
  core: Mesh;
  ring: Mesh;
  coreMat: StandardMaterial;
  ringMat: StandardMaterial;
  t: number;
  r: number;
  on: boolean;
}
interface Debris {
  m: Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
}

interface AvatarRig {
  body: Mesh;
  gun: Mesh;
  bodyMat: StandardMaterial;
  /** lampo dell'arma visto dagli ALTRI quando questo giocatore spara */
  flash: Mesh;
  flashT: number;
  /** tutte le mesh dell'avatar (capsula, arma, tratti del personaggio, targhetta): stessa layerMask */
  parts: Mesh[];
  /** ultimo stato "vivo" visto: per la piccola reazione alla morte */
  wasAlive: boolean;
  deathT: number;
  /** sussulto quando viene colpito */
  hitT: number;
  /** fantasma "a raggi X" (Dottore): visibile solo alle finestre che lo stanno usando */
  ghost: Mesh;
}

interface HudEntry {
  adt: AdvancedDynamicTexture;
  hpFill: Rectangle;
  hpText: TextBlock;
  ammoText: TextBlock;
  killText: TextBlock;
  hitmarker: TextBlock;
  hitmarkerTimer: number;
  vignette: Rectangle;
  vignetteTimer: number;
  centerText: TextBlock;
  /** colpo che uccide: hitmarker rosso piu' grande e piu' lungo */
  hitKill: boolean;
  /** frecce "da dove arriva il colpo" (pool di 3, ruotano attorno al centro) */
  dmgInds: { box: Rectangle; t: number }[];
  dmgIdx: number;
  /** ABILITA': riga di stato (nome + PRONTA/ATTIVA/RICARICA), barra ricarica con zona verde (Goblin), cornice giubbotto, avviso bloccato */
  abilityText: TextBlock;
  reloadBar: Rectangle;
  reloadFill: Rectangle;
  guardFrame: Rectangle;
  lockText: TextBlock;
}

export class BabylonFpsGame {
  private engine: Engine;
  private scene: Scene;
  private cams: CamRig[] = [];
  private avatars = new Map<PlayerId, AvatarRig>();
  private hud = new Map<PlayerId, HudEntry>();
  private disposed = false;
  private paused = false;
  private onResize = (): void => {
    this.engine.resize();
    this.layoutHud();
  };
  private localPlayerIds: PlayerId[];
  /** nome dell'abilita' di ogni giocatore con una finestra (per la riga di stato nell'HUD) */
  private abilityName = new Map<PlayerId, string>();
  private perfLowSince = 0;
  private perfFrames = 0;
  private perfEl: HTMLDivElement | null = null;
  private readonly debug = debugEnabled();
  private tracers: Tracer[] = [];
  private tracerIdx = 0;
  private projs: Proj[] = [];
  private booms: Boom[] = [];
  private debris: Debris[] = [];
  private debrisIdx = 0;
  private remoteFlashMat!: StandardMaterial;
  /** ultima posizione nota di ogni giocatore (indicatore direzionale del danno, distanza dalle esplosioni) */
  private lastPos = new Map<PlayerId, { x: number; z: number }>();
  /** su LOW (e con 4-5 finestre) meno detriti/traccianti: stesso sistema di qualita', nessuno nuovo */
  private readonly fxLow: boolean;
  private readonly tmpV = new Vector3();

  constructor(
    private canvas: HTMLCanvasElement,
    locals: FpsLocalPlayer[] // ordine stabile: chi ha il controller ALL'AVVIO del round, nell'ordine dei giocatori
  ) {
    this.localPlayerIds = locals.map((l) => l.id);
    for (const l of locals) this.abilityName.set(l.id, abilityFor('fps', l.characterId ?? null)?.name ?? '');
    this.engine = new Engine(canvas, engineOptions().antialias, engineOptions());
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.07, 0.08, 0.12, 1);
    // LUCI: le stesse del client telefono (fpsClient). buildFpsWorld non ne crea: senza queste, sulla TV mondo e
    // personaggi erano neri (bug di M6: lo split-screen non aveva luci, il telefono si').
    buildFpsLights(this.scene); // luci uniformi della Sparatoria (stesse su TV e telefono: fpsWorld)
    buildFpsWorld(this.scene);

    const rects = splitScreenLayout(locals.length);
    this.fxLow = getQualityLevel() === 'low' || locals.length >= 4;
    this.buildFxPools();
    const cw = canvas.clientWidth || 1280;
    const ch = canvas.clientHeight || 720;
    locals.forEach(({ id: pid, name, color, characterId }, i) => {
      const camera = new UniversalCamera(`fpsCam_${pid}`, new Vector3(0, EYE_HEIGHT, 0), this.scene);
      camera.minZ = 0.05; // l'arma in prima persona sta a ~0.5 m dalla camera
      camera.maxZ = 260;
      camera.fov = BASE_FOV;
      camera.viewport = new Viewport(rects[i].x, rects[i].y, rects[i].w, rects[i].h);
      // Maschera camera: tutto per default, il PROPRIO gruppo HUD al posto di tutti i gruppi HUD, MAI la propria
      // capsula (avatarBit(i) tolto qui e solo qui — le altre camere lo mantengono, la vedono normalmente), e solo la
      // PROPRIA arma in prima persona.
      camera.layerMask = (DEFAULT_LAYER_MASK & ~(0x1f << HUD_LAYER_BIT0) & ~(0x1f << VM_LAYER_BIT0) & ~(0x1f << WALL_LAYER_BIT0) & ~avatarBit(i)) | hudBit(i) | vmBit(i) | wallBit(i);
      const vm = new FpsViewmodel(this.scene, camera, false, vmBit(i));
      vm.aspect = (rects[i].w * cw) / Math.max(1, rects[i].h * ch);
      vm.scale = locals.length >= 3 ? 0.5 : 0.58;
      vm.equip('mitraglia');
      const pan = Math.max(-0.6, Math.min(0.6, (rects[i].x + rects[i].w / 2) * 2 - 1));
      this.cams.push({ index: i, playerId: pid, camera, vm, pan, prevX: 0, prevZ: 0, prevYaw: 0, prevPitch: 0, weaponId: 'mitraglia', reloadAt: 0, reloadDur: 0, dashT: 0, kickP: 0, kickR: 0, shake: 0 });
      this.hud.set(pid, this.buildHud(i, rects.length, name, color, characterId ?? null));
    });
    this.scene.activeCameras = this.cams.map((c) => c.camera);
    this.layoutHud();
    registerEnvScene(this.scene);

    applyQuality(this.engine, this.scene);
    this.engine.runRenderLoop(guardLoop(() => {
      if (this.disposed || this.paused) return;
      this.layoutHud(); // economico (confronta solo le misure): Babylon riporta l'HUD a schermo intero dopo un resize
      this.scene.render();
      if (this.debug) this.checkPerf();
    }));
    window.addEventListener('resize', this.onResize);
  }

  /**
   * HUD di ogni finestra: la texture del GUI ha la misura della SUA finestra (niente testo schiacciato a 2 giocatori,
   * dove la finestra e' larga mezzo schermo) e le misure sono in unita' di progetto (altezza ideale): stessa leggibilita'
   * a 720p e a 4K, e da 3 finestre in su l'HUD si riduce un po' ma resta leggibile (non "scalato al 50%").
   */
  private layoutHud(): void {
    const rects = splitScreenLayout(this.cams.length);
    const rw = this.engine.getRenderWidth();
    const rh = this.engine.getRenderHeight();
    this.cams.forEach((c, i) => {
      const h = this.hud.get(c.playerId);
      const r = rects[i];
      if (!h || !r) return;
      const vpW = Math.max(2, Math.round(r.w * rw));
      const vpH = Math.max(2, Math.round(r.h * rh));
      const size = h.adt.getSize();
      if (size.width !== vpW || size.height !== vpH) h.adt.scaleTo(vpW, vpH);
      const idealH = 720 * r.h * (this.cams.length >= 3 ? 1.25 : 1);
      if (h.adt.idealHeight !== idealH) h.adt.idealHeight = idealH;
    });
  }

  /** SOLO DEBUG: FPS host sotto soglia per qualche secondo E auto-quality gia' al minimo (livello LOW, scala massima). */
  private checkPerf(): void {
    if (++this.perfFrames % 30 !== 0) return;
    const fps = this.engine.getFps();
    const q = getQualityInfo();
    const atMin = q.scale >= 2 - 1e-6 && (q.level === 'low' || !q.auto);
    const now = performance.now();
    if (fps > 0 && fps < PERF_WARN_FPS && atMin) {
      if (!this.perfLowSince) this.perfLowSince = now;
    } else this.perfLowSince = 0;
    const show = this.perfLowSince > 0 && now - this.perfLowSince >= PERF_WARN_AFTER_MS;
    if (show && !this.perfEl) {
      this.perfEl = document.createElement('div');
      this.perfEl.id = 'fps-perf-warning';
      this.perfEl.style.cssText = 'position:fixed;right:8px;bottom:8px;z-index:100000;padding:6px 10px;border-radius:8px;background:rgba(127,29,29,.9);color:#fff;font:700 12px ui-monospace,Consolas,monospace;pointer-events:none';
      document.body.appendChild(this.perfEl);
    }
    if (this.perfEl) {
      if (!show) {
        this.perfEl.remove();
        this.perfEl = null;
      } else this.perfEl.textContent = `⚠️ FPS SPLIT-SCREEN PERFORMANCE · ${this.cams.length} viewport · ${Math.round(fps)} FPS · scala ${q.scale.toFixed(2)}`;
    }
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  isLocal(playerId: PlayerId): boolean {
    return this.localPlayerIds.includes(playerId);
  }

  private ensureAvatar(pid: PlayerId, color: string, characterId: string | null = null, avatar = '', name = ''): AvatarRig {
    let rig = this.avatars.get(pid);
    if (rig) return rig;
    const mat = new StandardMaterial(`fpsMat_${pid}`, this.scene);
    mat.diffuseColor = Color3.FromHexString(color);
    mat.specularColor = new Color3(0.05, 0.05, 0.05);
    const body = MeshBuilder.CreateCapsule(`fpsBody_${pid}`, { height: 1.75, radius: 0.4 }, this.scene);
    body.position.y = 0.9;
    body.material = mat;
    body.isPickable = false;
    const gun = MeshBuilder.CreateBox(`fpsGun_${pid}`, { width: 0.14, height: 0.14, depth: 0.6 }, this.scene);
    gun.material = mat;
    gun.isPickable = false;
    gun.parent = body;
    gun.position.set(0.25, 0, 0.55);
    // Solo chi ha una CAMERA propria qui (split-screen) porta il bit "identita'": la sua camera lo esclude dalla
    // propria maschera (vedi sopra), le altre lo mantengono. Chi non ha camera qui (gioca dal telefono) resta con
    // la maschera di default: e' comunque visibile a tutte le camere split-screen, non ha una "propria" vista da
    // escludere in questo renderer.
    const parts: Mesh[] = [body, gun];
    // IDENTITA': i tratti della testa del personaggio sulla calotta della capsula (aderenti: la sagoma e la hitbox non cambiano,
    // la hitbox e' comunque quella di FpsScene) + targhetta con icona e nome sopra la testa.
    const pres = presentationOf(characterId);
    if (pres) {
      const head = new TransformNode(`fpsHead_${pid}`, this.scene);
      head.parent = body;
      head.position.y = 0.42;
      const mats = makeCharMaterials(this.scene, pres, color);
      decorateHead(this.scene, head, 0.8, pres, mats);
      for (const m of head.getChildMeshes()) {
        m.isPickable = false;
        parts.push(m as Mesh);
      }
    }
    if (name) parts.push(this.buildTag(pid, body, name, pres?.accent ?? color, characterId, avatar));
    const flash = MeshBuilder.CreatePlane(`fpsRemoteFlash_${pid}`, { size: 0.55 }, this.scene);
    flash.material = this.remoteFlashMat;
    flash.billboardMode = Mesh.BILLBOARDMODE_ALL;
    flash.parent = gun;
    flash.position.set(0, 0, 0.38);
    flash.isPickable = false;
    flash.isVisible = false;
    parts.push(flash);
    const ownIndex = this.cams.find((c) => c.playerId === pid)?.index;
    if (ownIndex !== undefined) for (const m of parts) m.layerMask = avatarBit(ownIndex);
    // fantasma a raggi X: stessa sagoma, un filo piu' grande, senza luci e SENZA test di profondita' (gruppo di rendering 1: la
    // profondita' viene azzerata prima, quindi si vede dietro ai muri). layerMask 0 = invisibile a tutti finche' qualcuno non la usa.
    const gmat = new StandardMaterial(`fpsGhostMat_${pid}`, this.scene);
    gmat.emissiveColor = Color3.FromHexString(color);
    gmat.diffuseColor = new Color3(0, 0, 0);
    gmat.disableLighting = true;
    gmat.alpha = 0.55;
    const ghost = MeshBuilder.CreateCapsule(`fpsGhost_${pid}`, { height: 1.95, radius: 0.5 }, this.scene);
    ghost.material = gmat;
    ghost.isPickable = false;
    ghost.renderingGroupId = 1;
    ghost.layerMask = 0;
    ghost.isVisible = false;
    rig = { body, gun, bodyMat: mat, flash, flashT: 0, parts, wasAlive: true, deathT: 0, hitT: 0, ghost };
    this.avatars.set(pid, rig);
    return rig;
  }

  /** Targhetta sopra la testa degli ALTRI (la propria camera non la vede: stessa layerMask della capsula). */
  private buildTag(pid: PlayerId, parent: Mesh, text: string, color: string, characterId: string | null = null, avatar = ''): Mesh {
    const dt = new DynamicTexture(`fpsTag_${pid}`, { width: 256, height: 64 }, this.scene, false);
    dt.hasAlpha = true;
    const c = dt.getContext() as unknown as CanvasRenderingContext2D;
    c.clearRect(0, 0, 256, 64);
    c.fillStyle = 'rgba(10,10,18,0.75)';
    c.beginPath();
    c.roundRect(4, 4, 248, 56, 14);
    c.fill();
    c.fillStyle = color;
    c.fillRect(16, 50, 224, 6);
    // icona vettoriale del personaggio + nome (l'emoji solo se manca l'icona)
    const hasIcon = drawIcon(c, characterId ? CHAR_ICONS[characterId] : undefined, 12, 8, 44);
    const label = hasIcon ? text : `${avatar} ${text}`.trim();
    c.fillStyle = '#ffffff';
    c.font = '800 28px Arial, sans-serif';
    c.textAlign = 'center';
    c.fillText(label.length > 13 ? label.slice(0, 13) + '…' : label, hasIcon ? 150 : 128, 40);
    dt.update();
    const mat = new StandardMaterial(`fpsTagMat_${pid}`, this.scene);
    mat.diffuseTexture = dt;
    mat.emissiveColor = new Color3(1, 1, 1);
    mat.disableLighting = true;
    mat.useAlphaFromDiffuseTexture = true;
    mat.backFaceCulling = false;
    const plane = MeshBuilder.CreatePlane(`fpsTagPlane_${pid}`, { width: 1.3, height: 0.33 }, this.scene);
    plane.material = mat;
    plane.billboardMode = Mesh.BILLBOARDMODE_ALL;
    plane.parent = parent;
    plane.position.y = 1.25;
    plane.isPickable = false;
    return plane;
  }

  private buildHud(index: number, total: number, name: string, color: string, characterId: string | null = null): HudEntry {
    const adt = AdvancedDynamicTexture.CreateFullscreenUI(`fpsHud_${index}`, true, this.scene);
    if (adt.layer) adt.layer.layerMask = hudBit(index);

    // di chi e' questa finestra: nome nel colore del giocatore, in alto a sinistra (in 2x2 nessuno deve chiedersi "quale sono?")
    const nameTag = new TextBlock(`fpsName_${index}`, name.toUpperCase());
    nameTag.color = color;
    nameTag.fontFamily = FONT_DISPLAY;
    nameTag.fontSize = 22;
    nameTag.outlineColor = '#000000';
    nameTag.outlineWidth = 4;
    nameTag.resizeToFit = true;
    nameTag.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    nameTag.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    nameTag.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    const iconSrc = characterId ? iconDataUrl(CHAR_ICONS[characterId]) : '';
    nameTag.left = iconSrc ? '50px' : '16px';
    nameTag.top = '14px';
    adt.addControl(nameTag);
    if (iconSrc) {
      // icona vettoriale del personaggio (niente emoji del sistema)
      const icon = new GuiImage(`fpsIcon_${index}`, iconSrc);
      icon.width = '30px';
      icon.height = '30px';
      icon.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      icon.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
      icon.left = '14px';
      icon.top = '12px';
      adt.addControl(icon);
    }

    const panel = new Rectangle(`fpsPanel_${index}`);
    panel.width = '236px';
    panel.height = '84px';
    panel.thickness = 0;
    panel.background = 'rgba(11,11,20,0.82)';
    panel.thickness = 2;
    panel.color = 'rgba(255,255,255,0.16)';
    panel.cornerRadius = 14;
    panel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    panel.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    panel.left = '16px';
    panel.top = '-16px';
    adt.addControl(panel);

    const hpBar = new Rectangle('hpBar');
    hpBar.width = '208px';
    hpBar.height = '20px';
    hpBar.top = '-22px';
    hpBar.thickness = 1;
    hpBar.color = '#00000055';
    hpBar.background = '#1f2430';
    hpBar.cornerRadius = 4;
    panel.addControl(hpBar);
    const hpFill = new Rectangle('hpFill');
    hpFill.width = '204px';
    hpFill.height = '16px';
    hpFill.thickness = 0;
    hpFill.background = '#4ade80';
    hpFill.cornerRadius = 3;
    hpFill.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    hpFill.left = '1px';
    hpBar.addControl(hpFill);
    const hpText = new TextBlock('hpText', '100');
    hpText.color = '#ffffff';
    hpText.fontSize = 15;
    hpText.fontFamily = FONT_DISPLAY;
    hpText.outlineColor = '#000000';
    hpText.outlineWidth = 3;
    hpBar.addControl(hpText);

    const ammoText = new TextBlock('ammoText', '');
    ammoText.color = '#e5e7eb';
    ammoText.fontFamily = FONT_DISPLAY;
    ammoText.fontSize = 22;
    ammoText.top = '8px';
    ammoText.height = '28px';
    ammoText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    ammoText.left = '14px';
    panel.addControl(ammoText);

    const killText = new TextBlock('killText', '0 kill');
    killText.color = '#facc15';
    killText.fontSize = 17;
    killText.fontFamily = FONT_DISPLAY;
    killText.top = '10px';
    killText.height = '24px';
    killText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    killText.left = '-14px';
    panel.addControl(killText);

    const hitmarker = new TextBlock(`fpsHitmarker_${index}`, '✕');
    hitmarker.fontSize = 44;
    hitmarker.color = '#ffffff';
    hitmarker.outlineColor = '#000000';
    hitmarker.outlineWidth = 4;
    hitmarker.alpha = 0;
    hitmarker.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    hitmarker.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    adt.addControl(hitmarker);

    const vignette = new Rectangle(`fpsVignette_${index}`);
    vignette.width = '100%';
    vignette.height = '100%';
    vignette.thickness = 60;
    vignette.color = '#ef4444';
    vignette.alpha = 0;
    vignette.isHitTestVisible = false;
    adt.addControl(vignette);

    const centerText = new TextBlock(`fpsCenter_${index}`, '');
    centerText.fontFamily = FONT_DISPLAY;
    centerText.fontSize = 36;
    centerText.color = '#f87171';
    centerText.outlineColor = '#000000';
    centerText.outlineWidth = 6;
    centerText.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    centerText.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    adt.addControl(centerText);

    // indicatori di direzione del danno: una freccia rossa sul bordo di un cerchio invisibile, ruotato verso l'attaccante
    const dmgInds: { box: Rectangle; t: number }[] = [];
    for (let k = 0; k < 3; k++) {
      const box = new Rectangle(`fpsDmgInd_${index}_${k}`);
      box.width = '220px';
      box.height = box.width;
      box.thickness = 0;
      box.alpha = 0;
      box.isHitTestVisible = false;
      const arrow = new TextBlock(`fpsDmgArrow_${index}_${k}`, '▲');
      arrow.color = '#ef4444';
      arrow.outlineColor = '#000000';
      arrow.outlineWidth = 3;
      arrow.fontSize = 36;
      arrow.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
      box.addControl(arrow);
      adt.addControl(box);
      dmgInds.push({ box, t: 0 });
    }

    // ---- ABILITA' ----
    const abilityText = new TextBlock(`fpsAbility_${index}`, '');
    abilityText.fontFamily = FONT_DISPLAY;
    abilityText.fontSize = 17;
    abilityText.color = '#e5e7eb';
    abilityText.outlineColor = '#000000';
    abilityText.outlineWidth = 4;
    abilityText.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    abilityText.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    abilityText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    abilityText.left = '18px';
    abilityText.top = '-108px';
    abilityText.height = '24px';
    abilityText.width = '420px';
    adt.addControl(abilityText);

    // barra ricarica del Goblin: la zona verde e' dove premere RB (N'CULO!) per la ricarica perfetta
    const reloadBar = new Rectangle(`fpsReloadBar_${index}`);
    reloadBar.width = '236px';
    reloadBar.height = '14px';
    reloadBar.thickness = 1;
    reloadBar.color = '#00000066';
    reloadBar.background = '#1f2430';
    reloadBar.cornerRadius = 4;
    reloadBar.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    reloadBar.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    reloadBar.left = '16px';
    reloadBar.top = '-134px';
    reloadBar.isVisible = false;
    adt.addControl(reloadBar);
    const sweet = new Rectangle(`fpsReloadSweet_${index}`);
    sweet.height = '12px';
    sweet.thickness = 0;
    sweet.background = 'rgba(74,222,128,0.55)';
    sweet.cornerRadius = 3;
    sweet.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    reloadBar.addControl(sweet);
    const reloadFill = new Rectangle(`fpsReloadFill_${index}`);
    reloadFill.width = '0px';
    reloadFill.height = '10px';
    reloadFill.thickness = 0;
    reloadFill.background = '#facc15';
    reloadFill.cornerRadius = 3;
    reloadFill.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    reloadFill.left = '1px';
    reloadBar.addControl(reloadFill);
    // la zona verde: posizione fissa nella barra (si legge dal catalogo via snapshot.sweetFrom)
    reloadBar.metadata = { sweet };

    // cornice azzurra del giubbotto del Buttafuori
    const guardFrame = new Rectangle(`fpsGuard_${index}`);
    guardFrame.width = '100%';
    guardFrame.height = '100%';
    guardFrame.thickness = 10;
    guardFrame.color = '#38bdf8';
    guardFrame.background = '';
    guardFrame.alpha = 0;
    guardFrame.isHitTestVisible = false;
    adt.addControl(guardFrame);

    // NO, ASPETTA! subito: "BLOCCATO" (forma + testo, non solo colore)
    const lockText = new TextBlock(`fpsLock_${index}`, '');
    lockText.fontFamily = FONT_DISPLAY;
    lockText.fontSize = 30;
    lockText.color = '#fbbf24';
    lockText.outlineColor = '#000000';
    lockText.outlineWidth = 6;
    lockText.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    lockText.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    lockText.top = '-70px';
    lockText.isVisible = false;
    adt.addControl(lockText);

    return { adt, hpFill, hpText, ammoText, killText, hitmarker, hitmarkerTimer: 0, vignette, vignetteTimer: 0, centerText, hitKill: false, dmgInds, dmgIdx: 0, abilityText, reloadBar, reloadFill, guardFrame, lockText };
  }

  /** Pool di effetti condivisi (visibili a tutte le finestre): traccianti, proiettili, esplosioni, detriti. Nessuna allocazione per colpo. */
  private buildFxPools(): void {
    const s = this.scene;
    const em = (name: string, r: number, g: number, b: number): StandardMaterial => {
      const m = new StandardMaterial(name, s);
      m.emissiveColor = new Color3(r, g, b);
      m.diffuseColor = new Color3(0, 0, 0);
      m.disableLighting = true;
      return m;
    };
    for (let i = 0; i < (this.fxLow ? 16 : 28); i++) {
      const m = MeshBuilder.CreateBox(`fpsTracer${i}`, { size: 1 }, s);
      const mt = em(`fpsTracerMat${i}`, 1, 0.8, 0.3);
      m.material = mt;
      m.isVisible = false;
      m.isPickable = false;
      this.tracers.push({ m, mat: mt, life: 0, max: 0.06 });
    }
    this.remoteFlashMat = em('fpsRemoteFlashMat', 1, 0.85, 0.4);
    this.remoteFlashMat.backFaceCulling = false;
    const projMat = em('fpsProjMat', 1, 0.55, 0.15);
    for (let i = 0; i < 5; i++) {
      const m = MeshBuilder.CreateSphere(`fpsProj${i}`, { diameter: 0.5, segments: 8 }, s);
      m.material = projMat;
      m.isVisible = false;
      m.isPickable = false;
      this.projs.push({ m, t: 0, dur: 1, ox: 0, oy: 0, oz: 0, tx: 0, ty: 0, tz: 0, on: false });
    }
    for (let i = 0; i < 3; i++) {
      const coreMat = em(`fpsBoomCore${i}`, 1, 0.62, 0.2);
      const ringMat = em(`fpsBoomRing${i}`, 1, 0.85, 0.45);
      const core = MeshBuilder.CreateSphere(`fpsBoom${i}`, { diameter: 2, segments: 10 }, s);
      core.material = coreMat;
      const ring = MeshBuilder.CreateTorus(`fpsBoomRing${i}`, { diameter: 2, thickness: 0.18, tessellation: 24 }, s);
      ring.material = ringMat;
      for (const m of [core, ring]) {
        m.isVisible = false;
        m.isPickable = false;
      }
      this.booms.push({ core, ring, coreMat, ringMat, t: 0, r: 4, on: false });
    }
    const debMat = em('fpsDebrisMat', 1, 0.7, 0.25);
    for (let i = 0; i < (this.fxLow ? 10 : 20); i++) {
      const m = MeshBuilder.CreateBox(`fpsDebris${i}`, { size: 0.16 }, s);
      m.material = debMat;
      m.isVisible = false;
      m.isPickable = false;
      this.debris.push({ m, vx: 0, vy: 0, vz: 0, life: 0 });
    }
  }

  /**
   * UNO SPARO (dalla simulazione, nello stesso istante in cui FpsScene applica il colpo): rinculo/lampo/suono per chi spara se ha
   * una finestra qui, lampo sull'arma vista dagli altri, un tracciante per pallino (non per la bombarda: il suo proiettile vola).
   */
  notifyShot(shooterId: PlayerId, weaponId: string, segs: { ox: number; oy: number; oz: number; ex: number; ey: number; ez: number }[]): void {
    if (this.disposed) return;
    const prof = recoilOf(weaponId);
    const cam = this.cams.find((c) => c.playerId === shooterId);
    if (cam) {
      if (cam.weaponId !== weaponId) {
        cam.vm.equip(weaponId);
        cam.weaponId = weaponId;
      }
      cam.vm.fire();
      // l'arma di chi ha una finestra: forte, dal lato della sua finestra (un solo AudioContext, nessun mix duplicato)
      if (audio.reserveVoice('sfx', 0.12)) sfx.shot(weaponId, { gain: 0.42, pan: cam.pan });
    } else {
      // chi gioca dal telefono: piu' basso e SPAZIALIZZATO rispetto alla finestra piu' vicina (pan + distanza)
      const sp = this.spatial(shooterId);
      if (sp.gain > 0.06 && audio.reserveVoice('sfx', 0.12)) sfx.shot(weaponId, sp);
    }
    const a = this.avatars.get(shooterId);
    if (a) {
      a.flashT = 0.06;
      a.flash.isVisible = true;
      a.flash.rotation.z = Math.random() * Math.PI;
    }
    if (prof.tracer.thick <= 0) return;
    const max = this.fxLow ? Math.min(segs.length, 3) : segs.length;
    for (let i = 0; i < max; i++) {
      const sg = segs[i];
      const t = this.tracers[this.tracerIdx++ % this.tracers.length];
      // dal vivo di volata al punto colpito; parte ~1.6 m avanti: piu' vicino, nella finestra di chi spara diventerebbe una
      // barra spessa davanti alla mira
      const dx = sg.ex - sg.ox;
      const dz = sg.ez - sg.oz;
      const len = Math.hypot(dx, sg.ey - sg.oy, dz) || 1;
      const start = Math.min(1.6, len * 0.5);
      const sx = sg.ox + (dx / len) * start + (dz / len) * 0.12;
      const sy = sg.oy - 0.1;
      const sz = sg.oz + (dz / len) * start - (dx / len) * 0.12;
      const L = Math.max(0.2, Math.hypot(sg.ex - sx, sg.ey - sy, sg.ez - sz));
      t.m.position.set((sx + sg.ex) / 2, (sy + sg.ey) / 2, (sz + sg.ez) / 2);
      t.m.scaling.set(prof.tracer.thick * 1.1, prof.tracer.thick * 1.1, L);
      this.tmpV.set(sg.ex, sg.ey, sg.ez);
      t.m.lookAt(this.tmpV);
      t.mat.emissiveColor.set(prof.tracer.color[0], prof.tracer.color[1], prof.tracer.color[2]);
      t.m.visibility = 1;
      t.m.isVisible = true;
      t.life = t.max = Math.max(0.05, prof.tracer.life * 1.4);
    }
  }

  /**
   * Segnali della simulazione (gli stessi che arrivano ai telefoni, intercettati da FpsScene): solo feedback visivo/sonoro.
   * proj/boom = bombarda; damaged/hit = danno subito/inflitto (confermato dall'host); reload/equip/dash = arma.
   */
  onSignal(pid: PlayerId | null, msg: Record<string, unknown>): void {
    if (this.disposed) return;
    const type = msg.type;
    if (type === 'proj') {
      const slot = this.projs.find((q) => !q.on);
      if (!slot) return;
      slot.ox = Number(msg.ox);
      slot.oy = Number(msg.oy);
      slot.oz = Number(msg.oz);
      slot.tx = Number(msg.tx);
      slot.ty = Number(msg.ty);
      slot.tz = Number(msg.tz);
      slot.dur = Math.max(0.1, Number(msg.dur) || 0.5);
      // il proiettile si vede nascere ~1.2 m davanti a chi spara: dagli occhi riempirebbe la sua finestra (solo grafica,
      // il punto d'arrivo e l'istante dell'esplosione restano quelli della simulazione)
      const len = Math.hypot(slot.tx - slot.ox, slot.tz - slot.oz) || 1;
      const k = Math.min(0.4, 1.2 / len);
      slot.ox += (slot.tx - slot.ox) * k;
      slot.oy += (slot.ty - slot.oy) * k;
      slot.oz += (slot.tz - slot.oz) * k;
      slot.t = 0;
      slot.on = true;
      slot.m.position.set(slot.ox, slot.oy, slot.oz);
      slot.m.isVisible = true;
      if (slot.dur > 0.4) sfx.whistle(slot.dur);
      return;
    }
    if (type === 'boom') {
      this.boom(Number(msg.x), Number(msg.y), Number(msg.z), Number(msg.r) || 4);
      return;
    }
    if (!pid) return;
    const cam = this.cams.find((c) => c.playerId === pid);
    const h = this.hud.get(pid);
    if (type === 'hit' && h) {
      // colpo CONFERMATO dall'host: hitmarker (piu' grosso e rosso sulla kill) + tick sonoro
      h.hitKill = msg.kill === true;
      h.hitmarkerTimer = h.hitKill ? 0.42 : 0.2;
      if (h.hitKill) sfx.kill();
      else sfx.hitTick(Number(msg.dmg) || 10);
    } else if (type === 'damaged') {
      const amount = Number(msg.amount) || 10;
      const a = this.avatars.get(pid);
      if (a) a.hitT = 0.22;
      if (h) h.vignetteTimer = 0.35;
      if (cam) {
        cam.kickP += Math.min(0.09, 0.02 + amount * 0.0012);
        cam.kickR += (Math.random() < 0.5 ? -1 : 1) * Math.min(0.07, 0.02 + amount * 0.001);
        cam.shake = Math.min(1, cam.shake + amount / 70);
        sfx.hurt(amount);
      }
      const from = this.lastPos.get(String(msg.from));
      const me = this.lastPos.get(pid);
      if (h && from && me) {
        const ind = h.dmgInds[h.dmgIdx++ % h.dmgInds.length];
        ind.box.rotation = Math.atan2(from.x - me.x, from.z - me.z) - (cam ? cam.prevYaw : 0);
        ind.t = 1;
      }
    } else if (type === 'reload' && cam) {
      cam.reloadAt = performance.now();
      cam.reloadDur = (Number(msg.duration) || 1.5) * 1000;
      sfx.reload(String(msg.weaponId ?? cam.weaponId), Number(msg.duration) || 1.5);
    } else if (type === 'equip' && cam) {
      const w = String(msg.weaponId);
      cam.vm.equip(w);
      cam.weaponId = w;
      sfx.equip(w);
    } else if (type === 'dash' && cam) {
      cam.vm.dash();
      cam.dashT = 0.18;
    }
  }

  /** Pan/volume di un suono nato dove sta `pid`, sentito dalla camera locale piu' vicina (attenuazione semplice, niente HRTF). */
  private spatial(pid: PlayerId): { gain: number; pan: number } {
    const src = this.lastPos.get(pid);
    if (!src || this.cams.length === 0) return { gain: 0.18, pan: 0 };
    let best = { d: Infinity, pan: 0 };
    for (const c of this.cams) {
      const me = this.lastPos.get(c.playerId);
      if (!me) continue;
      const d = Math.hypot(src.x - me.x, src.z - me.z);
      if (d < best.d) {
        const rel = Math.atan2(src.x - me.x, src.z - me.z) - c.prevYaw;
        // posizione nella finestra di chi ascolta + direzione dentro la finestra
        best = { d, pan: Math.max(-0.9, Math.min(0.9, c.pan * 0.6 + Math.sin(rel) * 0.5)) };
      }
    }
    return { gain: Math.max(0, 0.3 * (1 - Math.min(1, best.d / 40))), pan: best.pan };
  }

  /** Esplosione della bombarda: palla di fuoco + anello che si allarga + detriti, scossa proporzionata alla distanza. */
  private boom(x: number, y: number, z: number, r: number): void {
    const b = this.booms.find((q) => !q.on) ?? this.booms[0];
    b.on = true;
    b.t = 0;
    b.r = r;
    b.core.position.set(x, Math.max(0.6, y), z);
    b.ring.position.set(x, 0.12, z);
    b.core.isVisible = true;
    b.ring.isVisible = true;
    const n = this.fxLow ? 6 : 12;
    for (let i = 0; i < n; i++) {
      const d = this.debris[this.debrisIdx++ % this.debris.length];
      const ang = Math.random() * Math.PI * 2;
      const sp = 4 + Math.random() * 6;
      d.m.position.set(x, Math.max(0.6, y), z);
      d.vx = Math.cos(ang) * sp;
      d.vz = Math.sin(ang) * sp;
      d.vy = 3 + Math.random() * 5;
      d.life = 0.5 + Math.random() * 0.3;
      d.m.isVisible = true;
    }
    let nearest = Infinity;
    for (const cam of this.cams) {
      const me = this.lastPos.get(cam.playerId);
      if (!me) continue;
      const dist = Math.hypot(x - me.x, z - me.z);
      nearest = Math.min(nearest, dist);
      if (dist < 12) {
        const k = 1 - dist / 12;
        cam.shake = Math.min(1, cam.shake + k);
        cam.kickP += 0.05 * k;
      }
    }
    sfx.boom({ gain: Number.isFinite(nearest) ? Math.max(0.2, 1 - nearest / 45) : 0.5 });
  }

  /** NO, ASPETTA! (Judoka): onda davanti a lui, senza botto ne' detriti (e' una spinta, non un'esplosione). */
  notifyShove(pid: PlayerId, x: number, z: number, yaw: number): void {
    if (this.disposed) return;
    const b = this.booms.find((q) => !q.on) ?? this.booms[0];
    b.on = true;
    b.t = 0;
    b.r = 6;
    const cx = x + Math.sin(yaw) * 2.5;
    const cz = z + Math.cos(yaw) * 2.5;
    b.core.position.set(cx, 0.6, cz);
    b.ring.position.set(cx, 0.12, cz);
    b.core.isVisible = false;
    b.ring.isVisible = true;
    const cam = this.cams.find((c) => c.playerId === pid);
    if (cam) cam.shake = Math.min(1, cam.shake + 0.35);
  }

  /** Compatibilita': un colpo confermato (hitmarker) o un danno subito (vignetta) senza dettagli. */
  notifyHit(shooterId: PlayerId | null, targetId: PlayerId | null): void {
    if (shooterId) this.onSignal(shooterId, { type: 'hit', dmg: 10, kill: false });
    if (targetId) this.onSignal(targetId, { type: 'damaged', amount: 10, from: '' });
  }

  /** Camera + arma in prima persona di una finestra: calci e scosse SOLO visivi (la mira vera resta quella di FpsScene). */
  private updateCam(cam: CamRig, snap: FpsRenderSnapshot, dt: number): void {
    const d = Math.max(1e-3, dt);
    const speedFrac = snap.alive ? Math.min(1, Math.hypot(snap.x - cam.prevX, snap.z - cam.prevZ) / d / PLAYER_SPEED) : 0;
    let dyaw = snap.yaw - cam.prevYaw;
    while (dyaw > Math.PI) dyaw -= Math.PI * 2;
    while (dyaw < -Math.PI) dyaw += Math.PI * 2;
    // il sway dell'arma e' tarato sui pixel di trascinamento del telefono: ~600 px per radiante
    const lookDx = dyaw * 600;
    const lookDy = -(snap.pitch - cam.prevPitch) * 600;
    cam.prevX = snap.x;
    cam.prevZ = snap.z;
    cam.prevYaw = snap.yaw;
    cam.prevPitch = snap.pitch;
    if (snap.weaponId !== cam.weaponId) {
      cam.vm.equip(snap.weaponId);
      cam.weaponId = snap.weaponId;
    }
    let reloadP = 0;
    if (snap.reloading && cam.reloadAt > 0) reloadP = Math.min(0.999, Math.max(0.001, (performance.now() - cam.reloadAt) / cam.reloadDur));
    else if (!snap.reloading) cam.reloadAt = 0;
    cam.dashT = Math.max(0, cam.dashT - dt);
    cam.vm.update(dt, speedFrac, lookDx, lookDy, reloadP, cam.dashT > 0);

    cam.kickP *= Math.max(0, 1 - dt * 9);
    cam.kickR *= Math.max(0, 1 - dt * 7);
    cam.shake = Math.max(0, cam.shake - dt * 2.5);
    if (!snap.alive) return;
    const sh = cam.shake * 0.1;
    cam.camera.position.set(snap.x + (Math.random() - 0.5) * sh, EYE_HEIGHT + (Math.random() - 0.5) * sh, snap.z + (Math.random() - 0.5) * sh);
    cam.camera.rotation.y = snap.yaw + cam.vm.cameraKickYaw;
    cam.camera.rotation.x = -(snap.pitch + cam.vm.cameraKickPitch + cam.kickP);
    cam.camera.rotation.z = cam.kickR;
    cam.camera.fov = BASE_FOV + 0.12 * cam.vm.fovKick;
  }

  /** Effetti condivisi: traccianti che sfumano, proiettili in volo, esplosioni, detriti. */
  private updateFx(dt: number): void {
    for (const t of this.tracers) {
      if (t.life <= 0) continue;
      t.life -= dt;
      t.m.visibility = Math.max(0, t.life / t.max);
      if (t.life <= 0) t.m.isVisible = false;
    }
    for (const p of this.projs) {
      if (!p.on) continue;
      p.t += dt;
      const k = Math.min(1, p.t / p.dur);
      p.m.position.set(p.ox + (p.tx - p.ox) * k, p.oy + (p.ty - p.oy) * k - Math.sin(k * Math.PI) * 0.4, p.oz + (p.tz - p.oz) * k);
      p.m.scaling.setAll(1 + Math.sin(p.t * 30) * 0.12);
      if (k >= 1) {
        p.on = false;
        p.m.isVisible = false;
      }
    }
    for (const b of this.booms) {
      if (!b.on) continue;
      b.t += dt;
      const k = Math.min(1, b.t / 0.42);
      // scatto rapido poi rallenta (ease-out): il botto "esplode", non si gonfia
      const e = 1 - Math.pow(1 - k, 3);
      b.core.scaling.setAll(0.3 + e * b.r * 0.5);
      b.coreMat.alpha = 1 - k;
      b.ring.scaling.set(0.2 + e * b.r * 1.05, 1, 0.2 + e * b.r * 1.05);
      b.ringMat.alpha = 1 - k * k;
      if (k >= 1) {
        b.on = false;
        b.core.isVisible = false;
        b.ring.isVisible = false;
      }
    }
    for (const d of this.debris) {
      if (d.life <= 0) continue;
      d.life -= dt;
      if (d.life <= 0) {
        d.m.isVisible = false;
        continue;
      }
      d.vy -= 18 * dt;
      d.m.position.x += d.vx * dt;
      d.m.position.y = Math.max(0.05, d.m.position.y + d.vy * dt);
      d.m.position.z += d.vz * dt;
      d.m.rotation.x += dt * 9;
    }
  }

  setRoundEndMessage(text: string): void {
    for (const h of this.hud.values()) h.centerText.text = text;
  }

  /** Chiamato dal chiamante (FpsScene) una volta al frame: aggiorna camere/avatar/HUD dallo stato di simulazione. */
  update(dt: number, players: FpsRenderSnapshot[]): void {
    if (this.disposed) return;
    this.updateFx(dt);
    for (const snap of players) {
      const rig = this.ensureAvatar(snap.id, snap.color, snap.characterId ?? null, snap.avatar ?? '', snap.displayName ?? snap.name);
      // reazione all'eliminazione: la capsula si accascia per un attimo invece di sparire di colpo (solo grafica)
      if (rig.wasAlive && !snap.alive) rig.deathT = 0.45;
      rig.wasAlive = snap.alive;
      if (rig.deathT > 0) {
        rig.deathT -= dt;
        const k = Math.max(0, rig.deathT / 0.45);
        rig.body.rotation.x = (1 - k) * 1.3;
        rig.body.scaling.setAll(0.6 + 0.4 * k);
      } else {
        rig.body.rotation.x = 0;
        rig.body.scaling.setAll(1);
      }
      if (rig.hitT > 0) rig.hitT = Math.max(0, rig.hitT - dt);
      rig.body.rotation.z = rig.hitT > 0 ? Math.sin(rig.hitT * 45) * 0.14 : 0;
      // lampo bianco brevissimo sulla capsula colpita (si vede CHI e' stato colpito anche da lontano)
      const fl = rig.hitT > 0.14 ? 0.85 : 0;
      rig.bodyMat.emissiveColor.set(fl, fl, fl);
      if (rig.flashT > 0) {
        rig.flashT -= dt;
        if (rig.flashT <= 0) rig.flash.isVisible = false;
      }
      this.lastPos.set(snap.id, { x: snap.x, z: snap.z });
      rig.body.setEnabled(snap.alive || rig.deathT > 0);
      if (snap.alive) {
        rig.body.position.x = snap.x;
        rig.body.position.z = snap.z;
        rig.body.rotation.y = snap.yaw;
      }
      const cam = this.cams.find((c) => c.playerId === snap.id);
      if (cam) this.updateCam(cam, snap, dt);
      const h = this.hud.get(snap.id);
      if (!h) continue;
      const frac = Math.max(0, Math.min(1, snap.hp / snap.maxHp));
      h.hpFill.width = `${Math.round(frac * 204)}px`;
      h.hpFill.background = frac > 0.4 ? '#4ade80' : '#f87171';
      h.hpText.text = `${Math.max(0, Math.round(snap.hp))}`;
      const w = getWeapon(snap.weaponId);
      h.ammoText.text = snap.reloading ? `${w.icon} RICARICO…` : `${w.icon} ${snap.magazine}/${w.magazine}`;
      h.killText.text = `${snap.kills} kill`;

      if (h.hitmarkerTimer > 0) {
        h.hitmarkerTimer -= dt;
        const dur = h.hitKill ? 0.42 : 0.2;
        const life = 1 - h.hitmarkerTimer / dur;
        h.hitmarker.alpha = Math.max(0, Math.min(1, h.hitmarkerTimer / (dur * 0.6)));
        // pulse: parte grande e si stringe (scatto); la kill e' rossa e piu' grossa
        const sc = (h.hitKill ? 1.6 : 1) * (1 + 0.5 * Math.max(0, 1 - life * 4));
        h.hitmarker.scaleX = sc;
        h.hitmarker.scaleY = sc;
        h.hitmarker.color = h.hitKill ? '#ff4d4d' : '#ffffff';
      }
      for (const ind of h.dmgInds) {
        if (ind.t <= 0) continue;
        ind.t = Math.max(0, ind.t - dt);
        ind.box.alpha = Math.min(1, ind.t * 2.2);
      }
      if (h.vignetteTimer > 0) {
        h.vignetteTimer -= dt;
        h.vignette.alpha = Math.max(0, Math.min(0.85, h.vignetteTimer / 0.35));
      }
      // ---- ABILITA' ----
      const ab = snap.ability;
      if (ab) {
        const name = this.abilityName.get(snap.id) ?? '';
        const color = ab.state === 'READY' ? '#4ade80' : ab.state === 'ACTIVE' ? '#facc15' : ab.state === 'CHARGING' ? '#c4b5fd' : ab.state === 'COOLDOWN' ? '#9ca3af' : '#6b7280';
        const t = `${ab.state === 'SPENT' ? '✕' : ab.state === 'COOLDOWN' ? '⌛' : '⚡'} ${name} · ${stateLabel(ab)}`;
        if (h.abilityText.text !== t) h.abilityText.text = t;
        h.abilityText.color = color;
      }
      const showBar = snap.alive && snap.reloading && snap.sweetFrom !== null && snap.sweetFrom !== undefined;
      h.reloadBar.isVisible = showBar;
      if (showBar) {
        const sweetBox = (h.reloadBar.metadata as { sweet: Rectangle }).sweet;
        const from = snap.sweetFrom ?? 0.45;
        sweetBox.left = `${Math.round(from * 234)}px`;
        sweetBox.width = `${Math.round((1 - from) * 234)}px`;
        h.reloadFill.width = `${Math.round(Math.max(0, Math.min(1, snap.reloadFrac ?? 0)) * 232)}px`;
        h.reloadFill.background = (snap.reloadFrac ?? 0) >= from ? '#4ade80' : '#facc15';
      }
      h.guardFrame.alpha = snap.guard && snap.alive ? 0.55 : 0;
      const lockOn = !!snap.locked && snap.alive;
      h.lockText.isVisible = lockOn;
      if (lockOn) h.lockText.text = '✋ BLOCCATO!';
      h.centerText.isVisible = !snap.alive || h.centerText.text.length > 0;
      if (!snap.alive && h.centerText.text.length === 0) h.centerText.text = '💀 RESPAWN…';
      if (snap.alive && h.centerText.text === '💀 RESPAWN…') h.centerText.text = '';
    }
    this.updateGhosts(players);
  }

  /** Vista a raggi X del Dottore: a ogni avversario vivo si accende il fantasma per le finestre di chi sta vedendo attraverso i muri. */
  private updateGhosts(players: FpsRenderSnapshot[]): void {
    const viewers = this.cams.map((c) => ({ id: c.playerId, bit: wallBit(c.index), on: !!players.find((q) => q.id === c.playerId)?.wall && !!players.find((q) => q.id === c.playerId)?.alive }));
    for (const snap of players) {
      const rig = this.avatars.get(snap.id);
      if (!rig) continue;
      let mask = 0;
      if (snap.alive) for (const v of viewers) if (v.on && v.id !== snap.id) mask |= v.bit;
      rig.ghost.layerMask = mask;
      rig.ghost.isVisible = mask !== 0;
      if (mask !== 0) {
        rig.ghost.position.set(snap.x, 0.98, snap.z);
        rig.ghost.rotation.y = snap.yaw;
      }
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const c of this.cams) safely('fpsVm.dispose', () => c.vm.dispose());
    window.removeEventListener('resize', this.onResize);
    this.perfEl?.remove();
    this.perfEl = null;
    for (const h of this.hud.values()) safely('fpsHud.dispose', () => h.adt.dispose());
    safely('fpsScene.dispose', () => this.scene.dispose());
    safely('fpsEngine.dispose', () => this.engine.dispose());
    this.hud.clear();
    this.avatars.clear();
    this.cams = [];
  }
}
