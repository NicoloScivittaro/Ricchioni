import { importedVisualSelection } from './importedVisualSelection';
import type { ImportedVisualMode } from './importedVisualSelection';
const selection=importedVisualSelection('judoka');
export function judokaVisualMode():ImportedVisualMode { return selection.mode(); }
export function setJudokaVisualMode(mode:ImportedVisualMode):void { selection.set(mode); }
export function judokaNewEnabled():boolean { return judokaVisualMode()==='new'; }
