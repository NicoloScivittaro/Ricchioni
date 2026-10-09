import pathlib
ROOT=pathlib.Path(__file__).parent.parents[2]
for ns,title in [('goblin','Goblin'),('buttafuori','Buttafuori'),('judoka','Judoka'),('ciro','Ciro')]:
    source="import { importedVisualSelection } from './importedVisualSelection';\nimport type { ImportedVisualMode } from './importedVisualSelection';\n"
    if ns=='goblin': source+='export type GoblinVisualMode = ImportedVisualMode;\n'
    source+=f"const selection=importedVisualSelection('{ns}');\n"
    source+=f"export function {ns}VisualMode():ImportedVisualMode {{ return selection.mode(); }}\n"
    source+=f"export function set{title}VisualMode(mode:ImportedVisualMode):void {{ selection.set(mode); }}\n"
    source+=f"export function {ns}NewEnabled():boolean {{ return {ns}VisualMode()==='new'; }}\n"
    (ROOT/f'src/minigames/characters/{ns}VisualMode.ts').write_text(source,encoding='utf-8')
