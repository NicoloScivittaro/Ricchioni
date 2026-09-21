import { game as gm } from './GameManager';
import { debugEnabled } from './debug';

/**
 * TELEMETRIA LOCALE DI SESSIONE (solo host, solo debug: `?debug=1` o `npm run dev`). NON invia niente fuori dal browser, non usa servizi
 * esterni, non salva su disco: tiene in MEMORIA cosa e' successo durante la serata, per migliorare il gioco dopo una partita vera.
 *
 *   F4                         mostra/nasconde il SESSION REPORT sullo schermo dell'host (e lo stampa in console)
 *   window.__sessionReport()   stampa e restituisce il testo del report      window.__session   dati grezzi
 *
 * Per ogni minigioco: nome, round, durata, numero giocatori, piazzamenti e vincitore, FPS medio/minimo dell'host, disconnessioni,
 * restart, skip, errori e le metriche di bilanciamento che i giochi gia' calcolano (pallavolo, calcio, dodgeball, arena, sparatoria).
 * In produzione normale non parte nulla: nessun timer, nessun rAF, nessun listener.
 */

interface Rec {
  n: number;
  game: string;
  name: string;
  round: number;
  roundId: number;
  players: number;
  startedAt: number;
  durationSec: number;
  placements: { name: string; placement: number; score: number }[];
  winner: string | null;
  fps: number[];
  disconnects: string[];
  restarts: number;
  skipped: boolean;
  errors: string[];
  metrics: Record<string, unknown>;
  open: boolean;
}

interface State {
  phase: string;
  round: number;
  roundId?: number;
  players: { id: string; displayName: string; connected: boolean; score: number }[];
  currentMinigame: { minigameId: string; name: string } | null;
  lastResults: { results: { playerId: string; placement: number; score: number }[] } | null;
  lastRound?: { minigameId: string; winnerId: string | null } | null;
}

const records: Rec[] = [];
let cur: Rec | null = null;
let active = false;
const sessionStart = Date.now();
const totals = { disconnects: 0, restarts: 0, skips: 0, lobbyReturns: 0, errors: 0, errorSamples: [] as string[] };
const conn = new Map<string, boolean>();
let reportShown = false;
let panel: HTMLPreElement | null = null;
let printedFinal = false;

function noteError(msg: string): void {
  totals.errors++;
  if (totals.errorSamples.length < 5) totals.errorSamples.push(msg.slice(0, 140));
  if (cur?.open) cur.errors.push(msg.slice(0, 140));
}

function names(st: State): Map<string, string> {
  return new Map(st.players.map((p) => [p.id, p.displayName]));
}

function fmtDur(sec: number): string {
  const m = Math.floor(sec / 60);
  return `${m}:${String(Math.round(sec % 60)).padStart(2, '0')}`;
}

function fmtMetrics(m: Record<string, unknown>): string {
  return Object.entries(m)
    .map(([k, v]) => `${k} ${typeof v === 'number' ? (Number.isInteger(v) ? v : v.toFixed(1)) : Array.isArray(v) ? v.join('/') : String(v)}`)
    .join(' · ');
}

