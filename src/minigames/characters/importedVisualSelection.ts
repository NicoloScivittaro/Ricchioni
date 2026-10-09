/** Gallery choices are isolated from normal matches. No Babylon or asset download in this module. */
export type ImportedVisualMode = 'old' | 'new';
export function importedVisualSelection(character:string) {
  let runtime:ImportedVisualMode|null=null;
  const valid=(value:string|null):ImportedVisualMode|null=>value==='old'||value==='new'?value:null;
  return {
    mode():ImportedVisualMode {
      try {
        const params=new URLSearchParams(location.search);
        const dev=import.meta.env?.DEV===true;
        const compare=params.get('debug')==='1'||(dev&&(params.get('characters')==='1'||params.has(character)));
        if(!compare)return 'new';
        return runtime ?? valid(params.get(character)) ?? valid(sessionStorage.getItem(`ricchioni.${character}Visual`)) ?? 'new';
      } catch { return 'new'; }
    },
    set(mode:ImportedVisualMode):void {
      runtime=mode;
      try { sessionStorage.setItem(`ricchioni.${character}Visual`,mode); } catch { /* private browsing */ }
    }
  };
}
