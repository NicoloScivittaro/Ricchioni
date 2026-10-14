import base from './baseCards.json';
import personal from './personalCards.json';
import type { Card } from './types';
export const BASE_CARDS = base as Card[];
export const PERSONAL_CARDS = personal as Card[];
export const ALL_CARDS: readonly Card[] = [...BASE_CARDS, ...PERSONAL_CARDS];
export const CARD_BY_ID: Readonly<Record<string, Card>> = Object.fromEntries(ALL_CARDS.map(c => [c.id, c]));
export const GT = { main: 60, choice: 60, reaction: 60, limit: 360, maxHand: 9, traps: 2, chain: 4, resultHold: 4 } as const;
export function catalog(mode: 'base' | 'personal'): readonly Card[] { return mode === 'personal' ? ALL_CARDS : BASE_CARDS; }
export function validateCatalog(): void {
  if (BASE_CARDS.length !== 100 || PERSONAL_CARDS.length !== 25 || Object.keys(CARD_BY_ID).length !== 125) throw Error('Catalogo Goblin non valido');
  const counts = { AZIONE: 40, TRAPPOLA: 25, RISPOSTA: 20, CATASTROFE: 15 };
  for (const [type, n] of Object.entries(counts)) if (BASE_CARDS.filter(c => c.type === type).length !== n) throw Error(`Distribuzione ${type}`);
  for (const c of ALL_CARDS) if (!c.id || !c.name || !c.effect || !Object.hasOwn(counts, c.type)) throw Error(`Carta ${c.id}`);
}
validateCatalog();
