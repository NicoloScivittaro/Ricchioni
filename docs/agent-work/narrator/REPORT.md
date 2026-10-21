# Il Narratore Bastardo — consegna

Aggiornamento del 21 ottobre 2026: il profilo vocale e il catalogo attivo sono stati rinnovati. Vedere [voce naturale e sarcastica v2](../narrator-voice/README.md). Il report seguente documenta l'integrazione originale.

Il narratore è integrato nell'host di PARTY GAME con audio parlato preregistrato, sottotitoli e comandi nel pannello **V**. I telefoni non riproducono la telecronaca. Le frasi seguono il rullo reale, il gioco estratto e i piazzamenti ricevuti dal server.

## Catalogo e voce

**134 battute complete di audio OGG locale**: 25 rullo, 25 risultati, 50 personali (10 ciascuno per Goblin, Boschi, Victor, Carbo e Ciro), 34 annunci (2 per ognuno dei 17 giochi). Nessuna clip del catalogo manca. `catalog.json` contiene testo, sottotitolo, testo fonetico, condizioni, priorità, peso, cooldown, velocità, asset, durata e dimensioni reali. Il manifest pubblico e quello importato dal codice sono identici; ogni clip ha metadati e firma di generazione.

La voce è italiana maschile Kokoro `im_nicola`, elaborata con un profilo radio originale: pitch leggermente abbassato, pause, filtro e normalizzazione, velocità distinte per evento. Testo romanesco e sarcasmo prendono di mira prestazione, scuse e ruoli del gioco. Victor non viene trasformato in medico, Carbo mantiene “ANGORA CHE DICI?”, Ciro ha battute sul contrattare e sui punti, Goblin sul creatore del gioco, Boschi sulla sicurezza e la sua potenza.

**Limite artistico:** è una voce sintetica italiana, non un doppiatore romano. Le intonazioni, le risate e le urla recitate non raggiungono quelle di una registrazione professionale. I test verificano riproduzione, integrità, livelli e sincronizzazione; non sostituiscono un ascolto umano per giudicare comicità, accento e pronuncia. Il sistema permette di sostituire gli OGG con interpretazioni recitate senza modificare il selettore degli eventi. Tre prototipi riproducibili sono in `public/audio/narrator/prototypes.html`.

