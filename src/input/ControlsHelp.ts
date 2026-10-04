import { game as gm } from '../core/GameManager';
import { debugEnabled } from '../core/debug';
import { getMinigame } from '../../shared/minigames';
import { pads } from './GamepadManager';
import { profileFor } from './profiles';
import { bindingLabel, padFamily, type PadFamily } from './padTypes';

/**
 * SCHERMATA CONTROLLI (host). Compare dopo l'intro e PRIMA del countdown 3-2-1-VIA di ogni minigioco giocato col controller, e per
 * Cultura o Cazzata mostra "PRENDETE I TELEFONI". Le righe NON sono scritte a mano nelle scene: arrivano da profiles.ts, la stessa
 * fonte da cui il GamepadManager ricava l'input, cosi' la TV non puo' mai dire "A = dash" mentre il codice usa un altro tasto.
 *
 * Il minigioco chiama ctx.showControls() quando e' pronto (dopo il caricamento) e attende la promessa. Mentre la schermata e' su:
 *  - il gioco non avanza (timer, fisica, countdown fermi: lo garantisce il minigioco aspettando la promessa);
 *  - il gamepad e' nel contesto CONTROLS (input ignorato); alla fine si azzera tutto e i tasti ancora tenuti restano bloccati
 *    finche' non vengono rilasciati (tenere premuto A mentre si legge NON fa fare il dash al VIA);
 *  - nessun giocatore puo' saltarla. Solo in debug/dev l'host puo' premere Invio.
 */

/** Durata predefinita della schermata, in millisecondi (una sola costante: nessuna scena la ripete). */
export const CONTROL_HELP_MS = 2700;
let helpMs = CONTROL_HELP_MS;

export function setControlHelpMs(ms: number): void {
  if (Number.isFinite(ms) && ms >= 0 && ms <= 15000) helpMs = ms;
}

const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

const CSS = `
#pad-controls{position:fixed;inset:0;z-index:95000;display:flex;align-items:center;justify-content:center;background:rgba(3,6,18,.92);font-family:Arial,Helvetica,sans-serif;color:#e5e7eb}
#pad-controls .cc-card{width:min(760px,92vw);padding:28px 34px 22px;border-radius:22px;background:#0b1224;border:3px solid #fbbf24;text-align:center;box-shadow:0 20px 80px rgba(0,0,0,.6)}
#pad-controls .cc-icon{font-size:64px;line-height:1;margin-bottom:6px}
#pad-controls .cc-title{font-size:38px;font-weight:900;letter-spacing:1px;color:#fbbf24}
#pad-controls .cc-sub{margin:6px 0 18px;font-size:22px;font-weight:800;color:#93c5fd;letter-spacing:2px}
#pad-controls .cc-row{display:flex;align-items:center;gap:18px;margin:10px 0;padding:10px 16px;border-radius:14px;background:#111a30;text-align:left}
#pad-controls .cc-key{min-width:210px;text-align:center;padding:8px 14px;border-radius:12px;background:#1e293b;border:2px solid #475569;font-size:26px;font-weight:900;color:#fff;white-space:nowrap}
#pad-controls .cc-lab{font-size:28px;font-weight:800}
#pad-controls .cc-note{margin-top:14px;font-size:16px;color:#94a3b8}
#pad-controls .cc-big{margin:24px 0 8px;font-size:46px;font-weight:900;color:#fff}
#pad-controls .cc-bar{height:6px;margin-top:18px;border-radius:3px;background:#1e293b;overflow:hidden}
#pad-controls .cc-bar i{display:block;height:100%;width:100%;background:#fbbf24;transform-origin:left;animation:cc-shrink linear forwards}
@keyframes cc-shrink{from{transform:scaleX(1)}to{transform:scaleX(0)}}
#pad-retake{position:fixed;left:50%;top:9vh;transform:translateX(-50%);z-index:95000;pointer-events:none;font-family:Arial,Helvetica,sans-serif;color:#e5e7eb}
#pad-retake .cc-card{width:min(640px,90vw);padding:22px 30px 18px;border-radius:22px;background:#0b1224;border:3px solid #34d399;text-align:center;box-shadow:0 20px 80px rgba(0,0,0,.6)}
#pad-retake .cc-icon{font-size:52px;line-height:1;margin-bottom:4px}
#pad-retake .cc-title{font-size:28px;font-weight:900;color:#fbbf24}
#pad-retake .cc-big{margin:16px 0 6px;font-size:42px;font-weight:900;color:#fff}
#pad-retake .cc-sub{font-size:18px;font-weight:800;color:#93c5fd;letter-spacing:2px}
`;

let root: HTMLDivElement | null = null;
let active: Promise<void> | null = null;
let finish: (() => void) | null = null;
let styled = false;

function families(): PadFamily[] {
  const set = new Set<PadFamily>();
  for (const id of pads.pairedPadIds()) set.add(padFamily(id));
  return set.size ? [...set] : ['generic'];
}

/** Intestazione comune a TUTTE le schermate (controller, telefoni, ripresa controller): icona, nome. Un solo layout per ogni gioco. */
function header(minigameId: string): string {
  const def = getMinigame(minigameId);
  return `${def?.icon ? `<div class="cc-icon">${esc(def.icon)}</div>` : ''}<div class="cc-title">${esc(def?.name ?? minigameId)}</div>`;
}

