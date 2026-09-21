import { Emitter } from '../../shared/events';
import { game as gm } from '../core/GameManager';
import { profileFor } from './profiles';
import { PAD_CONFIG, edge, loadPadConfig, radialDeadzone, triggerValue } from './padMath';
import {
  DEFAULT_PAD_SETTINGS,
  PAD_CONTROLS,
  STANDARD_BUTTON_INDEX,
  padFamily,
  padShortName,
  type PadContext,
  type PadControl,
  type PadSettings,
  type PadView
} from './padTypes';
import { MINIGAME_DEFINITIONS } from '../../shared/minigames';

/**
 * GAMEPAD MANAGER (host). Unico punto del progetto che chiama navigator.getGamepads().
 *
 *  - rileva TUTTI i controller esposti dal browser (nessun limite fisso a 4: si enumera la lista vera);
 *  - associa ogni controller fisico a UN giocatore (playerId), mai "indice 0 = giocatore 1": gli indici cambiano a ogni
 *    disconnessione. L'associazione vive per tutta la sessione (stanza) e sopravvive a rullo/gioco/risultati;
 *  - deadzone radiale, clamp, bordi dei tasti (pressed/released per frame) e contesti (LOBBY, MINIGAME, PAUSE...);
 *  - traduce lo stato fisico in InputEvent e li consegna a gm.input, lo STESSO InputManager che riceve il telefono:
 *    nessuna seconda verita' di gameplay, nessun giro host -> server -> host;
 *  - a ogni cambio di contesto / disconnessione / pausa azzera stick, tasti tenuti e bordi (niente input fantasma);
 *  - comunica al server SOLO chi ha un controller collegato (EVT.hostGamepads), cosi' il telefono sa di poter stare sul tavolo.
 */

interface RawPad {
  index: number;
  id: string;
  standard: boolean;
  /** Ultimo campionamento fisico. */
  raw: Record<PadControl, boolean>;
  /** Stato "efficace": raw meno i tasti bloccati (tenuti durante un cambio di contesto: ripartono solo dopo il rilascio). */
  eff: Record<PadControl, boolean>;
  blocked: Set<PadControl>;
  nav: { up: boolean; down: boolean; left: boolean; right: boolean };
  navPrev: { up: boolean; down: boolean; left: boolean; right: boolean };
  edges: Record<PadControl, { down: boolean; pressed: boolean; released: boolean }>;
  left: { x: number; y: number };
  right: { x: number; y: number };
  lt: number;
  rt: number;
  rumble: boolean;
  /** Ultima volta visto (performance.now). */
  seen: number;
}

export type SlotState = 'none' | 'paired' | 'awaiting';

export interface PadSlot {
  playerId: string;
  state: SlotState;
  padIndex: number | null;
  /** id grezzo dell'ultimo controller associato (serve a riconoscere lo stesso controller al ritorno). */
  padId: string;
}

const emptyMap = <T,>(v: () => T): Record<PadControl, T> => Object.fromEntries(PAD_CONTROLS.map((c) => [c, v()])) as Record<PadControl, T>;
const zeroNav = (): RawPad['nav'] => ({ up: false, down: false, left: false, right: false });

interface RoomLike {
  phase: string;
  paused?: boolean;
  roomCode?: string;
  players: { id: string; displayName: string; characterId: string | null; connected: boolean; pad?: string | null }[];
  currentMinigame: { minigameId: string } | null;
}

export class GamepadManager {
  readonly events = new Emitter(); // 'change' (associazioni / controller), 'toast' (messaggio breve)
  private started = false;
  private pads = new Map<number, RawPad>();
  private slots = new Map<string, PadSlot>();
  private order: string[] = [];
  private context: PadContext = 'LOBBY';
  private minigameId: string | null = null;
  /** Modo guidato: giocatore per cui il prossimo controller libero che preme PRIMARY viene associato. */
  private target: string | null = null;
  /** Modo rapido: cursore (playerId) di ogni controller libero che sta scegliendo il proprio personaggio. */
  private cursors = new Map<number, string>();
  private settings = new Map<string, PadSettings>();
  private lastSent = '';
  private lastSentAt = 0;
  private roomCode = '';
  /** Ultimo numero di controller esposti dal browser (per il messaggio "N° CONTROLLER NON RILEVATO"). */
  detected = 0;

