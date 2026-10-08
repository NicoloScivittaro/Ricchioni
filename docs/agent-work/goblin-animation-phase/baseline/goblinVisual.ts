/**
 * GOBLIN TRIPO — VARIANTE DI RENDER (PILOTA, SOLO DEV/DEBUG).
 *
 * Il Goblin procedurale resta il modello ufficiale; questo modulo aggiunge un'ALTERNATIVA di render
 * (GLB riggato Tripo/Mixamo, clip `run.001`) selezionabile a mano in sviluppo:
 *
 *   `?goblin=new`  (oppure `setGoblinVisualMode('new')` da console/dev) → modello importato
 *   `?goblin=old`  (default)                                             → modello procedurale
 *   `?goblinUrl=...` (solo test)                                         → forza un URL diverso (fallback su errore)
 *
 * Regole del pilota:
 * - l'import è SOLO grafico: nessuna posizione, velocità, abilità, collider o hitbox del gioco viene letta/scritta;
 * - ogni istanza ha scheletro e animazioni PROPRIE (i materiali/testure sono condivisi per scena);
 * - il modello procedurale resta vivo e viene solo nascosto: ancoraggi FX, targhetta e popup continuano a usarlo;
 * - se il caricamento fallisce (o la scena muore durante il load) si resta sul procedurale, senza crash.
 *
 * Selezione, caricamento e istanze sono separati apposta: i test possono guidare i tre pezzi senza browser
 * (parsing di URL/sessione) e nel browser (istanze, scheletri, animazioni, disposal).
 */
import { Matrix, Quaternion, TransformNode, Vector3 } from '@babylonjs/core';
import type { AbstractMesh, AnimationGroup, AssetContainer, Bone, InstantiatedEntries, Scene, Skeleton, TargetedAnimation } from '@babylonjs/core';
import { debugEnabled } from '../../core/debug';

/** Copia byte-per-byte del GLB originale (`green+goblin+3d+model.glb`), nessuna compressione né LOD. */
export const GOBLIN_TRIPO_URL = '/models/goblin-tripo/green_goblin_tripo.glb';
/** Unica clip del GLB (Mixamo "run", 195 canali × 65 nodi, ~1,25 s). */
export const GOBLIN_TRIPO_CLIP = 'run.001';
/** Osso radice dello scheletro: tutte le altre ossa sono sue discendenti. */
const HIPS_BONE = 'mixamorig:Hips';
/** Articolazioni lette dal probe di debug (posa seduta/corsa/ferma). */
const JOINT_PROBE = [
  HIPS_BONE,
  'mixamorig:Spine',
  'mixamorig:Head',
  'mixamorig:LeftUpLeg',
  'mixamorig:LeftLeg',
  'mixamorig:LeftFoot',
  'mixamorig:RightUpLeg',
  'mixamorig:RightLeg',
  'mixamorig:RightFoot',
  'mixamorig:LeftHand',
  'mixamorig:RightHand'
];
/** Sotto questa soglia (unità modello) lo scostamento orizzontale della clip è considerato fisiologico. */
const CLIP_OFFSET_EPSILON = 0.02;

export type GoblinVisualMode = 'old' | 'new';

const MODE_QUERY = 'goblin';
const URL_QUERY = 'goblinUrl';
const YAW_QUERY = 'goblinYaw';
const SCALE_QUERY = 'goblinScale';
const DELAY_QUERY = 'goblinDelay';
const STORE_KEY = 'ricchioni.goblinVisual';

/** Conteggi osservabili dall'esterno (E2E): istanze vive, caricamenti abortiti e container tardivi buttati. */
let liveInstances = 0;
let lateDisposedContainers = 0;
let abortedLoads = 0;
let lastLoadError: string | null = null;

export function goblinVisualCounters(): {
  liveInstances: number;
  lateDisposedContainers: number;
  abortedLoads: number;
  lastLoadError: string | null;
} {
  return { liveInstances, lateDisposedContainers, abortedLoads, lastLoadError };
}

/** `?goblinDelay=<ms>` (solo DEV/test): ritarda il caricamento vero per provare dispute/cambi scena durante il load. */
function loadDelayMs(): number {
  try {
    const raw = new URLSearchParams(location.search).get(DELAY_QUERY);
    const v = Number(raw);
    if (raw !== null && Number.isFinite(v) && v > 0) return Math.min(v, 15000);
  } catch {
    /* ignore */
  }
  return 0;
}

/**
 * Taratura fine del render, in gradi/percento. Solo DEV: permette ai test visivi di provare orientamento e
 * dimensione senza ricompilare (`?goblinYaw=180&goblinScale=100`). I default sono la taratura approvata.
 */
export function goblinTuning(): { yawDeg: number; scaleMul: number } {
  const t = { yawDeg: GOBLIN_YAW_DEG, scaleMul: 1 };
  try {
    const q = new URLSearchParams(location.search);
    const yaw = Number(q.get(YAW_QUERY));
    if (Number.isFinite(yaw) && q.get(YAW_QUERY) !== null) t.yawDeg = yaw;
    const scale = Number(q.get(SCALE_QUERY));
    if (Number.isFinite(scale) && scale > 0 && q.get(SCALE_QUERY) !== null) t.scaleMul = scale / 100;
  } catch {
    /* ignore */
  }
  return t;
}

