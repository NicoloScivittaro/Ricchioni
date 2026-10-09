// CASA CARBO — SELF TEST del simulatore (npx tsx scripts/casacarbo-selftest.ts): conservazione dell'acqua, sorgenti solo alle
// porte, muri, direzione del tiracqua, secchio e tre scarichi, contenimento, scivolate/urti, eventi, punteggio e classifica,
// le 5 abilita' (valida / non valida / limiti / effetto / pulizia), 5 giocatori con input separati.
import { CasaCarboWorld } from '../src/minigames/casaCarbo/waterCore';
import { CC } from '../src/minigames/casaCarbo/ccTuning';
import { CC_NO_INPUT } from '../src/minigames/casaCarbo/ccTypes';
import type { CCEvent, CCInput, CCPlayer } from '../src/minigames/casaCarbo/ccTypes';
import { COLS, DOORS, DRAINS, TV_POINT, cellAtPx, cellCenterPx } from '../src/minigames/casaCarbo/mapData';
import { contribution, titles } from '../src/minigames/casaCarbo/scoring';
import { AB } from '../shared/abilityCatalog';

let ok = 0;
let ko = 0;
const check = (c: unknown, msg: string): void => {
  if (c) ok++;
  else {
    ko++;
    console.log('❌ ' + msg);
  }
};
const near = (a: number, b: number, t: number): boolean => Math.abs(a - b) <= t;
const IN = (o: Partial<CCInput> = {}): CCInput => ({ ...CC_NO_INPUT, ...o });

function mk(chars: string[], o: { rain?: boolean; events?: boolean; abilities?: boolean } = {}): CasaCarboWorld {
  let s = 4242;
  const rng = (): number => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  return new CasaCarboWorld({ ids: chars.map((_, i) => 'p' + i), characters: chars, rng, rain: o.rain ?? false, events: o.events ?? false, abilities: o.abilities });
}
function run(w: CasaCarboWorld, sec: number, fn: (t: number) => Record<string, CCInput> = () => ({}), onEv?: (e: CCEvent) => void): CCEvent[] {
  const all: CCEvent[] = [];
  const n = Math.round(sec * 60);
  for (let i = 0; i < n; i++) {
    w.step(1 / 60, fn(i / 60));
    for (const e of w.drainEvents()) {
      all.push(e);
      onEv?.(e);
    }
  }
  return all;
}
const total = (w: CasaCarboWorld): number => w.waterOnFloor() + w.waterInBuckets() + w.drainedCredited + w.drainedPassive + w.spilledOutside;
const place = (p: CCPlayer, x: number, y: number): void => {
  p.x = x;
  p.y = y;
  p.vx = 0;
  p.vy = 0;
};
const pour = (w: CasaCarboWorld, x0: number, y0: number, x1: number, y1: number, amount: number): void => {
  const cells: number[] = [];
  for (let y = y0; y < y1; y += 20) for (let x = x0; x < x1; x += 20) {
    const k = cellAtPx(x, y);
    if (k >= 0 && w.grid.floor[k] && !cells.includes(k)) cells.push(k);
  }
  for (const k of cells) w.h[k] += amount / cells.length;
};
const centroidX = (w: CasaCarboWorld): number => {
  let s = 0;
  let m = 0;
  for (let k = 0; k < w.h.length; k++) if (w.h[k] > 0) {
    s += cellCenterPx(k).x * w.h[k];
    m += w.h[k];
  }
  return s / Math.max(1e-9, m);
};

