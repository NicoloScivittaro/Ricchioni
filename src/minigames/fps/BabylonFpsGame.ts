import { Engine, Scene, Color4, Color3, StandardMaterial, MeshBuilder, Mesh, UniversalCamera, Viewport, Vector3 } from '@babylonjs/core';
import { AdvancedDynamicTexture, TextBlock, Rectangle, Control } from '@babylonjs/gui';
import type { PlayerId } from '../../../shared/types';
import { buildFpsWorld } from '../../controller/fpsWorld';
import { splitScreenLayout } from '../kart-race/cameraHud';
import { getWeapon } from '../../../shared/fpsWeapons';
import { guardLoop, safely } from '../../core/loopGuard';
import { applyQuality, engineOptions } from '../../core/quality';

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
}

// Layer HUD: stessa tecnica di kart-race (bit su layerMask), scena separata quindi nessuna collisione possibile
// con gli indici usati la'.
const HUD_LAYER_BIT0 = 20; // 20..24: HUD di ciascun giocatore
// Bit "identita' capsula" (M6.1): ogni capsula porta SOLO questo bit (non la maschera di default) — la propria
// camera lo toglie dalla propria maschera (non vede la propria capsula da vicino), le altre camere lo mantengono
// (la vedono normalmente). Fascia separata dall'HUD (10..14, mai 20..24): nessuna collisione, fino a 5 giocatori.
const AVATAR_LAYER_BIT0 = 10;
const DEFAULT_LAYER_MASK = 0x0fffffff;
const hudBit = (i: number): number => 1 << (HUD_LAYER_BIT0 + i);
const avatarBit = (i: number): number => 1 << (AVATAR_LAYER_BIT0 + i);

const EYE_HEIGHT = 1.5;

interface CamRig {
  index: number;
  playerId: PlayerId;
  camera: UniversalCamera;
}

interface AvatarRig {
  body: Mesh;
  gun: Mesh;
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
}

export class BabylonFpsGame {
  private engine: Engine;
  private scene: Scene;
  private cams: CamRig[] = [];
  private avatars = new Map<PlayerId, AvatarRig>();
  private hud = new Map<PlayerId, HudEntry>();
  private disposed = false;
  private paused = false;
  private onResize = (): void => this.engine.resize();

  constructor(
    private canvas: HTMLCanvasElement,
    private localPlayerIds: PlayerId[] // ordine stabile: chi ha il controller ALL'AVVIO del round, nell'ordine dei giocatori
  ) {
    this.engine = new Engine(canvas, engineOptions().antialias, engineOptions());
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.07, 0.08, 0.12, 1);
    buildFpsWorld(this.scene);

    const rects = splitScreenLayout(localPlayerIds.length);
    localPlayerIds.forEach((pid, i) => {
      const camera = new UniversalCamera(`fpsCam_${pid}`, new Vector3(0, EYE_HEIGHT, 0), this.scene);
      camera.minZ = 0.15;
      camera.maxZ = 260;
      camera.fov = 1.05;
      camera.viewport = new Viewport(rects[i].x, rects[i].y, rects[i].w, rects[i].h);
      // Maschera camera: tutto per default, il PROPRIO gruppo HUD al posto di tutti i gruppi HUD, MAI la propria
      // capsula (avatarBit(i) tolto qui e solo qui — le altre camere lo mantengono, la vedono normalmente).
      camera.layerMask = (DEFAULT_LAYER_MASK & ~(0x1f << HUD_LAYER_BIT0) & ~avatarBit(i)) | hudBit(i);
      this.cams.push({ index: i, playerId: pid, camera });
      this.hud.set(pid, this.buildHud(i, rects.length));
    });
    this.scene.activeCameras = this.cams.map((c) => c.camera);

    applyQuality(this.engine, this.scene);
    this.engine.runRenderLoop(guardLoop(() => {
      if (this.disposed || this.paused) return;
      this.scene.render();
    }));
    window.addEventListener('resize', this.onResize);
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  isLocal(playerId: PlayerId): boolean {
    return this.localPlayerIds.includes(playerId);
  }

  private ensureAvatar(pid: PlayerId, color: string): AvatarRig {
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
    const ownIndex = this.cams.find((c) => c.playerId === pid)?.index;
    if (ownIndex !== undefined) {
      body.layerMask = avatarBit(ownIndex);
      gun.layerMask = avatarBit(ownIndex);
    }
    rig = { body, gun };
    this.avatars.set(pid, rig);
    return rig;
  }

