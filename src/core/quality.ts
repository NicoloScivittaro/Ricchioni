/**
 * QUALITÀ 3D: LOW / MEDIUM / HIGH con rilevamento automatico e risoluzione dinamica.
 *
 * Priorità = FPS STABILI, non grafica: sui PC/telefoni deboli si abbassano risoluzione di rendering, ombre,
 * particelle e bagliore. Precedenza: `?quality=low|medium|high` → localStorage (`ricchioni.quality`) → auto.
 * Il modulo NON importa Babylon (usa interfacce minime): non appesantisce nessun chunk.
 */
export type QualityLevel = 'low' | 'medium' | 'high';

export interface QualitySettings {
  level: QualityLevel;
  /** Fattore di scala di rendering (1 = nativo, 1.5 = 2/3 dei pixel per lato). */
  scaling: number;
  antialias: boolean;
  /** true = usa il devicePixelRatio del display (costoso su schermi 4K/retina). */
  adaptDpr: boolean;
  shadows: boolean;
  particles: boolean;
  glow: boolean;
}

const PRESETS: Record<QualityLevel, Omit<QualitySettings, 'level'>> = {
  low: { scaling: 1.5, antialias: false, adaptDpr: false, shadows: false, particles: false, glow: false },
  medium: { scaling: 1, antialias: true, adaptDpr: false, shadows: true, particles: true, glow: false },
  high: { scaling: 1, antialias: true, adaptDpr: true, shadows: true, particles: true, glow: true }
};

const STORE_KEY = 'ricchioni.quality';
let cached: QualityLevel | null = null;

function isLevel(v: unknown): v is QualityLevel {
  return v === 'low' || v === 'medium' || v === 'high';
}

/** Stima grossolana dalle capacità del dispositivo (GPU software/integrata, core, RAM, telefono). */
function autoDetect(): QualityLevel {
  try {
    const nav = navigator as Navigator & { deviceMemory?: number };
    let renderer = '';
    try {
      const c = document.createElement('canvas');
      const gl = (c.getContext('webgl') ?? c.getContext('experimental-webgl')) as WebGLRenderingContext | null;
      const ext = gl?.getExtension('WEBGL_debug_renderer_info');
      if (gl && ext) renderer = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL));
      gl?.getExtension('WEBGL_lose_context')?.loseContext();
    } catch {
      /* ignora */
    }
    if (/swiftshader|llvmpipe|software|basic render/i.test(renderer)) return 'low';
    const mobile = /Android|iPhone|iPad|iPod/i.test(nav.userAgent);
    const cores = nav.hardwareConcurrency ?? 4;
    const mem = nav.deviceMemory ?? 8;
    if (mobile) return cores <= 4 || mem <= 3 ? 'low' : 'medium';
    if (cores <= 2 || mem <= 2) return 'low';
    if (cores <= 4 || mem <= 4 || /intel\(r\) (uhd|hd) graphics/i.test(renderer)) return 'medium';
    return 'high';
  } catch {
    return 'medium';
  }
}

export function getQualityLevel(): QualityLevel {
  if (cached) return cached;
  let level: QualityLevel | null = null;
  try {
    const q = new URLSearchParams(location.search).get('quality');
    if (isLevel(q)) level = q;
  } catch {
    /* ignora */
  }
  if (!level) {
    try {
      const s = localStorage.getItem(STORE_KEY);
      if (isLevel(s)) level = s;
    } catch {
      /* ignora */
    }
  }
  cached = level ?? autoDetect();
  return cached;
}

export function setQualityLevel(level: QualityLevel): void {
  cached = level;
  try {
    localStorage.setItem(STORE_KEY, level);
  } catch {
    /* ignora */
  }
}

/** low → medium → high → low (tasto Q in modalità debug). */
export function cycleQuality(): QualityLevel {
  const order: QualityLevel[] = ['low', 'medium', 'high'];
  const next = order[(order.indexOf(getQualityLevel()) + 1) % order.length];
  setQualityLevel(next);
  return next;
}

export function qualitySettings(level: QualityLevel = getQualityLevel()): QualitySettings {
  return { level, ...PRESETS[level] };
}

/** Argomenti per `new Engine(canvas, antialias, options)`. */
export function engineOptions(): { antialias: boolean; stencil: boolean; adaptToDeviceRatio: boolean } {
  const q = qualitySettings();
  return { antialias: q.antialias, stencil: true, adaptToDeviceRatio: q.adaptDpr };
}

interface EngineLike {
  /** In Babylon ridimensiona già il buffer di rendering: non serve chiamare resize(). */
  setHardwareScalingLevel(level: number): void;
  getHardwareScalingLevel(): number;
  getFps(): number;
}
interface SceneLike {
  shadowsEnabled: boolean;
  particlesEnabled: boolean;
  effectLayers?: { isEnabled: boolean }[];
  onBeforeRenderObservable: { add(cb: () => void): unknown };
}

const MAX_SCALING = 2;
const STEP = 0.25;

/**
 * Applica il preset al motore/scena e attiva la RISOLUZIONE DINAMICA: se gli FPS restano sotto ~22 per 2 secondi
 * la scala di rendering sale di un passo (fino a 2×), e torna verso il preset quando ci sono FPS da vendere.
 * Restituisce le impostazioni applicate.
 */
export function applyQuality(engine: EngineLike, scene: SceneLike): QualitySettings {
  const q = qualitySettings();
  engine.setHardwareScalingLevel(q.scaling);
  scene.shadowsEnabled = q.shadows;
  scene.particlesEnabled = q.particles;
  for (const layer of scene.effectLayers ?? []) layer.isEnabled = q.glow;

  let frames = 0;
  let lowSince = 0;
  let cooldownUntil = 0;
  scene.onBeforeRenderObservable.add(() => {
    if (++frames % 30 !== 0) return; // controllo ~ogni mezzo secondo
    const now = performance.now();
    if (now < cooldownUntil) return;
    const fps = engine.getFps();
    const level = engine.getHardwareScalingLevel();
    if (fps > 0 && fps < 22) {
      if (!lowSince) lowSince = now;
      if (now - lowSince > 2000 && level < MAX_SCALING) {
        engine.setHardwareScalingLevel(Math.min(MAX_SCALING, level + STEP));
        lowSince = 0;
        cooldownUntil = now + 3000;
      }
    } else {
      lowSince = 0;
      // FPS abbondanti e risoluzione sopra al preset: ritorna verso la qualità scelta
      if (fps > 55 && level > q.scaling + 1e-6) {
        engine.setHardwareScalingLevel(Math.max(q.scaling, level - STEP));
        cooldownUntil = now + 4000;
      }
    }
  });
  return q;
}
