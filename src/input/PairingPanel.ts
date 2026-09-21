import { game as gm } from '../core/GameManager';
import { CHARACTERS } from '../../shared/characters';
import { pads } from './GamepadManager';
import { PAD_CONTROLS, padFamily, padLabel } from './padTypes';

/**
 * PANNELLO "🎮 COLLEGA I CONTROLLER" (host, DOM sopra il canvas: nessuna scena Phaser toccata).
 *
 *  - in LOBBY compare da solo quando un controller libero viene toccato, oppure con il tasto G;
 *  - mostra per ogni giocatore lo stato ("NESSUN CONTROLLER" / collegato / scollegato) e le istruzioni di associazione;
 *  - TEST CONTROLLER: stick, grilletti, tasti, rumble, indice e id di ogni controller esposto dal browser;
 *  - fuori dalla lobby resta solo la barra rossa "CONTROLLER DI CIRO DISCONNESSO - PREMI A PER RICONNETTERE" (se serve) e i messaggi.
 */

const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

interface St {
  phase: string;
  players: { id: string; displayName: string; characterId: string | null; connected: boolean }[];
}

let root: HTMLDivElement;
let badge: HTMLDivElement;
let alertBar: HTMLDivElement;
let toasts: HTMLDivElement;
let open = false;
let dismissed = false;
let testView = false;
let started = false;

const css = `
#pad-root{position:fixed;inset:0;z-index:90000;display:none;align-items:center;justify-content:center;background:rgba(3,6,18,.93);font-family:Arial,Helvetica,sans-serif;color:#e5e7eb}
#pad-root .box{width:min(880px,94vw);max-height:92vh;overflow:auto;padding:22px 26px;border-radius:18px;background:#0b1224;border:2px solid #334155}
#pad-root h2{margin:0 0 4px;font-size:28px;letter-spacing:1px}
#pad-root .hint{margin:0 0 14px;color:#fbbf24;font-weight:700;font-size:18px}
#pad-root .row{display:flex;align-items:center;gap:12px;padding:10px 12px;margin:6px 0;border-radius:12px;background:#111a30;border:2px solid transparent;cursor:pointer}
#pad-root .row.target{border-color:#fbbf24}
#pad-root .row.cursor{border-color:#38bdf8}
#pad-root .dot{width:14px;height:14px;border-radius:50%;flex:none}
#pad-root .who{flex:1;min-width:0}
#pad-root .who b{display:block;font-size:19px}
#pad-root .who span{font-size:13px;color:#94a3b8}
#pad-root .st{font-weight:800;font-size:16px;text-align:right}
#pad-root .ok{color:#34d399}.warn{color:#f87171}.none{color:#94a3b8}.cur{color:#38bdf8}
#pad-root button{font:700 13px Arial;border:0;border-radius:8px;padding:6px 10px;background:#1e293b;color:#e5e7eb;cursor:pointer}
#pad-root button:hover{background:#334155}
#pad-root .foot{display:flex;gap:10px;margin-top:14px;flex-wrap:wrap}
#pad-root .set{display:flex;gap:6px;align-items:center;font-size:12px;color:#94a3b8}
#pad-root table{width:100%;border-collapse:collapse;font:12px ui-monospace,Menlo,Consolas,monospace}
#pad-root td,#pad-root th{padding:4px 6px;text-align:left;border-bottom:1px solid #1e293b;vertical-align:top}
#pad-badge{position:fixed;left:12px;bottom:12px;z-index:89000;padding:6px 12px;border-radius:999px;background:rgba(15,23,42,.85);color:#cbd5e1;font:700 13px Arial;cursor:pointer;display:none}
#pad-alert{position:fixed;left:0;right:0;top:0;z-index:99000;padding:10px 16px;text-align:center;background:#b91c1c;color:#fff;font:800 22px Arial;display:none}
#pad-toasts{position:fixed;left:50%;transform:translateX(-50%);top:14px;z-index:99500;display:flex;flex-direction:column;gap:8px;align-items:center;pointer-events:none}
#pad-toasts div{padding:10px 18px;border-radius:12px;background:rgba(15,23,42,.95);border:2px solid #475569;color:#fff;font:800 20px Arial}
`;

