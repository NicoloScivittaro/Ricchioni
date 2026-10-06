import { game as gm } from '../core/GameManager';
import { CHARACTERS } from '../../shared/characters';
import { MINIGAME_DEFINITIONS } from '../../shared/minigames';
import { pads } from './GamepadManager';
import { portraitCss } from '../core/portraits';
import { audio } from '../core/AudioManager';
import { PAD_CONTROLS, padFamily, padLabel } from './padTypes';
import { ensureUiCss } from '../core/uiDom';

/**
 * PANNELLO "🎮 COLLEGA I CONTROLLER" (host, DOM sopra il canvas: nessuna scena Phaser toccata).
 *
 *  - in LOBBY compare da solo quando un controller libero viene toccato, oppure con il tasto G;
 *  - mostra per ogni giocatore lo stato ("PREMI A / ✕ PER COLLEGARTI" / 🎮 CONNESSO / ⚠️ DISCONNESSO / 📱 USERÀ IL TELEFONO) e le istruzioni di associazione;
 *  - TEST CONTROLLER: stick, grilletti, tasti, rumble, indice e id di ogni controller esposto dal browser;
 *  - fuori dalla lobby resta solo la barra rossa "CONTROLLER DI CIRO DISCONNESSO - PREMI A PER RICONNETTERE" (se serve) e i messaggi.
 */

const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

interface St {
  phase: string;
  paused?: boolean;
  players: { id: string; displayName: string; characterId: string | null; connected: boolean }[];
}

/** Gioco attivo (non in pausa): il pannello non deve coprire il gameplay. Fuori da qui (lobby, rullo, risultati, pausa) si puo' aprire con G. */
function activePlay(st: St | null): boolean {
  return st?.phase === 'MINIGAME_PLAYING' && !st.paused;
}

/** Simbolo del tasto principale per TUTTE le famiglie di controller presenti (es. "A / ✕"), mai un nome tecnico. */
function primaryForRoom(): string {
  const fams = [...new Set(pads.views().map((v) => v.family))];
  const labels = [...new Set((fams.length ? fams : (['xbox', 'playstation'] as const)).map((f) => padLabel('PRIMARY', f)))];
  return labels.join(' / ');
}

/** Riepilogo leggibile a colpo d'occhio: "4 🎮 + 1 📱" (o "5 🎮"). Non blocca mai: chi non ha il controller usa il telefono. */
export function readySummary(): string {
  const slots = pads.slotList();
  const withPad = slots.filter((s) => s.state === 'paired').length;
  const phone = slots.length - withPad;
  if (!slots.length) return '';
  return phone ? `${withPad} 🎮 + ${phone} 📱` : `${withPad} 🎮`;
}

let root: HTMLDivElement;
let badge: HTMLDivElement;
let alertBar: HTMLDivElement;
let focusBar: HTMLDivElement;
let toasts: HTMLDivElement;
let open = false;
let dismissed = false;
let testView = false;
/** impostazioni per giocatore (vibrazione, mira FPS, Y invertita): nascoste finche' non servono */
let showOpts = false;
let started = false;

