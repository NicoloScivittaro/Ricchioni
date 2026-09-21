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
let copyBtn: HTMLButtonElement | null = null;
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

/** Sezioni del report: SESSION SUMMARY, un blocco per gioco, POTENTIAL BALANCE FLAGS. Solo lettura: non corregge mai nulla. */
const avgOf = (a: number[]): number => a.reduce((x, y) => x + y, 0) / a.length;
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const ord = (n: number): string => `${n}°`;

/**
 * SEGNALAZIONI DI BILANCIAMENTO. Soglie fisse e dichiarate; sono SOSPETTI da confermare con piu' partite, non verdetti:
 * per questo ogni riga riporta il campione (n) e, sotto 4 partite, l'avviso "campione piccolo".
 *  - Pallavolo: piu' del 70% dei punti da schiacciata diretta            -> schiacciata forse troppo forte
 *  - Calcio con squadre dispari: la squadra numerosa vince > 65%         -> handicap forse insufficiente (min. 2 partite)
 *  - Dodgeball: durata media < 30 s (stima normale ~75 s con festeggiamenti) -> tiro forse troppo forte
 */
export function balanceFlags(recs: Rec[] = records): string[] {
  const flags: string[] = [];
  const small = (n: number): string => (n < 4 ? ' — campione piccolo, da riconfermare' : '');
  // pallavolo
  let vPts = 0;
  let vDirect = 0;
  let vN = 0;
  for (const r of recs) {
    if (r.game !== 'volleyball') continue;
    const pts = num(r.metrics.rallies);
    const dir = num(r.metrics.smashPointsDirect);
    if (pts === null || dir === null || pts < 1) continue;
    vPts += pts;
    vDirect += dir;
    vN++;
  }
  if (vN && vPts >= 8 && vDirect / vPts > 0.7) flags.push(`Pallavolo: ${Math.round((vDirect / vPts) * 100)}% dei punti da schiacciata diretta (${vDirect}/${vPts}, ${vN} partite, soglia 70%) -> la schiacciata potrebbe essere troppo forte${small(vN)}`);
  // calcio: solo partite con squadre dispari (1 v 2, 2 v 3...)
  let sBig = 0;
  let sN = 0;
  for (const r of recs) {
    if (r.game !== 'soccer') continue;
    const m = /^(\d+)v(\d+)$/.exec(String(r.metrics.teams ?? ''));
    const w = r.metrics.winner;
    if (!m || (w !== 'r' && w !== 'b') || m[1] === m[2]) continue;
    sN++;
    if ((Number(m[1]) > Number(m[2])) === (w === 'r')) sBig++;
  }
  if (sN >= 2 && sBig / sN > 0.65) flags.push(`Calcio: la squadra numerosa vince ${Math.round((sBig / sN) * 100)}% delle partite dispari (${sBig}/${sN}, soglia 65%) -> l'handicap potrebbe non bastare${small(sN)}`);
  // dodgeball
  const dur = recs.filter((r) => r.game === 'dodgeball').map((r) => num(r.metrics.durationSec)).filter((x): x is number => x !== null);
  if (dur.length && avgOf(dur) < 30) flags.push(`Dodgeball: partite molto corte, durata media ${Math.round(avgOf(dur))} s su ${dur.length} (soglia 30 s) -> il tiro potrebbe essere troppo forte${small(dur.length)}`);
  return flags;
}

