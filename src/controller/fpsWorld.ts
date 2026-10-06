import { Color3, DynamicTexture, Mesh, MeshBuilder, Scene, StandardMaterial, Texture } from '@babylonjs/core';
import { FPS_MAP } from '../../shared/fpsMap';
import type { Aabb } from '../../shared/fpsMap';
import { EnvKit, PAL, SIGN_FONT, seeded } from '../minigames/env/envKit';
import type { SignOpts } from '../minigames/env/envKit';

/**
 * MONDO DELLA SPARATORIA — CANTIERE DEL DISAGIO (solo aspetto: la geometria e' quella di FPS_MAP, condivisa con
 * l'host; nessun muro, copertura o spawn cambia). La stessa mappa e' divisa VISIVAMENTE in cinque zone, ognuna con
 * pavimento, materiale delle coperture e landmark propri, cosi' in split-screen si capisce "dove sono":
 *   NO  CONTAINER YARD  container verniciati (petrolio/ruggine) + pila di container oltre il muro
 *   NE  OFFICINA        blocchi di cemento e serrande + capannone con ciminiera
 *   SE  MAGAZZINO       pallet e casse di legno + facciata del magazzino "CARICO / SCARICO"
 *   SO  IMPALCATURA     teli verdi da cantiere + torre di ponteggio e betoniera
 *   CENTRO  RAMPA/GRU   container a croce + GRU A TORRE (visibile da tutta la mappa)
 * I 4 muri perimetrali tengono colore e nome (NORD/SUD/EST/OVEST) e gli spawn i loro fari: orientamento invariato.
 * Colori: niente arancio/rosso/ciano/viola/verde saturi su grandi superfici (sono i colori dei giocatori).
 * Prestazioni: tutto fuso per materiale; con 4-5 finestre ogni draw call si paga 4-5 volte. Telefono e TV usano
 * lo stesso codice (il modulo non importa nulla dell'host).
 */

const ZONE_COLORS = ['#22c55e', '#06b6d4', '#f59e0b', '#ef4444', '#a855f7'];
const SIDES = [
  // indice dell'ostacolo perimetrale in FPS_MAP.obstacles: 0 = z-, 1 = z+, 2 = x-, 3 = x+
  { name: 'SUD', color: '#22d3ee', nx: 0, nz: 1 },
  { name: 'NORD', color: '#ec4899', nx: 0, nz: -1 },
  { name: 'OVEST', color: '#84cc16', nx: 1, nz: 0 },
  { name: 'EST', color: '#f59e0b', nx: -1, nz: 0 }
];

type Zone = 'yard' | 'shop' | 'store' | 'scaff' | 'center';
/** Zona di un punto (x = est/ovest, z = nord/sud). */
export function fpsZoneAt(x: number, z: number): Zone {
  if (Math.abs(x) <= 9 && Math.abs(z) <= 9) return 'center';
  if (x < 0 && z >= 0) return 'yard';
  if (x >= 0 && z >= 0) return 'shop';
  if (x >= 0) return 'store';
  return 'scaff';
}
export const FPS_ZONE_NAMES: Record<Zone, string> = { yard: 'CONTAINER YARD', shop: 'OFFICINA', store: 'MAGAZZINO', scaff: 'IMPALCATURA', center: 'GRU' };

/** Luci della Sparatoria (uguali su TV e telefono): uniformi, niente angoli bui. */
export function buildFpsLights(scene: Scene): void {
  new EnvKit(scene).lightRig({
    key: [-0.4, -1, -0.3],
    keyColor: '#fff3df',
    keyI: 0.7,
    sky: '#fffaf0',
    ground: '#6a6560',
    fillI: 0.85
  });
}

function tiled(kit: EnvKit, key: string, size: number, draw: (c: CanvasRenderingContext2D, s: number) => void, repeat: number): Texture {
  const t = kit.texture(key, size, size, (c, s) => draw(c, s), { wrap: true });
  t.uScale = repeat;
  t.vScale = repeat;
  return t;
}

function freeze(m: Mesh): Mesh {
  m.isPickable = false;
  m.freezeWorldMatrix();
  m.doNotSyncBoundingInfo = true;
  return m;
}