// ---------------------------------------------------------------- 1. sorgenti: la pioggia entra SOLO dalle due porte
{
  const w = mk(['goblin', 'ciro'], { rain: true });
  run(w, 1.0);
  const doorCells = new Set([...w.grid.doorCells.front, ...w.grid.doorCells.back]);
  let far = 0;
  for (let k = 0; k < w.h.length; k++) {
    if (w.h[k] <= 0) continue;
    const c = cellCenterPx(k);
    const dmin = Math.min(...DOORS.map((d) => Math.hypot(c.x - d.cx, c.y - d.cy)));
    if (dmin > 140) far++;
  }
  check(far === 0, `pioggia: dopo 1 s l'acqua e' solo vicino alle porte (${far} celle lontane)`);
  check(w.inflowTotal > 0 && near(w.waterOnFloor() + w.drainedPassive, w.inflowTotal, 1e-3), 'pioggia: tutta l\'acqua che c\'e\' e\' entrata dalle porte');
  check(doorCells.size === 7, `porte: 3 celle davanti + 4 dietro (${doorCells.size})`);
  // partita intera senza nessuno, con TUTTI gli eventi: nessuna acqua "creata" dentro casa
  const w2 = mk(['goblin', 'ciro', 'judoka'], { rain: true, events: true });
  const evs = run(w2, CC.duration + 0.5);
  check(w2.over, 'partita: finisce allo scadere dei 120 s');
  check(near(total(w2), w2.inflowTotal, 1e-2), `conservazione con eventi: entrata ${w2.inflowTotal.toFixed(2)} = per terra+tolta ${total(w2).toFixed(2)}`);
  check(evs.some((e) => e.t === 'eventStart' && e.kind === 'pioggia') && evs.filter((e) => e.t === 'eventStart' && e.kind === 'raffica').length === 2, 'eventi: una pioggia intensificata e due raffiche');
  check(evs.filter((e) => e.t === 'announce').every((e) => e.t === 'announce' && (e.kind === 'raffica' || e.kind === 'pioggia')), 'eventi: le raffiche sono annunciate prima');
  check(w2.dryFraction() < CC.saveThreshold, `se nessuno pulisce la casa si allaga (${(w2.dryFraction() * 100).toFixed(0)}% asciutta)`);
}

// ---------------------------------------------------------------- 2. conservazione con giocatori che spingono, raccolgono, rovesciano
{
  const w = mk(['goblin', 'ciro', 'judoka']);
  pour(w, 400, 560, 700, 690, 30);
  pour(w, 820, 200, 930, 380, 15);
  const t0 = total(w);
  let i = 0;
  run(w, 20, () => {
    i++;
    const a = Math.sin(i * 0.05);
    return {
      p0: IN({ mx: a, my: Math.cos(i * 0.03), squeegeeHeld: true }),
      p1: IN({ mx: -a, my: 0.3, bucketHeld: true, dashPressed: i % 120 === 0 }),
      p2: IN({ mx: Math.cos(i * 0.02), my: -a, bucketHeld: i % 200 < 150, bucketPressed: i % 200 === 160 })
    };
  });
  check(near(total(w), t0, 1e-3), `conservazione: l'acqua si sposta ma non nasce ne' sparisce (${t0.toFixed(3)} -> ${total(w).toFixed(3)})`);
  check(Array.from(w.h).every((v) => v >= 0 && Number.isFinite(v)), 'nessuna cella con acqua negativa o non finita');
}

// ---------------------------------------------------------------- 3. muri: l'acqua passa solo dai varchi
{
  const w = mk(['goblin']);
  pour(w, 95, 410, 250, 505, 24); // doccia
  const doorCells: number[] = [];
  for (let y = 450; y < 482; y += 10) {
    const k = cellAtPx(262, y);
    if (k >= 0 && w.grid.floor[k]) doorCells.push(k);
    const k2 = cellAtPx(275, y);
    if (k2 >= 0 && w.grid.floor[k2]) doorCells.push(k2);
  }
  w.blockCells([...new Set(doorCells)]);
  run(w, 8);
  let outside = 0;
  for (let k = 0; k < w.h.length; k++) if (w.h[k] > 0 && cellCenterPx(k).x > 290) outside += w.h[k];
  check(outside < 1e-6, `muri: con la porta della doccia chiusa l'acqua resta nella doccia (${outside.toFixed(4)} fuori)`);
  w.unblockCells([...new Set(doorCells)]);
  run(w, 8);
  let after = 0;
  for (let k = 0; k < w.h.length; k++) if (w.h[k] > 0 && cellCenterPx(k).x > 290) after += w.h[k];
  check(after > 0.5, 'muri: con la porta aperta l\'acqua passa');
}

