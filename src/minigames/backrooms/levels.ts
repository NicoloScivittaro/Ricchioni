import {BACKROOM_MAPS} from '../../../shared/minigameMaps';
import type { CreatureKind } from './backroomsRules';

export type LevelId = 'lobby' | 'garage' | 'tunnels';
type Rgb = [number, number, number];
export interface LevelTheme {
  /** Base 0–255 colours of the authored textures. */
  wall: Rgb; floor: Rgb; ceiling: Rgb; pattern: 'wallpaper' | 'concrete' | 'tiles';
  /** Fluorescent diffuse hex and emissive 0–1. */
  light: string; glow: Rgb; fog: Rgb; ambient: number; signs: string[]; humHz: number;
}
export interface BackLevel { id: LevelId; name: string; tagline: string; monsters: CreatureKind[]; extraDark: number; theme: LevelTheme }

/** Every level has its own creatures: the roster is never shared between maps. */
export const LEVELS: Record<LevelId, BackLevel> = {
  lobby: {
    id: 'lobby', name: BACKROOM_MAPS.find(m=>m.id==='lobby')!.name, tagline: 'ASCOLTA. ESPLORA. SOPRAVVIVI.', monsters: ['bacteria','partygoer','stalker','runner','imitator'], extraDark: 0,
    theme: { wall: [162, 148, 90], floor: [81, 76, 48], ceiling: [145, 140, 116], pattern: 'wallpaper', light: '#b9c78b', glow: [.5, .55, .32],
      fog: [.075, .082, .05], ambient: .46, signs: ['NO SIGNAL', 'SERVICE', 'RESTRICTED', 'LEVEL 00'], humHz: 120 }
  },
  garage: {
    id: 'garage', name: BACKROOM_MAPS.find(m=>m.id==='garage')!.name, tagline: 'NON FARE RUMORE. QUALCOSA FIUTA.', monsters: ['partygoer','hound','watcher'], extraDark: .12,
    theme: { wall: [118, 120, 118], floor: [70, 72, 74], ceiling: [96, 98, 100], pattern: 'concrete', light: '#c8dcef', glow: [.42, .52, .62],
      fog: [.035, .045, .055], ambient: .5, signs: ['LEVEL 01', 'P2 · NO EXIT', 'CAUTION', 'LOADING BAY'], humHz: 98 }
  },
  tunnels: {
    id: 'tunnels', name: BACKROOM_MAPS.find(m=>m.id==='tunnels')!.name, tagline: 'RESTA NELLA LUCE. NON URLARE.', monsters: ['smiler','bacteria','howler'], extraDark: .3,
    theme: { wall: [96, 62, 44], floor: [50, 40, 33], ceiling: [64, 52, 44], pattern: 'tiles', light: '#d9854a', glow: [.6, .3, .12],
      fog: [.05, .025, .015], ambient: .42, signs: ['LEVEL 02', 'BOILER', 'DO NOT ENTER', 'PIPE 7'], humHz: 72 }
  }
};
export const LEVEL_IDS = Object.keys(LEVELS) as LevelId[];
