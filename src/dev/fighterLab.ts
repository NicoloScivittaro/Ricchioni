import type { MinigameContext } from '../minigames/types';
import type { PlayerSnapshot } from '../../shared/types';
import { Rng } from '../../shared/rng';
import { CHARACTERS } from '../../shared/characters';
import { InputManager } from '../network/InputManager';
import { audio } from '../core/AudioManager';
import { setTimeScale } from '../core/impact';
import { KO, PHYS } from '../minigames/cornicione/fighterData';
import type { BabylonCornicioneGame } from '../minigames/cornicione/BabylonCornicioneGame';

/**
 * FIGHTER LAB — SOLO SVILUPPO (`npm run dev`) o `?debug=1`, aperto con `?fighter=1`. Non esiste nella UX normale.
 * Il VERO gioco (BabylonCornicioneGame) su un contesto finto, con gli strumenti per provarlo: spawn di 2-5 personaggi, % di danno,
 * reset vite, "fuori dal palco", abilita' sempre pronte, hitbox/hurtbox/limiti di KO visibili, rallentatore 0.25x / 0.5x / 1x.
 * Tastiera (P1): frecce = stick, Z salto, X leggero, C pesante, V schivata, B abilita'. Gli altri sono fermi o bot.
 * `window.__fighterLab` = { game(), restart(n, chars), setPercent(i, p), forceOffstage(i), readyAbility(i), resetLives(), koEdge(i) } per i test.
 */
const CHAR_IDS = ['goblin', 'buttafuori', 'judoka', 'dottore', 'ciro'];

function makeSnapshots(n: number, first: string): PlayerSnapshot[] {
  const start = Math.max(0, CHAR_IDS.indexOf(first));
  return Array.from({ length: n }, (_, i) => {
    const cid = first==='all-goblin'?'goblin':first==='all-judoka'?'judoka':first==='all-buttafuori'?'buttafuori':first==='all-ciro'?'ciro':CHAR_IDS[(start + i) % CHAR_IDS.length];
    const ch = CHARACTERS[cid];
    return { id: `lab${i + 1}`, displayName: ch.name, characterId: cid, name: ch.name, roleTitle: ch.roleTitle, avatar: ch.avatar, color: ch.color, quote: ch.quote, score: 0 };
  });
}

