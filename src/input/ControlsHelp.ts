import { game as gm } from '../core/GameManager';
import { debugEnabled } from '../core/debug';
import { controlsOverlay } from '../core/musicDirector';
import { getMinigame } from '../../shared/minigames';
import { pads } from './GamepadManager';
import { profileFor } from './profiles';
import { bindingLabel, padFamily, type PadFamily } from './padTypes';
import { ensureUiCss } from '../core/uiDom';
import { abilityFor } from '../../shared/abilityCatalog';
import { CHARACTERS } from '../../shared/characters';
import { presentationOf } from '../../shared/characterPresentation';
import { ABILITY_SYMBOLS, iconSvg } from '../../shared/charIcons';

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

/**
 * Durata predefinita della schermata, in millisecondi (una sola costante: nessuna scena la ripete). 5 s: oltre ai tasti ci sono le
 * ABILITA' dei personaggi presenti (nome + una riga), che in 2,7 s non si leggono. Il gioco resta fermo per tutto il tempo.
 */
export const CONTROL_HELP_MS = 5000;
let helpMs = CONTROL_HELP_MS;

export function setControlHelpMs(ms: number): void {
  if (Number.isFinite(ms) && ms >= 0 && ms <= 15000) helpMs = ms;
}

const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

// stile: design system comune (core/uiDom.ts) + poche regole proprie
const CSS = `
#pad-controls{z-index:95000}
#pad-controls .ui-card{animation:ui-in .22s cubic-bezier(.2,1.4,.4,1)}
#pad-controls .ui-key.special{border-color:var(--ui-accent);background:rgba(251,191,36,.14)}
#pad-controls .ui-key.special .ui-act{color:var(--ui-accent)}
.ui-abil{margin-top:clamp(10px,1.8vh,20px);padding:clamp(8px,1.4vh,16px) clamp(12px,1.6vw,22px);border-radius:var(--ui-r-m);background:var(--ui-panel-strong);border:2px solid var(--ui-accent);text-align:left}
.ui-abil-title{font-family:var(--ui-display);font-size:clamp(15px,2.3vh,26px);letter-spacing:.1em;color:var(--ui-accent);display:flex;align-items:center;gap:.6em;margin-bottom:.35em}
.ui-abil-row{display:flex;align-items:center;gap:.7em;padding:.18em 0;font-size:clamp(14px,2.1vh,24px);line-height:1.2}
.ui-abil-row svg{flex:none;width:1.7em;height:1.7em}
.ui-abil-who{flex:none;font-family:var(--ui-display);min-width:5.6em}
.ui-abil-name{flex:none;font-family:var(--ui-display);color:var(--ui-text)}
.ui-abil-short{color:var(--ui-dim);font-weight:700}
#pad-controls .ui-tips{margin-top:clamp(8px,1.4vh,16px);display:flex;flex-direction:column;gap:.2em;font-family:var(--ui-display);font-size:clamp(14px,2.1vh,24px);color:var(--ui-accent);letter-spacing:.04em}
#pad-retake{position:fixed;left:50%;top:8vh;transform:translateX(-50%);z-index:95000;pointer-events:none;font-family:var(--ui-body);color:var(--ui-text)}
#pad-retake .ui-card{border-color:var(--ui-success);width:min(680px,86vw)}
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
  return `${def?.icon ? `<div class="ui-icon">${esc(def.icon)}</div>` : ''}<div class="ui-title">${esc(def?.name ?? minigameId)}</div>`;
}

/**
 * Consigli della PRIMA volta (tre righe, mai di piu'): solo per i giochi che ne hanno bisogno. La prima volta che il gioco viene
 * mostrato su questo host compaiono sotto i comandi; dopo non piu' (localStorage, mai bloccante se non disponibile).
 */
const FIRST_TIME_TIPS: Record<string, string[]> = {
  cornicione: ['PIÙ % HAI, PIÙ LONTANO VOLI.', 'CADI FUORI = PERDI UNA VITA.', 'SALTI + SCHIVATA + RECOVERY TI FANNO TORNARE.']
};
function takeFirstTimeTips(minigameId: string, consume: boolean): string {
  const tips = FIRST_TIME_TIPS[minigameId];
  if (!tips) return '';
  const key = `ricchioni.tips.${minigameId}`;
  try {
    if (consume) {
      if (localStorage.getItem(key)) return '';
      localStorage.setItem(key, '1');
    }
  } catch {
    /* storage non disponibile: li mostra */
  }
  return `<div class="ui-tips">${tips.map((t) => `<div>👉 ${esc(t)}</div>`).join('')}</div>`;
}

function build(minigameId: string, mode: 'pad' | 'phone', consumeTips = true): string {
  const bar = `<div class="ui-bar"><i style="animation-duration:${helpMs}ms"></i></div>`;
  if (mode === 'phone') {
    return `<div class="ui-card">${header(minigameId)}<div class="ui-big">📱 PRENDETE I TELEFONI</div><div class="ui-sub">SERVONO PER SCRIVERE E VOTARE</div>${abilityBlock(minigameId, '⚡ SUL TELEFONO')}${bar}</div>`;
  }
  const profile = profileFor(minigameId)!;
  const fams = families();
  // l'ABILITA' e' il comando speciale: sempre presente (anche se i comandi fossero piu' di 6) e disegnata in evidenza
  const ordered = [...profile.controls.filter((c) => c.action !== 'ABILITY').slice(0, 5), ...profile.controls.filter((c) => c.action === 'ABILITY')];
  const labelsOf = (c: (typeof ordered)[number]): string => [...new Set(fams.map((f) => bindingLabel(c.binding, f)))].join(' / ');
  const rows = ordered
    .map((c) => {
      // tasto disegnato come tasto + azione breve
      return `<div class="ui-key${c.action === 'ABILITY' ? ' special' : ''}"><span class="ui-cap">${esc(labelsOf(c))}</span><span class="ui-act">${c.action === 'ABILITY' ? '⚡ ' : ''}${esc(c.label)}</span></div>`;
    })
    .join('');
  const abilityKey = ordered.find((c) => c.action === 'ABILITY');
  const someoneWithoutPad = (gm.state?.players ?? []).some((p) => !(p as { pad?: string }).pad);
  const note = someoneWithoutPad ? '<div class="ui-note">📱 Chi non ha il controller gioca col telefono</div>' : '';
  return `<div class="ui-card">${header(minigameId)}<div class="ui-sub">🎮 CONTROLLI</div><div class="ui-keys">${rows}</div>${abilityBlock(minigameId, abilityKey ? `⚡ ABILITÀ · ${labelsOf(abilityKey)}` : '⚡ ABILITÀ')}${takeFirstTimeTips(minigameId, consumeTips)}${note}${bar}</div>`;
}

/**
 * Blocco ABILITA' della schermata: una riga per ogni personaggio in stanza (icona, chi, nome dell'abilita', cosa fa in una riga).
 * Testi dal catalogo (shared/abilityCatalog.ts): la stessa fonte della card sul telefono e dell'HUD. Vuoto se nessuno ha abilita'.
 */
function abilityBlock(minigameId: string, title: string): string {
  const seen = new Set<string>();
  const rows: string[] = [];
  for (const p of gm.state?.players ?? []) {
    const cid = p.characterId;
    if (!cid || seen.has(cid)) continue;
    seen.add(cid);
    const ab = abilityFor(minigameId, cid);
    const ch = CHARACTERS[cid];
    if (!ab || !ch) continue;
    const accent = presentationOf(cid)?.accent ?? ch.color;
    rows.push(
      `<div class="ui-abil-row">${iconSvg(ABILITY_SYMBOLS[cid], 32)}<span class="ui-abil-who" style="color:${accent}">${esc(ch.roleTitle.replace(/^IL /, ''))}</span><span class="ui-abil-name">${esc(ab.name)}</span><span class="ui-abil-short">${esc(ab.short)}</span></div>`
    );
  }
  if (!rows.length) return '';
  return `<div class="ui-abil"><div class="ui-abil-title">${esc(title)}</div>${rows.join('')}</div>`;
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
  root.className = 'ui-overlay';
  root.innerHTML = build(minigameId, mode);
  document.body.appendChild(root);
  if (mode === 'pad') pads.beginControls();
  controlsOverlay(true); // musica sotto mentre si leggono i comandi

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
      controlsOverlay(false);
      if (mode === 'pad') pads.endControls(); // azzera stick/tasti/edge: nessun input accumulato durante la lettura
      active = null;
      finish = null;
      resolve();
    }
    finish = end;
  });
  return active;
}

/** SOLO galleria UI (?ui=1): la schermata CONTROLLI anche senza controller collegati, con lo stesso markup. */
export function previewControls(minigameId: string, mode: 'pad' | 'phone'): void {
  ensureStyle();
  document.getElementById('pad-controls')?.remove();
  const el = document.createElement('div');
  el.id = 'pad-controls';
  el.className = 'ui-overlay';
  el.innerHTML = build(minigameId, mode, false);
  document.body.appendChild(el);
  window.setTimeout(() => el.remove(), 60000);
}

/** Chiude subito la schermata (usato dai test e allo smontaggio forzato). */
export function dismissControlsHelp(): void {
  finish?.();
}

function ensureStyle(): void {
  ensureUiCss();
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
  el.innerHTML = `<div class="ui-card">${header(minigameId)}<div class="ui-big">🎮 RIPRENDETE I CONTROLLER</div><div class="ui-sub">I TELEFONI TORNANO SUL TAVOLO</div></div>`;
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
