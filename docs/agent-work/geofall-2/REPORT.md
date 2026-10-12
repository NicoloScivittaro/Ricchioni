# GEOFALL 2.0 — report finale

GEOFALL ora usa il sistema delle abilità del progetto e contiene **175 domande**, mantenendo intatte le 100 precedenti. Restano 10 caselle, 3 vite, una spinta normale per domanda, crollo simultaneo delle 9 caselle sbagliate, valutazione alla scadenza, ultimo sopravvissuto e spareggio. Nessuna abilità fornisce risposte, vite o protezione dal crollo.

**Abilità e assegnazione.** La scelta del personaggio determina la variante in `AB.geofall`. È lo stesso catalogo condiviso degli altri giochi, ora con 70 definizioni, insieme ad Ability Hub, stati live, Companion Card e feedback privato. La simulazione Geofall resta l’unica autorità sugli effetti.

| Personaggio | Abilità | Limite e adattamento |
| --- | --- | --- |
| Goblin | Parata a tempo: annulla la prima spinta ricevuta nella finestra di 0,45 s | 2 usi per domanda, ricarica 5 s. Riusa la parata Arena, senza riflessione o attacco extra |
| BOSCHI | Per 2 s riceve il 35% dello slancio degli spintoni, ma cammina all’80% | 1 uso per domanda. Riusa la resistenza Arena, senza onda finale |
| Carbo | Riduce al 12% lo slancio ricevuto e interrompe lo stordimento | 1 uso dopo uno spintone. Riusa la frenata Minigolf, senza movimento automatico |
| Victor | Accelerazione al 120% per 0,8 s | 1 uso per domanda. Riusa l’accelerazione Pallavolo; deve scegliere la direzione |
| Ciro | Avvisa un avversario davanti entro 3 m, poi inverte brevemente i suoi comandi | Avviso 0,4 s, inversione 0,8 s; 1 uso, vietato negli ultimi 2,5 s; non cumulabile, immunità successiva di 1,5 s |

Ciro riceve una nuova variante contestuale nel catalogo esistente, riutilizzando la meccanica di inversione già presente nel modificatore dei controlli. Il suo salvataggio/debito del KO non è compatibile con il crollo Geofall. Non sono integrate abilità che rivelano indizi, regalano seconde vite, fermano il timer o aggiungono prese e proiezioni oltre la spinta normale.

**Comandi e bilanciamento.** RB/R1 attiva l’abilità; A/✕ rimane la spinta. Il telefono mantiene il dpad e aggiunge il pulsante ABILITÀ, con nome e stato reali. Tutte le difese vengono elaborate prima degli attacchi dello stesso frame, indipendentemente dall’ordine dei giocatori. Gli effetti terminano all’istantanea della risposta; le risorse ripartono alla domanda successiva. I bot rispettano le stesse condizioni di attivazione, portata, cariche e ricariche. La loro accuratezza geografica diminuisce con la difficoltà.

L’HUD si adatta all’altezza delle schede, evitando sovrapposizioni anche a 800×600. Il telefono Geofall riserva spazio per il banner fallback, compreso il formato orizzontale. Il riepilogo temporizzato inviato al telefono è quantizzato a 0,2 s; la simulazione conserva la precisione del passo fisso.

**Nuove domande.** Sono aggiunte 15 domande per ciascuna categoria: bandiere, confini, capitali, sagome e monumenti. Ogni categoria riceve 8 domande difficili e 7 estreme. Tutte hanno identificativo unico, una risposta corretta, nove distrattori distinti e riferimenti verificabili. Il confronto automatico conferma che i primi 100 oggetti domanda sono identici agli originali.

Sono aggiunti 16 vettori di bandiere, inclusa Irlanda come distrattore, 15 sagome da Natural Earth 50m e 15 illustrazioni schematiche originali di monumenti, senza nomi dentro i disegni. Le 20 bandiere precedenti erano icone normalizzate a 4:3: ora rispettano le proporzioni nazionali agli stessi percorsi. Sono controllati anche colori, simboli e rapporti delle coppie simili.