export function buildReport(): string {
  const mins = Math.max(1, Math.round((Date.now() - sessionStart) / 60000));
  const played = records.filter((r) => !r.skipped);
  const pc = records.map((r) => r.players);
  const lines: string[] = [];
  lines.push(`SESSION REPORT — ${new Date(sessionStart).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })} · ${mins} min · ${played.length} giochi giocati${records.length !== played.length ? ` (+${records.length - played.length} saltati)` : ''}${pc.length ? ` · ${Math.min(...pc)}-${Math.max(...pc)} giocatori` : ''}`);
  lines.push('');
  lines.push(' #  gioco                   round durata giocatori vincitore        FPS medio (min)  note');
  for (const r of records) {
    const avg = r.fps.length ? Math.round(r.fps.reduce((a, b) => a + b, 0) / r.fps.length) : null;
    const min = r.fps.length ? Math.min(...r.fps) : null;
    const notes = [r.skipped ? 'SALTATO' : '', r.restarts ? `restart x${r.restarts}` : '', r.disconnects.length ? `disconnessi: ${r.disconnects.join(',')}` : '', r.errors.length ? `errori x${r.errors.length}` : ''].filter(Boolean).join(' · ');
    lines.push(
      `${String(r.n).padStart(2)}  ${r.name.slice(0, 22).padEnd(22)}  ${String(r.round).padStart(3)}   ${fmtDur(r.durationSec).padStart(5)}   ${String(r.players).padStart(4)}     ${(r.winner ?? '—').slice(0, 14).padEnd(14)}  ${avg === null ? '—'.padStart(6) : String(avg).padStart(6)} (${min ?? '—'})      ${notes}`
    );
    if (Object.keys(r.metrics).length) lines.push(`      ▸ ${fmtMetrics(r.metrics)}`);
  }
  lines.push('');
  const fpsAll = records.flatMap((r) => r.fps);
  lines.push(`Totali: disconnessioni ${totals.disconnects} · restart minigioco ${totals.restarts} · skip ${totals.skips} · ritorni alla lobby ${totals.lobbyReturns} · errori ${totals.errors}${fpsAll.length ? ` · FPS host medio ${Math.round(fpsAll.reduce((a, b) => a + b, 0) / fpsAll.length)} (peggior secondo ${Math.min(...fpsAll)})` : ''}`);
  if (totals.errorSamples.length) lines.push(`Errori: ${totals.errorSamples.join(' | ')}`);
  // giochi piu' e meno giocati
  const byGame = new Map<string, number>();
  for (const r of played) byGame.set(r.name, (byGame.get(r.name) ?? 0) + 1);
  if (byGame.size) lines.push(`Giochi usciti: ${[...byGame.entries()].sort((a, b) => b[1] - a[1]).map(([g, n]) => `${g} x${n}`).join(' · ')}`);
  const slow = records.filter((r) => r.fps.length && Math.min(...r.fps) < 25).map((r) => r.name);
  if (slow.length) lines.push(`⚠ FPS sotto 25 in: ${[...new Set(slow)].join(', ')}`);
  return lines.join('\n');
}

function tick(): void {
  const st = gm.state as unknown as State | null;
  if (!st) return;
  // connessioni (disconnect): true -> false
  for (const p of st.players) {
    const was = conn.get(p.id);
    if (was === true && !p.connected) {
      totals.disconnects++;
      if (cur?.open) cur.disconnects.push(p.displayName);
    }
    conn.set(p.id, p.connected);
  }
  const playing = st.phase === 'MINIGAME_PLAYING';
  if (playing && (!cur || cur.roundId !== (st.roundId ?? -1))) {
    const mg = st.currentMinigame;
    cur = {
      n: records.length + 1,
      game: mg?.minigameId ?? '?',
      name: mg?.name ?? '?',
      round: st.round,
      roundId: st.roundId ?? -1,
      players: st.players.length,
      startedAt: performance.now(),
      durationSec: 0,
      placements: [],
      winner: null,
      fps: [],
      disconnects: [],
      restarts: 0,
      skipped: false,
      errors: [],
      metrics: {},
      open: true
    };
    records.push(cur);
    printedFinal = false;
  }
  if (cur?.open) {
    cur.durationSec = (performance.now() - cur.startedAt) / 1000;
    if (!playing && st.phase !== 'MINIGAME_INTRO') {
      cur.open = false;
      // finito senza risultati (rullo subito dopo il gioco) = saltato
      if (st.phase === 'MINIGAME_ROULETTE' || st.phase === 'LOBBY') cur.skipped = true;
    }
  }
  // risultati: arrivano a fine gioco; restano validi fino al prossimo
  const last = records[records.length - 1];
  if (last && !last.placements.length && !last.skipped && st.lastResults && (st.roundId ?? -1) === last.roundId && st.phase !== 'MINIGAME_PLAYING') {
    const nm = names(st);
    last.placements = st.lastResults.results.map((r) => ({ name: nm.get(r.playerId) ?? r.playerId, placement: r.placement, score: r.score })).sort((a, b) => a.placement - b.placement);
    const wid = st.lastRound && st.lastRound.minigameId === last.game ? st.lastRound.winnerId : null;
    last.winner = (wid && nm.get(wid)) || last.placements[0]?.name || null;
  }
  if (st.phase === 'GAME_FINISHED' && !printedFinal) {
    printedFinal = true;
    printReport();
  }
}