export function buildFpsWorld(scene: Scene): void {
  const kit = new EnvKit(scene);
  const half = FPS_MAP.halfSize;
  const r = seeded(13);

  // ---- cielo e nebbia (profondita', nasconde il limite del mondo)
  scene.clearColor.set(0.6, 0.78, 0.94, 1);
  scene.fogMode = Scene.FOGMODE_LINEAR;
  scene.fogColor.set(0.68, 0.81, 0.93);
  scene.fogStart = 38;
  scene.fogEnd = 110;
  kit.clouds({ count: 9, radius: 200, yMin: 50, yMax: 80, size: 30, seed: 8 });
  kit.skyline({ radius: 150, height: 26, y: -2, color: '#9fb2c4', kind: 'industrial', seed: 3 });

  // ---- PAVIMENTO: base + quattro zone con tono proprio (un piano ciascuna)
  const base = tiled(kit, 'fpsFloorBase', 256, (c, s) => {
    c.fillStyle = '#8f949c';
    c.fillRect(0, 0, s, s);
    c.strokeStyle = '#7a8088';
    c.lineWidth = 3;
    for (let i = 0; i <= 4; i++) {
      c.beginPath();
      c.moveTo((i * s) / 4, 0);
      c.lineTo((i * s) / 4, s);
      c.moveTo(0, (i * s) / 4);
      c.lineTo(s, (i * s) / 4);
      c.stroke();
    }
    for (let i = 0; i < 200; i++) {
      c.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
      c.fillRect(r() * s, r() * s, 2 + r() * 4, 2 + r() * 3);
    }
  }, Math.ceil((half * 2 + 6) / 8));
  const ground = MeshBuilder.CreateGround('ground', { width: half * 2 + 6, height: half * 2 + 6 }, scene);
  ground.material = kit.mat('#ffffff', { tex: base, spec: 0.05, key: 'fpsGroundMat' });
  freeze(ground);
  // le 4 zone in UNA mesh (colore per vertice): una draw call invece di quattro, moltiplicata per ogni finestra
  const zoneParts: Mesh[] = [];
  const zoneFloor = (name: string, tint: string, x0: number, z0: number, x1: number, z1: number): void => {
    const g = MeshBuilder.CreateGround(name, { width: x1 - x0, height: z1 - z0 }, scene);
    g.position.set((x0 + x1) / 2, 0.006, (z0 + z1) / 2);
    const c = Color3.FromHexString(tint);
    const n = g.getTotalVertices();
    const cols: number[] = [];
    for (let i = 0; i < n; i++) cols.push(c.r, c.g, c.b, 1);
    g.setVerticesData('color', cols);
    zoneParts.push(g);
  };
  const H = half - 1;
  zoneFloor('floorYard', '#9aa6b8', -H, 9, -9, H); // asfalto freddo
  zoneFloor('floorShop', '#c2b39c', 9, 9, H, H); // cemento caldo, macchie d'olio nella texture base
  zoneFloor('floorStore', '#b8bcc8', 9, -H, H, -9); // resina chiara del magazzino
  zoneFloor('floorScaff', '#b89f82', -H, -H, -9, -9); // terra battuta
  kit.merge('fpsZoneFloors', zoneParts, kit.mat('#ffffff', { tex: base, spec: 0.03, key: 'fpsZoneFloorMat' }));
  // corsie del magazzino (gialle, solo li') + linee sottili di prima altrove
  const lines: Mesh[] = [];
  for (let i = -20; i <= 20; i += 5) {
    const line = MeshBuilder.CreateBox('line', { width: 0.14, height: 0.02, depth: half * 2 }, scene);
    line.position.set(i, 0.012, 0);
    lines.push(line);
  }
  kit.merge('fpsLines', lines, kit.mat('#c9b23a', { unlit: true, key: 'fpsLineMat' }));

  // ---- OSTACOLI: stessa scatola, aspetto per zona
  const cont = (base: string, rib: string): ((c: CanvasRenderingContext2D, s: number) => void) => (c, s) => {
    c.fillStyle = base;
    c.fillRect(0, 0, s, s);
    c.fillStyle = rib;
    for (let x = 6; x < s; x += 16) c.fillRect(x, 8, 6, s - 16);
    c.fillStyle = 'rgba(0,0,0,0.25)';
    c.fillRect(0, 0, s, 8);
    c.fillRect(0, s - 8, s, 8);
    c.fillStyle = 'rgba(255,255,255,0.75)';
    c.fillRect(s * 0.6, s * 0.38, s * 0.28, s * 0.13);
  };
  const draws = {
    yardA: cont('#4f7d84', '#41696f'),
    yardB: cont('#8e5a44', '#784a37'),
    center: cont('#5d6880', '#4d566b'),
    shop: (c: CanvasRenderingContext2D, s: number): void => {
      c.fillStyle = '#b7b1a6';
      c.fillRect(0, 0, s, s);
      c.fillStyle = '#9d978b';
      for (let y = 0; y < s; y += 32) c.fillRect(0, y, s, 2);
      for (let x = 0; x < s; x += 64) c.fillRect(x, 0, 2, s);
      // serranda
      c.fillStyle = '#7d8590';
      c.fillRect(s * 0.18, s * 0.3, s * 0.64, s * 0.7);
      c.fillStyle = '#6b727c';
      for (let y = s * 0.3; y < s; y += 8) c.fillRect(s * 0.18, y, s * 0.64, 3);
    },
    store: (c: CanvasRenderingContext2D, s: number): void => {
      c.fillStyle = '#b98f58';
      c.fillRect(0, 0, s, s);
      c.strokeStyle = '#80602f';
      c.lineWidth = 7;
      c.strokeRect(4, 4, s - 8, s - 8);
      c.beginPath();
      c.moveTo(6, 6);
      c.lineTo(s - 6, s - 6);
      c.moveTo(s - 6, 6);
      c.lineTo(6, s - 6);
      c.stroke();
      c.lineWidth = 3;
      for (let y = 32; y < s; y += 32) {
        c.beginPath();
        c.moveTo(4, y);
        c.lineTo(s - 4, y);
        c.stroke();
      }
    },
    scaff: (c: CanvasRenderingContext2D, s: number): void => {
      c.fillStyle = '#5f7d5a';
      c.fillRect(0, 0, s, s);
      c.strokeStyle = 'rgba(30,40,30,0.35)';
      c.lineWidth = 2;
      for (let i = 0; i < s; i += 8) {
        c.beginPath();
        c.moveTo(i, 0);
        c.lineTo(i, s);
        c.stroke();
      }
      // tubi del ponteggio
      c.fillStyle = '#c9ccd2';
      c.fillRect(0, s * 0.3, s, 6);
      c.fillRect(0, s * 0.75, s, 6);
      c.fillRect(s * 0.15, 0, 6, s);
      c.fillRect(s * 0.8, 0, 6, s);
    },
    barrier: (c: CanvasRenderingContext2D, s: number): void => {
      c.fillStyle = '#a9a7a2';
      c.fillRect(0, 0, s, s);
      c.fillStyle = PAL.hazardDark;
      c.fillRect(0, 0, s, 22);
      c.fillStyle = PAL.hazard;
      for (let x = -24; x < s + 24; x += 32) {
        c.beginPath();
        c.moveTo(x, 22);
        c.lineTo(x + 16, 22);
        c.lineTo(x + 38, 0);
        c.lineTo(x + 22, 0);
        c.closePath();
        c.fill();
      }
    },
    wall: (c: CanvasRenderingContext2D, s: number): void => {
      c.fillStyle = '#8f96a3';
      c.fillRect(0, 0, s, s);
      c.strokeStyle = '#737a88';
      c.lineWidth = 3;
      c.strokeRect(2, 2, s - 4, s - 4);
      c.beginPath();
      c.moveTo(s / 2, 0);
      c.lineTo(s / 2, s - 26);
      c.stroke();
      c.fillStyle = '#1f2430';
      c.fillRect(0, s - 24, s, 24);
      c.fillStyle = '#facc15';
      for (let x = -24; x < s + 24; x += 32) {
        c.beginPath();
        c.moveTo(x, s);
        c.lineTo(x + 16, s);
        c.lineTo(x + 40, s - 24);
        c.lineTo(x + 24, s - 24);
        c.closePath();
        c.fill();
      }
    }
  };
  // ATLANTE delle coperture (4 x 2 celle): tutte le coperture in UNA mesh / una draw call (x ogni finestra in split-screen)
  const KINDS = ['wall', 'barrier', 'center', 'yardA', 'yardB', 'shop', 'store', 'scaff'] as const;
  const obsAtlas = kit.texture('fpsObsAtlas', 512, 256, (c) => {
    KINDS.forEach((k, i) => {
      c.save();
      c.translate((i % 4) * 128, Math.floor(i / 4) * 128);
      c.beginPath();
      c.rect(0, 0, 128, 128);
      c.clip();
      draws[k](c, 128);
      c.restore();
    });
  });
  // texture singole per i landmark che le riusano (pile di container, telo del ponteggio)
  const tex = {
    yardA: kit.texture('fpsContTeal', 128, 128, draws.yardA),
    scaff: kit.texture('fpsNetting', 128, 128, draws.scaff)
  };
  const obstacles: Mesh[] = [];
  const edges: Mesh[] = [];
  let yardIdx = 0;
  FPS_MAP.obstacles.forEach((b: Aabb, i) => {
    const box = MeshBuilder.CreateBox('obstacle', { width: b.w, height: b.h, depth: b.d }, scene);
    box.position.set(b.x, b.h / 2, b.z);
    let kind: (typeof KINDS)[number];
    if (i < 4 || b.h >= 4) kind = 'wall';
    else if (b.h === 2.5) kind = 'barrier';
    else {
      const z = fpsZoneAt(b.x, b.z);
      kind = z === 'center' ? 'center' : z === 'yard' ? (yardIdx++ % 2 === 0 ? 'yardA' : 'yardB') : z;
    }
    const cell = KINDS.indexOf(kind);
    kit.atlasUV(box, cell % 4, Math.floor(cell / 4), 4, 2);
    obstacles.push(box);
    // bordo chiaro in cima: silhouette leggibile contro il cielo
    const edge = MeshBuilder.CreateBox('edge', { width: b.w + 0.06, height: 0.07, depth: b.d + 0.06 }, scene);
    edge.position.set(b.x, b.h + 0.02, b.z);
    edges.push(edge);
  });
  kit.merge('fpsObstacles', obstacles, kit.mat('#ffffff', { tex: obsAtlas, spec: 0.05, key: 'fpsObstacleMat' }));
  kit.merge('fpsEdges', edges, kit.mat('#e2e8f0', { unlit: true, key: 'fpsEdgeMat' }));

  // tutti i cartelli finiscono in UN atlante / una mesh (kit.signBoard, in fondo)
  const signs: (SignOpts & { text: string })[] = [];
  // ---- muri perimetrali: banda colorata + insegna col nome del lato (orientamento invariato)
  FPS_MAP.obstacles.slice(0, 4).forEach((b, i) => {
    const side = SIDES[i];
    const fx = b.x + side.nx * (b.w <= 2 ? b.w / 2 : 0);
    const fz = b.z + side.nz * (b.d <= 2 ? b.d / 2 : 0);
    const alongX = b.w > b.d;
    const len = alongX ? b.w : b.d;
    const band = MeshBuilder.CreateBox('band', { width: alongX ? len : 0.12, height: 0.45, depth: alongX ? 0.12 : len }, scene);
    band.position.set(fx + side.nx * 0.07, 3.1, fz + side.nz * 0.07);
    band.material = kit.neon(side.color);
    freeze(band);
    signs.push({ text: side.name, style: 'neon', color: side.color, w: 6, h: 2.6, x: fx + side.nx * 0.09, y: 2.0, z: fz + side.nz * 0.09, ry: Math.atan2(-side.nx, -side.nz) });
  });

  // ---- nomi delle ZONE sui muri, vicino agli angoli (board: si legge, non brilla)
  const zoneSign = (text: string, x: number, z: number, ry: number): void => {
    signs.push({ text, style: 'board', color: '#1f2430', bg: '#efe6cf', w: 4.4, h: 0.9, x, y: 3.55, z, ry });
  };
  const inner = half - 1.06;
  zoneSign('CONTAINER YARD', -14, inner, 0 + Math.PI); // muro nord, guarda a sud
  zoneSign('OFFICINA', 14, inner, Math.PI);
  zoneSign('MAGAZZINO', 14, -inner, 0);
  zoneSign('IMPALCATURA', -14, -inner, 0);

  // ---- fari colorati agli spawn (come prima: piastra a terra + pilastro + globo)
  FPS_MAP.spawns.forEach((sp, i) => {
    const hex = ZONE_COLORS[i % ZONE_COLORS.length];
    const mat = kit.neon(hex);
    const pad = MeshBuilder.CreateDisc('pad', { radius: 2.4, tessellation: 24 }, scene);
    pad.rotation.x = Math.PI / 2;
    pad.position.set(sp.x, 0.02, sp.z);
    pad.material = kit.mat(hex, { unlit: true, alpha: 0.35, key: `fpsPad_${hex}` });
    freeze(pad);
    const bx = sp.x + Math.sign(sp.x || 0) * 3.4;
    const bz = sp.z + Math.sign(sp.z || -1) * 3.4;
    const pole = MeshBuilder.CreateCylinder('beacon', { diameter: 0.45, height: 9, tessellation: 8 }, scene);
    pole.position.set(bx, 4.5, bz);
    const orb = MeshBuilder.CreateSphere('orb', { diameter: 1.1, segments: 8 }, scene);
    orb.position.set(bx, 9.4, bz);
    kit.merge(`beacon${i}`, [pole, orb], mat);
  });

  // ================================================================ LANDMARK (fuori dai muri o sopra le coperture: mai in mezzo)
  const metal = kit.mat('#5a6272', { spec: 0.1 });
  const craneYellow = kit.mat('#d6ad3a', { emissive: 0.12 });

  // CENTRO: gru a torre che sale dal container centrale (non tocca nulla sotto i 3 m: e' sopra la copertura)
  const crane: Mesh[] = [];
  crane.push(kit.box('craneMast', 1.2, 17, 1.2, { x: 0, y: 3 + 8.5, z: 0 }, craneYellow));
  crane.push(kit.box('craneJib', 26, 0.9, 1, { x: 6, y: 20.4, z: 0 }, craneYellow));
  crane.push(kit.box('craneTop', 0.8, 3, 0.8, { x: 0, y: 22.2, z: 0 }, craneYellow));
  crane.push(kit.box('craneCab', 1.8, 1.6, 1.8, { x: -1.4, y: 19.3, z: 0 }, craneYellow));
  // (i pezzi gialli del portale del container yard si aggiungono sotto: una sola mesh gialla per tutta la mappa)
  const metalParts: Mesh[] = [];
  metalParts.push(kit.box('craneWeight', 3, 1.6, 1.6, { x: -6, y: 19.6, z: 0 }, metal));
  metalParts.push(kit.box('craneCable', 0.08, 10, 0.08, { x: 16, y: 15.5, z: 0 }, metal));
  metalParts.push(kit.box('craneHook', 2.4, 0.9, 1.2, { x: 16, y: 10.2, z: 0 }, metal));
  // luce rossa in cima (punto di riferimento anche controluce)
  const tip = MeshBuilder.CreateSphere('craneTip', { diameter: 0.9, segments: 8 }, scene);
  tip.position.set(0, 24, 0);
  tip.material = kit.neon('#fde047');
  freeze(tip);

  // NO — CONTAINER YARD: pile di container oltre il muro nord-ovest
  const contMesh = MeshBuilder.CreateBox('yardStacks', { width: 6, height: 2.6, depth: 2.5 }, scene);
  contMesh.material = kit.mat('#ffffff', { tex: tex.yardA, spec: 0.04, key: 'fpsYardStackMat' });
  const stacks: { x: number; y: number; z: number; ry?: number }[] = [];
  for (let k = 0; k < 4; k++) stacks.push({ x: -20, y: 1.3 + k * 2.6, z: half + 4 });
  for (let k = 0; k < 3; k++) stacks.push({ x: -13, y: 1.3 + k * 2.6, z: half + 4.5 });
  for (let k = 0; k < 2; k++) stacks.push({ x: -half - 4, y: 1.3 + k * 2.6, z: 16, ry: Math.PI / 2 });
  kit.thin(contMesh, stacks, ['#ffffff', '#c9b0a0', '#a8c0c8', '#d8d0c0']);
  kit.freeze(contMesh);
  crane.push(kit.box('yardGantryL', 0.9, 14, 0.9, { x: -24, y: 7, z: half + 8 }, craneYellow));
  crane.push(kit.box('yardGantryR', 0.9, 14, 0.9, { x: -8, y: 7, z: half + 8 }, craneYellow));
  crane.push(kit.box('yardGantryBeam', 18, 1.2, 1.2, { x: -16, y: 14, z: half + 8 }, craneYellow));
  kit.merge('fpsCranes', crane, craneYellow);

  // NE — OFFICINA: capannone con tetto a shed e ciminiera
  const shed = kit.mat('#b7aa94', { spec: 0.03 });
  kit.merge('workshop', [kit.box('workshopBody', 22, 9, 10, { x: 14, y: 4.5, z: half + 7 }, shed), kit.cyl('workshopChimney', 1.2, 1.6, 18, { x: 22, y: 9, z: half + 10 }, shed, 10)], shed);
  for (let k = 0; k < 4; k++) metalParts.push(kit.box('workshopShed', 5.5, 0.4, 5, { x: 5.5 + k * 5.6, y: 10.2, z: half + 7, rx: -0.5 }, metal));
  signs.push({ text: 'OFFICINA', style: 'board', color: '#ffffff', bg: '#3a4a5a', w: 8, h: 1.6, x: 14, y: 7.4, z: half + 1.95, ry: Math.PI });

  // SE — MAGAZZINO: facciata con le baie di carico
  const ware = kit.mat('#a9b4c2', { spec: 0.03 });
  kit.freeze(kit.box('warehouseBody', 24, 10, 12, { x: 14, y: 5, z: -half - 8 }, ware));
  signs.push({ text: 'CARICO / SCARICO', style: 'hazard', w: 8, h: 1.5, x: 14, y: 7.6, z: -half - 1.95 });
  metalParts.push(kit.box('warehouseRoof', 25, 0.6, 13, { x: 14, y: 10.3, z: -half - 8 }, metal));

  // SO — IMPALCATURA: torre di ponteggio + betoniera e silo
  const pipe = kit.mat('#c9ccd2', { spec: 0.2 });
  const scaffold: Mesh[] = [];
  const sx0 = -half - 5;
  const sz0 = -16;
  for (const dx of [0, 4]) for (const dz of [0, 4]) scaffold.push(kit.box('scaffPole', 0.2, 16, 0.2, { x: sx0 + dx, y: 8, z: sz0 + dz }, pipe));
  for (let y = 2; y <= 16; y += 3.5) {
    scaffold.push(kit.box('scaffBar', 4.2, 0.18, 0.18, { x: sx0 + 2, y, z: sz0 }, pipe));
    scaffold.push(kit.box('scaffBar', 4.2, 0.18, 0.18, { x: sx0 + 2, y, z: sz0 + 4 }, pipe));
    scaffold.push(kit.box('scaffBarZ', 0.18, 0.18, 4.2, { x: sx0, y, z: sz0 + 2 }, pipe));
    scaffold.push(kit.box('scaffBarZ', 0.18, 0.18, 4.2, { x: sx0 + 4, y, z: sz0 + 2 }, pipe));
  }
  kit.merge('scaffoldTower', scaffold, pipe);
  kit.freeze(kit.box('scaffNet', 4.1, 9, 0.1, { x: sx0 + 2, y: 11, z: sz0 + 4.05 }, kit.mat('#ffffff', { tex: tex.scaff, key: 'fpsScaffNetMat' })));
  const pale = kit.mat('#d8d6d0', { emissive: 0.1 });
  // silo + camion della betoniera: stesso bianco sporco, una mesh
  kit.merge('siloAndTruck', [
    kit.cyl('cementSilo', 4, 4, 12, { x: -16, y: 9, z: -half - 6 }, pale, 12),
    kit.cyl('siloCone', 0.6, 4, 3, { x: -16, y: 1.5, z: -half - 6 }, pale, 12),
    kit.box('mixerTruck', 3, 2.4, 8, { x: -6, y: 1.6, z: -half - 7 }, pale)
  ], pale);
  kit.merge('fpsMetalParts', metalParts, metal);
  kit.freeze(kit.cyl('mixerDrum', 1.6, 3.2, 5.2, { x: -6, y: 4.2, z: -half - 7.6, rx: Math.PI / 2 - 0.35 }, kit.mat('#c98a3a', { emissive: 0.1 }), 10));

  // easter egg: scritta col gesso sul muro sud-ovest (piccola, in alto, lontano dalle coperture)
  signs.push({ text: "N'CULO", style: 'poster', color: '#6a6a6a', bg: '#d9d2c2', w: 1.6, h: 0.6, x: -22, y: 3.0, z: -inner, ry: 0 });
  kit.signBoard('fpsSigns', signs);
}

/** Ombra "a macchia" sotto un giocatore (un disco scuro): aiuta a vedere dove sono i nemici. Materiale condiviso. */
let blobMat: StandardMaterial | null = null;
export function makeBlobShadow(scene: Scene): Mesh {
  if (!blobMat || blobMat.getScene() !== scene) {
    blobMat = new StandardMaterial('blobMat', scene);
    blobMat.diffuseColor = new Color3(0, 0, 0);
    blobMat.emissiveColor = new Color3(0, 0, 0);
    blobMat.disableLighting = true;
    blobMat.alpha = 0.35;
  }
  const d = MeshBuilder.CreateDisc('blob', { radius: 0.62, tessellation: 14 }, scene);
  d.rotation.x = Math.PI / 2;
  d.position.y = 0.03;
  d.material = blobMat;
  d.isPickable = false;
  return d;
}

void SIGN_FONT;
