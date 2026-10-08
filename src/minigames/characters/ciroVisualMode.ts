import type { GoblinVisualMode } from './goblinVisualMode';
let runtime: GoblinVisualMode|null=null;
export function ciroVisualMode():GoblinVisualMode {
  if(runtime)return runtime;
  try {
    const query=new URLSearchParams(location.search).get('ciro');
    if(query==='old'||query==='new')return query;
    return sessionStorage.getItem('ricchioni.ciroVisual')==='old'?'old':'new';
  } catch {return 'new';}
}
export function setCiroVisualMode(mode:GoblinVisualMode):void {
  runtime=mode;
  try {sessionStorage.setItem('ricchioni.ciroVisual',mode);} catch { /* private browsing */ }
}
export function ciroNewEnabled():boolean {return ciroVisualMode()==='new';}