function build(minigameId: string, mode: 'pad' | 'phone'): string {
  const bar = `<div class="cc-bar"><i style="animation-duration:${helpMs}ms"></i></div>`;
  if (mode === 'phone') {
    return `<div class="cc-card">${header(minigameId)}<div class="cc-big">📱 PRENDETE I TELEFONI</div><div class="cc-sub">SERVONO PER SCRIVERE E VOTARE</div>${bar}</div>`;
  }
  const profile = profileFor(minigameId)!;
  const fams = families();
  const rows = profile.controls
    .map((c) => {
      const labels = [...new Set(fams.map((f) => bindingLabel(c.binding, f)))].join(' / ');
      return `<div class="cc-row"><span class="cc-key">${esc(labels)}</span><span class="cc-lab">${esc(c.label)}</span></div>`;
    })
    .join('');
  const someoneWithoutPad = (gm.state?.players ?? []).some((p) => !(p as { pad?: string }).pad);
  const note = someoneWithoutPad ? '<div class="cc-note">Chi non ha il controller gioca col telefono (📱 modalità fallback)</div>' : '';
  return `<div class="cc-card">${header(minigameId)}<div class="cc-sub">🎮 CONTROLLI</div>${rows}${note}${bar}</div>`;
}

/**
 * Mostra la schermata adatta al minigioco e risolve quando finisce. Se non serve (nessun controller in stanza, oppure gioco non
 * ancora migrato al controller) risolve subito: nessuna schermata, nessun ritardo.
 */
export function showControlsHelp(minigameId: string): Promise<void> {
  if (active) return active;
  const def = getMinigame(minigameId);
  if (!def || pads.pairedCount() === 0) return Promise.resolve();
  let mode: 'pad' | 'phone';
  if (def.inputMode === 'PHONE_TEXT') mode = 'phone';
  else if (def.inputMode === 'GAMEPAD' && profileFor(minigameId)) mode = 'pad';
  else return Promise.resolve();

  ensureStyle();
  root = document.createElement('div');
  root.id = 'pad-controls';
  root.innerHTML = build(minigameId, mode);
  document.body.appendChild(root);
  if (mode === 'pad') pads.beginControls();

  active = new Promise<void>((resolve) => {
    let done = false;
    const unsub = gm.events.on('state', (s) => {
      // il round e' finito/saltato mentre la schermata era su: chiudila subito
      if ((s as { phase?: string }).phase !== 'MINIGAME_PLAYING') end();
    });
    const onKey = (e: KeyboardEvent): void => {
      if (debugEnabled() && (e.key === 'Enter' || e.key === ' ') && !e.repeat) end(); // solo debug/dev: l'host puo' saltarla
    };
    window.addEventListener('keydown', onKey);
    const timer = window.setTimeout(end, helpMs);
    function end(): void {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      window.removeEventListener('keydown', onKey);
      unsub();
      root?.remove();
      root = null;
      if (mode === 'pad') pads.endControls(); // azzera stick/tasti/edge: nessun input accumulato durante la lettura
      active = null;
      finish = null;
      resolve();
    }
    finish = end;
  });
  return active;
}

/** Chiude subito la schermata (usato dai test e allo smontaggio forzato). */
export function dismissControlsHelp(): void {
  finish?.();
}

function ensureStyle(): void {
  if (styled) return;
  const st = document.createElement('style');
  st.textContent = CSS;
  document.head.appendChild(st);
  styled = true;
}

/**
 * Fine di un gioco da telefono (Cultura o Cazzata) in una sessione con controller: "🎮 RIPRENDETE I CONTROLLER", ben visibile
 * ma senza bloccare nulla (nessun input toccato, i risultati restano leggibili sotto). Sparisce da sola dopo CONTROL_HELP_MS.
 */
let retakeTimer = 0;
function showRetakeControllers(minigameId: string): void {
  ensureStyle();
  document.getElementById('pad-retake')?.remove();
  const el = document.createElement('div');
  el.id = 'pad-retake';
  el.innerHTML = `<div class="cc-card">${header(minigameId)}<div class="cc-big">🎮 RIPRENDETE I CONTROLLER</div><div class="cc-sub">I TELEFONI TORNANO SUL TAVOLO</div></div>`;
  document.body.appendChild(el);
  window.clearTimeout(retakeTimer);
  retakeTimer = window.setTimeout(() => el.remove(), helpMs);
}

export function initControlsHelp(): void {
  gm.controlsGate = (id) => showControlsHelp(id);
  // Osserva solo lo stato (nessuna modifica a GameManager): quando un gioco PHONE_TEXT termina e ci sono controller associati.
  let prev: { phase: string; game: string | null } = { phase: '', game: null };
  gm.events.on('state', (s) => {
    const st = s as { phase?: string; currentMinigame?: { minigameId: string } | null };
    const phase = st.phase ?? '';
    const game = st.currentMinigame?.minigameId ?? prev.game;
    if (prev.phase === 'MINIGAME_PLAYING' && phase !== 'MINIGAME_PLAYING' && prev.game && getMinigame(prev.game)?.inputMode === 'PHONE_TEXT' && pads.pairedCount() > 0) {
      showRetakeControllers(prev.game);
    }
    prev = { phase, game };
  });
  try {
    const q = new URLSearchParams(location.search).get('helpms');
    if (q && debugEnabled()) setControlHelpMs(Number(q));
  } catch {
    /* ignora */
  }
}
