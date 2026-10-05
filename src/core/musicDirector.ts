import { game as gm } from './GameManager';
import { audio } from './AudioManager';
import { music } from './music';
import { themeForGame } from './musicThemes';

/**
 * REGIA MUSICALE (solo host): sceglie tema e livello in base alla FASE della partita, sempre con crossfade.
 *
 *   LOBBY ............ tema lobby (leggero)
 *   RULLO ............ tema del rullo (cresce; lo stop col CLUNK e lo stinger li suona RouletteScene)
 *   INTRO ............ tema del gioco a livello 0 (sotto), sopra lo stinger del gioco
 *   GIOCO ............ tema del gioco: livello 0 finche' c'e' la schermata CONTROLLI, poi 1; 2 negli ultimi istanti
 *                      (lo chiedono i giochi con setGameIntensity) o se questo puo' essere l'ULTIMO round della partita
 *   FINE MINIGIOCO ... dissolvenza (risultati e telecronista restano in primo piano)
 *   RISULTATI/CLASSIFICA tema risultati
 *   FINALE ........... tema del podio (la fanfara del campione la suona GameOverScene)
 *   PAUSA ............ livello 0
 * Annunci di partita (una volta sola): SPAREGGIO e "ultimo round possibile" (qualcuno a un passo dal traguardo).
 */
interface St {
  phase?: string;
  paused?: boolean;
  suddenDeath?: boolean;
  targetScore?: number;
  players?: { score: number }[];
  currentMinigame?: { minigameId: string } | null;
}

let lastKey = '';
let base: 0 | 1 | 2 = 1;
let controlsOn = false;
let gameLevel: 0 | 1 | 2 = 1;
let finalAnnounced = false;
let suddenAnnounced = false;
let started = false;

function applyLevel(): void {
  music.setLevel(controlsOn ? 0 : (Math.max(base, gameLevel) as 0 | 1 | 2));
}

function onState(s: St | null): void {
  const phase = s?.phase ?? 'LOBBY';
  const gid = s?.currentMinigame?.minigameId ?? '';
  const key = `${phase}|${gid}|${s?.paused ? 'P' : ''}`;
  if (key === lastKey) return;
  const prevPhase = lastKey.split('|')[0];
  lastKey = key;
  if (s?.paused) {
    music.setLevel(0);
    return;
  }
  switch (phase) {
    case 'LOBBY':
      finalAnnounced = false;
      suddenAnnounced = false;
      base = 1;
      music.play('lobby', 1);
      break;
    case 'MINIGAME_ROULETTE':
    case 'NEXT_ROUND': {
      // annunci di PARTITA (rari): spareggio; oppure qualcuno puo' vincere in questo round
      const target = s?.targetScore ?? Infinity;
      const best = Math.max(0, ...(s?.players ?? []).map((p) => p.score));
      if (s?.suddenDeath && !suddenAnnounced) {
        suddenAnnounced = true;
        audio.announcer('SUDDEN_DEATH');
      } else if (!finalAnnounced && best >= target - 10) {
        finalAnnounced = true;
        audio.announcer('FINAL_ROUND');
      }
      base = s?.suddenDeath || best >= target - 10 ? 2 : 1;
      if (phase === 'MINIGAME_ROULETTE') music.play('roulette', 1);
      break;
    }
    case 'MINIGAME_INTRO':
      gameLevel = 1;
      music.play(themeForGame(gid), 0, 1.4);
      break;
    case 'MINIGAME_PLAYING':
      if (prevPhase !== 'MINIGAME_PLAYING') gameLevel = 1;
      music.play(themeForGame(gid), 0, 1);
      applyLevel();
      break;
    case 'MINIGAME_FINISHED':
      music.stop(0.6);
      break;
    case 'ROUND_RESULTS':
    case 'GLOBAL_LEADERBOARD':
    case 'CHECK_WINNER':
      music.play('results', 1, 1);
      break;
    case 'GAME_FINISHED':
      music.play('podium', 1, 0.4);
      break;
  }
}

/** Avvia la regia (una volta, dall'host). */
export function initMusicDirector(): void {
  if (started) return;
  started = true;
  onState(null);
  gm.events.on('state', (s) => onState(s as St));
}

/** La schermata CONTROLLI e' su (musica sotto) / e' finita (livello normale). */
export function controlsOverlay(on: boolean): void {
  controlsOn = on;
  applyLevel();
}

/**
 * Intensita' chiesta dal gioco (ultimi 20 secondi, match point, giro finale, ultimi due in campo). Solo strati musicali:
 * nessun effetto su tempi o regole. Torna a 1 da sola al prossimo minigioco.
 */
export function setGameIntensity(level: 0 | 1 | 2): void {
  if (level <= gameLevel) return;
  gameLevel = level;
  applyLevel();
}
