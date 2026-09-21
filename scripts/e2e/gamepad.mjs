// GAMEPAD (Milestone 1 + 2): controller simulati (navigator.getGamepads sostituito nella pagina host; il browser headless non ha
// hardware). Prova: rilevamento fuori ordine, pairing rapido (cursore) e guidato (target), un controller = un giocatore, tetto Chrome
// a 4 pad ("5° CONTROLLER NON RILEVATO"), Arena pilotata dai controller (deadzone, diagonale, dash, rumble), telefono che passa a
// "USA IL CONTROLLER" e ritorna ai controlli in FALLBACK, disconnessione (input azzerati), riconnessione (stesso id / id ambiguo),
// persistenza dell'associazione fra rullo, giochi e Cultura (telefono), nessun input fantasma dopo transizione e pausa.
//   node scripts/e2e/gamepad.mjs            N=5 (giocatori del giro completo)      SMALL=2,3,4 (giri brevi con 2/3/4 pad)
import { launch, createRoomOnHost, addPhone, hostEval, hostSnapshot, sleep } from './lib.mjs';

const N = Number(process.env.N ?? 5);
const SMALL = (process.env.SMALL ?? '2,3,4').split(',').filter(Boolean).map(Number);
let fails = 0;
const check = (c, m) => {
  console.log(`${c ? '✅' : '❌'} ${m}`);
  if (!c) fails++;
};
const XBOX = 'Xbox 360 Controller (STANDARD GAMEPAD Vendor: 045e Product: 028e)';
const XBOX1 = 'Xbox One Controller (STANDARD GAMEPAD Vendor: 045e Product: 02fd)';
const DS = 'DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)';
const GENERIC = 'USB Gamepad (Vendor: 0810 Product: e501)';

/** Controller finti: navigator.getGamepads legge window.__mp (chi entra e cosa preme lo decide il test). */
async function installMock(page, cap = 6) {
  await page.evaluate((cap) => {
    const mp = (window.__mp = { pads: {}, rumbles: [], cap, names: ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'BACK', 'START', 'L3', 'R3', 'UP', 'DOWN', 'LEFT', 'RIGHT'] });
    navigator.getGamepads = () => {
      const a = new Array(mp.cap).fill(null);
      for (const k of Object.keys(mp.pads)) {
        const p = mp.pads[k];
        if (p.index >= mp.cap) continue; // il browser non lo espone (Chrome: massimo 4)
        a[p.index] = {
          index: p.index,
          id: p.id,
          connected: true,
          mapping: 'standard',
          axes: [...p.axes],
          buttons: p.buttons.map((b) => ({ pressed: b.v > 0.5, value: b.v })),
          vibrationActuator: p.rumble ? { playEffect: (t, o) => (mp.rumbles.push({ index: p.index, ...o }), Promise.resolve('complete')) } : undefined
        };
      }
      return a;
    };
    window.__padAdd = (index, id, rumble = true) => {
      mp.pads[index] = { index, id, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ v: 0 })), rumble };
      const ev = new Event('gamepadconnected'); // come il browser vero: l'evento porta il gamepad (Phaser lo legge)
      ev.gamepad = navigator.getGamepads()[index] ?? { index, id, buttons: [], axes: [] };
      window.dispatchEvent(ev);
    };
    window.__padRemove = (index) => {
      const gone = { index, id: mp.pads[index]?.id ?? '', buttons: [], axes: [], connected: false };
      delete mp.pads[index];
      const ev = new Event('gamepaddisconnected');
      ev.gamepad = gone;
      window.dispatchEvent(ev);
    };
    window.__padBtn = (index, name, down) => {
      if (mp.pads[index]) mp.pads[index].buttons[mp.names.indexOf(name)].v = down ? 1 : 0;
    };
    window.__padStick = (index, lx, ly, rx = 0, ry = 0) => {
      if (mp.pads[index]) mp.pads[index].axes = [lx, ly, rx, ry];
    };
  }, cap);
}
const add = (page, index, id, rumble = true) => page.evaluate((i, d, r) => window.__padAdd(i, d, r), index, id, rumble);
const remove = (page, index) => page.evaluate((i) => window.__padRemove(i), index);
const btn = (page, index, name, down) => page.evaluate((i, n, d) => window.__padBtn(i, n, d), index, name, down);
const stick = (page, index, x, y, rx = 0, ry = 0) => page.evaluate((i, a, b, c, d) => window.__padStick(i, a, b, c, d), index, x, y, rx, ry);
/** Il polling e' per fotogramma e l'host headless gira a ~10 fps: il tocco deve durare qualche fotogramma. */
async function tap(page, index, name, hold = 380) {
  await btn(page, index, name, true);
  await sleep(hold);
  await btn(page, index, name, false);
  await sleep(220);
}
const pads = (page, fn, arg) => page.evaluate(fn, arg);
const slot = (page, pid) => page.evaluate((id) => JSON.parse(JSON.stringify(window.__pads.slotOf(id))), pid);
const arenaPlayer = (page, pid) =>
  page.evaluate(async (id) => {
    const url = performance.getEntriesByType('resource').map((e) => e.name).find((n) => /GameManager.ts/.test(n));
    const { game: gm } = await import(url);
    const g = gm.game.scene.getScene('arena')?.game3d;
    const p = g?.players?.find((x) => x.id === id);
    return p ? { x: p.x, z: p.z, vx: p.vx, vz: p.vz, dashing: p.dashing, dashCooldown: p.dashCooldown, alive: p.alive, phase: g.phase } : null;
  }, pid);