/**
 * Orientamento del GLB in scena, in gradi. Il rig procedurale guarda +Z con `root.rotation.y = 0`; l'import
 * Tripo, convertito da Babylon (glTF destrorso → scena sinistrorsa), guarda già nella stessa direzione: la
 * correzione verificata a vista nelle gallery `?characters=1` (fronte/lato/retro) è quindi 0.
 */
export const GOBLIN_YAW_DEG = 0;

/**
 * Posa FERMA (nessuna clip di idle nel GLB): si usa il frame in cui le anche sono più ALTE, cioè il momento più
 * disteso del ciclo di corsa (`?goblinHold=<frazione>` per provarne altri). Non è una bind pose: è un fotogramma
 * reale della clip, scelto dai dati della clip stessa.
 */
const IDLE_HOLD_FRACTION = 0.5;
/** Oltre questo tempo senza risposta si resta sul procedurale (ma il caricamento condiviso può comunque completare). */
const LOAD_TIMEOUT_MS = 20000;

function queryMode(): GoblinVisualMode | null {
  try {
    const v = new URLSearchParams(location.search).get(MODE_QUERY);
    if (v === 'new' || v === 'old') return v;
  } catch {
    /* nessun URL (test/SSR) */
  }
  return null;
}

function storedMode(): GoblinVisualMode | null {
  try {
    const v = sessionStorage.getItem(STORE_KEY);
    if (v === 'new' || v === 'old') return v;
  } catch {
    /* sessionStorage negato (privacy): si resta sul default */
  }
  return null;
}

/**
 * Scelta fatta A RUNTIME (pulsanti della galleria, console, `setGoblinVisualMode`). Ha la precedenza su tutto:
 * senza di essa un `?goblin=new` nell'URL renderebbe impossibile tornare a OLD dalla UI (e viceversa il pulsante
 * NEW non farebbe nulla partendo da `?goblin=old`). Prima di qualsiasi scelta a runtime vale `URL > sessione > old`.
 */
let runtimeMode: GoblinVisualMode | null = null;

/** Modalità richiesta: runtime > URL > sessione > `old`. Il selettore sopravvive ai cambi scena del gioco. */
export function goblinVisualMode(): GoblinVisualMode {
  return runtimeMode ?? queryMode() ?? storedMode() ?? 'old';
}

/**
 * Cambia la modalità a runtime (pulsanti della galleria, console, test) e la ricorda per la sessione del tab.
 * L'override resta valido finché la pagina vive: è una scelta dell'utente, non un valore derivato dall'URL.
 */
export function setGoblinVisualMode(mode: GoblinVisualMode): void {
  runtimeMode = mode;
  try {
    sessionStorage.setItem(STORE_KEY, mode);
  } catch {
    /* ignore */
  }
}

/** true solo se il debug è consentito: in produzione la variante non si attiva mai, nemmeno con `?goblin=new`. */
export function goblinNewEnabled(): boolean {
  return debugEnabled() && goblinVisualMode() === 'new';
}

/** URL effettivo del GLB (`?goblinUrl=...` serve ai test del fallback). */
export function goblinAssetUrl(): string {
  try {
    const override = new URLSearchParams(location.search).get(URL_QUERY);
    if (override) return override;
  } catch {
    /* ignore */
  }
  return GOBLIN_TRIPO_URL;
}

// ------------------------------------------------------------------ caricamento condiviso per scena

interface GoblinAsset {
  url: string;
  state: 'loading' | 'ready' | 'error';
  error: string | null;
  loadMs: number | null;
  container: AssetContainer | null;
  instances: number;
  promise: Promise<AssetContainer> | null;
}

const sceneAssets = new WeakMap<Scene, Map<string, GoblinAsset>>();

function assetsOf(scene: Scene): Map<string, GoblinAsset> {
  let map = sceneAssets.get(scene);
  if (!map) {
    map = new Map();
    sceneAssets.set(scene, map);
    scene.onDisposeObservable.addOnce(() => {
      for (const a of map!.values()) {
        try {
          a.container?.dispose();
        } catch (e) {
          if (typeof console !== 'undefined') console.warn('[goblinVisual] dispose scena', e);
        }
      }
      map!.clear();
    });
  }
  return map;
}

/**
 * Caricamento condiviso per scena. Il loader glTF è importato SOLO qui, in modo dinamico: in produzione il
 * selettore è sempre OLD, quindi il peso del loader (una fetta a parte nel bundle) non viene mai scaricato dalle
 * partite normali — nessun costo per chi non attiva il pilota.
 */
