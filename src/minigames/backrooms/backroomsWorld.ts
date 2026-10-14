import { Scene, Mesh, MeshBuilder, StandardMaterial, Color3, DynamicTexture, Vector3, TransformNode, HemisphericLight, DirectionalLight, ShadowGenerator } from '@babylonjs/core';
import { Rng } from '../../../shared/rng';
import { CELL, center, neighbors } from './maze';
import type { Maze } from './maze';
import type { CreatureKind } from './backroomsRules';
import {paintRecess} from '../env/surfaceDetail';

function material(scene: Scene, name: string, hex: string): StandardMaterial {
  const m = new StandardMaterial(name, scene); m.diffuseColor = Color3.FromHexString(hex); m.specularColor = Color3.Black(); return m;
}
/** Original seamless textures, authored at runtime. Seeded grain does not flicker between frames. */
function surface(scene: Scene, name: string, kind: 'wall' | 'carpet' | 'ceiling'): StandardMaterial {
  const mat = material(scene, name, '#ffffff'), t = new DynamicTexture(name, 512, scene, false), c = t.getContext() as CanvasRenderingContext2D, rng = new Rng(812 + kind.length);
  const image = c.createImageData(512, 512);
  for (let i = 0; i < image.data.length; i += 4) {
    const n = rng.int(-13, 13), color = kind === 'wall' ? [162, 148, 90] : kind === 'carpet' ? [81, 76, 48] : [145, 140, 116];
    image.data[i] = color[0] + n; image.data[i + 1] = color[1] + n; image.data[i + 2] = color[2] + n; image.data[i + 3] = 255;
  }
  c.putImageData(image, 0, 0);
  if (kind === 'wall') {
    c.strokeStyle = '#877a4d66'; c.lineWidth = 1.5;
    for (let x = 0; x < 512; x += 32) for (let y = 0; y < 512; y += 64) {
      c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 16, y + 25, x, y + 64); c.quadraticCurveTo(x - 16, y + 25, x, y); c.stroke();
    }
    for (let i = 0; i < 20; i++) { const x = rng.int(0, 512), y = rng.int(0, 512), g = c.createRadialGradient(x, y, 0, x, y, rng.int(15, 65)); g.addColorStop(0, '#55482b22'); g.addColorStop(1, '#55482b00'); c.fillStyle = g; c.fillRect(0, 0, 512, 512); }
    const g = c.createLinearGradient(0, 0, 0, 512); g.addColorStop(0, '#10100040'); g.addColorStop(.15, '#00000000'); g.addColorStop(.8, '#00000000'); g.addColorStop(1, '#1d1c0b80'); c.fillStyle = g; c.fillRect(0, 0, 512, 512);
  } else if (kind === 'carpet') {
    c.strokeStyle = '#aaaa7540'; for (let i = 0; i < 11000; i++) { const x = rng.int(0, 512), y = rng.int(0, 512); c.beginPath(); c.moveTo(x, y); c.lineTo(x + 1, y + 3); c.stroke(); }
    c.fillStyle = '#21271925'; for (let i = 0; i < 16; i++) { c.beginPath(); c.ellipse(rng.int(0, 512), rng.int(0, 512), rng.int(8, 55), rng.int(8, 34), rng.next(), 0, Math.PI * 2); c.fill(); }
  } else {
    c.strokeStyle = '#383b30'; c.lineWidth = 5;
    for (let i = 0; i < 512; i += 128) { c.strokeRect(i, 0, 128, 512); c.strokeRect(0, i, 512, 128); }
    for (let y = 0; y < 512; y += 128) for (let x = 0; x < 512; x += 128) paintRecess(c,x+4,y+4,120,120,3);
  }
  t.update(); mat.diffuseTexture = t; return mat;
}
export function inscription(scene: Scene, name: string, text: string, width: number, height: number, background = '#383b2b'): Mesh {
  const tex = new DynamicTexture(name, { width: 512, height: 256 }, scene, false), c = tex.getContext() as CanvasRenderingContext2D;
  c.fillStyle = background; c.fillRect(0, 0, 512, 256); c.strokeStyle = '#a6a987'; c.lineWidth = 5; c.strokeRect(12, 12, 488, 232);
  paintRecess(c,20,20,472,216,2);
  // Worn corner fasteners and faded edge are part of the same texture, not extra meshes.
  c.fillStyle='#c1bea0';for(const x of [24,488])for(const y of [24,232]){c.beginPath();c.arc(x,y,3,0,Math.PI*2);c.fill();}
  c.font = 'bold 35px monospace'; c.fillStyle = '#dfddac'; c.textAlign = 'center'; text.split('\n').forEach((line, i, lines) => c.fillText(line, 256, 126 + (i - (lines.length - 1) / 2) * 42)); tex.update();
  const mat = material(scene, name, '#ffffff'); mat.diffuseTexture = tex; mat.emissiveColor = new Color3(.12, .12, .1);
  const mesh = MeshBuilder.CreatePlane(name, { width, height, sideOrientation: Mesh.DOUBLESIDE }, scene); mesh.material = mat; return mesh;
}
export interface BackWorld { doors: TransformNode[]; exit: TransformNode; key: TransformNode; tasks: { root: TransformNode; light: StandardMaterial }[]; flicker: StandardMaterial; shadows: ShadowGenerator | null }
export function buildBackWorld(scene: Scene, maze: Maze, tasks: number[], puzzle: string, shadowBudget = false): BackWorld {
  const wall = surface(scene, 'agedWallpaper', 'wall'), floor = surface(scene, 'wornCarpet', 'carpet'), ceiling = surface(scene, 'acousticCeiling', 'ceiling');
  const trim = material(scene, 'skirting', '#393b28'), metal = material(scene, 'oldMetal', '#555849'), wood = material(scene, 'doorLaminate', '#53543c');
  const lit = material(scene, 'fluorescent', '#b9c78b'); lit.emissiveColor = new Color3(.5, .55, .32);
  const dim = material(scene, 'failedFluorescent', '#333e29'), darkFloor = material(scene, 'darkCarpet', '#6a6b47'); darkFloor.diffuseTexture = floor.diffuseTexture;
  darkFloor.diffuseColor = new Color3(.45, .47, .39);
  const sky = new HemisphericLight('backAmbient', new Vector3(0, 1, 0), scene); sky.intensity = .68; sky.groundColor = new Color3(.22, .22, .12);
  const sun = new DirectionalLight('backNeonBounce', new Vector3(.25, -1, .15), scene); sun.intensity = .32;
  const shadows = shadowBudget ? new ShadowGenerator(1024, sun) : null;
  if (shadows) { shadows.usePercentageCloserFiltering = true; shadows.bias = .003; shadows.darkness = .55; }
  // Spatial chunks reduce draw calls while retaining frustum and max-distance culling for each camera.
  const groups = new Map<string, Mesh[]>();
  function box(name: string, x: number, y: number, z: number, w: number, h: number, d: number, mat: StandardMaterial, cell: number) {
    const b = MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene); b.position.set(x, y, z); b.material = mat;
    const key = `${Math.floor((cell % maze.size) / 3)}:${Math.floor(Math.floor(cell / maze.size) / 3)}:${mat.name}`;
    const group = groups.get(key) ?? []; group.push(b); groups.set(key, group); return b;
  }
  const rng = new Rng(maze.seed);
  for (const cell of maze.cells) {
    const p = center(maze, cell), ns = neighbors(maze, cell), dark = maze.dark.has(cell);
    box('carpetModule', p.x, -.08, p.z, CELL, .16, CELL, dark ? darkFloor : floor, cell);
    box('ceilingModule', p.x, 2.94, p.z, CELL, .16, CELL, ceiling, cell);
    for (const [dx, dz, offset] of [[1, 0, 1], [-1, 0, -1], [0, 1, maze.size], [0, -1, -maze.size]]) if (!ns.includes(cell + offset)) {
      const x = p.x + dx * CELL / 2, z = p.z + dz * CELL / 2;
      box('wallPanel', x, 1.43, z, dx ? .16 : CELL + .16, 2.86, dz ? .16 : CELL + .16, wall, cell);
      box('wallSkirting', x - dx * .035, .09, z - dz * .035, dx ? .19 : CELL + .16, .18, dz ? .19 : CELL + .16, trim, cell);
      if (rng.chance(.15)) {
        const mesh = inscription(scene, 'roomPlate', `SECTOR ${rng.int(0, 9)}\n${rng.pick(['NO SIGNAL', 'SERVICE', 'RESTRICTED', 'LEVEL 00'])}`, .65, .32);
        mesh.position.set(x - dx * .105, 1.8, z - dz * .105); mesh.rotation.y = Math.atan2(dx, dz);
      }
    }
    if (cell % 3 === 0 || cell === maze.spawn) {
      box('neonHousing', p.x, 2.78, p.z, 1.4, .14, .38, metal, cell);
      box('neonDiffuser', p.x, 2.7, p.z, 1.25, .025, .28, dark ? dim : lit, cell);
    }
    if (cell % 7 === 0) { box('ceilingDuct', p.x, 2.7, p.z + 1.2, CELL, .16, .22, metal, cell); }
    if (ns.length <= 2 && cell % 11 === 0 && ![maze.exit, maze.spawn, maze.key, ...tasks, ...maze.refuges].includes(cell)) {
      const side = !ns.includes(cell - 1) ? -1 : !ns.includes(cell + 1) ? 1 : 0;
      if (side) { box('benchSeat', p.x + side * 1.2, .45, p.z, .5, .16, 1.65, wood, cell); box('benchBack', p.x + side * 1.42, .8, p.z, .12, .7, 1.65, wood, cell); }
    }
  }
  for (const [key, group] of groups) { const mesh = Mesh.MergeMeshes(group, true, true, undefined, false, false); if (mesh) { mesh.name = `backChunk:${key}`; mesh.receiveShadows = true; mesh.freezeWorldMatrix(); } }
  const doors = maze.doors.map((door, i) => {
    const p = center(maze, door.cell), root = new TransformNode(`passageDoor${i}`, scene); root.position.set(p.x - (door.horizontal ? 1.5 : 0), 0, p.z + (door.horizontal ? 0 : 1.5)); root.rotation.y = door.horizontal ? 0 : Math.PI / 2;
    const panel = MeshBuilder.CreateBox('hingedDoor', { width: CELL - .2, height: 2.63, depth: .12 }, scene); panel.parent = root; panel.position.set(1.5, 1.315, 0); panel.material = wood;
    const sign = inscription(scene, 'doorLabel', 'SERVICE\nKEEP CLOSED', .6, .3); sign.parent = root; sign.position.set(1.5, 1.85, -.08);
    const handle = MeshBuilder.CreateCylinder('doorHandle', { diameter: .045, height: .23, tessellation: 8 }, scene); handle.parent = root; handle.position.set(2.63, 1, -.13); handle.rotation.z = Math.PI / 2; handle.material = metal;
    return root;
  });
  const exit = new TransformNode('escapeDoor', scene); const ep = center(maze, maze.exit); exit.position.set(ep.x, 0, ep.z);
  const portal = MeshBuilder.CreateBox('exitPortal', { width: 1.5, height: 2.5, depth: .14 }, scene); portal.parent = exit; portal.position.set(0, 1.25, .65); portal.material = material(scene, 'exitDoorSteel', '#303b32');
  const exitSign = inscription(scene, 'exitSign', 'EXIT\n↑', 1.15, .45, '#223c2c'); exitSign.parent = exit; exitSign.position.set(0, 2.62, .55);
  const key = new TransformNode('brassKey', scene), gold = material(scene, 'keyBrass', '#ccb15f'); gold.specularColor = new Color3(.5, .45, .22);
  const ring = MeshBuilder.CreateTorus('keyBow', { diameter: .2, thickness: .04, tessellation: 16 }, scene); ring.parent = key; ring.material = gold;
  const stem = MeshBuilder.CreateCylinder('keyStem', { diameter: .035, height: .26, tessellation: 8 }, scene); stem.parent = key; stem.position.z = .2; stem.rotation.x = Math.PI / 2; stem.material = gold;
  for (let i = 0; i < 3; i++) { const tooth = MeshBuilder.CreateBox('keyTooth', { width: .09, height: .04, depth: .035 }, scene); tooth.parent = key; tooth.position.set(.04, 0, .22 + i * .035); tooth.material = gold; }
  const taskModels = tasks.map((cell, i) => {
    const root = new TransformNode(`electricalTask${i}`, scene), p = center(maze, cell); root.position.set(p.x, 0, p.z);
    const box = MeshBuilder.CreateBox('electricalCabinet', { width: puzzle === 'generators' ? 1.1 : .5, height: puzzle === 'generators' ? 1.25 : 1, depth: .38 }, scene); box.parent = root; box.position.set(0, .7, .5); box.material = metal;
    const plate = inscription(scene, 'panelLegend', puzzle === 'generators' ? `GENERATOR ${i + 1}\nHOLD TO RESTORE` : `CIRCUIT ${i + 1}\nPOWER`, .5, .25); plate.parent = root; plate.position.set(0, 1.15, .29);
    const lever = MeshBuilder.CreateCylinder('switchLever', { diameter: .08, height: .22, tessellation: 8 }, scene); lever.parent = root; lever.position.set(.13, .72, .23); lever.rotation.x = -.65; lever.material = wood;
    const light = material(scene, `taskLight${i}`, '#6f241b'); light.emissiveColor = new Color3(.35, .02, 0);
    const lamp = MeshBuilder.CreateSphere('taskIndicator', { diameter: .11, segments: 8 }, scene); lamp.parent = root; lamp.position.set(-.13, .9, .24); lamp.material = light;
    return { root, light };
  });
  for (const cell of maze.refuges) {
    const p = center(maze, cell), cabinet = MeshBuilder.CreateBox('hidingLocker', { width: .95, height: 2.15, depth: .8 }, scene); cabinet.position.set(p.x + .9, 1.075, p.z + .8); cabinet.material = wood;
    const vent = inscription(scene, 'lockerVent', '||||||||\n||||||||', .6, .25); vent.position.set(p.x + .9, 1.68, p.z + .38);
  }
  const start = center(maze, maze.spawn), poster = inscription(scene, 'spawnInstructions', 'DO NOT RUN\nLISTEN. HIDE.\nFIND THE LAST DOOR', 1.35, .75); poster.position.set(start.x, 1.7, start.z - 1.47);
  // Cartelli, arredi e strutture sono immobili; porte e chiave restano animabili.
  const moving=new Set([...doors.flatMap(root=>root.getChildMeshes()),...key.getChildMeshes()]);
  for(const mesh of scene.meshes)if(!moving.has(mesh))mesh.freezeWorldMatrix();
  return { doors, exit, key, tasks: taskModels, flicker: lit, shadows };
}

