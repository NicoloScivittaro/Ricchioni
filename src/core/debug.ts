/**
 * OVERLAY DI DEBUG (solo host). Disponibile in sviluppo (`npm run dev`) oppure con `?debug=1` nell'URL;
 * in produzione normale NON esiste e non costa nulla (nessun timer, nessun rAF, nessun patch dei timer).
 *
 *   F3  mostra / nasconde l'overlay      Q  cambia qualità 3D (si applica al prossimo minigioco)
 *
 * Mostra: fase, round/roundId, minigioco, scene Phaser attive (deve essere 1), canvas, timer JS vivi,
 * FPS + frame time medio/peggiore, heap JS (Chrome), connessione, ping, giocatori, qualità.
 */
import { game as gm } from './GameManager';
import { cycleQuality, getQualityInfo } from './quality';

const STORE = 'ricchioni.debug';

function allowed(): boolean {
  try {
    if (new URLSearchParams(location.search).get('debug') === '1') return true;
  } catch {
    /* ignora */
  }
  return Boolean(import.meta.env.DEV);
}

function wasVisible(): boolean {
  try {
    if (new URLSearchParams(location.search).get('debug') === '1') return true;
    return sessionStorage.getItem(STORE) === '1';
  } catch {
    return false;
  }
}

/** Conta i timer JS ancora vivi (setTimeout non scaduti + setInterval): rivela perdite di timer tra un minigioco e l'altro. */
const liveTimers = new Set<number>();
let timersPatched = false;
/** Timer JS ancora vivi (richiede patchTimers, attivato da flowTrace/overlay); -1 se il conteggio non e' attivo. */
export function liveTimerCount(): number {
  return timersPatched ? liveTimers.size : -1;
}

export function ensureTimerPatch(): void {
  patchTimers();
}

function patchTimers(): void {
  if (timersPatched) return;
  timersPatched = true;
  const st = window.setTimeout.bind(window);
  const ct = window.clearTimeout.bind(window);
  const si = window.setInterval.bind(window);
  const ci = window.clearInterval.bind(window);
  window.setTimeout = ((fn: TimerHandler, ms?: number, ...args: unknown[]): number => {
    const id: number = st(
      (...a: unknown[]) => {
        liveTimers.delete(id);
        if (typeof fn === 'function') (fn as (...x: unknown[]) => void)(...a);
      },
      ms,
      ...args
    );
    liveTimers.add(id);
    return id;
  }) as typeof window.setTimeout;
  window.clearTimeout = ((id?: number): void => {
    if (id !== undefined) liveTimers.delete(id);
    ct(id);
  }) as typeof window.clearTimeout;
  window.setInterval = ((fn: TimerHandler, ms?: number, ...args: unknown[]): number => {
    const id = si(fn, ms, ...args);
    liveTimers.add(id);
    return id;
  }) as typeof window.setInterval;
  window.clearInterval = ((id?: number): void => {
    if (id !== undefined) liveTimers.delete(id);
    ci(id);
  }) as typeof window.clearInterval;
}

/** Sezioni extra dell'overlay F3 (es. GAMEPAD): ogni modulo registra una funzione che restituisce le sue righe. Solo debug. */
const extraSections: (() => string[])[] = [];
export function registerDebugSection(fn: () => string[]): void {
  extraSections.push(fn);
}

class DebugOverlay {
  private lastRender = 0;
  private root: HTMLDivElement | null = null;
  private visible = false;
  private raf = 0;
  private frames = 0;
  private lastSecond = 0;
  private lastFrame = 0;
  private worstMs = 0;
  private sumMs = 0;
  private fps = 0;
  private avgMs = 0;
  private worstShown = 0;
  private ping: number | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;

  toggle(): void {
    if (this.visible) this.hide();
    else this.show();
  }

