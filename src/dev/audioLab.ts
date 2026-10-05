import { audio } from '../core/AudioManager';
import type { AnnounceEvent, UiKind } from '../core/AudioManager';
import { music } from '../core/music';
import { THEMES } from '../core/musicThemes';
import type { ThemeId } from '../core/musicThemes';
import * as fps from '../controller/fpsAudio';

/**
 * AUDIO LAB — SOLO sviluppo o `?debug=1`, aperto con `?audiolab=1`. Ogni suono del gioco a portata di click, per area
 * (GLOBALE, MUSICA, ARENA, DODGEBALL, CALCIO, PALLAVOLO, KART, SPARATORIA, MEMORIA, BOTTA AL VOLO, QUIZ, CULTURA, PERSONAGGI),
 * piu' uno STRESS (4 armi + colpi + esplosione + musica insieme) per controllare che il limiter tenga. In alto il mixer dal vivo.
 * `window.__audiolab` = { cues, play(area, nome), stress(), stats() } per i test.
 */
type Cue = [string, () => void];
const pan = [-0.7, 0, 0.7];

export function buildCues(): Record<string, Cue[]> {
  const ann = (e: AnnounceEvent): Cue => [`annuncio ${e}`, () => audio.announcer(e)];
  const ui = (k: UiKind): Cue => [`ui ${k}`, () => audio.ui(k)];
  let engineStop: (() => void) | null = null;
  return {
    GLOBALE: [
      ['3', () => audio.countdown(3)],
      ['2', () => audio.countdown(2)],
      ['1', () => audio.countdown(1)],
      ['VIA', () => audio.go()],
      ['rullo lento', () => audio.rouletteTick(0.1)],
      ['rullo veloce', () => audio.rouletteTick(1)],
      ['clunk', () => audio.rouletteClunk()],
      ...['arena', 'dodgeball', 'soccer', 'volleyball', 'kart3d', 'fps', 'memory', 'reaction', 'quiz', 'cultura'].map((g): Cue => [`sting ${g}`, () => audio.gameSting(g, g === 'fps' || g === 'kart3d')]),
      ['risultato ultimo', () => audio.resultReveal('last')],
      ['risultato medio', () => audio.resultReveal('mid')],
      ['risultato primo', () => audio.resultReveal('first')],
      ann('NEW_LEADER'),
      ann('MATCH_POINT'),
      ann('LAST_ROUND'),
      ann('FINAL_ROUND'),
      ann('SUDDEN_DEATH'),
      ann('ELIMINATION'),
      ann('GOAL'),
      ann('WINNER'),
      ...(['focus', 'move', 'confirm', 'cancel', 'error', 'lock', 'ready', 'pair', 'disconnect', 'reconnect'] as UiKind[]).map(ui)
    ],
    MUSICA: [
      ...(Object.keys(THEMES) as ThemeId[]).flatMap((t): Cue[] => [[`${t}`, () => music.play(t, 1)], [`${t} liv0`, () => music.play(t, 0)], [`${t} liv2`, () => music.play(t, 2)]]),
      ['stop', () => music.stop(0.6)]
    ],
    ARENA: [
      ['scatto', () => audio.boost()],
      ...pan.map((p): Cue => [`spinta pan ${p}`, () => audio.thump(1, p)]),
      ['bordo', () => audio.edgeWarn()],
      ['caduta', () => audio.fall()],
      ['eliminazione', () => {
        audio.fall();
        audio.thump(1.1);
        audio.duck(0.4, 500);
      }]
    ],
    DODGEBALL: [
      ['raccolta', () => audio.pickupPop()],
      ['lancio', () => audio.throwWhoosh(1)],
      ['lancio caricato', () => audio.throwWhoosh(1.35)],
      ...pan.map((p): Cue => [`rimbalzo pan ${p}`, () => audio.bounce(1, p)]),
      ['schivata', () => audio.dodge()],
      ['colpito', () => audio.thump(0.8)],
      ['eliminato', () => {
        audio.thump(1.3);
        audio.wrong();
      }]
    ],
    CALCIO: [
      ['passaggio', () => audio.kick(0.7)],
      ['tiro', () => audio.kick(1.5)],
      ['contrasto', () => audio.tackle()],
      ['GOL (sequenza)', () => {
        audio.goalNet();
        audio.crowdSwell(1);
        audio.announcer('GOAL');
        audio.whistle();
      }],
      ['folla ON', () => audio.startCrowd(1)],
      ['folla OFF', () => audio.stopCrowd()],
      ['fischio lungo', () => audio.whistle(true)]
    ],
    PALLAVOLO: [
      ['battuta', () => audio.serve()],
      ['ricezione', () => audio.bump()],
      ['SMASH', () => audio.smash()],
      ['sabbia', () => audio.sand()],
      ['punto', () => audio.pointSting()],
      ann('MATCH_POINT')
    ],
    KART: [
      ['motore 3 s', () => {
        engineStop?.();
        const e = audio.createEngine();
        e.start();
        let k = 0;
        const iv = window.setInterval(() => {
          k = Math.min(1, k + 0.03);
          e.update(k, false, 1, 0);
        }, 50);
        engineStop = () => {
          window.clearInterval(iv);
          e.stop();
        };
        window.setTimeout(() => engineStop?.(), 3000);
      }],
      ['drift liv 1', () => audio.driftLevel(1)],
      ['drift liv 2', () => audio.driftLevel(2)],
      ['drift liv 3', () => audio.driftLevel(3)],
      ['mini-turbo', () => audio.kartBoost(20)],
      ['urto piccolo', () => audio.kartBump(0.2)],
      ['urto grosso', () => audio.kartBump(1)],
      ['arrivo 1°', () => audio.kartFinish(true)],
      ['arrivo', () => audio.kartFinish(false)]
    ],
    SPARATORIA: [
      ...['mitraglia', 'spaccatutto', 'laser', 'raffica', 'bombarda', 'sparapiselli'].map((w): Cue => [`sparo ${w}`, () => fps.shot(w)]),
      ['sparo nemico lontano (sx)', () => fps.shot('mitraglia', { gain: 0.2, pan: -0.7 })],
      ['colpo a segno', () => fps.hitTick(20)],
      ['colpo pesante', () => fps.hitTick(50)],
      ['KILL', () => fps.kill()],
      ['danno subito', () => fps.hurt(30)],
      ['ricarica', () => fps.reload('mitraglia', 1.4)],
      ['esplosione', () => fps.boom()]
    ],
    MEMORIA: [
      ...[0, 1, 2, 3].flatMap((i): Cue[] => [[`tessera ${i} osserva`, () => audio.tileTone(i)], [`tessera ${i} risposta`, () => audio.tileTone(i, true)]]),
      ['errore', () => audio.error()]
    ],
    'BOTTA AL VOLO': [
      ['VIA', () => audio.reactionGo()],
      ['falso allarme', () => audio.reactionFake()],
      ['falsa partenza', () => audio.falseStart()]
    ],
    QUIZ: [
      ['domanda', () => audio.quizQuestion()],
      ['tic', () => audio.quizTick(false)],
      ['tic urgente', () => audio.quizTick(true)],
      ['rivelazione', () => audio.quizReveal()],
      ann('FINAL_ROUND')
    ],
    CULTURA: [
      ['domanda', () => audio.culturaQuestion()],
      ['cazzata', () => audio.bluffReveal(false)],
      ['cazzata di Ciro', () => audio.bluffReveal(true)],
      ['risposta vera', () => audio.culturaCorrect()],
      ['secchione', () => audio.culturaRole('secchione')],
      ['avvocato', () => audio.culturaRole('avvocato')]
    ],
    PERSONAGGI: ['goblin', 'buttafuori', 'judoka', 'dottore', 'ciro'].flatMap((c): Cue[] => [[`${c} abilita'`, () => audio.characterSting(c)], [`${c} battuta`, () => audio.characterSting(c, true)]])
  };
}

