// SPARATORIA DEI DISAGIATI — split-screen col controller (Milestone 6 + 6.1). 5 giocatori, phone sempre collegato
// (identita'/reconnect). Quattro round consecutivi con 2, 3, 4 e 5 controller collegati: verifica layout viewport,
// ownership input (nessun bleed tra controller), fire/hit/kill/respawn/punteggio, pausa (movimento/sparo/timer
// fermi), disconnessione (nessun input fantasma), reconnect, fine round, ritorno al flow generale, nessuna
// scena/canvas residua tra un round e l'altro. Chi non ha il controller resta sul telefono ESATTAMENTE come prima
// (nessuna modifica a quel percorso). Nel round 2p verifica anche dash/ricarica: nessuna azione fantasma tenendo
// i tasti durante pausa/disconnessione (stessa classe di bug gia' trovata in Soccer/Kart).
//   node scripts/e2e/gamepad-fps.mjs
import { launch, createRoomOnHost, addPhone, hostEval, hostSnapshot, sleep } from './lib.mjs';
import { XBOX, DS, GENERIC, makeCheck, installMock, add, remove, btn, stick, tap, until, phoneText, pressedOf, sceneEval, watchControls, resetControlsWatch } from './padmock.mjs';

const { st, check } = makeCheck();
const F = (page, fn, arg) => sceneEval(page, 'fps', fn, arg);
// 5 id MOCK DISTINTI apposta (mai due uguali): un controller reale ha sempre un padId diverso da un altro, anche
// stesso modello — riusare lo stesso id su due slot confonde l'associazione-per-identita' (falso positivo di test,
// non un bug del gioco: e' successo qui, vedi cronologia).
const XBOX2 = 'Xbox 360 Controller (STANDARD GAMEPAD Vendor: 045e Product: 028e)';
const PS3 = 'PLAYSTATION(R)3 Controller (STANDARD GAMEPAD Vendor: 054c Product: 0268)';
const FAMILIES = [XBOX, DS, GENERIC, XBOX2, PS3];
// Stessi rettangoli di src/minigames/kart-race/cameraHud.ts (splitScreenLayout): il test verifica che lo split-screen
// FPS li riusi DAVVERO (nessun secondo layout inventato), non li ridefinisce come "verita'" indipendente.
const EXPECT_LAYOUT = {
  2: [{ x: 0, y: 0, w: 0.5, h: 1 }, { x: 0.5, y: 0, w: 0.5, h: 1 }],
  3: [{ x: 0, y: 0.5, w: 0.5, h: 0.5 }, { x: 0.5, y: 0.5, w: 0.5, h: 0.5 }, { x: 0, y: 0, w: 1, h: 0.5 }],
  4: [{ x: 0, y: 0.5, w: 0.5, h: 0.5 }, { x: 0.5, y: 0.5, w: 0.5, h: 0.5 }, { x: 0, y: 0, w: 0.5, h: 0.5 }, { x: 0.5, y: 0, w: 0.5, h: 0.5 }],
  5: [
    { x: 0, y: 0.5, w: 1 / 3, h: 0.5 }, { x: 1 / 3, y: 0.5, w: 1 / 3, h: 0.5 }, { x: 2 / 3, y: 0.5, w: 1 / 3, h: 0.5 },
    { x: 0, y: 0, w: 0.5, h: 0.5 }, { x: 0.5, y: 0, w: 0.5, h: 0.5 }
  ]
};
const near = (a, b) => Math.abs(a - b) < 0.01;