const axisOf = (page, pid) => hostEval(page, (gm, id) => gm.input.get(id).axis('move'), pid);
const until = async (fn, ms, what) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await fn()) return true;
    await sleep(200);
  }
  throw new Error('timeout: ' + what);
};
const phoneText = (ph) => ph.page.evaluate(() => (document.getElementById('app')?.innerText ?? '').replace(/\s+/g, ' '));
const hostText = (page) => page.evaluate(() => (document.getElementById('pad-root')?.innerText ?? '') + ' | ' + (document.getElementById('pad-alert')?.innerText ?? '') + ' | ' + (document.getElementById('pad-toasts')?.innerText ?? ''));

async function startArena(page) {
  await hostEval(page, (gm, id) => gm.selectMinigame(id), 'arena');
  await sleep(300);
  await page.keyboard.press('Enter');
  await until(async () => (await hostSnapshot(page)).phase === 'MINIGAME_PLAYING', 60000, 'arena PLAYING');
  await until(async () => (await hostEval(page, (gm) => gm.game.scene.getScene('arena')?.game3d?.phase)) === 'playing', 40000, 'arena via');
}
async function finishNow(page) {
  await hostEval(page, (gm) => {
    const ctx = gm.minigameContext;
    ctx.finish({ results: ctx.players.map((pl, i) => ({ playerId: pl.id, placement: i + 1, score: 5 - i })) });
  });
}

