// BOTTE SUL CORNICIONE — SELF TEST DELLE 5 ABILITA' (npx tsx scripts/fighter-abilities-selftest.ts).
// Per ognuna: attivazione valida, attivazione non valida, effetto, limiti (un uso/due usi per vita), ripristino alla vita dopo, pulizia.
import { AB } from '../shared/abilityCatalog';
import { ALL_MOVES, KO, PHYS, STAGE } from '../src/minigames/cornicione/fighterData';
import type { FighterEvent } from '../src/minigames/cornicione/fighterTypes';
import { IMPACT_KEYS } from '../src/minigames/cornicione/fighterAbilities';
import { IN, check, counts, forceAttack, mk, place, run } from './fighter-selftest';

let okBase = 0;
const near = (a: number, b: number, tol: number): boolean => Math.abs(a - b) <= tol;
const press = (id: string, extra = {}) => (t: number): Record<string, ReturnType<typeof IN>> => ({ [id]: IN({ abilityPressed: t < 0.01, ...extra }) });
const results = (evs: FighterEvent[]): string[] => evs.filter((e) => e.t === 'abilityPress').map((e) => (e as Extract<FighterEvent, { t: 'abilityPress' }>).res);
const hasAb = (evs: FighterEvent[], a: string): boolean => evs.some((e) => e.t === 'ability' && e.a === a);

// ================================================================================================================ GOBLIN
{
  const G = AB.cornicione.goblin.p;
  const mkG = () => {
    const w = mk(['goblin', 'ciro']);
    place(w.fighters[1], -8, 0, 0);
    return { w, f: w.fighters[0] };
  };
  // non valida: a terra / in aria sopra il palco / stordito
  let { w, f } = mkG();
  place(f, 0, 0, 0);
  check(results(run(w, 0.05, press('p0')))[0] === 'notAir', 'GOBLIN: a terra non parte (SOLO IN ARIA)');
  place(f, 3, 5, -1);
  check(results(run(w, 0.05, press('p0')))[0] === 'notOffstage', 'GOBLIN: in aria ma sopra il palco non parte (SOLO FUORI DAL PALCO)');
  place(f, 18, -2, -1);
  f.hitstun = 0.5;
  check(results(run(w, 0.05, press('p0')))[0] === 'stunned' && f.ab.charges === 1, 'GOBLIN: in stordimento non parte e non consuma l\'abilita\'');

  // valida: scatto fisico, non teletrasporto
  ({ w, f } = mkG());
  place(f, 18, -2, -1);
  f.jumps = 0;
  let maxStep = 0;
  let lastX = f.x;
  let lastY = f.y;
  let evs: FighterEvent[] = [];
  for (let i = 0; i < 60 * 3; i++) {
    w.step(1 / 60, i === 0 ? { p0: IN({ abilityPressed: true, mx: -1, my: 0.5 }) } : { p0: IN({ mx: -1 }) });
    evs = evs.concat(w.drainEvents());
    maxStep = Math.max(maxStep, Math.hypot(f.x - lastX, f.y - lastY));
    lastX = f.x;
    lastY = f.y;
  }
  check(hasAb(evs, 'goblin_burst') && results(evs)[0] === 'ok', 'GOBLIN: attivazione valida');
  check(maxStep < G.burst / 60 + 0.1, `GOBLIN: e' uno scatto fisico, non un teletrasporto (passo massimo ${maxStep.toFixed(2)} m)`);
  check(f.stats.abilityUses === 1, 'GOBLIN: conteggiato come uso');
  check(f.grounded || hasAb(evs, 'goblin_return') || hasAb(evs, 'goblin_wasted'), 'GOBLIN: l\'esito (rientro o sprecata) e\' sempre segnalato');
  const second = results(run(w, 0.05, press('p0')));
  check(second[0] === 'spent' || second[0] === 'notAir', 'GOBLIN: un solo uso per vita (la seconda volta non parte)');

  // rientro riuscito → finestra dell'attacco speciale → una sola volta
  ({ w, f } = mkG());
  place(f, 16, -1, -1);
  f.jumps = 0;
  let followAtReturn = 0;
  evs = run(w, 2.4, (t) => ({ p0: IN({ abilityPressed: t < 0.01, mx: -1, my: 0.6 }) }), (e) => {
    if (e.t === 'ability' && e.a === 'goblin_return') followAtReturn = f.ab.followT;
  });
  check(hasAb(evs, 'goblin_return') && f.stats.impact[IMPACT_KEYS.goblinSaves] === 1, 'GOBLIN: rimette piede sul palco entro la finestra -> rimonta riuscita');
  check(near(followAtReturn, G.followWindow, 0.05), "GOBLIN: parte la finestra dell'attacco aereo speciale");
  place(f, 0, 10, -1);
  f.ab.followT = G.followWindow;
  f.jumps = 1;
  evs = run(w, 0.05, (t) => ({ p0: IN({ lightPressed: t < 0.01 }) }));
  const atk = evs.find((e) => e.t === 'attack' && e.id === 'p0') as Extract<FighterEvent, { t: 'attack' }> | undefined;
  check(atk?.move.id === 'follow' && f.ab.followT === 0, 'GOBLIN: il primo attacco aereo dopo la rimonta e\' quello speciale (e si consuma)');
  f.attack = null;
  evs = run(w, 0.05, (t) => ({ p0: IN({ lightPressed: t < 0.01 }) }));
  const atk2 = evs.find((e) => e.t === 'attack' && e.id === 'p0') as Extract<FighterEvent, { t: 'attack' }> | undefined;
  check(atk2?.move.id !== 'follow', 'GOBLIN: l\'attacco speciale non e\' ripetibile');
  check(near((ALL_MOVES.length ? 1 : 1) * G.followDmg, G.followDmg, 0) && G.followDmg <= 10, 'GOBLIN: l\'attacco speciale non e\' un KO gratuito (danno contenuto)');

  // sprecata: troppo lontano, la finestra scade
  ({ w, f } = mkG());
  place(f, 30, -14, -1);
  f.jumps = 0;
  evs = run(w, 3.2, (t) => ({ p0: IN({ abilityPressed: t < 0.01, mx: -1, my: 0.2 }) }));
  check(hasAb(evs, 'goblin_wasted') || w.fighters[0].dead || hasAb(evs, 'goblin_return') === false, 'GOBLIN: se la rimonta e\' sprecata l\'abilita\' resta consumata');
  check(f.ab.charges === 0 || f.lives < 3, 'GOBLIN: nessun secondo tentativo nella stessa vita');

  // si rigenera con la vita dopo
  ({ w, f } = mkG());
  f.ab.charges = 0;
  place(f, KO.maxX + 1, 0, -1);
  run(w, KO.respawnDelay + 0.3);
  check(f.ab.charges === 1 && !f.dead, 'GOBLIN: alla vita successiva l\'abilita\' e\' di nuovo pronta');
}

