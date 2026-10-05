// AUDIO nel browser.
//  A) Audio Lab (?audiolab=1): ogni cue suona senza errori; STRESS (4 armi + colpi + esplosione + musica) senza clipping
//     (picco d'uscita < 1.0 dopo il limiter); a fine prova voci e note musicali tornano a 0 (nessun nodo/oscillatore lasciato).
//  B) Sessione vera: la musica segue le fasi (stanza -> gioco -> risultati), Botta al Volo suona il VIA nello STESSO passo del
//     VIA visivo (nessun vantaggio audio), i telefoni passivi (controller) non suonano nulla, i temi cambiano gioco per gioco.
//   node scripts/e2e/audio.mjs
import puppeteer from 'puppeteer-core';
import { CHROME, HOST_URL, sleep, createRoomOnHost, addPhone, hostEval, hostSnapshot } from './lib.mjs';
import { XBOX, DS, GENERIC, installMock, add, tap, until, sceneEval } from './padmock.mjs';

let fails = 0;
const check = (c, m) => {
  console.log(`${c ? '✅' : '❌'} ${m}`);
  if (!c) fails++;
};
const args = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'];

// ---------------------------------------------------------------- A) AUDIO LAB
{
  const b = await puppeteer.launch({ executablePath: CHROME, headless: true, args, defaultViewport: { width: 1280, height: 720 } });
  try {
    const page = await b.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
    await page.goto(`${HOST_URL}?audiolab=1`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__audiolab?.ready === true, { timeout: 30000 });
    await page.keyboard.press('Shift'); // un gesto, per sicurezza
    const cues = await page.evaluate(() => window.__audiolab.cues);
    let n = 0;
    for (const [area, names] of Object.entries(cues)) {
      if (area === 'MUSICA') continue;
      for (const name of names) {
        await page.evaluate((a, c) => window.__audiolab.play(a, c), area, name);
        n++;
        await sleep(25);
      }
    }
    check(errs.length === 0, `${n} cue suonati senza errori${errs.length ? ' ' + errs.join(' | ') : ''}`);
    const st0 = await page.evaluate(() => window.__audiolab.stats());
    check(st0.state === 'running', `AudioContext attivo (${st0.state})`);
    // temi musicali uno dopo l'altro (crossfade): nessun errore, uno solo alla volta
    for (const t of ['lobby', 'roulette', 'arena', 'dodgeball', 'soccer', 'volleyball', 'kart3d', 'fps', 'memory', 'reaction', 'quiz', 'cultura', 'results', 'podium']) {
      await page.evaluate((x) => window.__audiolab.play('MUSICA', x), t);
      await sleep(250);
    }
    await sleep(1200);
    const mst = await page.evaluate(() => window.__audiolab.stats());
    check(mst.music === 'podium' && mst.notes > 0, `musica: crossfade fra 14 temi, ne suona uno solo (ora ${mst.music}, ${mst.notes} note attive)`);
    // stress: picco d'uscita sotto il clipping
    await page.evaluate(() => window.__audiolab.stress());
    let peak = 0;
    let maxVoices = 0;
    for (let i = 0; i < 60; i++) {
      const s = await page.evaluate(() => window.__audiolab.stats());
      peak = Math.max(peak, s.peak);
      maxVoices = Math.max(maxVoices, s.voices.sfx);
      await sleep(40);
    }
    check(peak > 0.02 && peak < 1.0, `STRESS (4 armi + colpi + esplosione + musica): picco d'uscita ${peak.toFixed(2)} < 1.0 (il limiter tiene)`);
    check(maxVoices <= 36, `budget effetti rispettato (max ${maxVoices} voci contemporanee, tetto 36)`);
    // leak: fermata la musica, tutto torna a zero
    await page.evaluate(() => window.__audiolab.play('MUSICA', 'stop'));
    await sleep(3500);
    const end = await page.evaluate(() => window.__audiolab.stats());
    const live = Object.values(end.voices).reduce((a, v) => a + v, 0);
    check(live === 0 && end.notes === 0 && end.music === null, `nessuna voce lasciata accesa (voci ${live}, note musica ${end.notes}, tema ${end.music})`);
  } finally {
    await b.close();
  }
}

