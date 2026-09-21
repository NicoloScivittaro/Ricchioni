/**
 * SELFTEST DEL SISTEMA GAMEPAD (parte pura, senza browser):  npx tsx scripts/pad-selftest.ts
 * Deadzone radiale, clamp/normalizzazione della diagonale, rimappatura continua, grilletti, bordi dei tasti,
 * famiglie/simboli dei controller e coerenza fra registry (inputMode) e profili di input.
 * Il comportamento nel browser (pairing, disconnessione, contesti, telefono) lo prova scripts/e2e/gamepad.mjs.
 */
import { DEFAULT_PAD_CONFIG, axisDeadzone, edge, radialDeadzone, responseCurve, triggerValue } from '../src/input/padMath';
import { bindingLabel, padFamily, padLabel, padShortName } from '../src/input/padTypes';
import { PAD_PROFILES, profileFor } from '../src/input/profiles';
import { MINIGAME_DEFINITIONS } from '../shared/minigames';

let fails = 0;
const ok = (c: boolean, m: string): void => {
  console.log(`${c ? '✅' : '❌'} ${m}`);
  if (!c) fails++;
};
const near = (a: number, b: number, e = 1e-9): boolean => Math.abs(a - b) <= e;

const dz = DEFAULT_PAD_CONFIG.leftDeadzone;
// --- deadzone radiale
ok(radialDeadzone(0.1, 0.1, dz).x === 0 && radialDeadzone(0.1, 0.1, dz).y === 0, 'sotto la deadzone (grandezza 0.14 < 0.16) = (0,0)');
ok(radialDeadzone(0.15, 0, dz).x === 0, 'sull\'asse, appena sotto la soglia = 0');
const just = radialDeadzone(dz + 1e-6, 0, dz);
ok(just.x > 0 && just.x < 0.001, 'appena sopra la soglia l\'uscita parte da ~0 (nessuno scalino)');
ok(near(radialDeadzone(1, 0, dz).x, 1), 'stick a fondo = 1');
const d = radialDeadzone(0.9, 0.9, dz);
ok(near(Math.hypot(d.x, d.y), 1) && near(d.x, d.y), 'diagonale (0.9,0.9): grandezza clampata a 1 e direzione a 45°');
const sq = radialDeadzone(1, 1, dz);
ok(near(Math.hypot(sq.x, sq.y), 1), 'cancello quadrato (1,1): la diagonale NON e\' piu\' veloce (grandezza 1, non 1.41)');
const mid = radialDeadzone(0.5, 0, dz);
ok(near(mid.x, (0.5 - dz) / (1 - dz)), 'a meta\' corsa la grandezza e\' rimappata (soglia..1)->(0..1)');
const dir = radialDeadzone(0.3, 0.4, dz);
ok(near(dir.x / dir.y, 0.3 / 0.4, 1e-9), 'la rimappatura conserva la direzione (nessuna distorsione per asse)');
ok(radialDeadzone(NaN, 1, dz).x === 0 && radialDeadzone(0, undefined as unknown as number, dz).y === 0, 'NaN/undefined => (0,0), niente crash');
let mono = true;
let prev = 0;
for (let m = 0; m <= 1.0001; m += 0.01) {
  const g = Math.hypot(radialDeadzone(m, 0, dz).x, radialDeadzone(m, 0, dz).y);
  if (g + 1e-9 < prev) mono = false;
  prev = g;
}
ok(mono, 'uscita monotona crescente con la grandezza');
// 8 direzioni: tutte danno grandezza 1 a fondo corsa
let dirs = true;
for (let k = 0; k < 8; k++) {
  const a = (k * Math.PI) / 4;
  const sqx = Math.cos(a) * 1.0;
  const sqy = Math.sin(a) * 1.0;
  const r = radialDeadzone(sqx, sqy, dz);
  if (!near(Math.hypot(r.x, r.y), 1, 1e-9)) dirs = false;
}
ok(dirs, '8 direzioni a fondo corsa: stessa grandezza (1)');

// --- assi singoli e grilletti
ok(axisDeadzone(0.04, 0.05) === 0 && near(axisDeadzone(1, 0.05), 1) && axisDeadzone(-1, 0.05) === -1, 'deadzone di un asse (grilletto): 0 sotto soglia, ±1 a fondo');
ok(triggerValue({ pressed: true, value: 1 }, 0.05) === 1 && triggerValue({ pressed: false, value: 0.02 }, 0.05) === 0, 'grilletto analogico 0..1');
ok(triggerValue({ pressed: true, value: 0 }, 0.05) === 1, 'grilletto solo-digitale (value 0 ma pressed) => 1');
ok(triggerValue(undefined, 0.05) === 0, 'grilletto assente => 0');
ok(responseCurve(0.2) < 0.2 && near(responseCurve(1), 1) && responseCurve(0) === 0, 'curva di mira: piccoli movimenti piu\' precisi, fondo corsa = 1');

