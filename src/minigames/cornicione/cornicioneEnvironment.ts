import { Color3, Mesh, MeshBuilder, Scene } from '@babylonjs/core';
import type { DynamicTexture } from '@babylonjs/core';
import { EnvKit, PAL, SIGN_FONT, mixHex, seeded } from '../env/envKit';
import { STAGE } from './fighterData';

/**
 * TETTO DEL DISAGIO — tetto / cantiere / palazzina al TRAMONTO (Art Bible: toni medi e caldi, il colore forte resta ai giocatori).
 *  - PRIMARY: la palazzina (il palco principale) con il piano del tetto e la facciata che scende nella foschia; i tre ponteggi di legno
 *    (le piattaforme one-way) con un bordo a strisce, cosi' si leggono come "si passa da sotto"
 *  - SECONDARY: skyline con gru e antenne, palazzi vicini con le finestre accese, serbatoio, sole basso e nuvole rosa
 *  - TERTIARY: tre cartelli soltanto (VIETATO CADERE sul parapetto, PIZZERIA ANGORA sul palazzo accanto, 20 KG* sul serbatoio)
 * NESSUN elemento decorativo e' collidibile e nessuno sta sul piano di gioco (z = 0): cassette e parapetto stanno dietro (z > 2).
 * Economico: finestre e mattoni sono TEXTURE (niente geometria), il resto e' fuso e congelato; una sola luce direzionale + hemi.
 */

export interface CornicioneEnvironment {
  update(now: number): void;
  /** profondita' (z) a cui stanno i personaggi: sul piano di gioco, mai dietro a una decorazione */
  readonly playZ: number;
}

const W = STAGE.mainX * 2; // 26
const DEPTH = 6;

function facadeTexture(kit: EnvKit, key: string, cols: number, rows: number, seed: number, wall: string, lit = 0.32): DynamicTexture {
  return kit.texture(key, 512, 1024, (c, w, h) => {
    const rnd = seeded(seed);
    c.fillStyle = wall;
    c.fillRect(0, 0, w, h);
    // mattoni / intonaco: righe sottili
    c.fillStyle = 'rgba(0,0,0,0.07)';
    for (let y = 0; y < h; y += 10) c.fillRect(0, y, w, 2);
    const cw = w / cols;
    const rh = h / rows;
    for (let r = 0; r < rows; r++) {
      for (let k = 0; k < cols; k++) {
        const x = k * cw + cw * 0.2;
        const y = r * rh + rh * 0.22;
        const ww = cw * 0.6;
        const hh = rh * 0.56;
        const on = rnd() < lit;
        // davanzale
        c.fillStyle = 'rgba(0,0,0,0.25)';
        c.fillRect(x - 3, y + hh, ww + 6, 5);
        c.fillStyle = on ? '#ffd27a' : '#2a3350';
        c.fillRect(x, y, ww, hh);
        if (on) {
          c.fillStyle = 'rgba(255,255,255,0.35)';
          c.fillRect(x + 2, y + 2, ww - 4, 4);
        } else {
          c.fillStyle = 'rgba(120,150,220,0.25)';
          c.fillRect(x + 2, y + 2, ww * 0.4, hh * 0.35);
        }
        c.fillStyle = 'rgba(0,0,0,0.35)';
        c.fillRect(x + ww / 2 - 1, y, 2, hh);
      }
    }
  });
}

function roofTexture(kit: EnvKit): DynamicTexture {
  return kit.texture('cornicioneRoof', 1024, 256, (c, w, h) => {
    const rnd = seeded(77);
    c.fillStyle = '#8f8a86';
    c.fillRect(0, 0, w, h);
    // lastre del tetto
    c.strokeStyle = 'rgba(0,0,0,0.18)';
    c.lineWidth = 3;
    for (let x = 0; x <= w; x += w / 13) {
      c.beginPath();
      c.moveTo(x, 0);
      c.lineTo(x, h);
      c.stroke();
    }
    // macchie e usura
    for (let i = 0; i < 90; i++) {
      c.fillStyle = `rgba(${rnd() < 0.5 ? '0,0,0' : '255,255,255'},${0.03 + rnd() * 0.05})`;
      c.fillRect(rnd() * w, rnd() * h, 30 + rnd() * 90, 10 + rnd() * 30);
    }
    // bordi: fascia di pericolo a strisce (lì si cade)
    const strip = w * (1.1 / W);
    for (const x0 of [0, w - strip]) {
      c.fillStyle = PAL.hazard;
      c.fillRect(x0, 0, strip, h);
      c.fillStyle = PAL.hazardDark;
      for (let y = -strip; y < h + strip; y += 34) {
        c.beginPath();
        c.moveTo(x0, y);
        c.lineTo(x0 + strip, y + strip);
        c.lineTo(x0 + strip, y + strip + 16);
        c.lineTo(x0, y + 16);
        c.closePath();
        c.fill();
      }
    }
    // scritta sbiadita sul piano (easter egg: non distrae, e' vernice sul tetto)
    c.save();
    c.globalAlpha = 0.32;
    c.fillStyle = '#f5c518';
    c.font = `900 56px ${SIGN_FONT}`;
    c.textAlign = 'center';
    c.fillText('VIETATO CADERE', w / 2, h * 0.58);
    c.restore();
    // linea bianca di bordo piano
    c.fillStyle = 'rgba(244,241,232,0.7)';
    c.fillRect(strip + 4, 0, 4, h);
    c.fillRect(w - strip - 8, 0, 4, h);
  });
}