  show(): void {
    if (this.visible) return;
    patchTimers();
    this.visible = true;
    try {
      sessionStorage.setItem(STORE, '1');
    } catch {
      /* ignora */
    }
    if (!this.root) {
      const el = document.createElement('div');
      el.style.cssText =
        'position:fixed;left:8px;top:8px;z-index:2147483000;padding:8px 10px;border-radius:8px;' +
        'background:rgba(0,0,0,0.72);color:#a7f3d0;font:12px/1.45 ui-monospace,Consolas,monospace;' +
        'white-space:pre;pointer-events:none;border:1px solid rgba(167,243,208,0.35);';
      document.body.appendChild(el);
      this.root = el;
    }
    this.root.style.display = 'block';
    this.lastSecond = this.lastFrame = performance.now();
    this.frames = 0;
    this.worstMs = this.sumMs = 0;
    const tick = (now: number): void => {
      if (!this.visible) return;
      const dt = now - this.lastFrame;
      this.lastFrame = now;
      this.frames++;
      this.sumMs += dt;
      if (dt > this.worstMs) this.worstMs = dt;
      if (now - this.lastSecond >= 1000) {
        this.fps = Math.round((this.frames * 1000) / (now - this.lastSecond));
        this.avgMs = this.sumMs / this.frames;
        this.worstShown = this.worstMs;
        this.frames = 0;
        this.sumMs = 0;
        this.worstMs = 0;
        this.lastSecond = now;
      }
      // i valori dei controller devono sembrare "vivi": l'overlay si ridisegna 4 volte al secondo (gli FPS restano calcolati a 1 s)
      if (now - this.lastRender >= 250) {
        this.lastRender = now;
        this.render();
      }
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
    const doPing = (): void => void gm.ping().then((ms) => (this.ping = ms));
    doPing();
    this.pingTimer = setInterval(doPing, 2500);
  }

  hide(): void {
    if (!this.visible) return;
    this.visible = false;
    try {
      sessionStorage.setItem(STORE, '0');
    } catch {
      /* ignora */
    }
    cancelAnimationFrame(this.raf);
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = null;
    if (this.root) this.root.style.display = 'none';
  }

  isVisible(): boolean {
    return this.visible;
  }

  private render(): void {
    if (!this.root) return;
    const st = gm.state;
    const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
    const scenes = gm.activeSceneKeys();
    const lines = [
      `DEBUG · F3 nascondi · Q qualità`,
      `FPS ${this.fps} · frame ${this.avgMs.toFixed(1)}ms (peggiore ${this.worstShown.toFixed(0)}ms)`,
      `fase ${st?.phase ?? '—'} · round ${st?.round ?? '—'} · id ${st?.roundId ?? '—'}`,
      `gioco ${gm.pendingMinigame?.minigameId ?? '—'}${st?.paused ? ' · PAUSA' : ''}`,
      `scene ${scenes.length}${scenes.length === 1 ? '' : ' ⚠'} [${scenes.join(', ')}] · canvas ${document.querySelectorAll('canvas').length} · timer ${liveTimers.size}`,
      `rete ${gm.connected ? 'ok' : 'OFFLINE'} · ping ${this.ping === null ? '—' : this.ping + 'ms'} · giocatori ${st?.players.length ?? 0}`,
      `heap ${mem ? (mem.usedJSHeapSize / 1048576).toFixed(0) + ' MB' : 'n/d'} · qualità ${qualityLabel()}`
    ];
    for (const section of extraSections) {
      try {
        lines.push(...section());
      } catch (e) {
        lines.push(`(sezione debug in errore: ${String((e as Error)?.message ?? e).slice(0, 80)})`);
      }
    }
    this.root.textContent = lines.join('\n');
  }
}

let overlay: DebugOverlay | null = null;

/** Da chiamare una volta all'avvio dell'host: registra F3 (e Q con overlay visibile) solo se il debug è consentito. */
/** true in sviluppo o con `?debug=1`: abilita le statistiche di bilanciamento (pallavolo) e simili. In produzione e' false. */
export function debugEnabled(): boolean {
  return allowed();
}

function qualityLabel(): string {
  const q = getQualityInfo();
  return `${q.level}${q.auto ? ' (auto)' : ''} · scala ${q.scale.toFixed(2)}`;
}

export function initDebug(): void {
  if (!allowed()) return;
  overlay = new DebugOverlay();
  window.addEventListener('keydown', (e) => {
    if (e.key === 'F3') {
      e.preventDefault();
      overlay?.toggle();
    } else if ((e.key === 'q' || e.key === 'Q') && overlay?.isVisible() && !e.repeat) {
      const next = cycleQuality();
      console.log(`[debug] qualità 3D → ${next} (si applica al prossimo minigioco)`);
    }
  });
  if (wasVisible()) overlay.show();
}
