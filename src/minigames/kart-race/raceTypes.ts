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

  camYaw: number; // stato smussato camera (per il follow)
  camPos: { x: number; y: number; z: number };

  finishedRoundGrace: boolean;
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
    camYaw: 0,
    camPos: { x: 0, y: 0, z: 0 },
    finishedRoundGrace: false
  };
}
