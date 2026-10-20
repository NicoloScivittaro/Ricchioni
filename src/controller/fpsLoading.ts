/** The canvas stays covered until both geometry and an authoritative camera pose exist. */
export function fpsLoading(parent:HTMLElement,map:string):HTMLDivElement {
  const el=document.createElement('div');el.className='fps-world-loading';
  el.style.cssText='position:absolute;inset:0;z-index:70;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px;background:#0b121a;color:#e5edf1;font:700 18px Arial;text-align:center;padding:24px;pointer-events:none';
  el.textContent='CARICAMENTO '+map.toUpperCase()+'…';parent.appendChild(el);return el;
}
