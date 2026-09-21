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

function build(minigameId: string, mode: 'pad' | 'phone'): string {
  const def = getMinigame(minigameId);
  const title = `${def?.icon ?? ''} ${def?.name ?? minigameId}`.trim();
  const bar = `<div class="cc-bar"><i style="animation-duration:${helpMs}ms"></i></div>`;
  if (mode === 'phone') {
    return `<div class="cc-card"><div class="cc-title">${esc(title)}</div><div class="cc-big">📱 PRENDETE I TELEFONI</div><div class="cc-sub">SERVONO PER SCRIVERE E VOTARE</div>${bar}</div>`;
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
  return `<div class="cc-card"><div class="cc-title">${esc(title)}</div><div class="cc-sub">🎮 CONTROLLI</div>${rows}${note}${bar}</div>`;
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

  if (!styled) {
    const st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);
    styled = true;
  }
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

export function initControlsHelp(): void {
  gm.controlsGate = (id) => showControlsHelp(id);
  try {
    const q = new URLSearchParams(location.search).get('helpms');
    if (q && debugEnabled()) setControlHelpMs(Number(q));
  } catch {
    /* ignora */
  }
}
