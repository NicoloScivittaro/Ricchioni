/** Variants share the kart3d family: controls, abilities and roulette history. */
export type KartTrackId = 'litorale' | 'arcobaleno';
export const kartTrackName = (id?: KartTrackId): string => id === 'arcobaleno' ? 'RIBALTATI — STRADA ARCOBALENO' : 'RIBALTATI — CIRCUITO DEL LITORALE';
export const normalizeKartTrack = (id: unknown): KartTrackId => id === 'arcobaleno' ? id : 'litorale';
