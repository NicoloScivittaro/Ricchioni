/** Variants share the kart3d family: controls, abilities and roulette history. */
export type KartTrackId = 'litorale' | 'arcobaleno' | 'sydney' | 'primo';
export const kartTrackName = (id?: KartTrackId): string => id === 'primo' ? 'RIBALTATI — PRIMO KARTING' : id === 'sydney' ? 'RIBALTATI — SYDNEY SPRINT' : id === 'arcobaleno' ? 'RIBALTATI — STRADA ARCOBALENO' : 'RIBALTATI — CIRCUITO DEL LITORALE';
export const normalizeKartTrack = (id: unknown): KartTrackId => id === 'arcobaleno' || id === 'sydney' || id === 'primo' ? id : 'litorale';