async function loadGoblinAsset(scene: Scene, url: string): Promise<GoblinAsset> {
  const map = assetsOf(scene);
  const existing = map.get(url);
  if (existing) return existing;

  const asset: GoblinAsset = { url, state: 'loading', error: null, loadMs: null, container: null, instances: 0, promise: null };
  const t0 = nowMs();
  asset.promise = (async () => {
    const delay = loadDelayMs();
    if (delay > 0) await new Promise((r) => setTimeout(r, delay));
    const [{ loadAssetContainerAsync }, { GLTFLoaderAnimationStartMode }] = await Promise.all([
      import('@babylonjs/core/Loading/sceneLoader'),
      import('@babylonjs/loaders/glTF')
    ]);
    // la scena può essere morta mentre i moduli arrivavano: non si avvia nemmeno il caricamento
    if (scene.isDisposed) {
      abortedLoads++;
      throw new Error('scena disposta prima del caricamento');
    }
    const container = await loadAssetContainerAsync(url, scene, {
      // niente autoplay: la clip parte solo quando il gioco la chiede (locomozione), mai al load
      pluginOptions: { gltf: { animationStartMode: GLTFLoaderAnimationStartMode.NONE } }
    });
    // container arrivato DOPO la morte della scena: va buttato subito (niente risorse orfane)
    if (scene.isDisposed) {
      try {
        container.dispose();
      } catch {
        /* niente da fare: la scena è già smontata */
      }
      lateDisposedContainers++;
      throw new Error('scena disposta durante il caricamento');
    }
    asset.container = container;
    asset.state = 'ready';
    asset.loadMs = nowMs() - t0;
    return container;
  })().catch((err: unknown) => {
    asset.state = 'error';
    asset.error = String((err as Error)?.message ?? err).slice(0, 200);
    lastLoadError = asset.error;
    // il fallimento NON resta in cache: un cambio scena/riprova può ritentare il caricamento
    if (map.get(url) === asset) map.delete(url);
    throw err;
  });
  map.set(url, asset);
  return asset;
}

function nowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

/** Stato leggibile dagli E2E: quante risorse condivise vive ci sono in scena e in che stato è il load. */
export function goblinVisualDebug(scene: Scene): {
  mode: GoblinVisualMode;
  url: string;
  assets: { url: string; state: string; error: string | null; loadMs: number | null; instances: number }[];
  sceneMeshes: number;
  sceneMaterials: number;
  sceneTextures: number;
  sceneSkeletons: number;
  sceneAnimationGroups: number;
} {
  const map = sceneAssets.get(scene);
  return {
    mode: goblinVisualMode(),
    url: goblinAssetUrl(),
    assets: map ? [...map.values()].map((a) => ({ url: a.url, state: a.state, error: a.error, loadMs: a.loadMs, instances: a.instances })) : [],
    sceneMeshes: scene.meshes.length,
    sceneMaterials: scene.materials.length,
    sceneTextures: scene.textures.length,
    sceneSkeletons: scene.skeletons.length,
    sceneAnimationGroups: scene.animationGroups.length
  };
}

// ------------------------------------------------------------------ posa seduta (pilota del Kart)

/**
 * Posa SEDUTA per il pilota del Kart: niente animazione, solo rotazioni locali (in gradi) moltiplicate DOPO la
 * rotazione di riposo, sull'asse locale dell'osso. Gli assi NON sono quelli "da manuale Mixamo": misurati sul rig
 * (prova offline in NullEngine con lettura delle articolazioni figlie, vedi PILOT-REPORT §2bis) —
 *   flessione anca = asse Z negativo (gamba avanti in orizzontale),
 *   flessione ginocchio = asse Z positivo (stinco che scende),
 *   braccio avanti = Z negativo (per entrambi), braccio verso il centro = X opposto fra i due lati.
 */
const SEATED_BONES: { bone: string; x?: number; y?: number; z?: number }[] = [
  { bone: 'mixamorig:Hips', z: -6 },
  { bone: 'mixamorig:Spine', z: -5 },
  { bone: 'mixamorig:Spine1', z: -4 },
  { bone: 'mixamorig:LeftUpLeg', z: -78 },
  { bone: 'mixamorig:LeftLeg', z: 74 },
  { bone: 'mixamorig:LeftFoot', z: 12 },
  { bone: 'mixamorig:RightUpLeg', z: -78 },
  { bone: 'mixamorig:RightLeg', z: 74 },
  { bone: 'mixamorig:RightFoot', z: 12 },
  { bone: 'mixamorig:LeftArm', x: -58, z: -18 },
  { bone: 'mixamorig:LeftForeArm', z: -26 },
  { bone: 'mixamorig:RightArm', x: 58, z: -18 },
  { bone: 'mixamorig:RightForeArm', z: -26 }
];

const DEG = Math.PI / 180;

// ------------------------------------------------------------------ istanza

export interface GoblinVisualOptions {
  /** Altezza (unità mondo) che il modello deve raggiungere: di norma l'altezza del rig procedurale sostituito. */
  height?: number;
  /** Correzione di orientamento (radianti) attorno a Y: il GLB deve guardare dove guarda il modello procedurale. */
  yaw?: number;
  /** Moltiplicatore extra di scala (default 1). */
  scaleMul?: number;
  /** Statua seduta (pilota Kart): posa fissa sulle ossa, nessuna animazione. */
  seated?: boolean;
  /** Chiamata UNA volta quando l'import è pronto (`true`) o definitivamente fallito (`false`). */
  onReady?: (ok: boolean) => void;
}

