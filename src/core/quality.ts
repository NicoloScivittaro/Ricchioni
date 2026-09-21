/**
 * QUALITÀ 3D: LOW / MEDIUM / HIGH con rilevamento automatico prudente e AUTO-QUALITY adattiva.
 *
 * Priorità = FPS STABILI, non grafica: sui PC/telefoni deboli si abbassano risoluzione di rendering, ombre,
 * particelle e bagliore. Precedenza: `?quality=low|medium|high` → localStorage (`ricchioni.quality`, scelta esplicita
 * col tasto Q in debug) → livello raggiunto dall'auto-quality in questa sessione → rilevamento del dispositivo.
 * `?quality=auto` ignora la scelta salvata e riattiva l'automatico.
 *
 * AUTO-QUALITY (solo se la qualità non è stata scelta a mano): parte dal livello stimato (prudente) e poi si adatta.
 *   - SCENDE se gli FPS restano sotto ~24 per 2 s: prima si spengono ombre/particelle/bagliore (livello), poi sale la scala di rendering;
 *   - SALE se gli FPS restano sopra ~57 per 8 s: prima torna la risoluzione, poi il livello successivo (sui telefoni mai oltre MEDIUM);
 *   - ISTERESI: fra 24 e 57 FPS non fa nulla; dopo ogni cambio c'è un tempo di attesa; se un livello appena riconquistato non regge
 *     (FPS bassi entro 8 s) viene bloccato per il resto della sessione e l'attesa per riprovare raddoppia: niente altalena.
 * Il livello raggiunto resta valido per i minigiochi successivi della stessa sessione (sessionStorage, mai su localStorage).
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

const LADDER: QualityLevel[] = ['low', 'medium', 'high']; // dal più leggero al più ricco

const STORE_KEY = 'ricchioni.quality';
const AUTO_KEY = 'ricchioni.quality.auto';
let cached: QualityLevel | null = null;
/** true = livello scelto a mano (URL o salvato): l'auto-quality NON cambia il livello, regola solo la risoluzione. */
let explicit = false;
/** Ultima scala di rendering applicata (per l'overlay di debug). */
let lastScale = 1;

function isLevel(v: unknown): v is QualityLevel {
  return v === 'low' || v === 'medium' || v === 'high';
}

/** Telefono/tablet (l'auto-quality qui non sale oltre MEDIUM: batteria e surriscaldamento). */
function isMobile(): boolean {
  try {
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  } catch {
    return false;
  }
}

