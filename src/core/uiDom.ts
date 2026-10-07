import { cssVars } from './uiTokens';

/**
 * STILE COMUNE dei pannelli DOM della TV (schermata CONTROLLI, collega i controller, avvisi, errori): gli stessi token
 * dei testi Phaser e dell'HUD 3D. Le misure usano clamp(): leggibili a 720p, nitide e proporzionate fino al 4K.
 * Avvisi: WARNING ambra, ERROR rosso, RECOVERED verde — testo umano, mai stack trace.
 */
const CSS = `${cssVars()}
.ui-overlay{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(5,6,14,.9);font-family:var(--ui-body);color:var(--ui-text)}
.ui-card{width:min(860px,88vw);padding:clamp(18px,3vh,40px) clamp(22px,3vw,48px);border-radius:var(--ui-r-l);background:var(--ui-panel);border:3px solid var(--ui-accent);text-align:center}
.ui-card.warn{border-color:var(--ui-warning)}.ui-card.err{border-color:var(--ui-danger)}.ui-card.ok{border-color:var(--ui-success)}
.ui-icon{font-size:clamp(44px,8vh,96px);line-height:1}
.ui-title{font-family:var(--ui-display);font-weight:900;font-size:clamp(28px,5.4vh,64px);letter-spacing:.02em;color:var(--ui-accent);text-shadow:0 3px 8px rgba(0,0,0,.6)}
.ui-sub{margin:.35em 0 .9em;font-family:var(--ui-display);font-size:clamp(16px,2.6vh,30px);letter-spacing:.12em;color:var(--ui-info)}
.ui-big{margin:.6em 0 .3em;font-family:var(--ui-display);font-size:clamp(30px,6vh,72px);color:var(--ui-text)}
.ui-text{font-size:clamp(16px,2.4vh,28px);color:var(--ui-dim);font-weight:700}
.ui-note{margin-top:.8em;font-size:clamp(14px,2vh,22px);color:var(--ui-muted);font-weight:700}
.ui-keys{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:clamp(8px,1.4vh,16px);margin-top:.4em}
.ui-key{display:flex;flex-direction:column;align-items:center;gap:.35em;padding:clamp(10px,1.8vh,20px) 12px;border-radius:var(--ui-r-m);background:var(--ui-panel-strong);border:2px solid var(--ui-line)}
.ui-cap{min-width:3.4em;padding:.2em .6em;border-radius:.5em;background:#e5e7eb;color:#0b0b14;font-family:var(--ui-display);font-size:clamp(20px,3.4vh,40px);box-shadow:0 4px 0 #6b7280;white-space:nowrap}
.ui-act{font-family:var(--ui-display);font-size:clamp(18px,3vh,34px);color:var(--ui-text)}
.ui-bar{height:8px;margin-top:clamp(14px,2.4vh,26px);border-radius:4px;background:var(--ui-line);overflow:hidden}
.ui-bar i{display:block;height:100%;width:100%;background:var(--ui-accent);transform-origin:left;animation:ui-shrink linear forwards}
@keyframes ui-shrink{from{transform:scaleX(1)}to{transform:scaleX(0)}}
.ui-btn{font-family:var(--ui-display);font-size:clamp(16px,2.4vh,26px);padding:.55em 1.1em;border-radius:var(--ui-r-m);border:2px solid var(--ui-line);background:var(--ui-panel-strong);color:var(--ui-text);cursor:pointer}
.ui-btn.go{background:var(--ui-success);border-color:var(--ui-success);color:#062012}.ui-btn.warn{color:var(--ui-warning)}
.ui-toast{padding:.5em 1.1em;border-radius:var(--ui-r-m);background:rgba(11,11,20,.94);border:2px solid var(--ui-line);color:var(--ui-text);font-family:var(--ui-display);font-size:clamp(16px,2.6vh,28px);animation:ui-in .22s cubic-bezier(.2,1.4,.4,1)}
.ui-toast.warn{border-color:var(--ui-warning);color:#fde68a}.ui-toast.err{border-color:var(--ui-danger);color:#fecaca}.ui-toast.ok{border-color:var(--ui-success);color:#bbf7d0}
@keyframes ui-in{from{transform:translateY(-12px) scale(.92);opacity:0}to{transform:none;opacity:1}}
.ui-alert{position:fixed;left:50%;transform:translateX(-50%);top:3vh;padding:.45em 1.2em;border-radius:var(--ui-r-m);font-family:var(--ui-display);font-size:clamp(16px,2.6vh,30px);background:rgba(11,11,20,.95);border:3px solid var(--ui-danger);color:#fecaca}
.ui-alert.warn{border-color:var(--ui-warning);color:#fde68a}
`;

let done = false;

/** Inserisce il foglio comune una sola volta (idempotente). */
export function ensureUiCss(): void {
  if (done || typeof document === 'undefined') return;
  done = true;
  const st = document.createElement('style');
  st.id = 'ui-design-system';
  st.textContent = CSS;
  document.head.appendChild(st);
}