  // ------------------------------------------------------------------ ciclo di vita

  init(): void {
    if (this.started || typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return;
    this.started = true;
    loadPadConfig();
    window.addEventListener('gamepadconnected', () => this.poll());
    window.addEventListener('gamepaddisconnected', () => this.poll());
    gm.padRumble = (playerId, ms) => this.rumble(playerId, ms);
    gm.events.on('state', (s) => this.onState(s as RoomLike));
    const loop = (): void => {
      this.poll();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    this.loadSettings();
  }

  // ------------------------------------------------------------------ stato del gioco

  private onState(s: RoomLike): void {
    if (s.roomCode && s.roomCode !== this.roomCode) {
      this.roomCode = s.roomCode;
      this.restorePairs();
    }
    // giocatori: una casella per ciascuno (ordine di ingresso)
    const ids = s.players.map((p) => p.id);
    for (const id of ids) if (!this.slots.has(id)) this.slots.set(id, { playerId: id, state: 'none', padIndex: null, padId: '' });
    for (const id of [...this.slots.keys()]) {
      if (!ids.includes(id)) {
        this.releasePlayer(id);
        this.slots.delete(id);
      }
    }
    this.order = ids;
    this.minigameId = s.currentMinigame?.minigameId ?? null;
    this.setContext(this.resolveContext(s));
    // auto-guarigione: il server deve sapere chi ha un controller (anche dopo una riconnessione dell'host)
    for (const p of s.players) {
      const sl = this.slots.get(p.id);
      const want = sl?.state === 'paired' && sl.padIndex !== null ? this.nameOf(sl) : null;
      if ((p.pad ?? null) !== want) {
        this.syncServer(true);
        break;
      }
    }
    this.events.emit('change');
  }

  private resolveContext(s: RoomLike): PadContext {
    switch (s.phase) {
      case 'LOBBY':
        return 'LOBBY';
      case 'MINIGAME_ROULETTE':
      case 'MINIGAME_INTRO':
        return 'ROULETTE';
      case 'MINIGAME_PLAYING': {
        if (s.paused) return 'PAUSE';
        const def = MINIGAME_DEFINITIONS.find((m) => m.id === s.currentMinigame?.minigameId);
        return def?.inputMode === 'PHONE_TEXT' ? 'PHONE_TEXT' : 'MINIGAME';
      }
      default:
        return 'RESULTS';
    }
  }

  /** Cambio contesto = tabula rasa: niente stick/tasti/bordi del contesto precedente nel nuovo. */
  private setContext(next: PadContext): void {
    if (next === this.context) return;
    this.context = next;
    this.resetAll();
  }

  /** Azzera tutti gli input dei giocatori con controller e blocca i tasti attualmente tenuti fino al rilascio. */
  private resetAll(): void {
    for (const sl of this.slots.values()) if (sl.state !== 'none') this.releasePlayer(sl.playerId);
    for (const p of this.pads.values()) {
      p.blocked = new Set(PAD_CONTROLS.filter((c) => p.raw[c]));
      p.eff = emptyMap(() => false);
      p.edges = emptyMap(() => ({ down: false, pressed: false, released: false }));
      p.navPrev = { ...p.nav };
    }
  }

  private releasePlayer(playerId: string): void {
    gm.input.releasePlayer(playerId);
  }

  // ------------------------------------------------------------------ polling

  poll(): void {
    let list: ArrayLike<Gamepad | null> = [];
    try {
      list = navigator.getGamepads();
    } catch {
      return;
    }
    const now = performance.now();
    const present = new Set<number>();
    let detected = 0;
    for (let i = 0; i < list.length; i++) {
      const gp = list[i];
      if (!gp || !gp.connected) continue;
      detected++;
      present.add(gp.index);
      let p = this.pads.get(gp.index);
      if (!p || p.id !== gp.id) {
        if (p) this.onPadGone(gp.index, true); // stesso indice, dispositivo diverso
        p = this.newPad(gp);
        this.pads.set(gp.index, p);
        this.onPadAppear(p);
      }
      this.sample(p, gp, now);
    }
    for (const idx of [...this.pads.keys()]) if (!present.has(idx)) this.onPadGone(idx, false);
    if (detected !== this.detected) {
      this.detected = detected;
      this.events.emit('change');
    }
    this.route();
  }

  private newPad(gp: Gamepad): RawPad {
    return {
      index: gp.index,
      id: gp.id,
      standard: gp.mapping === 'standard',
      raw: emptyMap(() => false),
      eff: emptyMap(() => false),
      blocked: new Set(),
      nav: zeroNav(),
      navPrev: zeroNav(),
      edges: emptyMap(() => ({ down: false, pressed: false, released: false })),
      left: { x: 0, y: 0 },
      right: { x: 0, y: 0 },
      lt: 0,
      rt: 0,
      rumble: !!(gp as unknown as { vibrationActuator?: unknown }).vibrationActuator,
      seen: performance.now()
    };
  }

  private sample(p: RawPad, gp: Gamepad, now: number): void {
    p.seen = now;
    p.rumble = !!(gp as unknown as { vibrationActuator?: unknown }).vibrationActuator;
    const b = gp.buttons;
    const cfg = PAD_CONFIG;
    p.lt = triggerValue(b[STANDARD_BUTTON_INDEX.LT], cfg.triggerDeadzone);
    p.rt = triggerValue(b[STANDARD_BUTTON_INDEX.RT], cfg.triggerDeadzone);
    for (const c of PAD_CONTROLS) {
      const btn = b[STANDARD_BUTTON_INDEX[c]];
      p.raw[c] = c === 'LT' ? p.lt > cfg.triggerButtonThreshold : c === 'RT' ? p.rt > cfg.triggerButtonThreshold : !!btn?.pressed;
    }
    p.left = radialDeadzone(gp.axes[0] ?? 0, gp.axes[1] ?? 0, cfg.leftDeadzone);
    p.right = radialDeadzone(gp.axes[2] ?? 0, gp.axes[3] ?? 0, cfg.rightDeadzone);
    // navigazione a "D-pad": croce digitale OR stick sinistro oltre soglia (menu, cursore, quiz)
    const t = cfg.stickAsDpadThreshold;
    const l = radialDeadzone(gp.axes[0] ?? 0, gp.axes[1] ?? 0, 0);
    p.navPrev = { ...p.nav };
    p.nav = {
      up: p.raw.DPAD_UP || l.y < -t,
      down: p.raw.DPAD_DOWN || l.y > t,
      left: p.raw.DPAD_LEFT || l.x < -t,
      right: p.raw.DPAD_RIGHT || l.x > t
    };
    // bordi sui tasti efficaci (tenuti durante un cambio di contesto => bloccati finche' non vengono rilasciati)
    for (const c of PAD_CONTROLS) {
      if (!p.raw[c]) p.blocked.delete(c);
      const nowEff = p.raw[c] && !p.blocked.has(c);
      p.edges[c] = edge(p.eff[c], nowEff);
      p.eff[c] = nowEff;
    }
  }

  // ------------------------------------------------------------------ connessione / disconnessione

  private onPadAppear(p: RawPad): void {
    // ritorno dello stesso controller: se UNA sola casella in attesa aveva questo id (e un solo controller nuovo lo ha), riassocia
    const awaiting = [...this.slots.values()].filter((s) => s.state === 'awaiting' && s.padId === p.id);
    const sameNewPads = [...this.pads.values()].filter((x) => x.id === p.id && !this.padSlot(x.index));
    if (awaiting.length === 1 && sameNewPads.length === 1) {
      this.bind(awaiting[0].playerId, p, false);
      this.toast(`✅ CONTROLLER DI ${this.playerName(awaiting[0].playerId)} RICOLLEGATO`);
    } else if (awaiting.length >= 1) {
      this.toast(`🎮 CONTROLLER RILEVATO — PREMI ${this.primaryLabel(p)} PER RICONNETTERE ${awaiting.map((s) => this.playerName(s.playerId)).join(' / ')}`);
    }
    this.events.emit('change');
  }

  private onPadGone(index: number, replaced: boolean): void {
    const p = this.pads.get(index);
    if (!p) return;
    this.pads.delete(index);
    this.cursors.delete(index);
    const sl = this.padSlot(index);
    if (sl) {
      sl.state = 'awaiting';
      sl.padIndex = null;
      this.releasePlayer(sl.playerId); // nessun personaggio deve continuare a camminare da solo
      this.toast(`⚠️ CONTROLLER DI ${this.playerName(sl.playerId)} DISCONNESSO`, 5000);
      this.persistPairs();
      this.syncServer(true);
    }
    if (!replaced) this.events.emit('change');
  }

  // ------------------------------------------------------------------ associazioni

  private padSlot(index: number): PadSlot | null {
    for (const s of this.slots.values()) if (s.padIndex === index && s.state === 'paired') return s;
    return null;
  }

  slotOf(playerId: string): PadSlot | null {
    return this.slots.get(playerId) ?? null;
  }

  /** Associa il controller `index` a `playerId` (un controller = un giocatore, un giocatore = un controller). */
  assign(index: number, playerId: string): boolean {
    const p = this.pads.get(index);
    const sl = this.slots.get(playerId);
    if (!p || !sl) return false;
    if (this.padSlot(index) && this.padSlot(index)!.playerId !== playerId) return false; // controller gia' di un altro
    if (sl.state === 'paired' && sl.padIndex !== index) return false; // giocatore gia' collegato ad un altro controller
    this.bind(playerId, p, true);
    return true;
  }

  private bind(playerId: string, p: RawPad, announce: boolean): void {
    const sl = this.slots.get(playerId);
    if (!sl) return;
    sl.state = 'paired';
    sl.padIndex = p.index;
    sl.padId = p.id;
    this.cursors.delete(p.index);
    if (this.target === playerId) this.target = this.nextFree(playerId);
    // il tasto usato per confermare non deve passare al gioco
    p.blocked = new Set(PAD_CONTROLS.filter((c) => p.raw[c]));
    this.persistPairs();
    this.syncServer(true);
    if (announce) {
      this.toast(`✅ CONTROLLER COLLEGATO — ${this.playerName(playerId)} (${padShortName(p.id)})`);
      this.rumbleRaw(p.index, 220, 0.6, 0.6);
    }
    this.events.emit('change');
  }

  unassign(playerId: string): void {
    const sl = this.slots.get(playerId);
    if (!sl) return;
    sl.state = 'none';
    sl.padIndex = null;
    sl.padId = '';
    this.releasePlayer(playerId);
    this.persistPairs();
    this.syncServer(true);
    this.events.emit('change');
  }

  setTarget(playerId: string | null): void {
    this.target = playerId && this.slots.get(playerId)?.state !== 'paired' ? playerId : null;
    this.events.emit('change');
  }

  getTarget(): string | null {
    return this.target;
  }

  private nextFree(after: string): string | null {
    const i = this.order.indexOf(after);
    for (let k = 1; k <= this.order.length; k++) {
      const id = this.order[(i + k) % this.order.length];
      if (this.slots.get(id)?.state !== 'paired') return id;
    }
    return null;
  }

  private candidates(): string[] {
    const free = this.order.filter((id) => this.slots.get(id)?.state !== 'paired');
    const waiting = free.filter((id) => this.slots.get(id)?.state === 'awaiting');
    return this.context === 'LOBBY' ? free : waiting;
  }

  /** Pairing dei controller LIBERI: cursore rapido (D-pad/stick + A) o modo guidato (target scelto sulla TV). */
  private pairingStep(p: RawPad): void {
    const e = p.edges;
    const cands = this.candidates();
    if (!cands.length) {
      this.cursors.delete(p.index);
      return;
    }
    if (this.target && e.PRIMARY.pressed && this.context === 'LOBBY') {
      this.assign(p.index, this.target);
      return;
    }
    const cur = this.cursors.get(p.index);
    if (!cur) {
      if (e.PRIMARY.pressed || e.START.pressed) {
        this.cursors.set(p.index, cands[0]);
        this.events.emit('change');
      }
      return;
    }
    if (!cands.includes(cur)) {
      this.cursors.set(p.index, cands[0]);
      this.events.emit('change');
      return;
    }
    const nav = (dir: 'up' | 'down'): boolean => p.nav[dir] && !p.navPrev[dir];
    if (nav('down') || nav('up')) {
      const i = cands.indexOf(cur);
      this.cursors.set(p.index, cands[(i + (nav('down') ? 1 : cands.length - 1)) % cands.length]);
      this.events.emit('change');
    } else if (e.PRIMARY.pressed) {
      this.assign(p.index, cur);
    } else if (e.SECONDARY.pressed) {
      this.cursors.delete(p.index);
      this.events.emit('change');
    }
  }

  cursorOf(playerId: string): number | null {
    for (const [idx, id] of this.cursors) if (id === playerId) return idx;
    return null;
  }

  // ------------------------------------------------------------------ instradamento verso il gioco

  private route(): void {
    for (const p of this.pads.values()) {
      const sl = this.padSlot(p.index);
      if (!sl) {
        this.pairingStep(p);
        continue;
      }
      if (this.context !== 'MINIGAME') continue; // lobby/rullo/risultati/pausa/telefono: nessun gameplay dal controller
      const profile = profileFor(this.minigameId);
      if (!profile) continue;
      const pid = sl.playerId;
      const s = this.settingsOf(pid);
      for (const st of profile.sticks) {
        const v = st.stick === 'LEFT' ? p.left : p.right;
        gm.input.handle(pid, { kind: 'axis', controlId: st.control, x: v.x, y: s.invertY && st.stick === 'RIGHT' ? -v.y : v.y });
      }
      for (const t of profile.triggers ?? []) gm.input.handle(pid, { kind: 'axis', controlId: t.control, x: t.from === 'LT' ? p.lt : p.rt, y: 0 });
      for (const b of profile.buttons) {
        const e = p.edges[b.from];
        if (e.pressed) gm.input.handle(pid, { kind: 'down', controlId: b.control });
        if (e.released) gm.input.handle(pid, { kind: 'up', controlId: b.control });
      }
    }
  }

  /** true se il minigioco in corso e' pilotato da questo giocatore col controller (serve a non far vibrare il telefono). */
  handles(playerId: string): boolean {
    const sl = this.slots.get(playerId);
    return !!sl && sl.state === 'paired' && sl.padIndex !== null && this.context === 'MINIGAME' && !!profileFor(this.minigameId);
  }

  // ------------------------------------------------------------------ rumble

  /** Vibrazione del controller del giocatore. Ritorna true se il giocatore sta giocando col controller (anche se non vibra). */
  rumble(playerId: string, ms = 120, strong = 0.8, weak = 0.6): boolean {
    if (!this.handles(playerId)) return false;
    if (!this.settingsOf(playerId).vibration) return true;
    const sl = this.slots.get(playerId)!;
    this.rumbleRaw(sl.padIndex!, ms, strong, weak);
    return true;
  }

  private rumbleRaw(index: number, ms: number, strong: number, weak: number): void {
    try {
      const gp = navigator.getGamepads()[index] as (Gamepad & { vibrationActuator?: { playEffect?: (t: string, o: unknown) => Promise<unknown> } }) | null;
      const act = gp?.vibrationActuator;
      if (act?.playEffect) void act.playEffect('dual-rumble', { startDelay: 0, duration: Math.max(20, Math.min(1500, ms)), weakMagnitude: weak, strongMagnitude: strong }).catch(() => undefined);
    } catch {
      /* rumble non disponibile: nessun errore */
    }
  }

  // ------------------------------------------------------------------ impostazioni per giocatore

  settingsOf(playerId: string): PadSettings {
    let s = this.settings.get(playerId);
    if (!s) {
      s = { ...DEFAULT_PAD_SETTINGS };
      this.settings.set(playerId, s);
    }
    return s;
  }

  updateSettings(playerId: string, patch: Partial<PadSettings>): void {
    const s = this.settingsOf(playerId);
    if (patch.vibration !== undefined) s.vibration = !!patch.vibration;
    if (patch.invertY !== undefined) s.invertY = !!patch.invertY;
    if (patch.sensitivity !== undefined && Number.isFinite(patch.sensitivity)) s.sensitivity = Math.max(0.5, Math.min(2, patch.sensitivity));
    try {
      sessionStorage.setItem('ricchioni.padSettings', JSON.stringify([...this.settings]));
    } catch {
      /* ignora */
    }
    this.events.emit('change');
  }

  private loadSettings(): void {
    try {
      const raw = sessionStorage.getItem('ricchioni.padSettings');
      if (raw) for (const [k, v] of JSON.parse(raw) as [string, PadSettings][]) this.settings.set(k, { ...DEFAULT_PAD_SETTINGS, ...v });
    } catch {
      /* ignora */
    }
  }

  // ------------------------------------------------------------------ persistenza e server

  private persistPairs(): void {
    if (!this.roomCode) return;
    try {
      const o: Record<string, string> = {};
      for (const s of this.slots.values()) if (s.padId && s.state !== 'none') o[s.playerId] = s.padId;
      sessionStorage.setItem('ricchioni.padPairs.' + this.roomCode, JSON.stringify(o));
    } catch {
      /* ignora */
    }
  }

  /** Dopo un ricaricamento della pagina host: le associazioni tornano "in attesa" e si riassociano al primo controller uguale. */
  private restorePairs(): void {
    try {
      const raw = sessionStorage.getItem('ricchioni.padPairs.' + this.roomCode);
      if (!raw) return;
      for (const [pid, padId] of Object.entries(JSON.parse(raw) as Record<string, string>)) {
        this.slots.set(pid, { playerId: pid, state: 'awaiting', padIndex: null, padId });
      }
    } catch {
      /* ignora */
    }
  }

  private nameOf(sl: PadSlot): string {
    const p = sl.padIndex !== null ? this.pads.get(sl.padIndex) : undefined;
    return padShortName(p?.id ?? sl.padId);
  }

  /** Mappa playerId -> nome breve del controller, solo per chi ha un controller collegato adesso. */
  private snapshotForServer(): Record<string, string> {
    const o: Record<string, string> = {};
    for (const s of this.slots.values()) if (s.state === 'paired' && s.padIndex !== null) o[s.playerId] = this.nameOf(s);
    return o;
  }

  private syncServer(force = false): void {
    const map = this.snapshotForServer();
    const key = JSON.stringify(map);
    const now = performance.now();
    if (!force && key === this.lastSent) return;
    if (key === this.lastSent && now - this.lastSentAt < 1000) return; // auto-guarigione: al massimo 1 invio/s
    this.lastSent = key;
    this.lastSentAt = now;
    gm.sendGamepads(map);
  }

  // ------------------------------------------------------------------ vista per UI e test

  private playerName(playerId: string): string {
    const st = gm.state as unknown as RoomLike | null;
    return (st?.players.find((p) => p.id === playerId)?.displayName ?? playerId).toUpperCase();
  }

  private primaryLabel(p: RawPad): string {
    const f = padFamily(p.id);
    return f === 'xbox' ? 'A' : f === 'playstation' ? '✕' : 'IL TASTO IN BASSO';
  }

  private toast(message: string, ms = 3500): void {
    this.events.emit('toast', { message, ms });
  }

  contextNow(): PadContext {
    return this.context;
  }

  /** Numero di controller liberi (non associati). */
  freePads(): RawPad[] {
    return [...this.pads.values()].filter((p) => !this.padSlot(p.index));
  }

  views(): PadView[] {
    return [...this.pads.values()]
      .sort((a, b) => a.index - b.index)
      .map((p) => ({
        index: p.index,
        id: p.id,
        shortName: padShortName(p.id, p.index),
        family: padFamily(p.id),
        standard: p.standard,
        connected: true,
        rumble: p.rumble,
        playerId: this.padSlot(p.index)?.playerId ?? null,
        left: { ...p.left },
        right: { ...p.right },
        lt: p.lt,
        rt: p.rt,
        buttons: { ...p.raw }
      }));
  }

  slotList(): PadSlot[] {
    return this.order.map((id) => this.slots.get(id)!).filter(Boolean);
  }

  playerLabel(playerId: string): string {
    return this.playerName(playerId);
  }

  orderIndex(playerId: string): number {
    return this.order.indexOf(playerId);
  }
}

export const pads = new GamepadManager();
