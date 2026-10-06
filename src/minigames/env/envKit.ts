import {
  Color3,
  Color4,
  DirectionalLight,
  DynamicTexture,
  GlowLayer,
  HemisphericLight,
  Material,
  Matrix,
  Mesh,
  MeshBuilder,
  Quaternion,
  StandardMaterial,
  Texture,
  Vector3
} from '@babylonjs/core';
import type { AbstractMesh, Scene } from '@babylonjs/core';
import { getQualityLevel } from '../../core/quality';
import type { QualityLevel } from '../../core/quality';

/**
 * KIT AMBIENTI — l'Art Bible (docs/ART_BIBLE.md) in codice. UN solo kit per tutti i giochi 3D (host e telefono):
 *  - PAL: famiglie di materiali e colori comuni (niente colori giocatore su grandi superfici)
 *  - lightRig: key + fill (+ rim su MEDIUM/HIGH), stessa grammatica ovunque
 *  - sky / clouds / skyline: cielo a gradiente, nuvole "a cartoncino" e profilo lontano, tutto economico
 *  - sign: una sola famiglia di cartelli (un font, quattro stili), texture in cache per testo
 *  - crowd: folla a sagome (thin instances, tre gruppi che si muovono insieme)
 *  - thin / merge / freeze: tutto cio' che si ripete e' istanziato, tutto cio' che e' fermo e' congelato
 * Solo grafica: nessuna mesh del kit e' collidibile o selezionabile, nessuna tocca gameplay o camera.
 * Il modulo NON importa nulla dell'host (lo usa anche il telefono nella Sparatoria).
 */

export const PAL = {
  // famiglie di materiali (toni medi, desaturati: il colore forte resta ai giocatori)
  concrete: '#b3ada3',
  concreteDark: '#77716a',
  metal: '#8a93a3',
  metalDark: '#4b5262',
  metalPaint: '#5f7d8e',
  wood: '#b98552',
  woodDark: '#7d5534',
  sand: '#ecd29a',
  sandDark: '#d4b373',
  grass: '#4f9a52',
  grassDark: '#428a48',
  turf: '#3f915a',
  turfDark: '#367f4e',
  plastic: '#8fb8b0',
  plasticB: '#c3a6c2',
  plasticC: '#e0b48c',
  water: '#2f8fb5',
  waterLight: '#86d8ea',
  asphalt: '#4d5059',
  paint: '#f3efe4',
  night: '#151a29',
  // accenti (piccoli!)
  neonPink: '#ff5fb0',
  neonCyan: '#4fe3ff',
  neonAmber: '#ffc54d',
  neonLime: '#b8f04f',
  hazard: '#f5c518',
  hazardDark: '#1d1d22',
  // folla: vestiti "veri", mai colori puri
  crowd: ['#4a5a78', '#7a6a5a', '#8a8f99', '#5d4a5e', '#6b7d6a', '#9a7b5f', '#3f4656', '#7e5a5a', '#a39a8a', '#56657a']
} as const;

/** Font unico dei cartelli (lo stesso dei titoli dell'host). */
export const SIGN_FONT = '"Arial Black", Arial, sans-serif';

export type SignStyle = 'neon' | 'board' | 'hazard' | 'poster';

export interface Xf {
  x: number;
  y: number;
  z: number;
  rx?: number;
  ry?: number;
  rz?: number;
  s?: number;
  sx?: number;
  sy?: number;
  sz?: number;
}

export interface LightPreset {
  /** direzione della key light (verso cui punta) */
  key: [number, number, number];
  keyColor: string;
  keyI: number;
  /** fill emisferica: cielo / terra */
  sky: string;
  ground: string;
  fillI: number;
  /** controluce / accento (solo MEDIUM/HIGH) */
  rim?: { dir: [number, number, number]; color: string; i: number };
}

export interface SignOpts {
  style?: SignStyle;
  color?: string;
  /** testo piccolo sotto (facoltativo) */
  sub?: string;
  w?: number;
  h?: number;
  x?: number;
  y?: number;
  z?: number;
  ry?: number;
  /** pannello visibile da entrambi i lati */
  twoSided?: boolean;
  billboard?: boolean;
  /** board/poster: colore di fondo */
  bg?: string;
}

/** Mescola due colori esadecimali (t=0 → a, t=1 → b). */
export function mixHex(a: string, b: string, t: number): string {
  const ca = Color3.FromHexString(a);
  const cb = Color3.FromHexString(b);
  return Color3.Lerp(ca, cb, t).toHexString();
}

