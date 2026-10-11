# Ribaltati, Pallavolo e collisioni — report

Richiesta dell'11 ottobre 2026, baseline `487ff47`. Modifiche implementate per milestone, con commit locali; nessun push o deploy. Le cinque milestone sono completate e verificate; dati, log e catture sono conservati insieme a questo report.

## Ribaltati: olio e tredici oggetti

L'olio precedente creava un cilindro senza assegnargli una posizione: restava all'origine. Il materiale viola opaco e il diametro ridotto non comunicavano l'area effettiva. Attraversarlo chiamava inoltre `hitKart`, tagliando la velocità e disabilitando lo sterzo: era uno stordimento, anziché una perdita di aderenza.

Ora la chiazza è scura e lucida, con bordo iridescente e riflesso, misura 4,8×3,4 m e segue la superficie della pista campionata dalla spline, comprese curve e rampe. Il rialzo e l'offset di profondità evitano interferenze col terreno. Rimane 18 s. Il contatto applica 1,6 s di grip laterale ridotto, con recupero progressivo, inerzia dipendente da velocità e sterzata, fumo delle gomme e suono. Non azzera la velocità e non blocca lo sterzo. Scudo, invulnerabilità e debito di Ciro mantengono le loro regole.

I sei oggetti originali restano: Turbo, Super Turbo, Sfera d'urto, Olio, Scudo e Disturbo. I sette nuovi portano il catalogo a **13**:

| Oggetto | Effetto e limite | Controgioco / costo |
| --- | --- | --- |
| 🧲 Calamita infame | Trazione per 3 s sul kart davanti, entro 24 m; collegamento visibile | Si spezza oltre 30 m, uscendo dalla corsia, saltando o dopo uno schianto; occorre sterzare |
| 🐦 Piccione kamikaze | Volo frontale leggibile per 3 s, senza inseguimento; contatto: instabilità per 0,85 s | Spostarsi lateralmente, saltare o usare lo scudo |
| 🚀 Turbo difettoso | Boost più forte del Turbo per 1,8 s | Sterzo ridotto al 58%: rischio in curva |
| 🕳️ Buca del Comune | Superficie segnalata per 12 s; piccolo sobbalzo e grip perso per 0,7 s | Salto o passaggio laterale; posizionamento limitato alla pista |
| 🌬️ Raffica laterale | Area di vento per 7 s, con frecce animate che mostrano la direzione | Compensare sterzando o passare fuori; forza ambientale, non proiettile |
| 🚧 Paraurti abusivo | Per 5 s maggiore resistenza e trasferimento d'impulso nei contatti fisici | Sterzo all'85%; nessuna protezione dai proiettili |
| 🌀 Mollone | Salto di circa 0,9 s, per superare gli ostacoli bassi | Atterraggio storto e veloce può provocare instabilità |

Ogni item ha modello/effetto, icona, descrizione e suono dedicati. Il tasto oggetto resta quello esistente. Catalogo condiviso fra HUD e telefono; pesi interpolati per posizione, senza premio garantito all'ultimo. Nel campionamento dei test Super Turbo e Turbo difettoso insieme restano sotto il 13%. Le abilità dei personaggi sono separate. Un cubo viene assegnato a un solo kart; la roulette non consegna oggetti a chi ha terminato. Effetti temporanei, materiali e mesh sono smaltiti al cambio round.

Verifica browser: tredici utilizzi singoli; cinque kart, Xbox/PlayStation/generico simulati e touch; gara con effetti misti; catture 1280×720 e 1920×1080. Dopo 20 ripetizioni: **349→349 mesh, 168→168 materiali**. Tutti i nuovi item sono stati aperti nelle catture: la Raffica è stata corretta da disco invadente ad anello e il Mollone abbassato per rendere visibile la molla sotto il telaio. L'olio attraversato a velocità 44 mantiene velocità 44 e stun 0.

Evidenze: `oil-browser.json`, `items-browser.json`, `items-targeted.json`, `oil-five-1280.png`, `items-mixed-five.png`, `item-*.png` in questa cartella.

## Pallavolo: lo stick determina l'impulso

Prima la scelta laterale non influenzava adeguatamente il tiro. Ora, al contatto, lo stick determina velocità e traiettoria reali: sinistra/destra corrispondono ai lati visibili sulla TV per entrambe le squadre; su produce un tiro più teso, giù un pallonetto, neutro conserva il tiro standard. Il tiro avanza sempre verso il campo avversario. Nessuna nuova ricerca automatica della zona libera.