export function buildReport(): string {
  const now = Date.now();
  const totalSec = Math.max(1, Math.round((now - sessionStart) / 1000));
  const played = records.filter((r) => !r.skipped);
  const pc = records.map((r) => r.players);
  const fpsAll = records.flatMap((r) => r.fps);
  const L: string[] = [];
  const hr = '─'.repeat(60);

  L.push('=== SESSION SUMMARY ===');
  L.push(`Inizio ${new Date(sessionStart).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })} · durata totale ${fmtDur(totalSec)} (${Math.max(1, Math.round(totalSec / 60))} min)`);
  L.push(`Minigiochi: ${played.length} giocati${records.length !== played.length ? ` + ${records.length - played.length} saltati` : ''} · giocatori: ${pc.length ? (Math.min(...pc) === Math.max(...pc) ? String(pc[0]) : `${Math.min(...pc)}-${Math.max(...pc)}`) : '—'}`);
  L.push(`Disconnessioni ${totals.disconnects} · restart ${totals.restarts} · skip ${totals.skips} · ritorni alla lobby ${totals.lobbyReturns} · errori ${totals.errors}`);
  L.push(fpsAll.length ? `FPS host: medio ${Math.round(avgOf(fpsAll))} · peggior secondo ${Math.min(...fpsAll)}${fpsAll.some((f) => f < 25) ? ' · ⚠ sotto 25 in: ' + [...new Set(records.filter((r) => r.fps.some((f) => f < 25)).map((r) => r.name))].join(', ') : ''}` : 'FPS host: nessun campione');
  const byGame = new Map<string, number>();
  for (const r of played) byGame.set(r.name, (byGame.get(r.name) ?? 0) + 1);
  if (byGame.size) L.push(`Giochi usciti: ${[...byGame.entries()].sort((a, b) => b[1] - a[1]).map(([g, n]) => `${g} x${n}`).join(' · ')}`);
  if (totals.errorSamples.length) L.push(`Errori: ${totals.errorSamples.join(' | ')}`);

  L.push('', '=== PER GIOCO ===');
  if (!records.length) L.push('(nessun minigioco ancora giocato)');
  for (const r of records) {
    L.push(hr);
    L.push(`#${r.n} ${r.name}${r.skipped ? '  [SALTATO]' : ''} — round ${r.round} · durata ${fmtDur(r.durationSec)} · ${r.players} giocatori`);
    L.push(`  Piazzamento: ${r.placements.length ? r.placements.map((p) => `${ord(p.placement)} ${p.name}`).join(' · ') : r.skipped ? 'nessuno (saltato)' : 'non disponibile'}`);
    const avg = r.fps.length ? Math.round(avgOf(r.fps)) : null;
    const min = r.fps.length ? Math.min(...r.fps) : null;
    L.push(`  FPS host: ${avg === null ? '—' : `medio ${avg} · min ${min}`}`);
    L.push(`  Disconnessioni: ${r.disconnects.length ? r.disconnects.join(', ') : 'nessuna'} · restart: ${r.restarts} · skip: ${r.skipped ? 'sì' : 'no'}${r.errors.length ? ` · errori: ${r.errors.length}` : ''}`);
    if (Object.keys(r.metrics).length) L.push(`  Gameplay: ${fmtMetrics(r.metrics)}`);
  }

  L.push(hr, '', '=== POTENTIAL BALANCE FLAGS ===');
  const flags = balanceFlags();
  if (flags.length) for (const f of flags) L.push(`⚠ ${f}`);
  else L.push('Nessuna segnalazione con i dati raccolti finora.');
  L.push('(Solo segnalazioni: nessun valore viene modificato in automatico.)');
  return L.join('\n');
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
    if (copyBtn) copyBtn.style.display = 'none';
    return;
  }
  if (!panel) {
    panel = document.createElement('pre');
    panel.style.cssText =
      'position:fixed;left:8px;right:8px;top:8px;max-height:90vh;overflow:auto;z-index:100001;margin:0;padding:12px 14px;border-radius:12px;background:rgba(5,8,20,.94);color:#a7f3d0;font:12px/1.45 ui-monospace,Menlo,Consolas,monospace;white-space:pre;';
    document.body.appendChild(panel);
  }
  panel.style.display = 'block';
  panel.textContent = printReport() + '\n\n[F4 chiude · il pulsante COPIA mette il report negli appunti]';
  if (!copyBtn) {
    copyBtn = document.createElement('button');
    copyBtn.textContent = '📋 COPIA';
    copyBtn.style.cssText = 'position:fixed;top:16px;right:26px;z-index:100002;padding:6px 12px;border:0;border-radius:8px;background:#10b981;color:#052e21;font:700 12px ui-monospace,Menlo,Consolas,monospace;cursor:pointer;';
    copyBtn.onclick = (): void => void copyReport();
    document.body.appendChild(copyBtn);
  }
  copyBtn.style.display = 'block';
}

/** Copia il report negli appunti (Clipboard API; ripiego su execCommand perche' l'host puo' girare su http locale). */
async function copyReport(): Promise<boolean> {
  const text = buildReport();
  let ok = false;
  try {
    await navigator.clipboard.writeText(text);
    ok = true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;left:-9999px;top:0;';
      document.body.appendChild(ta);
      ta.select();
      ok = document.execCommand('copy');
      ta.remove();
    } catch {
      /* ignora */
    }
  }
  if (copyBtn) {
    copyBtn.textContent = ok ? '✅ COPIATO' : '⚠ SELEZIONA E COPIA A MANO';
    window.setTimeout(() => {
      if (copyBtn) copyBtn.textContent = '📋 COPIA';
    }, 1800);
  }
  return ok;
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
  w.__balanceFlags = balanceFlags;
  w.__copyReport = copyReport;
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
