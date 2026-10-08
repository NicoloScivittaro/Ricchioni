import type { GoblinVisualMode } from './goblinVisualMode';
let runtime: GoblinVisualMode|null=null;
export function buttafuoriVisualMode():GoblinVisualMode {
  if(runtime)return runtime;
  try {
    const query=new URLSearchParams(location.search).get('buttafuori');
    if(query==='old'||query==='new')return query;
    return sessionStorage.getItem('ricchioni.buttafuoriVisual')==='old'?'old':'new';
  } catch {return 'new';}
}
export function setButtafuoriVisualMode(mode:GoblinVisualMode):void {
  runtime=mode;
  try {sessionStorage.setItem('ricchioni.buttafuoriVisual',mode);} catch { /* private browsing */ }
}
export function buttafuoriNewEnabled():boolean {return buttafuoriVisualMode()==='new';}
