import { Color3, Mesh, MeshBuilder, Scene, Vector3 } from '@babylonjs/core';
import type { DirectionalLight } from '@babylonjs/core';
import type { TrackSpline } from './track';
import { EnvKit, PAL, SIGN_FONT, seeded } from '../env/envKit';
import type { Xf } from '../env/envKit';

/**
 * RIBALTATI — CIRCUITO DEL LITORALE: il mondo intorno alla pista (la pista, i cordoli, i muretti e i segnali di
 * curva restano in track.ts / trackGuides.ts, invariati). Quattro SETTORI riconoscibili, ognuno con il suo landmark:
 *   1 LUNGOMARE   (0.00–0.25) mare, spiaggia, cabine, ombrelloni, palme · landmark: PALMA GIGANTE
 *   2 PAESE       (0.25–0.50) case con balconi, botteghe, insegne      · landmark: CAMPANILE
 *   3 PORTO       (0.50–0.75) darsena, barche, container, gru          · landmark: GRU + FARO
 *   4 COMMERCIALE (0.75–1.00) capannoni, parcheggio, insegne inventate · landmark: TOTEM "CENTRO COMMERCIALE"
 * All'inizio di ogni settore un portale con il nome sopra la strada (sopra la camera: non copre nulla).
 * Tutto cio' che si ripete e' a thin instances (una draw call per tipo, per tutta la pista): con 4-5 finestre ogni
 * oggetto viene disegnato 4-5 volte, quindi il conto conta piu' che altrove. Nessun oggetto e' collidibile e nessuno
 * entra nella carreggiata: ogni punto viene scartato se e' troppo vicino a QUALSIASI tratto della pista.
 */

export const KART_SECTORS = [
  { id: 'lungomare', name: 'LUNGOMARE', from: 0, to: 0.25 },
  { id: 'paese', name: 'PAESE', from: 0.25, to: 0.5 },
  { id: 'porto', name: 'PORTO', from: 0.5, to: 0.75 },
  { id: 'commerciale', name: 'ZONA COMMERCIALE', from: 0.75, to: 1 }
] as const;

export interface KartWorld {
  sun: DirectionalLight;
  update(now: number): void;
}

const GROUND_Y = -1.8;

