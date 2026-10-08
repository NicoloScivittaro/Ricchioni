import type { GoblinVisualMode } from './goblinVisualMode';
let runtime: GoblinVisualMode|null=null;
export function judokaVisualMode():GoblinVisualMode {
  if(runtime)return runtime;
  try {
    const query=new URLSearchParams(location.search).get('judoka');
    if(query==='old'||query==='new')return query;
    return sessionStorage.getItem('ricchioni.judokaVisual')==='old'?'old':'new';
  } catch {return 'new';}
}
export function setJudokaVisualMode(mode:GoblinVisualMode):void {
  runtime=mode;
  try {sessionStorage.setItem('ricchioni.judokaVisual',mode);} catch { /* private browsing */ }
}
export function judokaNewEnabled():boolean {return judokaVisualMode()==='new';}