// ---------------------------------------------------------------- 4. tiracqua: sposta l'acqua nella direzione giusta, senza punti
{
  const w = mk(['goblin']);
  pour(w, 420, 600, 560, 690, 20);
  const p = w.players[0];
  place(p, 400, 640);
  const c0 = centroidX(w);
  const t0 = w.waterOnFloor();
  run(w, 1.4, () => ({ p0: IN({ mx: 1, squeegeeHeld: true }) }));
  check(centroidX(w) > c0 + 40, `tiracqua: l'acqua va avanti con chi spinge (baricentro ${c0.toFixed(0)} -> ${centroidX(w).toFixed(0)} px)`);
  check(near(w.waterOnFloor(), t0, 1e-3), 'tiracqua: spostare l\'acqua non la toglie');
  check(contribution(p.stats) === 0, 'spostare acqua fra stanze non da\' punti');
  // tiracqua nello scarico del bagno: tolta e punti
  const w2 = mk(['goblin']);
  pour(w2, 480, 450, 560, 480, 6);
  const q = w2.players[0];
  place(q, 460, 465);
  run(w2, 1.3, () => ({ p0: IN({ mx: 1, squeegeeHeld: true }) }));
  check(q.stats.drainedSqueegee > 2, `tiracqua nello scarico del bagno: acqua tolta e contata (${q.stats.drainedSqueegee.toFixed(2)})`);
  check(near(contribution(q.stats), q.stats.drainedSqueegee, 1e-9), 'punti = acqua che lascia davvero la casa');
  // due giocatori insieme: nessun rallentamento
  const w3 = mk(['goblin', 'ciro']);
  place(w3.players[0], 400, 610);
  place(w3.players[1], 400, 670);
  run(w3, 0.8, () => ({ p0: IN({ mx: 1, squeegeeHeld: true }), p1: IN({ mx: 1, squeegeeHeld: true }) }));
  check(near(w3.players[0].x, w3.players[1].x, 2), 'due tiracqua affiancati vanno alla stessa velocita\'');
}

// ---------------------------------------------------------------- 5. secchio e i tre scarichi
{
  for (const d of DRAINS) {
    const w = mk(['ciro']);
    const p = w.players[0];
    pour(w, 560, 595, 700, 640, 14);
    place(p, 570, 615);
    run(w, 3, (t) => ({ p0: IN({ bucketHeld: true, mx: t < 1.5 ? 0.35 : -0.35 }) }));
    check(p.bucket >= CC.bucketCap - 1e-6, `secchio: si riempie fino alla capienza (${p.bucket.toFixed(2)})`);
    const slowFull = (() => {
      const v0 = mk(['ciro']);
      place(v0.players[0], 600, 610);
      v0.players[0].bucket = CC.bucketCap;
      run(v0, 1, () => ({ p0: IN({ mx: 1 }) }));
      return v0.players[0].x - 600;
    })();
    const fastEmpty = (() => {
      const v0 = mk(['ciro']);
      place(v0.players[0], 600, 610);
      run(v0, 1, () => ({ p0: IN({ mx: 1 }) }));
      return v0.players[0].x - 600;
    })();
    if (d.id === 'bagno') check(slowFull < fastEmpty * 0.8, `secchio pieno: si cammina piu' piano (${slowFull.toFixed(0)} vs ${fastEmpty.toFixed(0)} px in 1 s)`);
    place(p, d.cx, d.cy + (d.id === 'lavello' ? 0 : 20));
    const amount = p.bucket;
    const evs = run(w, 0.1, (t) => ({ p0: IN({ bucketPressed: t < 0.01, bucketHeld: true }) }));
    check(p.bucket === 0 && near(p.stats.drainedBucket, amount, 1e-6), `${d.label}: svuotare il secchio toglie l'acqua (+${amount.toFixed(1)} punti)`);
    check(evs.some((e) => e.t === 'drain' && e.drain === d.id && e.via === 'bucket'), `${d.label}: evento di scarico`);
  }
  // il lavello e il tombino NON accettano l'acqua spinta col tiracqua
  check(!DRAINS.find((d) => d.id === 'lavello')!.squeegee && !DRAINS.find((d) => d.id === 'tombino')!.squeegee, 'lavello e tombino: solo secchi');
  // scarico intasato: non si svuota finche' qualcuno non lo libera (+4)
  const w = mk(['ciro']);
  const p = w.players[0];
  w.clogged.add('lavello');
  p.bucket = 4;
  place(p, 215, 575);
  const ev = run(w, 0.1, (t) => ({ p0: IN({ bucketPressed: t < 0.01 }) }));
  check(p.bucket === 4 && ev.some((e) => e.t === 'drainFull'), 'scarico intasato: il secchio non si svuota (avviso)');
  run(w, CC.unclogTime + 0.2, () => ({ p0: IN({ interactHeld: true }) }));
  check(!w.clogged.has('lavello') && p.stats.unclogged === 1 && contribution(p.stats) === CC.points.unclog, 'scarico liberato tenendo "interagisci": +4');
}

