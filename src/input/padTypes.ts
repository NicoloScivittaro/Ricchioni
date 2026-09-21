/**
 * TIPI E SIMBOLI DEL GAMEPAD. I giochi NON conoscono "A" o "X": usano azioni (ACTION_PRIMARY...) e le icone a schermo
 * vengono scelte per famiglia di controller (Xbox / PlayStation / generico).
 */

/** Controlli FISICI astratti, per POSIZIONE (non per nome del tasto): PRIMARY = tasto in basso (A / ✕), SECONDARY = destra (B / ◯)... */
export type PadControl =
  | 'PRIMARY'
  | 'SECONDARY'
  | 'LEFT'
  | 'TOP'
  | 'LB'
  | 'RB'
  | 'LT'
  | 'RT'
  | 'SELECT'
  | 'START'
  | 'L3'
  | 'R3'
  | 'DPAD_UP'
  | 'DPAD_DOWN'
  | 'DPAD_LEFT'
  | 'DPAD_RIGHT';

/** Indice del tasto nel layout "standard" della Gamepad API. */
export const STANDARD_BUTTON_INDEX: Record<PadControl, number> = {
  PRIMARY: 0,
  SECONDARY: 1,
  LEFT: 2,
  TOP: 3,
  LB: 4,
  RB: 5,
  LT: 6,
  RT: 7,
  SELECT: 8,
  START: 9,
  L3: 10,
  R3: 11,
  DPAD_UP: 12,
  DPAD_DOWN: 13,
  DPAD_LEFT: 14,
  DPAD_RIGHT: 15
};

export const PAD_CONTROLS = Object.keys(STANDARD_BUTTON_INDEX) as PadControl[];

/** Contesti di input: la stessa pressione ha significati diversi (A in lobby = conferma, in Kart = drift, nei risultati = niente). */
export type PadContext = 'LOBBY' | 'ROULETTE' | 'CONTROLS' | 'MINIGAME' | 'PAUSE' | 'RESULTS' | 'PHONE_TEXT';

export type PadFamily = 'xbox' | 'playstation' | 'generic';

/** Riconosce la famiglia dall'id del browser (es. "Xbox 360 Controller (STANDARD GAMEPAD Vendor: 045e Product: 028e)"). */
export function padFamily(id: string): PadFamily {
  const s = (id ?? '').toLowerCase();
  // Xbox PRIMA: "Xbox Wireless Controller" contiene "wireless controller", che e' anche il nome generico di un DualShock 4 (vendor 054c).
  if (/xbox|x-box|xinput|045e/.test(s)) return 'xbox';
  if (/dualsense|dualshock|playstation|054c/.test(s)) return 'playstation';
  return 'generic';
}

/** Nome breve per la TV e per il telefono (mai l'id grezzo lunghissimo). */
export function padShortName(id: string, index?: number): string {
  const fam = padFamily(id);
  const base = fam === 'xbox' ? 'Xbox' : fam === 'playstation' ? 'PlayStation' : ((id ?? '').split('(')[0].trim().slice(0, 14) || 'Controller');
  return index === undefined ? base : `${base} #${index + 1}`;
}

const LABELS: Record<PadFamily, Partial<Record<PadControl, string>>> = {
  xbox: { PRIMARY: 'A', SECONDARY: 'B', LEFT: 'X', TOP: 'Y', LB: 'LB', RB: 'RB', LT: 'LT', RT: 'RT', START: 'MENU', SELECT: 'VIEW', L3: 'L3', R3: 'R3' },
  playstation: { PRIMARY: '✕', SECONDARY: '◯', LEFT: '□', TOP: '△', LB: 'L1', RB: 'R1', LT: 'L2', RT: 'R2', START: 'OPTIONS', SELECT: 'CREATE', L3: 'L3', R3: 'R3' },
  generic: { PRIMARY: 'PRIMARY', SECONDARY: 'SECONDARY', LEFT: 'ACTION', TOP: 'ABILITY', LB: 'LB', RB: 'RB', LT: 'LT', RT: 'RT', START: 'START', SELECT: 'SELECT', L3: 'L3', R3: 'R3' }
};

/** Simbolo da mostrare per un controllo fisico, nel set grafico della famiglia (generico se non identificabile). */
export function padLabel(control: PadControl, family: PadFamily = 'generic'): string {
  const arrows: Partial<Record<PadControl, string>> = { DPAD_UP: '⬆', DPAD_DOWN: '⬇', DPAD_LEFT: '⬅', DPAD_RIGHT: '➡' };
  if (arrows[control]) return arrows[control]!;
  return LABELS[family][control] ?? control;
}

/** Cosa si muove/preme: un controllo fisico oppure uno stick. */
export type PadBinding = PadControl | 'LEFT_STICK' | 'RIGHT_STICK';

/** Testo del simbolo di un binding nel set grafico della famiglia (gli stick hanno lo stesso nome in tutte le famiglie). */
export function bindingLabel(binding: PadBinding, family: PadFamily = 'generic'): string {
  if (binding === 'LEFT_STICK') return 'LEFT STICK';
  if (binding === 'RIGHT_STICK') return 'RIGHT STICK';
  return padLabel(binding, family);
}

/** Impostazioni per giocatore (prima versione: solo queste tre). */
export interface PadSettings {
  vibration: boolean;
  /** Sensibilita' della mira FPS (0.5..2). */
  sensitivity: number;
  invertY: boolean;
}

export const DEFAULT_PAD_SETTINGS: PadSettings = { vibration: true, sensitivity: 1, invertY: false };

/** Vista di un controller per la schermata TEST CONTROLLER. */
export interface PadView {
  index: number;
  id: string;
  shortName: string;
  family: PadFamily;
  standard: boolean;
  connected: boolean;
  rumble: boolean;
  playerId: string | null;
  left: { x: number; y: number };
  right: { x: number; y: number };
  lt: number;
  rt: number;
  /** Valori grezzi dello stick sinistro/destro PRIMA della deadzone (diagnostica). */
  rawLeft: { x: number; y: number };
  rawRight: { x: number; y: number };
  buttons: Partial<Record<PadControl, boolean>>;
}