const css = `
#pad-root{position:fixed;inset:0;z-index:90000;display:none;align-items:center;justify-content:center;background:rgba(5,6,14,.92);font-family:var(--ui-body);color:var(--ui-text)}
#pad-root .box{width:min(900px,92vw);max-height:90vh;overflow:auto;padding:clamp(16px,2.6vh,30px) clamp(20px,2.6vw,34px);border-radius:var(--ui-r-l);background:var(--ui-panel);border:3px solid var(--ui-accent);box-shadow:0 24px 90px rgba(0,0,0,.65)}
#pad-root h2{margin:0 0 4px;font-family:var(--ui-display);font-size:clamp(22px,3.4vh,40px);letter-spacing:.02em;white-space:nowrap}
#pad-root.open ~ #pad-toasts{top:auto;bottom:4vh}
#pad-root .hint{margin:0 0 14px;color:var(--ui-accent);font-family:var(--ui-display);font-size:clamp(16px,2.6vh,28px)}
#pad-root .row{display:flex;align-items:center;gap:12px;padding:10px 12px;margin:6px 0;border-radius:12px;background:#111a30;border:2px solid transparent;cursor:pointer}
#pad-root .row.target{border-color:#fbbf24}
#pad-root .row.cursor{border-color:#38bdf8}
#pad-root .dot{width:14px;height:14px;border-radius:50%;flex:none}
#pad-root .who{flex:1;min-width:0}
#pad-root .who b{display:block;font-family:var(--ui-display);font-size:clamp(18px,2.8vh,30px)}
#pad-root .who span{font-size:clamp(13px,1.8vh,18px);color:#94a3b8}
#pad-root .ava{font-size:36px;line-height:1;flex:none;width:44px;text-align:center}
#pad-root .st{font-family:var(--ui-display);font-size:clamp(16px,2.4vh,26px);text-align:right;flex:none}
#pad-root .st small{display:block;font-size:12px;font-weight:700;color:#94a3b8;margin-top:2px}
#pad-root .head{display:flex;align-items:baseline;justify-content:space-between;gap:12px}
#pad-root .ready{font-family:var(--ui-display);font-size:clamp(24px,4vh,44px);color:#fff;white-space:nowrap}
#pad-root .note{margin:12px 0 0;font-size:clamp(14px,2vh,20px);color:var(--ui-info);font-weight:700}
#pad-root .note.warn{color:#f87171}
#pad-root .foot .main{font-family:var(--ui-display);font-size:clamp(16px,2.4vh,26px);padding:10px 26px;background:var(--ui-success);color:#062012}
#pad-root .foot .dbg{margin-left:auto;background:transparent;color:#64748b;font-weight:600}
#pad-root .ok{color:#34d399}.warn{color:#f87171}.none{color:#94a3b8}.cur{color:#38bdf8}
#pad-root button{font:700 13px Arial;border:0;border-radius:8px;padding:6px 10px;background:#1e293b;color:#e5e7eb;cursor:pointer}
#pad-root button:hover{background:#334155}
#pad-root .foot{display:flex;gap:10px;margin-top:14px;flex-wrap:wrap}
#pad-root .set{display:none;gap:6px;align-items:center;font-size:13px;color:#94a3b8;margin-top:6px;flex-wrap:wrap}
#pad-root.opts .set{display:flex}
#pad-root .set b{display:inline;font-size:13px;color:#e5e7eb}
#pad-root table{width:100%;border-collapse:collapse;font:12px ui-monospace,Menlo,Consolas,monospace}
#pad-root td,#pad-root th{padding:4px 6px;text-align:left;border-bottom:1px solid #1e293b;vertical-align:top}
#pad-badge{position:fixed;left:3.75vw;bottom:4.5vh;z-index:89000;padding:.4em 1em;border-radius:999px;background:rgba(11,11,20,.88);border:2px solid var(--ui-line);color:#e5e7eb;font-family:var(--ui-display);font-size:clamp(14px,2vh,22px);cursor:pointer;display:none}
#pad-alert{z-index:99000;display:none;white-space:nowrap;max-width:92vw;overflow:hidden;text-overflow:ellipsis}
#pad-focus{z-index:99000;display:none;top:auto;bottom:4.5vh}
#pad-toasts{position:fixed;left:50%;transform:translateX(-50%);top:12vh;z-index:99500;display:flex;flex-direction:column;gap:8px;align-items:center;pointer-events:none}
`;

function phase(): string {
  return (gm.state as unknown as St | null)?.phase ?? '';
}