// ---------------------------------------------------------------- 6. scatto, scivolate, urti: il secchio si rovescia
{
  const w = mk(['ciro']);
  const p = w.players[0];
  place(p, 600, 620);
  p.bucket = 5;
  const floor0 = w.waterOnFloor();
  run(w, 0.05, (t) => ({ p0: IN({ dashPressed: t < 0.01, mx: 1 }) }));
  check(near(p.bucket, 5 * (1 - CC.dashSpill), 1e-6) && near(w.waterOnFloor(), floor0 + 5 * CC.dashSpill, 1e-6), 'scatto col secchio pieno: ne rovesci una parte per terra');
  check(p.stats.spilled > 0 && contribution(p.stats) === 0, 'acqua rovesciata: zero punti');
  // scivolata in una pozza profonda correndo
  const w2 = mk(['goblin']);
  pour(w2, 540, 600, 860, 700, 160);
  const q = w2.players[0];
  place(q, 560, 684);
  let slipped = false;
  run(w2, 6, (t) => ({ p0: IN({ mx: Math.sin(t * 2) > 0 ? 1 : -1 }) }), (e) => {
    if (e.t === 'slip') slipped = true;
  });
  check(slipped && q.stats.slips > 0, 'correre nell\'acqua alta: si scivola');
  // urto fra due giocatori di corsa
  const w3 = mk(['ciro', 'goblin']);
  place(w3.players[0], 500, 640);
  place(w3.players[1], 600, 640);
  w3.players[0].bucket = 4;
  const ev3 = run(w3, 0.6, () => ({ p0: IN({ mx: 1, dashPressed: true }), p1: IN({ mx: -1, dashPressed: true }) }));
  check(ev3.some((e) => e.t === 'spill' && (e.why === 'bump' || e.why === 'dash')), 'urto/scatto fra due giocatori: il secchio perde acqua');
  check(Math.hypot(w3.players[0].x - w3.players[1].x, w3.players[0].y - w3.players[1].y) >= CC.radius * 2 - 1, 'i personaggi non si compenetrano');
}

// ---------------------------------------------------------------- 7. contenimento alla porta
{
  const base = mk(['goblin'], { rain: true });
  run(base, 10);
  const w = mk(['goblin'], { rain: true });
  const p = w.players[0];
  const d = DOORS[0];
  place(p, d.cx, d.cy + 30);
  run(w, 10, () => ({ p0: IN({ interactHeld: true }) }));
  const ratio = (w.inflowTotal - base.inflowTotal * 0.5) / base.inflowTotal;
  check(p.containing === 'front' || p.stats.stopped > 0, 'porta: tenendo "interagisci" la si contiene');
  check(w.inflowTotal < base.inflowTotal * 0.8 && w.inflowTotal > base.inflowTotal * 0.4, `contenimento: entra meno acqua ma non zero (${w.inflowTotal.toFixed(1)} vs ${base.inflowTotal.toFixed(1)})`);
  check(p.stats.stopped > 0 && contribution(p.stats) > 0, `contenimento: acqua fermata contata (${p.stats.stopped.toFixed(1)} u -> ${contribution(p.stats).toFixed(1)} punti)`);
  p.stats.stopped = 1000;
  check(contribution(p.stats) === CC.stopCap, `contenimento: punti con tetto (${CC.stopCap})`);
  void ratio;
  // chi contiene non pulisce
  const w2 = mk(['goblin'], { rain: true });
  place(w2.players[0], d.cx, d.cy + 30);
  run(w2, 1, () => ({ p0: IN({ interactHeld: true, squeegeeHeld: false }) }));
  check(!w2.players[0].squeegee && !w2.players[0].scooping, 'chi contiene la porta non pulisce');
}

