import type { Category, MinigameDefinition } from './types';

/**
 * Registro centrale dei minigiochi.
 * Il core lo legge; i minigiochi si auto-registrano all'avvio (vedi minigames/index.ts).
 * Aggiungere un gioco = creare la cartella + implementare l'interfaccia + registrarlo:
 * nessuna altra parte del progetto cambia.
 */
const byId = new Map<string, MinigameDefinition>();

export const MinigameRegistry = {
  register(def: MinigameDefinition): void {
    byId.set(def.id, def);
  },

  all(): MinigameDefinition[] {
    return [...byId.values()];
  },

  byId(id: string): MinigameDefinition | undefined {
    return byId.get(id);
  },

  byCategory(category: Category): MinigameDefinition[] {
    return [...byId.values()].filter((d) => d.category === category);
  },

  categories(): Category[] {
    return [...new Set([...byId.values()].map((d) => d.category))];
  }
};
