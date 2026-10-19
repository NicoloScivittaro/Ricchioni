/**
 * Configurazione centralizzata delle armi di SPARATORIA DEI DISAGIATI.
 * Tutte le statistiche vivono qui (WeaponConfig); host (danno/hitscan) e telefono
 * (HUD munizioni/reload) leggono la stessa fonte.
 */

export interface WeaponConfig {
  id: string;
  name: string;
  icon: string;
  /** 0-5 per le barre di selezione arma. */
  damage: number;
  fireRate: number; // colpi al secondo
  range: number;
  spread: number; // radianti
  magazine: number;
  reload: number; // secondi
  projectileSpeed: number; // 0 = hitscan
  splashRadius: number; // 0 = nessuno splash
  movementModifier: number; // 1 = nessun modificatore
  difficulty: 'FACILE' | 'MEDIA' | 'ALTA';
  /** Pallini per colpo (fucile a pompa): `damage` vale PER PALLINO. Default 1. */
  pellets?: number;
  /** Colpi per pressione del grilletto (raffica). `fireRate` resta la cadenza MEDIA in colpi/s. Default 1. */
  burst?: number;
  /** Secondi tra i colpi dentro una raffica. */
  burstGap?: number;
}

export const WEAPONS: WeaponConfig[] = [
  {
    id: 'mitraglia',
    name: 'AK-47 DEL GOBLIN',
    icon: '🔫',
    damage: 12,
    fireRate: 8,
    range: 40,
    spread: 0.025,
    magazine: 30,
    reload: 1.5,
    projectileSpeed: 0,
    splashRadius: 0,
    movementModifier: 1,
    difficulty: 'FACILE'
  },
  {
    id: 'spaccatutto',
    name: 'RAY GUN V1',
    icon: '💥',
    damage: 11, // per pallino
    fireRate: 1.4,
    range: 14,
    spread: 0.13,
    pellets: 8,
    magazine: 6,
    reload: 2.0,
    projectileSpeed: 0,
    splashRadius: 0,
    movementModifier: 0.96,
    difficulty: 'MEDIA'
  },
  {
    id: 'laser',
    name: 'CECCHINO',
    icon: '🔦',
    damage: 55,
    fireRate: 1.05,
    range: 60,
    spread: 0.0,
    magazine: 5,
    reload: 2.2,
    projectileSpeed: 0,
    splashRadius: 0,
    movementModifier: 0.94,
    difficulty: 'ALTA'
  },
  {
    id: 'raffica',
    name: 'M4A1 · RAFFICA 3X',
    icon: '💨',
    damage: 22,
    fireRate: 3.2, // colpi/s medi: 3 colpi ravvicinati, poi pausa
    range: 40,
    spread: 0.02,
    burst: 3,
    burstGap: 0.07,
    magazine: 24,
    reload: 1.7,
    projectileSpeed: 0,
    splashRadius: 0,
    movementModifier: 0.98,
    difficulty: 'MEDIA'
  },
  {
    id: 'bombarda',
    name: 'RAY GUN',
    icon: '🧨',
    damage: 75,
    fireRate: 0.9,
    range: 45,
    spread: 0.02,
    magazine: 4,
    reload: 2.5,
    projectileSpeed: 20,
    splashRadius: 4,
    movementModifier: 0.9,
    difficulty: 'ALTA'
  },
  {
    id: 'sparapiselli',
    name: 'MINIGUN',
    icon: '🫛',
    damage: 6,
    fireRate: 14,
    range: 30,
    spread: 0.04,
    magazine: 90,
    reload: 1.2,
    projectileSpeed: 0,
    splashRadius: 0,
    movementModifier: 1.05,
    difficulty: 'FACILE'
  },
  {id:'pistola',name:'USP45',icon:'🔫',damage:24,fireRate:3.5,range:32,spread:.015,magazine:12,reload:1.35,projectileSpeed:0,splashRadius:0,movementModifier:1.03,difficulty:'FACILE'}
];

export function getWeapon(id: string): WeaponConfig {
  return WEAPONS.find((w) => w.id === id) ?? WEAPONS[0];
}
