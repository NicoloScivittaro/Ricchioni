# MINIGOLF 2.0 — torneo a tre buche

12 ottobre 2026. Implementazione con root, come già autorizzato senza Flash. Nessuna dipendenza, commit, push o deploy.

## Durata e causa delle partite brevi

Prima: **210 secondi per una sola pista**, ma solo **6 secondi di mira per turno** e **5–6 colpi massimi**. Il limite di colpi e i turni scaduti chiudevano spesso la gara prima del timer generale.

Ora: **150 secondi per ciascuna delle tre buche**, **15 secondi per mirare**, **12 colpi massimi per pista**. Il budget complessivo diventa 450 secondi invece di 210; il singolo timer è impostato al valore richiesto, non aumentato rispetto ai precedenti210s. Le buche possono terminare prima quando tutti hanno concluso. I bot restano rapidi: non si forza un'attesa fino alla scadenza.

Configurazione centrale: `shared/minigolfTournament.ts`. Il costruttore della simulazione accetta anche `holeSeconds` e `aimSeconds`, con limiti e gestione dei valori non validi. Il watchdog Minigolf1600s copre anche300s/buca configurati, caricamento, tolleranza dell'ultimo tiro e spareggio. La pausa congela tutti i timer della simulazione.

## Dieci percorsi

Sei mappe preesistenti conservate nella geometria, quattro aggiunte; il limite colpi aumenta per tutte. Le proposte sono adattate al solver esistente: non sono stati introdotti portali o un loop che richiederebbero nuova fisica.

| Pista | Origine | Geometria e strategia |
| --- | --- | --- |
| Il Corridoio Maledetto | Esistente | Pareti alternate a zigzag, passaggi laterali e un bumper: sponde o aggiramento. |
| La Rotonda del Disagio | Esistente | Due bracci perpendicolari ruotano attorno allo stesso centro: passaggio esterno o tiro a tempo. |
| Il Ponte del Litorale | Esistente | Ponte stretto sopra il mare, rampa e piattaforma che scorre lateralmente. |
| Il Flipper dei Coglioni | Esistente | Cinque bumper, ghiaccio e sabbia: cambiano rimbalzi e distanza di arresto. |
| La Discesa Infame | Esistente | Partenza sopraelevata, lunga discesa e curva verso una porta stretta. |
| L'Ultima Buca | Esistente | Strada laterale sicura oppure rampa centrale con salto e piattaforma mobile. |
| Il Prato Tranquillo | Nuova | Campo aperto, due zone sabbiose, buca decentrata e piccola parete laterale. |
| Le Montagne del Disagio | Nuova | Salita, cima piatta e discesa, con una corsia centrale delimitata. |
| I Cancelli Impazziti | Nuova | Due bracci in punti diversi, con velocità e fasi diverse ma deterministiche; passaggi esterni alternati. |
| La Serpentina sul Mare | Nuova | Tre curve su ponti stretti senza parapetti, con piazzole per fermarsi prima di cambiare direzione. |

La selezione produce tre mappe uniche: facile/media → media → media/difficile. Una guardia in memoria evita di ripetere immediatamente lo stesso insieme di tre mappe, anche in un ordine diverso. Le partenze sono equidistanti dal primo obiettivo; postazioni e primo giocatore ruotano tra buche.

## Torneo, recupero e classifica

Ogni buca mostra numero, nome, par, tempo, turno, colpi, imbucati e posizione provvisoria. Alla chiusura appare una classifica per4s; segue la presentazione della pista successiva. Palline, carica, abilità disponibili per buca, debito, previsione e bumper temporanei ripartono; identità, controller, colpi cumulativi e risultati precedenti restano.

Allo scadere non iniziano nuovi tiri. Quello già partito può assestarsi, con recupero tecnico dopo20s: questo recupero e le cadute riutilizzano la fisica esistente. Un non imbucato riceve **almeno14 colpi**, oppure colpi effettivi+2 se superiori, e due penalità. Un turno senza azione consuma un colpo; un giocatore AFK non blocca il torneo.

Vince il minor totale dei colpi. Secondo criterio: tempo attivo cumulativo nelle buche imbucate, includendo mira e movimento del proprio tiro, escludendo il turno degli altri. Una bocciata continua a poter spostare o imbucare un avversario secondo le regole precedenti.

In caso di parità esatta di colpi e tempo, gli interessati disputano una breve prova da8m: un tiro ciascuno,12s per prepararlo, stesso punto di partenza, nessuna interferenza delle altre palline e nessuna abilità. Conta la distanza finale; fra due imbucate conta il tempo attivo. Questo tiro non aggiunge una quarta buca al totale. Se permane una parità o tutti sono AFK, si conserva l'**ex aequo**: nessun vincitore scelto per ordine del roster.

