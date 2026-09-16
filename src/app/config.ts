export const GAME_CONFIG = {
  width: 1280,
  height: 720,
  title: 'Ricchioni Party — Notte Brava',
  backgroundColor: '#0b0b14',
  /** punti necessari per la vittoria per modalità */
  winTargets: {
    VELOCE: 40,
    NORMALE: 60,
    LUNGA: 80
  } as const,
  defaultTarget: 60
} as const;
