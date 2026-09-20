// Screenshot dell'host nel flusso completo (rullo, risultati con statistiche, classifica, prossimo round, finale con podio).
//   PLAYERS=5 OUT=/percorso node scripts/e2e/shots.mjs
import { launch, createRoomOnHost, addPhone, hostEval, hostSnapshot, sleep } from './lib.mjs';
import path from 'node:path';

const N = Number(process.env.PLAYERS ?? 5);
const OUT = process.env.OUT ?? path.resolve('.');
const browser = await launch();
try {
  const { page, code } = await createRoomOnHost(browser, { targetKeyPresses: Math.max(0, N - 2) });
  const names = ['Nicolò', 'Christian', 'Marco', 'Giulia', 'Ciro'];
  for (let i = 0; i < N; i++) await addPhone(browser, code, names[i], i);
  await hostEval(page, (gm, id) => gm.selectMinigame(id), 'quiz');
  await sleep(300);
  await page.keyboard.press('Enter');
  const shot = async (name) => {
    await page.screenshot({ path: path.join(OUT, `shot-${name}.png`) });
    console.log('screenshot', name);
  };
  const waitPhase = async (ph, ms = 60000) => {
    const t0 = Date.now();
    while ((await hostSnapshot(page)).phase !== ph) {
      if (Date.now() - t0 > ms) throw new Error('timeout ' + ph);
      await sleep(150);
    }
  };
  const skipTo = async (ph) => {
    let g = 0;
    while ((await hostSnapshot(page)).phase !== ph) {
      await hostEval(page, (gm) => gm.skip());
      await sleep(400);
      if (++g > 60) throw new Error('skipTo ' + ph);
    }
  };
  const inject = (round) =>
    hostEval(
      page,
      (gm, r) => {
        const ctx = gm.minigameContext;
        const stats = [['7/10 corrette', '4.2s di media'], ['tempo 1:12.3', 'miglior giro 0:24.1'], ['9 kill · 3 morti', 'precisione 41%'], ['2 gol · 1 assist', '3 contrasti'], ['4/5 sequenze', '19 mosse esatte']];
        const order = [...ctx.players];
        if (r % 2 === 0) order.reverse();
        ctx.finish({ results: order.map((p, i) => ({ playerId: p.id, placement: i + 1, score: 10 - i, stats: stats[(i + r) % stats.length] })) });
      },
      round
    );

  for (let round = 1; round <= 12; round++) {
    if (round === 2) {
      // una schermata di INTRO vera (il rullo viene saltato con un solo skip)
      await hostEval(page, (gm) => gm.skip());
      await waitPhase('MINIGAME_INTRO', 8000);
      await sleep(1300);
      await shot('g-intro');
    }
    await skipTo('MINIGAME_PLAYING');
    await sleep(1200);
    await inject(round);
    await waitPhase('ROUND_RESULTS');
    if (round === 2) {
      await sleep(5700);
      await shot('a-risultati-statistiche');
    }
    if (round === 2) {
      await waitPhase('GLOBAL_LEADERBOARD', 20000);
      await sleep(1700);
      await shot('b-classifica-generale');
    }
    await skipTo('GLOBAL_LEADERBOARD').catch(() => {});
    let ph = (await hostSnapshot(page)).phase;
    if (ph === 'GAME_FINISHED' || ph === 'CHECK_WINNER') break;
    // NEXT_ROUND
    let g = 0;
    while (!['NEXT_ROUND', 'GAME_FINISHED'].includes(ph) && g++ < 40) {
      await sleep(200);
      ph = (await hostSnapshot(page)).phase;
    }
    if (round === 2 && ph === 'NEXT_ROUND') {
      await sleep(600);
      await shot('c-prossimo-round');
    }
    if (ph === 'GAME_FINISHED') break;
    await waitPhase('MINIGAME_ROULETTE');
    if (round === 2) {
      await sleep(5600);
      await shot('d-rullo-secondo-round');
    }
  }
  await waitPhase('GAME_FINISHED', 30000);
  await sleep(2200);
  await shot('e-finale-in-corso');
  await sleep(6800);
  await shot('f-finale-podio');
} finally {
  await browser.close();
}