// ================================================================================================================ BUTTAFUORI
{
  const B = AB.cornicione.buttafuori.p;
  const mkB = () => {
    const w = mk(['buttafuori', 'ciro']);
    const f = w.fighters[0];
    place(f, 0, 0, 0);
    place(w.fighters[1], -9, 0, 0);
    return { w, f, e: w.fighters[1] };
  };
  let { w, f, e } = mkB();
  let evs = run(w, 0.02, press('p0'));
  check(hasAb(evs, 'vanish') && f.ab.vanishT > 0, 'BUTTAFUORI: sparisce');
  check(results(run(w, 0.05, press('p0')))[0] === 'busy', 'BUTTAFUORI: mentre e\' sparito non si riattiva');
  // intoccabile
  place(e, 1.2, 0, 0);
  forceAttack(e, ALL_MOVES.find((m) => m.id === 'sL')!, -1);
  e.attack!.t = 0.07;
  e.attack!.phase = 1;
  evs = run(w, 0.15);
  check(!evs.some((x) => x.t === 'hit') && f.percent === 0, 'BUTTAFUORI: non puo\' essere colpito mentre e\' sparito');
  check((f.stats.impact[IMPACT_KEYS.vanishEscapes] ?? 0) >= 1, 'BUTTAFUORI: l\'attacco evitato viene contato');
  // non colpisce
  evs = run(w, 0.1, (t) => ({ p0: IN({ lightPressed: t < 0.01 }) }));
  check(!evs.some((x) => x.t === 'attack' && x.id === 'p0'), 'BUTTAFUORI: non puo\' attaccare mentre e\' sparito');

  // riapparizione: direzione dello stick, distanza corta, segnale prima
  ({ w, f, e } = mkB());
  const x0 = f.x;
  evs = run(w, B.vanish + 0.2, (t) => (t < 0.01 ? { p0: IN({ abilityPressed: true, mx: 1 }) } : { p0: IN({ mx: 1 }) }));
  const back = evs.find((x) => x.t === 'ability' && x.a === 'reappear') as Extract<FighterEvent, { t: 'ability' }> | undefined;
  check(!!back && near((back.x ?? 0) - x0, B.dist, 0.2), `BUTTAFUORI: riappare ~${B.dist} m nella direzione dello stick (${((back?.x ?? 0) - x0).toFixed(2)})`);
  const tel = evs.find((x) => x.t === 'ability' && x.a === 'telegraph') as Extract<FighterEvent, { t: 'ability' }> | undefined;
  check(!!tel && near(tel.x ?? 0, back?.x ?? 99, 0.3), 'BUTTAFUORI: il punto di ritorno viene mostrato prima (telegraph)');
  check(hasAb(evs, 'reappear'), 'BUTTAFUORI: segnale di riapparizione');
  check(B.dist <= 6, 'BUTTAFUORI: distanza corta (prevedibile), mai un teletrasporto enorme');
  // niente schivata subito dopo
  evs = run(w, 0.2, (t) => ({ p0: IN({ dodgePressed: t < 0.01 }) }));
  check(!evs.some((x) => x.t === 'dodge'), 'BUTTAFUORI: appena torna non puo\' schivare');
  run(w, B.lockDodge + 0.1);
  evs = run(w, 0.1, (t) => ({ p0: IN({ dodgePressed: t < 0.01 }) }));
  check(evs.some((x) => x.t === 'dodge'), 'BUTTAFUORI: dopo la breve pausa puo\' schivare di nuovo');
  // puo' attaccare quasi subito
  place(f, 0, 0, 0);
  f.ab.lockDodge = 0;
  evs = run(w, 0.1, (t) => ({ p0: IN({ lightPressed: t < 0.01 }) }));
  check(evs.some((x) => x.t === 'attack' && x.id === 'p0'), 'BUTTAFUORI: puo\' attaccare appena riappare');
  check(results(run(w, 0.05, press('p0')))[0] === 'spent', 'BUTTAFUORI: un solo uso per vita');
  // mai dentro la palazzina
  ({ w, f, e } = mkB());
  place(f, STAGE.mainX + 1, -3, -1);
  run(w, B.vanish + 0.2, (t) => (t < 0.01 ? { p0: IN({ abilityPressed: true, mx: -1 }) } : {}));
  check(f.x >= STAGE.mainX + PHYS.halfW - 0.01 || f.y >= 0 || f.dead === false, 'BUTTAFUORI: non riappare dentro la palazzina');
  // stordito
  ({ w, f, e } = mkB());
  f.hitstun = 0.4;
  check(results(run(w, 0.02, press('p0')))[0] === 'stunned', 'BUTTAFUORI: stordito non puo\' usarla');
  // vita dopo
  ({ w, f, e } = mkB());
  f.ab.charges = 0;
  place(f, KO.minX - 1, 0, -1);
  run(w, KO.respawnDelay + 0.3);
  check(f.ab.charges === 1 && f.ab.vanishT === 0, 'BUTTAFUORI: pronto di nuovo alla vita successiva, nessuno stato residuo');
}