Generazione interamente offline, senza servizi cloud, chiavi API o costi per voce. Modelli già presenti sul PC, letti senza modificarli e senza aggiungerli a Git. Attribuzioni e fonti: [runtime MIT](https://github.com/thewh1teagle/kokoro-onnx), [modello Apache 2.0](https://huggingface.co/hexgrad/Kokoro-82M); dettagli in `public/audio/narrator/ATTRIBUTION.md`.

## Comportamento

- Rullo: una provocazione durante la rotazione. Frequenza **Normale**: probabilità 60%; **Chiacchierone**: ogni rullo, se c'è una clip idonea non recente.
- Estrazione: annuncio del gioco effettivamente rivelato. Nessuna scelta casuale tra nomi di giochi diversi.
- Risultati: **una sola battuta** dopo l'ultima riga della classifica, su vincitore/ultimo, pareggio, serie vere di tre vittorie/sconfitte, rimonta dal fondo, cambio leader o distacco globale verificato. Le statistiche testuali libere non generano eventi inventati. Bot distinti dalle persone, frasi personali soltanto al personaggio che soddisfa davvero la condizione.
- Ultime 12 battute escluse, cooldown 75 secondi, memoria recente e deduplicazione per stanza/round/tipo anche dopo ricaricamento. Se non esiste una frase coerente disponibile, resta in silenzio.
- Nessuna voce durante gioco, countdown, comandi o input a tempo. Scadenze di 4,1/4,4/5,1 secondi per rullo/gioco/risultati; non si prolunga la macchina delle fasi e non si attende la voce per avviare il round.
- Una voce alla volta anche nel mixer. Stop/pausa/errore liberano il nodo e il ducking; la ripresa parte dall'offset, senza rigiocare la frase dall'inizio. Caricamenti tardivi abortiti al cambio fase. Lobby, chiusura pagina e dispose puliscono la riproduzione.

## Audio e interfaccia

Lo stesso **AudioManager**, compressore/limiter, master e muto esistenti; nessun motore vocale online durante il gioco. Il canale narratore ha volume indipendente dal TELECRONISTA degli stinger. La musica si abbassa del 60% durante il parlato e risale al termine, anche se uno stinger richiede un duck temporaneo nello stesso momento. Il sound manager automatico inutilizzato di Phaser è disabilitato: i suoni continuano nel mixer esistente.

Cache progressiva di **8 clip decodificate**: nessun preload del catalogo completo e nessuna inferenza TTS in partita. I sottotitoli si mostrano soltanto dopo l'avvio della voce, massimo due righe, senza intercettare input: in basso nei risultati, sotto il titolo nel rullo/annuncio. **V** offre ON/OFF, volume, sottotitoli ON/OFF, Normale/Chiacchierone e “Salta battuta”. **Spazio** interrompe la voce conservando il comportamento di salto delle schermate già esistente. Preferenze salvate separatamente in `ricchioni.narrator`, volumi legacy preservati.

## Implementazione

Moduli `src/audio/narrator/`: Lines, Facts, History, Settings, Subtitles, Player, Director e manifest statico. Integrazione host in `src/app/main.ts`, audio in `src/core/AudioManager.ts` e `audioSettings.ts`, comandi tramite emitter esistente da `musicDirector.ts`, eventi delle scene Roulette/Intro/Results. La classifica di Trentuno usa righe distinte anche in ex aequo, come Minigolf; nessun cambio a punti o piazzamenti.

Generatori `scripts/narrator-export.ts`, `generate-narrator-audio.py`; QA indipendente dal modello con `narrator-asset-qa.py`. Per rigenerare: esportare il catalogo con `npx tsx scripts/narrator-export.ts`, impostare `NARRATOR_MODEL_DIR` alla propria cartella contenente `kokoro-v1.0.onnx` e `voices-v1.0.bin`, eseguire lo script Python con `--prototype` o `--all`, riesportare il catalogo per includere i metadati, ricompilare. Servono Kokoro ONNX, numpy e FFmpeg/FFprobe solo sulla macchina di generazione.

## Verifiche

Le evidenze JSON, log e screenshot sono nella stessa cartella di questo report.

| Prova | Esito |
| --- | --- |
| `scripts/narrator-selftest.ts` | 378 controlli: condizioni reali, nomi/gioco corretti, pari, bot, serie, memoria e catalogo |
| `scripts/e2e/narrator-prototypes.mjs` | Tre prototipi riprodotti realmente in Chrome fino a `ended` |
| `scripts/narrator-asset-qa.py` | 134 clip decodificate con FFmpeg, manifest uguali, hash e dimensioni verificati |
| `scripts/e2e/narrator-audio.mjs` | 170 verifiche nel browser: tutte le 134 clip decodificate, volume separato, duck/restauro, esclusione globale, pausa all'offset, sottotitoli, mute/OFF/zero, errore nodo e asset mancante, caricamento tardivo cancellato, cache e cleanup |
| `scripts/e2e/narrator.mjs` | Due telefoni reali: tre mani naturali di Trentuno, risultati parlati, rullo successivo, annuncio del gioco effettivo, nuovo round e ritorno lobby; zero errori |
| `scripts/e2e/narrator-production.mjs` | Build compilata, due telefoni, tre mani naturali, cinque interventi parlati sincronizzati, un solo AudioContext, impostazioni persistenti, nessuna clip caricata dai telefoni e nuovo gioco FPS avviato; zero errori |
| `scripts/e2e/narrator-performance.mjs` | Stesso host compilato, Trentuno con due giocatori, sei campioni alternati ON/OFF: mediana **59,94 FPS OFF e 59,94 FPS ON**, rapporto 1,000; nessuna regressione misurata |
| `scripts/e2e/narrator-games.mjs` | Tutti i 17 giochi avviati nel browser, annuncio corretto, nessuna voce in gameplay, lobby pulita; 8 listener globali costanti, zero errori |
| `scripts/audio-selftest.ts` | Regressioni audio superate |
| `scripts/e2e/audio.mjs` | 122 cue, 14 temi, stress con picco 0,48 sotto 1, budget rispettato, nessun nodo rimasto, musica/comandi/VIA/folla e telefoni passivi; tutto OK |
| `scripts/rounds-selftest.ts` | 60 controlli di round e durata superati |
| `npm run build` | Typecheck TypeScript e build di produzione superati; build finale 5m19s |

Il test audio esistente ora attende la vera schermata CONTROLLI fino a 60 secondi: lo stato PLAYING precede il caricamento asincrono Babylon e la precedente finestra di tre secondi poteva terminare prima che arrivasse. Nessun tempo del prodotto è stato cambiato per correggere il test. Resta l'avviso preesistente sui chunk Babylon grandi, senza errori di compilazione.

Catalogo principale: **3.165.290 byte** (circa 3,02 MiB), **413,977 secondi** complessivi. Picco massimo misurato **−1,1 dBFS**, livelli medi delle clip tra **−18,9 e −16,1 dBFS**. Le durate del manifest sono quelle del contenitore FFprobe; Chrome può rifilare fino a circa un decimo di secondo di padding Vorbis. Le scadenze del player usano sempre la durata effettiva dell'AudioBuffer decodificato.

L'avvio dei 17 giochi è uno smoke test di integrazione, non una partita completa di ognuno. La prova completa con risultati naturali riguarda Trentuno. Le regole dei minigiochi, ScoreManager e il ciclo del rullo restano quelli presenti prima di questa integrazione.

La prima misura breve nella partita compilata ha rilevato 57,2 FPS (p95 16,8 ms); è conservata nel relativo JSON. Per distinguere il caricamento iniziale dall'impatto del narratore, il confronto successivo usa lo stesso host, gioco e due telefoni, dopo riscaldamento, con tre campioni per impostazione alternati. Le due mediane coincidono a 59,94 FPS. È una misura su questo PC e scenario, non una garanzia universale per ogni hardware e minigioco.

## Git e lavoro precedente

Baseline iniziale `defcb4d`. Il commit utente **`177a6ec` (“2”)** ha salvato durante il lavoro il nuovo ciclo del rullo e parti iniziali del narratore. Preservato integralmente, senza reset o amend. Il commit locale dedicato successivo completa il narratore, gli asset rimasti e le verifiche. Nessun push o deploy.