function render(): void {
  const st = gm.state as unknown as St | null;
  const inLobby = st?.phase === 'LOBBY';
  const slots = pads.slotList();
  const free = pads.freePads();

  // auto-apertura: un controller libero viene toccato in lobby
  if (inLobby && !open && !dismissed && free.length && slots.some((s) => s.state !== 'paired')) open = true;
  // si chiude da solo SOLO quando parte il gameplay vero; nei risultati/rullo/pausa resta apribile con G (es. ritoccare la sensibilita' FPS)
  if (activePlay(st)) {
    open = false;
    dismissed = false;
  }

  badge.style.display = inLobby && !open && slots.length ? 'block' : 'none';
  badge.textContent = `${readySummary()} · premi G`;

  // barra rossa: controller scollegato (o in attesa dopo un ricaricamento)
  const waiting = slots.filter((s) => s.state === 'awaiting');
  if (waiting.length && st?.phase !== 'GAME_FINISHED') {
    alertBar.style.display = 'block';
    const names = waiting.map((s) => pads.playerLabel(s.playerId)).join(' / ');
    alertBar.textContent = free.length
      ? `⚠️ CONTROLLER DI ${names} DISCONNESSO — PREMI ${padLabel('PRIMARY', padFamily(free[0].id))} PER RICONNETTERE`
      : `⚠️ CONTROLLER DI ${names} DISCONNESSO`;
  } else alertBar.style.display = 'none';

  root.style.display = open ? 'flex' : 'none';
  root.classList.toggle('opts', showOpts);
  root.classList.toggle('open', open); // pannello aperto: i messaggi brevi vanno in basso (non sopra il titolo)
  if (!open) return;
  root.innerHTML = testView ? renderTest() : renderPairing();
}

const FAMILY_NAME = { xbox: 'Xbox', playstation: 'PlayStation', generic: 'Controller' } as const;

function renderPairing(): string {
  const st = gm.state as unknown as St;
  const slots = pads.slotList();
  const free = pads.freePads();
  const target = pads.getTarget();
  const primary = free.length ? padLabel('PRIMARY', padFamily(free[0].id)) : primaryForRoom();
  let hint = `PREMI ${primary} SUL CONTROLLER CHE VUOI USARE`;
  if (target) hint = `${pads.playerLabel(target)}: PREMI ${primary} SUL TUO CONTROLLER`;
  else if (free.length) hint = `CONTROLLER LIBERO: SCEGLI IL TUO GIOCATORE CON ⬆⬇ E CONFERMA CON ${primary}`;
  const paired = slots.filter((s) => s.state === 'paired').length;
  let unpairedRank = 0;
  const rows = slots
    .map((s) => {
      const p = st.players.find((x) => x.id === s.playerId);
      const ch = p?.characterId ? CHARACTERS[p.characterId] : null;
      const color = ch?.color ?? '#64748b';
      const cur = pads.cursorOf(s.playerId);
      let status = `<span class="none">PREMI ${esc(primary)} PER COLLEGARTI</span>`;
      if (s.state === 'paired') {
        const v = pads.views().find((x) => x.index === s.padIndex);
        status = `<span class="ok">🎮 CONNESSO</span><small>${esc(v ? FAMILY_NAME[v.family] : 'Controller')}</small>`;
      } else if (s.state === 'awaiting') status = `<span class="warn">⚠️ DISCONNESSO</span><small>premi ${esc(primary)} sul suo controller</small>`;
      else if (cur !== null) status = '<span class="cur">◀ STA SCEGLIENDO ▶</span>';
      else if (target === s.playerId) status = `<span class="cur">PREMI ${esc(primary)} SUL CONTROLLER…</span>`;
      else if (!free.length && pads.detected > 0) status = `<span class="none">📱 USERÀ IL TELEFONO</span><small>${paired + ++unpairedRank}° controller non rilevato</small>`;
      // impostazioni del giocatore: piccole e leggibili, non un menu tecnico (vibrazione, sensibilita' mira FPS, Y invertita)
      const set = pads.settingsOf(s.playerId);
      const tools =
        s.state === 'paired'
          ? `<div class="set"><button data-act="vib" data-id="${s.playerId}">📳 ${set.vibration ? 'ON' : 'OFF'}</button><span>mira FPS</span><button data-act="sm" data-id="${s.playerId}">−</button><b>${set.sensitivity.toFixed(1)}</b><button data-act="sp" data-id="${s.playerId}">+</button><button data-act="inv" data-id="${s.playerId}">Y ${set.invertY ? 'INVERTITA' : 'normale'}</button><button data-act="un" data-id="${s.playerId}" title="scollega">✕</button></div>`
          : '';
      const name = p?.displayName ?? '?';
      const sub = `${ch?.roleTitle ?? ''}${p && !p.connected ? ' · telefono scollegato' : ''}`;
      return `<div class="row${target === s.playerId ? ' target' : ''}${cur !== null ? ' cursor' : ''}" data-act="target" data-id="${s.playerId}" style="border-left:6px solid ${color}">${p?.characterId ? `<span class="ava pic" style="${portraitCss(p.characterId, 44)}"></span>` : `<span class="ava">${esc(ch?.avatar ?? '🙂')}</span>`}<div class="who"><b style="color:${color}">${esc(name)}</b><span>${esc(sub)}</span>${tools}</div><div class="st">${status}</div></div>`;
    })
    .join('');
  const phoneGames = MINIGAME_DEFINITIONS.filter((m) => m.inputMode === 'PHONE_TEXT').map((m) => m.name);
  const note = `<p class="note">Tutti i giochi si giocano col controller${phoneGames.length ? ` · solo ${esc(phoneGames.join(', '))} usa il telefono` : ''}. Il controller resta di quella persona per tutta la serata.</p>`;
  const noExp = pads.detected < slots.length && pads.detected > 0 && !free.length ? `<p class="note warn">Il browser vede ${pads.detected} controller su ${slots.length} giocatori: gli altri giocano col telefono.</p>` : '';
  return `<div class="box"><div class="head"><h2>🎮 COLLEGA I CONTROLLER</h2><div class="ready">${esc(readySummary())}</div></div><p class="hint">${esc(hint)}</p>${rows || '<p>Nessun giocatore nella stanza.</p>'}${note}${noExp}
  <div class="foot"><button data-act="close" class="main">PRONTI (G)</button><button data-act="opts">⚙ IMPOSTAZIONI</button><button data-act="test" class="dbg">🧪 test controller</button></div></div>`;
}