function printReport(): string {
  const text = buildReport();
  console.info('%s', text);
  return text;
}

function togglePanel(): void {
  reportShown = !reportShown;
  if (!reportShown) {
    if (panel) panel.style.display = 'none';
    return;
  }
  if (!panel) {
    panel = document.createElement('pre');
    panel.style.cssText =
      'position:fixed;left:8px;right:8px;top:8px;max-height:90vh;overflow:auto;z-index:100001;margin:0;padding:12px 14px;border-radius:12px;background:rgba(5,8,20,.94);color:#a7f3d0;font:12px/1.45 ui-monospace,Menlo,Consolas,monospace;white-space:pre;';
    document.body.appendChild(panel);
  }
  panel.style.display = 'block';
  panel.textContent = printReport() + '\n\n[F4 chiude]';
}

/** Da chiamare una volta all'avvio (app/main.ts): non fa nulla fuori dal debug. */
export function initTelemetry(): void {
  if (active || !debugEnabled()) return;
  active = true;
  // fps dell'host: un campione al secondo, registrato solo mentre un minigioco e' in corso
  let frames = 0;
  let last = performance.now();
  const loop = (now: number): void => {
    frames++;
    if (now - last >= 1000) {
      const fps = Math.round((frames * 1000) / (now - last));
      frames = 0;
      last = now;
      if (cur?.open && (gm.state as unknown as State | null)?.phase === 'MINIGAME_PLAYING') cur.fps.push(fps);
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  setInterval(tick, 400);

  // skip / ritorno alla lobby: si osservano avvolgendo i metodi (GameManager non viene modificato)
  const g = gm as unknown as Record<string, () => void>;
  for (const [method, kind] of [['skipMinigame', 'skip'], ['restartMatch', 'lobby'], ['backToLobby', 'lobby']] as const) {
    const orig = g[method]?.bind(gm);
    if (!orig) continue;
    g[method] = (): void => {
      telemetry.mark(kind);
      orig();
    };
  }
  window.addEventListener('error', (e) => noteError(String(e.message)));
  window.addEventListener('unhandledrejection', (e) => noteError(String((e.reason as Error)?.message ?? e.reason)));
  const ce = console.error.bind(console);
  console.error = (...a: unknown[]): void => {
    noteError(a.map((x) => (x instanceof Error ? x.message : String(x))).join(' '));
    ce(...a);
  };
  window.addEventListener('keydown', (e) => {
    if (e.key === 'F4' && !e.repeat) {
      e.preventDefault();
      togglePanel();
    }
  });
  const w = window as unknown as Record<string, unknown>;
  w.__sessionReport = printReport;
  w.__session = { records, totals };
}

export const telemetry = {
  /** restart del minigioco (menu ESC), skip, ritorno alla lobby. */
  mark(kind: 'restart' | 'skip' | 'lobby'): void {
    if (!active) return;
    if (kind === 'restart') {
      totals.restarts++;
      if (cur?.open) cur.restarts++;
    } else if (kind === 'skip') {
      totals.skips++;
      if (cur) cur.skipped = true;
    } else totals.lobbyReturns++;
  },
  /** metriche di bilanciamento di fine gioco (i giochi le calcolano gia': qui vengono solo raccolte). */
  metrics(game: string, values: Record<string, unknown>): void {
    if (!active) return;
    const r = [...records].reverse().find((x) => x.game === game);
    if (r) Object.assign(r.metrics, values);
  }
};
