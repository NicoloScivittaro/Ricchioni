import { ARENA_R, ARENA_R_MIN, SHRINK_DELAY, SHRINK_DURATION } from './arenaTypes';

// Solo sudden death: rimane spazio per cinque corpi e per dash/colpi.
export const SUDDEN_MIN_RADIUS = 3.6;
export const SUDDEN_SHRINK_SEC = 12;
export const PRESSURE_PULSE_SEC = 3;

export function arenaRadius(time: number, normalDuration: number): number {
  const normal = ARENA_R + (ARENA_R_MIN - ARENA_R) * Math.min(1, Math.max(0, time - SHRINK_DELAY) / SHRINK_DURATION);
  if (time < normalDuration) return normal;
  const atSudden = ARENA_R + (ARENA_R_MIN - ARENA_R) * Math.min(1, Math.max(0, normalDuration - SHRINK_DELAY) / SHRINK_DURATION);
  return atSudden + (SUDDEN_MIN_RADIUS - atSudden) * Math.min(1, (time - normalDuration) / SUDDEN_SHRINK_SEC);
}

/** Forza ambientale crescente: a lungo andare supera l'accelerazione verso il centro, senza azzerare gli input. */
export function arenaPressure(timeAtMinimum: number): number {
  return timeAtMinimum < 0 ? 0 : Math.min(60, 8 + timeAtMinimum * 2);
}

export interface ArenaStanding {
  id: string;
  alive: boolean;
  eliminatedAt: number;
  exitDistance: number;
  eliminations: number;
  entryOrder: number;
}

/** Sopravvivenza; per cadute nello stesso passo minor uscita dal bordo, poi spinte riuscite e ordine stabile di ingresso. */
export function compareArenaStandings(a: ArenaStanding, b: ArenaStanding): number {
  return Number(b.alive) - Number(a.alive) || b.eliminatedAt - a.eliminatedAt ||
    a.exitDistance - b.exitDistance || b.eliminations - a.eliminations || a.entryOrder - b.entryOrder;
}
