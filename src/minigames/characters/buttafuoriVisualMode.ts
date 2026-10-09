import { importedVisualSelection } from './importedVisualSelection';
import type { ImportedVisualMode } from './importedVisualSelection';
const selection=importedVisualSelection('buttafuori');
export function buttafuoriVisualMode():ImportedVisualMode { return selection.mode(); }
export function setButtafuoriVisualMode(mode:ImportedVisualMode):void { selection.set(mode); }
export function buttafuoriNewEnabled():boolean { return buttafuoriVisualMode()==='new'; }
