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
}

export const WEAPONS: WeaponConfig[] = [
  {
    id: 'mitraglia',
    name: 'MITRAGLIA DEL GOBLIN',
    icon: '🔫',
    damage: 12,
    fireRate: 8,
    range: 40,
    spread: 0.02,
    magazine: 30,
    reload: 1.5,
    projectileSpeed: 0,
    splashRadius: 0,
    movementModifier: 1,
    difficulty: 'FACILE'
  },
  {
    id: 'spaccatutto',
    name: 'SPACCATUTTO',
    icon: '💥',
    damage: 11,
    fireRate: 1.4,
    range: 14,
    spread: 0.16,
    magazine: 6,
    reload: 2.0,
    projectileSpeed: 0,
    splashRadius: 0,
    movementModifier: 0.96,
    difficulty: 'MEDIA'
  },
  {
    id: 'laser',
    name: 'LASER DEL DISAGIO',
    icon: '🔦',
    damage: 55,
    fireRate: 1.1,
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
    name: 'RAFFICA 3X',
    icon: '💨',
    damage: 15,
    fireRate: 3.2,
    range: 35,
    spread: 0.03,
    magazine: 24,
    reload: 1.7,
    projectileSpeed: 0,
    splashRadius: 0,
    movementModifier: 0.98,
    difficulty: 'MEDIA'
  },
  {
    id: 'bombarda',
    name: 'BOMBARDA',
    icon: '🧨',
    damage: 70,
    fireRate: 0.7,
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
    name: 'SPARAPISELLI TURBO',
    icon: '🫛',
    damage: 6,
    fireRate: 14,
    range: 30,
    spread: 0.05,
    magazine: 90,
    reload: 1.2,
    projectileSpeed: 0,
    splashRadius: 0,
    movementModifier: 1.05,
    difficulty: 'FACILE'
  }
];

export function getWeapon(id: string): WeaponConfig {
  return WEAPONS.find((w) => w.id === id) ?? WEAPONS[0];
}