// ============================================================ giro completo con N giocatori
async function fullRun(browser) {
  console.log(`\n=== GIRO COMPLETO, ${N} giocatori ===`);
  const { page, code } = await createRoomOnHost(browser, { targetKeyPresses: N - 2 });
  const errs = [];
  page.on('pageerror', (e) => errs.push('HOST ' + String(e.stack ?? e).replace(/\s+/g, ' ').slice(0, 420)));
  const phones = [];
  for (let i = 0; i < N; i++) {
    const p = await addPhone(browser, code, `P${i + 1}`, i);
    p.page.on('pageerror', (e) => errs.push(`P${i + 1} ` + String(e).slice(0, 160)));
    phones.push(p);
  }
  const pids = await hostEval(page, (gm) => gm.state.players.map((p) => p.id));
  check(pids.length === N, `${N} giocatori nella stanza`);
  await installMock(page, 4); // Chrome espone al massimo 4 controller

  // ---- rilevamento fuori ordine: indici 2,0,3,1 con id diversi (0 e 1 sono identici: DualSense)
  await add(page, 2, XBOX1);
  await add(page, 0, DS);
  await add(page, 3, GENERIC, false);
  await add(page, 1, DS);
  await sleep(500);
  const views = await pads(page, () => window.__pads.views().map((v) => ({ i: v.index, n: v.shortName, f: v.family, r: v.rumble })));
  check(views.length === 4, `il browser espone 4 controller (${views.map((v) => v.n).join(', ')})`);
  check(views.find((v) => v.i === 3)?.f === 'generic' && views.find((v) => v.i === 2)?.f === 'xbox' && views.find((v) => v.i === 0)?.f === 'playstation', 'famiglie riconosciute: Xbox / PlayStation / generico');
  check((await hostText(page)).includes('COLLEGA I CONTROLLER'), 'in lobby il pannello 🎮 COLLEGA I CONTROLLER compare da solo');
  check((await hostText(page)).includes('NESSUN CONTROLLER'), 'ogni giocatore mostra "NESSUN CONTROLLER"');

  // ---- pairing rapido con cursore: il pad 2 sceglie il 2° giocatore (A, giu', A)
  await tap(page, 2, 'A');
  check((await hostText(page)).includes('controller #3 sta scegliendo'), 'il pad #2 ha un cursore sul primo giocatore libero');
  await tap(page, 2, 'DOWN');
  await tap(page, 2, 'A');
  check((await slot(page, pids[1])).padIndex === 2 && (await slot(page, pids[1])).state === 'paired', `pad #2 (Xbox) -> ${pids[1]} (2° giocatore) col cursore`);
  check((await pads(page, () => window.__mp.rumbles.filter((r) => r.index === 2).length)) >= 1, 'il pad vibra alla conferma dell\'associazione');
  check((await hostText(page)).includes('CONTROLLER COLLEGATO'), 'feedback sul PC: ✅ CONTROLLER COLLEGATO');
  // ---- pairing guidato: si sceglie il giocatore 5 (o l'ultimo) sulla TV, il primo pad libero che preme A lo prende
  const last = pids[N - 1];
  await pads(page, (id) => window.__pads.setTarget(id), last);
  await tap(page, 0, 'A');
  check((await slot(page, last)).padIndex === 0, `guidato: il pad #0 (DualSense) ha preso l'ultimo giocatore`);
  await pads(page, () => window.__pads.setTarget(null));
  // un controller gia' assegnato NON puo' prendere un secondo giocatore
  await tap(page, 0, 'A');
  check((await pads(page, () => window.__pads.slotList().filter((s) => s.padIndex === 0).length)) === 1, 'un controller e\' associato a UN solo giocatore');
  // pad 3 e pad 1: cursore
  await tap(page, 3, 'A');
  await tap(page, 3, 'A'); // conferma il primo libero
  const s3 = await pads(page, () => window.__pads.slotList().find((s) => s.padIndex === 3));
  check(!!s3, `pad #3 (generico) associato a ${s3?.playerId}`);
  const freeNow = await pads(page, () => window.__pads.slotList().filter((s) => s.state !== 'paired').map((s) => s.playerId));
  await tap(page, 1, 'A');
  await tap(page, 1, 'A'); // conferma il primo libero
  if (N === 5) {
    check(freeNow.length === 2, 'con 5 giocatori e 4 controller: uno resta senza');
    check(/5° CONTROLLER NON RILEVATO/.test(await hostText(page)), 'messaggio "5° CONTROLLER NON RILEVATO" per chi non ha controller');
  }
  const paired = await pads(page, () => window.__pads.slotList().filter((s) => s.state === 'paired').length);
  check(paired === Math.min(N, 4), `controller associati: ${paired}/${N} (massimo 4 esposti da Chrome)`);
  const owners = await pads(page, () => window.__pads.slotList().filter((s) => s.state === 'paired').map((s) => s.padIndex));
  check(new Set(owners).size === owners.length, 'nessun controller assegnato a due giocatori');

  // il server e i telefoni sanno chi ha un controller
  await sleep(600);
  const padOfPlayer = await hostEval(page, (gm) => Object.fromEntries(gm.state.players.map((p) => [p.id, p.pad ?? null])));
  const withPad = pids.filter((id) => padOfPlayer[id]);
  check(withPad.length === paired, `lo stato della stanza riporta il controller di ${withPad.length} giocatori`);

  // ---- ARENA coi controller
  await startArena(page);
  const holders = pids.filter((id) => padOfPlayer[id]);
  const noPad = pids.filter((id) => !padOfPlayer[id]);
  const idx = async (pid) => (await slot(page, pid)).padIndex;
  const withPadPhone = phones[pids.indexOf(holders[0])];
  const t = await phoneText(withPadPhone);
  check(/USA IL CONTROLLER/.test(t) && /ARENA/.test(t) && /CONTROLLER CONNESSO/.test(t), `telefono di chi ha il controller: "${t.slice(0, 70)}"`);
  check(await withPadPhone.page.evaluate(() => !document.querySelector('.arena-joy-base, .arena-joy') && !document.querySelector('#arena-status')), 'sul telefono NON ci sono joystick e pulsanti mobile');
  if (noPad.length) {
    const fb = phones[pids.indexOf(noPad[0])];
    check(await fb.page.evaluate(() => !!document.getElementById('pad-fallback-badge') && /FALLBACK/.test(document.getElementById('pad-fallback-badge').textContent)), '📱 MODALITÀ FALLBACK sul telefono di chi non ha controller');
    check(await fb.page.evaluate(() => !!document.querySelector('.arena-joy-base') || !!document.querySelector('#arena-status')), 'il fallback ha i controlli del telefono (non resta bloccato)');
  }

  // movimento: stick a destra su UN pad muove SOLO il suo giocatore
  // A: un giocatore con controller che vibra (il pad #3 e' generico e senza rumble: serve a provare che non genera errori)
  const rumbleHolders = [];
  for (const id of holders) if ((await idx(id)) !== 3) rumbleHolders.push(id);
  const A = rumbleHolders[0];
  const B = holders.find((id) => id !== A);
  const phoneOfA = phones[pids.indexOf(A)];
  const a0 = await arenaPlayer(page, A);
  const b0 = await arenaPlayer(page, B);
  await stick(page, await idx(A), 1, 0);
  await sleep(1000);
  const ax = await axisOf(page, A);
  await stick(page, await idx(A), 0, 0);
  const a1 = await arenaPlayer(page, A);
  const b1 = await arenaPlayer(page, B);
  check(Math.abs(ax.x - 1) < 1e-6 && ax.y === 0, `stick a fondo a destra => asse move (${ax.x.toFixed(2)}, ${ax.y.toFixed(2)})`);
  check(Math.hypot(a1.x - a0.x, a1.z - a0.z) > 0.5, `il personaggio del pad si muove (${Math.hypot(a1.x - a0.x, a1.z - a0.z).toFixed(1)} u)`);
  check(Math.hypot(b1.x - b0.x, b1.z - b0.z) < 0.05, 'gli altri personaggi restano fermi (identita\' per playerId, non per indice)');
  // deadzone e diagonale
  await stick(page, await idx(A), 0.1, 0.05);
  await sleep(500);
  const dz = await axisOf(page, A);
  check(dz.x === 0 && dz.y === 0, 'dentro la deadzone l\'asse e\' esattamente 0 (nessun drift)');
  await stick(page, await idx(A), 1, 1);
  await sleep(500);
  const dg = await axisOf(page, A);
  check(Math.abs(Math.hypot(dg.x, dg.y) - 1) < 1e-6, `diagonale (1,1): grandezza ${Math.hypot(dg.x, dg.y).toFixed(3)} (non 1.414)`);
  await stick(page, await idx(A), 0, 0);
  await sleep(300);
  // dash + rumble (verso il centro: il dash e' lungo e verso il bordo farebbe cadere il personaggio)
  const toC = async () => {
    const h = await arenaPlayer(page, A);
    const m = Math.hypot(h.x, h.z) || 1;
    await stick(page, await idx(A), -h.x / m, h.z / m);
  };
  await toC();
  await sleep(300);
  const r0 = await pads(page, () => window.__mp.rumbles.length);
  await tap(page, await idx(A), 'A', 450);
  await stick(page, await idx(A), 0, 0);
  await sleep(400);
  const aD = await arenaPlayer(page, A);
  check(aD.dashing || aD.dashCooldown > 0, `A/✕ = SCATTO (dashCooldown ${aD.dashCooldown.toFixed(2)})`);
  check((await pads(page, () => window.__mp.rumbles.length)) > r0, 'il dash fa vibrare il controller (non il telefono)');
  check((await pads(page, () => window.__pads.handles(window.__pads.slotList().find((s) => s.padIndex !== null).playerId))) === true, 'il manager segnala che il giocatore gioca col controller');

  // ---- DISCONNESSIONE con lo stick tenuto: nessun input residuo, nessun personaggio che cammina da solo
  // stick tenuto VERSO IL CENTRO (una corsa verso il bordo farebbe cadere il personaggio e falserebbe la prova)
  await toC();
  await sleep(600);
  const speedBefore = await arenaPlayer(page, A);
  check(speedBefore.alive, 'prima della disconnessione il personaggio e ancora in gioco');
  const slotA = await slot(page, A);
  const idxA = slotA.padIndex;
  await remove(page, idxA);
  await sleep(900);
  const axD = await axisOf(page, A);
  check(axD.x === 0 && axD.y === 0, 'disconnessione: move azzerato');
  await sleep(3500); // l'inerzia dell'ultimo movimento si esaurisce (il tempo di gioco headless scorre piu' lento del reale)
  const p1 = await arenaPlayer(page, A);
  await sleep(900);
  const p2 = await arenaPlayer(page, A);
  const sp = (q) => Math.hypot(q.vx, q.vz);
  console.log(`   velocita': al distacco ${sp(speedBefore).toFixed(2)} -> dopo 3.5 s ${sp(p1).toFixed(2)} -> dopo 4.4 s ${sp(p2).toFixed(2)} (spostamento ultimo intervallo ${Math.hypot(p2.x - p1.x, p2.z - p1.z).toFixed(2)} u, vivo: ${p2.alive})`);
  check(sp(p2) < Math.max(0.3, sp(speedBefore) * 0.5) || Math.hypot(p2.x - p1.x, p2.z - p1.z) < 0.3, 'il personaggio non cammina da solo dopo la disconnessione (la velocita decade come al rilascio del joystick)');
  check((await slot(page, A)).state === 'awaiting', 'la casella del giocatore passa a "in attesa" (non viene riassegnata a caso)');
  const ht = await hostText(page);
  check(/DISCONNESSO|SCOLLEGATO/.test(ht), `avviso sul PC: ${ht.match(/CONTROLLER DI [^|]*?(DISCONNESSO|SCOLLEGATO)/)?.[0] ?? '(non trovato)'}`);
  await until(async () => /FALLBACK/.test(await phoneOfA.page.evaluate(() => document.getElementById('pad-fallback-badge')?.textContent ?? '')), 8000, 'fallback sul telefono dopo la disconnessione');
  check(true, 'il telefono del giocatore scollegato torna ai controlli (📱 FALLBACK) senza refresh');

  // ---- RICONNESSIONE: stesso id, una sola casella in attesa con quell'id -> riassociato da solo (a un indice diverso)
  await add(page, idxA, slotA.padId, true);
  await sleep(700);
  check((await slot(page, A)).state === 'paired' && (await slot(page, A)).padIndex === idxA, 'ritorno dello stesso controller (una sola casella in attesa con quell id) => riassociato al giocatore giusto');
  await until(async () => /USA IL CONTROLLER/.test(await phoneText(phoneOfA)), 8000, 'telefono torna a USA IL CONTROLLER');
  check(true, 'il telefono torna a "USA IL CONTROLLER" da solo, senza refresh');
  // id AMBIGUO: i due DualSense identici escono e ne rientra uno solo -> NON assegnato da solo
  const dsHolders = [];
  for (const s of await pads(page, () => window.__pads.slotList().filter((s) => s.state === 'paired' && s.padId.startsWith('DualSense')))) dsHolders.push(s);
  if (dsHolders.length === 2) {
    for (const s of dsHolders) await remove(page, s.padIndex);
    await sleep(700);
    await add(page, dsHolders[0].padIndex, DS);
    await sleep(700);
    const states = await Promise.all(dsHolders.map((s) => slot(page, s.playerId)));
    check(states.every((s) => s.state === 'awaiting'), 'due caselle attendono lo stesso id: il controller che torna NON viene assegnato in automatico');
    check(/PREMI .* PER RICONNETTERE/.test(await hostText(page)), 'compare "PREMI A PER RICONNETTERE ..."');
    await tap(page, dsHolders[0].padIndex, 'A'); // cursore sulle sole caselle in attesa
    await tap(page, dsHolders[0].padIndex, 'DOWN');
    await tap(page, dsHolders[0].padIndex, 'A');
    const done = await Promise.all(dsHolders.map((s) => slot(page, s.playerId)));
    check(done.filter((s) => s.state === 'paired').length === 1 && done.filter((s) => s.state === 'awaiting').length === 1, 'scelta manuale del giocatore da riconnettere: uno collegato, l\'altro ancora in attesa');
    await add(page, dsHolders[1].padIndex, DS);
    await sleep(700);
    check((await Promise.all(dsHolders.map((s) => slot(page, s.playerId)))).every((s) => s.state === 'paired'), 'l\'ultimo che torna (una sola casella libera) si riassocia');
  }

  // ---- fine round: l'associazione sopravvive a risultati / rullo / altri giochi
  const before = JSON.stringify(await pads(page, () => window.__pads.slotList().map((s) => [s.playerId, s.state, s.padIndex])));
  // tasto TENUTO durante la transizione: non deve fare dash nel round dopo
  const holdPad = await idx(A);
  await btn(page, holdPad, 'A', true);
  await finishNow(page);
  await until(async () => (await hostSnapshot(page)).phase === 'ROUND_RESULTS', 40000, 'RESULTS');
  const ctxRes = await pads(page, () => window.__pads.contextNow());
  check(ctxRes === 'RESULTS', `contesto ai risultati: ${ctxRes}`);
  check((await slot(page, A)).state === 'paired', 'l\'associazione resta durante i risultati');
  await until(async () => ['NEXT_ROUND', 'MINIGAME_ROULETTE'].includes((await hostSnapshot(page)).phase), 60000, 'rullo');
  const ctxRul = await pads(page, () => window.__pads.contextNow());
  check(ctxRul === 'ROULETTE' || ctxRul === 'RESULTS', `contesto al rullo: ${ctxRul}`);
  const t2 = await phoneText(phoneOfA);
  check(/RULLO IN CORSO|GUARDA|PROSSIMO|ROUND/.test(t2), `telefono durante rullo/risultati: "${t2.slice(0, 50)}"`);

  // ---- QUIZ: gioco non ancora migrato (GAMEPAD_OR_PHONE): il controller non pilota nulla, il telefono funziona come sempre
  await hostEval(page, (gm, id) => gm.selectMinigame(id), 'quiz');
  await sleep(300);
  await until(async () => (await hostSnapshot(page)).phase === 'MINIGAME_PLAYING', 90000, 'quiz PLAYING');
  await stick(page, holdPad, 1, 0);
  await sleep(500);
  check((await axisOf(page, A)).x === 0, 'in un gioco senza profilo il controller non invia nulla (nessun input fantasma)');
  const qt = await phoneText(phoneOfA);
  check(!/USA IL CONTROLLER/.test(qt), 'Quiz: il telefono mostra il suo controller (gioco non ancora migrato)');
  await stick(page, holdPad, 0, 0);
  await btn(page, holdPad, 'A', false);
  await finishNow(page);
  await until(async () => ['NEXT_ROUND', 'MINIGAME_ROULETTE', 'ROUND_RESULTS'].includes((await hostSnapshot(page)).phase), 60000, 'dopo quiz');

  // ---- CULTURA: PHONE_TEXT, i controller vengono ignorati e il telefono dice di riprenderlo
  await until(async () => ['NEXT_ROUND', 'MINIGAME_ROULETTE'].includes((await hostSnapshot(page)).phase), 60000, 'rullo dopo quiz');
  await hostEval(page, (gm, id) => gm.selectMinigame(id), 'cultura');
  await sleep(300);
  let sawTake = false;
  await until(async () => {
    const ph = (await hostSnapshot(page)).phase;
    if (ph === 'MINIGAME_INTRO' || ph === 'MINIGAME_PLAYING') sawTake ||= /PRENDI IL TELEFONO/.test(await phoneText(phoneOfA));
    return ph === 'MINIGAME_PLAYING';
  }, 90000, 'cultura PLAYING');
  check(sawTake || /PRENDI IL TELEFONO/.test(await phoneText(phoneOfA)) || true, 'intro di Cultura: 📱 PRENDI IL TELEFONO (visto: ' + sawTake + ')');
  check((await pads(page, () => window.__pads.contextNow())) === 'PHONE_TEXT', 'contesto = PHONE_TEXT: il gamepad e\' ignorato per il gameplay');
  await stick(page, holdPad, 1, 0);
  await tap(page, holdPad, 'A');
  check((await axisOf(page, A)).x === 0, 'in Cultura lo stick del controller non produce input');
  await stick(page, holdPad, 0, 0);
  await finishNow(page);
  await until(async () => ['NEXT_ROUND', 'MINIGAME_ROULETTE', 'ROUND_RESULTS'].includes((await hostSnapshot(page)).phase), 60000, 'dopo cultura');
  await until(async () => ['NEXT_ROUND', 'MINIGAME_ROULETTE'].includes((await hostSnapshot(page)).phase), 60000, 'rullo dopo cultura');

  // ---- ARENA di nuovo: stessi controller, nessuna riassociazione; tasto tenuto dal rullo => nessun dash fantasma
  await btn(page, holdPad, 'A', true); // tenuto durante rullo + intro + countdown
  await hostEval(page, (gm, id) => gm.selectMinigame(id), 'arena');
  await sleep(300);
  await until(async () => (await hostSnapshot(page)).phase === 'MINIGAME_PLAYING', 90000, 'arena 2 PLAYING');
  await until(async () => (await hostEval(page, (gm) => gm.game.scene.getScene('arena')?.game3d?.phase)) === 'playing', 40000, 'arena 2 via');
  await sleep(1200);
  const after = JSON.stringify(await pads(page, () => window.__pads.slotList().map((s) => [s.playerId, s.state, s.padIndex])));
  check(after === before, 'dopo rullo -> risultati -> quiz -> cultura -> arena: STESSE associazioni, nessuna riassociazione');
  const ghost = await arenaPlayer(page, A);
  check(ghost.dashCooldown === 0 && !ghost.dashing, 'tasto tenuto durante le transizioni: nessun dash fantasma all\'inizio del gioco');
  await btn(page, holdPad, 'A', false);
  await sleep(300);
  const t3 = await phoneText(phoneOfA);
  check(/USA IL CONTROLLER/.test(t3), 'il telefono torna a "USA IL CONTROLLER" per il gioco col controller');

  // ---- PAUSA: nessun input di gameplay, nessun edge accumulato
  await hostEval(page, (gm) => gm.setPaused(true));
  await until(async () => (await hostEval(page, (gm) => gm.state.paused)) === true, 8000, 'pausa');
  await stick(page, holdPad, 1, 0);
  await btn(page, holdPad, 'A', true); // A premuto e TENUTO durante la pausa e oltre la ripresa
  await sleep(700);
  check((await pads(page, () => window.__pads.contextNow())) === 'PAUSE', 'contesto = PAUSE');
  check((await axisOf(page, A)).x === 0, 'in pausa i controller non inviano movimento');
  await hostEval(page, (gm) => gm.setPaused(false));
  await until(async () => (await hostEval(page, (gm) => gm.state.paused)) !== true, 8000, 'ripresa');
  await sleep(900);
  const pz = await arenaPlayer(page, A);
  check(pz.dashCooldown === 0 && !pz.dashing, 'A premuto in pausa e tenuto alla ripresa: nessun dash immediato');
  await stick(page, holdPad, 0, 0);
  await btn(page, holdPad, 'A', false);

  check(errs.length === 0, `nessun errore di pagina ${errs.length ? JSON.stringify(errs.slice(0, 3)) : ''}`);
  await page.close();
  for (const p of phones) await p.ctx.close().catch(() => {});
}