// ---------------------------------------------------------------- 8. eventi
{
  // pioggia intensificata = piu' acqua da entrambe le porte; raffica solo dalla sua porta
  const w = mk(['goblin'], { rain: true });
  w.time = 40;
  const r0 = w.nominalRain('front');
  w.schedule = [{ kind: 'pioggia', at: 40.5, announced: false, started: false, ended: false }, { kind: 'raffica', at: 40.5, door: 'back', announced: false, started: false, ended: false }];
  run(w, 0.6);
  check(w.nominalRain('front') > r0 * 1.5 && w.nominalRain('back') > w.nominalRain('front'), 'eventi: pioggia piu\' forte su tutte e due le porte, la raffica solo sulla sua');
  // tappeto: ostacolo temporaneo per acqua e persone
  const w2 = mk(['goblin']);
  w2.schedule = [{ kind: 'tappeto', at: 0.1, rug: 0, announced: false, started: false, ended: false }];
  run(w2, 0.2);
  check(!!w2.rug && w2.rug.cells.every((k) => w2.blocked[k] === 1), 'tappeto spostato: blocca l\'acqua');
  const p = w2.players[0];
  place(p, 865, 420);
  run(w2, 1, () => ({ p0: IN({ my: -1 }) }));
  check(p.y < 440 + 1, 'tappeto spostato: blocca il passaggio');
  run(w2, CC.rugTime + 0.2, () => ({ p0: IN({ interactHeld: true }) }));
  check(!w2.rug, 'tappeto: si rimette a posto tenendo "interagisci"');
  // TV
  const w3 = mk(['judoka'], { rain: false });
  w3.time = 40;
  for (const k of w3.grid.tvCells) w3.h[k] = 0.9;
  const evs = run(w3, 0.2);
  check(w3.tv === 'danger' && evs.some((e) => e.t === 'tv' && e.state === 'danger'), 'LA TV, PORCO DUE!: l\'acqua vicino alla TV fa scattare l\'obiettivo');
  place(w3.players[0], TV_POINT.cx - 40, TV_POINT.cy);
  run(w3, CC.tvTime + 0.2, () => ({ p0: IN({ interactHeld: true }) }));
  check(w3.tv === 'saved' && w3.players[0].stats.tvSaved === 1 && contribution(w3.players[0].stats) === CC.points.tv, 'TV messa in salvo: +6');
  const w4 = mk(['judoka']);
  w4.time = 40;
  for (const k of w4.grid.tvCells) w4.h[k] = 0.9;
  run(w4, 0.2);
  for (const k of w4.grid.tvCells) w4.h[k] = 0;
  run(w4, CC.events.tv.ruinAfter + 0.5);
  check(w4.tv === 'ruined', 'TV: se nessuno la salva in tempo si rovina');
}

// ---------------------------------------------------------------- 9. punteggio, classifica, titoli, % asciutta
{
  const w = mk(['goblin', 'ciro', 'judoka', 'dottore']);
  check(w.dryFraction() === 1, 'all\'inizio la casa e\' asciutta al 100%');
  const [a, b, c, d] = w.players;
  a.stats.drainedBucket = 10;
  b.stats.drainedSqueegee = 10;
  c.stats.stopped = 12;
  d.stats.spilled = 5;
  a.tieBreak = 0.9;
  b.tieBreak = 0.1;
  const r = w.ranking().map((p) => p.id);
  check(r[0] === 'p1' && r[1] === 'p0', `classifica: pari contributo -> spareggio deterministico (${r})`);
  check(r.length === 4 && new Set(r).size === 4, 'classifica: sempre tutti i giocatori');
  b.stats.drainedSqueegee = 9;
  b.stats.stopped = 2;
  check(w.ranking()[0].id === 'p0', 'classifica: a pari contributo vince chi ha tolto piu\' acqua');
  const t = titles(w.players.map((p) => ({ id: p.id, stats: p.stats })));
  check(t.get('p2') === 'IL BAGNINO' && t.get('p3') === 'DANNO COLLATERALE', `titoli: bagnino e danno collaterale (${[...t].join(' | ')})`);
  check([...t.values()].includes("L'UNICO CHE HA LAVORATO"), 'titoli: c\'e\' "L\'UNICO CHE HA LAVORATO"');
  for (let k = 0; k < w.grid.interiorCells.length * 0.3; k++) w.h[w.grid.interiorCells[k]] = 0.5;
  check(w.dryFraction() < CC.saveThreshold, 'con il 30% di pavimento bagnato la casa NON e\' salva');
}

