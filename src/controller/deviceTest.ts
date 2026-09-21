import type { Socket } from 'socket.io-client';
import { EVT } from '../../shared/protocol';
import { audio } from '../core/AudioManager';
import { getQualityInfo } from '../core/quality';

/**
 * DEVICE TEST — pagina di prova per un telefono VERO (solo con `?debug=1`; `&devicetest=1` la apre da sola).
 * In 2 minuti si controlla: FPS reali, scala di rendering (test 3D), preset di qualita', latenza del tocco, ping, AudioContext
 * (con TEST AUDIO), vibrazione (TEST VIBRAZIONE), multitouch (joystick + pulsanti insieme), orientamento e GPU.
 * Non tocca il gioco: e' un overlay a schermo intero, con la sua pulizia (chiudi = ferma timer, rAF e contesto WebGL).
 */
export function openDeviceTest(socket: Socket): void {
  if (document.getElementById('device-test')) return;
  const root = document.createElement('div');
  root.id = 'device-test';
  root.style.cssText =
    'position:fixed;inset:0;z-index:100000;background:#0b0b14;color:#e5e7eb;font:13px/1.4 ui-monospace,Menlo,Consolas,monospace;' +
    'overflow:auto;-webkit-overflow-scrolling:touch;padding:10px 12px calc(16px + env(safe-area-inset-bottom));touch-action:pan-y;';
  root.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
      <b style="font-size:17px;color:#fbbf24">DEVICE TEST</b>
      <button id="dt-close" style="font:800 14px sans-serif;padding:8px 14px;border-radius:10px;border:0;background:#374151;color:#fff">CHIUDI ✕</button>
    </div>
    <pre id="dt-info" style="margin:0 0 10px;padding:8px;background:#111827;border-radius:10px;white-space:pre-wrap"></pre>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
      <button id="dt-audio" class="dt-b">🔊 TEST AUDIO</button>
      <button id="dt-vib" class="dt-b">📳 TEST VIBRAZIONE</button>
      <button id="dt-3d" class="dt-b">🎮 TEST 3D (scala 1)</button>
      <button id="dt-orient" class="dt-b">🔄 ORIENTAMENTO</button>
    </div>
    <div id="dt-audio-out" style="margin:4px 0;font-weight:700"></div>
    <div id="dt-vib-out" style="margin:4px 0;font-weight:700"></div>
    <canvas id="dt-gl" width="10" height="10" style="display:none;width:100%;height:120px;border-radius:10px;background:#000"></canvas>
    <div id="dt-3d-out" style="margin:4px 0"></div>
    <div style="margin:10px 0 4px;color:#9ca3af">TOUCH: tieni un dito sul PAD (joystick) e tocca A e B insieme</div>
    <div style="display:flex;gap:8px;height:150px;touch-action:none">
      <div id="dt-pad" style="flex:2;background:#1f2937;border-radius:14px;position:relative;touch-action:none;display:flex;align-items:center;justify-content:center;color:#6b7280">PAD / JOYSTICK</div>
      <div id="dt-a" style="flex:1;background:#7f1d1d;border-radius:14px;display:flex;align-items:center;justify-content:center;font:900 26px sans-serif;touch-action:none">A</div>
      <div id="dt-b2" style="flex:1;background:#1e3a8a;border-radius:14px;display:flex;align-items:center;justify-content:center;font:900 26px sans-serif;touch-action:none">B</div>
    </div>
    <pre id="dt-touch" style="margin:8px 0 0;padding:8px;background:#111827;border-radius:10px;white-space:pre-wrap"></pre>
    <style>#device-test .dt-b{font:800 14px sans-serif;padding:14px 8px;border-radius:12px;border:0;background:#4f46e5;color:#fff}#device-test .dt-b:active{filter:brightness(1.2)}</style>`;
  document.body.appendChild(root);
  const $ = <T extends HTMLElement>(id: string): T => root.querySelector('#' + id) as T;

  // ---- misure continue ----
  let frames = 0;
  let worst = 0;
  let last = performance.now();
  let fps = 0;
  let worstShown = 0;
  let raf = requestAnimationFrame(function tick(now: number) {
    frames++;
    worst = Math.max(worst, now - last);
    last = now;
    raf = requestAnimationFrame(tick);
  });
  let ping: number | null = null;
  const doPing = (): void => {
    if (!socket.connected) {
      ping = null;
      return;
    }
    const t0 = performance.now();
    socket.emit(EVT.debugPing, undefined, () => (ping = Math.round(performance.now() - t0)));
  };
  doPing();
  const pingTimer = window.setInterval(doPing, 2000);

  // ---- touch ----
  const active = new Map<number, { x: number; y: number; target: string }>();
  const lat: number[] = [];
  let maxTouches = 0;
  let downCount = 0;
  const targetName = (el: EventTarget | null): string => (el as HTMLElement | null)?.id?.replace('dt-b2', 'B').replace('dt-a', 'A').replace('dt-pad', 'PAD') || '-';
  const onDown = (e: PointerEvent): void => {
    if (!(e.target as HTMLElement).closest('#dt-pad,#dt-a,#dt-b2')) return;
    const l = performance.now() - e.timeStamp;
    if (l >= 0 && l < 2000) lat.push(l);
    if (lat.length > 40) lat.shift();
    downCount++;
    active.set(e.pointerId, { x: Math.round(e.clientX), y: Math.round(e.clientY), target: targetName((e.target as HTMLElement).closest('#dt-pad,#dt-a,#dt-b2')) });
    maxTouches = Math.max(maxTouches, active.size);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: PointerEvent): void => {
    const a = active.get(e.pointerId);
    if (a) {
      a.x = Math.round(e.clientX);
      a.y = Math.round(e.clientY);
    }
  };
  const onUp = (e: PointerEvent): void => void active.delete(e.pointerId);
  root.addEventListener('pointerdown', onDown);
  root.addEventListener('pointermove', onMove);
  root.addEventListener('pointerup', onUp);
  root.addEventListener('pointercancel', onUp);

  // ---- 3D (WebGL grezzo: nessun Babylon, nessun peso in piu') ----
  let glRun = false;
  let glRaf = 0;
  let glScale = 1;
  let gpu = 'n/d';
  let glFps = 0;
  let glBuf = '-';
  const canvas = $<HTMLCanvasElement>('dt-gl');
  const startGl = (): void => {
    const gl = canvas.getContext('webgl');
    if (!gl) {
      $('dt-3d-out').textContent = 'WebGL NON disponibile ❌';
      return;
    }
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (ext) gpu = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL));
    const vs = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
    const fs =
      'precision mediump float;uniform float t;uniform vec2 r;void main(){vec2 u=gl_FragCoord.xy/r;float v=0.;for(int i=0;i<24;i++){float f=float(i)+1.;v+=sin(u.x*f*3.+t*f*.3)*cos(u.y*f*2.-t*.7);}' +
      'gl_FragColor=vec4(.5+.5*sin(v+t),.5+.5*cos(v*.7),.5+.5*sin(v*1.3-t),1.);}';
    const sh = (type: number, src: string): WebGLShader => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(prog);
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    let n = 0;
    let t0 = performance.now();
    const draw = (now: number): void => {
      if (!glRun) return;
      const w = Math.max(2, Math.round(canvas.clientWidth * (window.devicePixelRatio || 1) * glScale));
      const h = Math.max(2, Math.round(canvas.clientHeight * (window.devicePixelRatio || 1) * glScale));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl.viewport(0, 0, w, h);
      gl.uniform1f(gl.getUniformLocation(prog, 't'), now / 1000);
      gl.uniform2f(gl.getUniformLocation(prog, 'r'), w, h);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      n++;
      if (now - t0 >= 1000) {
        glFps = Math.round((n * 1000) / (now - t0));
        n = 0;
        t0 = now;
      }
      glBuf = `${w}x${h}`;
      glRaf = requestAnimationFrame(draw);
    };
    glRaf = requestAnimationFrame(draw);
  };
  $('dt-3d').addEventListener('click', () => {
    if (!glRun) {
      glRun = true;
      canvas.style.display = 'block';
      glScale = 1;
      startGl();
    } else {
      glScale = glScale === 1 ? 0.75 : glScale === 0.75 ? 0.5 : 1; // ogni tocco cambia la scala: si vede quanto cambiano gli FPS
    }
    $('dt-3d').textContent = `🎮 3D: scala ${glScale} (tocca per cambiare)`;
  });

  // ---- audio / vibrazione / orientamento ----
  $('dt-audio').addEventListener('click', () => {
    audio.unlock();
    audio.select(); // suono UI
    window.setTimeout(() => {
      audio.thump(1); // suoni di gioco: colpo + calcio
      audio.kick(1);
    }, 350);
    window.setTimeout(() => {
      const st = audio.getState();
      const ok = st === 'running';
      const out = $('dt-audio-out');
      out.textContent = ok ? `AUDIO UNLOCKED ✅ (${st})` : `AUDIO BLOCCATO ❌ (${st}) — tocca ancora, controlla volume e tasto silenzioso`;
      out.style.color = ok ? '#4ade80' : '#f87171';
    }, 450);
  });
  $('dt-vib').addEventListener('click', () => {
    const out = $('dt-vib-out');
    const supported = typeof navigator.vibrate === 'function';
    let res: boolean | null = null;
    try {
      res = supported ? navigator.vibrate(100) : null;
    } catch {
      res = false;
    }
    out.textContent = supported ? `SUPPORTED ✅ (vibrate(100) → ${res})` : 'UNSUPPORTED ❌ (iOS Safari non ha navigator.vibrate)';
    out.style.color = supported ? '#4ade80' : '#f87171';
  });
  $('dt-orient').addEventListener('click', async () => {
    try {
      const so = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
      await so.lock?.(so.type.startsWith('portrait') ? 'landscape' : 'portrait');
    } catch {
      /* il blocco dell'orientamento richiede schermo intero: basta ruotare il telefono a mano */
    }
  });

  // ---- pannello informazioni ----
  const render = (): void => {
    const now = performance.now();
    fps = Math.round((frames * 1000) / Math.max(1, now - lastRender));
    worstShown = Math.round(worst);
    frames = 0;
    worst = 0;
    lastRender = now;
    const q = getQualityInfo();
    const avg = lat.length ? lat.reduce((a, b) => a + b, 0) / lat.length : null;
    const st = audio.getState();
    const so = screen.orientation;
    $('dt-info').textContent = [
      `FPS pagina        ${fps}   (frame peggiore ${worstShown} ms)`,
      `3D grezzo         ${glRun ? `${glFps} fps · buffer ${glBuf} · scala ${glScale}` : 'premi TEST 3D'}`,
      `qualita' preset   ${q.level}${q.auto ? ' (auto)' : ' (manuale)'} · scala 3D di gioco ${q.scale.toFixed(2)}`,
      `ping server       ${ping === null ? '—' : ping + ' ms'}   rete ${socket.connected ? 'ok' : 'OFFLINE'}`,
      `latenza tocco     ${avg === null ? '— (tocca il PAD)' : avg.toFixed(0) + ' ms'}`,
      `AudioContext      ${st === 'running' ? 'attivo' : st === 'none' ? 'non creato' : 'BLOCCATO (' + st + ')'}`,
      `vibrazione        ${typeof navigator.vibrate === 'function' ? 'supportata' : 'NON supportata'}`,
      `orientamento      ${so ? so.type + ' ' + so.angle + '°' : 'n/d'} · finestra ${innerWidth}x${innerHeight} · dpr ${window.devicePixelRatio}`,
      `GPU               ${gpu}${gpu === 'n/d' ? ' (premi TEST 3D)' : ''}`,
      `touch points      ${navigator.maxTouchPoints} (dichiarati dal dispositivo)`
    ].join('\n');
    const list = [...active.entries()].map(([id, a]) => `  #${id} su ${a.target} (${a.x},${a.y})`).join('\n');
    const combo = new Set([...active.values()].map((a) => a.target));
    $('dt-touch').textContent = [
      `touch attivi ${active.size} · massimo simultaneo ${maxTouches} · tocchi totali ${downCount}`,
      list || '  (nessun dito)',
      combo.has('PAD') && (combo.has('A') || combo.has('B')) ? 'MULTITOUCH OK ✅ joystick + pulsante insieme' : maxTouches >= 2 ? 'multitouch visto ✅' : 'multitouch: non ancora provato'
    ].join('\n');
  };
  let lastRender = performance.now();
  render();
  const renderTimer = window.setInterval(render, 250);

  $('dt-close').addEventListener('click', () => {
    cancelAnimationFrame(raf);
    cancelAnimationFrame(glRaf);
    glRun = false;
    window.clearInterval(pingTimer);
    window.clearInterval(renderTimer);
    (canvas.getContext('webgl') as WebGLRenderingContext | null)?.getExtension('WEBGL_lose_context')?.loseContext();
    root.remove();
  });
}
