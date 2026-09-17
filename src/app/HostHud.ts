import { game as gm } from '../core/GameManager';
import { audio } from '../core/AudioManager';

/**
 * Overlay HTML persistente, fuori da Phaser: il minigioco kart 3D disegna il
 * proprio canvas Babylon con z-index 10000 sopra tutto (vedi
 * KartRaceScene.ts), quindi un controllo "sempre in cima e in ogni
 * minigioco" non può vivere dentro una scena Phaser — deve stare più in alto
 * di quel canvas nel DOM.
 *
 * Due pulsanti in alto a sinistra, visibili SOLO durante MINIGAME_PLAYING:
 * "Ricomincia" rilancia da capo lo stesso minigioco, "Lobby" interrompe la
 * partita e torna in lobby (punteggio azzerato, stessi giocatori).
 */
export function mountHostHud(): void {
  const root = document.createElement('div');
  root.style.cssText = `
    position: fixed; top: 10px; left: 10px; z-index: 20000;
    display: none; flex-direction: column; gap: 6px;
  `;

  const restartBtn = makeButton('🔄 Ricomincia minigioco', '#facc15', () => {
    audio.select();
    gm.restartMinigame();
  });
  const lobbyBtn = makeButton('🏠 Torna alla lobby', '#f87171', () => {
    if (gm.state?.phase !== 'MINIGAME_PLAYING') return;
    if (!confirm('Tornare alla lobby? Il punteggio della partita verrà azzerato.')) return;
    audio.select();
    gm.restartMatch();
  });

  root.append(restartBtn, lobbyBtn);
  document.body.appendChild(root);

  gm.events.on('state', () => {
    root.style.display = gm.state?.phase === 'MINIGAME_PLAYING' ? 'flex' : 'none';
  });
}

function makeButton(label: string, color: string, onClick: () => void): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = label;
  btn.style.cssText = `
    padding: 8px 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.28);
    background: rgba(8,10,18,0.8); color: ${color}; font: 700 13px/1.2 Arial, sans-serif;
    cursor: pointer; pointer-events: auto; box-shadow: 0 2px 8px rgba(0,0,0,0.4);
  `;
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    onClick();
  });
  return btn;
}
