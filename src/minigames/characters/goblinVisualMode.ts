import { importedVisualSelection } from './importedVisualSelection';
import type { ImportedVisualMode } from './importedVisualSelection';
export type GoblinVisualMode = ImportedVisualMode;
const selection=importedVisualSelection('goblin');
export function goblinVisualMode():ImportedVisualMode { return selection.mode(); }
export function setGoblinVisualMode(mode:ImportedVisualMode):void { selection.set(mode); }
export function goblinNewEnabled():boolean { return goblinVisualMode()==='new'; }