// ---------------------------------------------------------------- B) SESSIONE
{
  const b = await puppeteer.launch({ executablePath: CHROME, headless: true, args, defaultViewport: { width: 1280, height: 720 } });
  try {
    const { page, code } = await createRoomOnHost(b, { targetKeyPresses: 1 });
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
    const phones = [];
    for (let i = 0; i < 3; i++) phones.push(await addPhone(b, code, `P${i + 1}`, i));
    const musicNow = () =>
      page.evaluate(async () => {
        const url = performance.getEntriesByType('resource').map((e) => e.name).find((n) => /core\/music\.ts/.test(n));
        const { music } = await import(url);
        return { theme: music.current(), level: music.getLevel(), notes: music.activeNotes() };
      });
    await sleep(1500);
    check((await musicNow()).theme === 'lobby', 'stanza: tema lobby');
    // controller associati in LOBBY (come in una serata vera): i telefoni dei 3 giocatori diventano passivi
    const pids = await hostEval(page, (gm) => gm.state.players.map((p) => p.id));
    await installMock(page);
    for (let k = 0; k < 3; k++) await add(page, k, [XBOX, DS, GENERIC][k]);
    await sleep(400);
    for (let k = 0; k < 3; k++) {
      await page.evaluate((id) => window.__pads.setTarget(id), pids[k]);
      await tap(page, k, 'A');
    }
    await page.evaluate(() => window.__pads.setTarget(null));
    check((await page.evaluate(() => window.__pads.pairedCount())) === 3, '3 controller associati in lobby');
    const phase = async () => (await hostSnapshot(page)).phase;
    const start = async (id) => {
      await hostEval(page, (gm, g) => gm.selectMinigame(g), id);
      if ((await phase()) === 'LOBBY') {
        await sleep(300);
        await page.keyboard.press('Enter');
      }
      await until(async () => (await phase()) === 'MINIGAME_PLAYING', 120000, `${id} PLAYING`);
    };
    const finish = async () => {
      await hostEval(page, (gm) => {
        const ctx = gm.minigameContext;
        ctx.finish({ results: ctx.players.map((pl, i) => ({ playerId: pl.id, placement: i + 1, score: 5 - i })) });
      });
    };

    // BOTTA AL VOLO: il suono del VIA parte nello stesso passo del VIA visivo
    await start('reaction');
    await sleep(800);
    const m1 = await musicNow();
    check(m1.theme === 'reaction', `Botta al Volo: tema dedicato (${m1.theme}, livello ${m1.level})`);
    await page.evaluate(async () => {
      const url = performance.getEntriesByType('resource').map((e) => e.name).find((n) => /AudioManager\.ts/.test(n));
      const gurl = performance.getEntriesByType('resource').map((e) => e.name).find((n) => /GameManager\.ts/.test(n));
      const { audio } = await import(url);
      const { game: gm } = await import(gurl);
      const orig = audio.reactionGo.bind(audio);
      window.__goRec = [];
      audio.reactionGo = () => {
        const sc = gm.game.scene.getScene('reaction');
        window.__goRec.push({ phase: sc.phase, text: sc.centerText.text, t: performance.now() });
        orig();
      };
    });
    await until(async () => (await page.evaluate(() => window.__goRec.length)) > 0, 90000, 'VIA di Botta al Volo');
    const rec = (await page.evaluate(() => window.__goRec))[0];
    check(rec.phase === 'via' && /VIA/.test(rec.text), `VIA: audio nello stesso passo del VIA visivo (fase "${rec.phase}", testo "${rec.text}") — nessun anticipo sonoro`);
    await finish();
    await until(async () => (await phase()) === 'ROUND_RESULTS', 60000, 'risultati');
    await sleep(1500);
    check((await musicNow()).theme === 'results', 'risultati: tema dei risultati (crossfade, nessuno stacco brusco)');
    // il prossimo gioco si sceglie GIA' durante i risultati (fase selezionabile): durante il rullo la scelta verrebbe ignorata

    // CONTROLLER: telefoni passivi muti; tema del gioco a livello 0 durante CONTROLLI

    await hostEval(page, (gm) => gm.selectMinigame('arena'));
    await until(async () => (await phase()) === 'MINIGAME_PLAYING', 120000, 'arena PLAYING');
    check((await hostEval(page, (gm) => gm.state.currentMinigame?.minigameId)) === 'arena', 'gioco scelto: Arena');
    let sawLevel0 = false;
    const samples = [];
    for (let i = 0; i < 30 && !sawLevel0; i++) {
      const m = await musicNow();
      const cc = await page.evaluate(() => !!document.getElementById('pad-controls'));
      samples.push(`${m.theme}/${m.level}/${cc ? 'C' : '-'}`);
      if (m.theme === 'arena' && m.level === 0 && cc) sawLevel0 = true;
      await sleep(100);
    }
    check(sawLevel0, `Arena: durante la schermata CONTROLLI la musica e' "sotto" (livello 0)${sawLevel0 ? '' : ' ' + samples.join(' ')}`);
    await until(async () => (await sceneEval(page, 'arena', (g) => g.game3d?.phase ?? null)) === 'playing' || (await page.evaluate(() => !document.getElementById('pad-controls'))), 60000, 'fine controlli');
    await sleep(3500);
    const m2 = await musicNow();
    check(m2.theme === 'arena' && m2.level >= 1, `Arena: dopo i CONTROLLI tema arena a livello ${m2.level} (tema ${m2.theme}, fase ${await phase()})`);
    let phoneVoices = 0;
    for (let i = 0; i < 3; i++) {
      const v = await phones[i].page.evaluate(async () => {
        const url = performance.getEntriesByType('resource').map((e) => e.name).find((n) => /AudioManager\.ts/.test(n));
        if (!url) return 0;
        const { audio } = await import(url);
        const s = audio.stats();
        return Object.values(s.voices).reduce((a, x) => a + x, 0);
      });
      phoneVoices += v;
    }
    check(phoneVoices === 0, `telefoni passivi (controller): nessun suono (${phoneVoices} voci)`);
    await finish();
    await until(async () => (await phase()) === 'ROUND_RESULTS', 60000, 'risultati arena');
    await hostEval(page, (gm) => gm.selectMinigame('soccer'));

    // CALCIO: tema e folla
    await until(async () => (await phase()) === 'MINIGAME_PLAYING', 120000, 'calcio PLAYING');
    await until(async () => (await sceneEval(page, 'soccer', (g) => g.game3d?.phase ?? null)) === 'playing', 90000, 'calcio via');
    await sleep(1500);
    const m3 = await musicNow();
    check(m3.theme === 'soccer', `Calcio: tema del calcio (${m3.theme})`);
    const amb = await page.evaluate(async () => {
      const url = performance.getEntriesByType('resource').map((e) => e.name).find((n) => /AudioManager\.ts/.test(n));
      const { audio } = await import(url);
      return !!audio.crowd;
    });
    check(amb, 'Calcio: letto di folla acceso');
    await finish();
    await until(async () => (await phase()) === 'ROUND_RESULTS', 60000, 'risultati calcio');
    await sleep(1500);
    const amb2 = await page.evaluate(async () => {
      const url = performance.getEntriesByType('resource').map((e) => e.name).find((n) => /AudioManager\.ts/.test(n));
      const { audio } = await import(url);
      return !!audio.crowd;
    });
    check(!amb2, 'fine Calcio: la folla si spegne (nessun suono che resta tra un gioco e l\'altro)');
    check(errs.length === 0, `nessun errore di pagina${errs.length ? ' ' + errs.join(' | ') : ''}`);
  } finally {
    await b.close();
  }
}
console.log(fails === 0 ? '\nTUTTO OK' : `\n${fails} FALLITI`);
process.exit(fails === 0 ? 0 : 1);