export interface GoblinPoseState {
  speedFrac: number;
  alive: boolean;
  falling: boolean;
  dashing: boolean;
  stunned: boolean;
}

export interface GoblinVisualInstanceDebug {
  state: 'loading' | 'ready' | 'error';
  error: string | null;
  bones: number;
  meshes: number;
  meshNames: string[];
  /** id delle geometrie usate dalle mesh importate: con più Goblin in scena deve restare UNA sola (condivisa). */
  geometryIds: number[];
  animation: string | null;
  animationPlaying: boolean;
  /** 0 = posa ferma (nessuna clip di idle), > 0 = clip di corsa in riproduzione */
  animationSpeed: number;
  animationFrame: number | null;
  skeletonId: number | null;
  /** scostamento orizzontale COSTANTE delle anche nella clip, rispetto alla posa di riposo (unità modello, pre-scala) */
  clipHipsOffset: number[] | null;
  /** frame della clip usato come posa ferma */
  holdFrame: number | null;
  /** istanza in posa seduta (pilota Kart) e se la posa è stata applicata */
  seated: boolean;
  seatedApplied: boolean;
  /** posizione di riposo delle anche e posizione ATTUALE (dopo la neutralizzazione dello scostamento) */
  restHips: number[] | null;
  hipsNow: number[] | null;
  /** posizioni (spazio scheletro, unità del modello prima della scala di scena) delle articolazioni chiave */
  joints: Record<string, number[]> | null;
  height: number | null;
  width: number | null;
  depth: number | null;
  scale: number;
  vertices: number;
}

export class GoblinVisualInstance {
  private readonly scene: Scene;
  private readonly root: TransformNode;
  private readonly opts: GoblinVisualOptions;
  private readonly url: string;
  private readonly assetReady: Promise<GoblinAsset>;
  private asset: GoblinAsset | null = null;
  private readonly id: number;
  private pivot: TransformNode | null = null;
  private inner: TransformNode | null = null;
  private entries: InstantiatedEntries | null = null;
  private group: AnimationGroup | null = null;
  private skeleton: Skeleton | null = null;
  private state: 'loading' | 'ready' | 'error' = 'loading';
  private error: string | null = null;
  private disposed = false;
  private enabled = true;
  private readyFired = false;
  private seatedApplied = false;
  private idleApplied = false;
  private speedRatio = 1;
  private holdFrame = 0;
  private bones = new Map<string, Bone>();
  private bind = new Map<string, Quaternion>();
  private bindPos = new Map<string, Vector3>();
  /**
   * Oggetti da POSARE: il nodo glTF collegato all'osso quando esiste (è lui la fonte di verità, lo scheletro copia
   * nodo → osso a ogni frame), altrimenti l'osso stesso. `quat`/`pos` sono la posa di riposo letta a caricamento
   * avvenuto ma PRIMA di qualunque valutazione della clip.
   */
  private poseTargets = new Map<string, { node: TransformNode | Bone; quat: Quaternion | null; pos: Vector3 }>();
  private hips: Bone | null = null;
  /**
   * Oggetto ANIMATO delle anche. Nel GLB di Tripo i joint sono nodi glTF collegati alle ossa: la clip colpisce il
   * NODO (nome `mixamorig:Hips~gN`), non l'oggetto `Bone` dello scheletro clonato. Le correzioni vanno fatte sulla
   * traccia giusta, quindi si tiene il riferimento all'oggetto che la clip muove davvero.
   */
  private hipsTarget: { name?: string; position: Vector3 } | null = null;
  private clipHipsOffset: Vector3 | null = null;
  private size: { x: number; y: number; z: number } | null = null;
  private vertices = 0;

  constructor(scene: Scene, root: TransformNode, opts: GoblinVisualOptions = {}) {
    this.scene = scene;
    this.root = root;
    this.opts = opts;
    this.url = goblinAssetUrl();
    this.id = ++instanceSeq;
    liveInstances++;
    this.assetReady = loadGoblinAsset(scene, this.url);
    void this.assetReady
      .then((a) => {
        this.asset = a;
        a.instances++;
        if (this.disposed) {
          a.instances = Math.max(0, a.instances - 1);
          this.asset = null;
        }
      })
      .catch(() => undefined);
    // fine scena: l'istanza si segna morta e sistema i conteggi. Le risorse le smonta la scena (niente doppie
    // dispose su geometrie condivise con il container).
    scene.onDisposeObservable.addOnce(() => {
      if (this.disposed) return;
      this.disposed = true;
      liveInstances = Math.max(0, liveInstances - 1);
      if (this.asset) {
        this.asset.instances = Math.max(0, this.asset.instances - 1);
        this.asset = null;
      }
    });
    void this.attach();
  }

  get ready(): boolean {
    return this.state === 'ready';
  }

  get failed(): boolean {
    return this.state === 'error';
  }