function phase(): string {
  return (gm.state as unknown as St | null)?.phase ?? '';
}

function render(): void {
  const st = gm.state as unknown as St | null;
  const inLobby = st?.phase === 'LOBBY';
  const slots = pads.slotList();
  const free = pads.freePads();
  const paired = slots.filter((s) => s.state === 'paired').length;

  // auto-apertura: un controller libero viene toccato in lobby
  if (inLobby && !open && !dismissed && free.length && slots.some((s) => s.state !== 'paired')) open = true;
  if (!inLobby) {
    open = false;
    dismissed = false;
  }

  badge.style.display = inLobby && !open ? 'block' : 'none';
  badge.textContent = `🎮 CONTROLLER ${paired}/${slots.length} · premi G`;

  // barra rossa: controller scollegato (o in attesa dopo un ricaricamento)
  const waiting = slots.filter((s) => s.state === 'awaiting');
  if (waiting.length && st?.phase !== 'GAME_FINISHED') {
    alertBar.style.display = 'block';
    const names = waiting.map((s) => pads.playerLabel(s.playerId)).join(' / ');
    const fam = padFamily(free[0]?.id ?? '');
    alertBar.textContent = free.length
      ? `⚠️ CONTROLLER DI ${names} SCOLLEGATO — PREMI ${padLabel('PRIMARY', fam) === 'BASSO' ? 'IL TASTO IN BASSO' : padLabel('PRIMARY', fam)} PER RICONNETTERE`
      : `⚠️ CONTROLLER DI ${names} DISCONNESSO`;
  } else alertBar.style.display = 'none';

  root.style.display = open ? 'flex' : 'none';
  if (!open) return;
  root.innerHTML = testView ? renderTest() : renderPairing();
}

function renderPairing(): string {
  const st = gm.state as unknown as St;
  const slots = pads.slotList();
  const free = pads.freePads();
  const paired = slots.filter((s) => s.state === 'paired').length;
  const target = pads.getTarget();
  const fam = padFamily(free[0]?.id ?? '');
  const primary = padLabel('PRIMARY', fam);
  let hint = 'PREMI UN TASTO SUL CONTROLLER CHE VUOI USARE';
  if (target) hint = `${pads.playerLabel(target)}: PREMI ${primary === 'BASSO' ? 'IL TASTO IN BASSO' : primary} SUL TUO CONTROLLER`;
  else if (free.length) hint = `CONTROLLER LIBERO: SCEGLI IL TUO GIOCATORE CON ⬆⬇ E CONFERMA CON ${primary === 'BASSO' ? 'IL TASTO IN BASSO' : primary}`;
  let unpairedRank = 0;
  const rows = slots
    .map((s) => {
      const p = st.players.find((x) => x.id === s.playerId);
      const ch = p?.characterId ? CHARACTERS[p.characterId] : null;
      const color = ch?.color ?? '#64748b';
      const title = ch?.roleTitle ?? p?.displayName ?? '?';
      const sub = p ? `${p.displayName}${p.connected ? '' : ' · telefono scollegato'}` : '';
      const cur = pads.cursorOf(s.playerId);
      let status = '<span class="none">NESSUN CONTROLLER</span>';
      if (s.state === 'paired') {
        const v = pads.views().find((x) => x.index === s.padIndex);
        status = `<span class="ok">🎮 ${esc(v?.shortName ?? 'Controller')} ✅ COLLEGATO</span>`;
      } else if (s.state === 'awaiting') status = '<span class="warn">⚠️ SCOLLEGATO — riconnetti con il controller</span>';
      else {
        unpairedRank++;
        if (cur !== null) status = `<span class="cur">◀ controller #${cur + 1} sta scegliendo ▶</span>`;
        else if (target === s.playerId) status = '<span class="cur">PREMI IL TASTO SUL CONTROLLER…</span>';
        else if (!free.length) {
          const n = paired + unpairedRank;
          status = `<span class="none">${n}° CONTROLLER NON RILEVATO<br><small>📱 uso il telefono come emergenza</small></span>`;
        }
      }
      const set = pads.settingsOf(s.playerId);
      const tools =
        s.state === 'paired'
          ? `<span class="set"><button data-act="vib" data-id="${s.playerId}">📳 ${set.vibration ? 'ON' : 'OFF'}</button><button data-act="inv" data-id="${s.playerId}">Y ${set.invertY ? 'INV' : 'norm'}</button><button data-act="sm" data-id="${s.playerId}">−</button>sens ${set.sensitivity.toFixed(1)}<button data-act="sp" data-id="${s.playerId}">+</button><button data-act="un" data-id="${s.playerId}">✕</button></span>`
          : '';
      return `<div class="row${target === s.playerId ? ' target' : ''}${cur !== null ? ' cursor' : ''}" data-act="target" data-id="${s.playerId}"><span class="dot" style="background:${color}"></span><div class="who"><b>${esc(title)}</b><span>${esc(sub)}</span></div>${tools}<div class="st">${status}</div></div>`;
    })
    .join('');
  const noExp = pads.detected < slots.length && pads.detected > 0 && !free.length ? `<p class="hint" style="color:#f87171">Il browser espone ${pads.detected} controller su ${slots.length} giocatori (Chrome ne mostra al massimo 4): gli altri usano il telefono.</p>` : '';
  return `<div class="box"><h2>🎮 COLLEGA I CONTROLLER</h2><p class="hint">${esc(hint)}</p>${noExp}${rows || '<p>Nessun giocatore nella stanza.</p>'}
  <div class="foot"><button data-act="test">🧪 TEST CONTROLLER</button><button data-act="close">CHIUDI (G)</button><span class="set">Clic su un giocatore = scegli per chi collegare. Il controller resta di quella persona per tutta la serata.</span></div></div>`;
}