// --- bordi
const e1 = edge(false, true);
const e2 = edge(true, true);
const e3 = edge(true, false);
ok(e1.pressed && !e1.released && e1.down, 'bordo: prima pressione = pressed');
ok(!e2.pressed && !e2.released && e2.down, 'bordo: tenuto = ne\' pressed ne\' released');
ok(e3.released && !e3.pressed && !e3.down, 'bordo: rilascio = released');

// --- famiglie / simboli
ok(padFamily('Xbox 360 Controller (STANDARD GAMEPAD Vendor: 045e Product: 028e)') === 'xbox', 'riconosce Xbox');
ok(padFamily('DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)') === 'playstation', 'riconosce DualSense');
ok(padFamily('Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 09cc)') === 'playstation', 'riconosce DualShock 4');
ok(padFamily('USB Gamepad (Vendor: 0810 Product: e501)') === 'generic', 'sconosciuto = generico');
ok(padLabel('PRIMARY', 'xbox') === 'A' && padLabel('PRIMARY', 'playstation') === '✕' && padLabel('TOP', 'playstation') === '△' && padLabel('RT', 'playstation') === 'R2', 'simboli per famiglia (posizione, non nome)');
ok(padShortName('Xbox 360 Controller (STANDARD GAMEPAD Vendor: 045e)') === 'Xbox' && padShortName('DualSense Wireless Controller (STANDARD', 2) === 'PlayStation #3', 'nomi brevi (mai l\'id grezzo)');
ok(padShortName('') === 'Controller', 'id vuoto => "Controller"');

// --- registry / profili
const ids = new Set(MINIGAME_DEFINITIONS.map((m) => m.id));
for (const m of MINIGAME_DEFINITIONS) {
  ok(m.inputMode !== undefined, `${m.id}: inputMode dichiarato nel registry (${m.inputMode})`);
  if (m.inputMode === 'GAMEPAD') ok(!!profileFor(m.id), `${m.id}: inputMode GAMEPAD => esiste il profilo di input`);
  if (m.inputMode === 'PHONE_TEXT') ok(!profileFor(m.id), `${m.id}: gioco da telefono => nessun profilo gamepad`);
}
for (const id of Object.keys(PAD_PROFILES)) ok(ids.has(id), `profilo "${id}" corrisponde a un minigioco del registry`);
ok(MINIGAME_DEFINITIONS.find((m) => m.id === 'cultura')?.inputMode === 'PHONE_TEXT', 'Cultura o Cazzata resta PHONE_TEXT');
// ogni controlId dei profili e' dichiarato nel layout? (i giochi custom non elencano i controlli: si verifica solo la forma)
for (const p of Object.values(PAD_PROFILES)) {
  const all = [...p.sticks.map((s) => s.control), ...p.buttons.map((b) => b.control)];
  ok(all.every((c) => /^[a-zA-Z][a-zA-Z0-9]*$/.test(c)) && new Set(p.buttons.map((b) => b.from)).size === p.buttons.length, `${p.minigameId}: controlId ben formati e nessun tasto fisico usato due volte`);
}
// --- Xbox Wireless Controller non e' un DualShock
ok(padFamily('Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)') === 'xbox', '"Xbox Wireless Controller" = Xbox (contiene "wireless controller" ma non è PlayStation)');
ok(padFamily('Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 09cc)') === 'playstation', 'DualShock 4 ("Wireless Controller", vendor 054c) = PlayStation');
ok(padLabel('PRIMARY', 'generic') === 'PRIMARY' && padLabel('LEFT', 'generic') === 'ACTION' && padLabel('TOP', 'generic') === 'ABILITY', 'simboli generici: PRIMARY / SECONDARY / ACTION / ABILITY');
ok(bindingLabel('LEFT_STICK') === 'LEFT STICK' && bindingLabel('RT', 'playstation') === 'R2' && bindingLabel('RT', 'xbox') === 'RT', 'binding: LEFT STICK; RT = R2 su PlayStation, RT su Xbox');

// --- il profilo e' la fonte UNICA di input e schermata comandi
for (const pr of Object.values(PAD_PROFILES)) {
  const derived = pr.sticks.length + pr.buttons.length + pr.triggers.length;
  ok(derived === pr.controls.length, `${pr.minigameId}: ogni voce di controls produce esattamente un binding (${pr.controls.length} voci, ${derived} binding)`);
  ok(pr.controls.every((c) => c.label.trim().length > 0 && c.action.trim().length > 0), `${pr.minigameId}: ogni controllo ha azione e testo per la schermata CONTROLLI`);
  for (const b of pr.buttons) ok(pr.controls.some((c) => c.binding === b.from && c.control === b.control), `${pr.minigameId}: il tasto ${b.from} -> "${b.control}" e' lo STESSO mostrato nella schermata comandi`);
}
const ar = PAD_PROFILES.arena;
ok(ar.sticks[0]?.control === 'move' && ar.buttons.find((b) => b.control === 'dash')?.from === 'PRIMARY' && ar.buttons.find((b) => b.control === 'ability')?.from === 'SECONDARY', 'Arena: move = stick sinistro, dash = PRIMARY (A/✕), ability = SECONDARY (B/◯): i controlId che il gioco legge già');
process.exitCode = fails ? 1 : 0;
