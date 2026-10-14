import { narratorSettings } from '../audio/narrator/NarratorSettings';
import { narrator } from '../audio/narrator/NarratorDirector';
import { audio } from './AudioManager';
import type { AudioCategory } from './AudioManager';
import { music } from './music';
import { debugEnabled, registerDebugSection } from './debug';

/**
 * VOLUMI (host): pannello con GENERALE · MUSICA · EFFETTI · TELECRONISTA (0-100), aperto/chiuso col tasto V da qualsiasi
 * schermata (anche in pausa). Frecce ↑↓ scelgono la voce, ←→ cambiano di 5, il mouse trascina. Valori salvati nel browser
 * (stesso salvataggio di M = muto e [ ] = volume generale).
 * In debug (F3, o `?audio=1` per un riquadro fisso) c'e' anche lo stato del mixer: voci attive per bus, voci scartate dal
 * budget, ducking, picco d'uscita, tema musicale e livello, stato dell'AudioContext.
 */
const ROWS: { cat: AudioCategory; label: string }[] = [
  { cat: 'master', label: 'GENERALE' },
  { cat: 'music', label: 'MUSICA' },
  { cat: 'sfx', label: 'EFFETTI' },
  { cat: 'voice', label: 'TELECRONISTA' }
];

let panel: HTMLDivElement | null = null;
let sel = 0;

function render(): void {
  if (!panel) return;
  const prefs=narratorSettings.get();
  panel.innerHTML = `<div style="font:900 20px Arial Black,Arial;margin-bottom:10px">🔊 VOLUMI <span style="font:700 12px Arial;color:#94a3b8">V chiudi · ↑↓ scegli · ←→ regola · M muto</span></div>${ROWS.map(
    (r, i) =>
      `<label style="display:flex;align-items:center;gap:10px;margin:8px 0;padding:6px 8px;border-radius:8px;${i === sel ? 'background:#1e293b;outline:2px solid #fbbf24' : ''}"><span style="width:130px;font:800 14px Arial">${r.label}</span><input data-cat="${r.cat}" type="range" min="0" max="100" step="1" value="${Math.round(audio.getVolume(r.cat) * 100)}" style="flex:1"><b style="width:40px;text-align:right">${Math.round(audio.getVolume(r.cat) * 100)}</b></label>`
  ).join('')}<fieldset style="border:1px solid #475569;border-radius:10px;margin:14px 0 0;padding:12px" data-narrator><legend>🎙️ NARRATORE BASTARDO</legend><label><input data-nar="enabled" type="checkbox" ${prefs.enabled?'checked':''}> Narratore ON</label><label style="display:flex;gap:12px;align-items:center;margin:12px 0">Volume <input data-nar="volume" type="range" min="0" max="100" value="${Math.round(prefs.volume*100)}" style="flex:1"><b>${Math.round(prefs.volume*100)}</b></label><label><input data-nar="subtitles" type="checkbox" ${prefs.subtitles?'checked':''}> Sottotitoli</label><label style="display:block;margin:12px 0">Frequenza <select data-nar="frequency" style="margin-left:10px;padding:6px"><option value="normal" ${prefs.frequency==='normal'?'selected':''}>Normale</option><option value="chatty" ${prefs.frequency==='chatty'?'selected':''}>Chiacchierone</option></select></label><button data-nar="skip" style="padding:8px 12px;border-radius:8px">Salta battuta · SPAZIO</button></fieldset>${audio.isMuted() ? '<div style="color:#f87171;font:800 13px Arial">🔇 AUDIO OFF (M per riattivare)</div>' : ''}`;
  panel.querySelectorAll<HTMLInputElement>('input[data-cat]').forEach((el) => {
    el.addEventListener('input', () => {
      audio.setVolume(el.dataset.cat as AudioCategory, Number(el.value) / 100);
      const b = el.parentElement?.querySelector('b');
      if (b) b.textContent = el.value;
    });
  });
  panel.querySelectorAll<HTMLInputElement>('[data-nar=enabled],[data-nar=subtitles]').forEach(el=>el.onchange=()=>narratorSettings.set({[el.dataset.nar!]:el.checked}));
  const volume=panel.querySelector<HTMLInputElement>('[data-nar=volume]');if(volume)volume.oninput=()=>{narratorSettings.set({volume:Number(volume.value)/100});volume.parentElement!.querySelector('b')!.textContent=volume.value;};
  const frequency=panel.querySelector<HTMLSelectElement>('[data-nar=frequency]');if(frequency)frequency.onchange=()=>narratorSettings.set({frequency:frequency.value==='chatty'?'chatty':'normal'});
  panel.querySelector<HTMLButtonElement>('[data-nar=skip]')!.onclick=()=>narrator.skip();
}

