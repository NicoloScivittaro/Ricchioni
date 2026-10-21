/**
 * Configurazione centralizzata delle armi di SPARATORIA DEI DISAGIATI.
 * Tutte le statistiche vivono qui (WeaponConfig); host (danno/hitscan) e telefono
 * (HUD munizioni/reload) leggono la stessa fonte.
 */

export interface WeaponConfig {
  id: string;
  name: string;
  icon: string;
  /** Danno base di un proiettile, prima di protezioni e abilita. */
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
  /** Semi: one shot per press; burst: one complete burst per trigger cycle. */
  fireMode?:'auto'|'semi'|'burst';
  scopeZoom?:number; hipSpread?:number;
  projectileKind?:'energy'; splashDamage?:number;
  /** Pellets per shot; damage is per pellet. Defaults to one. */
  pellets?: number;
  /** Colpi per pressione del grilletto (raffica). `fireRate` resta la cadenza MEDIA in colpi/s. Default 1. */
  burst?: number;
  /** Secondi tra i colpi dentro una raffica. */
  burstGap?: number;
  reloadEmpty?:number;
  reloadInsert?:number;
  reloadInsertEmpty?:number;
  shellReload?:{start:number;insert:number;end:number;contact:number};
}

export const WEAPONS:WeaponConfig[]=[
  {id:'mitraglia',name:'AK-47 DEL GOBLIN',icon:'🔫',damage:16,fireRate:8.5,range:45,spread:.025,magazine:30,reload:1.7,projectileSpeed:0,splashRadius:0,movementModifier:1,difficulty:'FACILE',fireMode:'auto'},
  {id:'laser',name:'CECCHINO · OTTICA 4×',icon:'🎯',damage:125,fireRate:.85,range:110,spread:.0005,hipSpread:.055,magazine:5,reload:2.4,projectileSpeed:0,splashRadius:0,movementModifier:.9,difficulty:'ALTA',fireMode:'semi',scopeZoom:4},
  {id:'raffica',name:'M4A1 · RAFFICA 3X',icon:'💨',damage:23,fireRate:6,range:50,spread:.014,burst:3,burstGap:.075,magazine:30,reload:1.8,projectileSpeed:0,splashRadius:0,movementModifier:.98,difficulty:'MEDIA',fireMode:'burst'},
  {id:'bombarda',name:'RAY GUN',icon:'☢️',damage:80,fireRate:2.8,range:60,spread:.008,magazine:20,reload:2.5,projectileSpeed:55,splashRadius:1.8,splashDamage:45,projectileKind:'energy',movementModifier:.96,difficulty:'MEDIA',fireMode:'semi'},
  {id:'sparapiselli',name:'MINIGUN',icon:'🔥',damage:12,fireRate:17,range:42,spread:.032,magazine:100,reload:2.9,projectileSpeed:0,splashRadius:0,movementModifier:.83,difficulty:'FACILE',fireMode:'auto'},
  {id:'pistola',name:'USP45 · SEMIAUTOMATICA',icon:'🔫',damage:30,fireRate:7,range:35,spread:.012,magazine:12,reload:1.1,projectileSpeed:0,splashRadius:0,movementModifier:1.08,difficulty:'FACILE',fireMode:'semi'},
  {id:'acr',name:'ACR · ASSALTO',icon:'🔫',damage:19,fireRate:8,range:52,spread:.014,magazine:30,reload:1.65165,reloadInsert:1.15,projectileSpeed:0,splashRadius:0,movementModifier:.98,difficulty:'FACILE',fireMode:'auto'},
  {id:'glock',name:'GLOCK 17',icon:'🔫',damage:27,fireRate:5,range:32,spread:.013,magazine:17,reload:2.8,reloadEmpty:3.033333,reloadInsert:1.95,projectileSpeed:0,splashRadius:0,movementModifier:1.08,difficulty:'FACILE',fireMode:'semi'},
  {id:'shotgun',name:'REMINGTON 870',icon:'💥',damage:14,pellets:8,fireRate:.92,range:25,spread:.075,magazine:6,reload:5.583333,shellReload:{start:.625,insert:.708333333,end:.708333333,contact:.45},projectileSpeed:0,splashRadius:0,movementModifier:.92,difficulty:'MEDIA',fireMode:'semi'},
  {id:'ak74u',name:'AK-74U',icon:'🔫',damage:18,fireRate:9,range:38,spread:.024,magazine:30,reload:2.233333,reloadEmpty:3.466667,reloadInsert:1.52,reloadInsertEmpty:2.1,projectileSpeed:0,splashRadius:0,movementModifier:1.02,difficulty:'MEDIA',fireMode:'auto'}
];
export function getWeapon(id:string):WeaponConfig {
  // Compatibility for old snapshots; only one Ray Gun appears in the active rotation.
  return WEAPONS.find(w=>w.id===(id==='spaccatutto'?'bombarda':id))??WEAPONS[0];
}
