import { Color3, Matrix, Mesh, MeshBuilder, Quaternion, StandardMaterial, Vector3 } from '@babylonjs/core';
import type { Scene } from '@babylonjs/core';
import { FIELD_HALF_W, FIELD_HALF_D, NET_HEIGHT } from './volleyballTypes';
import { EnvKit, PAL, seeded } from '../env/envKit';
import type { Xf } from '../env/envKit';

/**
 * PALLAVOLO DEI DISAGIATI — beach volley sul lungomare (ispirazione Nettuno/Anzio, senza pretese geografiche),
 * golden hour leggera. Campo, rete e sabbia di gioco: stesse misure di prima.
 *  - la palla BIANCA resta leggibile: sabbia del campo un filo piu' calda e scura del resto, luce del tramonto
 *    di lato (non controluce), niente bianco grande vicino al campo
 *  - rete scura a maglia con le bande bianche: si legge sempre (prima era un vetro al 35% che spariva)
 *  - PRIMARY: il mare con il sole basso, il promontorio con il paese a sinistra, il pontile col faro a destra
 *  - SECONDARY: palme (che ondeggiano piano), chiosco con il menu, passeggiata con lampioni, ombrelloni lontani
 *  - TERTIARY: menu del chiosco (granita, kebab, birra) e il cartello NETTUNO
 */

export interface VolleyballEnvironment {
  update(now: number): void;
}

const SEA_Z = FIELD_HALF_D + 18;