// ---------------------------------------------------------------- 10. cinque giocatori: input separati
{
  const w = mk(['goblin', 'buttafuori', 'dottore', 'judoka', 'ciro']);
  const x0 = w.players.map((p) => p.x);
  run(w, 0.5, () => ({ p2: IN({ mx: 1 }) }));
  w.players.forEach((p, i) => check(i === 2 ? p.x > x0[i] + 30 : near(p.x, x0[i], 0.5), `5p: p${i} ${i === 2 ? 'si muove' : 'resta fermo'}`));
}

// ================================================================ ABILITA'
const results = (e: CCEvent[]): string[] => e.filter((x) => x.t === 'abilityPress').map((x) => (x as Extract<CCEvent, { t: 'abilityPress' }>).res);
const has = (e: CCEvent[], a: string): boolean => e.some((x) => x.t === 'ability' && x.a === a);
const press = (t: number, extra: Partial<CCInput> = {}): Record<string, CCInput> => ({ p0: IN({ abilityPressed: t < 0.01, ...extra }) });

// GOBLIN
{
  const G = AB.casacarbo.goblin;
  const w = mk(['goblin', 'ciro']);
  const p = w.players[0];
  pour(w, 450, 590, 650, 690, 25);
  place(p, 420, 640);
  place(w.players[1], 520, 640);
  p.fx = 1;
  p.fy = 0;
  const c0 = centroidX(w);
  const t0 = w.waterOnFloor();
  let e = run(w, 0.05, (t) => press(t, { mx: 1 }));
  check(results(e)[0] === 'ok' && p.ab.windupT > 0, 'GOBLIN: carica la spazzata');
  e = run(w, G.p.windup + 0.1);
  check(has(e, 'goblin_wave') && centroidX(w) > c0 + 40, `GOBLIN: l'onda sposta l'acqua avanti (${c0.toFixed(0)} -> ${centroidX(w).toFixed(0)})`);
  check(near(w.waterOnFloor(), t0, 1e-3), 'GOBLIN: l\'onda sposta, non toglie (fuori dallo scarico)');
  check(w.players[1].x > 540, 'GOBLIN: chi sta davanti viene spinto via');
  check(results(run(w, 0.05, (t) => press(t)))[0] === 'cooldown', 'GOBLIN: in ricarica non riparte');
  run(w, G.cooldown + 0.2);
  check(results(run(w, 0.05, (t) => press(t)))[0] === 'ok', 'GOBLIN: seconda carica');
  run(w, G.p.windup + G.cooldown + 0.3);
  check(results(run(w, 0.05, (t) => press(t)))[0] === 'spent', 'GOBLIN: due usi a partita');
  // nello scarico del bagno: acqua tolta e contata
  const w2 = mk(['goblin']);
  pour(w2, 400, 440, 560, 500, 10);
  const q = w2.players[0];
  place(q, 380, 465);
  q.fx = 1;
  q.fy = 0;
  run(w2, 0.05, (t) => press(t, { mx: 1 }));
  run(w2, G.p.windup + 0.1);
  check(q.stats.drainedAbility > 5, `GOBLIN: l'onda dentro lo scarico del bagno toglie l'acqua (+${q.stats.drainedAbility.toFixed(1)})`);
}

