import { CHARACTERS } from '../../shared/characters';
import { portraitCss, presentationOf } from '../../shared/characterPresentation';
import { ABILITY_SYMBOLS, iconSvg } from '../../shared/charIcons';
import { abilityFor, stateLabel, ABILITY_KIND_LABEL } from '../../shared/abilityCatalog';
import type { AbilityStatus } from '../../shared/abilityCatalog';
import { getMinigame } from '../../shared/minigames';
import { profileFor } from '../input/profiles';
import { bindingLabel } from '../input/padTypes';
import type { PadFamily } from '../input/padTypes';
import type { PlayerPublic } from '../../shared/types';

/**
 * COMPANION CARD (telefono). Quando si gioca col controller il telefono sta sul tavolo e non e' piu' un joystick: diventa una GUIDA
 * ("aspetta, che cazzo fa la mia abilita'?"). Niente bottoni di gioco, niente joystick: la card e' SOLO informativa.
 *
 * Tutto cio' che e' critico per giocare e' ANCHE sulla TV (schermata CONTROLLI, HUD, nome sopra il personaggio): qui non serve
 * guardare mentre si gioca. Testi e numeri vengono dal catalogo (shared/abilityCatalog.ts), il tasto dal profilo di input
 * (src/input/profiles.ts): le stesse fonti della TV, quindi nessuna descrizione puo' divergere. Lo stato LIVE
 * (PRONTA / ATTIVA / RICARICA / ESAURITA) arriva dal gioco con il messaggio privato 'ability': nessuna simulazione parallela.
 */

export interface AbilityMsg {
  type: 'ability';
  game: string;
  /** null = fine round: la card torna "neutra" */
  status: AbilityStatus | null;
}
export interface AbilityUsedMsg {
  type: 'abilityUsed';
  game: string;
  name: string;
}
export interface AbilityFailMsg {
  type: 'abilityFail';
  text: string;
}

export const isAbilityMsg = (d: unknown): d is AbilityMsg => typeof d === 'object' && d !== null && (d as { type?: unknown }).type === 'ability';
export const isAbilityUsedMsg = (d: unknown): d is AbilityUsedMsg => typeof d === 'object' && d !== null && (d as { type?: unknown }).type === 'abilityUsed';
export const isAbilityFailMsg = (d: unknown): d is AbilityFailMsg => typeof d === 'object' && d !== null && (d as { type?: unknown }).type === 'abilityFail';

const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** "Xbox", "PlayStation #2" -> famiglia dei simboli (A/B/X/Y oppure ✕/◯/□/△). */
export function familyOfPad(pad: string | undefined): PadFamily {
  const s = (pad ?? '').toLowerCase();
  if (s.startsWith('playstation')) return 'playstation';
  if (s.startsWith('xbox')) return 'xbox';
  return 'generic';
}

// ---- stato live (solo presentazione) ----
let live: { game: string; status: AbilityStatus; at: number } | null = null;
let flashTimer = 0;
let failTimer = 0;
let ticker = 0;

export function resetAbilityLive(): void {
  live = null;
  window.clearInterval(ticker);
  ticker = 0;
  document.getElementById('ability-flash')?.remove();
}

/** Messaggio 'ability' dal gioco: aggiorna lo stato e, se la card e' a schermo, solo il chip (nessun ridisegno). */
export function onAbilityMessage(msg: AbilityMsg): void {
  if (!msg.status) {
    live = null;
    paintStatus();
    return;
  }
  live = { game: msg.game, status: msg.status, at: performance.now() };
  paintStatus();
  // il tempo residuo scorre da solo sul telefono fra un messaggio e l'altro (la TV riallinea ogni secondo)
  const timed = msg.status.remaining !== undefined && (msg.status.state === 'ACTIVE' || msg.status.state === 'COOLDOWN');
  if (timed && !ticker) ticker = window.setInterval(paintStatus, 200);
  else if (!timed && ticker) {
    window.clearInterval(ticker);
    ticker = 0;
  }
}

function current(): AbilityStatus | null {
  if (!live) return null;
  const s = live.status;
  if (s.remaining === undefined || (s.state !== 'ACTIVE' && s.state !== 'COOLDOWN')) return s;
  const left = Math.max(0, s.remaining - (performance.now() - live.at) / 1000);
  return { ...s, remaining: left };
}

function paintStatus(): void {
  const el = document.getElementById('cc-status');
  if (!el) return;
  const s = current();
  const shown: AbilityStatus = s ?? { state: 'READY' };
  const txt = stateLabel(shown);
  if (el.textContent !== txt) el.textContent = txt;
  const st = shown.state.toLowerCase();
  if (el.dataset.state !== st) el.dataset.state = st;
  const bar = document.getElementById('cc-meter');
  if (bar) {
    const m = shown.state === 'CHARGING' ? Math.max(0, Math.min(1, shown.meter ?? 0)) : shown.state === 'READY' ? 1 : 0;
    (bar.firstElementChild as HTMLElement | null)?.style.setProperty('width', `${Math.round(m * 100)}%`);
    bar.style.display = shown.state === 'CHARGING' || (shown.meter !== undefined) ? 'block' : 'none';
  }
}