function toggle(): void {
  if (panel) {
    panel.remove();
    panel = null;
    audio.ui('cancel');
    return;
  }
  panel = document.createElement('div');
  panel.id = 'audio-settings';
  panel.style.cssText =
    'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:95000;width:min(520px,92vw);padding:16px 18px;border-radius:14px;' +
    'max-height:90vh;overflow-y:auto;background:rgba(11,11,20,.96);border:2px solid #fbbf24;color:#fff;font:700 14px Arial;box-shadow:0 10px 40px rgba(0,0,0,.6)';
  document.body.appendChild(panel);
  render();
  audio.ui('confirm');
}

export function initAudioSettings(): void {
  window.addEventListener(
    'keydown',
    (e) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest?.('input[type=text],textarea,[contenteditable]')) return;
      if ((e.key === 'v' || e.key === 'V') && !e.repeat && !e.ctrlKey && !e.metaKey) {
        toggle();
        e.stopPropagation();
        return;
      }
      if (!panel) return;
      if(t?.closest('[data-narrator]')&&['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' ','Enter'].includes(e.key)){e.stopPropagation();return;}
      // pannello aperto: le frecce sono sue (il gioco sotto non le riceve)
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        sel = (sel + (e.key === 'ArrowDown' ? 1 : ROWS.length - 1)) % ROWS.length;
        audio.ui('move');
        render();
        e.stopPropagation();
        e.preventDefault();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const r = ROWS[sel];
        audio.setVolume(r.cat, audio.getVolume(r.cat) + (e.key === 'ArrowRight' ? 0.05 : -0.05));
        audio.ui('move');
        render();
        e.stopPropagation();
        e.preventDefault();
      } else if (e.key === 'Escape') {
        toggle();
        e.stopPropagation();
      }
    },
    true
  );

  if (!debugEnabled()) return;
  const lines = (): string[] => {
    const s = audio.stats();
    const v = s.voices;
    return [
      `AUDIO ${s.state}${s.muted ? ' · MUTO' : ''} · gen ${Math.round(s.master * 100)} mus ${Math.round(s.music * 100)} sfx ${Math.round(s.sfx * 100)}`,
      `voci sfx ${v.sfx} ui ${v.ui} voce ${v.voice} amb ${v.ambience} · musica ${music.activeNotes()} note · scartate ${s.dropped}`,
      `tema ${music.current() ?? '—'} liv ${music.getLevel()} · ducking ${Math.round(s.duck * 100)}% · picco ${s.peak.toFixed(2)}${s.peak >= 0.99 ? ' ⚠ CLIP' : ''}`
    ];
  };
  registerDebugSection(lines);
  // ?audio=1: riquadro audio sempre visibile (anche senza F3)
  if (new URLSearchParams(location.search).get('audio') === '1') {
    const box = document.createElement('div');
    box.id = 'audio-debug';
    box.style.cssText = 'position:fixed;right:8px;top:8px;z-index:2147483001;padding:6px 10px;border-radius:8px;background:rgba(0,0,0,.78);color:#a7f3d0;font:12px ui-monospace,Consolas,monospace;white-space:pre;pointer-events:none';
    document.body.appendChild(box);
    window.setInterval(() => (box.textContent = lines().join('\n')), 400);
  }
}