Colpo normale, pallonetto, colpo angolato e schiacciata rimangono distinti; timing, Muro e cinque abilità preservati. La direzione laterale è limitata per permettere alla palla di superare la rete anche da fondo campo. Una freccia di 1,45 m, vicino al pallone e per breve tempo, comunica la scelta. CONTROLLI e telefono spiegano le direzioni.

La rete usa il segmento percorso dalla sfera e l'altezza al contatto. Il punto sul terreno scatta al raggio della palla, anziché quando il centro è già sotto il campo. Rimbalzo di Ciro riallineato alla superficie. Squadre, punteggio, cooldown e condizioni di vittoria conservati.

Verifica: **12 tiri preparati**, sei per squadra (sinistra, destra, neutro, teso, lob, schiacciata), proiezione della freccia controllata rispetto alla TV, input pad e telefono con due tocchi simultanei. Partita con cinque bot conclusa dal gioco, accelerando la simulazione e senza forzare `finish`. Test fisici 30/60/120 e suite delle abilità passati. Catture `volley-red-left.png`, `volley-blue-right.png`, `volley-red-lob.png` e telefono aperte e ispezionate; dati `volley-browser.json`.

## Collisioni: problemi dimostrati e correzioni locali

**Cornicione.** Il volume offensivo si attivava prima che il sampler raggiungesse il fotogramma di contatto; blend e molle potevano aggiungere ritardo. Ora la clip raggiunge il contatto all'inizio della fase attiva, lo mantiene nella sua finestra e recupera nei tempi originali. Lo stesso orologio governa le quattro skin native e Victor/fallback. Melee e oggetti usano sweep relativi, limitati alla parte temporale valida; una vittima viene colpita una volta per attacco. Schivata, intangibilità, parata, counter di Carbo, recovery e discontinuità delle abilità conservati. Nessuna variazione ai dati di danno, knockback, portata e recupero in `fighterData.ts`.

I volumi rimangono arcade e comuni a tutti: **in alcune pose il limite estremo del calcio supera la posizione del piede**. Una scia presente soltanto nella fase attiva comunica la portata. Non è una promessa di coincidenza perfetta fra mesh e hitbox; ridurre quella portata o introdurre uno spostamento del corpo richiede una scelta di bilanciamento. Confrontate 30 pose (cinque personaggi, pugno/calcio, anticipo/attivo/recupero) e cinque impatti effettivi, oltre ai test delle altre mosse. Screenshot prima/dopo e dati `corn-before.json`, `corn-after.json`.

**Sparatoria.** Lo splash controllava solo la distanza, colpendo attraverso i solidi. Ora verifica la visibilità del corpo su tre altezze: un container protegge, una copertura bassa può lasciare il busto esposto. Esplosione appena prima della superficie; anche il pavimento intercetta il raggio. Corretto il caso del giocatore incorporato in un AABB, dove la normale nulla impediva di uscire. Sei armi e protezione spawn preservate. Browser: bersaglio esposto 60 HP, dietro container 100 HP, protetto allo spawn 100 HP; tutte le sei armi bloccate dalla copertura.

**Dodgeball.** Il controllo a fine frame perdeva attraversamenti veloci; la schivata poteva comunque provocare rimbalzo e knockback. Sweep relativo con corpo in movimento e sotto-passi ≤1/120 s; la palla attraversa il giocatore invulnerabile senza contatto. Parata, raccolta, eliminazione e abilità preservate. Verificati colpo, schivata, riflessione e corpo che attraversa la traiettoria a 30/60/120; stress dichiarato a 240 unità/s, superiore alla velocità normale.

**Kart e Calcio.** Sotto-passi locali ≤1/120 s per evitare attraversamenti rapidi, senza modificare il clock globale. SAT e impulso dei kart restano fisici: contatto a velocità 80 contro -18 registrato; a dieci metri di distanza entrambi restano a velocità 40. In Calcio il gol considera l'apertura al punto di attraversamento e il raggio rispetto ai pali. Tiro veloce deviato con lo stesso esito a tempo simulato equivalente a 30/60/120.