Le nuove capitali includono Bhutan, Laos, Mongolia, Kirghizistan, Namibia, Botswana e piccoli Stati oceanici e insulari. I distrattori dei confini appartengono allo stesso continente, sono scelti per prossimità ed escludono tutte le adiacenze reali. Il confine Botswana–Zambia omesso da GeoNames è corretto con una [fonte parlamentare](https://www.parliament.gov.zm/node/11873).

Sono evitati Palau e Kiribati, ambigui nel dato delle capitali consultato, e il confronto diretto Ciad–Romania: le sole sfumature non sono un criterio affidabile sulla TV. Sono invece presenti confronti distinguibili come Mali/Guinea, Irlanda/Costa d’Avorio e Indonesia/Monaco. Fonti, quesiti e criteri sono documentati in [SOURCES.md](C:/Users/niluf.PC-NIKO/Desktop/Ricchioni/docs/agent-work/geofall-2/SOURCES.md). Le pagine UNESCO sono state consultate tramite lo strumento web; i rifiuti HTTP dello script Python sono registrati come rifiuti, senza considerarli consultazioni riuscite.

**Progressione delle domande.**

| Round | Selezione | Timer |
| --- | --- | --- |
| 1–5 | 60% facili, 40% medie | 10 s |
| 6–10 | 65% medie, 35% difficili | 8 s |
| 11–15 | Difficili | 6 s |
| 16+ | 80% estreme, 20% difficili | 6 s |

Ogni blocco di cinque contiene tutte le categorie. I sacchetti mescolati sono separati per livello; la memoria delle ultime estrazioni riduce le ripetizioni, senza scartare domande disponibili. La progressione è verificata su 20.000 estrazioni. Le domande originali restano nei pool facile e medio; il timer non scende sotto sei secondi.

**Verifiche eseguite.**

- 10 gruppi dedicati: database, conservazione degli originali, dieci opzioni, confini, proporzioni, progressione, attivazioni, cooldown, spinte, difese, confusione, effetti simultanei e perdita della vita sulla casella sbagliata.
- 48 simulazioni complete con abilità per 2–5 giocatori, con 637 attivazioni valide e vincitori naturali; altre 48 simulazioni nella suite di fisica e spareggio esistente.
- 1.130 controlli del catalogo e delle abilità condivise; 12 suite di regressione, comprese abilità Kart e Cornicione, FPS ADS, pad, round, bot, audio, minigolf, qualità e animazioni.
- 22 gruppi Backrooms e hash del suo codice invariati: le correzioni precedenti sono preservate.
- Browser: cinque client telefono e tre famiglie di pad simulate sul percorso reale GamepadManager. Provati movimento, spinta, RB/R1, pulsante telefono, Companion Card, ricarica, avviso di confusione, pausa, fallback, riconnessione, spettatori, crollo e punteggi.
- Tutti i 106 SVG del runtime decodificati; rapporti di 36 bandiere verificati dal browser. Fogli degli asset e screenshot dell’interfaccia aperti e controllati.
- TV a 1280×720, 800×600 e regressione a 1920×1080; telefoni a 390×800, 360×640 e 844×390. Pulsanti entro i bordi, nessuno scroll e titolo visibile sopra i controlli.
- Stanze sorgente complete da 2, 3, 4 e 5 partecipanti: un telefono e posti bot. Per l’automazione l’umano è guidato dall’autopilota con gli stessi input; simulazione accelerata, risultato naturale, classifica, punti e ritorno lobby verificati.

Typecheck e build finali: exit 0; Vite 199.2 s. Rimane il warning già esistente sui grandi chunk generali Babylon/Phaser. Le stanze sorgente sono terminate in 121.6 s simulati (2 giocatori), 144.6 s simulati (3 giocatori), 197.1 s simulati (4 giocatori), 176.1 s simulati (5 giocatori).

**Versione compilata:** partita completa dai menu reali, con un giocatore fermo allo spawn e quattro bot. Verificati pulsante abilità, 106 SVG, quattro GLB Tripo, tre perdite naturali di vita, spettatore e classifica globale. Fine in 95.2 s dopo la prima schermata di gioco; spettatore dopo 37.4 s. Nessun import DEV, risultato forzato o errore JavaScript/WebGL rilevato. Screenshot iniziale, telefono e risultati controllati.

**File della fase.** Catalogo e dati in `shared/abilityCatalog.ts`, `geofallQuestions.ts/json`, `geofallCountries.json` e `minigames.ts`; comandi in `src/input/profiles.ts` e `src/controller/main.ts/style.css`; simulazione, bot e renderer in `src/minigames/geofall`, con il nuovo `geofallAbilities.ts`. Nuovi SVG e attribuzioni in `public/geofall/advanced`, correzione delle 20 bandiere esistenti, builder e test Geofall aggiornati. Report e prove sono in questa cartella; `dist/index.html` è aggiornato dal build locale.

**Verifiche manuali rimaste.** Controller e telefoni fisici sulla Wi-Fi reale, leggibilità sulla TV a distanza normale e bilanciamento con persone di diversa preparazione geografica. I livelli sono una classificazione editoriale iniziale: i bot non dimostrano il divertimento o il bilanciamento perfetto. Le illustrazioni sono stilizzate; il playtest potrà indicare quali richiedono più dettaglio.

[Versione compilata locale](http://127.0.0.1:3001/) · [Sorgente DEV](http://127.0.0.1:5174/). Nessuna dipendenza nuova, commit, push o deploy. `VERIFICATION.json` conserva risultati e log effettivi.
