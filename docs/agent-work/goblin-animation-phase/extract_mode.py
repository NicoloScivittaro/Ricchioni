"""One-time extraction: keep Babylon/GLB off the normal results/lobby dependency path."""
import pathlib
ROOT=pathlib.Path(__file__).resolve().parents[3]
p=ROOT/'src/minigames/characters/goblinVisual.ts'
s=p.read_text(encoding='utf-8');a=s.index('function queryMode()');b=s.index('/** URL effettivo',a)
mode=s[a:b].replace('true solo se il debug è consentito: in produzione la variante non si attiva mai, nemmeno con `?goblin=new`.','Opt-in only in DEV or explicit ?debug=1; normal production remains Legacy.')
(p.parent/'goblinVisualMode.ts').write_text('''/** Lightweight selection; importing this module never loads Babylon or a model. */
import { debugEnabled } from '../../core/debug';
export type GoblinVisualMode = 'old' | 'new';
const MODE_QUERY = 'goblin';
const STORE_KEY = 'ricchioni.goblinVisual';

'''+mode,encoding='utf-8')
s=s[:a]+s[b:]
s=s.replace("import { debugEnabled } from '../../core/debug';",'''import { goblinNewEnabled, goblinVisualMode } from './goblinVisualMode';
import type { GoblinVisualMode } from './goblinVisualMode';
export { goblinNewEnabled, goblinVisualMode, setGoblinVisualMode } from './goblinVisualMode';
export type { GoblinVisualMode } from './goblinVisualMode';''')
s=s.replace("export type GoblinVisualMode = 'old' | 'new';\n",'').replace("const MODE_QUERY = 'goblin';\n",'').replace("const STORE_KEY = 'ricchioni.goblinVisual';\n",'')
p.write_text(s,encoding='utf-8')
p=ROOT/'src/scenes/ResultsScene.ts';s=p.read_text(encoding='utf-8').replace("from '../minigames/characters/goblinVisual';","from '../minigames/characters/goblinVisualMode';");p.write_text(s,encoding='utf-8')
print('selection extracted; results Babylon atlas stays behind dynamic import')
