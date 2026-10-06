import { ensureUiCss } from './uiDom';

/**
 * Overlay HTML di emergenza per l'host (sopra Phaser e sopra i canvas Babylon, che stanno a z-index 10000): errore di
 * caricamento minigioco con [RIPROVA] / [SALTA GIOCO], cosi' una serata non resta mai su schermo nero. Stile del design
 * system (ERRORE = rosso), testo umano: il dettaglio tecnico resta piccolo e solo come riferimento.
 */
let root: HTMLDivElement | null = null;

export function showMinigameError(message: string, onRetry: () => void, onSkip: () => void): void {
  hideMinigameError();
  ensureUiCss();
  const el = document.createElement('div');
  el.className = 'ui-overlay';
  el.style.zIndex = '30000';
  const box = document.createElement('div');
  box.className = 'ui-card err';
  const icon = document.createElement('div');
  icon.className = 'ui-icon';
  icon.textContent = '😵';
  const title = document.createElement('div');
  title.className = 'ui-title';
  title.style.color = 'var(--ui-danger)';
  title.textContent = 'IL GIOCO NON È PARTITO';
  const human = document.createElement('div');
  human.className = 'ui-text';
  human.textContent = 'Succede. Riprova, oppure salta questo gioco: la serata continua.';
  const msg = document.createElement('div');
  msg.className = 'ui-note';
  msg.textContent = message.split('\n')[0].slice(0, 120);
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:16px;justify-content:center;margin-top:22px;flex-wrap:wrap';
  const mk = (label: string, cls: string, fn: () => void): HTMLButtonElement => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `ui-btn ${cls}`;
    b.textContent = label;
    b.addEventListener('click', fn);
    return b;
  };
  row.append(mk('🔄 RIPROVA', 'go', onRetry), mk('⏭ SALTA GIOCO', 'warn', onSkip));
  box.append(icon, title, human, row, msg);
  el.appendChild(box);
  document.body.appendChild(el);
  root = el;
}

export function hideMinigameError(): void {
  root?.remove();
  root = null;
}
