import type { ControlDef, ControllerLayout, InputEvent } from '../../shared/types';

export type SendInput = (ev: InputEvent) => void;

/**
 * Controller renderer schema-driven: riceve il layout dichiarato dal minigioco
 * e genera i controlli sul telefono. Nessun controller custom per ogni gioco:
 * solo questo renderer + eventuali renderer 'custom' per casi speciali.
 */
export function renderController(root: HTMLElement, layout: ControllerLayout, send: SendInput): void {
  root.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'ctl';

  if (layout.type === 'buttons') {
    const grid = document.createElement('div');
    grid.className = 'btn-grid';
    grid.style.gridTemplateColumns = `repeat(${layout.grid}, 1fr)`;
    for (const def of layout.controls) {
      grid.appendChild(makeControl(def, send));
    }
    wrap.appendChild(grid);
  } else if (layout.type === 'dpad') {
    const grid = document.createElement('div');
    grid.className = 'btn-grid';
    grid.style.gridTemplateColumns = 'repeat(3, 1fr)';
    for (const def of layout.controls) {
      grid.appendChild(makeControl(def, send));
    }
    wrap.appendChild(grid);
  } else {
    const msg = document.createElement('p');
    msg.className = 'sub';
    msg.textContent = `Layout "${layout.type}" non ancora supportato su controller`;
    wrap.appendChild(msg);
  }

  root.appendChild(wrap);
}

function makeControl(def: ControlDef, send: SendInput): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = 'ctl-btn';
  b.textContent = `${def.icon ? def.icon + ' ' : ''}${def.label}`;
  if (def.color) b.style.background = def.color;

  if (def.kind === 'hold') {
    const release = (): void => send({ kind: 'up', controlId: def.id });
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      send({ kind: 'down', controlId: def.id });
    });
    b.addEventListener('pointerup', release);
    b.addEventListener('pointerleave', release);
    b.addEventListener('pointercancel', release);
  } else {
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      send({ kind: 'action', controlId: def.id });
    });
  }
  return b;
}
