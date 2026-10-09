import { importedVisualSelection } from './importedVisualSelection';
import type { ImportedVisualMode } from './importedVisualSelection';
const selection=importedVisualSelection('ciro');
export function ciroVisualMode():ImportedVisualMode { return selection.mode(); }
export function setCiroVisualMode(mode:ImportedVisualMode):void { selection.set(mode); }
export function ciroNewEnabled():boolean { return ciroVisualMode()==='new'; }