ScoreManager assegna agli ex aequo la media arrotondata dei punti delle posizioni occupate; punti doppi e recupero sul leader restano applicabili. Questa opzione è attivata soltanto da Minigolf. Le righe dei risultati non si sovrappongono e il ritardo di rivelazione del vincitore viene applicato una volta anche con più primi classificati. La tabella finale e i risultati globali mostrano B1/B2/B3 e totale; telefoni e Companion mostrano buca, timer e punteggio cumulativo.

## Verifiche eseguite

| Verifica | Evidenza |
| --- | --- |
| Typecheck e build | Entrambi exit0; typecheck16,55s, Vite273,93s. Chunk aggiornato `BabylonMinigolfGame-xEtOgy-T.js`. Rimane l'avviso generale sui grandi chunk Babylon/Phaser già esistenti. [Log](build.json). |
| Completabilità delle dieci piste | Tutte imbucate dalla partenza in1–6 tiri attraverso comandi e solver reali. Ricerca del tiro solo nel test, nessuna modifica della fisica o teletrasporto delle palline. [Traiettorie](completion.json). |
| Selezione e torneo | 3000 selezioni, tutte le10piste, progressione e guardia tripletta; reset, timeout/AFK, parità, spareggio fisico, ScoreManager con punti doppi e recupero;9 gruppi dedicati. [Script](../../../scripts/minigolf-2-selftest.ts), [ultima esecuzione](final-selftest.log). |
| Simulazioni con bot | 24 tornei completi,2–5 giocatori ×6 seed:252 buche imbucate, tempi98,18–300,97s. Altre40 gare a una buca coprono ogni pista con2–5 bot, inclusi DNF legittimi. [Tornei](tournaments.json), [regressione](regression.json). |
| Camera e fisica | 286 casi camera; collisioni veloci, pendenze, superfici, bumper, bracci/piattaforme mobili, cadute, precisione120Hz e cancellazione input. Solver, bot, camera e abilità non modificati. |
| Browser: controlli e rendering | Cinque client telefono; Xbox, PlayStation e pad generico simulati attraverso gli adapter reali; tiro/carica/annullamento, multitocco, camera/panoramica, cinque abilità, pausa, perdita del pad, rejoin e cleanup. Screenshot delle10piste ispezionati. [Dati](browser.json). |
| Browser: gare2–5 | Tre percorsi diversi, timeout di turno a15s, tre record per persona, punti globali e ritorno alla lobby. Simulazione accelerata dopo il primo timeout reale, senza forzare il risultato. [Dati](natural-rounds.json). |
| Browser: transizioni e parità | Cinque telefoni e tre pad assegnati, deadline configurata4s per isolare i casi: tasto tenuto fra buche, pausa, reload, tiro PlayStation dopo reset, tiro touch dopo fallback; spareggio AFK effettivo, cinque primi ex aequo con punti uguali e cinque righe visibili. [Dati](transitions-browser.json). |
| Risoluzioni | TV1280×720,1366×768,1920×1080,800×600; telefono390×800,360×640,844×390. Tabella finale1280 e800 controllata dopo correzione della spaziatura. |
| Regressione |16 suite passate: torneo, camera, fisica/turni, pad, round, abilità, bot, qualità, URL, animazioni, audio, Geofall, Backrooms, Kart, Cornicione, FPS. [Log](regression.json). |
| Versione compilata | Menu reali, un telefono e quattro bot, **tre piste diverse a velocità normale**, 337.60s dal via alla consegna del risultato;31 tiri touch,4skin Tripo caricate HTTP200,5 risultati e punti ScoreManager,nessun errore JavaScript. Il telefono del test tira senza correggere la direzione: DNF legittimo, tutti i bot imbucano3/3. Nessuna importazione DEV né risultato forzato. [Dati](production.json), [screenshot finale](production-results.png). |

Una prima prova del fallback touch nel test di transizione leggeva il pulsante appena montato ma ancora nascosto: il test ora attende disponibilità e visibilità reali prima del tocco. Una riesecuzione della prova ScoreManager ha selezionato casualmente punti doppi; il fixture è stato reso deterministico, mantenendo una prova separata esplicita dei punti doppi. Nessuna di queste prime esecuzioni viene dichiarata superata.

Gli hash dei dieci file Backrooms e degli otto file Geofall monitorati sono identici ai precedenti aggiornamenti, incluso PlayerInput e il catalogo abilità. [Confronto](prior-changes-preserved.json).

## Verifiche manuali residue

Da provare con controller fisici Xbox/PlayStation e su telefoni reali nella rete del playtest: latenza percepita,15s di mira con cinque umani e bilanciamento delle nuove piste. I pad delle prove browser sono simulati; i client telefono sono pagine browser reali con touch sintetico. Il campione RTX3050 nel browser ha misurato circa60fps, ma non è un benchmark di tutti i dispositivi.
