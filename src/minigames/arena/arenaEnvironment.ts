import { Color3, DynamicTexture, Mesh, MeshBuilder, Scene, StandardMaterial, Vector4 } from '@babylonjs/core';
import { ARENA_R, ARENA_R_MIN } from './arenaTypes';
import { EnvKit, PAL, SIGN_FONT, seeded } from '../env/envKit';
import type { Xf } from '../env/envKit';

/**
 * ARENA DEL DISAGIO — show televisivo assurdo + arena sportiva + incontro clandestino (cartoon).
 * La PIATTAFORMA di gioco e' identica (stesso cilindro, stesso raggio, stesso restringimento): cambia solo l'aspetto.
 *  - PRIMARY: maxischermo sopra gli spalti di fondo (ROUND / KO! / IL BORDO SI STRINGE / ULTIMI 2), 4 torri luce
 *  - SECONDARY: spalti a gradoni tutto intorno con la folla a sagome, struttura industriale sotto la piattaforma
 *  - TERTIARY: striscioni e un paio di gag sugli spalti (mai sul piano di gioco)
 * Il BORDO e' la meccanica: fascia a strisce di pericolo + anello luminoso ambra, che diventa ROSSO e pulsa quando
 * si stringe; sotto c'e' profondita' vera (tralicci e luci che si perdono nella nebbia), non uno sfondo nero.
 */

export interface ArenaEnvironment {
  platform: Mesh;
  edgeRing: Mesh;
  setShrink(scale: number, danger: boolean): void;
  update(now: number): void;
  /** Maxischermo + folla: solo spettacolo (KO, restringimento, ultimi rimasti). */
  show(kind: 'start' | 'ko' | 'shrink' | 'last2' | 'winner', text?: string): void;
}

const STAND_R0 = ARENA_R * 1.75; // primo gradone
const STEPS = 6;
const STEP_D = 2.2;
const STEP_H = 1.25;

