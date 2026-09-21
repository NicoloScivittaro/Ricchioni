import { game as gm } from './GameManager';
import { debugEnabled, ensureTimerPatch, liveTimerCount } from './debug';

/**
 * DIAGNOSTICA DI FLUSSO (solo host, solo debug/dev: `?debug=1` o `npm run dev`; in produzione non parte nulla).
 * Serve a catturare la PROSSIMA volta un blocco del tipo "rullo successivo non raggiunto": tiene in memoria gli ultimi 150 eventi del
 * flusso con lo stato completo del momento, e se una fase resta ferma troppo a lungo stampa da sola un dump.
 *
 *   window.__flowTrace   eventi grezzi     window.__flowDump()   testo leggibile     window.__flowStall   primo stallo rilevato
 *
 * Per ogni evento: istante, tipo, fase del client (= quella trasmessa dal server), roundId, minigioco scelto/in attesa,
 * risultati gia' consegnati (resultsSubmitted) per il round, scene Phaser attive, canvas totali e canvas 3D (z-index 10000),
 * timer JS pendenti, ultimo errore. Non modifica nessun comportamento: osserva e registra.
 */

interface Ev {
  t: number;
  wall: string;
  kind: string;
  phase: string | null;
  roundId: number | null;
  selected: string | null;
  pending: string | null;
  resultsSubmitted: boolean;
  scenes: string[];
  canvases: number;
  canvas3d: number;
  timers: number;
  note?: string;
}

interface St {
  phase: string;
  roundId?: number;
  selectedMinigameId: string | null;
}

const buf: Ev[] = [];
let started = false;
let lastFinishRound: number | null = null;
let lastPhase: string | null = null;
let lastRound: number | null = null;
let phaseSince = 0;
let lastScenes = '';
let lastError: string | null = null;
let stallReported = false;
const t0 = performance.now();

// dopo quanto (ms) una fase transitoria e' considerata BLOCCATA (molto oltre la durata prevista + skip dell'host)
const STALL_MS: Record<string, number> = {
  MINIGAME_ROULETTE: 20000,
  MINIGAME_INTRO: 15000,
  MINIGAME_FINISHED: 10000,
  ROUND_RESULTS: 25000,
  GLOBAL_LEADERBOARD: 15000,
  NEXT_ROUND: 12000,
  CHECK_WINNER: 8000
};

function snapshot(kind: string, note?: string): Ev {
  const st = gm.state as unknown as St | null;
  const all = [...document.querySelectorAll('canvas')];
  return {
    t: Math.round(performance.now() - t0),
    wall: new Date().toISOString().slice(11, 23),
    kind,
    phase: st?.phase ?? null,
    roundId: st?.roundId ?? null,
    selected: st?.selectedMinigameId ?? null,
    pending: gm.pendingMinigame?.minigameId ?? null,
    resultsSubmitted: lastFinishRound !== null && lastFinishRound === (st?.roundId ?? -2),
    scenes: gm.activeSceneKeys(),
    canvases: all.length,
    canvas3d: all.filter((c) => c.style.zIndex === '10000').length,
    timers: liveTimerCount(),
    note: note ?? (lastError && kind === 'stall' ? `ultimo errore: ${lastError}` : undefined)
  };
}

function push(kind: string, note?: string): Ev {
  const e = snapshot(kind, note);
  buf.push(e);
  if (buf.length > 150) buf.shift();
  return e;
}

export function flowDump(last = 40): string {
  return buf
    .slice(-last)
    .map(
      (e) =>
        `${String(e.t).padStart(7)}ms ${e.wall} ${e.kind.padEnd(16)} fase=${e.phase} round=${e.roundId} scelto=${e.selected ?? '-'} inAttesa=${e.pending ?? '-'} consegnati=${e.resultsSubmitted ? 'si' : 'no'} scene=[${e.scenes.join(',')}] canvas=${e.canvases}(3D ${e.canvas3d}) timer=${e.timers}${e.note ? ' · ' + e.note : ''}`
    )
    .join('\n');
}

function wrap(method: string, kind: string, note?: (args: unknown[]) => string): void {
  const g = gm as unknown as Record<string, (...a: unknown[]) => unknown>;
  const orig = g[method]?.bind(gm);
  if (!orig) return;
  g[method] = (...args: unknown[]): unknown => {
    if (kind === 'finishMinigame') lastFinishRound = (args[1] as number | undefined) ?? (gm.state as unknown as St | null)?.roundId ?? null;
    push(kind, note?.(args));
    return orig(...args);
  };
}

/** Da chiamare una volta all'avvio (app/main.ts): non fa nulla fuori dal debug. */
export function initFlowTrace(): void {
  if (started || !debugEnabled()) return;
  started = true;
  ensureTimerPatch();
  const w = window as unknown as Record<string, unknown>;
  w.__flowTrace = buf;
  w.__flowDump = flowDump;
  push('start');

  gm.events.on('state', (s: unknown) => {
    const st = s as St;
    if (st.phase !== lastPhase || (st.roundId ?? null) !== lastRound) {
      lastPhase = st.phase;
      lastRound = st.roundId ?? null;
      phaseSince = performance.now();
      stallReported = false;
      push('phase', st.phase);
    }
  });
  gm.events.on('minigame', (p: unknown) => {
    const m = p as { minigameId: string; roundId?: number };
    push('minigameSelected', `${m.minigameId} roundId=${m.roundId}`);
  });
  wrap('finishMinigame', 'finishMinigame', (a) => `roundId=${a[1]}`);
  wrap('skip', 'skip');
  wrap('launchMinigame', 'launchMinigame');
  wrap('skipMinigame', 'skipMinigame');
  wrap('restartMatch', 'restartMatch');

  window.addEventListener('error', (e) => {
    lastError = String(e.message).slice(0, 160);
    push('error', lastError);
  });
  window.addEventListener('unhandledrejection', (e) => {
    lastError = String((e.reason as Error)?.message ?? e.reason).slice(0, 160);
    push('error', lastError);
  });

  window.setInterval(() => {
    // cambi di scena (anche senza cambio di fase: e' li' che si vedono le scene "vecchie" rimaste)
    const sc = gm.activeSceneKeys().join(',');
    if (sc !== lastScenes) {
      lastScenes = sc;
      push('scenes', sc);
    }
    // stallo: fase transitoria ferma da troppo
    const limit = lastPhase ? STALL_MS[lastPhase] : undefined;
    if (limit && !stallReported && performance.now() - phaseSince > limit) {
      stallReported = true;
      const e = push('stall', `fase ${lastPhase} ferma da ${Math.round((performance.now() - phaseSince) / 1000)} s`);
      w.__flowStall = { at: e, trace: flowDump(40) };
      console.warn('[FLOW STALL]\n' + flowDump(40));
    }
  }, 500);
}
