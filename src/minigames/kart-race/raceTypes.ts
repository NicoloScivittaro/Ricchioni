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
  abilityCharges: number; // usato solo dal Napoletano: 2 cariche fisse per gara, NON si ricaricano col meter
  abilityActive: boolean; // finestra generica attiva (Buttafuori "carro armato", Goblin "exploit")
  abilityTimer: number; // durata residua della finestra attiva
  lastAbilityPressAt: number; // raceTime dell'ultima pressione del tasto ABILITÀ (usato dal Napoletano)

  // Effetti generici che la fisica legge senza sapere "perché" sono attivi:
  tankMode: boolean; // Buttafuori: quasi immune a stordimento/contraccolpo, ma sterza peggio
  turnRateMultiplier: number; // 1 = normale (effetto Dottore "sterzo nervoso"/"grip perfetto")
  gripMultiplier: number; // 1 = normale (centratura più rapida/lenta)
  speedCapMultiplier: number; // 1 = normale (riduce/aumenta la velocità massima effettiva)
  itemImmune: boolean; // Dottore: immune ai colpi ma non può raccogliere altri item
  effectTimer: number; // durata residua dell'effetto Dottore attivo

  // Judoka — IPPON!
  ipponArmed: boolean; // mossa pronta (meter pieno)
  ipponWindow: boolean; // finestra "fianco a fianco" aperta in questo istante
  ipponWindowTimer: number;
  ipponTargetId: PlayerId | null;
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
    abilityCharges: characterId === 'ciro' ? 2 : 0,
    abilityActive: false,
    abilityTimer: 0,
    lastAbilityPressAt: -99,
    tankMode: false,
    turnRateMultiplier: 1,
    gripMultiplier: 1,
    speedCapMultiplier: 1,
    itemImmune: false,
    effectTimer: 0,
    ipponArmed: false,
    ipponWindow: false,
    ipponWindowTimer: 0,
    ipponTargetId: null
  };
}