function sunTexture(kit: EnvKit): DynamicTexture {
  return kit.texture('cornicioneSun', 256, 256, (c, w, h) => {
    const g = c.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,248,214,1)');
    g.addColorStop(0.35, 'rgba(255,196,110,0.95)');
    g.addColorStop(0.7, 'rgba(255,120,90,0.28)');
    g.addColorStop(1, 'rgba(255,120,90,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  }, { alpha: true });
}

export function buildCornicioneEnvironment(scene: Scene, playZ: number): CornicioneEnvironment {
  const kit = new EnvKit(scene);
  scene.fogMode = Scene.FOGMODE_LINEAR;
  scene.fogColor = Color3.FromHexString('#c97a82');
  scene.fogStart = 55;
  scene.fogEnd = 230;

  // ---- cielo del tramonto, sole basso, nuvole rosa, skyline lontano
  kit.sky([[0, '#2e2457'], [0.35, '#7a3f78'], [0.62, '#d9607a'], [0.82, '#ff9a62'], [1, '#ffd08a']]);
  const sunMat = kit.mat('#ffffff', { unlit: true, tex: sunTexture(kit), alpha: 0.99, key: 'cornicioneSunMat', cutout: false, twoSided: true });
  sunMat.alpha = 1;
  const sun = MeshBuilder.CreatePlane('sunDisc', { width: 150, height: 150 }, scene);
  sun.material = sunMat;
  sun.position.set(-70, 26, 420);
  sun.rotation.y = Math.PI; // la faccia guarda verso -z (camera)
  kit.excludeFromGlow(sun);
  kit.freeze(sun);
  kit.clouds({ count: 10, radius: 360, yMin: 40, yMax: 110, tint: '#ffb4b8', size: 70, seed: 21, arc: [Math.PI / 2 - 1.1, Math.PI / 2 + 1.1] });
  kit.skyline({ radius: 330, height: 46, y: -10, color: '#6a3f6e', kind: 'industrial', seed: 9, arc: [Math.PI * 0.06, Math.PI * 0.94] });
  kit.skyline({ radius: 240, height: 40, y: -12, color: '#4a2f5c', kind: 'city', seed: 31, arc: [Math.PI * 0.08, Math.PI * 0.92] });

  kit.lightRig({
    key: [0.35, -0.7, 0.62], // luce calda che arriva da davanti-sinistra-alto: i personaggi si leggono di profilo
    keyColor: '#ffdcae',
    keyI: 0.95,
    sky: '#ffc4b4',
    ground: '#55406e',
    fillI: 0.66,
    rim: { dir: [-0.3, -0.3, -1], color: '#ff9a7a', i: 0.35 }
  });
  kit.glow(0.45);

  // ---- LA PALAZZINA (palco principale): corpo, piano del tetto, facciata che scende nella foschia
  const bodyMat = kit.mat(mixHex(PAL.concreteDark, '#6a4a5a', 0.4), { emissive: 0.25 });
  kit.box('roofBody', W, 60, DEPTH, { x: 0, y: -30, z: 0 }, bodyMat);
  const roof = MeshBuilder.CreatePlane('roofTop', { width: W, height: DEPTH }, scene);
  roof.rotation.x = Math.PI / 2;
  roof.position.set(0, 0.012, 0);
  roof.material = kit.mat('#ffffff', { tex: roofTexture(kit), emissive: 0.35, key: 'cornicioneRoofMat', spec: 0.02 });
  kit.freeze(roof);
  const facade = MeshBuilder.CreatePlane('facade', { width: W, height: 56 }, scene);
  facade.position.set(0, -28, -DEPTH / 2 - 0.02);
  facade.rotation.y = Math.PI;
  const facTex = facadeTexture(kit, 'cornicioneFacade', 8, 16, 5, '#b3745c', 0.3);
  facTex.vScale = 1;
  facade.material = kit.mat('#ffffff', { tex: facTex, emissive: 0.4, key: 'cornicioneFacadeMat', twoSided: true });
  kit.freeze(facade);
  // cornicione: il bordo del tetto (e' LUI il "cornicione"): una cornice leggermente sporgente davanti
  kit.box('cornice', W + 0.5, 0.7, 0.6, { x: 0, y: -0.36, z: -DEPTH / 2 - 0.1 }, kit.mat('#d8cdc0', { emissive: 0.3 }));
  // parapetto SOLO sul fondo (z > 2): non copre i piedi dei personaggi e non e' sul piano di gioco
  kit.box('parapet', W - 2.4, 0.9, 0.4, { x: 0, y: 0.45, z: DEPTH / 2 - 0.4 }, kit.mat('#a99e94', { emissive: 0.25 }));

  // cassette e bidoni sul fondo del tetto (decorazione bassa, dietro)
  const crateMat = kit.mat(PAL.wood, { emissive: 0.25 });
  const crates: Mesh[] = [];
  const cr = (x: number, z: number, s: number, ry = 0): void => {
    crates.push(kit.box('crate', s, s * 0.8, s, { x, y: (s * 0.8) / 2, z, ry }, crateMat));
  };
  cr(-11, 2.1, 0.9, 0.3);
  cr(-10, 2.3, 0.7, -0.2);
  cr(10.5, 2.2, 0.9, 0.5);
  kit.merge('crates', crates, crateMat);
  const bottleMat = kit.mat('#5ea66b', { emissive: 0.35, spec: 0.3 });
  const bottles: Mesh[] = [];
  for (const [x, z] of [[-9.1, 2.2], [-8.8, 2.4], [9.2, 2.3]] as [number, number][]) bottles.push(kit.cyl('bottle', 0.14, 0.18, 0.55, { x, y: 0.28, z }, bottleMat, 8));
  kit.merge('bottles', bottles, bottleMat);

  // ---- I PONTEGGI (piattaforme one-way): tavolato + telaio; la striscia arancio sul bordo dice "si passa da sotto"
  const plankMat = kit.mat(PAL.wood, { emissive: 0.3 });
  const frameMat = kit.mat(PAL.metalPaint, { emissive: 0.25, spec: 0.15 });
  const stripeMat = kit.mat('#ff8a3d', { emissive: 0.5 });
  const planks: Mesh[] = [];
  const frames: Mesh[] = [];
  const stripes: Mesh[] = [];
  for (const p of STAGE.platforms) {
    const w = p.x1 - p.x0;
    const cx = (p.x0 + p.x1) / 2;
    planks.push(kit.box('plank', w, 0.22, 2.6, { x: cx, y: p.y - 0.11, z: 0 }, plankMat));
    stripes.push(kit.box('plankEdge', w, 0.05, 0.16, { x: cx, y: p.y + 0.02, z: -1.25 }, stripeMat));
    stripes.push(kit.box('plankEdgeB', w, 0.05, 0.16, { x: cx, y: p.y + 0.02, z: 1.25 }, stripeMat));
    // telaio: montanti e traverse (sottili, dietro al piano di gioco)
    frames.push(kit.box('post', 0.18, 6, 0.18, { x: p.x0 + 0.3, y: p.y - 3.1, z: 1.1 }, frameMat));
    frames.push(kit.box('post', 0.18, 6, 0.18, { x: p.x1 - 0.3, y: p.y - 3.1, z: 1.1 }, frameMat));
    frames.push(kit.box('brace', w - 0.6, 0.12, 0.12, { x: cx, y: p.y - 0.4, z: 1.1 }, frameMat));
    frames.push(kit.box('brace2', w - 0.6, 0.12, 0.12, { x: cx, y: p.y - 2.4, z: 1.1 }, frameMat));
  }
  kit.merge('scaffoldPlanks', planks, plankMat);
  kit.merge('scaffoldFrames', frames, frameMat);
  kit.merge('scaffoldStripes', stripes, stripeMat);

  // ---- PALAZZI VICINI (dietro, a distanze diverse): finestre in texture, qualcuna accesa
  const near = [
    { x: -34, z: 22, w: 16, h: 70, seed: 11, wall: '#8a5c70', cols: 5, rows: 12 },
    { x: 38, z: 20, w: 18, h: 60, seed: 12, wall: '#6f5a7e', cols: 6, rows: 11 },
    { x: -62, z: 46, w: 20, h: 90, seed: 13, wall: '#7a5368', cols: 6, rows: 14 },
    { x: 64, z: 50, w: 22, h: 80, seed: 14, wall: '#5f4d72', cols: 7, rows: 13 },
    { x: 8, z: 70, w: 26, h: 70, seed: 15, wall: '#6a4a68', cols: 8, rows: 12 }
  ];
  for (const b of near) {
    const tex = facadeTexture(kit, `cornicioneNear${b.seed}`, b.cols, b.rows, b.seed, b.wall, 0.4);
    const m = kit.mat('#ffffff', { tex, emissive: 0.5, key: `cornicioneNearMat${b.seed}`, twoSided: true });
    const face = MeshBuilder.CreatePlane(`near${b.seed}`, { width: b.w, height: b.h }, scene);
    face.position.set(b.x, b.h / 2 - 30, b.z);
    face.rotation.y = Math.PI;
    face.material = m;
    kit.freeze(face);
    // tetto piatto (si intravede dal basso... non serve): solo una antenna ogni tanto
  }

  // ---- GRU (silhouette lontana con luce rossa che lampeggia)
  const craneMat = kit.mat('#3a2f4a', { emissive: 0.5 });
  const craneParts: Mesh[] = [];
  const crane = (x: number, z: number, h: number, flip = 1): void => {
    craneParts.push(kit.box('craneMast', 1.2, h, 1.2, { x, y: h / 2 - 20, z }, craneMat));
    craneParts.push(kit.box('craneJib', 34, 0.9, 0.9, { x: x + 12 * flip, y: h - 21, z }, craneMat));
    craneParts.push(kit.box('craneCounter', 10, 0.9, 0.9, { x: x - 8 * flip, y: h - 21, z }, craneMat));
    craneParts.push(kit.box('craneCab', 2.4, 2, 2, { x: x, y: h - 22.5, z }, craneMat));
    craneParts.push(kit.box('craneCable', 0.12, 12, 0.12, { x: x + 24 * flip, y: h - 27, z }, craneMat));
  };
  crane(-48, 62, 78, 1);
  crane(52, 80, 70, -1);
  kit.merge('cranes', craneParts, craneMat);
  const blinkMat = kit.neon('#ff4a4a', true);
  const blink = [kit.box('craneLight', 1.4, 1.4, 1.4, { x: -26, y: 57, z: 61 }, blinkMat), kit.box('craneLight2', 1.4, 1.4, 1.4, { x: 30, y: 49, z: 79 }, blinkMat)];
  for (const b of blink) kit.freeze(b);

  // ---- SERBATOIO + ANTENNE sul palazzo accanto (a destra)
  const tankMat = kit.mat('#8a7a72', { emissive: 0.35 });
  const tankParts: Mesh[] = [];
  tankParts.push(kit.cyl('tank', 5, 5, 6, { x: 36, y: 41, z: 19 }, tankMat, 14));
  tankParts.push(kit.cyl('tankCap', 0.4, 5, 1.4, { x: 36, y: 45.4, z: 19 }, tankMat, 14));
  for (const lx of [-1.8, 1.8]) tankParts.push(kit.box('tankLeg', 0.3, 5, 0.3, { x: 36 + lx, y: 36.5, z: 19 }, tankMat));
  kit.merge('waterTank', tankParts, tankMat);
  const antMat = kit.mat('#4a4054', { emissive: 0.4 });
  const ants: Mesh[] = [];
  for (const [x, z, h] of [[-30, 21, 9], [-37, 21, 6], [32, 19, 7]] as [number, number, number][]) {
    ants.push(kit.box('antenna', 0.12, h, 0.12, { x, y: 40 + h / 2 - 5, z }, antMat));
    ants.push(kit.box('antennaBar', 2.2, 0.1, 0.1, { x, y: 40 + h * 0.8 - 5, z }, antMat));
  }
  kit.merge('antennas', ants, antMat);
  // ---- TRE CARTELLI (e basta)
  kit.sign('VIETATO CADERE', { style: 'hazard', w: 3.6, h: 0.9, x: -9.6, y: 1.3, z: DEPTH / 2 - 0.55, twoSided: false });
  kit.sign('PIZZERIA ANGORA', { style: 'neon', color: PAL.neonPink, w: 8, h: 1.6, x: -34, y: 34, z: 21.8, ry: Math.PI });
  kit.sign('20 KG*', { style: 'poster', color: '#7a2f3a', w: 3.2, h: 1.0, x: 36, y: 41, z: 16.4, ry: Math.PI });

  // ---- luce rossa che lampeggia (unico elemento animato oltre alle nuvole)
  kit.onFrame((t) => {
    const on = Math.sin(t * 2.6) > 0.2;
    blinkMat.emissiveColor.set(on ? 1 : 0.25, on ? 0.29 : 0.06, on ? 0.29 : 0.06);
  });

  return {
    playZ,
    update(now: number): void {
      void now;
    }
  };
}

