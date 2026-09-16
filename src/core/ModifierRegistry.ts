import type { ModifierDefinition } from './types';

/** Registro dei modificatori (TEMPO DIMEZZATO, CONTROLLI INVERTITI, ecc.). */
const byId = new Map<string, ModifierDefinition>();

export const ModifierRegistry = {
  register(def: ModifierDefinition): void {
    byId.set(def.id, def);
  },

  byId(id: string): ModifierDefinition | undefined {
    return byId.get(id);
  },

  all(): ModifierDefinition[] {
    return [...byId.values()];
  }
};
