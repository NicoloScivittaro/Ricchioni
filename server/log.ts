/**
 * Log del server con TAG fissi: [ROOM] [ROUND] [MINIGAME] [RESULT] [RECONNECT] [ERROR].
 * Solo eventi a bassa frequenza (una riga per stanza creata, round, risultato, riconnessione): niente log
 * per input o per frame. LOG=quiet lascia solo gli [ERROR].
 */
export type LogTag = 'ROOM' | 'ROUND' | 'MINIGAME' | 'RESULT' | 'RECONNECT' | 'ERROR';

const QUIET = (process.env.LOG ?? '').toLowerCase() === 'quiet';

export function log(tag: LogTag, room: string | null, msg: string): void {
  if (QUIET && tag !== 'ERROR') return;
  const time = new Date().toISOString().slice(11, 19);
  const line = `${time} [${tag}]${room ? ` [${room}]` : ''} ${msg}`;
  if (tag === 'ERROR') console.error(line);
  else console.log(line);
}
