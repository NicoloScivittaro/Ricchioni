import type { PlayerId } from '../../../shared/types';

/** I 6 oggetti originali (nessun riferimento Nintendo). */
export type ItemId = 'turbo' | 'sfera' | 'olio' | 'scudo' | 'super_turbo' | 'disturbo';

export interface KartState {
  playerId: PlayerId;
  characterId: string | null;
  colorHex: string;
  avatar: string;

  distance: number; // progresso totale non wrappato (per giri + classifica)
  lateral: number; // offset laterale dal centro pista (m)
  absHeading: number; // imbardata assoluta persistente (rad) — NON si resetta con la tangente locale
  heading: number; // derivato ogni frame: absHeading - angolo tangente pista (per rendering/telecamera)
  speed: number; // velocità lungo il percorso (unità/s)

  lap: number;
  nextCheckpoint: number;
  finished: boolean;
  finishTime: number;
  placement: number;

  offRoad: boolean;
  drifting: boolean;
  driftDir: -1 | 0 | 1;
  driftCharge: number;

  boostTimer: number;
  boostPower: number; // moltiplicatore extra di velocità durante il boost

  heldItem: ItemId | null;
  shielded: boolean;
  disturbTimer: number; // sterzo invertito temporaneo (colpito da "disturbo")
  stunTimer: number; // spin-out dopo un colpo
  invulnTimer: number; // breve invulnerabilità post-respawn/scudo

  offTrackTimer: number; // tempo continuo fuori pista/bloccato
  respawnTimer: number; // countdown prima del respawn effettivo
  lastValidCheckpointS: number; // posizione s dell'ultimo checkpoint valido (per respawn)

  steerVisual: number; // sterzo smussato per la rotazione visiva delle ruote anteriori (-1..1)
  wheelSpin: number; // angolo accumulato di rotolamento ruote (rad)

  // --- Sistema abilità personaggio (una gimmick unica per personaggio, non bonus statistici) ---
  abilityMeter: number; // 0..1, si riempie giocando bene: drift puliti, sorpassi, item evitati, checkpoint puliti
  abilityCharges: number; // Buttafuori/Ciro: 1 carica fissa per gara, NON si ricarica col meter
  abilityActive: boolean; // finestra generica attiva (Goblin "SO GUIDARE IO", Dottore "20 KG IN UN MESE")
  abilityTimer: number; // durata residua della finestra attiva
  lastAbilityPressAt: number; // raceTime dell'ultima pressione del tasto ABILITÀ (usato da Ciro)

  // Goblin — SO GUIDARE IO: drift ben caricati producono mini-turbo più potenti,
  // finché non sbatte o esce di pista (allora l'effetto si annulla in anticipo).
  driftBoostMultiplier: number; // 1 = normale

  // Dottore — 20 KG IN UN MESE: kart leggerissimo (accelera meglio, deriva
  // facile) ma molto più vulnerabile agli urti degli avversari.
  lightMode: boolean;
  accelMultiplier: number; // 1 = normale
  driftChargeRateMultiplier: number; // 1 = normale

  // Judoka — MI SO' CADUTI GLI OCCHIALI!: rallenta temporaneamente i rivali
  // vicini davanti a sé (speedCapMultiplier/speedCapTimer, letti dalla fisica
  // senza sapere "perché"), poi verifica se ne ha superato almeno uno.
  speedCapMultiplier: number; // 1 = normale
  speedCapTimer: number; // durata residua del rallentamento subito (se bersaglio di Judoka)
  judokaPending: boolean; // in attesa dell'esito del proprio tentativo
  judokaResolveTimer: number;
  judokaTargets: PlayerId[];

  // Ciro — PAGO DOPO: posticipa l'effetto di un item subito; scade dopo
  // qualche secondo e la penalità viene applicata comunque ("DEBITO").
  debtPending: boolean;
  debtTimer: number;
  debtStun: number;
  debtDisturb: number;
}

export function createKartState(playerId: PlayerId, characterId: string | null, colorHex: string, avatar: string): KartState {
  return {
    playerId,
    characterId,
    colorHex,
    avatar,
    distance: 0,
    lateral: 0,
    absHeading: 0,
    heading: 0,
    speed: 0,
    lap: 0,
    nextCheckpoint: 0,
    finished: false,
    finishTime: 0,
    placement: 0,
    offRoad: false,
    drifting: false,
    driftDir: 0,
    driftCharge: 0,
    boostTimer: 0,
    boostPower: 0,
    heldItem: null,
    shielded: false,
    disturbTimer: 0,
    stunTimer: 0,
    invulnTimer: 1.2,
    offTrackTimer: 0,
    respawnTimer: 0,
    lastValidCheckpointS: 0,
    steerVisual: 0,
    wheelSpin: 0,
    abilityMeter: 0,
    abilityCharges: characterId === 'ciro' || characterId === 'buttafuori' ? 1 : 0,
    abilityActive: false,
    abilityTimer: 0,
    lastAbilityPressAt: -99,
    driftBoostMultiplier: 1,
    lightMode: false,
    accelMultiplier: 1,
    driftChargeRateMultiplier: 1,
    speedCapMultiplier: 1,
    speedCapTimer: 0,
    judokaPending: false,
    judokaResolveTimer: 0,
    judokaTargets: [],
    debtPending: false,
    debtTimer: 0,
    debtStun: 0,
    debtDisturb: 0
  };
}