  private buildHud(index: number, total: number): HudEntry {
    const adt = AdvancedDynamicTexture.CreateFullscreenUI(`fpsHud_${index}`, true, this.scene);
    if (adt.layer) adt.layer.layerMask = hudBit(index);

    const panel = new Rectangle(`fpsPanel_${index}`);
    panel.width = '190px';
    panel.height = '58px';
    panel.thickness = 0;
    panel.background = 'rgba(8,10,18,0.6)';
    panel.cornerRadius = 10;
    panel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    panel.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    panel.left = '12px';
    panel.top = '-12px';
    adt.addControl(panel);

    const hpBar = new Rectangle('hpBar');
    hpBar.width = '160px';
    hpBar.height = '14px';
    hpBar.top = '-14px';
    hpBar.thickness = 1;
    hpBar.color = '#00000055';
    hpBar.background = '#1f2430';
    hpBar.cornerRadius = 4;
    panel.addControl(hpBar);
    const hpFill = new Rectangle('hpFill');
    hpFill.width = '156px';
    hpFill.height = '10px';
    hpFill.thickness = 0;
    hpFill.background = '#4ade80';
    hpFill.cornerRadius = 3;
    hpFill.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    hpFill.left = '1px';
    hpBar.addControl(hpFill);
    const hpText = new TextBlock('hpText', '100');
    hpText.color = '#ffffff';
    hpText.fontSize = 11;
    hpBar.addControl(hpText);

    const ammoText = new TextBlock('ammoText', '');
    ammoText.color = '#e5e7eb';
    ammoText.fontFamily = '"Arial Black", Arial, sans-serif';
    ammoText.fontSize = 15;
    ammoText.top = '6px';
    ammoText.height = '18px';
    panel.addControl(ammoText);

    const killText = new TextBlock('killText', '0 kill');
    killText.color = '#facc15';
    killText.fontSize = 11;
    killText.top = '20px';
    killText.height = '14px';
    panel.addControl(killText);

    const hitmarker = new TextBlock(`fpsHitmarker_${index}`, '✕');
    hitmarker.fontSize = total >= 4 ? 34 : 44;
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
    vignette.thickness = total >= 4 ? 40 : 70;
    vignette.color = '#ef4444';
    vignette.alpha = 0;
    vignette.isHitTestVisible = false;
    adt.addControl(vignette);

    const centerText = new TextBlock(`fpsCenter_${index}`, '');
    centerText.fontFamily = '"Arial Black", Arial, sans-serif';
    centerText.fontSize = total >= 4 ? 26 : 36;
    centerText.color = '#f87171';
    centerText.outlineColor = '#000000';
    centerText.outlineWidth = 6;
    centerText.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    centerText.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    adt.addControl(centerText);

    return { adt, hpFill, hpText, ammoText, killText, hitmarker, hitmarkerTimer: 0, vignette, vignetteTimer: 0, centerText };
  }

  /** Un colpo confermato dal PROPRIO sparo (hitmarker) o un danno subito (vignetta rossa) — solo feedback, nessuna logica. */
  notifyHit(shooterId: PlayerId | null, targetId: PlayerId | null): void {
    if (shooterId) {
      const h = this.hud.get(shooterId);
      if (h) h.hitmarkerTimer = 0.18;
    }
    if (targetId) {
      const h = this.hud.get(targetId);
      if (h) h.vignetteTimer = 0.35;
    }
  }

  setRoundEndMessage(text: string): void {
    for (const h of this.hud.values()) h.centerText.text = text;
  }

  /** Chiamato dal chiamante (FpsScene) una volta al frame: aggiorna camere/avatar/HUD dallo stato di simulazione. */
  update(dt: number, players: FpsRenderSnapshot[]): void {
    if (this.disposed) return;
    for (const snap of players) {
      const rig = this.ensureAvatar(snap.id, snap.color);
      rig.body.setEnabled(snap.alive);
      if (snap.alive) {
        rig.body.position.x = snap.x;
        rig.body.position.z = snap.z;
        rig.body.rotation.y = snap.yaw;
      }
      const cam = this.cams.find((c) => c.playerId === snap.id);
      if (cam && snap.alive) {
        cam.camera.position.set(snap.x, EYE_HEIGHT, snap.z);
        cam.camera.rotation.y = snap.yaw;
        cam.camera.rotation.x = -snap.pitch;
      }
      const h = this.hud.get(snap.id);
      if (!h) continue;
      const frac = Math.max(0, Math.min(1, snap.hp / snap.maxHp));
      h.hpFill.width = `${Math.round(frac * 156)}px`;
      h.hpFill.background = frac > 0.4 ? '#4ade80' : '#f87171';
      h.hpText.text = `${Math.max(0, Math.round(snap.hp))}`;
      const w = getWeapon(snap.weaponId);
      h.ammoText.text = snap.reloading ? `${w.icon} RICARICO…` : `${w.icon} ${snap.magazine}/${w.magazine}`;
      h.killText.text = `${snap.kills} kill`;

      if (h.hitmarkerTimer > 0) {
        h.hitmarkerTimer -= dt;
        h.hitmarker.alpha = Math.max(0, Math.min(1, h.hitmarkerTimer / 0.18));
      }
      if (h.vignetteTimer > 0) {
        h.vignetteTimer -= dt;
        h.vignette.alpha = Math.max(0, Math.min(0.85, h.vignetteTimer / 0.35));
      }
      h.centerText.isVisible = !snap.alive || h.centerText.text.length > 0;
      if (!snap.alive && h.centerText.text.length === 0) h.centerText.text = '💀 RESPAWN…';
      if (snap.alive && h.centerText.text === '💀 RESPAWN…') h.centerText.text = '';
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    window.removeEventListener('resize', this.onResize);
    for (const h of this.hud.values()) safely('fpsHud.dispose', () => h.adt.dispose());
    safely('fpsScene.dispose', () => this.scene.dispose());
    safely('fpsEngine.dispose', () => this.engine.dispose());
    this.hud.clear();
    this.avatars.clear();
    this.cams = [];
  }
}