**Arena, Casa Carbo, Minigolf.** Audit dei solver esistenti, senza riscritture gratuite. Arena ha già sweep della spallata, corpi comuni, impulso solo nei contatti convergenti ed eliminazioni prima della Sudden Death. Casa Carbo usa solidi della mappa e sotto-passi; il secchio è possesso/quantità, non un proiettile fisico. Minigolf è realmente presente, con passo spaziale, bordi a capsula, altezza, palline, ostacoli mobili e reset sicuro. Suite pertinenti passate. Quiz e Memoria verificati come interfacce.

Dettaglio tecnico e limiti: `COLLISION-AUDIT.md`.

## Debug di sviluppo

Estesa l'infrastruttura Cornicione esistente: `?fighter=1`, H e F3. Verde: hurtbox; rosso: attacco/proiettile; blu: ambiente fisico; viola: direzione; giallo: contatto recente; magenta: incongruenza di fase. Legenda discreta, registro limitato a 24 contatti, ultimi tre eventi in F3. Creazione su richiesta e pulizia alla chiusura.

La build di produzione esclude il laboratorio, l'accesso `window.__fighter` e la legenda anche con `?debug=1&fighter=1` e premendo H. Verificato nel browser, non dedotto soltanto dal codice.

## Regressione e risorse

- **Typecheck e 25 suite:** PASS; `selftests.json`. Comprendono item/olio/contatti Kart, direzione Volley, Arena, FPS ADS/mira, core/strategia/oggetti/abilità Cornicione, animazioni, skin, Casa, Minigolf, pad, 1.064 verifiche del catalogo abilità e layout nomi Calcio. Dopo gli ultimi cambi al core sono state ripetute le suite pertinenti.
- **Matrice 13/13:** PASS; due telefoni, ingresso, fine, risultati e round successivo per ogni gioco. La fine è forzata dalla fixture per verificare il flusso: non equivale a tredici partite naturali.
- **Cinque giocatori:** verificati nei giochi modificati con pagine telefono e controller simulati, incluse le quattro skin Tripo e Victor. FPS: cinque camere/ADS indipendenti, input touch simultaneo mira/sparo/visuale/movimento; 59,86–60,12 FPS nelle cinque campionature su RTX 3050, 382 mesh. Non è una garanzia per altri dispositivi.
- **Pausa e riconnessione:** PASS; timer fermo/ripartenza Cornicione e Kart, test Volley e FPS, ritorno dei telefoni senza duplicare playerId, disconnessione che non blocca la fine.
- **Produzione Cornicione:** PASS; un telefono e quattro bot, lancio caricato reale e cooldown, cinque risultati dopo battaglia a tempo reale, senza accelerazione, nessun pageerror. `production-corn.json` e screenshot ispezionato `production-corn.png`.
- **Telefoni:** l'audit iniziale ha trovato tre pulsanti tagliati a 800×390 (Quiz, Volley, Minigolf). Layout corretti solo in orizzontale per quei giochi; tasti ≥44 px. Audit finale: **39 combinazioni** (13 giochi × 390×800, 800×390, 360×640) PASS. Le nove combinazioni dei tre giochi corretti passano anche sulla build di produzione, con verifica che il centro dei pulsanti sia realmente raggiungibile e non coperto. Screenshot nuovi di sviluppo e produzione aperti e ispezionati; `controllers-final.log`, `production-controllers.json`.
- **Risorse:** nessun canvas, overlay, timer, oscillatore o listener residuo nella prima prova di 13 round. La soglia heap è fallita: 39→67 MB durante il caricamento progressivo. Prova aggiuntiva **PASS: 26 round ordinati, cinque telefoni, cinque riavvii partita**. Primi 13 round di caricamento, secondo ciclo con 10 campioni heap (tre round raggiungono il podio, verificato separatamente). Crescita fra medie del primo/ultimo terzo dopo il warmup: host **+1,0 MB**, telefono circa **+2,9 MB**; timer7, listener22, canvas1, overlay3D0, oscillatori non musicali0 nei campioni misurati. `leak-warmed.json`. Una prima ripetizione si era fermata al riavvio: lo script cliccava PRONTO prima che FPS smontasse il telefono. Corretto il test attendendo il pannello lobby e tutti i giocatori pronti, senza cambiare networking o flusso. Conservati `leak-five.log` e `leak-warmup-restart-failure.log`: gli esiti iniziali non vengono cancellati né presentati come PASS. Le misure non dimostrano assenza universale di perdite in sessioni illimitate.
- **Build:** prima build PASS in 3m52s; **build finale PASS in 4m36s**, compreso typecheck, dopo le correzioni CSS. `build-final.log`. Vite segnala chunk Babylon grandi: nessuna compressione degli asset o modifica del caricamento fuori scope.

