import type { Category, HookId, PlayerId } from '../core/types';

export type LucidityState = 'SOBRIO' | 'BRILLO' | 'GOBLIN' | 'DEVASTATO';

export interface CharacterDefinition {
  id: PlayerId;
  name: string;
  roleTitle: string;
  subtitle: string;
  avatar: string;
  image: string;
  color: string;
  quote: string;
  resourceName: string;
  resourceMax: number;
  initialResource: number;
  passive: { name: string; description: string };
  weakness: { name: string; description: string };
  /** Nome dell'abilità (per UI). */
  abilityName: string;
  abilityDescription: string;
  /** Hook situazionali per categoria: come la stessa identità si traduce in vantaggi diversi. */
  hooks: Partial<Record<Category, HookId[]>>;
  /** Hook di ripiego quando la categoria non ha una voce specifica. */
  defaultHooks: HookId[];
}