/** Pavimento: pulito e contrastato. Centro con il logo, anelli tenui, fascia di pericolo sul bordo. */
function floorTexture(kit: EnvKit): DynamicTexture {
  return kit.texture('arenaFloor2', 1024, 1024, (c, S) => {
    const cx = S / 2;
    // angoli fuori dal disco = colore del FIANCO della piattaforma (vedi faceUV)
    c.fillStyle = '#26203a';
    c.fillRect(0, 0, S, S);
    const disc = (r: number, col: string): void => {
      c.fillStyle = col;
      c.beginPath();
      c.arc(cx, cx, r * S * 0.5, 0, Math.PI * 2);
      c.fill();
    };
    // FASCIA DI PERICOLO (esterno): strisce giallo/nero solo nell'ultimo anello
    disc(1, PAL.hazard);
    c.save();
    c.beginPath();
    c.arc(cx, cx, S * 0.5, 0, Math.PI * 2);
    c.arc(cx, cx, S * 0.5 * 0.9, 0, Math.PI * 2, true);
    c.clip();
    c.fillStyle = PAL.hazardDark;
    const n = 48;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      c.beginPath();
      c.moveTo(cx, cx);
      c.arc(cx, cx, S * 0.52, a, a + (Math.PI / n) * 0.9);
      c.closePath();
      c.fill();
    }
    c.restore();
    // linea bianca di avviso all'interno della fascia
    disc(0.9, '#f4f1e8');
    // piano di gioco: ardesia blu-viola, anelli concentrici tenui (non colori giocatore)
    disc(0.875, '#3a3f63');
    disc(0.7, '#41466d');
    disc(0.52, '#3a3f63');
    disc(0.34, '#454b75');
    // centro: medaglione con stella del DISAGIO
    disc(0.2, '#2b2f4c');
    c.strokeStyle = '#f4f1e8';
    c.lineWidth = 6;
    c.beginPath();
    c.arc(cx, cx, S * 0.1, 0, Math.PI * 2);
    c.stroke();
    c.fillStyle = PAL.neonAmber;
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = (i % 2 === 0 ? 0.075 : 0.032) * S;
      const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
      c.lineTo(cx + Math.cos(a) * r, cx + Math.sin(a) * r);
    }
    c.closePath();
    c.fill();
    // scritta discreta intorno al medaglione
    c.fillStyle = 'rgba(244,241,232,0.55)';
    c.font = `900 ${S * 0.03}px ${SIGN_FONT}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    const label = '★ DISAGIO CUP ★ ARENA DEL DISAGIO ';
    for (let i = 0; i < label.length; i++) {
      const a = (i / label.length) * Math.PI * 2;
      c.save();
      c.translate(cx + Math.cos(a) * S * 0.135, cx + Math.sin(a) * S * 0.135);
      c.rotate(a + Math.PI / 2);
      c.fillText(label[i], 0, 0);
      c.restore();
    }
    // segni d'usura leggerissimi (non rumore)
    const rnd = seeded(11);
    c.fillStyle = 'rgba(255,255,255,0.025)';
    for (let i = 0; i < 160; i++) {
      const a = rnd() * Math.PI * 2;
      const r = rnd() * S * 0.43;
      c.fillRect(cx + Math.cos(a) * r, cx + Math.sin(a) * r, 3 + rnd() * 10, 2);
    }
  }, { mips: true });
}

/** Maxischermo: texture aggiornata SOLO quando cambia il messaggio. */
class JumboTron {
  private tex: DynamicTexture;
  private last = '';
  private flashUntil = 0;
  /** Due schermi (stessa texture: un solo aggiornamento) ai lati della curva di fondo: al centro c'e' il titolo dell'HUD. */
  constructor(kit: EnvKit, spots: { x: number; y: number; z: number; ry: number }[], w: number, h: number) {
    this.tex = new DynamicTexture('jumbo', { width: 512, height: 256 }, kit.scene, false);
    const m = new StandardMaterial('jumboMat', kit.scene);
    m.emissiveTexture = this.tex;
    m.diffuseColor = Color3.Black();
    m.disableLighting = true;
    const frame = kit.mat(PAL.metalDark, { spec: 0.1 });
    const screens: Mesh[] = [];
    const frames: Mesh[] = [];
    for (const sp of spots) {
      const screen = MeshBuilder.CreatePlane('jumboScreen', { width: w, height: h }, kit.scene);
      screen.position.set(sp.x, sp.y, sp.z);
      screen.rotation.y = sp.ry;
      screens.push(screen);
      // cornice dietro lo schermo (spostata verso l'esterno lungo la normale) + gamba
      const bx = sp.x + Math.sin(sp.ry) * 0.35;
      const bz = sp.z + Math.cos(sp.ry) * 0.35;
      frames.push(kit.box('jumboFrame', w + 0.8, h + 0.8, 0.5, { x: bx, y: sp.y, z: bz, ry: sp.ry }, frame));
      const legH = sp.y - h / 2 + 4;
      frames.push(kit.box('jumboLeg', 0.6, legH, 0.6, { x: bx, y: sp.y - h / 2 - legH / 2, z: bz }, frame));
    }
    const merged = kit.merge('jumboScreens', screens, m);
    if (merged) kit.excludeFromGlow(merged);
    kit.merge('jumboFrames', frames, frame);
    this.draw('ARENA\nDEL DISAGIO', PAL.neonAmber);
  }

  draw(text: string, color: string, sub = ''): void {
    const key = text + color + sub;
    if (key === this.last) return;
    this.last = key;
    const c = this.tex.getContext() as unknown as CanvasRenderingContext2D;
    c.fillStyle = '#0c0a18';
    c.fillRect(0, 0, 512, 256);
    // pixel del maxischermo (righe orizzontali)
    c.fillStyle = 'rgba(255,255,255,0.04)';
    for (let y = 0; y < 256; y += 4) c.fillRect(0, y, 512, 1);
    c.strokeStyle = color;
    c.lineWidth = 6;
    c.strokeRect(10, 10, 492, 236);
    c.fillStyle = color;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    const lines = text.split('\n');
    const size = lines.length > 1 ? 70 : 104;
    c.font = `900 ${size}px ${SIGN_FONT}`;
    lines.forEach((l, i) => c.fillText(l, 256, 128 + (i - (lines.length - 1) / 2) * size * 1.05 - (sub ? 18 : 0), 470));
    if (sub) {
      c.font = `900 30px ${SIGN_FONT}`;
      c.fillStyle = '#f4f1e8';
      c.fillText(sub, 256, 214, 470);
    }
    this.tex.update();
  }

  flash(text: string, color: string, ms: number, sub = ''): void {
    this.draw(text, color, sub);
    this.flashUntil = performance.now() + ms;
  }

  /** Torna al logo quando il messaggio e' scaduto. */
  tick(now: number, idle: string, idleColor: string): void {
    if (this.flashUntil && now > this.flashUntil) {
      this.flashUntil = 0;
      this.draw(idle, idleColor);
    }
  }
}

export function buildEnvironment(scene: Scene): ArenaEnvironment {
  const kit = new EnvKit(scene);
  scene.fogMode = Scene.FOGMODE_LINEAR;
  scene.fogColor = Color3.FromHexString('#1b1530');
  scene.fogStart = 75;
  scene.fogEnd = 210;

  kit.sky([[0, '#0d0a1c'], [0.5, '#1f1638'], [0.8, '#3a2558'], [1, '#5b3a73']]);

  kit.lightRig({
    key: [-0.3, -1, 0.45],
    keyColor: '#fff1dc',
    keyI: 0.95,
    sky: '#dcd6ff',
    ground: '#3b3157',
    fillI: 0.62,
    rim: { dir: [0.25, -0.45, -1], color: '#8fd3ff', i: 0.35 }
  });
  kit.glow(0.5);

  // ---- PIATTAFORMA (gameplay: stessa geometria di prima) ----
  const floorMat = new StandardMaterial('floorMat', scene);
  floorMat.diffuseTexture = floorTexture(kit);
  floorMat.specularColor = new Color3(0.06, 0.06, 0.08);
  floorMat.emissiveColor = new Color3(0.08, 0.08, 0.1);
  // il fianco del cilindro legge l'angolo della texture (colore metallo scuro), il coperchio il disco
  const side = new Vector4(0, 0, 0.01, 0.01);
  const platform = MeshBuilder.CreateCylinder('arenaPlatform', { diameter: ARENA_R * 2, height: 1.8, tessellation: 72, faceUV: [new Vector4(0, 0, 1, 1), side, new Vector4(0, 0, 1, 1)] }, scene);
  platform.position.y = -0.9; // top a y=0
  platform.material = floorMat;
  platform.isPickable = false;

  // anello luminoso del bordo: AMBRA (attenzione), ROSSO pulsante quando il bordo si stringe
  const edgeMat = new StandardMaterial('edgeMat', scene);
  edgeMat.diffuseColor = Color3.Black();
  edgeMat.emissiveColor = Color3.FromHexString(PAL.neonAmber);
  edgeMat.disableLighting = true;
  const edgeRing = MeshBuilder.CreateTorus('edgeRing', { diameter: ARENA_R * 2, thickness: 0.32, tessellation: 96 }, scene);
  edgeRing.position.y = 0.04;
  edgeRing.material = edgeMat;
  edgeRing.isPickable = false;
  // luci di bordo sul fianco (sotto il piano: non coprono nulla), seguono il restringimento
  const sideLights = MeshBuilder.CreateTorus('edgeSideLights', { diameter: ARENA_R * 2 + 0.05, thickness: 0.14, tessellation: 96 }, scene);
  sideLights.position.y = -0.7;
  sideLights.material = edgeMat;
  sideLights.isPickable = false;

  // ---- SOTTO L'ARENA: struttura industriale che si perde nella nebbia ----
  const truss = kit.mat(PAL.metalDark, { spec: 0.05, emissive: 0.15 });
  const under: Mesh[] = [];
  const pillarR = ARENA_R_MIN * 0.62; // sempre dentro il disco piu' piccolo: non sporge mai
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    under.push(kit.cyl('underPillar', 0.9, 1.3, 40, { x: Math.cos(a) * pillarR, y: -21, z: Math.sin(a) * pillarR }, truss, 6));
  }
  under.push(kit.cyl('underCore', ARENA_R_MIN * 1.3, ARENA_R_MIN * 0.9, 3.5, { x: 0, y: -3.6, z: 0 }, truss, 24));
  kit.merge('underStructure', under, truss);
  // lucine lontane nel vuoto (una sola mesh)
  const lamp = MeshBuilder.CreateSphere('voidLights', { diameter: 0.8, segments: 4 }, scene);
  lamp.material = kit.neon('#ff8a3d');
  const rnd = seeded(5);
  const voidLights: Xf[] = [];
  for (let i = 0; i < 46; i++) {
    const a = rnd() * Math.PI * 2;
    const r = 8 + rnd() * 34;
    voidLights.push({ x: Math.cos(a) * r, y: -12 - rnd() * 40, z: Math.sin(a) * r, s: 0.6 + rnd() * 1.2 });
  }
  kit.thin(lamp, voidLights);
  // fondo del pozzo: alone caldo (non nero)
  const pit = MeshBuilder.CreateDisc('voidGlow', { radius: 70, tessellation: 32 }, scene);
  pit.rotation.x = Math.PI / 2;
  pit.position.y = -58;
  const pitTex = kit.texture('voidGlowTex', 128, 128, (c) => {
    const g = c.createRadialGradient(64, 64, 4, 64, 64, 64);
    g.addColorStop(0, '#6a3a7a');
    g.addColorStop(0.5, '#2e1f4a');
    g.addColorStop(1, '#1b1530');
    c.fillStyle = g;
    c.fillRect(0, 0, 128, 128);
  });
  pit.material = kit.mat('#ffffff', { unlit: true, tex: pitTex, key: 'voidGlowMat' });
  kit.freeze(pit);
  kit.excludeFromGlow(pit);

  // ---- SPALTI a gradoni (anello aperto davanti alla camera: dietro la camera non serve nulla) ----
  const standMat = kit.mat(PAL.concreteDark, { spec: 0.02 });
  const standEdge = kit.neon('#b04a86');
  const arcFrom = -Math.PI * 0.12;
  const arcTo = Math.PI * 1.12; // fondo + lati (dietro la camera non serve nulla)
  const stands: Mesh[] = [];
  const edges: Mesh[] = [];
  const seats: { x: number; y: number; z: number }[] = [];
  const segs = 22;
  for (let s = 0; s < STEPS; s++) {
    const r = STAND_R0 + s * STEP_D;
    const y = -3.2 + s * STEP_H;
    for (let i = 0; i < segs; i++) {
      const a = arcFrom + ((i + 0.5) / segs) * (arcTo - arcFrom);
      const len = ((arcTo - arcFrom) / segs) * r + 0.05;
      const b = kit.box('stand', len, STEP_H, STEP_D, { x: Math.cos(a) * r, y: y - STEP_H / 2 + 0.6, z: Math.sin(a) * r, ry: -a + Math.PI / 2 }, standMat);
      stands.push(b);
      if (s === 0) edges.push(kit.box('standEdge', len, 0.25, 0.3, { x: Math.cos(a) * (r - STEP_D / 2), y: y + 0.6, z: Math.sin(a) * (r - STEP_D / 2), ry: -a + Math.PI / 2 }, standEdge));
      // posti a sedere: 3 per segmento per gradone
      for (let k = 0; k < 3; k++) {
        const aa = arcFrom + ((i + (k + 0.5) / 3) / segs) * (arcTo - arcFrom);
        seats.push({ x: Math.cos(aa) * r, y: y + 0.6, z: Math.sin(aa) * r });
      }
    }
  }
  kit.merge('stands', stands, standMat);
  kit.merge('standEdge', edges, standEdge);
  const crowd = kit.crowd(seats, { face: [0, 0], scale: 1.15, seed: 21 });

  // ---- MAXISCHERMO (PRIMARY) sopra la curva di fondo ----
  const backR = STAND_R0 + STEPS * STEP_D + 2;
  const jumboSpots = [Math.PI * 0.3, Math.PI * 0.7].map((a) => ({ x: Math.cos(a) * (backR - 1), y: 6.6, z: Math.sin(a) * (backR - 1), ry: Math.PI / 2 - a }));
  const jumbo = new JumboTron(kit, jumboSpots, 11, 5.4);

  // parete del palazzetto dietro gli spalti: pannelli scuri, una fascia LED e lucine (sopra c'e' solo buio di sala)
  const wallTex = kit.texture('arenaWall', 1024, 256, (c, w, h) => {
    c.fillStyle = '#1d1830';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#262040';
    for (let x = 0; x < w; x += 64) c.fillRect(x + 3, 0, 58, h);
    c.fillStyle = '#7a3a8a';
    c.fillRect(0, h * 0.62, w, 6);
    c.fillStyle = '#3fe0ff';
    c.fillRect(0, h * 0.62 + 10, w, 2);
    const r = seeded(8);
    c.fillStyle = '#ffd9a0';
    for (let i = 0; i < 90; i++) c.fillRect(r() * w, r() * h * 0.5, 2, 2);
  }, { wrap: true });
  wallTex.uScale = 4;
  const wall = MeshBuilder.CreateCylinder('arenaBackWall', { diameter: (backR + 2.5) * 2, height: 22, tessellation: 40, arc: (arcTo - arcFrom) / (Math.PI * 2), cap: Mesh.NO_CAP, sideOrientation: Mesh.BACKSIDE }, scene);
  wall.rotation.y = -arcTo;
  wall.position.y = 7;
  wall.material = kit.mat('#ffffff', { tex: wallTex, emissive: 0.6, key: 'arenaWallMat' });
  kit.freeze(wall);

  // ---- TORRI LUCE (PRIMARY) ----
  const towerMat = kit.mat(PAL.metal, { spec: 0.1 });
  const lampMat = kit.neon('#fff4d6');
  const towers: Mesh[] = [];
  const heads: Mesh[] = [];
  for (const a of [Math.PI * 0.12, Math.PI * 0.88, Math.PI * 1.25, Math.PI * 1.75]) {
    const r = backR + 3;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    towers.push(kit.box('tower', 0.9, 26, 0.9, { x, y: 4, z }, towerMat));
    towers.push(kit.box('towerArm', 4.4, 0.4, 0.5, { x, y: 16.5, z, ry: -a + Math.PI / 2 }, towerMat));
    heads.push(kit.box('towerLamps', 4, 1.8, 0.4, { x: x - Math.cos(a) * 0.4, y: 17.8, z: z - Math.sin(a) * 0.4, ry: -a + Math.PI / 2, rx: -0.35 }, lampMat));
  }
  kit.merge('lightTowers', towers, towerMat);
  kit.merge('lightTowerLamps', heads, lampMat);

  // ---- STRISCIONI e GAG (TERTIARY): sui fianchi degli spalti, lontani dal piano di gioco ----
  const bannerY = -3.2 + STEPS * STEP_H + 1.7;
  const bannerR = STAND_R0 + STEPS * STEP_D - 0.6;
  const bannerAt = (a: number): { x: number; z: number; ry: number } => ({ x: Math.cos(a) * bannerR, z: Math.sin(a) * bannerR, ry: Math.PI / 2 - a });
  const b1 = bannerAt(Math.PI * 0.05);
  kit.sign('DISAGIO CUP', { style: 'neon', color: PAL.neonCyan, w: 7, h: 1.6, x: b1.x, y: bannerY, z: b1.z, ry: b1.ry });
  const b2 = bannerAt(Math.PI * 0.95);
  kit.sign('FUORI!', { style: 'neon', color: PAL.neonPink, w: 5.4, h: 1.6, x: b2.x, y: bannerY, z: b2.z, ry: b2.ry });
  // easter egg: striscione dei tifosi (piccolo, sugli spalti di lato)
  const b3 = bannerAt(Math.PI * 0.16);
  kit.sign('20 KG IN UN MESE', { style: 'poster', color: '#7a2f3a', w: 5.6, h: 1.1, x: b3.x, y: bannerY - 2.6, z: b3.z, ry: b3.ry });
  const b4 = bannerAt(Math.PI * 0.84);
  kit.sign('PAGO DOMANI', { style: 'poster', color: '#2f4a7a', w: 4.6, h: 1.1, x: b4.x, y: bannerY - 2.6, z: b4.z, ry: b4.ry });

  // ---- coni di luce (finti) sugli spalti, NON sul piano di gioco ----
  if (kit.q !== 'low') {
    const coneMat = kit.mat('#bcd2ff', { unlit: true, alpha: 0.07, key: 'arenaCone' });
    const cones: Mesh[] = [];
    for (const a of [Math.PI * 0.25, Math.PI * 0.5, Math.PI * 0.75]) {
      const r = STAND_R0 + 6;
      cones.push(kit.cyl('cone', 0.5, 5, 16, { x: Math.cos(a) * r, y: 6, z: Math.sin(a) * r, rx: 0.25 * Math.sin(a) }, coneMat, 12));
    }
    const merged = kit.merge('standCones', cones, coneMat);
    if (merged) kit.excludeFromGlow(merged);
  }

  let danger = false;
  let lastAlive = '';
  return {
    platform,
    edgeRing,
    setShrink(scale: number, isDanger: boolean): void {
      for (const m of [platform, edgeRing, sideLights]) {
        m.scaling.x = scale;
        m.scaling.z = scale;
      }
      if (isDanger && !danger) jumbo.flash('IL BORDO\nSI STRINGE', '#ff5d5d', 3200, 'SUDDEN DEATH');
      danger = isDanger;
    },
    update(now: number): void {
      // bordo: ambra fermo, ROSSO pulsante quando si stringe (leggibile anche con la coda dell'occhio)
      if (danger) {
        const k = 0.65 + Math.sin(now * 0.012) * 0.35;
        edgeMat.emissiveColor.set(1 * k + 0.2, 0.18 * k, 0.2 * k);
      } else edgeMat.emissiveColor.set(1, 0.77, 0.3);
      jumbo.tick(now, danger ? 'SUDDEN\nDEATH' : 'ARENA\nDEL DISAGIO', danger ? '#ff5d5d' : PAL.neonAmber);
    },
    show(kind, text) {
      if (kind === 'start') jumbo.flash('VIA!', PAL.neonLime, 1600, 'ROUND 1');
      else if (kind === 'ko') {
        jumbo.flash('KO!', '#ff5d5d', 1800, text ?? '');
        crowd.cheer(1);
      } else if (kind === 'shrink') jumbo.flash('IL BORDO\nSI STRINGE', '#ff5d5d', 3200, 'SUDDEN DEATH');
      else if (kind === 'last2' && lastAlive !== 'last2') {
        lastAlive = 'last2';
        jumbo.flash('ULTIMI 2', PAL.neonAmber, 2400, text ?? '');
        crowd.cheer(0.7);
      } else if (kind === 'winner') {
        jumbo.flash('CAMPIONE', PAL.neonLime, 6000, text ?? '');
        crowd.cheer(1);
      }
    }
  };
}