/** Generatore pseudo-casuale deterministico (stesso ambiente a ogni partita: niente Math.random nel decor). */
export function seeded(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Disegna un cartello della famiglia unica (un font, quattro stili) nel rettangolo W x H del canvas. */
export function paintSign(c: CanvasRenderingContext2D, W: number, H: number, text: string, style: SignStyle, color: string, bg: string, sub?: string): void {
  const r = Math.min(28, H * 0.18);
  c.fillStyle = bg;
  c.beginPath();
  c.roundRect(4, 4, W - 8, H - 8, r);
  c.fill();
  if (style === 'hazard') {
    c.save();
    c.beginPath();
    c.roundRect(4, 4, W - 8, H - 8, r);
    c.clip();
    c.fillStyle = PAL.hazardDark;
    const band = Math.max(10, H * 0.14);
    for (let x = -H; x < W + H; x += 36) {
      for (const y0 of [0, H - band]) {
        c.beginPath();
        c.moveTo(x, y0 + band);
        c.lineTo(x + 18, y0 + band);
        c.lineTo(x + 18 + band, y0);
        c.lineTo(x + band, y0);
        c.closePath();
        c.fill();
      }
    }
    c.restore();
  } else {
    c.strokeStyle = style === 'neon' ? color : style === 'poster' ? color : '#2a2f3b';
    c.lineWidth = style === 'neon' ? 10 : 8;
    c.beginPath();
    c.roundRect(10, 10, W - 20, H - 20, Math.max(4, r - 6));
    c.stroke();
    if (style === 'poster') {
      c.fillStyle = color;
      c.fillRect(10, 10, W - 20, Math.max(10, H * 0.1));
    }
  }
  c.fillStyle = style === 'neon' ? color : style === 'hazard' ? PAL.hazardDark : color;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  const lines = text.split('\n');
  const subN = sub ? 1 : 0;
  const usable = H * (style === 'hazard' ? 0.62 : 0.74);
  let size = Math.min(150, usable / (lines.length + subN * 0.6));
  c.font = `900 ${size}px ${SIGN_FONT}`;
  const widest = Math.max(...lines.map((l) => c.measureText(l).width));
  if (widest > W * 0.88) size *= (W * 0.88) / widest;
  c.font = `900 ${size}px ${SIGN_FONT}`;
  const total = size * lines.length + (subN ? size * 0.55 : 0);
  let y = H / 2 - total / 2 + size / 2;
  for (const l of lines) {
    c.fillText(l, W / 2, y);
    y += size;
  }
  if (sub) {
    c.font = `700 ${size * 0.42}px ${SIGN_FONT}`;
    c.fillText(sub, W / 2, y - size * 0.2);
  }
}

export class EnvKit {
  readonly q: QualityLevel;
  private mats = new Map<string, StandardMaterial>();
  private texs = new Map<string, DynamicTexture>();
  private noGlow: AbstractMesh[] = [];
  private glowLayer: GlowLayer | null = null;
  private frameFns: ((t: number) => void)[] = [];
  private frameObs = false;

  constructor(readonly scene: Scene, quality: QualityLevel = getQualityLevel()) {
    this.q = quality;
    // serve al riempimento delle ombre dei materiali con texture (vedi mat()); i materiali che non usano ambientColor
    // (nero di default: personaggi, effetti) non cambiano
    scene.ambientColor = Color3.White();
  }

  /** Dettaglio: LOW = essenziale, MEDIUM = pieno, HIGH = extra. Per densita' (folla, props minori), mai per la geometria di gioco. */
  density(low: number, medium: number, high: number): number {
    return this.q === 'low' ? low : this.q === 'medium' ? medium : high;
  }

  // ---------------------------------------------------------------- materiali

  /** Materiale condiviso (cache per chiave). `emissive` = quota del proprio colore che resta visibile in ombra. */
  mat(hex: string, opts: { emissive?: number; spec?: number; alpha?: number; unlit?: boolean; dynamic?: boolean; tex?: Texture; key?: string; twoSided?: boolean; cutout?: boolean } = {}): StandardMaterial {
    const key = opts.key ?? `${hex}|${opts.emissive ?? 0}|${opts.spec ?? 0.04}|${opts.alpha ?? 1}|${opts.unlit ? 1 : 0}|${opts.tex?.name ?? ''}|${opts.twoSided ? 1 : 0}|${opts.cutout ? 1 : 0}`;
    const hit = this.mats.get(key);
    if (hit && !opts.dynamic) return hit;
    const m = new StandardMaterial(`env_${key}`, this.scene);
    const c = Color3.FromHexString(hex);
    if (opts.unlit) {
      m.disableLighting = true;
      m.diffuseColor = Color3.Black();
      // ATTENZIONE: in Babylon la texture emissiva si SOMMA al colore emissivo (bianco + texture = bianco pieno):
      // con una texture il colore emissivo resta nero e decide solo la texture
      m.emissiveColor = opts.tex ? Color3.Black() : c;
      if (opts.tex) m.emissiveTexture = opts.tex;
    } else {
      m.diffuseColor = c;
      m.specularColor = new Color3(opts.spec ?? 0.04, opts.spec ?? 0.04, opts.spec ?? 0.04);
      if (opts.tex) {
        m.diffuseTexture = opts.tex;
        // con una texture il colore EMISSIVO schiarisce tutta la superficie (verificato: una parete scura diventava lilla):
        // il "riempimento delle ombre" passa dal colore AMBIENTALE, che viene moltiplicato per la texture
        if (opts.emissive) m.ambientColor = new Color3(opts.emissive, opts.emissive, opts.emissive);
      } else if (opts.emissive) m.emissiveColor = c.scale(opts.emissive);
    }
    if (opts.alpha !== undefined && opts.alpha < 1) m.alpha = opts.alpha;
    if (opts.twoSided) m.backFaceCulling = false;
    if (opts.cutout && opts.tex) {
      // ritaglio netto (angoli arrotondati dei cartelli, sagome): alpha test, nessun ordinamento
      opts.tex.hasAlpha = true;
      m.opacityTexture = opts.tex;
      m.transparencyMode = Material.MATERIAL_ALPHATEST;
      m.alphaCutOff = 0.5;
    }
    if (!opts.dynamic) {
      m.freeze();
      this.mats.set(key, m);
    }
    return m;
  }

  /** Neon / luce: non illuminato, colore pieno (unico tipo che il bagliore fa brillare). */
  neon(hex: string, dynamic = false): StandardMaterial {
    return this.mat(hex, { unlit: true, dynamic });
  }

  /** Texture disegnata una volta (cache per chiave). */
  texture(key: string, w: number, h: number, draw: (c: CanvasRenderingContext2D, w: number, h: number) => void, opts: { alpha?: boolean; wrap?: boolean; mips?: boolean } = {}): DynamicTexture {
    const hit = this.texs.get(key);
    if (hit) return hit;
    const t = new DynamicTexture(`envTex_${key}`, { width: w, height: h }, this.scene, opts.mips ?? true);
    const c = t.getContext() as unknown as CanvasRenderingContext2D;
    if (opts.alpha) c.clearRect(0, 0, w, h);
    draw(c, w, h);
    t.update();
    t.hasAlpha = !!opts.alpha;
    if (opts.wrap) {
      t.wrapU = Texture.WRAP_ADDRESSMODE;
      t.wrapV = Texture.WRAP_ADDRESSMODE;
    } else {
      t.wrapU = Texture.CLAMP_ADDRESSMODE;
      t.wrapV = Texture.CLAMP_ADDRESSMODE;
    }
    this.texs.set(key, t);
    return t;
  }

  // ---------------------------------------------------------------- mesh

  /** Mesh statica: non selezionabile, matrice congelata, mai collidibile. */
  freeze<T extends AbstractMesh>(m: T): T {
    m.isPickable = false;
    m.checkCollisions = false;
    m.freezeWorldMatrix();
    m.doNotSyncBoundingInfo = true;
    return m;
  }

  box(name: string, w: number, h: number, d: number, at: Xf, mat: Material): Mesh {
    const m = MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, this.scene);
    this.place(m, at);
    m.material = mat;
    return m;
  }

  cyl(name: string, dTop: number, dBot: number, h: number, at: Xf, mat: Material, tess = 8): Mesh {
    const m = MeshBuilder.CreateCylinder(name, { diameterTop: dTop, diameterBottom: dBot, height: h, tessellation: tess }, this.scene);
    this.place(m, at);
    m.material = mat;
    return m;
  }

  place(m: AbstractMesh, at: Xf): void {
    m.position.set(at.x, at.y, at.z);
    m.rotation.set(at.rx ?? 0, at.ry ?? 0, at.rz ?? 0);
    const s = at.s ?? 1;
    m.scaling.set(at.sx ?? s, at.sy ?? s, at.sz ?? s);
  }

  /** Fonde mesh statiche con lo STESSO materiale in una sola draw call. */
  merge(name: string, list: Mesh[], mat?: Material): Mesh | null {
    if (list.length === 0) return null;
    const material = mat ?? list[0].material ?? undefined;
    const merged = list.length === 1 ? list[0] : Mesh.MergeMeshes(list, true, true, undefined, false, false);
    if (!merged) return null;
    merged.name = name;
    if (material) merged.material = material;
    return this.freeze(merged);
  }

  /**
   * Thin instances: N copie di `template` in UNA draw call (posizione/rotazione/scala per copia, colore facoltativo).
   * Il template diventa la mesh delle copie: non va posizionato.
   */
  thin(template: Mesh, items: Xf[], colors?: string[]): Mesh {
    const n = items.length;
    if (n === 0) {
      template.setEnabled(false);
      return template;
    }
    const buf = new Float32Array(16 * n);
    const m = new Matrix();
    const q = new Quaternion();
    const s = new Vector3();
    const p = new Vector3();
    items.forEach((it, i) => {
      Quaternion.FromEulerAnglesToRef(it.rx ?? 0, it.ry ?? 0, it.rz ?? 0, q);
      const k = it.s ?? 1;
      s.set(it.sx ?? k, it.sy ?? k, it.sz ?? k);
      p.set(it.x, it.y, it.z);
      Matrix.ComposeToRef(s, q, p, m);
      m.copyToArray(buf, i * 16);
    });
    template.thinInstanceSetBuffer('matrix', buf, 16, true);
    if (colors) {
      const cb = new Float32Array(4 * n);
      for (let i = 0; i < n; i++) {
        const c = Color3.FromHexString(colors[i % colors.length]);
        cb.set([c.r, c.g, c.b, 1], i * 4);
      }
      template.thinInstanceSetBuffer('color', cb, 4, true);
    }
    template.thinInstanceRefreshBoundingInfo(false);
    template.isPickable = false;
    template.checkCollisions = false;
    return template;
  }

  // ---------------------------------------------------------------- luce

  /** Key + fill (+ rim su MEDIUM/HIGH). Il fill non scende mai sotto 0.45: niente ombre nere sui personaggi. */
  lightRig(p: LightPreset): { hemi: HemisphericLight; sun: DirectionalLight; rim: DirectionalLight | null } {
    const hemi = new HemisphericLight('hemi', new Vector3(0.1, 1, 0.1), this.scene);
    hemi.intensity = Math.max(0.45, p.fillI);
    hemi.diffuse = Color3.FromHexString(p.sky);
    hemi.groundColor = Color3.FromHexString(p.ground);
    hemi.specular = new Color3(0.15, 0.15, 0.15);
    const sun = new DirectionalLight('sun', new Vector3(...p.key), this.scene);
    sun.intensity = p.keyI;
    sun.diffuse = Color3.FromHexString(p.keyColor);
    sun.position = new Vector3(-p.key[0] * 120, -p.key[1] * 120, -p.key[2] * 120);
    let rim: DirectionalLight | null = null;
    if (p.rim && this.q !== 'low') {
      rim = new DirectionalLight('rim', new Vector3(...p.rim.dir), this.scene);
      rim.intensity = p.rim.i;
      rim.diffuse = Color3.FromHexString(p.rim.color);
      rim.specular = Color3.Black();
    }
    return { hemi, sun, rim };
  }

  /** Bagliore SOLO per neon e luci (HIGH; i preset di qualita' lo spengono altrove). Cielo, nuvole e profili esclusi. */
  glow(intensity = 0.55): GlowLayer {
    const g = new GlowLayer('glow', this.scene, { mainTextureRatio: 0.5 });
    g.intensity = intensity;
    for (const m of this.noGlow) g.addExcludedMesh(m as Mesh);
    this.glowLayer = g;
    return g;
  }

  excludeFromGlow(m: AbstractMesh): void {
    this.noGlow.push(m);
    this.glowLayer?.addExcludedMesh(m as Mesh);
  }

  // ---------------------------------------------------------------- cielo

  /** Cupola a gradiente (stops dall'alto verso l'orizzonte). Esclusa dal bagliore e dalla nebbia. */
  sky(stops: [number, string][], diameter = 900): Mesh {
    const dome = MeshBuilder.CreateSphere('skyDome', { diameter, segments: 12, sideOrientation: Mesh.BACKSIDE }, this.scene);
    dome.infiniteDistance = true;
    const tex = this.texture(`sky_${stops.map((s) => s.join(':')).join('_')}`, 4, 256, (c) => {
      const g = c.createLinearGradient(0, 0, 0, 256);
      for (const [t, col] of stops) g.addColorStop(t, col);
      c.fillStyle = g;
      c.fillRect(0, 0, 4, 256);
    }, { mips: false });
    const m = new StandardMaterial('skyMat', this.scene);
    m.emissiveTexture = tex;
    m.diffuseColor = Color3.Black();
    m.disableLighting = true;
    m.backFaceCulling = false;
    m.fogEnabled = false;
    m.freeze();
    dome.material = m;
    this.excludeFromGlow(dome);
    return this.freeze(dome);
  }

  /** Nuvole "a cartoncino": piani con bordo netto (alpha test, nessun ordinamento), UNA draw call. */
  clouds(opts: { count: number; radius: number; yMin: number; yMax: number; tint?: string; size?: number; arc?: [number, number]; seed?: number; center?: [number, number] }): Mesh {
    const tint = opts.tint ?? '#ffffff';
    const tex = this.texture(`cloudCard_${tint}`, 256, 128, (c) => {
      // sbuffi con volume: alto bianco, pancia azzurro-grigia, base piatta (nuvola da cartone, non un ritaglio piatto)
      const puffs: [number, number, number][] = [[46, 92, 26], [84, 70, 38], [130, 56, 48], [176, 70, 38], [212, 90, 26], [130, 92, 36]];
      for (const [x, y, r] of puffs) {
        const g = c.createLinearGradient(0, y - r, 0, y + r);
        g.addColorStop(0, mixHex('#ffffff', tint, 0.35));
        g.addColorStop(0.55, mixHex('#f1f5fb', tint, 0.5));
        g.addColorStop(1, mixHex('#b4c1d9', tint, 0.45));
        c.fillStyle = g;
        c.beginPath();
        c.arc(x, y, r, 0, Math.PI * 2);
        c.fill();
      }
      c.fillStyle = mixHex('#b9c5dc', tint, 0.45);
      c.fillRect(24, 100, 208, 14);
    }, { alpha: true });
    const m = new StandardMaterial('cloudMat', this.scene);
    m.emissiveColor = Color3.Black(); // decide la texture (gia' tinta): vedi mat()
    m.diffuseColor = Color3.Black();
    m.opacityTexture = tex;
    m.emissiveTexture = tex;
    m.disableLighting = true;
    m.backFaceCulling = false;
    m.fogEnabled = false;
    m.transparencyMode = Material.MATERIAL_ALPHATEST;
    m.alphaCutOff = 0.5;
    m.freeze();
    const plane = MeshBuilder.CreatePlane('clouds', { width: 2, height: 1 }, this.scene);
    plane.material = m;
    const rnd = seeded(opts.seed ?? 7);
    const [a0, a1] = opts.arc ?? [0, Math.PI * 2];
    const [cx, cz] = opts.center ?? [0, 0];
    const size = opts.size ?? 40;
    const items: Xf[] = [];
    for (let i = 0; i < opts.count; i++) {
      const a = a0 + ((i + rnd() * 0.8) / opts.count) * (a1 - a0);
      const r = opts.radius * (0.85 + rnd() * 0.3);
      const k = size * (0.6 + rnd() * 0.8);
      // angoli "matematici" (x = cos, z = sin) come skyline(); il piano guarda il centro
      items.push({ x: cx + Math.cos(a) * r, y: opts.yMin + rnd() * (opts.yMax - opts.yMin), z: cz + Math.sin(a) * r, ry: Math.PI / 2 - a, sx: k, sy: k * (0.9 + rnd() * 0.3) });
    }
    this.excludeFromGlow(plane);
    return this.thin(plane, items);
  }

  /**
   * Profilo lontano (skyline, colline, gru, palme) su un anello: UNA mesh, un materiale piatto non illuminato.
   * Il colore e' quello dell'aria lontana (prospettiva aerea): staccato dal primo piano, mai nero.
   */
  skyline(opts: { radius: number; height: number; y?: number; color: string; kind: 'city' | 'coast' | 'industrial' | 'hills' | 'arena'; seed?: number; arc?: [number, number]; center?: [number, number] }): Mesh {
    const key = `skyline_${opts.kind}_${opts.seed ?? 1}`;
    const tex = this.texture(key, 1024, 128, (c, w, h) => {
      const rnd = seeded(opts.seed ?? 1);
      c.fillStyle = '#ffffff';
      let x = 0;
      while (x < w) {
        if (opts.kind === 'hills') {
          const r = 60 + rnd() * 120;
          c.beginPath();
          c.ellipse(x, h, r, 40 + rnd() * 70, 0, Math.PI, 0);
          c.fill();
          x += r * 0.9;
          continue;
        }
        const bw = 18 + rnd() * 46;
        const bh = (opts.kind === 'coast' ? 20 : 34) + rnd() * (opts.kind === 'coast' ? 50 : 84);
        c.fillRect(x, h - bh, bw, bh);
        const pick = rnd();
        if (opts.kind === 'city' && pick < 0.18) c.fillRect(x + bw * 0.4, h - bh - 14, 3, 14); // antenne
        if (opts.kind === 'industrial' && pick < 0.25) {
          // gru: traliccio + braccio
          c.fillRect(x + bw / 2, h - bh - 60, 5, 60);
          c.fillRect(x + bw / 2 - 30, h - bh - 60, 70, 4);
        }
        if (opts.kind === 'industrial' && pick > 0.85) c.fillRect(x + 4, h - bh - 40, 8, 40); // ciminiera
        if (opts.kind === 'coast' && pick < 0.3) {
          // palma
          const px = x + bw + 6;
          c.fillRect(px, h - 70, 3, 70);
          for (let k = 0; k < 5; k++) {
            c.beginPath();
            c.ellipse(px + 1, h - 72, 16, 4, (k / 5) * Math.PI, 0, Math.PI * 2);
            c.fill();
          }
        }
        if (opts.kind === 'arena' && pick < 0.3) c.fillRect(x, h - bh - 24, 4, 24);
        x += bw + (opts.kind === 'coast' ? 6 + rnd() * 26 : 1 + rnd() * 6);
      }
    }, { alpha: true });
    const [a0, a1] = opts.arc ?? [0, Math.PI * 2];
    const arcLen = a1 - a0;
    const ring = MeshBuilder.CreateCylinder(key, {
      diameter: opts.radius * 2,
      height: opts.height,
      tessellation: Math.max(12, Math.round(48 * (arcLen / (Math.PI * 2)))),
      arc: arcLen / (Math.PI * 2),
      cap: Mesh.NO_CAP,
      sideOrientation: Mesh.DOUBLESIDE
    }, this.scene);
    // il cilindro di Babylon gira in senso orario visto dall'alto: cosi' l'arco copre gli angoli [a0, a1] (x = cos, z = sin)
    ring.rotation.y = -a1;
    ring.position.set(opts.center?.[0] ?? 0, (opts.y ?? 0) + opts.height / 2, opts.center?.[1] ?? 0);
    const m = new StandardMaterial(`${key}Mat`, this.scene);
    m.emissiveColor = Color3.FromHexString(opts.color);
    m.diffuseColor = Color3.Black();
    m.opacityTexture = tex;
    m.disableLighting = true;
    m.backFaceCulling = false;
    m.fogEnabled = false;
    m.transparencyMode = Material.MATERIAL_ALPHATEST;
    m.alphaCutOff = 0.5;
    tex.uScale = Math.max(1, Math.round(3 * (arcLen / (Math.PI * 2)) * (opts.radius / 120)));
    tex.wrapU = Texture.WRAP_ADDRESSMODE;
    m.freeze();
    ring.material = m;
    this.excludeFromGlow(ring);
    return this.freeze(ring);
  }

  // ---------------------------------------------------------------- cartelli

  /** Cartello della famiglia unica (un font, quattro stili). Texture e materiale in cache per testo+stile. */
  sign(text: string, o: SignOpts = {}): Mesh {
    const style = o.style ?? 'board';
    const color = o.color ?? (style === 'neon' ? PAL.neonCyan : style === 'hazard' ? PAL.hazardDark : '#1f2430');
    const w = o.w ?? 4;
    const h = o.h ?? 1.3;
    const pxW = 512;
    const pxH = Math.max(64, Math.min(512, Math.round((pxW * h) / w / 8) * 8));
    const bg = o.bg ?? (style === 'poster' ? '#f4ecd8' : style === 'hazard' ? PAL.hazard : style === 'neon' ? '#10131f' : '#f1ebdc');
    const key = `sign_${style}_${text}_${o.sub ?? ''}_${color}_${bg}_${pxH}`;
    const tex = this.texture(key, pxW, pxH, (c, W, H) => paintSign(c, W, H, text, style, color, bg, o.sub), { alpha: true });
    const m = this.mat('#ffffff', { unlit: style === 'neon', tex, emissive: style === 'neon' ? 0 : 0.35, key: `m_${key}_${o.twoSided ? 2 : 1}`, twoSided: o.twoSided, cutout: true });
    const plane = MeshBuilder.CreatePlane(`sign_${text.slice(0, 16)}`, { width: w, height: h, sideOrientation: o.twoSided ? Mesh.DOUBLESIDE : Mesh.FRONTSIDE }, this.scene);
    plane.material = m;
    plane.position.set(o.x ?? 0, o.y ?? 0, o.z ?? 0);
    plane.rotation.y = o.ry ?? 0;
    if (o.billboard) {
      plane.billboardMode = Mesh.BILLBOARDMODE_Y;
      plane.isPickable = false;
      return plane;
    }
    return this.freeze(plane);
  }

  /**
   * TUTTI i cartelli di una scena in UN atlante e UNA mesh (una draw call): pensato per la Sparatoria in split-screen,
   * dove ogni draw call si paga per ogni finestra. Ogni cartello tiene le sue misure; materiale non illuminato.
   */
  signBoard(name: string, entries: (SignOpts & { text: string })[]): Mesh | null {
    if (entries.length === 0) return null;
    const pxW = 512;
    const items = entries.map((o) => {
      const style = o.style ?? 'board';
      const w = o.w ?? 4;
      const h = o.h ?? 1.3;
      return {
        o,
        style,
        w,
        h,
        color: o.color ?? (style === 'neon' ? PAL.neonCyan : style === 'hazard' ? PAL.hazardDark : '#1f2430'),
        bg: o.bg ?? (style === 'poster' ? '#f4ecd8' : style === 'hazard' ? PAL.hazard : style === 'neon' ? '#10131f' : '#f1ebdc'),
        pxH: Math.max(48, Math.min(256, Math.round((pxW * h) / w / 4) * 4))
      };
    });
    const sum = items.reduce((a, it) => a + it.pxH, 0);
    let Ht = 64;
    while (Ht < sum) Ht *= 2; // potenza di 2: niente sorprese sui telefoni WebGL1
    const tops: number[] = [];
    const tex = this.texture(`signBoard_${name}`, pxW, Ht, (c) => {
      let y = 0;
      for (const it of items) {
        tops.push(y);
        c.save();
        c.translate(0, y);
        paintSign(c, pxW, it.pxH, it.o.text, it.style, it.color, it.bg, it.o.sub);
        c.restore();
        y += it.pxH;
      }
    }, { alpha: true, mips: false });
    const planes = items.map((it, i) => {
      const p = MeshBuilder.CreatePlane(`signBoard_${i}`, { width: it.w, height: it.h, sideOrientation: it.o.twoSided ? Mesh.DOUBLESIDE : Mesh.FRONTSIDE }, this.scene);
      const uv = p.getVerticesData('uv');
      if (uv) {
        const v0 = (Ht - (tops[i] + it.pxH)) / Ht;
        const v1 = (Ht - tops[i]) / Ht;
        for (let k = 1; k < uv.length; k += 2) uv[k] = v0 + uv[k] * (v1 - v0);
        p.setVerticesData('uv', uv);
      }
      p.position.set(it.o.x ?? 0, it.o.y ?? 0, it.o.z ?? 0);
      p.rotation.y = it.o.ry ?? 0;
      return p;
    });
    return this.merge(name, planes, this.mat('#ffffff', { unlit: true, tex, key: `signBoardMat_${name}`, cutout: true, twoSided: entries.some((e) => e.twoSided) }));
  }

  /** Rimappa le UV (0..1 per faccia) nella cella (col, row) di un atlante cols x rows (row 0 = in alto nel canvas). */
  atlasUV(m: Mesh, col: number, row: number, cols: number, rows: number, inset = 0.01): void {
    const uv = m.getVerticesData('uv');
    if (!uv) return;
    for (let i = 0; i < uv.length; i += 2) {
      uv[i] = (col + inset + uv[i] * (1 - 2 * inset)) / cols;
      uv[i + 1] = (rows - 1 - row + inset + uv[i + 1] * (1 - 2 * inset)) / rows;
    }
    m.setVerticesData('uv', uv);
  }

  // ---------------------------------------------------------------- folla

  /**
   * Folla a SAGOME (cartoncini): tre varianti (normale, braccia alzate, sciarpa), ognuna una sola mesh a thin instances
   * con un colore per persona. Animazione condivisa: ogni variante "salta" tutta insieme con la sua fase (3 nodi mossi a
   * frame, non centinaia). Densita' secondo la qualita'. `face`: punto verso cui guardano.
   */
  crowd(spots: { x: number; y: number; z: number }[], opts: { face: [number, number]; scale?: number; seed?: number; tones?: readonly string[] } = { face: [0, 0] }): { cheer(amount: number): void; meshes: Mesh[] } {
    const rnd = seeded(opts.seed ?? 3);
    const keep = this.density(0.45, 0.8, 1);
    const tones = opts.tones ?? PAL.crowd;
    const variants = [0, 1, 2].map((v) => {
      const tex = this.texture(`crowdCard${v}`, 64, 128, (c) => {
        c.fillStyle = '#ffffff';
        // testa
        c.beginPath();
        c.arc(32, 26, 15, 0, Math.PI * 2);
        c.fill();
        // spalle e busto
        c.beginPath();
        c.roundRect(10, 44, 44, 84, 16);
        c.fill();
        if (v === 1) {
          // braccia alzate
          c.save();
          c.translate(14, 50);
          c.rotate(-0.35);
          c.fillRect(-6, -40, 10, 44);
          c.restore();
          c.save();
          c.translate(50, 50);
          c.rotate(0.35);
          c.fillRect(-4, -40, 10, 44);
          c.restore();
        }
        if (v === 2) {
          // sciarpa (piu' chiara) tenuta in alto
          c.fillRect(4, 8, 56, 8);
        }
        // ombra sotto il mento: legge come volume anche in piccolo
        c.globalCompositeOperation = 'source-atop';
        c.fillStyle = 'rgba(0,0,0,0.22)';
        c.fillRect(0, 44, 64, 10);
      }, { alpha: true, mips: true });
      const m = new StandardMaterial(`crowdMat${v}`, this.scene);
      m.diffuseTexture = tex;
      m.diffuseTexture.hasAlpha = true;
      m.useAlphaFromDiffuseTexture = false;
      m.transparencyMode = Material.MATERIAL_ALPHATEST;
      m.alphaCutOff = 0.5;
      m.specularColor = Color3.Black();
      m.emissiveColor = new Color3(0.18, 0.18, 0.2);
      m.backFaceCulling = false;
      m.freeze();
      const plane = MeshBuilder.CreatePlane(`crowd${v}`, { width: 0.8, height: 1.6 }, this.scene);
      plane.material = m;
      return { plane, items: [] as Xf[], colors: [] as string[], phase: v * 2.1 };
    });
    const s = opts.scale ?? 1;
    for (const sp of spots) {
      if (rnd() > keep) continue;
      const v = variants[Math.floor(rnd() * 3)];
      const k = s * (0.85 + rnd() * 0.3);
      v.items.push({ x: sp.x, y: sp.y + 0.8 * k, z: sp.z, ry: Math.atan2(opts.face[0] - sp.x, opts.face[1] - sp.z) + Math.PI, s: k });
      v.colors.push(tones[Math.floor(rnd() * tones.length)]);
    }
    const meshes = variants.map((v) => this.thin(v.plane, v.items, v.colors));
    let excite = 0;
    this.onFrame((t) => {
      excite = Math.max(0, excite - 0.02);
      const amp = 0.05 + excite * 0.35;
      variants.forEach((v, i) => {
        v.plane.position.y = Math.max(0, Math.sin(t * (2.2 + excite * 6) + v.phase)) * amp;
        if (i === 1) v.plane.position.y *= 1.4;
      });
    });
    return {
      meshes,
      cheer: (amount: number) => {
        excite = Math.min(1, Math.max(excite, amount));
      }
    };
  }

  // ---------------------------------------------------------------- moto

  /** Animazione d'ambiente lenta e condivisa: UNA sola callback per scena, tempo in secondi. */
  onFrame(fn: (t: number) => void): void {
    this.frameFns.push(fn);
    if (this.frameObs) return;
    this.frameObs = true;
    this.scene.onBeforeRenderObservable.add(() => {
      const t = performance.now() * 0.001;
      for (const f of this.frameFns) f(t);
    });
  }
}

/** Colore Color4 da esadecimale (per clearColor). */
export function clear4(hex: string): Color4 {
  const c = Color3.FromHexString(hex);
  return new Color4(c.r, c.g, c.b, 1);
}