function renderTest(): string {
  const views = pads.views();
  const cfgRows = views
    .map((v) => {
      const btns = PAD_CONTROLS.filter((c) => v.buttons[c]).map((c) => padLabel(c, v.family)).join(' ') || '—';
      const who = v.playerId ? pads.playerLabel(v.playerId) : 'libero';
      const set = v.playerId ? pads.settingsOf(v.playerId) : null;
      return `<tr><td>#${v.index}</td><td>${v.connected ? 'sì' : 'no'}</td><td>${esc(who)}</td><td>${esc(FAMILY_NAME[v.family])}<br><small>${esc(v.id.slice(0, 48))}</small></td><td>${v.standard ? 'standard' : '<b class="warn">NON standard</b>'}</td><td>LX ${v.left.x.toFixed(2)} LY ${v.left.y.toFixed(2)}<br>RX ${v.right.x.toFixed(2)} RY ${v.right.y.toFixed(2)}</td><td>LT ${v.lt.toFixed(2)}<br>RT ${v.rt.toFixed(2)}</td><td>${btns}</td><td>${v.rumble ? 'sì' : 'no'}${set && !set.vibration ? ' (spenta)' : ''}</td><td>${set ? set.sensitivity.toFixed(1) : '—'}</td><td>${set ? (set.invertY ? 'sì' : 'no') : '—'}</td></tr>`;
    })
    .join('');
  return `<div class="box"><h2>🧪 TEST CONTROLLER</h2><p class="hint">${views.length} controller esposti dal browser · contesto: ${pads.contextNow()}</p>
  <table><tr><th>idx</th><th>conn.</th><th>giocatore</th><th>famiglia</th><th>mapping</th><th>stick</th><th>grilletti</th><th>tasti premuti</th><th>rumble</th><th>sens.</th><th>Y inv.</th></tr>${cfgRows || '<tr><td colspan="11">Nessun controller: premi un tasto su un controller collegato.</td></tr>'}</table>
  <div class="foot"><button data-act="back">← COLLEGA I CONTROLLER</button><button data-act="close">CHIUDI</button></div></div>`;
}

