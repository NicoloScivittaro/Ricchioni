// MEMORIA — PRIVACY in fase TOCCA: dalla TV non si deve poter capire QUALE tessera preme un giocatore.
// P1 preme ALTO, P2 preme SINISTRA (entrambe mosse corrette: il confronto e' alla pari), P3 non ha ancora risposto.
// Verifica: audio della TV identico per le due pressioni (stesso suono neutro, nessuna nota specifica), nessuna tessera che
// lampeggia/si ingrandisce sulla TV, schede con il SOLO progresso (⏳ 1/N, ⏳ 0/N), vibrazione generica uguale per entrambi.
// In OSSERVA invece la TV mostra e suona la sequenza (note specifiche).
//   node scripts/e2e/memory-privacy.mjs
import { launch, createRoomOnHost, addPhone, hostEval, hostSnapshot, sleep } from './lib.mjs';
import { XBOX, DS, GENERIC, makeCheck, installMock, add, tap, until, sceneEval, rumbleCount } from './padmock.mjs';

const { check, st } = makeCheck();
const browser = await launch();
try {
  const { page, code } = await createRoomOnHost(browser, { targetKeyPresses: 1 });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  for (let i = 0; i < 3; i++) await addPhone(browser, code, `P${i + 1}`, i);
  const pids = await hostEval(page, (gm) => gm.state.players.map((p) => p.id));
  await installMock(page);
  for (let k = 0; k < 3; k++) await add(page, k, [XBOX, DS, GENERIC][k]);
  await sleep(800);
  for (let k = 0; k < 3; k++) {
    for (let tries = 0; tries < 3 && (await page.evaluate((id) => window.__pads.slotOf(id)?.state, pids[k])) !== 'paired'; tries++) {
      await page.evaluate((id) => window.__pads.setTarget(id), pids[k]);
      await tap(page, k, 'A');
      await sleep(200);
    }
  }
  await page.evaluate(() => window.__pads.setTarget(null));
  check((await page.evaluate(() => window.__pads.pairedCount())) === 3, '3 controller associati');

  // registratore DENTRO la pagina: ogni chiamata audio dell'host + aspetto delle tessere ogni 20 ms
  await page.evaluate(async () => {
    const url = performance.getEntriesByType('resource').map((e) => e.name).find((n) => /AudioManager\.ts/.test(n));
    const { audio } = await import(url);
    window.__aud = [];
    const proto = Object.getPrototypeOf(audio);
    for (const k of Object.getOwnPropertyNames(proto)) {
      if (k === 'constructor' || typeof audio[k] !== 'function' || /^(stats|getState|getContext|getOutput|getMusicInput|getVolume|isMuted|recentSting|reserveVoice|unlock|duck|ensure|claim|release|outWithPan)$/.test(k)) continue;
      const orig = audio[k].bind(audio);
      audio[k] = (...a) => {
        window.__aud.push(`${k}(${a.map((x) => (typeof x === 'number' ? x.toFixed(2) : String(x))).join(',')})`);
        return orig(...a);
      };
    }
  });

  await hostEval(page, (gm) => gm.selectMinigame('memory'));
  if ((await hostSnapshot(page)).phase === 'LOBBY') {
    await sleep(300);
    await page.keyboard.press('Enter');
  }
  await until(async () => (await hostSnapshot(page)).phase === 'MINIGAME_PLAYING', 120000, 'memoria PLAYING');

  // OSSERVA: la TV suona le note specifiche della sequenza
  await until(async () => (await sceneEval(page, 'memory', (g) => g.phase)) === 'observe', 60000, 'osserva');
  await page.evaluate(() => (window.__aud = []));
  await until(async () => (await sceneEval(page, 'memory', (g) => g.phase)) === 'repeat', 60000, 'tocca');
  const observeAudio = await page.evaluate(() => window.__aud.slice());
  check(observeAudio.some((c) => c.startsWith('tileTone(')), `OSSERVA: la TV suona le note della sequenza (${observeAudio.filter((c) => c.startsWith('tileTone(')).join(' ')})`);

  const TOP = 0; // c0 = TESSERA IN ALTO
  const LEFT = 3; // c3 = TESSERA A SINISTRA
  const tvSample = () =>
    page.evaluate(() => {
      window.__tv = [];
      window.__tvT = setInterval(() => {
        const urlP = performance.getEntriesByType('resource').map((e) => e.name).find((n) => /GameManager\.ts/.test(n));
        void import(urlP).then(({ game: gm }) => {
          const g = gm.game.scene.getScene('memory');
          window.__tv.push({ halo: g.tileHalos.map((h) => h.alpha), scale: g.tileRects.map((r) => r.scaleX) });
        });
      }, 20);
    });
  const tvStop = () =>
    page.evaluate(() => {
      clearInterval(window.__tvT);
      return window.__tv;
    });
  const press = async (padIdx, tile, btnName) => {
    // la mossa e' corretta per entrambi: stessa reazione di gioco, cambia SOLO la tessera
    await sceneEval(page, 'memory', (g, t) => {
      g.sequences[g.round][0] = t;
    }, tile);
    await page.evaluate(() => (window.__aud = []));
    const r0 = await rumbleCount(page, padIdx);
    await tvSample();
    await tap(page, padIdx, btnName);
    await sleep(700);
    const tv = await tvStop();
    const aud = await page.evaluate(() => window.__aud.slice());
    const r1 = await rumbleCount(page, padIdx);
    return { tv, aud, rumble: r1 - r0 };
  };

  const a = await press(0, TOP, 'Y'); // P1: TOP (Y / triangolo = posizione in alto)
  const b = await press(1, LEFT, 'X'); // P2: LEFT (X / quadrato = posizione a sinistra)
  const prog = await sceneEval(page, 'memory', (g) => g.players.map((p) => [p.snap.displayName, p.inputIndex, p.alive]));
  check(prog[0][1] === 1 && prog[1][1] === 1 && prog[2][1] === 0, `le due pressioni sono state contate (progressi ${JSON.stringify(prog)})`);

  check(JSON.stringify(a.aud) === JSON.stringify(b.aud), `AUDIO TV identico per ALTO e SINISTRA: [${a.aud.join(' ')}] vs [${b.aud.join(' ')}]`);
  check(!a.aud.concat(b.aud).some((c) => c.startsWith('tileTone(') || c.startsWith('playTone(')), 'nessuna nota specifica di tessera sulla TV in TOCCA');
  const maxHalo = (tv) => Math.max(0, ...tv.flatMap((s) => s.halo));
  const scaled = (tv) => tv.some((s) => s.scale.some((x) => Math.abs(x - 1) > 0.001));
  check(maxHalo(a.tv) === 0 && maxHalo(b.tv) === 0, `nessuna tessera illuminata sulla TV (alone massimo ${maxHalo(a.tv)} / ${maxHalo(b.tv)}, ${a.tv.length}+${b.tv.length} campioni)`);
  check(!scaled(a.tv) && !scaled(b.tv), 'nessuna tessera che si ingrandisce sulla TV');
  check(a.rumble === b.rumble && a.rumble >= 1, `vibrazione generica uguale per le due tessere (${a.rumble} / ${b.rumble})`);

  const cards = await sceneEval(page, 'memory', (g) => g.players.map((p) => p.card.text));
  // nomi/icone delle tessere (shared/memoryTiles.ts) + direzioni: nessuno deve comparire nelle schede
  const labels = ['ROSSO', 'BLU', 'VERDE', 'GIALLO', '🍺', '🧊', '🥒', '🥨', 'ALTO', 'SINISTRA', 'DESTRA', 'BASSO'];
  const leaks = cards.filter((c) => labels.some((l) => l && c.includes(l)));
  check(leaks.length === 0 && /1\//.test(cards[0]) && /1\//.test(cards[1]) && /0\//.test(cards[2]), `schede TV: solo progresso (${cards.map((c) => c.split('\n')[1]).join(' · ')})`);
  check(errs.length === 0, `nessun errore di pagina${errs.length ? ' ' + errs.join(' | ') : ''}`);
} finally {
  await browser.close();
}
process.exit(st.fails === 0 ? 0 : 1);
