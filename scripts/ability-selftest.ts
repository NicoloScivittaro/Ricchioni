/**
 * ABILITY SELFTEST — logica pura, senza browser:  npx tsx scripts/ability-selftest.ts
 *
 * 1. CATALOGO: 13 giochi x 5 personaggi = 65 abilita', tutte complete (nome, testi, limite, tipo, impatto, numeri), nessun testo con
 *    segnaposto non risolti, e i NUMERI citati nella descrizione sono quelli veri (niente "il codice fa 6 secondi, il telefono dice 8").
 * 2. INPUT: ogni gioco col controller ha un tasto ABILITA' nel profilo (la stessa fonte usata dalla schermata CONTROLLI).
 * 3. BUDGET: l'impatto ALTO ha un limite (cariche, ricarica, barra) e il tipo e' coerente.
 * 4. LOGICA per ogni gioco d'azione e per ognuno dei 5 personaggi: trigger valido, trigger NON valido (motivo del rifiuto), doppia
 *    attivazione, pulizia a fine round (un giocatore nuovo parte pulito: niente abilita' che sopravvive al restart).
 */
import { ABILITY_CATALOG, AB, abilityFor, stateLabel } from '../shared/abilityCatalog';
import type { AbilityGameId } from '../shared/abilityCatalog';
import { PAD_PROFILES } from '../src/input/profiles';
import { MINIGAME_DEFINITIONS } from '../shared/minigames';
import { ArenaAbilities } from '../src/minigames/arena/arenaAbilities';
import { createArenaPlayer } from '../src/minigames/arena/arenaTypes';
import { DodgeballAbilities } from '../src/minigames/dodgeball/dodgeballAbilities';
import { createDodgeballPlayer } from '../src/minigames/dodgeball/dodgeballTypes';
import { SoccerAbilities } from '../src/minigames/soccer/soccerAbilities';
import { createSoccerPlayer } from '../src/minigames/soccer/soccerTypes';
import { VolleyballAbilities } from '../src/minigames/volleyball/volleyballAbilities';
import { createVolleyballPlayer } from '../src/minigames/volleyball/volleyballTypes';
import { FpsAbilities } from '../src/minigames/fps/fpsAbilities';
import type { AbPlayer } from '../src/minigames/fps/fpsAbilities';
import { getWeapon } from '../shared/fpsWeapons';

let fails = 0;
let checks = 0;
const ok = (c: boolean, m: string): void => {
  checks++;
  if (!c) {
    fails++;
    console.log(`  ❌ ${m}`);
  }
};
const section = (t: string): void => console.log(`\n=== ${t} ===`);

const GAMES: AbilityGameId[] = ['arena', 'dodgeball', 'soccer', 'volleyball', 'kart3d', 'fps', 'memory', 'reaction', 'quiz', 'cultura', 'cornicione', 'casacarbo', 'minigolf'];
const CHARS = ['goblin', 'buttafuori', 'judoka', 'dottore', 'ciro'] as const;

