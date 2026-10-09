import { CasaCarboAnimation } from './casaCarboAnimation';
export type { CasaCarboClip as CiroCasaCarboClip } from './casaCarboAnimation';
/** Compatibility constructor for the previously integrated Ciro gestures. */
export class CiroCasaCarboAnimation extends CasaCarboAnimation {
  constructor() { super('ciro'); }
}
