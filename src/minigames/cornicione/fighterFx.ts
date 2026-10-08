import { Color3, DynamicTexture, Engine, Mesh, MeshBuilder, Scene, StandardMaterial } from '@babylonjs/core';

/**
 * EFFETTI DEL PLATFORM FIGHTER (solo grafica, pool fissi: nessuna allocazione durante la partita). Rivolti alla camera (la scena e'
 * vista di lato), piccoli e brevi per non coprire cinque personaggi: scintilla d'impatto, anello, scia (colpo/KO), segnale a terra.
 * Non toccano il gameplay: il gioco chiama spark/ring/slash/marker dopo aver gia' deciso cosa e' successo.
 */

type Kind = 'spark' | 'ring' | 'slash';
interface Item {
  mesh: Mesh;
  mat: StandardMaterial;
  t: number;
  dur: number;
  size: number;
  kind: Kind;
  rot: number;
  stretch: number;
}

const FRONT_Z = -0.9;

function tex(scene: Scene, name: string, draw: (c: CanvasRenderingContext2D, s: number) => void, w = 128, h = 128): DynamicTexture {
  const t = new DynamicTexture(name, { width: w, height: h }, scene, false);
  t.hasAlpha = true;
  const c = t.getContext() as unknown as CanvasRenderingContext2D;
  c.clearRect(0, 0, w, h);
  draw(c, w);
  t.update();
  return t;
}

export class FighterFx {
  private items: Item[] = [];
  private markers = new Map<string, { mesh: Mesh; mat: StandardMaterial; on: boolean }>();
  private textures: DynamicTexture[] = [];
  private tSpark: DynamicTexture;
  private tRing: DynamicTexture;
  private tSlash: DynamicTexture;
  private tMarker: DynamicTexture;