**Prestazioni Kart:** cinque viste, quattro skin native, quinta procedurale e simulazione live guidata dalla logica bot esistente. Prime campionature 22–34 FPS con caricamenti/assestamento; prova separata con 10 s di warmup e nessun altro E2E attivo: **37,6–41,6 FPS a 1280×720, 38,3–41,6 a 1920×1080**, buffer nativo, ombre attive. Nel profiling finale `scene.render` circa23,7 ms/frame, step circa1,8 ms/frame: il costo principale misurato è il rendering, non lo sweep fisico. Non viene promesso un target60 FPS a cinque viste. Dati `kart-performance-warm.json`, catture nelle due risoluzioni aperte; il vecchio avviso CHECKPOINT risulta ancora molto grande nella cattura dopo il cambio a1920, da rifinire in un intervento UI dedicato. Modelli e texture originali conservati.

I test 30/60/120 applicano quei delta di simulazione; non affermano che il dispositivo abbia renderizzato 120 FPS. Le fixture di collisione preparano posizioni e pose e sono dichiarate tali. I test controller simulano pad, mentre i tocchi attraversano la pagina telefono e Socket.IO: restano da provare controller fisici e Wi-Fi reale.

## File e commit

M1 `868c750`; M2 `a5586f2`; M3 `a91e869`; M4 `300c7b1`; M5 nel commit che contiene questo report.

- Kart: `itemCatalog.ts`, `itemSurface.ts`, `itemVisuals.ts`, `items.ts`, `raceTypes.ts`, `kartPhysics.ts`, `kartCollisions.ts`, `kartEntity.ts`, `abilities.ts`, `cameraHud.ts`, `BabylonKartGame.ts`.
- Volley: `volleyballShot.ts`, `BabylonVolleyballGame.ts`; comandi in `src/input/profiles.ts` e `src/controller/main.ts`.
- Cornicione e pose: `fighterCore.ts`, `fighterFx.ts`, `BabylonCornicioneGame.ts`, `arenaEntity.ts`, `goblinAnimator.ts`, `goblinRigAnimator.ts`, `proceduralSkinAnimator.ts`, `src/dev/fighterLab.ts`, `src/app/main.ts`.
- Altri contatti: `shared/fpsCover.ts`, `shared/fpsMap.ts`, `FpsScene.ts`, `BabylonDodgeballGame.ts`, `BabylonSoccerGame.ts`; audio in `AudioManager.ts`; layout telefono in `src/controller/style.css`.
- Test: nuovi selftest collisioni/olio/item/Volley, aggiornamento aspettative animazioni, E2E per item/pose/collisioni/traiettorie/produzione, runner regressione e diagnostica risorse. Evidenze conservate in questa cartella.

GameManager, ScoreManager, pairing, networking, rullo, roster, modelli e texture non modificati.

## Prossimo playtest umano

Valutare rischio e utilità dei sette item, leggibilità in gara veloce, durata dello skid e atterraggio Mollone; tiro angolato e difesa Volley nei due campi; contatto e punibilità Cornicione, soprattutto al limite della portata arcade. Provare latenza telefono e controller fisici con cinque persone. I numeri sono un punto di partenza verificato, non bilanciamento definitivo.

## Ripetere le verifiche

`npm run typecheck`, `node scripts/regression-physics.mjs` e `npm run build`. Per gli E2E avviare server3001 e Vite, impostare `HOST_URL` e `CTRL_URL` alla porta Vite effettiva, quindi `node scripts/regression-browser-physics.mjs` (il runner usa già il warmup e due cicli deterministici). I test `collision-production.mjs` e `controller-production.mjs` richiedono la build appena generata servita su3001.

Dopo le prove è stato ripristinato il file generato `dist/index.html`, come prescrive la documentazione del progetto; la build non fa parte dei commit sorgenti. Per servire di nuovo la versione di produzione eseguire prima `npm run build`. Il client di sviluppo delle prove resta disponibile su5174.
