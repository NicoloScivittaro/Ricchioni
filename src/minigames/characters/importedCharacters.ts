import { GOBLIN_CLIPS, GOBLIN_LODS } from './goblinAnimator';
import { BUTTAFUORI_PROFILE } from './buttafuoriProfile';
import { JUDOKA_PROFILE } from './judokaProfile';
import { CIRO_PROFILE } from './ciroProfile';
import { goblinNewEnabled } from './goblinVisualMode';
import { buttafuoriNewEnabled } from './buttafuoriVisualMode';
import { judokaNewEnabled } from './judokaVisualMode';
import { ciroNewEnabled } from './ciroVisualMode';
import type { ImportedCharacterProfile } from './goblinVisual';

const profiles:Readonly<Record<string,ImportedCharacterProfile>>={
  goblin:{namespace:'goblin',url:GOBLIN_LODS.LOD0.url,clips:GOBLIN_CLIPS},
  buttafuori:BUTTAFUORI_PROFILE,judoka:JUDOKA_PROFILE,ciro:CIRO_PROFILE
};
const enabled:Readonly<Record<string,()=>boolean>>={goblin:goblinNewEnabled,buttafuori:buttafuoriNewEnabled,judoka:judokaNewEnabled,ciro:ciroNewEnabled};
/** A single profile lookup for full bodies and seated drivers; unsupported characters retain their render. */
export function importedCharacterProfile(id:string|null):ImportedCharacterProfile|null {
  return id&&Object.prototype.hasOwnProperty.call(profiles,id)?profiles[id]:null;
}
export function importedCharacterEnabled(id:string|null):boolean {
  return !!id && Object.prototype.hasOwnProperty.call(enabled,id) && enabled[id]();
}