export interface CreatureVisual { root: TransformNode; joints: TransformNode[]; head: TransformNode; jaw: Mesh; update(time: number, chasing: boolean, watch: boolean): void }
/** Articulated original creature direction: elongated anatomy, exposed jaw, tendons and jointed hands. */
export function createCreature(scene: Scene, kind: CreatureKind): CreatureVisual {
  const root = new TransformNode(`creature:${kind}`, scene), skin = material(scene, `${kind}Skin`, kind === 'runner' ? '#56574f' : '#41463c'), bone = material(scene, `${kind}Bone`, '#a29c80'), mouth = material(scene, `${kind}Mouth`, '#17130f');
  const grain = new DynamicTexture(`${kind}SkinGrain`, 128, scene, false), paint = grain.getContext() as CanvasRenderingContext2D, rng = new Rng(kind.length * 8821);
  paint.fillStyle = '#adad9b'; paint.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 1800; i++) { paint.fillStyle = `rgba(30,30,20,${rng.next() * .35})`; paint.fillRect(rng.int(0, 127), rng.int(0, 127), 2, rng.int(1, 6)); }
  grain.update(); skin.diffuseTexture = grain; bone.diffuseTexture = grain; bone.diffuseColor = new Color3(.58, .55, .43);
  const eye = material(scene, `${kind}Eyes`, '#6f7467'); eye.emissiveColor = new Color3(.24, .28, .19);
  const sphere = (name: string, parent: TransformNode, x: number, y: number, z: number, sx: number, sy: number, sz: number, mat = skin) => {
    const b = MeshBuilder.CreateSphere(name, { diameter: 1, segments: 12 }, scene); b.parent = parent; b.position.set(x, y, z); b.scaling.set(sx, sy, sz); b.material = mat; return b;
  };
  sphere('sunkenRibcage', root, 0, 1.66, 0, .38, .8, .23); sphere('pelvis', root, 0, 1.1, 0, .28, .29, .2);
  for (let i = 0; i < 7; i++) {
    const rib = MeshBuilder.CreateTorus('exposedRib', { diameter: .28 + Math.sin(i / 7 * Math.PI) * .14, thickness: .025, tessellation: 12 }, scene); rib.parent = root; rib.position.set(0, 1.37 + i * .08, .03); rib.scaling.z = .65; rib.material = bone;
  }
  const neck = sphere('neckTendon', root, 0, 2.14, -.04, .13, .29, .12);
  const head = new TransformNode('tiltedHead', scene); head.parent = root; head.position.set(0, 2.33, -.025);
  sphere('cranium', head, 0, .1, 0, .3, .43, .24); sphere('sunkenFace', head, 0, -.025, .12, .22, .22, .08, bone);
  const cavity = sphere('mouthCavity', head, 0, -.13, .155, .13, .16, .045, mouth);
  const jaw = sphere('detachedJaw', head, 0, -.2, .14, .21, .08, .12, bone);
  for (const side of [-1, 1]) { sphere('eyeSocket', head, side * .066, .045, .12, .078, .049, .045, mouth); sphere('pinpointEye', head, side * .066, .045, .144, .007, .009, .006, eye); }
  for (let i = 0; i < 6; i++) {
    const tooth = MeshBuilder.CreateCylinder('upperFang', { diameterTop: .017, diameterBottom: 0, height: .045 + (i % 3) * .008, tessellation: 5 }, scene); tooth.parent = head; tooth.position.set((i - 2.5) * .022, -.083, .178); tooth.material = bone;
    const lower = MeshBuilder.CreateCylinder('lowerFang', { diameterTop: 0, diameterBottom: .016, height: .046, tessellation: 5 }, scene); lower.parent = jaw; lower.position.set((i - 2.5) * .021, .042, .035); lower.material = bone;
  }
  const joints: TransformNode[] = [];
  for (const side of [-1, 1]) {
    const arm = new TransformNode('longArm', scene); arm.parent = root; arm.position.set(side * .25, 1.99, 0); arm.rotation.z = side * .12;
    sphere('upperArm', arm, 0, -.33, 0, .1, .69, .09); sphere('elbow', arm, 0, -.7, 0, .12, .12, .12, bone);
    const forearm = new TransformNode('forearm', scene); forearm.parent = arm; forearm.position.y = -.72; forearm.rotation.x = -.15;
    sphere('forearmTendon', forearm, 0, -.32, 0, .08, .68, .09); sphere('hand', forearm, 0, -.73, 0, .13, .22, .065);
    for (let f = 0; f < 4; f++) { sphere('longFinger', forearm, (f - 1.5) * .033, -.96 + Math.abs(f - 1.5) * .035, .025, .025, .3, .028, bone); }
    joints.push(arm);
    const leg = new TransformNode('leg', scene); leg.parent = root; leg.position.set(side * .13, 1.12, 0);
    sphere('thigh', leg, 0, -.27, 0, .15, .58, .14); sphere('kneecap', leg, 0, -.57, .05, .12, .12, .12, bone); sphere('shin', leg, 0, -.85, -.03, .075, .6, .085); sphere('foot', leg, 0, -1.07, .1, .13, .11, .32); joints.push(leg);
  }
  if (kind === 'runner') { root.scaling.set(.9, .86, .95); neck.rotation.x = .35; }
  return { root, head, jaw, joints, update(time, chasing, watch) {
    const stride = watch ? 0 : Math.sin(time * (chasing ? 10 : 3)); joints.forEach((joint, i) => joint.rotation.x = stride * (i % 2 ? .48 : .22) * (i < 2 ? 1 : -1));
    head.rotation.z = .16 + Math.sin(time * .6) * .1; head.rotation.x = chasing ? -.2 : .1;
    jaw.position.y = -.2 - (chasing ? .1 + Math.sin(time * 17) * .025 : .015); root.position.y = Math.sin(time * 2) * .018;
    cavity.scaling.y = chasing ? .2 : .12;
  } };
}