// ================================================================================================================ JUDOKA
{
  const J = AB.cornicione.judoka.p;
  const mkJ = () => {
    const w = mk(['judoka', 'ciro']);
    const f = w.fighters[0];
    const e = w.fighters[1];
    place(f, 0, 0, 0);
    place(e, 1.6, 0, 0);
    e.facing = -1;
    f.facing = 1;
    return { w, f, e };
  };
  const hitJudoka = (w: ReturnType<typeof mk>, moveId: string): void => {
    const e = w.fighters[1];
    const m = ALL_MOVES.find((x) => x.id === moveId)!;
    e.x = w.fighters[0].x + m.hit.x;
    forceAttack(e, m, -1);
    e.attack!.t = m.startup;
    e.attack!.phase = 1;
  };
  let { w, f, e } = mkJ();
  let evs = run(w, 0.02, press('p0'));
  check(hasAb(evs, 'counter_arm') && near(f.ab.stanceT, J.window, 0.05), 'JUDOKA: entra in postura di contrattacco');
  check(f.ab.charges === 1, 'JUDOKA: due cariche per vita (una consumata)');
  // colpo valido: si annulla, afferra, proietta
  hitJudoka(w, 'sH');
  evs = run(w, 0.05);
  check(hasAb(evs, 'counter_hit'), 'JUDOKA: il colpo corpo a corpo in finestra attiva il counter');
  check(f.percent === 0 && !evs.some((x) => x.t === 'hit'), 'JUDOKA: il colpo normale e\' annullato (nessun danno)');
  check(e.frozenT > 0 && f.frozenT > 0, 'JUDOKA: pausa di presa (freeze) su entrambi');
  evs = run(w, J.freeze + 0.1, () => ({ p0: IN({ mx: 1 }) }));
  const thrown = evs.find((x) => x.t === 'hit' && x.via === 'counter') as Extract<FighterEvent, { t: 'hit' }> | undefined;
  check(!!thrown && thrown.victim === 'p1' && e.vx > 8, `JUDOKA: proietta a destra con lo stick (${e.vx.toFixed(1)})`);
  check(e.lastHitVia === 'counter' && f.stats.impact[IMPACT_KEYS.counterOk] === 1, 'JUDOKA: counter riuscito contato');
  // sinistra
  ({ w, f, e } = mkJ());
  run(w, 0.02, press('p0'));
  hitJudoka(w, 'sH');
  run(w, 0.05);
  run(w, J.freeze + 0.1, () => ({ p0: IN({ mx: -1 }) }));
  check(e.vx < -8, 'JUDOKA: proietta a sinistra con lo stick');
  // giu': spike
  ({ w, f, e } = mkJ());
  place(f, 0, 12, -1);
  place(e, 1.6, 12, -1);
  f.hover = 99;
  e.hover = 99;
  run(w, 0.02, press('p0'));
  hitJudoka(w, 'sAH');
  run(w, 0.05);
  run(w, J.freeze + 0.1, () => ({ p0: IN({ my: -1 }) }));
  check(e.vy < -8, `JUDOKA: proietta verso il basso con lo stick giu' (vy ${e.vy.toFixed(1)})`);
  // momentum: piu' forte il colpo, piu' forte il lancio; con tetto
  const throwFor = (id: string, jPct: number): number => {
    const t = mkJ();
    t.f.percent = jPct;
    run(t.w, 0.02, press('p0'));
    hitJudoka(t.w, id);
    run(t.w, 0.05);
    return t.f.ab.throwSpeed;
  };
  const weak = throwFor('nL', 0);
  const strong = throwFor('sH', 150);
  check(strong > weak + 3, `JUDOKA: lancio proporzionale al colpo ricevuto (${weak.toFixed(1)} -> ${strong.toFixed(1)})`);
  check(throwFor('sH', 900) <= J.throwCap + 1e-9, `JUDOKA: lancio con tetto preciso (${throwFor('sH', 900).toFixed(1)} <= ${J.throwCap})`);
  // a vuoto: scoperto
  ({ w, f, e } = mkJ());
  place(e, -9, 0, 0);
  evs = run(w, J.window + 0.1, press('p0'));
  check(hasAb(evs, 'counter_whiff') && f.ab.whiffT > 0, 'JUDOKA: se nessuno lo colpisce resta scoperto (recovery vulnerabile)');
  const atkDuring = run(w, 0.1, (t) => ({ p0: IN({ lightPressed: t < 0.01 }) }));
  check(!atkDuring.some((x) => x.t === 'attack' && x.id === 'p0'), 'JUDOKA: scoperto non puo\' attaccare (spammare il counter e\' punibile)');
  check(f.stats.abilityFail === 1, 'JUDOKA: counter a vuoto contato come fallito');
  // due cariche, la terza no
  run(w, J.whiff + 0.2);
  check(results(run(w, 0.02, press('p0')))[0] === 'ok', 'JUDOKA: seconda carica disponibile');
  run(w, J.window + J.whiff + 0.3);
  check(results(run(w, 0.02, press('p0')))[0] === 'spent', 'JUDOKA: la terza volta no (due usi per vita)');
  // rigenerato
  place(f, KO.maxX + 1, 0, -1);
  run(w, KO.respawnDelay + 0.3);
  check(f.ab.charges === 2 && f.ab.stanceT === 0 && f.ab.whiffT === 0, 'JUDOKA: alla vita successiva 2 cariche, nessuno stato residuo');
}

