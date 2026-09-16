import { goblin } from './goblin';
import { buttafuori } from './buttafuori';
import { dottore } from './dottore';
import { judoka } from './judoka';
import { ciro } from './ciro';
import type { CharacterDefinition } from './types';

export const CHARACTERS: Record<string, CharacterDefinition> = {
  goblin,
  buttafuori,
  dottore,
  judoka,
  ciro
};

/** Ordine canonico di assegnazione (1° slot = goblin, 2° = buttafuori, ...). */
export const CHARACTER_ORDER: string[] = ['goblin', 'buttafuori', 'dottore', 'judoka', 'ciro'];

export function getCharacter(id: string): CharacterDefinition {
  const c = CHARACTERS[id];
  if (!c) throw new Error(`Personaggio sconosciuto: ${id}`);
  return c;
}

export type { CharacterDefinition } from './types';