  /** Mesh dell'istanza (vuoto finché il load non è finito): per maschere di layer, culling o test. */
  get meshes(): AbstractMesh[] {
    return this.pivot ? this.pivot.getChildMeshes(false) : [];
  }

  get loadError(): string | null {
    return this.error;
  }

  /** Mostra/nasconde il modello importato (respawn, Dottore, ecc.) senza toccare il rig procedurale. */
  setEnabled(v: boolean): void {
    this.enabled = v;
    this.pivot?.setEnabled(v);
  }

  /** Aggiorna la clip di locomozione. Le pose non coperte dal GLB restano FERME (nessun autoplay, nessuna posa bind). */
  update(dt: number, pose: GoblinPoseState): void {
    if (this.state !== 'ready' || this.disposed || !this.group) return;
    if (this.opts.seated) {
      if (!this.seatedApplied) this.applySeatedPose();
      return;
    }
    const moving = pose.alive && !pose.falling && !pose.stunned && (pose.dashing || pose.speedFrac > 0.12);
    if (moving) {
      if (!this.group.isPlaying) this.group.play(true);
      const target = clamp(0.7 + pose.speedFrac * 1.7 + (pose.dashing ? 0.5 : 0), 0.7, 3.2);
      if (Math.abs(target - this.speedRatio) > 0.05) {
        this.speedRatio = target;
        this.group.speedRatio = target;
      }
      this.idleApplied = false;
      return;
    }
    // fermo / in aria / colpito: per questi stati la clip non esiste → posa FERMA su un fotogramma reale della
    // corsa, mai la bind pose e mai l'autoplay al caricamento. La pausa è necessaria: un gruppo che continua a
    // valutare RISCRIVE il fotogramma corrente a ogni frame e annullerebbe `goToFrame`.
    const atHold = Math.abs(this.group.getCurrentFrame() - this.holdFrame) < 0.05;
    if (this.group.isPlaying || !this.idleApplied || !atHold) {
      this.idleApplied = true;
      this.speedRatio = 0;
      this.group.speedRatio = 0;
      this.group.pause();
      this.group.goToFrame(this.holdFrame);
      this.skeleton?.prepare();
    }
    void dt;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    liveInstances = Math.max(0, liveInstances - 1);
    if (this.asset) {
      this.asset.instances = Math.max(0, this.asset.instances - 1);
      this.asset = null;
    }
    this.disposeInstanceResources();
  }

  /** Rilascia le risorse create per QUESTA istanza (scheletro, clip, mesh): il container condiviso non si tocca. */
  private disposeInstanceResources(): void {
    this.group?.dispose();
    this.group = null;
    this.skeleton?.dispose();
    this.skeleton = null;
    for (const n of this.entries?.rootNodes ?? []) n.dispose(false, false);
    this.entries = null;
    this.inner?.dispose(false, false);
    this.inner = null;
    this.pivot?.dispose(false, false);
    this.pivot = null;
    this.bones.clear();
    this.bind.clear();
    this.bindPos.clear();
    this.poseTargets.clear();
    this.hips = null;
    this.hipsTarget = null;
  }

  debug(): GoblinVisualInstanceDebug {
    return {
      state: this.state,
      error: this.error,
      bones: this.skeleton?.bones.length ?? 0,
      meshes: this.pivot ? this.pivot.getChildMeshes(false).length : 0,
      meshNames: this.meshes.map((m) => `${m.name}(${m.getTotalVertices()}v)`),
      geometryIds: this.meshes.map((m) => m.geometry?.uniqueId ?? -1),
      animation: this.group ? this.group.name : null,
      animationPlaying: this.group?.isPlaying ?? false,
      animationSpeed: this.group ? this.group.speedRatio : 0,
      animationFrame: this.group?.getCurrentFrame() ?? null,
      skeletonId: this.skeleton?.uniqueId ?? null,
      clipHipsOffset: this.clipHipsOffset ? this.clipHipsOffset.asArray().map((v) => +v.toFixed(4)) : null,
      holdFrame: +this.holdFrame.toFixed(2),
      seated: !!this.opts.seated,
      seatedApplied: this.seatedApplied,
      restHips: this.bindPos.get(HIPS_BONE)?.asArray().map((v) => +v.toFixed(4)) ?? null,
      hipsNow: this.hipsTarget?.position.asArray().map((v) => +v.toFixed(4)) ?? null,
      joints: this.jointProbe(),
      height: this.size?.y ?? null,
      width: this.size?.x ?? null,
      depth: this.size?.z ?? null,
      scale: this.pivot?.scaling.x ?? 1,
      vertices: this.vertices
    };
  }

  /** (solo DEBUG/E2E) riferimenti vivi dell'istanza: scheletro e gruppo di animazione sono PROPRI di questa istanza. */
  handle(): { skeleton: Skeleton | null; group: AnimationGroup | null; meshes: AbstractMesh[] } {
    return { skeleton: this.skeleton, group: this.group, meshes: this.meshes };
  }