function onClick(e: MouseEvent): void {
  const el = (e.target as HTMLElement).closest('[data-act]') as HTMLElement | null;
  if (!el) return;
  const act = el.dataset.act;
  const id = el.dataset.id ?? '';
  if (act === 'close') {
    open = false;
    dismissed = true;
  } else if (act === 'test') testView = true;
  else if (act === 'back') testView = false;
  else if (act === 'target') pads.setTarget(pads.getTarget() === id ? null : id);
  else if (act === 'un') pads.unassign(id);
  else if (act === 'vib') pads.updateSettings(id, { vibration: !pads.settingsOf(id).vibration });
  else if (act === 'inv') pads.updateSettings(id, { invertY: !pads.settingsOf(id).invertY });
  else if (act === 'sm') pads.updateSettings(id, { sensitivity: pads.settingsOf(id).sensitivity - 0.1 });
  else if (act === 'sp') pads.updateSettings(id, { sensitivity: pads.settingsOf(id).sensitivity + 0.1 });
  e.stopPropagation();
  render();
}

function toast(message: string, ms: number): void {
  // sotto l'avviso fisso in alto (mai sopra la striscia dei giocatori); se l'avviso dice gia' la stessa cosa il toast resta
  // nel DOM (lo leggono i test e le tecnologie assistive) ma non si vede: niente doppione a schermo
  const d = document.createElement('div');
  d.className = `ui-toast ${/DISCONNESS|PERSO|ERRORE/.test(message) ? 'warn' : /RICONNESS|COLLEGATO|CONNESSO/.test(message) ? 'ok' : ''}`;
  d.textContent = message;
  if (/DISCONNESS/.test(message) && alertBar.style.display === 'block') d.style.visibility = 'hidden';
  toasts.appendChild(d);
  window.setTimeout(() => d.remove(), ms);
  while (toasts.children.length > 3) toasts.firstElementChild?.remove();
}

export function initPairingPanel(): void {
  if (started) return;
  started = true;
  ensureUiCss();
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
  root = document.createElement('div');
  root.id = 'pad-root';
  badge = document.createElement('div');
  badge.id = 'pad-badge';
  alertBar = document.createElement('div');
  alertBar.id = 'pad-alert';
  alertBar.className = 'ui-alert';
  toasts = document.createElement('div');
  toasts.id = 'pad-toasts';
  focusBar = document.createElement('div');
  focusBar.id = 'pad-focus';
  focusBar.className = 'ui-alert warn';
  document.body.append(root, badge, alertBar, toasts, focusBar);
  root.addEventListener('click', onClick);
  badge.addEventListener('click', () => {
    open = true;
    render();
  });
  window.addEventListener('keydown', (e) => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = (e.target as HTMLElement | null)?.tagName ?? '';
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    // G apre il pannello ovunque TRANNE durante il gameplay attivo: in pausa (o fra un round e l'altro) si puo' ritoccare la
    // sensibilita' FPS e vale subito (FpsScene la rilegge a ogni fotogramma).
    if ((e.key === 'g' || e.key === 'G') && phase() !== '' && !activePlay(gm.state as unknown as St | null)) {
      open = !open;
      dismissed = !open;
      render();
    }
  });
  // senza focus il browser puo' non consegnare i controller alla pagina: meglio dirlo a schermo che lasciare i giocatori a muovere lo stick a vuoto
  window.setInterval(() => {
    const c = pads.contextNow();
    const relevant = (c === 'MINIGAME' || c === 'CONTROLS') && pads.pairedCount() > 0;
    const lost = relevant && !document.hasFocus();
    focusBar.style.display = lost ? 'block' : 'none';
    if (lost) focusBar.textContent = '⚠️ CLICCA SULLA FINESTRA DEL GIOCO — senza focus il browser può ignorare i controller';
  }, 500);
  pads.events.on('change', render);
  // suoni d'interfaccia: un controller in piu' associato = "pair"; avvisi di disconnessione / riconnessione
  let pairedBefore = pads.pairedCount();
  pads.events.on('change', () => {
    const n = pads.pairedCount();
    if (n > pairedBefore) audio.ui('pair');
    pairedBefore = n;
  });
  pads.events.on('toast', (t) => {
    const tt = String((t as { message?: string })?.message ?? '');
    if (/DISCONNESS/.test(tt)) audio.ui('disconnect');
    else if (/RICONNESS/.test(tt)) audio.ui('reconnect');
    const m = t as { message: string; ms: number };
    toast(m.message, m.ms);
  });
  gm.events.on('state', render);
  // il test mostra valori vivi: si aggiorna anche senza eventi
  window.setInterval(() => {
    if (open && testView) render();
  }, 120);
  render();
}