/** Caos massimo realistico: 4 armi della Sparatoria a raffica + colpi + un'esplosione + musica. Il limiter deve tenere. */
export function stress(): void {
  music.play('fps', 2);
  const weapons = ['mitraglia', 'raffica', 'spaccatutto', 'laser'];
  for (let i = 0; i < 24; i++) {
    window.setTimeout(() => {
      for (let w = 0; w < 4; w++) if (audio.reserveVoice('sfx', 0.12)) fps.shot(weapons[w], { gain: 0.42, pan: [-0.6, -0.2, 0.2, 0.6][w] });
      if (i % 3 === 0) fps.hitTick(30);
      if (i % 5 === 0) audio.thump(1.2);
      if (i === 10) fps.boom();
    }, i * 60);
  }
}

export function openAudioLab(): void {
  audio.unlock();
  const cues = buildCues();
  const wrap = document.createElement('div');
  wrap.id = 'audio-lab';
  wrap.style.cssText = 'position:fixed;inset:0;z-index:2147480000;background:#0f1320;color:#e5e7eb;overflow:auto;padding:12px 16px;font:700 13px Arial';
  const meter = document.createElement('pre');
  meter.style.cssText = 'margin:0 0 10px;padding:8px 10px;background:#000;color:#a7f3d0;border-radius:8px;font:12px ui-monospace,Consolas,monospace';
  wrap.innerHTML = '<div style="font:900 22px Arial Black,Arial;margin-bottom:8px">🎧 AUDIO LAB</div>';
  wrap.append(meter);
  const close = document.createElement('button');
  close.textContent = '✕ CHIUDI';
  close.style.cssText = 'position:fixed;right:16px;top:12px;font:800 12px Arial;padding:6px 10px;border-radius:8px;border:0;background:#1e293b;color:#fff;cursor:pointer';
  close.onclick = () => {
    music.stop(0.3);
    wrap.remove();
  };
  wrap.append(close);
  const st = document.createElement('button');
  st.textContent = '💥 STRESS: 4 armi + colpi + esplosione + musica';
  st.style.cssText = 'font:800 13px Arial;padding:8px 12px;border-radius:8px;border:0;background:#7f1d1d;color:#fff;cursor:pointer;margin-bottom:10px';
  st.onclick = stress;
  wrap.append(st);
  for (const [area, list] of Object.entries(cues)) {
    const h = document.createElement('div');
    h.textContent = area;
    h.style.cssText = 'font:900 15px Arial Black,Arial;color:#fbbf24;margin:10px 0 4px';
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px';
    for (const [label, fn] of list) {
      const b = document.createElement('button');
      b.textContent = label;
      b.style.cssText = 'font:700 12px Arial;padding:6px 9px;border-radius:7px;border:0;background:#1e293b;color:#e5e7eb;cursor:pointer';
      b.onclick = () => {
        audio.unlock();
        fn();
      };
      row.append(b);
    }
    wrap.append(h, row);
  }
  document.body.appendChild(wrap);
  let peakHold = 0;
  window.setInterval(() => {
    const s = audio.stats();
    peakHold = Math.max(peakHold * 0.96, s.peak);
    meter.textContent = `AudioContext ${s.state} · tema ${music.current() ?? '—'} liv ${music.getLevel()} · note musica ${music.activeNotes()}\nvoci ${JSON.stringify(s.voices)} · scartate ${s.dropped} · ducking ${Math.round(s.duck * 100)}% · picco ${s.peak.toFixed(2)} (max ${peakHold.toFixed(2)})${peakHold >= 0.99 ? ' ⚠ CLIP' : ''}`;
  }, 150);
  (window as unknown as Record<string, unknown>).__audiolab = {
    ready: true,
    cues: Object.fromEntries(Object.entries(cues).map(([a, l]) => [a, l.map((c) => c[0])])),
    play: (area: string, name: string) => cues[area]?.find((c) => c[0] === name)?.[1](),
    stress,
    stats: () => ({ ...audio.stats(), music: music.current(), notes: music.activeNotes() })
  };
}
