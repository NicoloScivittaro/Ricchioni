/** Simulation seconds; pause never consumes this budget. */
// Long chained courses: a full minute per shot and a hole budget that fits five players.
export const GOLF_TOURNAMENT = { holes: 3, holeSeconds: 720, aimSeconds: 60, intermission: 4,
  maxStrokes: 18, playoffAimSeconds: 20, maxHoleSeconds: 900 } as const;
