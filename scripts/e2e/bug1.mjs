// BUG 1: transizioni tra minigiochi SENZA refresh. Host Phaser + N telefoni reali.
import { launch, createRoomOnHost, addPhone, hostEval, hostSnapshot, phoneView, sleep } from './lib.mjs';

const N = Number(process.env.PHONES ?? 2);
const ROUNDS = Number(process.env.ROUNDS ?? 3);
const FORCE = process.env.FORCE ?? ''; // gioco forzato al primo round
const NATURAL = process.env.NATURAL === '1'; // niente injection: aspetta la fine naturale (solo giochi brevi)

const SCENE_FOR_PHASE = {
  MINIGAME_ROULETTE: 'RouletteScene',
  MINIGAME_INTRO: 'IntroScene',
  MINIGAME_FINISHED: 'FinishedScene',
  ROUND_RESULTS: 'ResultsScene',
  GLOBAL_LEADERBOARD: 'LeaderboardScene',
  NEXT_ROUND: 'NextRoundScene',
  GAME_FINISHED: 'GameOverScene'
};
const PHONE_H1 = {
  MINIGAME_ROULETTE: ['PROSSIMO GIOCO...'],
  MINIGAME_FINISHED: ['ROUND TERMINATO'],
  ROUND_RESULTS: ['ROUND TERMINATO'],
  GLOBAL_LEADERBOARD: ['ROUND TERMINATO'],
  CHECK_WINNER: ['ROUND TERMINATO'],
  NEXT_ROUND: ['PROSSIMO MINIGIOCO...']
};

const problems = [];
function bad(msg) {
  problems.push(msg);
  console.log('  ❌', msg);
}

const browser = await launch();
try {
  const { page: host, code } = await createRoomOnHost(browser, { targetKeyPresses: Math.max(0, N - 2) });
  console.log('stanza', code);
  const phones = [];
  for (let i = 0; i < N; i++) phones.push(await addPhone(browser, code, `P${i + 1}`, i));
  console.log(`${N} telefoni pronti`);

  if (FORCE) await hostEval(host, (gm, id) => gm.selectMinigame(id), FORCE);
  await sleep(300);
  await host.keyboard.press('Enter'); // avvia

  const seenPhases = [];
  let roundsDone = 0;
  let injected = -1;
  const t0 = Date.now();
  let lastPhase = '';
  while (Date.now() - t0 < 6 * 60 * 1000) {
    const snap = await hostSnapshot(host);
    const phase = snap.phase;
    if (phase !== lastPhase) {
      lastPhase = phase;
      seenPhases.push(phase);
      console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] phase=${phase} round=${snap.round} roundId=${snap.roundId} pending=${snap.pending} active=${snap.active} overlays=${snap.overlays}`);
      // dai 400ms in poi lo stato deve essere stabile: controlla host e telefoni
      await sleep(900);
      const s2 = await hostSnapshot(host);
      if (s2.phase === phase) {
        let expectedScene = SCENE_FOR_PHASE[phase];
        if (phase === 'MINIGAME_PLAYING') expectedScene = snap.pending === 'kart3d' ? 'kart3d' : snap.pending;
        if (expectedScene) {
          if (s2.active.length !== 1 || s2.active[0] !== expectedScene) {
            bad(`HOST phase=${phase}: scene attive ${JSON.stringify(s2.active)} (atteso solo ${expectedScene})`);
          }
        }
        if (phase !== 'MINIGAME_PLAYING' && s2.overlays > 0) bad(`HOST phase=${phase}: overlay 3D ancora presente (${s2.overlays})`);
        for (const p of phones) {
          const v = await phoneView(p.page);
          const okH1 = PHONE_H1[phase];
          if (okH1 && !okH1.includes(v.h1)) bad(`TELEFONO ${p.name} phase=${phase}: mostra "${v.h1}" (atteso ${okH1.join('|')})`);
          if (phase === 'MINIGAME_PLAYING' && /ROUND TERMINATO|PROSSIMO/.test(v.h1)) bad(`TELEFONO ${p.name} in PLAYING mostra "${v.h1}"`);
        }
      }
    }

    if (phase === 'MINIGAME_PLAYING' && injected !== snap.roundId) {
      if (!NATURAL) {
        await sleep(2500); // il gioco "gira" un po'
        injected = snap.roundId;
        await hostEval(host, (gm) => {
          const ctx = gm.minigameContext;
          ctx.finish({ results: ctx.players.map((p, i) => ({ playerId: p.id, placement: i + 1, score: 10 - i })) });
        });
        console.log('   (fine gioco iniettata)');
      }
    }
    if (phase === 'MINIGAME_ROULETTE' && seenPhases.filter((p) => p === 'MINIGAME_ROULETTE').length > roundsDone + 1) {
      // nuovo rullo dopo un round completo
    }
    if (phase === 'MINIGAME_ROULETTE') roundsDone = Math.max(roundsDone, seenPhases.filter((p) => p === 'MINIGAME_ROULETTE').length - 1);
    if (roundsDone >= ROUNDS || phase === 'GAME_FINISHED') break;
    await sleep(250);
  }

  console.log('\nFasi viste:', seenPhases.join(' > '));
  console.log(`Round completati senza refresh: ${roundsDone}`);
  if (problems.length) {
    console.log(`\n❌ ${problems.length} PROBLEMI`);
    process.exitCode = 1;
  } else {
    console.log('\n✅ Nessun problema di transizione');
  }
} catch (e) {
  console.error('ERRORE TEST', e);
  process.exitCode = 2;
} finally {
  await browser.close();
}