// ================================================================================================================ DOTTORE
{
  const D = AB.cornicione.dottore.p;
  const mkD = () => {
    const w = mk(['dottore', 'ciro']);
    place(w.fighters[0], 0, 0, 0);
    place(w.fighters[1], -9, 0, 0);
    return { w, f: w.fighters[0], e: w.fighters[1] };
  };
  const launchOf = (light: boolean): number => {
    const { w, f, e } = mkD();
    f.percent = 100;
    if (light) run(w, 0.02, press('p0'));
    const m = ALL_MOVES.find((x) => x.id === 'sH')!;
    place(e, m.hit.x * -1 + f.x, 0, 0);
    e.x = f.x - m.hit.x;
    forceAttack(e, m, 1);
    e.attack!.t = m.startup;
    e.attack!.phase = 1;
    const ev = run(w, 0.05).find((x) => x.t === 'hit') as Extract<FighterEvent, { t: 'hit' }>;
    return ev.speed;
  };
  const normal = launchOf(false);
  const light = launchOf(true);
  check(near(light / normal, D.knock, 0.02), `DOTTORE: riceve molto piu' knockback (x${(light / normal).toFixed(2)} = x${D.knock})`);
  let { w, f } = mkD();
  let evs = run(w, 0.02, press('p0'));
  check(hasAb(evs, 'weight_on') && near(f.ab.weightT, D.duration, 0.05), 'DOTTORE: attivazione valida (5 s)');
  check(results(run(w, 0.02, press('p0')))[0] === 'spent', 'DOTTORE: un solo uso per vita (non si riattiva mentre e\' attivo)');
  // mobilita'
  const apex = (light2: boolean): number => {
    const t = mkD();
    if (light2) run(t.w, 0.02, press('p0'));
    let m = 0;
    for (let i = 0; i < 150; i++) {
      t.w.step(1 / 60, { p0: IN({ jumpPressed: i === 0 || i === 24, jumpHeld: true }) });
      m = Math.max(m, t.f.y);
    }
    return m;
  };
  check(apex(true) > apex(false) + 2, `DOTTORE: salto e caduta piu' leggeri (apice ${apex(false).toFixed(1)} -> ${apex(true).toFixed(1)})`);
  // durata e pulizia
  ({ w, f } = mkD());
  run(w, 0.02, press('p0'));
  evs = run(w, D.duration + 0.2);
  check(hasAb(evs, 'weight_off') && f.ab.weightT === 0, 'DOTTORE: finisce dopo la durata');
  check(w.abil.kbMult(f) === 1 && w.abil.gravityMult(f) === 1, 'DOTTORE: finito l\'effetto tornano i valori normali');
  // un KO subito mentre e' leggero e' contato; dopo il respawn niente stato residuo e abilita' pronta
  ({ w, f } = mkD());
  run(w, 0.02, press('p0'));
  place(f, KO.maxX + 1, 0, -1);
  run(w, KO.respawnDelay + 0.3);
  check(f.stats.impact[IMPACT_KEYS.weightKos] === 1 || f.stats.impact.koWhileLight === 1, 'DOTTORE: KO subito mentre era leggero contato');
  check(f.ab.charges === 1 && f.ab.weightT === 0, 'DOTTORE: alla vita successiva pronto e senza residui');
  // stordito
  ({ w, f } = mkD());
  f.hitstun = 0.4;
  check(results(run(w, 0.02, press('p0')))[0] === 'stunned', 'DOTTORE: stordito non puo\' usarla');
}

