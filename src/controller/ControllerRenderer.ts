import type { ControlDef, ControllerLayout, InputEvent } from '../../shared/types';

export type SendInput = (ev: InputEvent) => void;

/**
 * Controller renderer schema-driven: riceve il layout dichiarato dal minigioco
 * e genera i controlli sul telefono. Nessun controller custom per ogni gioco.
 */
export function renderController(root: HTMLElement, layout: ControllerLayout, send: SendInput): void {
  root.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'ctl';

  if (layout.type === 'buttons') {
    const grid = document.createElement('div');
    grid.className = 'btn-grid';
    grid.style.gridTemplateColumns = `repeat(${layout.grid}, 1fr)`;
    for (const def of layout.controls) grid.appendChild(makeControl(def, send));
    wrap.appendChild(grid);
  } else if (layout.type === 'dpad') {
    wrap.appendChild(makeDpad(layout.controls, send));
  } else if (layout.type === 'racing') {
    wrap.appendChild(makeRacing(layout.controls, send));
  } else {
    const msg = document.createElement('p');
    msg.className = 'sub';
    msg.textContent = `Layout "${layout.type}" non ancora supportato su controller`;
    wrap.appendChild(msg);
  }

  root.appendChild(wrap);
}

/** Costruisce una croce direzionale 3×3 + eventuali tasti extra sotto. */
function makeDpad(controls: ControlDef[], send: SendInput): HTMLElement {
  const dirPos: Record<string, [number, number]> = {
    up: [0, 1],
    down: [2, 1],
    left: [1, 0],
    right: [1, 2]
  };
  const cells: (ControlDef | null)[] = new Array(9).fill(null);
  const extra: ControlDef[] = [];

  for (const def of controls) {
    const pos = dirPos[def.id];
    if (pos) cells[pos[0] * 3 + pos[1]] = def;
    else extra.push(def);
  }

  const wrap = document.createElement('div');
  wrap.className = 'dpad-wrap';

  const grid = document.createElement('div');
  grid.className = 'dpad-grid';
  for (let i = 0; i < 9; i++) {
    const slot = document.createElement('div');
    slot.className = 'dpad-slot';
    const def = cells[i];
    if (def) slot.appendChild(makeControl(def, send));
    grid.appendChild(slot);
  }
  wrap.appendChild(grid);

  for (const def of extra) wrap.appendChild(makeControl(def, send));

  return wrap;
}

/**
 * Layout da guida: pulsanti azione extra (drift/item) in alto, sterzo +
 * freno in una riga centrale, accelerazione come grande barra in basso.
 */
function makeRacing(controls: ControlDef[], send: SendInput): HTMLElement {
  const byId = new Map(controls.map((c) => [c.id, c]));
  const wrap = document.createElement('div');
  wrap.className = 'racing-wrap';

  const extras = controls.filter((c) => !['up', 'down', 'left', 'right'].includes(c.id));
  if (extras.length > 0) {
    const extraRow = document.createElement('div');
    extraRow.className = 'racing-extras';
    for (const def of extras) {
      const btn = makeControl(def, send);
      btn.classList.add('racing-circle', 'racing-extra');
      extraRow.appendChild(btn);
    }
    wrap.appendChild(extraRow);
  }

  const midRow = document.createElement('div');
  midRow.className = 'racing-mid';
  const left = byId.get('left');
  const down = byId.get('down');
  const right = byId.get('right');
  if (left) {
    const b = makeControl(left, send);
    b.classList.add('racing-circle', 'racing-left');
    midRow.appendChild(b);
  }
  if (down) {
    const b = makeControl(down, send);
    b.classList.add('racing-circle', 'racing-brake');
    midRow.appendChild(b);
  }
  if (right) {
    const b = makeControl(right, send);
    b.classList.add('racing-circle', 'racing-right');
    midRow.appendChild(b);
  }
  wrap.appendChild(midRow);

  const up = byId.get('up');
  if (up) {
    const b = makeControl(up, send);
    b.classList.add('racing-accel');
    wrap.appendChild(b);
  }

  return wrap;
}

function makeControl(def: ControlDef, send: SendInput): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = `ctl-btn ctl-${def.id}`;
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
