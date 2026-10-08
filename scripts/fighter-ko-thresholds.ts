// SOGLIE DI KO per mossa (npx tsx scripts/fighter-ko-thresholds.ts): a che percentuale un colpo mette fuori un bersaglio che prova a recuperare (bot, abilita' spente).
// Serve a controllare la forma della curva: leggere mai KO, pesanti vicino al bordo intorno al 120-160%, dal centro molto piu' tardi.
import { FighterWorld } from '../src/minigames/cornicione/fighterCore';
import { place, forceAttack } from './fighter-selftest';
import { FighterBot } from '../src/minigames/cornicione/fighterBot';
import { ALL_MOVES } from '../src/minigames/cornicione/fighterData';
function koRate(moveId: string, x: number, y: number, pct: number, support = 0, N = 14, skill = 0.8): number {
  let k = 0;
  for (let s = 0; s < N; s++) {
    const m = ALL_MOVES.find((q) => q.id === moveId)!;
    let sd = s * 31 + 7; const rnd = () => ((sd = (sd * 1664525 + 1013904223) >>> 0) / 4294967296);
    const w = new FighterWorld({ ids: ['p0','p1'], characters: ['goblin','goblin'], rng: rnd, abilities: false });
    const a = w.fighters[0], v = w.fighters[1];
    place(v, x, y, y===0?0:support);
    place(a, x - m.hit.x * (x>=0?1:-1) * (m.dir==='u'?0:1), y, y===0?0:support);
    if (m.dir==='u') a.x = x;
    v.percent = pct;
    forceAttack(a, m, x>=0?1:-1);
    a.attack!.t = m.startup; a.attack!.phase = 1;
    const bot = new FighterBot('p1', rnd, skill, true);
    let died = false;
    for (let i = 0; i < 60*5; i++) {
      w.step(1/60, { p1: bot.input(w, 1/60) });
      if (w.drainEvents().some(e=>e.t==='ko' && e.victim==='p1')) { died = true; break; }
    }
    if (died) k++;
  }
  return k / N;
}
function thr(id: string, x: number, y: number, s = 0): string {
  for (let p=0;p<=300;p+=10) if (koRate(id,x,y,p,s) >= 0.5) return String(p);
  return '>300';
}
for (const [label, id, x, y, s] of [
 ['sH dal centro', 'sH', 0, 0, 0],
 ['sH a 4m dal bordo', 'sH', 9, 0, 0],
 ['sH sul bordo', 'sH', 12.5, 0, 0],
 ['uH dal suolo', 'uH', 0, 0, 0],
 ['uH dalla piattaforma alta', 'uH', 0, 7.2, 3],
 ['dH sul bordo', 'dH', 12.5, 0, 0],
 ['sL (leggero) sul bordo', 'sL', 12.5, 0, 0],
] as [string,string,number,number,number][]) console.log(label.padEnd(30), thr(id,x,y,s));