/** Stima grossolana dalle capacità del dispositivo (GPU software/integrata/vecchia, core, RAM, telefono, risparmio dati). */
function autoDetect(): QualityLevel {
  try {
    const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
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
    if (nav.connection?.saveData) return 'low'; // "risparmio dati" attivo: l'utente vuole il minimo
    // GPU mobili di fascia molto bassa / vecchie
    if (/adreno \(?tm\)? ?[2-4]\d\d\b|mali-4\d\d|mali-t[5-7]\d\d|powervr sgx|apple a[6-9]\b/i.test(renderer)) return 'low';
    const cores = nav.hardwareConcurrency ?? 4;
    const mem = nav.deviceMemory ?? 8;
    if (isMobile()) return cores <= 4 || mem <= 3 ? 'low' : 'medium'; // sui telefoni si parte prudenti: al massimo MEDIUM
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
  let forceAuto = false;
  try {
    const q = new URLSearchParams(location.search).get('quality');
    if (isLevel(q)) {
      level = q;
      explicit = true;
    } else if (q === 'auto') {
      forceAuto = true;
    }
  } catch {
    /* ignora */
  }
  if (!level && !forceAuto) {
    try {
      const s = localStorage.getItem(STORE_KEY);
      if (isLevel(s)) {
        level = s;
        explicit = true;
      }
    } catch {
      /* ignora */
    }
  }
  if (!level) {
    try {
      const a = sessionStorage.getItem(AUTO_KEY); // livello raggiunto dall'auto-quality nei minigiochi precedenti
      if (isLevel(a)) level = a;
    } catch {
      /* ignora */
    }
  }
  cached = level ?? autoDetect();
  return cached;
}

/** Livello scelto a mano (tasto Q in debug): salvato e da ora l'auto-quality non cambia più il livello. */
export function setQualityLevel(level: QualityLevel): void {
  cached = level;
  explicit = true;
  try {
    localStorage.setItem(STORE_KEY, level);
  } catch {
    /* ignora */
  }
}

/** Livello impostato dall'auto-quality: vale per i minigiochi successivi di questa sessione, non viene salvato per sempre. */
function setAutoLevel(level: QualityLevel): void {
  cached = level;
  try {
    sessionStorage.setItem(AUTO_KEY, level);
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

/** true se il livello lo decide l'auto-quality (nessuna scelta manuale). */
export function isAutoQuality(): boolean {
  getQualityLevel();
  return !explicit;
}

/** Stato corrente per gli overlay di debug (host e telefoni). */
export function getQualityInfo(): { level: QualityLevel; auto: boolean; scale: number } {
  return { level: getQualityLevel(), auto: isAutoQuality(), scale: lastScale };
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
// Soglie dell'auto-quality (tutto in ms tranne gli FPS)
const LOW_FPS = 24;
const HIGH_FPS = 57;
const DOWN_AFTER_MS = 2000;
const UP_AFTER_MS = 8000;
const DOWN_COOLDOWN_MS = 3000;
const UP_COOLDOWN_MS = 4000;
const REVERT_WINDOW_MS = 8000;
const MAX_LEVEL_CHANGES = 4;

/** Livello massimo raggiungibile salendo: sui telefoni MEDIUM (batteria, scalda), altrove HIGH. */
function ceilingLevel(): QualityLevel {
  return isMobile() ? 'medium' : 'high';
}

/**
 * Applica il preset alla scena e attiva l'ADATTAMENTO in tempo reale (vedi l'intestazione del modulo).
 * Con qualità scelta a mano regola soltanto la risoluzione dinamica, come sempre. Restituisce le impostazioni iniziali.
 */
export function applyQuality(engine: EngineLike, scene: SceneLike): QualitySettings {
  let q = qualitySettings();
  const initial = q;
  const auto = isAutoQuality();
  let scale = q.scaling;

  const apply = (): void => {
    lastScale = scale;
    engine.setHardwareScalingLevel(scale);
    scene.shadowsEnabled = q.shadows;
    scene.particlesEnabled = q.particles;
    for (const layer of scene.effectLayers ?? []) layer.isEnabled = q.glow;
  };
  apply();

  let frames = 0;
  let lowSince = 0;
  let highSince = 0;
  let cooldownUntil = 0;
  let lastUpAt = 0;
  let upWait = UP_AFTER_MS;
  let changes = 0;
  const blockedUp = new Set<QualityLevel>();

  const setLevel = (level: QualityLevel): void => {
    q = qualitySettings(level);
    scale = q.scaling;
    changes++;
    setAutoLevel(level);
    apply();
  };

  scene.onBeforeRenderObservable.add(() => {
    if (++frames % 30 !== 0) return; // controllo ~ogni mezzo secondo
    const now = performance.now();
    const fps = engine.getFps();
    if (!(fps > 0)) return;
    // Isteresi: fra LOW_FPS e HIGH_FPS non si fa nulla e i contatori ripartono
    if (fps < LOW_FPS) {
      highSince = 0;
      if (!lowSince) lowSince = now;
    } else if (fps >= HIGH_FPS) {
      lowSince = 0;
      if (!highSince) highSince = now;
    } else {
      lowSince = 0;
      highSince = 0;
    }
    if (now < cooldownUntil) return;

    if (lowSince && now - lowSince >= DOWN_AFTER_MS) {
      lowSince = 0;
      const idx = LADDER.indexOf(q.level);
      if (auto && idx > 0 && changes < MAX_LEVEL_CHANGES) {
        // livello appena riconquistato che non regge: bloccato per la sessione, e si riprova solo molto più tardi
        if (lastUpAt && now - lastUpAt < REVERT_WINDOW_MS) {
          blockedUp.add(q.level);
          upWait *= 2;
        }
        setLevel(LADDER[idx - 1]);
      } else if (scale < MAX_SCALING) {
        scale = Math.min(MAX_SCALING, scale + STEP);
        apply();
      }
      cooldownUntil = now + DOWN_COOLDOWN_MS;
    } else if (highSince && now - highSince >= upWait) {
      highSince = 0;
      const idx = LADDER.indexOf(q.level);
      const next = LADDER[idx + 1];
      if (scale > q.scaling + 1e-6) {
        // prima si recupera la risoluzione, poi eventualmente il livello
        scale = Math.max(q.scaling, scale - STEP);
        apply();
        cooldownUntil = now + UP_COOLDOWN_MS;
      } else if (auto && next && idx + 1 <= LADDER.indexOf(ceilingLevel()) && !blockedUp.has(next) && changes < MAX_LEVEL_CHANGES) {
        lastUpAt = now;
        setLevel(next);
        cooldownUntil = now + UP_COOLDOWN_MS;
      }
    }
  });
  return initial;
}