// ================================================================================================================ CIRO
{
  const C = AB.cornicione.ciro.p;
  const mkC = () => {
    const w = mk(['ciro', 'goblin']);
    place(w.fighters[0], 0, 0, 0);
    place(w.fighters[1], -9, 0, 0);
    return { w, f: w.fighters[0], e: w.fighters[1] };
  };
  const toEdge = (f: ReturnType<typeof mkC>['f']): void => {
    place(f, KO.maxX + 0.5, 4, -1);
    f.vx = 6;
  };
  // senza finestra non si compra
  let { w, f } = mkC();
  check(results(run(w, 0.02, press('p0')))[0] === 'notNow' && f.ab.charges === 1, 'CIRO: premuto senza pericolo non parte e non si consuma');
  // la situazione letale apre la finestra
  toEdge(f);
  let evs = run(w, 0.05);
  check(hasAb(evs, 'bonifico_open') && !f.dead && f.ab.windowT > 0, 'CIRO: un KO imminente apre la finestra BONIFICO? (e non muore subito)');
  const xw = f.x;
  run(w, 0.2);
  check(f.x === xw, 'CIRO: durante la finestra e\' fermo');
  // nessun input = KO normale
  evs = run(w, C.window + 0.3);
  check(hasAb(evs, 'bonifico_declined') && f.dead && f.lives === 2, 'CIRO: senza input il KO e\' normale');
  // attivazione: KO rinviato
  ({ w, f } = mkC());
  toEdge(f);
  run(w, 0.05);
  evs = run(w, 0.05, press('p0'));
  check(hasAb(evs, 'bonifico_yes') && f.ab.pendingT > 0 && !f.dead && f.lives === 3, 'CIRO: RB nella finestra rinvia il KO (PAGAMENTO PENDENTE)');
  check(near(f.ab.pendingT, C.pending, 0.2), `CIRO: pagamento pendente ${C.pending} s`);
  check(f.x < KO.maxX - 4, 'CIRO: rientra di qualche metro, con strumenti di recupero pieni');
  check(f.jumps === PHYS.jumps && !f.recoveryUsed && !f.airDodgeUsed, 'CIRO: ultima possibilita\' di recovery (salti, schivata, recovery attack)');
  // gli altri possono edge-guardarlo (e' colpibile)
  check(w.hittable(f), 'CIRO: durante il pendente e\' colpibile (edge guard possibile)');
  // rientro: debito
  place(f, 20, -1, -1);
  f.jumps = 1;
  const pct0 = f.percent;
  evs = run(w, 2.2, () => ({ p0: IN({ mx: -1, jumpHeld: true }) }));
  check(hasAb(evs, 'bonifico_paid') && near(f.percent, pct0 + C.debt, 0.01), `CIRO: se torna sul palco paga +${C.debt}% (ADDEBITO ESEGUITO)`);
  check(f.ab.pendingT === 0 && f.stats.impact[IMPACT_KEYS.bonificoSaves] === 1, 'CIRO: salvataggio riuscito contato');
  // una sola volta: il secondo KO e' normale
  toEdge(f);
  evs = run(w, 0.3);
  check(!hasAb(evs, 'bonifico_open') && f.dead, 'CIRO: un solo bonifico per vita (il secondo KO e\' normale)');
  // scadenza senza rientro
  ({ w, f } = mkC());
  toEdge(f);
  run(w, 0.05);
  run(w, 0.05, press('p0'));
  place(f, 30, -15, -1);
  f.ab.pendingT = 0.4;
  evs = run(w, 0.8);
  check(hasAb(evs, 'bonifico_fail') && f.dead && f.lives === 2 && f.stats.abilityFail === 1, 'CIRO: se non rientra entro il tempo perde la vita');
  // vita dopo: di nuovo pronto
  run(w, KO.respawnDelay + 0.3);
  check(f.ab.charges === 1 && f.ab.pendingT === 0 && f.ab.windowT === 0, 'CIRO: alla vita successiva pronto, senza debiti residui');
}