  /**
   * (solo DEBUG/E2E) posizioni delle articolazioni chiave in spazio scheletro: serve a verificare la POSA (seduta,
   * corsa, ferma) senza guardare solo gli screenshot, e a provare che la posa non venga riscritta a ogni frame.
   */
  private jointProbe(): Record<string, number[]> | null {
    if (!this.skeleton || !this.inner) return null;
    this.skeleton.prepare();
    this.inner.computeWorldMatrix(true);
    const inv = Matrix.Invert(this.inner.getWorldMatrix());
    const out: Record<string, number[]> = {};
    for (const name of JOINT_PROBE) {
      const target = this.poseTargets.get(name);
      if (!target) continue;
      // posizione nello spazio del MODELLO (relativa a `inner`): indipendente da posizione/rotazione di scena
      target.node.computeWorldMatrix(true);
      const p = Vector3.TransformCoordinates(Vector3.Zero(), target.node.getWorldMatrix().multiply(inv));
      out[name.replace('mixamorig:', '')] = [+p.x.toFixed(4), +p.y.toFixed(4), +p.z.toFixed(4)];
    }
    return out;
  }

  // -------------------------------------------------------------- interno

  private finish(ok: boolean, err: unknown = null): void {
    if (this.readyFired) return;
    this.readyFired = true;
    this.state = ok ? 'ready' : 'error';
    this.error = ok ? null : String((err as Error)?.message ?? err ?? 'errore').slice(0, 200);
    if (!ok && typeof console !== 'undefined') console.warn(`[goblinVisual] modello importato non disponibile (${this.url}): ${this.error}`);
    try {
      this.opts.onReady?.(ok);
    } catch (e) {
      if (typeof console !== 'undefined') console.error('[goblinVisual] onReady', e);
    }
  }

  private async attach(): Promise<void> {
    let timer: ReturnType<typeof setTimeout> | null = null;
    try {
      const asset = await this.assetReady;
      const container = await Promise.race([
        asset.promise as Promise<AssetContainer>,
        new Promise<AssetContainer>((_, reject) => {
          timer = setTimeout(() => reject(new Error(`timeout ${LOAD_TIMEOUT_MS}ms`)), LOAD_TIMEOUT_MS);
        })
      ]);
      if (timer) clearTimeout(timer);
      if (this.disposed || this.scene.isDisposed) {
        return;
      }
      this.build(container);
    } catch (e) {
      if (timer) clearTimeout(timer);
      if (this.disposed || this.scene.isDisposed) return;
      this.finish(false, e);
    }
  }

  private build(container: AssetContainer): void {
    try {
      const entries = container.instantiateModelsToScene((n) => `${n}~g${this.id}`, false);
      this.entries = entries;

      const pivot = new TransformNode(`goblinVisual_${this.id}`, this.scene);
      pivot.parent = this.root;
      const inner = new TransformNode(`goblinVisualInner_${this.id}`, this.scene);
      inner.parent = pivot;
      for (const n of entries.rootNodes) n.parent = inner;
      this.pivot = pivot;
      this.inner = inner;
      // se il proprietario ha già chiesto di nascondere il corpo (respawn, Buttafuori), il modello nasce nascosto
      pivot.setEnabled(this.enabled);

      // CONTRATTO DELL'ASSET: senza scheletro vero e senza la clip `run.001` non si disegna nulla (si resta sul
      // procedurale) — mai un gruppo qualunque, mai una clip con un altro nome.
      this.skeleton = entries.skeletons[0] ?? null;
      if (!this.skeleton || this.skeleton.bones.length === 0) throw new Error('scheletro assente nel GLB');
      const expectedClip = `${GOBLIN_TRIPO_CLIP}~g${this.id}`;
      const run = entries.animationGroups.find((g) => g.name === expectedClip || g.name === GOBLIN_TRIPO_CLIP) ?? null;
      if (!run) throw new Error(`clip ${GOBLIN_TRIPO_CLIP} non trovata nel GLB (${entries.animationGroups.map((g) => g.name).join(', ') || 'nessun gruppo'})`);
      this.group = run;

      // Posa di BIND (prima di qualsiasi valutazione della clip): rotazioni e posizioni degli oggetti che la clip
      // muove DAVVERO. Nel GLB Tripo i joint sono nodi glTF collegati alle ossa: è il NODO la fonte di verità (lo
      // scheletro copia nodo → osso a ogni frame), quindi la posa seduta va scritta lì.
      for (const b of this.skeleton.bones) {
        const target = b.getTransformNode() ?? b;
        this.bones.set(b.name, b);
        this.poseTargets.set(b.name, { node: target, quat: target.rotationQuaternion?.clone() ?? null, pos: target.position.clone() });
        if (b.rotationQuaternion) this.bind.set(b.name, b.rotationQuaternion.clone());
        this.bindPos.set(b.name, target.position.clone());
      }
      this.hips = this.bones.get(HIPS_BONE) ?? null;

      // Scala e appoggio dai bounds di bind (mai da bounds animati).
      const bounds = measureLocalBounds(pivot, inner);
      const rawHeight = Math.max(1e-4, bounds.max.y - bounds.min.y);
      const targetHeight = this.opts.height ?? 2;
      const scale = (targetHeight / rawHeight) * (this.opts.scaleMul ?? 1);
      inner.position.set(-(bounds.min.x + bounds.max.x) / 2, -bounds.min.y, -(bounds.min.z + bounds.max.z) / 2);
      pivot.scaling.setAll(scale);
      pivot.rotation.y = this.opts.yaw ?? 0;

      for (const m of pivot.getChildMeshes(false)) {
        m.isPickable = false;
        this.vertices += m.getTotalVertices();
      }

      if (this.opts.seated) {
        // Statua seduta: NESSUNA clip avviata (niente che possa riscrivere la posa), posa sulle ossa/nodi e
        // aggancio col BACINO (non con i piedi) all'origine del nodo di seduta: è il bacino che poggia sul kart.
        this.hipsTrack(run);
        this.applySeatedPose();
        const posed = measureLocalBounds(pivot, inner, true);
        const hipsTarget = this.poseTargets.get(HIPS_BONE)?.node;
        const hipsLocal = hipsTarget ? localPoint(hipsTarget, inner) : new Vector3(-(posed.min.x + posed.max.x) / 2, -posed.min.y, -(posed.min.z + posed.max.z) / 2);
        inner.position.set(-hipsLocal.x, -hipsLocal.y, -hipsLocal.z);
        this.size = {
          x: (posed.max.x - posed.min.x) * scale,
          y: (posed.max.y - posed.min.y) * scale,
          z: (posed.max.z - posed.min.z) * scale
        };
      } else {
        // 1) la traccia delle anche porta uno scostamento orizzontale COSTANTE rispetto alla posa di riposo
        //    (vedi PILOT-REPORT): il gioco è responsabile del movimento, quindi la clip deve girare "sul posto".
        //    Va corretto PRIMA di `start()`, perché è `start()` a creare gli animatable dalle tracce.
        this.rectifyClipOffset(run);
        this.holdFrame = this.pickHoldFrame(run);
        // 2) la clip va AVVIATA perché `goToFrame` funzioni (un gruppo mai avviato non ha animatable) e poi messa
        //    in PAUSA sul fotogramma scelto: da lì riparte in corsa e ci torna quando il personaggio si ferma.
        run.start(true, 0);
        run.speedRatio = 0;
        run.pause();
        run.goToFrame(this.holdFrame);
        this.size = { x: (bounds.max.x - bounds.min.x) * scale, y: rawHeight * scale, z: (bounds.max.z - bounds.min.z) * scale };
      }
      this.skeleton.prepare();
      this.finish(true);
    } catch (e) {
      // costruzione a metà: si buttano SOLO le risorse di questa istanza, il container condiviso resta intatto
      this.disposeInstanceResources();
      throw e;
    }
  }