export function openFighterLab(): void {
  const wrap = document.createElement('div');
  wrap.id = 'fighter-lab';
  wrap.style.cssText = 'position:fixed;inset:0;z-index:2147480000;background:#1b1f2a;display:flex;flex-direction:column';
  const stage = document.createElement('div');
  stage.style.cssText = 'flex:1;min-height:0;position:relative';
  const bar = document.createElement('div');
  bar.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;padding:8px 12px;background:#0f1320;font:700 13px Arial;color:#cbd5e1;align-items:center';
  wrap.append(stage, bar);
  document.body.appendChild(wrap);
  audio.unlock();

  let canvas: HTMLCanvasElement | null = null;
  let game: BabylonCornicioneGame | null = null;
  let input = new InputManager();
  let count = 3;
  let first = 'goblin';
  let target = 0;
  let boxes = false;
  let bots = false;
  const keys = new Set<string>();

  const btn = (label: string, fn: () => void): HTMLButtonElement => {
    const b = document.createElement('button');
    b.textContent = label;
    b.style.cssText = 'padding:5px 9px;border-radius:8px;border:1px solid #475569;background:#1e293b;color:#e2e8f0;font:700 12px Arial;cursor:pointer';
    b.addEventListener('click', () => {
      fn();
      b.blur();
    });
    bar.appendChild(b);
    return b;
  };
  const sep = (t: string): void => {
    const s = document.createElement('span');
    s.textContent = t;
    s.style.cssText = 'margin-left:10px;color:#94a3b8';
    bar.appendChild(s);
  };

  const sim = (): NonNullable<BabylonCornicioneGame['sim']> => game!.sim;

  async function restart(n = count, chars = first): Promise<void> {
    count = n;
    first = chars;
    game?.dispose();
    canvas?.remove();
    canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;outline:none';
    stage.appendChild(canvas);
    input = new InputManager();
    const players = makeSnapshots(n, chars);
    const ctx: MinigameContext = {
      players,
      playerIds: players.map((p) => p.id),
      rng: new Rng(12345),
      durationSec: 150,
      modifier: null,
      modifiers: new Map(),
      input,
      consume: () => false,
      sendPrivate: () => undefined,
      vibrate: () => undefined,
      signal: () => undefined,
      finish: () => undefined
    };
    const { BabylonCornicioneGame } = await import('../minigames/cornicione/BabylonCornicioneGame');
    game = new BabylonCornicioneGame(canvas, ctx, { devArena: true });
    game.setShowBoxes(boxes);
    if (bots) players.slice(1).forEach((p) => game!.setBot(p.id, true));
  }

  // ---- tastiera P1
  const P1 = 'lab1';
  const KEYMAP: Record<string, string> = { KeyZ: 'jump', KeyX: 'light', KeyC: 'heavy', KeyV: 'dodge', KeyB: 'ability' };
  const syncAxis = (): void => {
    const x = (keys.has('ArrowRight') ? 1 : 0) - (keys.has('ArrowLeft') ? 1 : 0);
    const y = (keys.has('ArrowDown') ? 1 : 0) - (keys.has('ArrowUp') ? 1 : 0);
    input.handle(P1, { kind: 'axis', controlId: 'move', x, y });
  };
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.repeat) return;
      if (e.code.startsWith('Arrow')) {
        keys.add(e.code);
        syncAxis();
        e.preventDefault();
        e.stopPropagation();
      } else if (KEYMAP[e.code]) {
        input.handle(P1, { kind: 'down', controlId: KEYMAP[e.code] });
        e.stopPropagation();
      } else if (e.code === 'KeyH') {
        boxes = !boxes;
        game?.setShowBoxes(boxes);
      }
    },
    true
  );
  window.addEventListener(
    'keyup',
    (e) => {
      if (e.code.startsWith('Arrow')) {
        keys.delete(e.code);
        syncAxis();
      } else if (KEYMAP[e.code]) input.handle(P1, { kind: 'up', controlId: KEYMAP[e.code] });
    },
    true
  );

  // ---- strumenti
  const api = {
    game: () => game,
    restart,
    setPercent: (i: number, p: number): void => {
      sim().fighters[i].percent = p;
    },
    resetLives: (): void => {
      for (const f of sim().fighters) {
        f.lives = KO.lives;
        f.inGame = true;
        f.dead = false;
        f.percent = 0;
      }
    },
    readyAbility: (i: number): void => {
      const f = sim().fighters[i];
      f.ab.charges = f.characterId === 'judoka' ? 2 : 1;
      f.ab.windowSpent = false;
      f.ab.pendingT = f.ab.stanceT = f.ab.whiffT = f.ab.weightT = f.ab.vanishT = 0;
    },
    forceOffstage: (i: number): void => {
      const f = sim().fighters[i];
      Object.assign(f, { x: 17, y: -2, vx: 0, vy: 0, grounded: false, support: -1, hitstun: 0, jumps: 2, hover: 0, attack: null, dodge: null });
    },
    koEdge: (i: number): void => {
      const f = sim().fighters[i];
      Object.assign(f, { x: KO.maxX - 1, y: 4, vx: 8, vy: 0, grounded: false, support: -1, hitstun: 0, hover: 0, attack: null, dodge: null });
    },
    launch: (i: number, vx: number, vy: number): void => {
      const f = sim().fighters[i];
      Object.assign(f, { vx, vy, grounded: false, support: -1, hitstun: 0.6, hitstunTotal: 0.6 });
    }
  };
  (window as unknown as Record<string, unknown>).__fighterLab = api;

  sep('Giocatori');
  for (const n of [2, 3, 4, 5]) btn(String(n), () => void restart(n));
  sep('P1');
  for (const c of CHAR_IDS) btn(c.toUpperCase().slice(0, 4), () => void restart(count, c));
  sep('Bersaglio');
  btn('P1', () => (target = 0));
  btn('P2', () => (target = 1));
  btn('P3', () => (target = 2));
  sep('Danno');
  for (const p of [0, 50, 100, 150, 200]) btn(`${p}%`, () => api.setPercent(target, p));
  sep('Strumenti');
  btn('Reset vite', api.resetLives);
  btn('Fuori dal palco', () => api.forceOffstage(target));
  btn('KO imminente', () => api.koEdge(target));
  btn('Abilità pronta', () => api.readyAbility(target));
  btn('Hitbox (H)', () => {
    boxes = !boxes;
    game?.setShowBoxes(boxes);
  });
  btn('Bot ON/OFF', () => {
    bots = !bots;
    void restart(count, first);
  });
  sep('Velocità');
  for (const s of [1, 0.5, 0.25]) btn(`${s}x`, () => setTimeScale(s));
  const help = document.createElement('span');
  help.textContent = `Frecce = stick · Z salto · X leggero · C pesante · V schivata · B abilità · H hitbox · corpo ${PHYS.height} m`;
  help.style.cssText = 'margin-left:auto;color:#94a3b8;font-weight:400';
  bar.appendChild(help);

  void restart(count, first);
}