// BOSCHI
{
  const B = AB.casacarbo.buttafuori;
  const w = mk(['buttafuori'], { rain: true });
  const p = w.players[0];
  check(results(run(w, 0.05, (t) => press(t)))[0] === 'notNear', 'BOSCHI: lontano dalle porte non parte');
  check(p.ab.charges === 1, 'BOSCHI: tentativo a vuoto non consuma l\'abilita\'');
  const d = DOORS[1];
  place(p, d.cx, d.cy - 40);
  const before = w.inflowTotal;
  const e = run(w, 0.05, (t) => press(t));
  check(results(e)[0] === 'ok' && p.ab.blockT > 0 && p.ab.blockDoor === 'back', 'BOSCHI: blocca la porta vicina');
  const xb = p.x;
  run(w, 2, () => ({ p0: IN({ mx: 1, squeegeeHeld: true }) }));
  check(near(p.x, xb, 0.5) && !p.squeegee, 'BOSCHI: mentre blocca non si muove ne\' pulisce');
  const base = mk(['goblin'], { rain: true });
  run(base, 2.05 + B.p.duration - 2.05);
  run(w, B.p.duration - 2);
  const enteredDuring = w.inflowTotal - before;
  check(p.ab.blockT === 0, 'BOSCHI: il blocco finisce dopo la durata');
  check(w.backlog.back > 0 || enteredDuring > 0, 'BOSCHI: parte dell\'acqua resta fuori in attesa');
  const evs = run(w, B.p.release + 0.5);
  check(w.backlog.back < 1e-6 && !has(evs, 'boschi_block'), 'BOSCHI: quando molla, l\'acqua trattenuta rientra tutta insieme');
  check(p.stats.stopped > 0, 'BOSCHI: l\'acqua fermata davvero e\' contata');
  check(results(run(w, 0.05, (t) => press(t)))[0] === 'spent', 'BOSCHI: una volta a partita');
}

// VICTOR
{
  const w = mk(['dottore', 'goblin'], { rain: true });
  const p = w.players[0];
  w.schedule = [{ kind: 'raffica', at: 200, door: 'front', announced: false, started: false, ended: false }];
  let e = run(w, 0.05, (t) => press(t));
  check(has(e, 'victor_wasted') && p.ab.charges === 1, 'VICTOR: nessuna raffica in vista -> uso sprecato');
  w.schedule = [{ kind: 'raffica', at: w.time + 12, door: 'back', announced: false, started: false, ended: false }];
  e = run(w, 0.05, (t) => press(t));
  check(has(e, 'victor_intel') && p.ab.intelDoor === 'back', 'VICTOR: vede quale porta prendera\' la raffica');
  const priv = w.abil.status(p, true);
  const pub = w.abil.status(p, false);
  check(/PORTA DIETRO/.test(priv.note ?? '') && !/PORTA/.test(pub.note ?? ''), `VICTOR: la porta si vede SOLO sul suo telefono (privato "${priv.note}", TV "${pub.note}")`);
  check(results(run(w, 0.05, (t) => press(t)))[0] === 'busy' || p.ab.charges === 0, 'VICTOR: non si accumula mentre l\'avviso e\' attivo');
  run(w, 14);
  check(p.ab.intelT === 0 && results(run(w, 0.05, (t) => press(t)))[0] === 'spent', 'VICTOR: due usi a partita');
}

