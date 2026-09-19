/**
 * Overlay HTML di emergenza per l'host (sopra Phaser e sopra i canvas Babylon,
 * che stanno a z-index 10000): errore di caricamento minigioco con
 * [RIPROVA] / [SALTA GIOCO], così una serata non resta mai su schermo nero.
 */
let root: HTMLDivElement | null = null;

export function showMinigameError(message: string, onRetry: () => void, onSkip: () => void): void {
  hideMinigameError();
  const el = document.createElement('div');
  el.style.cssText = `
    position: fixed; inset: 0; z-index: 30000; display: flex; align-items: center; justify-content: center;
    background: rgba(5,6,12,0.92); font-family: Arial, sans-serif; color: #fff;
  `;
  const box = document.createElement('div');
  box.style.cssText = `
    background: #11131f; border: 2px solid rgba(248,113,113,0.6); border-radius: 20px;
    padding: 32px 40px; max-width: 640px; text-align: center; display: flex; flex-direction: column; gap: 14px;
  `;
  const title = document.createElement('div');
  title.textContent = 'ERRORE NEL CARICAMENTO DEL MINIGIOCO';
  title.style.cssText = 'font: 900 26px "Arial Black", Arial, sans-serif; color: #f87171;';
  const msg = document.createElement('div');
  msg.textContent = message.slice(0, 200);
  msg.style.cssText = 'font-size: 14px; color: #9ca3af; word-break: break-word;';
  const row = document.createElement('div');
  row.style.cssText = 'display: flex; gap: 14px; justify-content: center; margin-top: 8px;';
  const mk = (label: string, color: string, fn: () => void): HTMLButtonElement => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.style.cssText = `padding: 14px 24px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.3);
      background: rgba(255,255,255,0.08); color: ${color}; font: 800 18px Arial, sans-serif; cursor: pointer;`;
    b.addEventListener('click', fn);
    return b;
  };
  row.append(mk('🔄 RIPROVA', '#4ade80', onRetry), mk('⏭ SALTA GIOCO', '#facc15', onSkip));
  box.append(title, msg, row);
  el.appendChild(box);
  document.body.appendChild(el);
  root = el;
}

export function hideMinigameError(): void {
  root?.remove();
  root = null;
}