export function buildKartWorld(scene: Scene, spline: TrackSpline): KartWorld {
  const kit = new EnvKit(scene);
  const L = spline.totalLength;
  const rnd = seeded(97);

  // ---- distanza dalla pista (per non mettere MAI nulla sulla carreggiata) ----
  const probe: { x: number; z: number; half: number }[] = [];
  for (let s = 0; s < L; s += 4) {
    const p = spline.positionAt(s);
    probe.push({ x: p.x, z: p.z, half: spline.widthAt(s) / 2 + 1.2 });
  }
  const clear = (x: number, z: number, margin: number): boolean => {
    for (const p of probe) {
      const dx = x - p.x;
      const dz = z - p.z;
      const r = p.half + margin;
      if (dx * dx + dz * dz < r * r) return false;
    }
    return true;
  };
  /** punto a lato della pista: frazione del giro, lato (+1 destra), distanza dal bordo */
  const beside = (f: number, side: number, off: number): { x: number; z: number; ry: number; y: number } => {
    const s = ((f % 1) + 1) % 1 * L;
    const pos = spline.positionAt(s);
    const right = spline.rightAt(s);
    const half = spline.widthAt(s) / 2;
    const q = pos.add(right.scale(side * (half + off)));
    // ry: il fronte (-Z del piano / +Z della scatola) guarda la pista
    return { x: q.x, z: q.z, y: pos.y, ry: Math.atan2(-right.x * side, -right.z * side) + Math.PI };
  };

  // ---- CIELO e LUCE: pomeriggio mediterraneo ----
  scene.clearColor.set(0.86, 0.93, 0.98, 1);
  kit.sky([[0, '#2a78c8'], [0.5, '#8ccaf2'], [0.85, '#d6eefb'], [1, '#f3f9ff']], 850);
  kit.clouds({ count: 18, radius: 400, yMin: 55, yMax: 130, tint: '#ffffff', size: 75, seed: 2 });
  // colline dell'entroterra solo dal lato terra (ovest/sud), il mare resta aperto
  kit.skyline({ radius: 470, height: 60, y: -12, color: '#9db8b4', kind: 'hills', seed: 4, arc: [Math.PI * 0.55, Math.PI * 1.6] });
  kit.skyline({ radius: 430, height: 36, y: -6, color: '#b5c6c6', kind: 'city', seed: 6, arc: [Math.PI * 0.75, Math.PI * 1.25] });
  scene.fogMode = Scene.FOGMODE_LINEAR;
  scene.fogColor = Color3.FromHexString('#dceefa');
  scene.fogStart = 260;
  scene.fogEnd = 720;
  const rig = kit.lightRig({
    key: [-0.55, -1, -0.35],
    keyColor: '#fff4e0',
    keyI: 0.88,
    sky: '#d8ecff',
    ground: '#8a7a5a',
    fillI: 0.66,
    rim: { dir: [0.5, -0.4, 0.6], color: '#cfe8ff', i: 0.22 }
  });
  kit.glow(0.5);

  // ---- TERRENO a zone (piani piatti: costano zero) ----
  const ground = MeshBuilder.CreateGround('ground', { width: 900, height: 900, subdivisions: 2 }, scene);
  ground.position.y = GROUND_Y;
  ground.material = kit.mat('#b8ad7c', { spec: 0, key: 'kartGround', dynamic: true });
  ground.receiveShadows = true;
  kit.freeze(ground);
  const patch = (name: string, hex: string, x0: number, z0: number, x1: number, z1: number, dy = 0.03): void => {
    const g = MeshBuilder.CreateGround(name, { width: x1 - x0, height: z1 - z0 }, scene);
    g.position.set((x0 + x1) / 2, GROUND_Y + dy, (z0 + z1) / 2);
    g.material = kit.mat(hex, { spec: 0 });
    kit.freeze(g);
  };
  // spiagge (lungomare) — est e nord
  patch('beachEast', PAL.sand, 104, -40, 118, 165);
  patch('beachNorth', PAL.sand, -60, 150, 118, 166);
  // paese: lastricato chiaro
  patch('townPaving', '#cfc4b0', -175, 40, -30, 175, 0.02);
  // porto: banchine di cemento
  patch('quay', '#a6a39c', -120, -125, 75, -103, 0.02);
  // commerciale: asfalto del parcheggio
  patch('parking', '#6a6c72', 55, -110, 110, -45, 0.02);
  // mare (est + nord) e darsena (sud)
  const waterTex = kit.texture('kartWater', 256, 256, (c, w, h) => {
    c.fillStyle = PAL.water;
    c.fillRect(0, 0, w, h);
    const r = seeded(5);
    c.strokeStyle = 'rgba(210,245,255,0.5)';
    c.lineWidth = 3;
    for (let i = 0; i < 36; i++) {
      const x = r() * w;
      const y = r() * h;
      c.beginPath();
      c.moveTo(x, y);
      c.quadraticCurveTo(x + 10, y - 4, x + 22, y);
      c.stroke();
    }
  }, { wrap: true });
  waterTex.uScale = 40;
  waterTex.vScale = 40;
  const waterMat = kit.mat('#ffffff', { tex: waterTex, spec: 0.4, emissive: 0.25, key: 'kartWaterMat', dynamic: true });
  const waters: Mesh[] = [];
  const water = (x0: number, z0: number, x1: number, z1: number): void => {
    const g = MeshBuilder.CreateGround('water', { width: x1 - x0, height: z1 - z0 }, scene);
    g.position.set((x0 + x1) / 2, GROUND_Y + 0.08, (z0 + z1) / 2);
    waters.push(g);
  };
  water(118, -40, 700, 700);
  water(-700, 166, 118, 700);
  water(-120, -420, 75, -125);
  water(75, -420, 700, -40);
  const sea = kit.merge('sea', waters, waterMat);
  if (sea) sea.material = waterMat;

  // ================================================================ tipi condivisi (thin instances)
  // EDIFICI: scatola unitaria con finestre e balconi (texture unica), colore per istanza
  const facade = kit.texture('kartFacade', 256, 256, (c, w, h) => {
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, w, h);
    for (let y = 18; y < h; y += 64) for (let x = 16; x < w; x += 60) {
      c.fillStyle = '#4a6078';
      c.fillRect(x, y, 26, 34);
      c.fillStyle = '#5d8a6a'; // persiane
      c.fillRect(x - 7, y, 6, 34);
      c.fillRect(x + 27, y, 6, 34);
      c.fillStyle = '#b8b0a0'; // balconcino
      c.fillRect(x - 8, y + 34, 42, 5);
    }
  }, { wrap: true });
  const bld = MeshBuilder.CreateBox('kartBuildings', { width: 1, height: 1, depth: 1 }, scene);
  bld.material = kit.mat('#ffffff', { tex: facade, emissive: 0.18, key: 'kartBuildingMat' });
  const roof = MeshBuilder.CreateCylinder('kartRoofs', { diameterTop: 0, diameterBottom: 1.42, height: 1, tessellation: 4 }, scene);
  roof.material = kit.mat('#b8664a', { key: 'kartRoofMat' });
  // CAPANNONI (porto, zona commerciale): lamiera ondulata + fascia vetrata, nessuna persiana
  const shedTex = kit.texture('kartShed', 256, 128, (c, w, h) => {
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(0,0,0,0.08)';
    for (let x = 0; x < w; x += 8) c.fillRect(x, 0, 3, h);
    c.fillStyle = '#3f5a72';
    c.fillRect(0, h * 0.62, w, h * 0.2);
    c.fillStyle = 'rgba(255,255,255,0.35)';
    for (let x = 6; x < w; x += 32) c.fillRect(x, h * 0.64, 12, h * 0.16);
    c.fillStyle = 'rgba(0,0,0,0.2)';
    c.fillRect(0, 0, w, 6);
  }, { wrap: true });
  const shedMesh = MeshBuilder.CreateBox('kartSheds', { width: 1, height: 1, depth: 1 }, scene);
  shedMesh.material = kit.mat('#ffffff', { tex: shedTex, emissive: 0.15, key: 'kartShedMat' });
  const sheds: Xf[] = [];
  const shedCols: string[] = [];
  const addShed = (x: number, z: number, w: number, h: number, d: number, ry: number, col: string): void => {
    if (!clear(x, z, Math.max(w, d) * 0.75 + 2)) return;
    sheds.push({ x, y: GROUND_Y + h / 2, z, sx: w, sy: h, sz: d, ry });
    shedCols.push(col);
  };
  const blds: Xf[] = [];
  const bldCols: string[] = [];
  const roofs: Xf[] = [];
  const addBuilding = (x: number, z: number, w: number, h: number, d: number, ry: number, col: string, pitched = true): boolean => {
    if (!clear(x, z, Math.max(w, d) * 0.75 + 2)) return false;
    blds.push({ x, y: GROUND_Y + h / 2, z, sx: w, sy: h, sz: d, ry });
    bldCols.push(col);
    if (pitched) roofs.push({ x, y: GROUND_Y + h + 1, z, sx: w, sy: 2, sz: d, ry: ry + Math.PI / 4 });
    return true;
  };
  // PALME
  const palmTrunk = MeshBuilder.CreateCylinder('kartPalmTrunks', { diameterTop: 0.22, diameterBottom: 0.36, height: 1, tessellation: 6 }, scene);
  palmTrunk.material = kit.mat('#8a6440', { key: 'kartPalmTrunk' });
  const palmLeaf = MeshBuilder.CreateBox('kartPalmLeaves', { width: 0.55, height: 0.06, depth: 2.6 }, scene);
  palmLeaf.setPivotPoint(new Vector3(0, 0, -1.3));
  palmLeaf.material = kit.mat('#3f8a4a', { emissive: 0.15, key: 'kartPalmLeaf' });
  const trunks: Xf[] = [];
  const leaves: Xf[] = [];
  const addPalm = (x: number, z: number, k: number): void => {
    if (!clear(x, z, 2 * k)) return;
    const h = 5 * k;
    trunks.push({ x, y: GROUND_Y + h / 2, z, sx: k, sy: h, sz: k, rz: (rnd() - 0.5) * 0.12 });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + rnd() * 0.4;
      leaves.push({ x: x + Math.sin(a) * 1.1 * k, y: GROUND_Y + h - 0.3 * k, z: z + Math.cos(a) * 1.1 * k, rx: 0.45, ry: a, s: k });
    }
  };
  // LAMPIONI lungo tutta la pista (lato alterno)
  const lampPole = MeshBuilder.CreateCylinder('kartLampPoles', { diameter: 0.16, height: 5.4, tessellation: 6 }, scene);
  lampPole.material = kit.mat('#2d3644');
  const lampHead = MeshBuilder.CreateBox('kartLampHeads', { width: 0.5, height: 0.22, depth: 0.9 }, scene);
  lampHead.material = kit.neon('#ffe9b0');
  const poles: Xf[] = [];
  const heads: Xf[] = [];
  for (let i = 0; i < 48; i++) {
    const f = (i + 0.5) / 48;
    const side = i % 2 === 0 ? -1 : 1;
    const b = beside(f, side, 2.4);
    if (!clear(b.x, b.z, 0.6)) continue;
    poles.push({ x: b.x, y: b.y + 2.2, z: b.z });
    const s = f * L;
    const r = spline.rightAt(s).scale(-side * 0.7);
    heads.push({ x: b.x + r.x, y: b.y + 4.9, z: b.z + r.z, ry: b.ry });
  }

  // ================================================================ 1 LUNGOMARE
  // cabine a righe sulla spiaggia nord e est
  const cabinTex = kit.texture('beachCabin', 128, 128, (c, w, h) => {
    for (let x = 0; x < w; x += 16) {
      c.fillStyle = (x / 16) % 2 === 0 ? '#f4efe4' : '#4f8fb0';
      c.fillRect(x, 0, 16, h);
    }
  });
  const cabin = MeshBuilder.CreateBox('beachCabins', { width: 2, height: 2.6, depth: 2 }, scene);
  cabin.material = kit.mat('#ffffff', { tex: cabinTex, emissive: 0.2, key: 'beachCabinMat' });
  const cabins: Xf[] = [];
  for (let i = 0; i < 16; i++) cabins.push({ x: -40 + i * 2.6, y: GROUND_Y + 1.3, z: 163 });
  for (let i = 0; i < 12; i++) cabins.push({ x: 115, y: GROUND_Y + 1.3, z: -20 + i * 2.6, ry: Math.PI / 2 });
  kit.thin(cabin, cabins.filter((c) => clear(c.x, c.z, 1.5)));
  kit.freeze(cabin);
  // ombrelloni (pastello) sulla spiaggia nord
  const umb = MeshBuilder.CreateCylinder('kartUmbrellas', { diameterTop: 0, diameterBottom: 2.6, height: 0.8, tessellation: 8 }, scene);
  umb.material = kit.mat('#ffffff', { emissive: 0.2, key: 'kartUmbrella' });
  const umbs: Xf[] = [];
  for (let i = 0; i < 14; i++) umbs.push({ x: 0 + i * 7 + rnd() * 2, y: GROUND_Y + 2.3, z: 157 + rnd() * 5 });
  for (let i = 0; i < 10; i++) umbs.push({ x: 108 + rnd() * 6, y: GROUND_Y + 2.3, z: 30 + i * 9 });
  kit.thin(umb, umbs.filter((u) => clear(u.x, u.z, 1.5)), ['#e7a6a0', '#a6c8e0', '#f0d8a0', '#b8d8b0']);
  kit.freeze(umb);
  // palme fitte lungo il lungomare
  for (let i = 0; i < 26; i++) {
    const f = 0.005 + (i / 26) * 0.24;
    const b = beside(f, i % 2 === 0 ? 1 : -1, 5 + rnd() * 3);
    addPalm(b.x, b.z, 0.9 + rnd() * 0.4);
  }
  // hotel del lungomare (alti, bianchi/pastello) dal lato interno
  for (let i = 0; i < 7; i++) {
    const b = beside(0.03 + i * 0.03, -1, 18 + rnd() * 6);
    addBuilding(b.x, b.z, 10, 14 + rnd() * 8, 9, b.ry, ['#f5efe4', '#f2d9c4', '#dfe9ee', '#f0e2b6'][i % 4], false);
  }
  // LANDMARK: palma gigante sulla spiaggia est, ben visibile dal rettilineo di partenza
  addPalm(112, 62, 3.2);
  kit.sign('LIDO\nDEL DISAGIO', { style: 'neon', color: PAL.neonCyan, w: 7, h: 3, x: 110, y: 6, z: 10, ry: -Math.PI / 2 - 0.3, billboard: false });

  // ================================================================ 2 PAESE
  const townCols = ['#efc9a8', '#f3e2c8', '#e8b89a', '#f0d9a8', '#e6d2c0', '#d9c2a8', '#f2e6d8'];
  for (let i = 0; i < 70; i++) {
    const f = 0.25 + (i / 70) * 0.25;
    const side = i % 2 === 0 ? 1 : -1;
    const b = beside(f, side, 7 + rnd() * 10);
    addBuilding(b.x, b.z, 6 + rnd() * 4, 6 + rnd() * 7, 6 + rnd() * 3, b.ry + (rnd() - 0.5) * 0.2, townCols[i % townCols.length]);
  }
  // seconda fila (piu' lontana, piu' alta): il paese ha profondita'
  for (let i = 0; i < 30; i++) {
    const f = 0.26 + (i / 30) * 0.23;
    const b = beside(f, i % 2 === 0 ? 1 : -1, 22 + rnd() * 10);
    addBuilding(b.x, b.z, 8, 9 + rnd() * 8, 8, b.ry, townCols[(i + 3) % townCols.length]);
  }
  // botteghe con insegna (TERTIARY, poche)
  const shop = (f: number, side: number, text: string, color: string): void => {
    const b = beside(f, side, 6.2);
    if (!clear(b.x, b.z, 0.5)) return;
    kit.sign(text, { style: 'board', color, w: 3.6, h: 1, x: b.x, y: b.y + 2.6, z: b.z, ry: b.ry + Math.PI });
  };
  shop(0.28, -1, 'ALIMENTARI', '#2a5a3a');
  shop(0.33, 1, 'TABACCHI', '#1f2f5a');
  shop(0.37, -1, 'BAR CENTRALE', '#6a2f2a');
  shop(0.44, 1, 'PESCHERIA', '#1f4a6a');
  // LANDMARK: campanile all'esterno del tornante
  const bell: Mesh[] = [];
  const stone = kit.mat('#d8c7a8', { emissive: 0.1 });
  const tx = -158;
  const tz = 26;
  bell.push(kit.box('belfry', 6, 26, 6, { x: tx, y: GROUND_Y + 13, z: tz }, stone));
  bell.push(kit.box('belfryTop', 7, 1, 7, { x: tx, y: GROUND_Y + 26.5, z: tz }, stone));
  kit.merge('campanile', bell, stone);
  kit.freeze(kit.cyl('belfryRoof', 0, 8.6, 6, { x: tx, y: GROUND_Y + 30, z: tz, ry: Math.PI / 4 }, kit.mat('#b8664a'), 4));
  kit.freeze(kit.box('belfryOpen', 6.1, 3.4, 2.4, { x: tx, y: GROUND_Y + 22, z: tz }, kit.mat('#2b2f3a')));
  const clock = kit.texture('belfryClock', 128, 128, (c) => {
    c.fillStyle = '#f6f1e4';
    c.beginPath();
    c.arc(64, 64, 58, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#2b2f3a';
    c.lineWidth = 8;
    c.stroke();
    c.beginPath();
    c.moveTo(64, 64);
    c.lineTo(64, 22);
    c.moveTo(64, 64);
    c.lineTo(94, 72);
    c.stroke();
  });
  for (const [dx, ry] of [[3.06, -Math.PI / 2], [-3.06, Math.PI / 2]] as const) {
    const p = MeshBuilder.CreatePlane('belfryClockFace', { size: 4 }, scene);
    p.position.set(tx + dx, GROUND_Y + 17, tz);
    p.rotation.y = ry;
    p.material = kit.mat('#ffffff', { tex: clock, emissive: 0.4, key: 'belfryClockMat' });
    kit.freeze(p);
  }

  // ================================================================ 3 PORTO
  // container impilati sulle banchine (colori smorzati, non quelli dei giocatori)
  const contTex = kit.texture('kartContainer', 128, 64, (c, w, h) => {
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(0,0,0,0.16)';
    for (let x = 4; x < w; x += 10) c.fillRect(x, 4, 4, h - 8);
  }, { wrap: true });
  const cont = MeshBuilder.CreateBox('kartContainers', { width: 6, height: 2.6, depth: 2.4 }, scene);
  cont.material = kit.mat('#ffffff', { tex: contTex, emissive: 0.15, key: 'kartContainerMat' });
  const conts: Xf[] = [];
  const contCols = ['#a8553a', '#4f7a8a', '#7a7f5a', '#8a5a6a', '#c9a44a', '#5a6a8a'];
  const contColList: string[] = [];
  for (let row = 0; row < 3; row++) for (let i = 0; i < 9; i++) {
    const x = -95 + i * 7;
    const z = -113 - row * 3;
    if (!clear(x, z, 3.5)) continue;
    const stack = 1 + Math.floor(rnd() * 3);
    for (let k = 0; k < stack; k++) {
      conts.push({ x, y: GROUND_Y + 1.3 + k * 2.6, z });
      contColList.push(contCols[Math.floor(rnd() * contCols.length)]);
    }
  }
  kit.thin(cont, conts, contColList);
  kit.freeze(cont);
  // magazzini del porto
  for (let i = 0; i < 6; i++) {
    const b = beside(0.52 + i * 0.035, -1, 14 + rnd() * 6);
    addShed(b.x, b.z, 14, 7, 10, b.ry, ['#9fb0b8', '#b8b0a0', '#a8b8a8'][i % 3]);
  }
  // barche nella darsena e lungo il mare
  const hull = MeshBuilder.CreateCylinder('kartHulls', { diameterTop: 2, diameterBottom: 0.4, height: 6, tessellation: 8 }, scene);
  hull.material = kit.mat('#ffffff', { key: 'kartHullMat' });
  const boatCabin = MeshBuilder.CreateBox('kartBoatCabins', { width: 1.4, height: 1.1, depth: 1.8 }, scene);
  boatCabin.material = kit.mat('#f3f0e8');
  const hulls: Xf[] = [];
  const cabs: Xf[] = [];
  const hullCols: string[] = [];
  const boatAt = (x: number, z: number, ry: number): void => {
    hulls.push({ x, y: GROUND_Y + 0.5, z, rx: Math.PI / 2, ry, sz: 0.6 });
    cabs.push({ x: x + Math.sin(ry) * 0.6, y: GROUND_Y + 1.3, z: z + Math.cos(ry) * 0.6, ry });
    hullCols.push(['#c94a3a', '#3a6ea8', '#f3f0e8', '#2f5a4a'][hulls.length % 4]);
  };
  for (let i = 0; i < 9; i++) boatAt(-100 + i * 18 + rnd() * 6, -140 - rnd() * 40, rnd() * Math.PI);
  for (let i = 0; i < 5; i++) boatAt(150 + rnd() * 120, 20 + i * 40, rnd() * Math.PI);
  kit.thin(hull, hulls, hullCols);
  kit.thin(boatCabin, cabs);
  kit.freeze(hull);
  kit.freeze(boatCabin);
  // LANDMARK: gru portuale (gialla smorzata) + faro sul molo
  const crane = kit.mat('#d9a43a', { emissive: 0.15 });
  const cr: Mesh[] = [];
  const cx = -30;
  const cz = -120;
  for (const dx of [-3, 3]) for (const dz of [-3, 3]) cr.push(kit.box('craneLeg', 0.8, 22, 0.8, { x: cx + dx, y: GROUND_Y + 11, z: cz + dz }, crane));
  cr.push(kit.box('craneDeck', 8, 2, 8, { x: cx, y: GROUND_Y + 23, z: cz }, crane));
  cr.push(kit.box('craneBoom', 3, 2.2, 46, { x: cx, y: GROUND_Y + 27, z: cz - 12, rx: -0.12 }, crane));
  cr.push(kit.box('craneCab', 4, 3, 4, { x: cx, y: GROUND_Y + 25.5, z: cz + 4 }, crane));
  kit.merge('crane', cr, crane);
  kit.freeze(kit.box('craneCable', 0.12, 16, 0.12, { x: cx, y: GROUND_Y + 18, z: cz - 26 }, kit.mat('#2b2f3a')));
  kit.freeze(kit.box('craneLoad', 6, 2.6, 2.4, { x: cx, y: GROUND_Y + 9.5, z: cz - 26 }, kit.mat('#4f7a8a')));
  const mole: Mesh[] = [];
  const molMat = kit.mat('#b8b2a6');
  mole.push(kit.box('breakwater', 6, 1.6, 70, { x: 40, y: GROUND_Y + 0.6, z: -160 }, molMat));
  kit.merge('breakwater', mole, molMat);
  const lhWhite = kit.mat('#f6f2ea', { emissive: 0.2 });
  const lhRed = kit.mat('#b8483c', { emissive: 0.2 });
  kit.freeze(kit.cyl('portLighthouse', 2.6, 3.6, 18, { x: 40, y: GROUND_Y + 9.5, z: -196 }, lhWhite, 12));
  const stripes: Mesh[] = [];
  for (const y of [4, 10]) stripes.push(kit.cyl('portLhStripe', 3.2, 3.4, 2, { x: 40, y: GROUND_Y + y, z: -196 }, lhRed, 12));
  stripes.push(kit.cyl('portLhCap', 0.3, 3.4, 2.2, { x: 40, y: GROUND_Y + 20.6, z: -196 }, lhRed, 12));
  kit.merge('portLhStripes', stripes, lhRed);
  kit.freeze(kit.cyl('portLhLamp', 2.2, 2.2, 1.4, { x: 40, y: GROUND_Y + 19, z: -196 }, kit.neon('#fff2b0'), 12));
  const carico = beside(0.6, -1, 5);
  if (clear(carico.x, carico.z, 0.5)) kit.sign('CARICO / SCARICO', { style: 'hazard', w: 5, h: 1.1, x: carico.x, y: carico.y + 2.2, z: carico.z, ry: carico.ry + Math.PI });

  // ================================================================ 4 COMMERCIALE
  const mallCols = ['#d8dce2', '#c9ced6', '#e2ddd2'];
  for (let i = 0; i < 6; i++) {
    const b = beside(0.78 + i * 0.035, i % 2 === 0 ? 1 : -1, 16 + rnd() * 6);
    addShed(b.x, b.z, 20, 7 + rnd() * 3, 14, b.ry, mallCols[i % 3]);
  }
  // insegne inventate sui capannoni (niente marchi veri)
  const store = (f: number, side: number, text: string, color: string, bg: string): void => {
    const b = beside(f, side, 9);
    if (!clear(b.x, b.z, 0.5)) return;
    kit.sign(text, { style: 'board', color, bg, w: 6.5, h: 1.8, x: b.x, y: b.y + 4.2, z: b.z, ry: b.ry + Math.PI });
    kit.freeze(kit.box('storePost', 0.25, 4, 0.25, { x: b.x, y: b.y + 1.6, z: b.z }, kit.mat(PAL.metalDark)));
  };
  store(0.79, 1, 'GUSTO', '#ffffff', '#b8483c');
  store(0.83, -1, 'GRANITA', '#1f3a5a', '#f2e6c8');
  store(0.87, 1, 'KEBAB', '#ffffff', '#3a6a3a');
  store(0.91, -1, 'DISCOUNT →', '#1f2f5a', '#f5c84a');
  store(0.95, 1, 'CASA DI CARBO', '#ffffff', '#6a3a7a');
  // il CENTRO COMMERCIALE vero e proprio: blocco lungo e basso con l'insegna grande verso la pista
  {
    const b = beside(0.86, -1, 26);
    addShed(b.x, b.z, 46, 10, 22, b.ry, '#e6e2d8');
    const front = beside(0.86, -1, 14.6);
    kit.sign('IL DISAGIO\nCENTRO COMMERCIALE', { style: 'neon', color: PAL.neonAmber, w: 18, h: 4, x: front.x, y: GROUND_Y + 8, z: front.z, ry: front.ry + Math.PI });
  }
  // LANDMARK: totem del centro commerciale
  const totem = beside(0.82, -1, 22);
  kit.freeze(kit.box('mallTotem', 3, 22, 3, { x: totem.x, y: GROUND_Y + 11, z: totem.z }, kit.mat('#3a4252')));
  const totemTex = kit.texture('mallTotemSign', 128, 512, (c, w, h) => {
    c.fillStyle = '#f5c84a';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#1f2430';
    c.font = `900 40px ${SIGN_FONT}`;
    c.textAlign = 'center';
    'CENTRO'.split('').forEach((ch, i) => c.fillText(ch, w / 2, 70 + i * 52));
    c.font = `900 22px ${SIGN_FONT}`;
    c.fillText('COMMERCIALE', w / 2, 420);
    c.fillText('IL DISAGIO', w / 2, 456);
  });
  for (const k of [0, 1, 2, 3]) {
    const p = MeshBuilder.CreatePlane('mallTotemFace', { width: 2.8, height: 11 }, scene);
    const a = (k * Math.PI) / 2;
    p.position.set(totem.x + Math.sin(a) * 1.52, GROUND_Y + 15, totem.z + Math.cos(a) * 1.52);
    p.rotation.y = a + Math.PI;
    p.material = kit.mat('#ffffff', { tex: totemTex, unlit: true, key: 'mallTotemMat' });
    kit.freeze(p);
  }
  // strisce del parcheggio + qualche auto (scatole basse, colori smorzati)
  const car = MeshBuilder.CreateBox('kartParkedCars', { width: 2, height: 1.3, depth: 4.2 }, scene);
  car.material = kit.mat('#ffffff', { spec: 0.3, key: 'kartCarMat' });
  const cars: Xf[] = [];
  for (let i = 0; i < 14; i++) {
    const x = 62 + (i % 7) * 6;
    const z = -100 + Math.floor(i / 7) * 12;
    if (rnd() < 0.7 && clear(x, z, 2.5)) cars.push({ x, y: GROUND_Y + 0.7, z });
  }
  kit.thin(car, cars, ['#b8bcc4', '#4a5a7a', '#8a3a3a', '#2a2c32', '#e8e4da']);
  kit.freeze(car);
  for (let i = 0; i < 6; i++) addPalm(beside(0.76 + i * 0.04, 1, 6).x, beside(0.76 + i * 0.04, 1, 6).z, 0.85);

  // ================================================================ PORTALI DEI SETTORI (sopra la strada)
  const gateMat = kit.mat('#e8e2d2', { emissive: 0.2 });
  const gates: Mesh[] = [];
  for (const sec of KART_SECTORS.slice(1)) {
    const s = sec.from * L + 6;
    const pos = spline.positionAt(s);
    const right = spline.rightAt(s);
    const half = spline.widthAt(s) / 2 + 1.4;
    const ang = spline.tangentAngleAt(s);
    for (const side of [-1, 1]) {
      const p = pos.add(right.scale(side * half));
      gates.push(kit.box('sectorPost', 0.5, 7.6, 0.5, { x: p.x, y: pos.y + 3.8 - 0.4, z: p.z }, gateMat));
    }
    gates.push(kit.box('sectorBeam', half * 2 + 0.6, 0.4, 0.4, { x: pos.x, y: pos.y + 7.4, z: pos.z, ry: ang + Math.PI / 2 }, gateMat));
    // insegna leggibile da chi arriva (lato verso la direzione di provenienza)
    kit.sign(sec.name, { style: 'neon', color: PAL.neonAmber, w: Math.min(half * 2, 14), h: 2, x: pos.x, y: pos.y + 8.6, z: pos.z, ry: ang, twoSided: true });
  }
  kit.merge('sectorGates', gates, gateMat);

  // cartelli delle localita'
  const town = (f: number, text: string): void => {
    const b = beside(f, 1, 3.2);
    if (!clear(b.x, b.z, 0.3)) return;
    kit.sign(text, { style: 'board', color: '#ffffff', bg: '#1f4a8a', w: 3.4, h: 1.1, x: b.x, y: b.y + 2.4, z: b.z, ry: b.ry + Math.PI });
  };
  town(0.2, 'NETTUNO');
  town(0.38, 'ANZIO');

  // ---- finalizza i tipi condivisi ----
  kit.thin(shedMesh, sheds, shedCols);
  kit.freeze(shedMesh);
  kit.thin(bld, blds, bldCols);
  kit.freeze(bld);
  kit.thin(roof, roofs);
  kit.freeze(roof);
  kit.thin(palmTrunk, trunks);
  kit.freeze(palmTrunk);
  kit.thin(palmLeaf, leaves);
  kit.freeze(palmLeaf);
  kit.thin(lampPole, poles);
  kit.thin(lampHead, heads);
  kit.freeze(lampPole);
  kit.freeze(lampHead);

  return {
    sun: rig.sun,
    update(now: number): void {
      waterTex.vOffset = (now * 0.000015) % 1;
    }
  };
}