function renderTest(): string {
  const views = pads.views();
  const cfgRows = views
    .map((v) => {
      const btns = PAD_CONTROLS.filter((c) => v.buttons[c]).map((c) => padLabel(c, v.family)).join(' ') || '—';
      const who = v.playerId ? pads.playerLabel(v.playerId) : 'libero';
      return `<tr><td>#${v.index}</td><td>${esc(v.shortName)}<br>${esc(v.id.slice(0, 60))}</td><td>${who}</td><td>${v.standard ? 'standard' : '<b class="warn">NON standard</b>'}</td><td>L ${v.left.x.toFixed(2)} , ${v.left.y.toFixed(2)}<br>R ${v.right.x.toFixed(2)} , ${v.right.y.toFixed(2)}</td><td>LT ${v.lt.toFixed(2)}<br>RT ${v.rt.toFixed(2)}</td><td>${btns}</td><td>${v.rumble ? 'sì' : 'no'}</td><td>${v.connected ? 'sì' : 'no'}</td></tr>`;
    })
    .join('');
  return `<div class="box"><h2>🧪 TEST CONTROLLER</h2><p class="hint">${views.length} controller esposti dal browser · contesto: ${pads.contextNow()}</p>
  <table><tr><th>idx</th><th>controller</th><th>giocatore</th><th>mapping</th><th>stick</th><th>grilletti</th><th>tasti premuti</th><th>rumble</th><th>conn.</th></tr>${cfgRows || '<tr><td colspan="9">Nessun controller: premi un tasto su un controller collegato.</td></tr>'}</table>
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
  const d = document.createElement('div');
  d.textContent = message;
  toasts.appendChild(d);
  window.setTimeout(() => d.remove(), ms);
  while (toasts.children.length > 3) toasts.firstElementChild?.remove();
}

export function initPairingPanel(): void {
  if (started) return;
  started = true;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
  root = document.createElement('div');
  root.id = 'pad-root';
  badge = document.createElement('div');
  badge.id = 'pad-badge';
  alertBar = document.createElement('div');
  alertBar.id = 'pad-alert';
  toasts = document.createElement('div');
  toasts.id = 'pad-toasts';
  document.body.append(root, badge, alertBar, toasts);
  root.addEventListener('click', onClick);
  badge.addEventListener('click', () => {
    open = true;
    render();
  });
  window.addEventListener('keydown', (e) => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = (e.target as HTMLElement | null)?.tagName ?? '';
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if ((e.key === 'g' || e.key === 'G') && phase() === 'LOBBY') {
      open = !open;
      dismissed = !open;
      render();
    }
  });
  pads.events.on('change', render);
  pads.events.on('toast', (t) => {
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
