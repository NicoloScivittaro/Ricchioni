import {loadingScreen} from '../core/loadingScreen';
/** The canvas stays covered until both geometry and an authoritative camera pose exist. */
export function fpsLoading(parent:HTMLElement,map:string):HTMLDivElement {
  const el=loadingScreen(parent,map.toUpperCase());el.classList.add('fps-world-loading');if(parent!==document.body)el.style.position='absolute';return el;
}
