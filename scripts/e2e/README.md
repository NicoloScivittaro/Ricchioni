# Test end-to-end nel browser (host Phaser + telefoni reali)

Guidano Chrome headless: 1 pagina host (`/`) + N pagine controller (`/controller.html`) contro il server locale.
Servono il server (`npm start`, porta 3001) e il client in dev (`npx vite --port 5173`), più Chrome e `puppeteer-core`
(non è una dipendenza del progetto: `npm i --no-save puppeteer-core`). Percorso di Chrome: variabile `CHROME_PATH`.

| Script | Cosa verifica |
| --- | --- |
| `bug1.mjs` | N giochi consecutivi **senza refresh**: una sola scena attiva per fase, nessun canvas 3D residuo, telefoni allineati (`PHONES=5 ROUNDS=4 node scripts/e2e/bug1.mjs`) |
| `matrix.mjs` | Ogni minigioco del registry: rullo → gioco → fine → risultati → rullo (`GAMES=quiz,arena,...`) |
| `rounds.mjs` | Round **naturali**: `MODE=reaction \| memory-elim \| quiz \| cultura` eseguono esattamente N round e chiamano `finish()` una volta |
| `natural.mjs` | Fine naturale (`GAME=arena \| dodgeball \| fps`) senza iniettare nulla |
| `fastend.mjs` | Forza la vera condizione di fine dei giochi 3D lenti in headless (`GAME=soccer \| kart3d \| volleyball`) |
| `resync.mjs` | Transizione "persa" su host e telefono: lo snapshot successivo riallinea la UI senza refresh |
| `physics.mjs` | Kart: velocità massima osservata nel gioco reale; Pallavola: servizio con i valori di config |
| `leak.mjs` | 10–18 minigiochi di fila: scene=1, canvas=1, timer/listener stabili, heap che non cresce |
| `pause.mjs` | ESC: pausa (timer/fisica/input fermi, telefoni "PARTITA IN PAUSA"), RICOMINCIA, ripresa |
| `reconnect.mjs` | Telefono e host che si disconnettono a metà gioco: ripresa senza refresh e piazzamento deterministico |
| `cultura.mjs` | Cultura con giocatori veri: 8 round, ritmo (~5-7 min), niente riuso dei bluff |
| `debug.mjs` | Overlay F3/?debug=1, preset qualità 3D (LOW in headless) e precarico del gioco 3D durante il rullo |
| `fps-spawn.mjs` | Sparatoria: ogni giocatore nasce girato verso il centro della mappa |
| `controllers.mjs` | Audit dei controller su tutti i giochi in verticale/orizzontale/schermo piccolo: niente scroll, bottoni ≥ 44px e dentro lo schermo (screenshot in `e2e-shots/controllers`) |
| `shots.mjs` | Screenshot delle schermate host (1280x720; `VIEWPORT=1366x768` ecc. per i test di risoluzione) |

Nota: in headless il GL è software (~4 fps): il tempo dei giochi 3D scorre più piano dell'orologio (`dt` ≤ 50 ms). Per questo
i tetti di sicurezza del server (`hardCapSec` in `shared/minigames.ts`) sono larghi.
Test senza browser: `npx tsx scripts/rounds-selftest.ts`, `scripts/volleyball-balance.ts`, `scripts/kart-balance.ts`, `scripts/prelaunch.ts`
(anche contro produzione con `URL=https://ricchioni.onrender.com`), `scripts/validate-content.ts` (domande Quiz/Cultura), `scripts/game-length.ts` (durata attesa della partita).
Server con log ridotti: `LOG=quiet npm start` (solo `[ERROR]`). Qualità 3D: `?quality=low|medium|high` nell'URL host o telefono.