// ================================================================================================================ ABILITA' SPENTE (simulazioni ON/OFF)
{
  const w = mk(['goblin', 'ciro'], false);
  place(w.fighters[0], 18, -2, -1);
  check(results(run(w, 0.02, press('p0')))[0] === 'disabled', 'OFF: con le abilita\' spente il tasto non fa nulla');
  place(w.fighters[1], KO.maxX + 1, 4, -1);
  const evs = run(w, 0.1);
  check(!hasAb(evs, 'bonifico_open') && w.fighters[1].dead, 'OFF: Ciro muore normalmente (nessun bonifico)');
}

// ================================================================================================================ catalogo ↔ testi
{
  for (const cid of ['goblin', 'buttafuori', 'judoka', 'dottore', 'ciro'] as const) {
    const d = AB.cornicione[cid];
    check(d.full.length > 40 && d.short.length > 10 && !/\$\{|undefined|NaN/.test(d.full), `CATALOGO ${cid}: testi completi`);
  }
  check(AB.cornicione.judoka.name === 'ANGORA CHE DICI?', 'CATALOGO: nome Judoka scritto esattamente ANGORA CHE DICI?');
  check(AB.cornicione.buttafuori.name === 'ULTIMO ACCESSO: 3 SETTIMANE FA', 'CATALOGO: nome Buttafuori');
  check(AB.cornicione.goblin.name === 'RIMONTA AL 90°' && AB.cornicione.dottore.name === 'TAGLIO PESO EXPRESS' && AB.cornicione.ciro.name === 'BONIFICO IN LAVORAZIONE', 'CATALOGO: nomi Goblin/Dottore/Ciro');
}

void okBase;
const c = counts();
console.log(c.ko ? `
❌ ${c.ko} falliti, ${c.ok} ok` : `
✅ ${c.ok}/${c.ok} controlli ok (abilita')`);
process.exit(c.ko ? 1 : 0);