// ----------------------------------------------------------------------------------------------------------- 1. catalogo
section('1. CATALOGO — 65 abilita\' complete e coerenti');
ok(ABILITY_CATALOG.length === 65, `65 abilita' nel catalogo (sono ${ABILITY_CATALOG.length})`);
const ids = new Set<string>();
for (const g of GAMES) {
  for (const c of CHARS) {
    const d = abilityFor(g, c);
    ok(!!d, `${g}/${c}: esiste`);
    if (!d) continue;
    ids.add(`${g}/${c}`);
    ok(d.name.trim().length >= 3, `${g}/${c}: nome`);
    ok(d.short.trim().length >= 10 && d.short.length <= 70, `${g}/${c}: riga breve 10-70 caratteri (${d.short.length})`);
    ok(d.full.trim().length >= 40 && d.full.length <= 330, `${g}/${c}: descrizione completa 40-330 caratteri (${d.full.length}) — "COSA FA · QUANDO PREMERE · LIMITE", niente lore`);
    ok(d.limit.trim().length > 0, `${g}/${c}: limite dichiarato`);
    for (const [k, v] of Object.entries(d.p)) ok(typeof v === 'number' && Number.isFinite(v), `${g}/${c}: parametro ${k} e' un numero (${v})`);
    for (const t of [d.name, d.short, d.full, d.limit]) ok(!/undefined|NaN|\$\{|\[object/.test(t), `${g}/${c}: nessun segnaposto non risolto in "${t.slice(0, 40)}"`);
    ok(/\.$/.test(d.full.trim()), `${g}/${c}: la descrizione finisce con un punto`);
  }
}
ok(ids.size === 65, '65 combinazioni uniche');

// i numeri in secondi citati nella descrizione devono essere quelli del parametro (stessa fonte)
const fmt = (n: number): string => (Number.isInteger(n) ? String(n) : String(n).replace('.', ','));
const DRIFT_KEYS = ['duration', 'arm', 'debt', 'freeze', 'retry', 'extra', 'vision', 'parry', 'window', 'aim', 'reset', 'focus', 'pause', 'beep', 'truck'];
for (const d of ABILITY_CATALOG) {
  for (const k of DRIFT_KEYS) {
    const v = d.p[k];
    if (typeof v !== 'number') continue;
    // alcuni parametri non sono "secondi" citati nel testo (finestre tecniche): li ammetto solo se il testo cita comunque il numero
    const cited = d.full.includes(fmt(v)) || d.short.includes(fmt(v));
    if (!cited && !['window'].includes(k)) ok(false, `${d.game}/${d.character}: il parametro ${k}=${v} non compare nella descrizione ("${d.full.slice(0, 70)}…") — rischio di descrizione diversa dal codice`);
  }
}

// ----------------------------------------------------------------------------------------------------------- 2. input
section('2. INPUT — ogni gioco col controller ha il tasto ABILITA\' (stessa fonte della schermata CONTROLLI)');
for (const m of MINIGAME_DEFINITIONS) {
  if (m.inputMode !== 'GAMEPAD') continue;
  const prof = PAD_PROFILES[m.id];
  ok(!!prof && prof.controls.some((c) => c.action === 'ABILITY'), `${m.id}: il profilo ha un'azione ABILITY`);
}
const fpsAb = PAD_PROFILES.fps?.controls.find((c) => c.action === 'ABILITY');
ok(fpsAb?.binding === 'RB', 'FPS: ABILITY su RB (prima riservato e senza effetto)');
// regola dell'utente: RB / R1 dove possibile, la mappatura gia' provata resta dove il gioco usa un altro tasto
// (il Quiz si gioca solo dal telefono dal commit 61a8e1c: niente profilo controller, quindi niente RB da controllare)
const padGame = (id: string): boolean => MINIGAME_DEFINITIONS.some((m) => m.id === id && m.inputMode === 'GAMEPAD');
for (const id of ['memory', 'reaction', 'quiz', 'fps', 'casacarbo'].filter(padGame)) ok(PAD_PROFILES[id]?.controls.find((c) => c.action === 'ABILITY')?.binding === 'RB', `${id}: ABILITA' su RB / R1`);

// ----------------------------------------------------------------------------------------------------------- 3. budget
section('3. BUDGET — niente spam: l\'impatto ALTO ha un limite');
for (const d of ABILITY_CATALOG) {
  if (d.impact === 'HIGH') ok(d.charges > 0 || d.cooldown >= 5 || /barra/.test(d.limit), `${d.game}/${d.character} (ALTO): ha cariche, ricarica >= 5 s o barra da riempire (${d.limit})`);
  if (d.cooldown > 0 && d.charges === 0) ok(d.cooldown >= 5, `${d.game}/${d.character}: ricarica >= 5 s (niente RB ogni 3 secondi)`);
  if (d.cooldown > 0 && d.charges > 0) ok(d.cooldown >= 5, `${d.game}/${d.character}: tra due usi almeno 5 s (${d.cooldown})`);
}
const high = ABILITY_CATALOG.filter((d) => d.impact === 'HIGH').length;
const med = ABILITY_CATALOG.filter((d) => d.impact === 'MEDIUM').length;
const low = ABILITY_CATALOG.filter((d) => d.impact === 'LOW').length;
ok(low === 0, `nessuna abilita' di impatto BASSO (${low}): sono una feature centrale`);
console.log(`  impatto: ${high} ALTO · ${med} MEDIO · ${low} BASSO`);

// ----------------------------------------------------------------------------------------------------------- 4. logica
/** Avanza il tempo a passi piccoli come nel gioco (un solo passo enorme farebbe scadere due finestre nello stesso frame). */
function stepUpdate<T>(update: (dt: number) => void, seconds: number): void {
  for (let t = 0; t < seconds; t += 0.02) update(0.02);
}

const feed = (): { ev: string[]; fb: (f: { type: string }) => void } => {
  const ev: string[] = [];
  return { ev, fb: (f) => void ev.push(f.type) };
};

section('4a. ARENA — 5 personaggi: trigger valido / invalido / doppia attivazione / pulizia');
{
  const ab = new ArenaAbilities(() => undefined, () => undefined);
  for (const c of CHARS) {
    const p = createArenaPlayer(`p_${c}`, c, '#fff', '🎮', c);
    const other = createArenaPlayer('other', null, '#000', '🎮', 'altro');
    other.x = 1.6;
    other.z = 0;
    other.facing = 0;
    p.facing = Math.PI / 2; // guarda verso +X dove sta l'altro
    ab.init(p);
    const { ev, fb } = feed();
    ok(ab.status(p).state === 'READY', `arena/${c}: parte PRONTA`);
    const r1 = ab.onAbilityPress(p, [p, other], fb);
    ok(r1 === 'ok', `arena/${c}: trigger valido -> parte`);
    const r2 = ab.onAbilityPress(p, [p, other], fb);
    ok(r2 !== 'ok' || c === 'buttafuori' || c === 'judoka' || c === 'goblin', `arena/${c}: premere subito di nuovo non raddoppia l'effetto (${r2})`);
    ok(ab.status(p).state !== 'READY' || c === 'judoka', `arena/${c}: dopo l'uso lo stato non e' piu' PRONTA (${ab.status(p).state})`);
    // un giocatore nuovo (restart/nuovo round) riparte pulito
    const p2 = createArenaPlayer(`q_${c}`, c, '#fff', '🎮', c);
    ab.init(p2);
    ok(ab.status(p2).state === 'READY' && p2.parryTime === 0 && p2.stanceTime === 0 && p2.armTime === 0 && p2.debtTime === 0 && p2.awareTime === 0 && p2.speedMult === 1 && p2.knockbackResist === 1, `arena/${c}: un round nuovo parte pulito (niente effetti residui)`);
    void ev;
  }
  // Goblin: la parata funziona SOLO nella finestra; a vuoto scatta la penalita'
  const g = createArenaPlayer('g', 'goblin', '#fff', '🎮', 'g');
  const atk = createArenaPlayer('a', null, '#000', '🎮', 'a');
  ab.init(g);
  const f1 = feed();
  ab.onAbilityPress(g, [g, atk], f1.fb);
  atk.dashing = true;
  const k = ab.shieldIncoming(g, 5, 0, atk, f1.fb);
  ok(k.x === 0 && k.z === 0 && f1.ev.includes('goblin_parry') && atk.stunTime > 0, 'arena/goblin: parata nella finestra = nessuna spinta per lui, stordito chi attacca');
  const g2 = createArenaPlayer('g2', 'goblin', '#fff', '🎮', 'g2');
  ab.init(g2);
  const f2 = feed();
  ab.onAbilityPress(g2, [g2], f2.fb);
  stepUpdate((dt) => ab.update(g2, dt, f2.fb), 0.6);
  ok(f2.ev.includes('goblin_whiff') && g2.whiffTime > 0 && g2.speedMult < 1, 'arena/goblin: finestra scaduta a vuoto = fuori equilibrio (rischio)');
  const k2 = ab.shieldIncoming(g2, 5, 0, atk, f2.fb);
  ok(k2.x > 5, 'arena/goblin: a vuoto subisce di PIU\' (non e\' gratis)');
  // Ciro: il bordo non elimina se armato, poi debito che scade
  const c = createArenaPlayer('c', 'ciro', '#fff', '🎮', 'c');
  ab.init(c);
  const f3 = feed();
  ok(!ab.tryRescue(c, 10, f3.fb), 'arena/ciro: senza aver armato il bordo elimina');
  ab.onAbilityPress(c, [c], f3.fb);
  c.x = 11;
  ok(ab.tryRescue(c, 10, f3.fb) && c.debtTime > 0 && Math.hypot(c.x, c.z) < 10, 'arena/ciro: armato, il bordo lo salva (rimesso dentro) e parte il debito');
  stepUpdate((dt) => ab.update(c, dt, f3.fb), AB.arena.ciro.p.debt + 0.1);
  ok(f3.ev.includes('ciro_collect'), 'arena/ciro: il debito scaduto viene riscosso');
  const c2 = createArenaPlayer('c2', 'ciro', '#fff', '🎮', 'c2');
  ab.init(c2);
  const f4 = feed();
  ab.onAbilityPress(c2, [c2], f4.fb);
  ab.tryRescue(c2, 10, f4.fb);
  ab.onPushLanded(c2, f4.fb);
  ok(f4.ev.includes('ciro_paid') && c2.debtTime === 0, 'arena/ciro: spingere qualcuno entro il debito lo salda');
  // Judoka: presa a portata / a vuoto
  const j = createArenaPlayer('j', 'judoka', '#fff', '🎮', 'j');
  const near = createArenaPlayer('n', null, '#000', '🎮', 'n');
  j.facing = 0; // guarda +Z
  near.x = 0;
  near.z = 1.5;
  ab.init(j);
  const f5 = feed();
  ab.onAbilityPress(j, [j, near], f5.fb);
  ok(f5.ev.includes('judoka_ippon') && near.stunTime > 0, 'arena/judoka: IPPON su chi e\' a portata e davanti');
  const j2 = createArenaPlayer('j2', 'judoka', '#fff', '🎮', 'j2');
  near.stunTime = 0;
  near.z = 9;
  ab.init(j2);
  const f6 = feed();
  ab.onAbilityPress(j2, [j2, near], f6.fb);
  ok(f6.ev.includes('judoka_whiff') && j2.stunTime > 0, 'arena/judoka: a vuoto perde tempo (rischio)');
  // Buttafuori: accumula e restituisce
  const b = createArenaPlayer('b', 'buttafuori', '#fff', '🎮', 'b');
  ab.init(b);
  const f7 = feed();
  ab.onAbilityPress(b, [b], f7.fb);
  const kk = ab.shieldIncoming(b, 10, 0, atk, f7.fb);
  ok(kk.x < 10 && b.stored > 0, 'arena/buttafuori: assorbe e accumula');
  stepUpdate((dt) => ab.update(b, dt, f7.fb), AB.arena.buttafuori.p.duration + 0.1);
  ok(f7.ev.includes('buttafuori_release') && b.knockbackResist === 1 && b.speedMult === 1, 'arena/buttafuori: a fine postura restituisce e ripristina i flag');
  // Dottore: schiva il primo scatto
  const d = createArenaPlayer('d', 'dottore', '#fff', '🎮', 'd');
  ab.init(d);
  const f8 = feed();
  ab.onAbilityPress(d, [d], f8.fb);
  atk.dashing = true;
  atk.stunTime = 0;
  const kd = ab.shieldIncoming(d, 5, 0, atk, f8.fb);
  ok(kd.x === 0 && f8.ev.includes('dottore_dodge') && atk.stunTime > 0 && d.awareTime === 0, 'arena/dottore: schiva il primo scatto diretto e chi attacca inciampa');
  const d2 = createArenaPlayer('d2', 'dottore', '#fff', '🎮', 'd2');
  ab.init(d2);
  const f9 = feed();
  ab.onAbilityPress(d2, [d2], f9.fb);
  stepUpdate((dt) => ab.update(d2, dt, f9.fb), AB.arena.dottore.p.window + 0.1);
  ok(f9.ev.includes('dottore_drowsy') && d2.speedMult < 1, 'arena/dottore: se nessuno attacca si riaddormenta (lento)');
  stepUpdate((dt) => ab.update(d2, dt, f9.fb), AB.arena.dottore.p.drowsy + 0.1);
  ok(d2.speedMult === 1, 'arena/dottore: il malus finisce da solo');
}

section('4b. DODGEBALL — trigger valido / invalido / stato / pulizia');
{
  const ab = new DodgeballAbilities();
  for (const c of CHARS) {
    const p = createDodgeballPlayer(`p_${c}`, c, '#fff', '🎮', c);
    ab.init(p);
    const { ev, fb } = feed();
    ok(ab.status(p).state === 'READY', `dodgeball/${c}: parte PRONTA`);
    ok(ab.onAbilityPress(p, 0, 1, fb) === 'ok', `dodgeball/${c}: trigger valido`);
    ok(ab.onAbilityPress(p, 0, 1, fb) === 'busy', `dodgeball/${c}: la seconda pressione mentre e' attiva NON raddoppia (busy)`);
    ok(ab.status(p).state === 'ACTIVE', `dodgeball/${c}: lo stato e' ATTIVA`);
    const dead = createDodgeballPlayer('dead', c, '#fff', '🎮', 'dead');
    dead.alive = false;
    ab.init(dead);
    ok(ab.onAbilityPress(dead, 0, 1, () => undefined) === 'busy', `dodgeball/${c}: da eliminato non parte (trigger invalido)`);
    const fresh = createDodgeballPlayer(`q_${c}`, c, '#fff', '🎮', c);
    ab.init(fresh);
    ok(ab.status(fresh).state === 'READY' && fresh.parryTime === 0 && fresh.aimTime === 0 && fresh.visionTime === 0 && fresh.truckTime === 0 && !fresh.deferArmed && !fresh.debtActive, `dodgeball/${c}: un round nuovo parte pulito`);
    void ev;
  }
  const g = createDodgeballPlayer('g', 'goblin', '#fff', '🎮', 'g');
  ab.init(g);
  const f = feed();
  ab.onAbilityPress(g, 0, 1, f.fb);
  stepUpdate((dt) => ab.update(g, dt, f.fb), 1);
  ok(f.ev.includes('goblin_whiff') && g.parryTime === 0, 'dodgeball/goblin: parata a vuoto -> whiff, finestra chiusa');
  ok(ab.onAbilityPress(g, 0, 1, f.fb) === 'cooldown', 'dodgeball/goblin: subito dopo e\' in ricarica (niente spam)');
  stepUpdate((dt) => ab.update(g, dt, f.fb), AB.dodgeball.goblin.cooldown + 0.1);
  ok(ab.onAbilityPress(g, 0, 1, f.fb) === 'ok', 'dodgeball/goblin: dopo la ricarica si puo\' riusare (2 cariche)');
  stepUpdate((dt) => ab.update(g, dt, f.fb), AB.dodgeball.goblin.cooldown + 1);
  ok(ab.onAbilityPress(g, 0, 1, f.fb) === 'spent' || ab.onAbilityPress(g, 0, 1, f.fb) === 'busy', 'dodgeball/goblin: finite le cariche e\' ESAURITA');
  const c = createDodgeballPlayer('c', 'ciro', '#fff', '🎮', 'c');
  ab.init(c);
  const f2 = feed();
  ab.onAbilityPress(c, 0, 1, f2.fb);
  ok(ab.handleIncomingHit(c, f2.fb) === 'survive' && c.debtActive, 'dodgeball/ciro: armato, il colpo che elimina diventa debito');
  ok(ab.handleIncomingHit(c, f2.fb) === 'die', 'dodgeball/ciro: col debito aperto il colpo successivo elimina');
}

section('4c. CALCIO — trigger valido / invalido / pulizia');
{
  const ab = new SoccerAbilities();
  for (const c of CHARS) {
    const p = createSoccerPlayer(`p_${c}`, c, '#fff', '🎮', c, 'red', false);
    ab.init(p);
    const f = feed();
    ok(ab.status(p).state === 'READY', `soccer/${c}: parte PRONTA`);
    if (c === 'goblin' || c === 'ciro') ok(ab.onAbilityPress(p, null, f.fb) === 'noball', `soccer/${c}: senza palla -> SERVE LA PALLA (rifiuto privato, niente sprecato)`);
    if (c === 'judoka') ok(ab.onAbilityPress(p, null, f.fb) === 'far' && p.abCharges === 2, 'soccer/judoka: nessun portatore a portata -> non costa niente');
    p.hasBall = true;
    const carrier = c === 'judoka' ? { player: createSoccerPlayer('v', null, '#000', '🎮', 'v', 'blue', false), dist: 1.5 } : null;
    ok(ab.onAbilityPress(p, carrier, f.fb) === 'ok', `soccer/${c}: trigger valido`);
    if (c !== 'judoka') ok(ab.onAbilityPress(p, carrier, f.fb) === 'busy', `soccer/${c}: doppia attivazione bloccata`);
    ab.clearEffects(p);
    ok(p.perfectTime === 0 && p.stanceTime === 0 && p.lucidTime === 0 && p.armTime === 0 && p.debtTime === 0 && p.slowTime === 0, `soccer/${c}: dopo il gol/ripartenza nessuna finestra aperta`);
  }
  const b = createSoccerPlayer('b', 'buttafuori', '#fff', '🎮', 'b', 'blue', false);
  const att = createSoccerPlayer('a', null, '#000', '🎮', 'a', 'red', false);
  ab.init(b);
  ok(ab.resolveTackle(att, b) === 'steal', 'soccer/buttafuori: senza postura il contrasto ruba la palla');
  ab.onAbilityPress(b, null, () => undefined);
  ok(ab.resolveTackle(att, b) === 'wall' && att.stunTime > 0, 'soccer/buttafuori: in postura il contrasto rimbalza e chi attacca resta fermo');
  const ci = createSoccerPlayer('ci', 'ciro', '#fff', '🎮', 'ci', 'blue', false);
  ci.hasBall = true;
  ab.init(ci);
  ab.onAbilityPress(ci, null, () => undefined);
  const att2 = createSoccerPlayer('a2', null, '#000', '🎮', 'a2', 'red', false);
  ok(ab.resolveTackle(att2, ci) === 'ciro' && ci.debtTime > 0 && att2.stunTime > 0 && ci.armTime === 0, 'soccer/ciro: il primo contrasto e\' rimandato (chi attacca inciampa) e parte il debito');
  ok(ab.resolveTackle(att2, ci) === 'steal', 'soccer/ciro: il secondo contrasto non e\' protetto');
  const gb = createSoccerPlayer('gb', 'goblin', '#fff', '🎮', 'gb', 'red', false);
  ok(ab.inSweetSpot(AB.soccer.goblin.p.sweetFrom + 0.01) && !ab.inSweetSpot(0.3) && !ab.inSweetSpot(1), 'soccer/goblin: la zona verde e\' una finestra stretta (non basta caricare a fondo)');
  void gb;
}

section('4d. PALLAVOLO — trigger valido / invalido / pulizia');
{
  const ab = new VolleyballAbilities();
  for (const c of CHARS) {
    const p = createVolleyballPlayer(`p_${c}`, c, '#fff', '🎮', c, 'red', false);
    ab.init(p);
    const f = feed();
    ok(ab.status(p).state === 'READY', `volley/${c}: parte PRONTA`);
    if (c === 'judoka') ok(ab.onAbilityPress(p, false, f.fb) === 'noball', 'volley/judoka: senza palla in aria -> SERVE LA PALLA IN ARIA');
    ok(ab.onAbilityPress(p, true, f.fb) === 'ok', `volley/${c}: trigger valido`);
    ok(ab.onAbilityPress(p, true, f.fb) === 'busy' || ab.onAbilityPress(p, true, f.fb) === 'spent', `volley/${c}: doppia attivazione bloccata`);
    ab.clearEffects(p);
    ok(p.jagerTime === 0 && p.muroTime === 0 && p.lucidTime === 0 && p.dizzyTime === 0 && p.armTime === 0, `volley/${c}: a fine scambio nessuna finestra aperta`);
  }
  const d = createVolleyballPlayer('d', 'dottore', '#fff', '🎮', 'd', 'red', false);
  ab.init(d);
  const f = feed();
  ab.onAbilityPress(d, true, f.fb);
  ok(ab.speedFactor(d) > 1 && ab.jumpFactor(d) > 1, 'volley/dottore: corre e salta meglio mentre e\' lucido');
  stepUpdate((dt) => ab.update(d, dt, f.fb), AB.volleyball.dottore.p.duration + 0.1);
  ok(f.ev.includes('dottore_dizzy') && ab.speedFactor(d) < 1, 'volley/dottore: dopo gli gira la testa (malus)');
}

section('4e. SPARATORIA — trigger valido / invalido / pulizia alla morte');
{
  const ab = new FpsAbilities();
  const mk = (cid: string | null, id = cid ?? 'x', x = 0): AbPlayer => ({
    id,
    characterId: cid,
    x,
    z: 0,
    yaw: Math.PI / 2, // guarda +X
    hp: 100,
    alive: true,
    spawnProtection: 0,
    reloading: false,
    reloadTimer: 0,
    magazine: 10,
    burstLeft: 0,
    abCharges: 0,
    abCd: 0,
    buffShots: 0,
    guardTime: 0,
    guardAbsorbed: 0,
    wallTime: 0,
    drowsyTime: 0,
    armTime: 0,
    debtTime: 0,
    lockTime: 0,
    stunTime: 0,
    abKills: 0
  });
  const w = getWeapon('mitraglia');
  for (const c of CHARS) {
    const p = mk(c);
    ab.init(p);
    const enemy = mk(null, 'e', 2);
    const f = feed();
    ok(ab.status(p, w).state === 'READY', `fps/${c}: parte PRONTA`);
    // trigger NON valido
    if (c === 'goblin') ok(ab.onAbilityPress(p, w, [p], f.fb) === 'notreloading', 'fps/goblin: senza ricarica -> RICARICA PRIMA (niente sprecato)');
    if (c === 'judoka') ok(ab.onAbilityPress(p, w, [p], f.fb) === 'nobody' && p.abCd === 0, 'fps/judoka: nessuno davanti -> non costa niente');
    // trigger valido
    if (c === 'goblin') {
      p.reloading = true;
      p.reloadTimer = w.reload * 0.2; // 80% fatto: dentro la zona verde
      p.magazine = 3;
    }
    ok(ab.onAbilityPress(p, w, [p, enemy], f.fb) === 'ok', `fps/${c}: trigger valido`);
    ok(ab.status(p, w).state !== 'READY', `fps/${c}: dopo l'uso non e' piu' PRONTA (${ab.status(p, w).state})`);
    const again = ab.onAbilityPress(p, w, [p, enemy], f.fb);
    ok(again !== 'ok', `fps/${c}: nessuna doppia attivazione (${again})`);
    ab.onDeath(p);
    ok(p.buffShots === 0 && p.guardTime === 0 && p.wallTime === 0 && p.drowsyTime === 0 && p.armTime === 0 && p.debtTime === 0 && p.lockTime === 0 && p.stunTime === 0, `fps/${c}: la morte chiude ogni finestra`);
  }
  // Goblin: troppo presto = ricarica allungata, ricarica perfetta = istantanea + bonus
  const g = mk('goblin');
  ab.init(g);
  g.reloading = true;
  g.reloadTimer = w.reload * 0.95;
  const f1 = feed();
  ab.onAbilityPress(g, w, [g], f1.fb);
  ok(f1.ev.includes('early_reload') && g.reloading && g.reloadTimer > w.reload * 0.95 && g.buffShots === 0, 'fps/goblin: troppo presto = la ricarica si allunga, niente bonus');
  const g2 = mk('goblin', 'g2');
  ab.init(g2);
  g2.reloading = true;
  g2.reloadTimer = w.reload * 0.2;
  const f2 = feed();
  ab.onAbilityPress(g2, w, [g2], f2.fb);
  ok(f2.ev.includes('perfect_reload') && !g2.reloading && g2.magazine === w.magazine && g2.buffShots > 0 && ab.damageFactor(g2) > 1, 'fps/goblin: ricarica perfetta = istantanea + danno extra');
  for (let i = 0; i < AB.fps.goblin.p.buffShots; i++) ab.onShotFired(g2);
  ok(ab.damageFactor(g2) === 1, 'fps/goblin: finiti i colpi del bonus il danno torna normale');
  // Buttafuori: giubbotto riduce e poi cura
  const b = mk('buttafuori');
  ab.init(b);
  const f3 = feed();
  ab.onAbilityPress(b, w, [b], f3.fb);
  const through = ab.reduceDamage(b, 50);
  ok(through < 50 && b.guardAbsorbed > 0, 'fps/buttafuori: il giubbotto assorbe parte del danno');
  b.hp = 50;
  stepUpdate((dt) => ab.update(b, dt, f3.fb), AB.fps.buttafuori.p.duration + 0.1);
  ok(f3.ev.includes('guard_end') && b.hp > 50 && b.hp <= 100, 'fps/buttafuori: a fine giubbotto recupera una parte di vita');
  // Judoka: spinta, interruzione, ippon
  const j = mk('judoka');
  const near = mk(null, 'near', 1.5);
  const far = mk(null, 'far', 5);
  far.reloading = true;
  far.reloadTimer = 1;
  ab.init(j);
  const f4 = feed();
  ok(ab.onAbilityPress(j, w, [j, near, far], f4.fb) === 'ok', 'fps/judoka: spinta con bersagli davanti');
  ok(near.stunTime > 0 && near.lockTime > 0 && far.lockTime > 0 && !far.reloading && far.stunTime === 0, 'fps/judoka: a < 2,5 m IPPON (a terra), piu\' lontano solo interrotto e bloccato');
  ok(near.x > 1.5 && far.x > 5, 'fps/judoka: i colpiti vengono respinti');
  // Ciro: la morte diventa debito, la kill lo salda, altrimenti scade
  const ci = mk('ciro');
  ab.init(ci);
  const f5 = feed();
  ok(!ab.rescue(ci, f5.fb), 'fps/ciro: senza aver armato la morte e\' normale');
  ab.onAbilityPress(ci, w, [ci], f5.fb);
  ok(ab.rescue(ci, f5.fb) && ci.debtTime > 0 && ci.armTime === 0, 'fps/ciro: armato, il colpo mortale diventa debito');
  let healed = 0;
  ab.onKill(ci, f5.fb, (hp) => (healed += hp));
  ok(f5.ev.includes('debt_paid') && healed > 0 && ci.debtTime === 0, 'fps/ciro: una kill entro il debito lo salda e cura');
  const ci2 = mk('ciro', 'ci2');
  ab.init(ci2);
  const f6 = feed();
  ab.onAbilityPress(ci2, w, [ci2], f6.fb);
  ab.rescue(ci2, f6.fb);
  stepUpdate((dt) => ab.update(ci2, dt, f6.fb), AB.fps.ciro.p.debt + 0.1);
  ok(f6.ev.includes('debt_collect'), 'fps/ciro: se il debito scade viene riscosso (muore)');
  ok(ci2.abCharges === 1, 'fps/ciro: 2 usi a partita (uno consumato)');
  // Dottore: raggi X poi la mira trema
  const d = mk('dottore');
  ab.init(d);
  const f7 = feed();
  ab.onAbilityPress(d, w, [d], f7.fb);
  ok(d.wallTime > 0 && ab.spreadFactor(d) === 1, 'fps/dottore: vede tutti mentre dura');
  stepUpdate((dt) => ab.update(d, dt, f7.fb), AB.fps.dottore.p.duration + 0.1);
  ok(d.wallTime === 0 && d.drowsyTime > 0 && ab.spreadFactor(d) > 1, 'fps/dottore: poi la mira trema (malus)');
}

section('4f. STATO PRESENTAZIONALE — etichette leggibili');
ok(stateLabel({ state: 'READY' }) === 'PRONTA', 'READY -> PRONTA');
ok(stateLabel({ state: 'READY', charges: 2 }) === 'PRONTA · 2 USI', 'READY con 2 cariche');
ok(stateLabel({ state: 'ACTIVE', remaining: 4.2 }) === 'ATTIVA · 4,2 s', 'ACTIVE con tempo');
ok(stateLabel({ state: 'COOLDOWN', remaining: 5.2 }) === 'RICARICA · 6 s', 'COOLDOWN arrotonda per eccesso');
ok(stateLabel({ state: 'SPENT' }) === 'ESAURITA', 'SPENT -> ESAURITA');
ok(stateLabel({ state: 'ACTIVE', note: 'PREMI ORA!' }) === 'PREMI ORA!', 'una nota del gioco sostituisce l\'etichetta');

console.log(`\n${fails === 0 ? '✅' : '❌'} ${checks - fails}/${checks} controlli ok${fails ? ` · ${fails} FALLITI` : ''}`);
process.exitCode = fails ? 1 : 0;