/** Lampo a schermo con il nome dell'abilita' appena partita: "ha funzionato?" non deve restare un dubbio. */
export function flashAbility(msg: AbilityUsedMsg, characterId: string | null, vibrate: (p: number | number[]) => void): void {
  document.getElementById('ability-flash')?.remove();
  const el = document.createElement('div');
  el.id = 'ability-flash';
  el.innerHTML = `<div class="af-icon">${iconSvg(ABILITY_SYMBOLS[characterId ?? ''], 44)}</div><div class="af-name">${esc(msg.name)}</div>`;
  document.body.appendChild(el);
  window.clearTimeout(flashTimer);
  flashTimer = window.setTimeout(() => el.remove(), 1300);
  vibrate([40, 30, 80]);
  document.getElementById('cc-ability')?.classList.add('used');
  window.setTimeout(() => document.getElementById('cc-ability')?.classList.remove('used'), 900);
}

/** Abilita' premuta ma non partita: avviso breve e PRIVATO ("NON ORA", "ESAURITA"...). Non blocca nulla. */
export function failAbility(msg: AbilityFailMsg, vibrate: (p: number | number[]) => void): void {
  document.getElementById('ab-fail-toast')?.remove();
  const el = document.createElement('div');
  el.id = 'ab-fail-toast';
  el.textContent = msg.text;
  document.body.appendChild(el);
  window.clearTimeout(failTimer);
  failTimer = window.setTimeout(() => el.remove(), 1500);
  vibrate([30, 40, 30]);
}

/**
 * HTML della card per il gioco in corso e il giocatore. null = nessuna abilita' nel catalogo (gioco senza abilita' / personaggio
 * mancante): il chiamante ricade sulla schermata semplice USA IL CONTROLLER.
 */
export function companionHtml(minigameId: string, me: PlayerPublic, minigameName: string): string | null {
  const ch = me.characterId ? CHARACTERS[me.characterId] : null;
  const ab = abilityFor(minigameId, me.characterId);
  const def = getMinigame(minigameId);
  if (!ch || !ab || !def) return null;
  const fam = familyOfPad(me.pad);
  const profile = profileFor(minigameId);
  const abilityRow = profile?.controls.find((c) => c.action === 'ABILITY');
  const key = abilityRow ? bindingLabel(abilityRow.binding, fam) : '';
  const pres = presentationOf(me.characterId);
  const accent = pres?.accent ?? ch.color;
  const rows = (profile?.controls ?? [])
    .filter((c) => c.action !== 'ABILITY')
    .slice(0, 6)
    .map((c) => `<div class="cc-row"><span class="cc-cap">${esc(bindingLabel(c.binding, fam))}</span><span class="cc-act">${esc(c.label)}</span></div>`)
    .join('');
  const s = current();
  const shown: AbilityStatus = s ?? { state: 'READY' };
  return `
    <div class="screen pad-screen cc" style="--cc-accent:${accent}">
      <div class="cc-head">
        <div class="cc-portrait" style="${portraitCss(me.characterId, 52)}"></div>
        <div class="cc-who"><div class="cc-char">${esc(ch.roleTitle)}</div><div class="cc-game">${esc(def.icon ?? '')} ${esc(minigameName)}</div></div>
      </div>
      <div class="cc-ability" id="cc-ability">
        <div class="cc-ab-top">
          <span class="cc-ab-icon">${iconSvg(ABILITY_SYMBOLS[me.characterId ?? ''], 38)}</span>
          <span class="cc-ab-name">${esc(ab.name)}</span>
          ${key ? `<span class="cc-key">${esc(key)}</span>` : ''}
        </div>
        <p class="cc-ab-kind">${esc(ABILITY_KIND_LABEL[ab.kind])} · ${esc(ab.limit)}</p>
        <p class="cc-ab-text">${esc(ab.full)}</p>
        <div class="cc-meter" id="cc-meter" style="display:${shown.state === 'CHARGING' ? 'block' : 'none'}"><i></i></div>
        <div class="cc-status" id="cc-status" data-state="${shown.state.toLowerCase()}">${esc(stateLabel(shown))}</div>
      </div>
      <div class="cc-controls">
        <div class="cc-title">COMANDI</div>
        ${rows}
      </div>
      <p class="cc-look">🎮 USA IL CONTROLLER · ${minigameId === 'fps' ? 'GUARDA LA TUA FINESTRA SULLA TV' : 'GUARDA LA TV'}</p>
      <p class="cc-ok">✅ CONTROLLER CONNESSO${me.pad ? ` · ${esc(me.pad)}` : ''}</p>
    </div>`;
}
