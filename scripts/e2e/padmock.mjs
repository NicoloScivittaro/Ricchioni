// Controller FINTI per i test E2E del gamepad: navigator.getGamepads viene sostituito nella pagina host (il browser headless non ha
// hardware). Il resto del percorso (GamepadManager -> profilo -> InputManager -> gioco) e' quello VERO.
import { hostEval, hostSnapshot, sleep } from './lib.mjs';

export const XBOX = 'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)';
export const DS = 'DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)';
export const GENERIC = 'USB Gamepad (Vendor: 0810 Product: e501)';

export function makeCheck() {
  const st = { fails: 0 };
  const check = (c, m) => {
    console.log(`${c ? '✅' : '❌'} ${m}`);
    if (!c) st.fails++;
  };
  return { st, check };
}

export async function installMock(page, cap = 4) {
  await page.evaluate((cap) => {
    const mp = (window.__mp = { pads: {}, rumbles: [], cap, names: ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'BACK', 'START', 'L3', 'R3', 'UP', 'DOWN', 'LEFT', 'RIGHT'] });
    navigator.getGamepads = () => {
      const a = new Array(mp.cap).fill(null);
      for (const k of Object.keys(mp.pads)) {
        const p = mp.pads[k];
        if (p.index >= mp.cap) continue;
        a[p.index] = {
          index: p.index,
          id: p.id,
          connected: true,
          mapping: 'standard',
          axes: [...p.axes],
          buttons: p.buttons.map((b) => ({ pressed: b.v > 0.5, value: b.v })),
          vibrationActuator: { playEffect: (t, o) => (mp.rumbles.push({ index: p.index, t: performance.now(), ...o }), Promise.resolve('complete')) }
        };
      }
      return a;
    };
    window.__padAdd = (index, id) => {
      mp.pads[index] = { index, id, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ v: 0 })) };
      const ev = new Event('gamepadconnected');
      ev.gamepad = navigator.getGamepads()[index];
      window.dispatchEvent(ev);
    };
    window.__padRemove = (index) => {
      const gone = { index, id: mp.pads[index]?.id ?? '', buttons: [], axes: [], connected: false };
      delete mp.pads[index];
      const ev = new Event('gamepaddisconnected');
      ev.gamepad = gone;
      window.dispatchEvent(ev);
    };
    window.__padBtn = (i, n, d) => {
      if (mp.pads[i]) mp.pads[i].buttons[mp.names.indexOf(n)].v = d ? 1 : 0;
    };
    // valore ANALOGICO di un grilletto (0..1)
    window.__padTrig = (i, n, v) => {
      if (mp.pads[i]) mp.pads[i].buttons[mp.names.indexOf(n)].v = v;
    };
    window.__padStick = (i, lx, ly) => {
      if (mp.pads[i]) mp.pads[i].axes = [lx, ly, 0, 0];
    };
  }, cap);
}
export const add = (page, i, id) => page.evaluate((a, b) => window.__padAdd(a, b), i, id);
export const remove = (page, i) => page.evaluate((a) => window.__padRemove(a), i);
export const btn = (page, i, n, d) => page.evaluate((a, b, c) => window.__padBtn(a, b, c), i, n, d);
export const trig = (page, i, n, v) => page.evaluate((a, b, c) => window.__padTrig(a, b, c), i, n, v);
export const stick = (page, i, x, y) => page.evaluate((a, b, c) => window.__padStick(a, b, c), i, x, y);
/** Il polling e' per fotogramma e l'host headless gira a ~10 fps: un tocco deve durare qualche fotogramma. */
export async function tap(page, i, n, hold = 380) {
  await btn(page, i, n, true);
  await sleep(hold);
  await btn(page, i, n, false);
  await sleep(220);
}
export const rumbleCount = (page, index) => page.evaluate((i) => window.__mp.rumbles.filter((r) => r.index === i).length, index);
export const until = async (fn, ms, what) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await fn()) return true;
    await sleep(150);
  }
  throw new Error('timeout: ' + what);
};
export const phoneText = (ph) => ph.page.evaluate(() => (document.getElementById('app')?.innerText ?? '').replace(/\s+/g, ' '));
export const slot = (page, pid) => page.evaluate((id) => JSON.parse(JSON.stringify(window.__pads.slotOf(id))), pid);
export const slots = (page) => page.evaluate(() => JSON.stringify(window.__pads.slotList().map((s) => [s.playerId, s.state, s.padIndex])));
export const axisOf = (page, pid, control = 'move') => hostEval(page, (gm, a) => gm.input.get(a.id).peekAxis(a.c), { id: pid, c: control });
export const pressedOf = (page, pid, control) => hostEval(page, (gm, a) => gm.input.get(a.id).peekPressed(a.c), { id: pid, c: control });
export const f3Text = (page) => page.evaluate(() => [...document.querySelectorAll('div')].find((d) => d.style.zIndex === '2147483000' && d.style.display !== 'none')?.textContent ?? '');

/** Osservatore della schermata CONTROLLI (istante di comparsa/scomparsa e testo). */
export async function watchControls(page) {
  await page.evaluate(() => {
    window.__cc = { shownAt: null, hiddenAt: null, text: '' };
    new MutationObserver(() => {
      const el = document.getElementById('pad-controls');
      const now = performance.now();
      if (el && window.__cc.shownAt === null) {
        window.__cc.shownAt = now;
        window.__cc.text = el.innerText.replace(/\s+/g, ' ');
      }
      if (!el && window.__cc.shownAt !== null && window.__cc.hiddenAt === null) window.__cc.hiddenAt = now;
    }).observe(document.body, { childList: true });
  });
}
export const resetControlsWatch = (page) => page.evaluate(() => (window.__cc = { shownAt: null, hiddenAt: null, text: '' }));

export async function startGame(page, id) {
  await hostEval(page, (gm, g) => gm.selectMinigame(g), id);
  await sleep(300);
  await page.keyboard.press('Enter');
  await until(async () => (await hostSnapshot(page)).phase === 'MINIGAME_PLAYING', 90000, `${id} PLAYING`);
}
/** Consegna subito il risultato del minigioco in corso (come i test esistenti). */
export async function finishNow(page) {
  await hostEval(page, (gm) => {
    const ctx = gm.minigameContext;
    ctx.finish({ results: ctx.players.map((pl, i) => ({ playerId: pl.id, placement: i + 1, score: 5 - i })) });
  });
}
/** Stato interno del gioco 3D di una scena (per i test: lettura e, dove serve, posizionamento dei personaggi). */
export const gameEval = (page, sceneKey, fn, arg) =>
  hostEval(page, (gm, a) => {
    const g = gm.game.scene.getScene(a.key)?.game3d;
    // eslint-disable-next-line no-new-func
    return g ? new Function('g', 'arg', `return (${a.src})(g, arg);`)(g, a.arg) : null;
  }, { key: sceneKey, src: fn.toString(), arg });

/** Come gameEval, ma per una scena Phaser 2D SENZA sotto-oggetto .game3d (Memoria, Reazione, Quiz): legge la Scene stessa. */
export const sceneEval = (page, sceneKey, fn, arg) =>
  hostEval(page, (gm, a) => {
    const g = gm.game.scene.getScene(a.key);
    // eslint-disable-next-line no-new-func
    return g ? new Function('g', 'arg', `return (${a.src})(g, arg);`)(g, a.arg) : null;
  }, { key: sceneKey, src: fn.toString(), arg });