// CARBO (judoka)
{
  const J = AB.casacarbo.judoka;
  const w = mk(['judoka']);
  const p = w.players[0];
  place(p, 600, 640);
  p.fx = 1;
  p.fy = 0;
  const e = run(w, 0.05, (t) => press(t));
  check(results(e)[0] === 'ok' && p.ab.damCells.length >= 4 && p.ab.damCells.every((k) => w.blocked[k] === 1), `CARBO: piazza la diga (${p.ab.damCells.length} celle)`);
  const damX = Math.max(...p.ab.damCells.map((k) => cellCenterPx(k).x));
  pour(w, 700, 600, 760, 680, 4);
  run(w, 3);
  let behind = 0;
  for (let k = 0; k < w.h.length; k++) if (w.h[k] > 0 && cellCenterPx(k).x < damX - 30 && cellCenterPx(k).y > 560) behind += w.h[k];
  check(behind < 0.05, `CARBO: la diga ferma l'acqua (passata ${behind.toFixed(3)})`);
  // le persone passano
  place(p, 600, 640);
  run(w, 1, () => ({ p0: IN({ mx: 1 }) }));
  check(p.x > 700, 'CARBO: la diga non ferma le persone');
  // troppa acqua: cede
  pour(w, 680, 600, 720, 680, J.p.capacity * 2);
  const ev = run(w, 0.5);
  check(has(ev, 'carbo_break') && p.ab.damCells.length === 0, 'CARBO: con troppa acqua dietro la diga cede');
  run(w, 0.1);
  check(results(run(w, 0.05, (t) => press(t)))[0] === 'ok', 'CARBO: seconda diga');
  run(w, J.p.duration + 0.5);
  check(p.ab.damCells.length === 0 && Array.from(w.blocked).every((v) => v === 0), 'CARBO: a fine durata la diga sparisce (nessuna cella bloccata)');
  check(results(run(w, 0.05, (t) => press(t)))[0] === 'spent', 'CARBO: due usi a partita');
}

// CIRO
{
  const C = AB.casacarbo.ciro;
  const w = mk(['ciro']);
  const p = w.players[0];
  pour(w, 500, 580, 700, 690, 40);
  place(p, 600, 630);
  run(w, 0.05, (t) => press(t));
  check(p.ab.bigBucket, 'CIRO: secchio doppio armato');
  run(w, 4, () => ({ p0: IN({ bucketHeld: true }) }));
  check(p.bucket > CC.bucketCap + 1, `CIRO: il secchio va oltre la capienza normale (${p.bucket.toFixed(1)})`);
  check(p.ab.deadlineT > 0, 'CIRO: oltre la capienza parte il conto alla rovescia');
  const before = p.bucket;
  const e = run(w, C.p.deadline + 0.5);
  check(has(e, 'ciro_lost') && near(p.bucket, before * (1 - C.p.loss), 0.3) && !p.ab.bigBucket, 'CIRO: se non svuota in tempo ne rovescia meta\'');
  // seconda volta: svuota in tempo
  run(w, 0.05, (t) => press(t));
  p.bucket = 0;
  pour(w, 520, 590, 700, 690, 40);
  place(p, 600, 630);
  run(w, 4, () => ({ p0: IN({ bucketHeld: true }) }));
  const amt = p.bucket;
  place(p, 600, 485);
  const e2 = run(w, 0.1, (t) => ({ p0: IN({ bucketPressed: t < 0.01 }) }));
  check(has(e2, 'ciro_paid') && near(p.stats.drainedBucket, amt, 1e-6), `CIRO: svuotato in tempo vale il doppio (${amt.toFixed(1)})`);
  check(results(run(w, 0.05, (t) => press(t)))[0] === 'spent', 'CIRO: due usi a partita');
}

// abilita' spente (simulazioni ON/OFF)
{
  const w = mk(['goblin'], { abilities: false });
  check(results(run(w, 0.05, (t) => press(t)))[0] === 'disabled', 'OFF: il tasto non fa nulla');
}
// catalogo
for (const cid of ['goblin', 'buttafuori', 'dottore', 'judoka', 'ciro'] as const) {
  const d = AB.casacarbo[cid];
  check(d.full.length > 40 && !/\$\{|undefined|NaN/.test(d.full), `CATALOGO ${cid}: testo completo`);
}
check(AB.casacarbo.goblin.name === "N'CULO, MO ASCIUGO IO!" && AB.casacarbo.buttafuori.name === 'TU QUA NON ENTRI!' && AB.casacarbo.dottore.name === "M'HO SVEJATO" && AB.casacarbo.judoka.name === 'NO, ASPETTA!' && AB.casacarbo.ciro.name === 'PAGO DOMANI', 'CATALOGO: nomi delle 5 abilita\' come da specifica');

void COLS;
console.log(ko ? `\n❌ ${ko} falliti, ${ok} ok` : `\n✅ ${ok}/${ok} controlli ok`);
process.exit(ko ? 1 : 0);