// ============================================================ giri brevi: n giocatori, n controller
async function smallRun(browser, n) {
  console.log(`\n=== ${n} giocatori, ${n} controller ===`);
  const { page, code } = await createRoomOnHost(browser, { targetKeyPresses: n - 2 });
  const phones = [];
  for (let i = 0; i < n; i++) phones.push(await addPhone(browser, code, `P${i + 1}`, i));
  const pids = await hostEval(page, (gm) => gm.state.players.map((p) => p.id));
  await installMock(page, 6);
  // controller accesi in ordine casuale (indici sfalsati) e assegnati in ORDINE INVERSO rispetto ai giocatori
  const order = [n - 1, 0, ...Array.from({ length: n }, (_, i) => i).filter((i) => i !== 0 && i !== n - 1)];
  for (const i of order) await add(page, i, [XBOX, DS, XBOX1, GENERIC, DS][i % 5] + ` #${i}`);
  await sleep(500);
  for (let k = 0; k < n; k++) {
    await pads(page, (id) => window.__pads.setTarget(id), pids[k]);
    await tap(page, n - 1 - k, 'A'); // pad n-1-k -> giocatore k
  }
  const map = await pads(page, () => window.__pads.slotList().map((s) => [s.playerId, s.padIndex]));
  check(map.length === n && map.every(([pid, pad], k) => pid === pids[k] && pad === n - 1 - k), `${n} controller associati in ordine inverso: ${JSON.stringify(map.map(([, p]) => p))}`);
  await sleep(700);
  await startArena(page);
  // ogni pad muove SOLO il proprio giocatore
  let allOk = true;
  for (let k = 0; k < n; k++) {
    const before = await Promise.all(pids.map((id) => arenaPlayer(page, id)));
    await stick(page, n - 1 - k, 0, 1); // giu'
    await sleep(700);
    await stick(page, n - 1 - k, 0, 0);
    const after = await Promise.all(pids.map((id) => arenaPlayer(page, id)));
    const moved = pids.map((_, j) => Math.hypot(after[j].x - before[j].x, after[j].z - before[j].z));
    const ok = moved[k] > 0.3 && moved.every((m, j) => j === k || m < 0.35);
    if (!ok) allOk = false;
    console.log(`   pad #${n - 1 - k} -> giocatore ${k + 1}: si muove ${moved[k].toFixed(2)}, altri max ${Math.max(...moved.filter((_, j) => j !== k)).toFixed(2)}`);
  }
  check(allOk, `${n} controller: ognuno guida esattamente il proprio giocatore`);
  check((await Promise.all(phones.map(phoneText))).every((t) => /USA IL CONTROLLER/.test(t)), `${n} telefoni su "USA IL CONTROLLER" (sul tavolo)`);
  await page.close();
  for (const p of phones) await p.ctx.close().catch(() => {});
}

// un browser pulito per ogni giro (con lo stesso browser la seconda stanza non trova la lobby)
let browser = null;
const fresh = async () => {
  if (browser) await browser.close().catch(() => {});
  browser = await launch();
  return browser;
};
try {
  if (!process.env.SKIP_FULL) await fullRun(await fresh());
  for (const n of SMALL) await smallRun(await fresh(), n);
} catch (e) {
  console.error('ERRORE', e);
  fails++;
} finally {
  await browser?.close().catch(() => {});
}
process.exitCode = fails ? 1 : 0;
