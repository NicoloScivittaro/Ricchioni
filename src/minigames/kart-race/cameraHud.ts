import { Scene, UniversalCamera, Vector3, Engine, Viewport } from '@babylonjs/core';
import { AdvancedDynamicTexture, TextBlock, Rectangle, Control } from '@babylonjs/gui';
import type { PlayerId } from '../../../shared/types';
import { popCountdown } from '../../core/countdownFx';
import type { KartState } from './raceTypes';
import type { TrackSpline } from './track';
import { itemLabel } from './items';
import { MAX_SPEED } from './kartPhysics';

export interface ViewportRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Layout split-screen normalizzati (origine in basso a sinistra, convenzione Babylon). */
export function splitScreenLayout(n: number): ViewportRect[] {
  if (n <= 1) return [{ x: 0, y: 0, w: 1, h: 1 }];
  if (n === 2) return [
    { x: 0, y: 0, w: 0.5, h: 1 },
    { x: 0.5, y: 0, w: 0.5, h: 1 }
  ];
  if (n === 3) return [
    { x: 0, y: 0.5, w: 0.5, h: 0.5 },
    { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
    { x: 0, y: 0, w: 1, h: 0.5 }
  ];
  if (n === 4) return [
    { x: 0, y: 0.5, w: 0.5, h: 0.5 },
    { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
    { x: 0, y: 0, w: 0.5, h: 0.5 },
    { x: 0.5, y: 0, w: 0.5, h: 0.5 }
  ];
  return [
    { x: 0, y: 0.5, w: 1 / 3, h: 0.5 },
    { x: 1 / 3, y: 0.5, w: 1 / 3, h: 0.5 },
    { x: 2 / 3, y: 0.5, w: 1 / 3, h: 0.5 },
    { x: 0, y: 0, w: 0.5, h: 0.5 },
    { x: 0.5, y: 0, w: 0.5, h: 0.5 }
  ];
}

const CAM_BACK = 6.4;
const CAM_UP = 2.7;
const CAM_LOOK_AHEAD = 9;
const CAM_FOLLOW_SPEED = 7;
const CAM_BASE_FOV = 0.95;

interface CamRig {
  camera: UniversalCamera;
  smoothPos: Vector3;
  smoothLook: Vector3;
  smoothFov: number;
  shakeTimer: number;
  prevStunned: boolean;
}

/** Camera third-person per kart + split-screen via viewport multipli sulla STESSA scena. */
export class CameraManager {
  private rigs = new Map<PlayerId, CamRig>();

  constructor(private scene: Scene) {}

  ensure(playerId: PlayerId, startPos: Vector3): UniversalCamera {
    let rig = this.rigs.get(playerId);
    if (!rig) {
      const camera = new UniversalCamera(`cam_${playerId}`, startPos.clone(), this.scene);
      camera.fov = CAM_BASE_FOV;
      camera.minZ = 0.3;
      camera.maxZ = 1200;
      rig = { camera, smoothPos: startPos.clone(), smoothLook: startPos.clone(), smoothFov: CAM_BASE_FOV, shakeTimer: 0, prevStunned: false };
      this.rigs.set(playerId, rig);
    }
    return rig.camera;
  }

  applyLayout(order: PlayerId[]): void {
    const rects = splitScreenLayout(order.length);
    const active: UniversalCamera[] = [];
    order.forEach((pid, i) => {
      const rig = this.rigs.get(pid);
      if (!rig) return;
      const r = rects[i];
      rig.camera.viewport = new Viewport(r.x, r.y, r.w, r.h);
      active.push(rig.camera);
    });
    this.scene.activeCameras = active;
  }

  update(dt: number, playerId: PlayerId, state: KartState, spline: TrackSpline): void {
    const rig = this.rigs.get(playerId);
    if (!rig) return;

    const tangent = spline.tangentAt(state.distance);
    const right = spline.rightAt(state.distance);
    const forward = tangent.scale(Math.cos(state.heading)).add(right.scale(Math.sin(state.heading))).normalize();
    const kartPos = spline.worldPoint(state.distance, state.lateral, 0.1);

    const speedFrac = Math.max(0, Math.min(1, state.speed / MAX_SPEED));
    const boosting = state.boostTimer > 0;

    const desiredPos = kartPos.subtract(forward.scale(CAM_BACK + speedFrac * 1.1)).add(new Vector3(0, CAM_UP, 0));
    const anticipate = right.scale(state.heading * 2.2);
    const desiredLook = kartPos.add(forward.scale(CAM_LOOK_AHEAD)).add(anticipate).add(new Vector3(0, 0.8, 0));

    const alpha = 1 - Math.exp(-CAM_FOLLOW_SPEED * dt);
    rig.smoothPos = Vector3.Lerp(rig.smoothPos, desiredPos, alpha);
    rig.smoothLook = Vector3.Lerp(rig.smoothLook, desiredLook, alpha);

    // Espansione FOV con la velocità ridotta (era 0.22 + 0.18 in boost): l'effetto velocità resta ma non
    // amplifica più la sensazione di "troppo veloce".
    const targetFov = CAM_BASE_FOV + speedFrac * 0.14 + (boosting ? 0.1 : 0);
    rig.smoothFov = rig.smoothFov + (targetFov - rig.smoothFov) * Math.min(1, dt * 5);

    const stunned = state.stunTimer > 0;
    if (stunned && !rig.prevStunned) rig.shakeTimer = 0.28;
    rig.prevStunned = stunned;

    let shakeOffset = Vector3.Zero();
    if (rig.shakeTimer > 0) {
      rig.shakeTimer -= dt;
      const mag = 0.18 * (rig.shakeTimer / 0.28);
      shakeOffset = new Vector3((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag);
    }

    rig.camera.position.copyFrom(rig.smoothPos.add(shakeOffset));
    rig.camera.setTarget(rig.smoothLook);
    rig.camera.fov = rig.smoothFov;
  }

  dispose(): void {
    for (const rig of this.rigs.values()) rig.camera.dispose();
    this.rigs.clear();
  }
}

interface HudEntry {
  panel: Rectangle;
  posText: TextBlock;
  lapText: TextBlock;
  itemText: TextBlock;
  driftBar: Rectangle;
  driftFill: Rectangle;
  abilityBar: Rectangle;
  abilityFill: Rectangle;
  abilityLabel: TextBlock;
  debtText: TextBlock;
  flashText: TextBlock;
  flashTimer: number;
}

/** HUD essenziale per viewport (Babylon GUI, un solo AdvancedDynamicTexture condiviso). */
export class KartHud {
  private adt: AdvancedDynamicTexture;
  private entries = new Map<PlayerId, HudEntry>();
  private countdownText: TextBlock;

  constructor(scene: Scene, private engine: Engine) {
    this.adt = AdvancedDynamicTexture.CreateFullscreenUI('kartHud', true, scene);
    this.countdownText = new TextBlock('countdown', '');
    this.countdownText.fontFamily = '"Arial Black", Arial, sans-serif';
    this.countdownText.fontSize = 96;
    this.countdownText.color = '#ffffff';
    this.countdownText.outlineColor = '#000000';
    this.countdownText.outlineWidth = 8;
    this.countdownText.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.countdownText.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    this.adt.addControl(this.countdownText);
  }

  setCountdown(text: string): void {
    this.countdownText.text = text;
    if (text) popCountdown(this.countdownText, this.adt.getScene(), text === 'VIA!');
  }

  ensure(playerId: PlayerId, colorHex: string): HudEntry {
    let e = this.entries.get(playerId);
    if (e) return e;

    const panel = new Rectangle(`hudPanel_${playerId}`);
    panel.width = '150px';
    panel.height = '150px';
    panel.thickness = 0;
    panel.background = 'rgba(8,10,18,0.55)';
    panel.cornerRadius = 10;
    panel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    panel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.adt.addControl(panel);

    const posText = new TextBlock('posText', '1°/1');
    posText.color = colorHex;
    posText.fontFamily = '"Arial Black", Arial, sans-serif';
    posText.fontSize = 26;
    posText.top = '-20px';
    posText.height = '32px';
    panel.addControl(posText);

    const lapText = new TextBlock('lapText', 'GIRO 1/3');
    lapText.color = '#e5e7eb';
    lapText.fontSize = 14;
    lapText.top = '8px';
    lapText.height = '18px';
    panel.addControl(lapText);

    const itemText = new TextBlock('itemText', '');
    itemText.color = '#fbbf24';
    itemText.fontSize = 13;
    itemText.top = '26px';
    itemText.height = '18px';
    panel.addControl(itemText);

    const driftBar = new Rectangle('driftBar');
    driftBar.width = '120px';
    driftBar.height = '8px';
    driftBar.top = '38px';
    driftBar.thickness = 1;
    driftBar.color = '#00000055';
    driftBar.background = '#1f2430';
    driftBar.cornerRadius = 4;
    panel.addControl(driftBar);

    const driftFill = new Rectangle('driftFill');
    driftFill.width = '0px';
    driftFill.height = '6px';
    driftFill.thickness = 0;
    driftFill.background = '#4ade80';
    driftFill.cornerRadius = 3;
    driftFill.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    driftFill.left = '1px';
    driftBar.addControl(driftFill);

    const abilityLabel = new TextBlock('abilityLabel', '');
    abilityLabel.color = '#c4b5fd';
    abilityLabel.fontSize = 11;
    abilityLabel.top = '48px';
    abilityLabel.height = '14px';
    panel.addControl(abilityLabel);

    const abilityBar = new Rectangle('abilityBar');
    abilityBar.width = '120px';
    abilityBar.height = '7px';
    abilityBar.top = '62px';
    abilityBar.thickness = 1;
    abilityBar.color = '#00000055';
    abilityBar.background = '#1f2430';
    abilityBar.cornerRadius = 4;
    panel.addControl(abilityBar);

    const abilityFill = new Rectangle('abilityFill');
    abilityFill.width = '0px';
    abilityFill.height = '5px';
    abilityFill.thickness = 0;
    abilityFill.background = '#a78bfa';
    abilityFill.cornerRadius = 3;
    abilityFill.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    abilityFill.left = '1px';
    abilityBar.addControl(abilityFill);

    const debtText = new TextBlock('debtText', '');
    debtText.color = '#f472b6';
    debtText.fontFamily = '"Arial Black", Arial, sans-serif';
    debtText.fontSize = 11;
    debtText.top = '78px';
    debtText.height = '14px';
    debtText.isVisible = false;
    panel.addControl(debtText);

    const flashText = new TextBlock(`flash_${playerId}`, '');
    flashText.fontFamily = '"Arial Black", Arial, sans-serif';
    flashText.fontSize = 30;
    flashText.color = '#fbbf24';
    flashText.outlineColor = '#000000';
    flashText.outlineWidth = 6;
    flashText.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    flashText.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    flashText.textWrapping = true;
    this.adt.addControl(flashText);

    e = { panel, posText, lapText, itemText, driftBar, driftFill, abilityBar, abilityFill, abilityLabel, debtText, flashText, flashTimer: 0 };
    this.entries.set(playerId, e);
    return e;
  }

  /** Messaggio grande e temporaneo nel viewport del giocatore (es. "EXPLOIT!"). */
  flash(playerId: PlayerId, text: string, color = '#fbbf24', durationSec = 1.4): void {
    const e = this.entries.get(playerId);
    if (!e) return;
    e.flashText.text = text;
    e.flashText.color = color;
    e.flashText.alpha = 1;
    e.flashTimer = durationSec;
  }

  layout(order: PlayerId[]): void {
    const rects = splitScreenLayout(order.length);
    const w = this.engine.getRenderWidth();
    const h = this.engine.getRenderHeight();
    order.forEach((pid, i) => {
      const e = this.entries.get(pid);
      if (!e) return;
      const r = rects[i];
      const px = r.x * w;
      const py = (1 - r.y - r.h) * h;
      e.panel.left = `${px + 10}px`;
      e.panel.top = `${py + 10}px`;
      e.flashText.left = `${px + r.w * w * 0.5 - w * 0.5}px`;
      e.flashText.top = `${py + r.h * h * 0.32 - h * 0.5}px`;
      e.flashText.width = `${Math.max(120, r.w * w - 20)}px`;
    });
  }

  update(playerId: PlayerId, state: KartState, total: number, laps: number, driftT: [number, number, number], dt: number): void {
    const e = this.entries.get(playerId);
    if (!e) return;
    e.posText.text = ordinal(state.placement || 1) + `/${total}`;
    e.lapText.text = `GIRO ${Math.min(state.lap + 1, laps)}/${laps}`;
    e.itemText.text = state.heldItem ? itemLabel(state.heldItem) : '—';

    const maxCharge = driftT[2];
    const frac = state.drifting ? Math.min(1, state.driftCharge / maxCharge) : 0;
    e.driftFill.width = `${Math.round(frac * 118)}px`;
    e.driftFill.background = state.driftCharge >= driftT[2] ? '#f97316' : state.driftCharge >= driftT[1] ? '#facc15' : '#4ade80';
    e.driftBar.isVisible = state.drifting;

    const hasMeter = state.characterId === 'goblin' || state.characterId === 'dottore' || state.characterId === 'judoka';
    const hasCharges = state.characterId === 'buttafuori' || state.characterId === 'ciro';
    e.abilityBar.isVisible = hasMeter;
    e.abilityLabel.isVisible = hasMeter || hasCharges;
    if (hasMeter) {
      const ready = state.abilityMeter >= 1;
      e.abilityFill.width = `${Math.round(Math.min(1, state.abilityMeter) * 118)}px`;
      e.abilityFill.background = ready ? '#facc15' : '#a78bfa';
      e.abilityLabel.text = ready ? '⭐ ABILITÀ PRONTA' : 'ABILITÀ';
      e.abilityLabel.color = ready ? '#facc15' : '#c4b5fd';
    } else if (hasCharges) {
      e.abilityLabel.text = state.abilityCharges > 0 ? '⚡ ABILITÀ PRONTA' : 'ABILITÀ USATA';
      e.abilityLabel.color = state.abilityCharges > 0 ? '#4ade80' : '#6b7280';
    }

    if (state.debtPending) {
      e.debtText.isVisible = true;
      e.debtText.text = `💳 DEBITO: ${Math.max(0, Math.ceil(state.debtTimer))}s`;
    } else {
      e.debtText.isVisible = false;
    }

    if (e.flashTimer > 0) {
      e.flashTimer -= dt;
      e.flashText.alpha = Math.min(1, e.flashTimer * 3);
      if (e.flashTimer <= 0) e.flashText.text = '';
    }
  }

  dispose(): void {
    this.adt.dispose();
  }
}

function ordinal(n: number): string {
  return `${n}°`;
}