  constructor(private scene: Scene, count = 22) {
    this.tSpark = tex(scene, 'fxSpark', (c, s) => {
      c.translate(s / 2, s / 2);
      c.fillStyle = '#ffffff';
      c.beginPath();
      for (let i = 0; i < 16; i++) {
        const r = i % 2 === 0 ? s * 0.48 : s * 0.14;
        const a = (i / 16) * Math.PI * 2;
        c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      c.closePath();
      c.fill();
    });
    this.tRing = tex(scene, 'fxRing', (c, s) => {
      c.strokeStyle = '#ffffff';
      c.lineWidth = s * 0.07;
      c.beginPath();
      c.arc(s / 2, s / 2, s * 0.42, 0, Math.PI * 2);
      c.stroke();
    });
    this.tSlash = tex(
      scene,
      'fxSlash',
      (c, s) => {
        const g = c.createLinearGradient(0, 0, s, 0);
        g.addColorStop(0, 'rgba(255,255,255,0)');
        g.addColorStop(0.7, 'rgba(255,255,255,0.9)');
        g.addColorStop(1, 'rgba(255,255,255,1)');
        c.fillStyle = g;
        c.beginPath();
        c.moveTo(0, s * 0.5);
        c.lineTo(s, s * 0.2);
        c.lineTo(s, s * 0.8);
        c.closePath();
        c.fill();
      },
      256,
      64
    );
    this.tMarker = tex(scene, 'fxMarker', (c, s) => {
      c.strokeStyle = '#ffffff';
      c.lineWidth = s * 0.06;
      c.setLineDash([s * 0.09, s * 0.07]);
      c.beginPath();
      c.arc(s / 2, s / 2, s * 0.4, 0, Math.PI * 2);
      c.stroke();
      c.setLineDash([]);
      c.fillStyle = 'rgba(255,255,255,0.5)';
      c.beginPath();
      c.arc(s / 2, s / 2, s * 0.08, 0, Math.PI * 2);
      c.fill();
    });
    this.textures.push(this.tSpark, this.tRing, this.tSlash, this.tMarker);
    for (let i = 0; i < count; i++) this.items.push(this.makeItem());
  }

  private makeMat(t: DynamicTexture, name: string): StandardMaterial {
    const m = new StandardMaterial(name, this.scene);
    m.disableLighting = true;
    m.emissiveTexture = t;
    m.opacityTexture = t;
    m.diffuseColor = Color3.Black();
    m.emissiveColor = Color3.White(); // moltiplicata dalla texture
    m.backFaceCulling = false;
    m.alphaMode = Engine.ALPHA_ADD;
    m.fogEnabled = false;
    return m;
  }

  private makeItem(): Item {
    const mesh = MeshBuilder.CreatePlane('fxItem', { size: 1 }, this.scene);
    mesh.isPickable = false;
    mesh.isVisible = false;
    const mat = this.makeMat(this.tSpark, 'fxItemMat');
    mesh.material = mat;
    return { mesh, mat, t: 1, dur: 1, size: 1, kind: 'spark', rot: 0, stretch: 1 };
  }

  private take(): Item {
    return this.items.find((i) => i.t >= i.dur) ?? this.items.reduce((a, b) => (a.t / a.dur > b.t / b.dur ? a : b));
  }

  private start(kind: Kind, x: number, y: number, color: string, size: number, dur: number, rot = 0, stretch = 1): void {
    const it = this.take();
    it.kind = kind;
    it.t = 0;
    it.dur = dur;
    it.size = size;
    it.rot = rot;
    it.stretch = stretch;
    const t = kind === 'spark' ? this.tSpark : kind === 'ring' ? this.tRing : this.tSlash;
    it.mat.emissiveTexture = t;
    it.mat.opacityTexture = t;
    const c = Color3.FromHexString(color);
    // mescolato con il bianco: si legge anche con i colori scuri
    it.mat.emissiveColor.set(0.35 + c.r * 0.65, 0.35 + c.g * 0.65, 0.35 + c.b * 0.65);
    it.mesh.position.set(x, y, FRONT_Z);
    it.mesh.rotation.z = rot;
    it.mesh.isVisible = true;
    it.mesh.visibility = 1;
  }

  /** Scintilla d'impatto (colpo). */
  spark(x: number, y: number, color: string, size = 1.4): void {
    this.start('spark', x, y, color, size, 0.22, Math.random() * Math.PI);
  }

  /** Anello che si allarga (atterraggio, respawn, abilita'). */
  ring(x: number, y: number, color: string, size = 2): void {
    this.start('ring', x, y, color, size, 0.38);
  }

  /** Scia direzionale (lancio, KO): da (x,y) verso la direzione `angle` (rad), lunga `len`. */
  slash(x: number, y: number, angle: number, len: number, color: string): void {
    this.start('slash', x + (Math.cos(angle) * len) / 2, y + (Math.sin(angle) * len) / 2, color, len, 0.3, angle, 0.5);
  }

  /** Segnale fisso a terra/in aria (ritorno del Buttafuori): resta finche' non lo spegni. */
  marker(id: string, on: boolean, x = 0, y = 0, color = '#ffffff'): void {
    let m = this.markers.get(id);
    if (!m) {
      const mesh = MeshBuilder.CreatePlane('fxMarker', { size: 2.6 }, this.scene);
      mesh.isPickable = false;
      mesh.isVisible = false;
      const mat = this.makeMat(this.tMarker, 'fxMarkerMat');
      mesh.material = mat;
      m = { mesh, mat, on: false };
      this.markers.set(id, m);
    }
    m.on = on;
    m.mesh.isVisible = on;
    if (on) {
      const c = Color3.FromHexString(color);
      m.mat.emissiveColor.set(0.4 + c.r * 0.6, 0.4 + c.g * 0.6, 0.4 + c.b * 0.6);
      m.mesh.position.set(x, y + 1.15, FRONT_Z);
    }
  }

  update(dt: number, now: number): void {
    for (const it of this.items) {
      if (it.t >= it.dur) {
        if (it.mesh.isVisible) it.mesh.isVisible = false;
        continue;
      }
      it.t += dt;
      const k = Math.min(1, it.t / it.dur);
      if (it.kind === 'spark') {
        const s = it.size * (0.5 + k * 0.7);
        it.mesh.scaling.set(s, s, 1);
      } else if (it.kind === 'ring') {
        const s = it.size * (0.35 + k * 1.1);
        it.mesh.scaling.set(s, s, 1);
      } else {
        it.mesh.scaling.set(it.size * (0.6 + 0.4 * k), it.stretch * (1 - k * 0.6), 1);
      }
      it.mesh.visibility = 1 - k * k;
    }
    for (const m of this.markers.values()) {
      if (!m.on) continue;
      const k = 1 + Math.sin(now * 0.02) * 0.12;
      m.mesh.scaling.set(k, k, 1);
      m.mesh.rotation.z = now * 0.003;
    }
  }

  dispose(): void {
    for (const it of this.items) {
      it.mesh.dispose(false, true);
      it.mat.dispose();
    }
    for (const m of this.markers.values()) {
      m.mesh.dispose(false, true);
      m.mat.dispose();
    }
    this.markers.clear();
    for (const t of this.textures) t.dispose();
    this.items = [];
  }
}