const browser = await launch();
try {
  const { page, code } = await createRoomOnHost(browser, { targetKeyPresses: 3 }); // 5 giocatori
  const errs = [];
  page.on('pageerror', (e) => errs.push('HOST ' + String(e.stack ?? e).replace(/\s+/g, ' ').slice(0, 300)));
  const phones = [];
  for (let i = 0; i < 5; i++) {
    const p = await addPhone(browser, code, `P${i + 1}`, i);
    p.page.on('pageerror', (e) => errs.push(`P${i + 1} ` + String(e).slice(0, 200)));
    phones.push(p);
  }
  const pids = await hostEval(page, (gm) => gm.state.players.map((p) => p.id));
  await installMock(page, 5); // 5 slot mock (default cap=4): servono per i 5 controller di M6.1
  await watchControls(page);

  const canvasCount = () => page.evaluate(() => document.querySelectorAll('canvas').length);
  const phaseNow = async () => (await hostSnapshot(page)).phase;
  const snap = (id) => F(page, (g, a) => { const p = g.players.find((q) => q.id === a); return p ? { x: p.x, z: p.z, yaw: p.yaw, hp: p.hp, alive: p.alive, kills: p.kills, deaths: p.deaths, magazine: p.magazine, firing: p.firing } : null; }, id);
  const camInfo = () => F(page, (g) => (g.splitScreen ? g.splitScreen.cams.map((c) => ({ playerId: c.playerId, vp: { x: c.camera.viewport.x, y: c.camera.viewport.y, w: c.camera.viewport.width, h: c.camera.viewport.height } })) : null));

  const canvasBaseline = await canvasCount(); // Phaser + eventuali overlay gia' presenti PRIMA di FPS

  // L'associazione "prima volta" di un controller MAI visto prima e' un'operazione da LOBBY (come in tutta la
  // sessione M1-M5: si associa una volta sola all'inizio, poi persiste). Per provare 2/3/4/5 split-screen in
  // sequenza SENZA uscire da questo presupposto, si associano tutti e 5 i controller UNA VOLTA in lobby, poi tra
  // un round e l'altro si usa SOLO disconnessione/riconnessione della stessa identita' (gia' provata altrove) per
  // attivare/disattivare i controller in eccesso — mai una nuova associazione a meta' sessione.
  async function pairAllOnce() {
    for (let k = 0; k < 5; k++) await add(page, k, FAMILIES[k]);
    await sleep(500);
    for (let k = 0; k < 5; k++) {
      await page.evaluate((id) => window.__pads.setTarget(id), pids[k]);
      await tap(page, k, 'A');
    }
    await page.evaluate(() => window.__pads.setTarget(null));
  }
  async function setActivePads(n) {
    for (let k = 0; k < 5; k++) {
      const paired = (await page.evaluate((id) => window.__pads.slotOf(id)?.state, pids[k])) === 'paired';
      if (k < n && !paired) {
        await add(page, k, FAMILIES[k]); // riconnette la STESSA identita' (mai una nuova associazione)
        await sleep(350); // riconnettere piu' pad uno subito dopo l'altro, senza respiro, e' un caso mai provato altrove
      } else if (k >= n && paired) {
        await remove(page, k);
        await sleep(200);
      }
    }
    await sleep(400);
  }

  await pairAllOnce();
  check((await page.evaluate(() => window.__pads.pairedCount())) === 5, 'lobby: tutti e 5 i controller associati una sola volta');
  await setActivePads(0); // parte con nessun controller connesso: ogni round riconnette solo quelli che gli servono

  // Sessione da 4 round: se lo stesso giocatore vincesse SEMPRE (placement fisso per indice), con la tabella a 5
  // giocatori (10/7/5/3/1) e un eventuale "punti doppi" casuale sul rullo basta poco per raggiungere il target e
  // chiudere la partita in anticipo (GAME_FINISHED invece del rullo atteso) — esattamente il bug gia' trovato e
  // corretto nella sessione M5. Si ruota chi arriva 1°/2°/... ad ogni round.
  let roundIdx = 0;
  async function finishRound() {
    const order = [0, 1, 2, 3, 4].map((i) => (i + roundIdx) % 5);
    roundIdx++;
    await hostEval(page, (gm, ord) => {
      const ctx = gm.minigameContext;
      const ps = ctx.players;
      const results = ord.filter((i) => i < ps.length).map((playerIdx, placementIdx) => ({ playerId: ps[playerIdx].id, placement: placementIdx + 1, score: 5 - placementIdx }));
      ctx.finish({ results });
    }, order);
  }

  async function round(n) {
    console.log(`\n--- SPLIT-SCREEN ${n} GIOCATORI ---`);
    await setActivePads(n);
    const pc = await page.evaluate(() => window.__pads.pairedCount());
    if (pc !== n) console.log('   [diag] slotList', await page.evaluate(() => JSON.stringify(window.__pads.slotList())));
    check(pc === n, `${n} controller riconnessi (${pc})`);
    await resetControlsWatch(page);
    await hostEval(page, (gm, id) => gm.selectMinigame(id), 'fps');
    if ((await phaseNow()) === 'LOBBY') {
      await sleep(300);
      await page.keyboard.press('Enter');
    }
    await until(async () => (await phaseNow()) === 'MINIGAME_PLAYING', 60000, `fps PLAYING (${n})`);

    await until(async () => (await camInfo())?.length === n, 30000, `${n} camere split-screen pronte`);
    // La schermata CONTROLLI (~2.7s) e il boot dello split-screen sono DUE tempi indipendenti: il modulo Babylon
    // e' caching dal round precedente e puo' essere pronto MOLTO prima che i CONTROLLI finiscano — bisogna
    // aspettare anche la fine dei CONTROLLI, altrimenti l'input resta bloccato (a ragione) e i test lo scambiano
    // per un bug di ownership.
    await until(async () => await page.evaluate(() => window.__cc.shownAt !== null), 15000, `CONTROLLI (${n})`);
    await until(async () => await page.evaluate(() => window.__cc.hiddenAt !== null), 8000, `fine CONTROLLI (${n})`);
    await sleep(200);
    const cams = await camInfo();
    check(cams.length === n, `split-screen: ${n} camere attive (una per controller)`);
    const want = EXPECT_LAYOUT[n];
    const layoutOk = cams.every((c, i) => near(c.vp.x, want[i].x) && near(c.vp.y, want[i].y) && near(c.vp.w, want[i].w) && near(c.vp.h, want[i].h));
    check(layoutOk, `layout viewport ${n}p = splitScreenLayout(${n}) di kart-race (riusato, non reinventato): ${JSON.stringify(cams.map((c) => c.vp))}`);
    check(cams.every((c, i) => c.playerId === pids[i]), 'ogni camera appartiene al giocatore giusto, in ordine stabile');

    if (n >= 5) {
      // con tutti e 5 collegati non resta nessuno sul telefono: skip check fallback (verificato nei round precedenti)
    } else {
      const fb = await phones[n].page.evaluate(() => !!document.getElementById('pad-fallback-badge'));
      check(fb, `P${n + 1} (senza controller): badge fallback, gioca ancora dal telefono`);
    }

    // ---- OWNERSHIP: pad0 muove SOLO P1, nessun bleed sugli altri
    const before = await Promise.all(pids.slice(0, n).map((id) => snap(id)));
    await stick(page, 0, 1, 0); // pad0 (P1): stick tutto a destra
    await sleep(500);
    const after0 = await Promise.all(pids.slice(0, n).map((id) => snap(id)));
    await stick(page, 0, 0, 0);
    const p1Moved = Math.hypot(after0[0].x - before[0].x, after0[0].z - before[0].z) > 0.3;
    const othersStill = after0.slice(1).every((p, i) => Math.hypot(p.x - before[i + 1].x, p.z - before[i + 1].z) < 0.05);
    check(p1Moved && othersStill, `controller 1 muove SOLO P1 (bleed nessuno): P1 ${p1Moved}, altri fermi ${othersStill}`);

    if (n >= 2) {
      await sleep(200);
      const beforeP2 = await Promise.all(pids.slice(0, n).map((id) => snap(id)));
      await stick(page, 1, 0, -1); // pad1 (P2): stick avanti
      await sleep(500);
      const afterP2 = await Promise.all(pids.slice(0, n).map((id) => snap(id)));
      await stick(page, 1, 0, 0);
      const p2Moved = Math.hypot(afterP2[1].x - beforeP2[1].x, afterP2[1].z - beforeP2[1].z) > 0.3;
      const p1Still = Math.hypot(afterP2[0].x - beforeP2[0].x, afterP2[0].z - beforeP2[0].z) < 0.05;
      check(p2Moved && p1Still, `controller 2 muove SOLO P2 (P1 resta fermo mentre P2 si muove)`);
    }

    // ---- MIRA (right stick, pad0): yaw di P1 cambia, yaw degli altri no
    // Margine ampio apposta (650ms, non 400): a ~2.6 rad/s a fondo corsa un secondo intero di stallo della pagina
    // (macchina sotto carico) lascerebbe comunque un margine di sicurezza prima della soglia di 0.05 rad.
    const yawBefore = (await snap(pids[0])).yaw;
    await stick2(page, 0, 1, 0);
    await sleep(650);
    const yawAfter = (await snap(pids[0])).yaw;
    await stick2(page, 0, 0, 0);
    check(Math.abs(yawAfter - yawBefore) > 0.05, `right stick (pad0) ruota la mira di P1 (${yawBefore.toFixed(2)} -> ${yawAfter.toFixed(2)})`);

    // ---- FIRE ownership + hit attribution + no self-hit + kill + score +1 + no double kill
    // Mette P2 davanti a P1 (stessa yaw=0, P2 a 3m) e spara con pad0: il colpo deve arrivare SOLO a P2.
    // (-5,-20)/(-5,-17): angolo libero della mappa, lontano da qualsiasi ostacolo di FPS_MAP — spawnare esattamente
    // al centro di un ostacolo farebbe scattare resolveCollisions al frame successivo e teletrasporterebbe i giocatori.
    await F(page, (g, a) => {
      const p1 = g.players.find((p) => p.id === a.p1);
      const p2 = g.players.find((p) => p.id === a.p2);
      p1.x = -5; p1.z = -20; p1.yaw = 0; p1.pitch = 0; p1.hp = 100; p1.kills = 0;
      p2.x = -5; p2.z = -17; p2.hp = 100; p2.alive = true; p2.deaths = 0; p2.spawnProtection = 0;
      p1.weaponId = 'mitraglia'; p1.magazine = 30; p1.reloading = false; p1.fireCooldown = 0;
    }, { p1: pids[0], p2: pids[1] });
    const p1Before = await snap(pids[0]);
    await btn(page, 0, 'RT', true);
    await sleep(500);
    await btn(page, 0, 'RT', false);
    const p1After = await snap(pids[0]);
    const p2After = await snap(pids[1]);
    check(p1After.magazine < p1Before.magazine, 'RT (pad0) spara: il caricatore di P1 si consuma');
    check(p1After.hp === 100, 'chi spara non colpisce se stesso (HP di P1 invariato)');
    check(p2After.hp < 100, `il colpo arriva a P2 (HP ${p2After.hp})`);
    if (n >= 3) {
      const p3 = await snap(pids[2]);
      check(p3.hp === 100, 'P3 (non sulla linea di tiro) non subisce danno: attribuzione del colpo corretta');
    }

    // Finisce P2 per verificare kill/score/respawn (danno diretto: la meccanica di danno e' gia' provata da fps-combat.mjs).
    const p1KillsBefore = (await snap(pids[0])).kills;
    await F(page, (g, a) => {
      const p1 = g.players.find((p) => p.id === a.p1);
      const p2 = g.players.find((p) => p.id === a.p2);
      g.applyDamage(p2, 1000, p1);
    }, { p1: pids[0], p2: pids[1] });
    await sleep(150);
    const p1AfterKill = await snap(pids[0]);
    const p2Dead = await snap(pids[1]);
    check(p1AfterKill.kills === p1KillsBefore + 1, `kill assegnata al killer giusto: punteggio +1 (${p1KillsBefore} -> ${p1AfterKill.kills})`);
    check(p2Dead.alive === false && p2Dead.deaths === 1, 'la vittima muore, una sola morte contata (nessuna doppia morte)');
    // HUD: il kill count aggiornato deve comparire nell'HUD di P1 (mappato per playerId, mai per indice viewport) e
    // NON in quello del vicino (P2) — "niente HUD del player sbagliato".
    // l'HUD si aggiorna al PROSSIMO frame disegnato: in headless un frame a piu' finestre puo' durare piu' di 150 ms
    const readHuds = () => F(page, (g, a) => {
      const h1 = g.splitScreen?.hud?.get(a.p1);
      const h2 = g.splitScreen?.hud?.get(a.p2);
      return { p1Kill: h1?.killText.text ?? null, p2Kill: h2?.killText.text ?? null };
    }, { p1: pids[0], p2: pids[1] });
    let huds = await readHuds();
    for (let t = 0; t < 30 && huds.p1Kill !== `${p1AfterKill.kills} kill`; t++) {
      await sleep(100);
      huds = await readHuds();
    }
    check(huds.p1Kill === `${p1AfterKill.kills} kill`, `HUD di P1 mostra il SUO kill count (${huds.p1Kill})`);
    check(huds.p2Kill !== huds.p1Kill, `HUD di P2 non mostra il kill count di P1 (P2: ${huds.p2Kill})`);
    // colpisce ANCORA il cadavere: nessuna seconda kill (applyDamage ritorna false su bersaglio non vivo)
    const secondHit = await F(page, (g, a) => {
      const p1 = g.players.find((p) => p.id === a.p1);
      const p2 = g.players.find((p) => p.id === a.p2);
      return g.applyDamage(p2, 50, p1);
    }, { p1: pids[0], p2: pids[1] });
    check(secondHit === false, 'nessun doppio evento morte: un colpo su un bersaglio gia\' morto non fa nulla');
    await until(async () => (await snap(pids[1])).alive === true, 8000, 'respawn P2');
    const p2Respawned = await snap(pids[1]);
    check(p2Respawned.hp === 100 && p2Respawned.alive === true, `respawn: HP ripristinati (${p2Respawned.hp}), di nuovo in gioco`);

    // ---- PAUSA: movimento/sparo/timer fermi, nessun input accumulato
    // La baseline si legge DOPO la conferma di pausa (non prima di premere ESC): tra la pressione e l'istante
    // in cui la pausa scatta davvero passano dei fotogrammi REALI di simulazione (round-trip async del test), che
    // farebbero sembrare "il timer avanza" per un confronto fatto con un valore letto troppo presto — non e' un
    // bug del gioco, e' un dettaglio di misurazione del test.
    await page.keyboard.press('Escape');
    await until(async () => (await hostEval(page, (gm) => gm.state.paused)) === true, 8000, 'pausa');
    const timeBefore = await F(page, (g) => g.matchTime);
    const posBefore = await snap(pids[0]);
    const dashBefore = await F(page, (g, a) => g.players.find((p) => p.id === a).dashCooldown, pids[0]);
    await stick(page, 0, 1, 0);
    await btn(page, 0, 'RT', true);
    if (n === 2) {
      // Dash (A/✕) e ricarica (X/□) tenuti attraverso la pausa: stessa classe di bug gia' trovata in Soccer/Kart
      // (azione fantasma al rilascio/ripristino) — verificati una volta sola (round 2p), il meccanismo non cambia
      // con il numero di giocatori.
      await btn(page, 0, 'A', true);
      await btn(page, 0, 'X', true);
    }
    await sleep(600);
    const timeDuring = await F(page, (g) => g.matchTime);
    const posDuring = await snap(pids[0]);
    check(timeDuring === timeBefore, `in pausa il timer del round NON avanza (${timeBefore.toFixed(2)} -> ${timeDuring.toFixed(2)})`);
    check(Math.hypot(posDuring.x - posBefore.x, posDuring.z - posBefore.z) < 0.02, 'in pausa il movimento resta fermo (stick tenuto)');
    check(posDuring.magazine === posBefore.magazine, 'in pausa lo sparo non viene processato (RT tenuto, caricatore invariato)');
    if (n === 2) {
      const midPause = await F(page, (g, a) => { const p = g.players.find((q) => q.id === a); return { dashCooldown: p.dashCooldown, reloading: p.reloading }; }, pids[0]);
      check(midPause.dashCooldown === dashBefore, `in pausa nessuno scatto fantasma (A/✕ tenuto, dashCooldown invariato ${midPause.dashCooldown})`);
      check(midPause.reloading === false, 'in pausa nessuna ricarica fantasma (X/□ tenuto, reloading resta false)');
    }
    await stick(page, 0, 0, 0);
    await btn(page, 0, 'RT', false);
    if (n === 2) {
      await btn(page, 0, 'A', false);
      await btn(page, 0, 'X', false);
    }
    await page.keyboard.press('Escape');
    await until(async () => (await hostEval(page, (gm) => gm.state.paused)) !== true, 8000, 'ripresa');
    await sleep(400);
    const posAfterResume = await snap(pids[0]);
    check(Math.hypot(posAfterResume.x - posBefore.x, posAfterResume.z - posBefore.z) < 0.05, 'alla ripresa nessun input accumulato (nessuno scatto fantasma)');
    if (n === 2) {
      const afterResume = await F(page, (g, a) => { const p = g.players.find((q) => q.id === a); return { dashCooldown: p.dashCooldown, reloading: p.reloading }; }, pids[0]);
      check(afterResume.dashCooldown === dashBefore && afterResume.reloading === false, `alla ripresa nessuno scatto/ricarica fantasma da A/✕/X tenuti (dashCooldown ${afterResume.dashCooldown}, reloading ${afterResume.reloading})`);
      // Rilascio + pressione VERA dopo la ripresa: A/✕ e X/□ devono tornare a funzionare normalmente (non restare bloccati).
      await tap(page, 0, 'A', 150);
      await sleep(150);
      const afterRealDash = await F(page, (g, a) => g.players.find((p) => p.id === a).dashCooldown, pids[0]);
      check(afterRealDash > 0, `dopo il rilascio, una pressione VERA di A/✕ funziona normalmente (dashCooldown ${afterRealDash.toFixed(2)})`);
    }

    // ---- DISCONNESSIONE: il player non si muove/spara da solo; RECONNECT: torna a rispondere
    // NON si tiene A/✕/X prima di scollegare: farlo col pad ANCORA connesso sarebbe una pressione VERA (scatto/
    // ricarica legittimi, non "fantasma") e falserebbe il test — stesso motivo per cui il test di Botta al Volo
    // (M5) isola la disconnessione senza pressioni precedenti. Qui si verifica SOLO che l'evento di disconnessione
    // in se', da solo, non faccia scattare nulla.
    await remove(page, 0);
    await sleep(700);
    check((await pressedOf(page, pids[0], 'fire')) === false, 'disconnessione: nessun input residuo (fire)');
    if (n === 2) {
      check((await pressedOf(page, pids[0], 'dash')) === false, 'disconnessione: nessun input residuo (dash)');
      check((await pressedOf(page, pids[0], 'reload')) === false, 'disconnessione: nessun input residuo (reload)');
    }
    const posAtDisc = await snap(pids[0]);
    const dashAtDisc = await F(page, (g, a) => g.players.find((p) => p.id === a).dashCooldown, pids[0]);
    await sleep(500);
    const posAfterDisc = await snap(pids[0]);
    check(Math.hypot(posAfterDisc.x - posAtDisc.x, posAfterDisc.z - posAtDisc.z) < 0.02, 'controller scollegato: il player NON si muove da solo');
    if (n === 2) {
      // Il tempo di gioco NON e' fermo qui (solo la pausa globale lo ferma): dashCooldown scende naturalmente col
      // tempo reale. Un ghost-dash si riconosce da un RIALZO (torna verso i 4s pieni), non da un valore diverso:
      // <= = nessuno scatto fantasma, > = uno scatto e' scattato da solo.
      const afterDisc = await F(page, (g, a) => { const p = g.players.find((q) => q.id === a); return { dashCooldown: p.dashCooldown, reloading: p.reloading }; }, pids[0]);
      check(afterDisc.dashCooldown <= dashAtDisc && afterDisc.reloading === false, `disconnessione: nessuno scatto/ricarica fantasma (dashCooldown ${dashAtDisc.toFixed(2)} -> ${afterDisc.dashCooldown.toFixed(2)}, mai in salita; reloading ${afterDisc.reloading})`);
    }
    await add(page, 0, FAMILIES[0]);
    await sleep(700);
    check((await page.evaluate((id) => window.__pads.slotOf(id).state, pids[0])) === 'paired', 'reconnect: pairing recuperato');
    if (n === 2) {
      await sleep(300);
      const afterReconnect = await F(page, (g, a) => { const p = g.players.find((q) => q.id === a); return { dashCooldown: p.dashCooldown, reloading: p.reloading }; }, pids[0]);
      check(afterReconnect.dashCooldown <= dashAtDisc && afterReconnect.reloading === false, `reconnect: ancora nessuno scatto/ricarica fantasma appena ripristinato il pairing (dashCooldown ${dashAtDisc.toFixed(2)} -> ${afterReconnect.dashCooldown.toFixed(2)}, mai in salita; reloading ${afterReconnect.reloading})`);
    }
    await stick(page, 0, 0, -1);
    await sleep(500);
    const posAfterReconnect = await snap(pids[0]);
    await stick(page, 0, 0, 0);
    check(Math.hypot(posAfterReconnect.x - posAtDisc.x, posAfterReconnect.z - posAtDisc.z) > 0.2, 'reconnect: il controller torna a muovere il player giusto');

    // ---- fine round -> torna al flow generale (risultati -> rullo), nessun input FPS accettato dopo
    await finishRound();
    await until(async () => (await phaseNow()) === 'ROUND_RESULTS', 30000, 'risultati');
    // Dopo l'ultimo round la partita PUO' finire per punteggio raggiunto (esito valido, non un blocco): GAME_FINISHED
    // e' accettato SOLO qui, non nei round intermedi (dove ci si aspetta sempre di tornare al rullo).
    await until(async () => (n >= 5 ? ['NEXT_ROUND', 'MINIGAME_ROULETTE', 'GAME_FINISHED'] : ['NEXT_ROUND', 'MINIGAME_ROULETTE']).includes(await phaseNow()), 60000, 'rullo');
    check(true, `round ${n}p: ritorno al flow generale (risultati -> rullo, o fine partita se era l'ultimo round) ok`);

    // ---- nessuna scena/canvas residua: il canvas split-screen deve essere stato rimosso
    await sleep(300);
    const cc = await canvasCount();
    check(cc === canvasBaseline, `nessun canvas residuo dopo il round (${cc} attesi ${canvasBaseline})`);
  }

  // right stick (secondo asse dei gamepad mock): helper locale, padmock.stick muove SOLO il primo (LEFT_STICK)
  async function stick2(page, i, x, y) {
    await page.evaluate((a, b, c) => { if (window.__mp.pads[a]) window.__mp.pads[a].axes[2] = b, window.__mp.pads[a].axes[3] = c; }, i, x, y);
  }

  await round(2);
  await round(3);
  await round(4);
  await round(5);

  check(errs.length === 0, `nessun errore di pagina ${errs.length ? JSON.stringify(errs.slice(0, 3)) : ''}`);
} catch (e) {
  console.error('ERRORE', e);
  st.fails++;
} finally {
  await browser.close();
}
process.exitCode = st.fails ? 1 : 0;