export function buildVolleyballEnvironment(scene: Scene): VolleyballEnvironment {
  const kit = new EnvKit(scene);
  kit.sky([[0, '#3b6db3'], [0.45, '#7fa6d6'], [0.75, '#f0b98a'], [0.9, '#ffcf96'], [1, '#ffe2b0']]);
  kit.clouds({ count: 12, radius: 320, yMin: 22, yMax: 70, tint: '#ffd2b4', size: 60, seed: 3, arc: [Math.PI / 2 - 1.4, Math.PI / 2 + 1.4] });
  // sole basso sull'orizzonte (disco emissivo, escluso dal bagliore: non sbianca)
  const sun = MeshBuilder.CreateDisc('sunDisc', { radius: 22, tessellation: 32 }, scene);
  sun.position.set(-120, 26, 330);
  sun.material = kit.mat('#ffe6a8', { unlit: true, key: 'sunDiscMat' });
  sun.material.fogEnabled = false;
  kit.excludeFromGlow(kit.freeze(sun));

  kit.lightRig({
    key: [0.75, -0.55, 0.35],
    keyColor: '#ffe0b8',
    keyI: 0.95,
    sky: '#cfe0ff',
    ground: '#c9a46b',
    fillI: 0.62,
    rim: { dir: [0.3, -0.35, -1], color: '#ffc58a', i: 0.35 }
  });
  kit.glow(0.45);

  // ---- SABBIA (gameplay: stessa scatola di prima) ----
  const sandTex = kit.texture('sandTex2', 1024, 1024, (c, S) => {
    c.fillStyle = '#e8cd92';
    c.fillRect(0, 0, S, S);
    const r = seeded(51);
    for (let i = 0; i < 3500; i++) {
      c.fillStyle = r() < 0.5 ? 'rgba(255,244,214,0.22)' : 'rgba(170,130,72,0.18)';
      c.fillRect(r() * S, r() * S, 2, 2);
    }
    // piccole ondulazioni del vento
    c.strokeStyle = 'rgba(160,120,70,0.12)';
    c.lineWidth = 3;
    for (let i = 0; i < 70; i++) {
      const x = r() * S;
      const y = r() * S;
      c.beginPath();
      c.moveTo(x, y);
      c.quadraticCurveTo(x + 20, y - 6, x + 44, y);
      c.stroke();
    }
    // CAMPO: sabbia battuta appena piu' scura (la palla bianca stacca) + fettucce bianche
    const cw = S * ((FIELD_HALF_W * 2) / 90);
    const ch = S * ((FIELD_HALF_D * 2) / 70);
    const x0 = S / 2 - cw / 2;
    const y0 = S / 2 - ch / 2;
    c.fillStyle = 'rgba(170,118,62,0.34)'; // piu' scura: la palla bianca stacca anche in scala di grigi
    c.fillRect(x0, y0, cw, ch);
    c.strokeStyle = '#fbf7ee';
    c.lineWidth = 7;
    c.strokeRect(x0, y0, cw, ch);
    c.beginPath();
    c.moveTo(x0, S / 2);
    c.lineTo(x0 + cw, S / 2);
    c.stroke();
  });
  const sandMat = new StandardMaterial('sandMat', scene);
  sandMat.diffuseTexture = sandTex;
  sandMat.specularColor = new Color3(0.03, 0.03, 0.03);
  const sand = MeshBuilder.CreateBox('sand', { width: 90, height: 1, depth: 70 }, scene);
  sand.position.y = -0.5;
  sand.material = sandMat;
  kit.freeze(sand);

  // ---- MARE: piano con onde disegnate che scorrono piano + battigia ----
  const seaTex = kit.texture('seaWaves', 256, 256, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#2f86b0');
    g.addColorStop(1, '#3b97bd');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    const r = seeded(61);
    c.strokeStyle = 'rgba(200,240,255,0.45)';
    c.lineWidth = 3;
    for (let i = 0; i < 40; i++) {
      const x = r() * w;
      const y = r() * h;
      c.beginPath();
      c.moveTo(x, y);
      c.quadraticCurveTo(x + 10, y - 4, x + 22, y);
      c.stroke();
    }
  }, { wrap: true });
  seaTex.uScale = 30;
  seaTex.vScale = 14;
  const sea = MeshBuilder.CreateGround('sea', { width: 900, height: 420 }, scene);
  sea.position.set(0, -0.35, SEA_Z + 210);
  const seaMat = new StandardMaterial('seaMat', scene);
  seaMat.diffuseTexture = seaTex;
  seaMat.specularColor = new Color3(0.5, 0.45, 0.35);
  seaMat.specularPower = 24;
  seaMat.emissiveColor = new Color3(0.1, 0.16, 0.2);
  sea.material = seaMat;
  sea.isPickable = false;
  // battigia (sabbia bagnata + schiuma)
  const wet = MeshBuilder.CreateGround('wetSand', { width: 900, height: 6 }, scene);
  wet.position.set(0, -0.005, SEA_Z - 1.5);
  wet.material = kit.mat('#c9a874', { spec: 0.2, key: 'wetSand' });
  kit.freeze(wet);
  const foam = MeshBuilder.CreateGround('foam', { width: 900, height: 1.2 }, scene);
  foam.position.set(0, -0.002, SEA_Z + 0.4);
  foam.material = kit.mat('#f6fbff', { emissive: 0.5, key: 'foamMat' });
  foam.isPickable = false;

  // ---- RETE: maglia scura leggibile + bande bianche, pali imbottiti ----
  const netTex = kit.texture('volleyNet', 256, 64, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.strokeStyle = '#1d2433';
    c.lineWidth = 3;
    for (let x = 0; x <= w; x += 10) {
      c.beginPath();
      c.moveTo(x, 0);
      c.lineTo(x, h);
      c.stroke();
    }
    for (let y = 0; y <= h; y += 10) {
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(w, y);
      c.stroke();
    }
  }, { alpha: true, wrap: true });
  netTex.uScale = 6;
  netTex.vScale = 2;
  const netMat = new StandardMaterial('netMat', scene);
  netMat.diffuseTexture = netTex;
  netMat.diffuseTexture.hasAlpha = true;
  netMat.useAlphaFromDiffuseTexture = true;
  netMat.backFaceCulling = false;
  netMat.specularColor = Color3.Black();
  netMat.emissiveColor = new Color3(0.08, 0.1, 0.14);
  netMat.freeze();
  // la rete in gioco e' un muro pieno fino a NET_HEIGHT (la palla sotto non passa): la maglia arriva a terra
  const netH = NET_HEIGHT;
  const net = MeshBuilder.CreatePlane('net', { width: FIELD_HALF_W * 2 + 1, height: netH }, scene);
  net.position.set(0, NET_HEIGHT - netH / 2, 0);
  net.material = netMat;
  kit.freeze(net);
  const bandMat = kit.mat('#fbf7ee', { emissive: 0.35 });
  const bands: Mesh[] = [];
  bands.push(kit.box('band', FIELD_HALF_W * 2 + 1, 0.16, 0.14, { x: 0, y: NET_HEIGHT, z: 0 }, bandMat));
  bands.push(kit.box('bandLow', FIELD_HALF_W * 2 + 1, 0.08, 0.08, { x: 0, y: 0.04, z: 0 }, bandMat));
  for (const sx of [-1, 1]) bands.push(kit.box('antenna', 0.06, 1, 0.06, { x: sx * (FIELD_HALF_W + 0.5), y: NET_HEIGHT + 0.4, z: 0 }, bandMat));
  kit.merge('netBands', bands, bandMat);
  const postMat = kit.mat('#3c5f8a', { spec: 0.2 });
  const posts: Mesh[] = [];
  for (const sx of [-FIELD_HALF_W - 0.9, FIELD_HALF_W + 0.9]) posts.push(kit.cyl('post', 0.3, 0.3, NET_HEIGHT + 0.6, { x: sx, y: (NET_HEIGHT + 0.6) / 2, z: 0 }, postMat, 10));
  kit.merge('netPosts', posts, postMat);

  // ---- PROMONTORIO col paese (sinistra) e PONTILE col faro (destra): PRIMARY ----
  const hill = MeshBuilder.CreateSphere('headland', { diameterX: 170, diameterY: 44, diameterZ: 90, segments: 12 }, scene);
  hill.position.set(-95, -7, SEA_Z + 120);
  hill.material = kit.mat('#7d9a6a', { spec: 0, emissive: 0.25, key: 'headlandMat' });
  kit.freeze(hill);
  const houses = MeshBuilder.CreateBox('coastHouses', { width: 1, height: 1, depth: 1 }, scene);
  houses.material = kit.mat('#ffffff', { spec: 0.02, emissive: 0.3, key: 'coastHouseMat' });
  const r = seeded(71);
  const hs: Xf[] = [];
  const hc: string[] = [];
  const houseTones = ['#f3e2c8', '#efc9a8', '#f5efe0', '#e8b89a', '#f0d9a8', '#dfe6e8'];
  for (let i = 0; i < 26; i++) {
    const x = -150 + r() * 100;
    const z = SEA_Z + 95 + r() * 40;
    const h = 4 + r() * 6;
    const hy = Math.max(0, 14 - Math.abs(x + 95) * 0.17 - Math.abs(z - SEA_Z - 120) * 0.3);
    hs.push({ x, y: hy + h / 2 - 2, z, sx: 4 + r() * 4, sy: h, sz: 4 + r() * 3, ry: r() * 0.4 });
    hc.push(houseTones[i % houseTones.length]);
  }
  kit.thin(houses, hs, hc);
  kit.freeze(houses);
  // pontile + faro (landmark a destra)
  const wood = kit.mat('#a08668');
  const pier: Mesh[] = [];
  pier.push(kit.box('pierDeck', 4, 0.4, 56, { x: 34, y: 0.6, z: SEA_Z + 26 }, wood));
  for (let i = 0; i < 8; i++) pier.push(kit.box('pierLeg', 0.4, 2.2, 0.4, { x: 34 + (i % 2 ? 1.6 : -1.6), y: -0.6, z: SEA_Z + 2 + i * 7 }, wood));
  kit.merge('pier', pier, wood);
  const lh: Mesh[] = [];
  const white = kit.mat('#f6f2ea', { emissive: 0.2 });
  const red = kit.mat('#b8483c', { emissive: 0.2 });
  lh.push(kit.cyl('lighthouse', 2.2, 3.2, 14, { x: 34, y: 7.6, z: SEA_Z + 56 }, white, 12));
  kit.merge('lighthouseWhite', lh, white);
  const stripes: Mesh[] = [];
  for (const y of [4, 9]) stripes.push(kit.cyl('lhStripe', 2.75, 2.9, 1.6, { x: 34, y, z: SEA_Z + 56 }, red, 12));
  stripes.push(kit.cyl('lhCap', 0.2, 2.8, 1.6, { x: 34, y: 16.4, z: SEA_Z + 56 }, red, 12));
  kit.merge('lighthouseRed', stripes, red);
  const beacon = kit.cyl('lhLamp', 1.8, 1.8, 1.2, { x: 34, y: 15, z: SEA_Z + 56 }, kit.neon('#fff2b0'), 12);
  kit.freeze(beacon);

  // ---- BARCHE A VELA al largo (nell'inquadratura: il mare non e' vuoto) + riflesso del sole sull'acqua ----
  const hullM = MeshBuilder.CreateBox('sailHulls', { width: 1.2, height: 0.6, depth: 4 }, scene);
  hullM.material = kit.mat('#f3efe6', { emissive: 0.2, key: 'sailHullMat' });
  const sail = MeshBuilder.CreateCylinder('sails', { diameterTop: 0, diameterBottom: 3, height: 5, tessellation: 3 }, scene);
  sail.material = kit.mat('#fbf6ec', { emissive: 0.35, key: 'sailMat' });
  const boats: Xf[] = [];
  const sails: Xf[] = [];
  for (const [x, z] of [[-26, SEA_Z + 34], [12, SEA_Z + 70], [-6, SEA_Z + 120], [58, SEA_Z + 95], [-50, SEA_Z + 60]] as const) {
    boats.push({ x, y: -0.1, z, ry: 0.6 });
    sails.push({ x, y: 2.8, z, ry: 0.6, sz: 0.12 });
  }
  kit.thin(hullM, boats);
  kit.thin(sail, sails);
  kit.freeze(hullM);
  kit.freeze(sail);
  const glitter = kit.texture('sunGlitter', 64, 256, (c, w, h) => {
    const rr = seeded(81);
    for (let i = 0; i < 160; i++) {
      const y = rr() * h;
      const a = 0.15 + (y / h) * 0.55;
      c.fillStyle = `rgba(255,226,160,${a.toFixed(2)})`;
      c.fillRect(w / 2 + (rr() - 0.5) * w * (0.3 + (y / h) * 0.7), y, 6 + rr() * 10, 2);
    }
  }, { alpha: true });
  const glitterMat = new StandardMaterial('glitterMat', scene);
  glitterMat.emissiveTexture = glitter;
  glitterMat.opacityTexture = glitter;
  glitterMat.diffuseColor = Color3.Black();
  glitterMat.disableLighting = true;
  glitterMat.freeze();
  const glit = MeshBuilder.CreateGround('sunPath', { width: 40, height: 220 }, scene);
  glit.position.set(-18, -0.32, SEA_Z + 120);
  glit.rotation.y = -0.25;
  glit.material = glitterMat;
  kit.freeze(glit);
  kit.excludeFromGlow(glit);

  // ---- PALME (thin instances; ondeggiano piano) ----
  const trunk = MeshBuilder.CreateCylinder('palmTrunks', { diameterTop: 0.32, diameterBottom: 0.55, height: 1, tessellation: 6 }, scene);
  trunk.material = kit.mat('#8a6440', { key: 'palmTrunkMat' });
  const leaf = MeshBuilder.CreateBox('palmLeaves', { width: 0.6, height: 0.06, depth: 2.6 }, scene);
  leaf.setPivotPoint(new Vector3(0, 0, -1.3));
  leaf.material = kit.mat('#3f8a4a', { emissive: 0.15, key: 'palmLeafMat' });
  const palmSpots: [number, number, number][] = [
    [-FIELD_HALF_W - 7, FIELD_HALF_D + 6, 1.15],
    [FIELD_HALF_W + 8, FIELD_HALF_D + 7, 1.25],
    [-FIELD_HALF_W - 12, -2, 1.0],
    [FIELD_HALF_W + 13, 2, 1.1],
    [-30, SEA_Z - 6, 1.35],
    [-40, SEA_Z - 10, 1.05],
    [34, SEA_Z - 8, 1.2],
    [44, SEA_Z - 4, 0.95]
  ];
  const trunks: Xf[] = [];
  const leafBase: { x: number; y: number; z: number; a: number; k: number }[] = [];
  for (const [x, z, k] of palmSpots) {
    const h = 6.5 * k;
    trunks.push({ x, y: h / 2, z, sx: k, sy: h, sz: k, rz: 0.08 });
    for (let i = 0; i < 7; i++) leafBase.push({ x: x + h * 0.04, y: h, z, a: (i / 7) * Math.PI * 2, k });
  }
  kit.thin(trunk, trunks);
  kit.freeze(trunk);
  const leafBuf = new Float32Array(leafBase.length * 16);
  const m = new Matrix();
  const q = new Quaternion();
  const sc = new Vector3();
  const p = new Vector3();
  const writeLeaves = (t: number): void => {
    leafBase.forEach((l, i) => {
      const sway = Math.sin(t * 0.9 + l.x * 0.1 + l.a) * 0.08;
      Quaternion.FromEulerAnglesToRef(0.45 + sway, l.a, 0, q);
      sc.set(l.k, l.k, l.k);
      p.set(l.x, l.y, l.z);
      Matrix.ComposeToRef(sc, q, p, m);
      m.copyToArray(leafBuf, i * 16);
    });
  };
  writeLeaves(0);
  leaf.thinInstanceSetBuffer('matrix', leafBuf, 16, false);
  leaf.thinInstanceRefreshBoundingInfo(false);
  leaf.isPickable = false;
  let frame = 0;
  if (kit.q !== 'low') {
    kit.onFrame((t) => {
      if (++frame % 3 !== 0) return; // lento: basta 1 frame su 3
      writeLeaves(t);
      leaf.thinInstanceBufferUpdated('matrix');
    });
  }

  // ---- CHIOSCO col menu (destra, sulla sabbia) ----
  const kx = FIELD_HALF_W + 12;
  const kz = -FIELD_HALF_D + 1;
  kit.freeze(kit.box('kiosk', 5, 2.8, 3.4, { x: kx, y: 1.4, z: kz }, kit.mat('#e8dcc4')));
  kit.freeze(kit.box('kioskRoof', 6.2, 0.5, 4.6, { x: kx, y: 3.1, z: kz }, kit.mat('#5e8f8a')));
  kit.sign('CHIOSCO\nDA NICOLÒ', { style: 'board', color: '#2f5a58', w: 3.6, h: 1.4, x: kx - 2.55, y: 2.1, z: kz, ry: Math.PI / 2 });
  kit.sign('GRANITA 2€\nKEBAB 5€\nBIRRA 3€', { style: 'poster', color: '#9a3a2a', w: 1.5, h: 1.8, x: kx - 2.55, y: 0.95, z: kz + 1.1, ry: Math.PI / 2 });

  // ---- PASSEGGIATA (sinistra): muretto, lampioni, ringhiera ----
  const promX = -FIELD_HALF_W - 18;
  kit.freeze(kit.box('promenadeWall', 1.2, 1, 70, { x: promX, y: 0.5, z: 0 }, kit.mat(PAL.concrete)));
  kit.freeze(kit.box('promenade', 8, 0.6, 70, { x: promX - 4.6, y: 0.3, z: 0 }, kit.mat('#c9b8a0')));
  const lampPole = MeshBuilder.CreateCylinder('promLampPoles', { diameter: 0.16, height: 4.4, tessellation: 6 }, scene);
  lampPole.material = kit.mat('#2e3a48');
  const lampHead = MeshBuilder.CreateSphere('promLampHeads', { diameter: 0.5, segments: 6 }, scene);
  lampHead.material = kit.neon('#ffe2a0');
  const lp: Xf[] = [];
  const lh2: Xf[] = [];
  for (let i = 0; i < 8; i++) {
    const z = -30 + i * 9;
    lp.push({ x: promX - 1.2, y: 2.5, z });
    lh2.push({ x: promX - 1.2, y: 4.8, z });
  }
  kit.thin(lampPole, lp);
  kit.thin(lampHead, lh2);
  kit.freeze(lampPole);
  kit.freeze(lampHead);
  kit.sign('NETTUNO', { style: 'board', color: '#1f3a5a', w: 4, h: 1.2, x: promX + 0.65, y: 1.9, z: FIELD_HALF_D + 2, ry: Math.PI / 2 });

  // ---- OMBRELLONI lontani lungo la riva (thin instances, colori pastello) ----
  const umb = MeshBuilder.CreateCylinder('umbrellas', { diameterTop: 0, diameterBottom: 2.6, height: 0.8, tessellation: 8 }, scene);
  umb.material = kit.mat('#ffffff', { key: 'umbrellaMat', emissive: 0.2 });
  const umbPole = MeshBuilder.CreateCylinder('umbrellaPoles', { diameter: 0.08, height: 2.2, tessellation: 4 }, scene);
  umbPole.material = kit.mat('#f0ece4');
  const us: Xf[] = [];
  const up: Xf[] = [];
  for (const side of [-1, 1]) for (let i = 0; i < 9; i++) {
    const x = side * (36 + i * 6 + r() * 2);
    const z = SEA_Z - 6 - r() * 8;
    us.push({ x, y: 2.3, z });
    up.push({ x, y: 1.1, z });
  }
  kit.thin(umb, us, ['#e7a6a0', '#a6c8e0', '#f0d8a0', '#b8d8b0', '#d8b8e0']);
  kit.thin(umbPole, up);
  kit.freeze(umb);
  kit.freeze(umbPole);

  // ---- pubblico in piedi sulla sabbia dietro il fondo campo ----
  const fans: { x: number; y: number; z: number }[] = [];
  for (let i = 0; i < 34; i++) fans.push({ x: -FIELD_HALF_W - 2 + (i / 33) * (FIELD_HALF_W * 2 + 4) + (r() - 0.5), y: 0, z: FIELD_HALF_D + 3 + r() * 2.5 });
  kit.crowd(fans, { face: [0, 0], scale: 1, seed: 33, tones: ['#e8d4b8', '#7aa0c0', '#c87a6a', '#f0e6d0', '#8ab08a', '#d8a85a', '#5a6a8a'] });

  return {
    update(now: number): void {
      // onde: scorrimento lentissimo, schiuma che respira
      seaTex.vOffset = (now * 0.00002) % 1;
      seaTex.uOffset = Math.sin(now * 0.0002) * 0.01;
      foam.position.z = SEA_Z + 0.4 + Math.sin(now * 0.0011) * 0.5;
    }
  };
}