  /** Fotogramma più "in piedi" del ciclo (anche più alte): è la posa FERMA quando non si cammina. */
  private pickHoldFrame(run: AnimationGroup): number {
    const mid = run.from + (run.to - run.from) * IDLE_HOLD_FRACTION;
    const keys = this.hipsTrack(run)?.animation.getKeys() ?? [];
    let best = mid;
    let bestY = Number.NEGATIVE_INFINITY;
    for (const k of keys) {
      const v = k.value as Vector3;
      if (!v || typeof v.y !== 'number') continue;
      if (v.y > bestY) {
        bestY = v.y;
        best = Math.min(run.to, Math.max(run.from, k.frame));
      }
    }
    return best;
  }

  /**
   * Neutralizza lo scostamento orizzontale COSTANTE della traccia delle anche (x e z valgono lo stesso valore per
   * tutta la clip: la corsa è "sul posto" ma il bacino è ~0,45 unità avanti rispetto alla posa di riposo — con la
   * scala dell'Arena sono ~1 unità di mondo). Senza questa correzione il modello corre DAVANTI al proprio root,
   * cioè dove il gioco lo disegna. La correzione vive in una COPIA PRIVATA della traccia di questo Goblin: le
   * risorse condivise della scena non vengono toccate e ogni istanza ha la sua.
   */
  private rectifyClipOffset(run: AnimationGroup): void {
    const rest = this.hips ? this.bindPos.get(HIPS_BONE) : null;
    const track = this.hipsTrack(run);
    if (!rest || !track) return;
    const keys = track.animation.getKeys();
    if (keys.length === 0) return;
    let sx = 0;
    let sz = 0;
    let n = 0;
    for (const k of keys) {
      const v = k.value as Vector3;
      if (!v || typeof v.x !== 'number' || typeof v.z !== 'number') return;
      sx += v.x;
      sz += v.z;
      n++;
    }
    if (n === 0) return;
    const offset = new Vector3(sx / n - rest.x, 0, sz / n - rest.z);
    if (Math.hypot(offset.x, offset.z) < CLIP_OFFSET_EPSILON) return;
    this.clipHipsOffset = offset;
    const own = track.animation.clone(true);
    for (const k of own.getKeys()) {
      const v = k.value as Vector3;
      v.x -= offset.x;
      v.z -= offset.z;
    }
    run.removeTargetedAnimation(track.animation);
    run.addTargetedAnimation(own, track.target);
  }

