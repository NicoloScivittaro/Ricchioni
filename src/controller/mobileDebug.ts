import type { Socket } from 'socket.io-client';
import { EVT } from '../../shared/protocol';
import { audio } from '../core/AudioManager';
import { getQualityInfo } from '../core/quality';

/**
 * MODALITÀ TEST SUL TELEFONO (solo debug: `?debug=1` nell'URL del controller). In produzione normale non esiste:
 * nessun elemento, nessun timer, nessun rAF.
 *
 * Un riquadro in alto a sinistra (non intercetta i tocchi) mostra, aggiornato due volte al secondo:
 *   FPS della pagina · FPS/scala di rendering del 3D (solo Sparatoria) · ping verso il server · livello di qualità (auto/manuale) ·
 *   latenza del tocco (ritardo fra il tocco e il momento in cui la pagina lo elabora) · vibrazione supportata · audio sbloccato.
 * Tocco con 3 dita = mostra/nasconde (impossibile da fare per sbaglio).
 */
export function initMobileDebug(socket: Socket, get3d: () => { fps: number; scale: number } | null): void {
  try {
    if (new URLSearchParams(location.search).get('debug') !== '1') return;
  } catch {
    return;
  }

  const el = document.createElement('div');
  el.style.cssText =
    'position:fixed;left:4px;top:4px;z-index:99999;max-width:92vw;padding:5px 8px;border-radius:8px;background:rgba(0,0,0,.72);' +
    'color:#86efac;font:11px/1.35 ui-monospace,Menlo,Consolas,monospace;white-space:pre;pointer-events:none;';
  document.body.appendChild(el);

  let frames = 0;
  let worst = 0;
  let last = performance.now();
  let fps = 0;
  let worstShown = 0;
  let ping: number | null = null;
  const touch: number[] = [];

  const tick = (now: number): void => {
    frames++;
    worst = Math.max(worst, now - last);
    last = now;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  // latenza del tocco: quanto passa fra l'istante reale del tocco (event.timeStamp) e l'esecuzione del gestore
  window.addEventListener(
    'pointerdown',
    (e) => {
      const lat = performance.now() - e.timeStamp;
      if (lat >= 0 && lat < 2000) {
        touch.push(lat);
        if (touch.length > 30) touch.shift();
      }
    },
    { capture: true, passive: true }
  );

  const doPing = (): void => {
    if (!socket.connected) {
      ping = null;
      return;
    }
    const t0 = performance.now();
    socket.emit(EVT.debugPing, undefined, () => {
      ping = Math.round(performance.now() - t0);
    });
  };
  doPing();
  setInterval(doPing, 2500);

  const render = (): void => {
    const now = performance.now();
    const span = now - lastRender;
    lastRender = now;
    fps = span > 0 ? Math.round((frames * 1000) / span) : 0;
    worstShown = Math.round(worst);
    frames = 0;
    worst = 0;
    const q = getQualityInfo();
    const d3 = get3d();
    const avgTouch = touch.length ? touch.reduce((a, b) => a + b, 0) / touch.length : null;
    const maxTouch = touch.length ? Math.max(...touch) : null;
    const vib = typeof navigator.vibrate === 'function';
    const st = audio.getState();
    el.textContent = [
      `FPS ${fps} · frame max ${worstShown} ms`,
      d3 ? `3D  ${d3.fps} fps · scala ${d3.scale.toFixed(2)}` : '3D  (non attivo)',
      `ping ${ping === null ? '—' : ping + ' ms'} · rete ${socket.connected ? 'ok' : 'OFFLINE'}`,
      `qualita' ${q.level}${q.auto ? ' (auto)' : ' (manuale)'}`,
      `tocco ${avgTouch === null ? '—' : avgTouch.toFixed(0) + ' ms'} (max ${maxTouch === null ? '—' : maxTouch.toFixed(0)})`,
      `vibrazione ${vib ? 'si' : 'NO (non supportata)'} · audio ${st === 'running' ? 'attivo' : st === 'none' ? 'non creato' : 'BLOCCATO: tocca lo schermo'}`
    ].join('\n');
  };
  let lastRender = performance.now();
  render();
  setInterval(render, 500);

  window.addEventListener(
    'touchstart',
    (e) => {
      if (e.touches.length === 3) el.style.display = el.style.display === 'none' ? '' : 'none';
    },
    { passive: true }
  );
}