  /**
   * Traccia della POSIZIONE delle anche dentro la clip. Il target può essere il `Bone` clonato oppure il nodo
   * glTF collegato (nome con suffisso `~gN`): si accettano entrambi, purché il nome coincida con quello delle anche.
   */
  private hipsTrack(run: AnimationGroup): TargetedAnimation | undefined {
    const bone = this.hips;
    const track = run.targetedAnimations.find((ta) => {
      if (!ta.animation.targetPropertyPath.includes('position')) return false;
      if (bone && ta.target === bone) return true;
      const name = String((ta.target as { name?: string } | null)?.name ?? '');
      return !!bone && (name === bone.name || name.startsWith(`${bone.name}~`));
    });
    if (track) this.hipsTarget = track.target as { name?: string; position: Vector3 };
    return track;
  }

  /** Posa seduta del pilota: rotazioni locali sulle ossa, applicate UNA volta (nessuna animazione in riproduzione). */
  private applySeatedPose(): void {
    this.seatedApplied = true;
    if (!this.skeleton) return;
    for (const spec of SEATED_BONES) {
      const target = this.poseTargets.get(spec.bone);
      if (!target || !target.quat) continue;
      let q = target.quat.clone();
      if (spec.x) q = q.multiply(Quaternion.RotationAxis(AXIS_X, spec.x * DEG));
      if (spec.y) q = q.multiply(Quaternion.RotationAxis(AXIS_Y, spec.y * DEG));
      if (spec.z) q = q.multiply(Quaternion.RotationAxis(AXIS_Z, spec.z * DEG));
      // la posa va scritta sull'oggetto che lo scheletro ricopia ogni frame (il nodo), non solo sull'osso
      target.node.rotationQuaternion = q;
    }
    this.skeleton.prepare();
  }
}

let instanceSeq = 0;

const AXIS_X = new Vector3(1, 0, 0);
const AXIS_Y = new Vector3(0, 1, 0);
const AXIS_Z = new Vector3(0, 0, 1);

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * Ricalcola il bounding box locale; con `applySkeleton` applica lo scheletro nella posa corrente.
 * Il runtime accetta `true`/`false` come primo argomento (options `{applySkeleton}`), ma il .d.ts pubblicato
 * espone il tipo opzioni con nomi manglati: la firma va quindi passata da un cast esplicito.
 */
function refreshBounds(mesh: AbstractMesh, applySkeleton: boolean): void {
  (mesh.refreshBoundingInfo as unknown as (o?: boolean, m?: boolean) => void)(applySkeleton);
}

/** Posizione di un nodo nello spazio del MODELLO (con `inner` azzerato), ripristinando `inner` com'era. */
function localPoint(node: TransformNode | Bone, inner: TransformNode): Vector3 {
  const saved = inner.position.clone();
  inner.position.setAll(0);
  inner.computeWorldMatrix(true);
  node.computeWorldMatrix(true);
  const p = Vector3.TransformCoordinates(Vector3.Zero(), node.getWorldMatrix().multiply(Matrix.Invert(inner.getWorldMatrix())));
  inner.position.copyFrom(saved);
  inner.computeWorldMatrix(true);
  return p;
}

/**
 * Bounds del modello in posa di BIND nello spazio locale del pivot: ogni mesh usa il proprio bounding box di
 * geometria (niente bounds deformati dall'animazione), trasformato dalla matrice relativa al pivot.
 * Con `deformed` i bounds vengono ricalcolati applicando lo scheletro NELLA POSA CORRENTE (usato per la statua
 * seduta del Kart): il box di bind viene ripristinato subito dopo, così il culling resta quello di sempre.
 */
function measureLocalBounds(pivot: TransformNode, inner: TransformNode, deformed = false): { min: Vector3; max: Vector3 } {
  // riferimento = `inner` azzerato: i bounds sono SEMPRE nello spazio del modello, e la scala/rotazione già
  // impostate sul pivot (compresa la correzione di orientamento) non vengono toccate.
  const saved = inner.position.clone();
  inner.position.setAll(0);
  inner.computeWorldMatrix(true);
  const inv = Matrix.Invert(inner.getWorldMatrix());
  const min = new Vector3(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
  const max = new Vector3(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY);
  for (const mesh of pivot.getChildMeshes(false)) {
    if (deformed) {
      try {
        refreshBounds(mesh, true);
      } catch {
        /* bounds di bind: meglio una posa seduta approssimata che un errore */
      }
    }
    mesh.computeWorldMatrix(true);
    const local = mesh.getWorldMatrix().multiply(inv);
    const box = mesh.getBoundingInfo().boundingBox;
    for (const corner of box.vectors) {
      const p = Vector3.TransformCoordinates(corner, local);
      min.minimizeInPlace(p);
      max.maximizeInPlace(p);
    }
    if (deformed) refreshBounds(mesh, false);
  }
  inner.position.copyFrom(saved);
  inner.computeWorldMatrix(true);
  if (!Number.isFinite(min.x) || !Number.isFinite(max.x)) {
    min.setAll(0);
    max.set(0, 1, 0);
  }
  return { min, max };
}
