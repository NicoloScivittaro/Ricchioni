# Ribaltati 3.0 · verifica del 19 ottobre 2026

Aggiornamento della versione presente in `3bbab91`, senza ricostruire il minigioco. Esecuzione diretta, senza Flash, nuove dipendenze, commit, push o deploy. Il server di anteprima è locale.

## 1. Sintesi

Kart sagomati e dettagliati, litorale più ricco, mare animato, nuvole tridimensionali, palme curve, materiali e illuminazione rivisti. Derapata, turbo, salto e oggetti hanno segnali più chiari. L'HUD comunica nome e pulsante dell'abilità e mantiene dimensioni corrette nello split screen. Le prove e i limiti sono distinti dalle intenzioni del progetto.

## 2. Modelli dei kart

Una soluzione riutilizzabile conserva le proporzioni specifiche di Goblin, Buttafuori, Dottore, Judoka e Ciro. La carrozzeria usa sezioni smussate, muso rastremato, prese d'aria, livrea a contrasto, paraurti tubolari, fari, scarichi aperti, diffusore, cofano ventilato, volante e sostegno del sedile. Ruote profilate a 20 segmenti, cerchi a cinque razze e battistrada. Le skin Tripo originali e il fallback restano attivi; quattro rig importati risultano pronti nel controllo browser, il quinto personaggio usa il percorso previsto dal progetto.

## 3. Animazioni

Rotazione ruote e sterzo anteriore conservati; aggiunti movimento della carrozzeria separato dalla fisica, risposta delle ruote anteriori in aria, beccheggio in salto, compressione e polvere all'atterraggio, inclinazione e tremore breve agli urti. Il pilota importato segue le inclinazioni del sedile. Test browser: compressione circa 0,20 m e sterzo visivo 0,336 rad; nessuna modifica della traiettoria fisica.

## 4. Materiali e luce

Shader della carrozzeria con colore, lucentezza ed emissione per vertice: vernice, metallo, inserti scuri e fari restano differenziati in una sola chiamata. Atlante procedurale condiviso per dettagli ambientali; asfalto meno striato, legno/stucco, sabbia e superficie portuale bagnata. Sole più caldo e contrastato, fill meno piatto. Mare con onde analitiche, variazione di profondità, riflesso del cielo, bagliori e schiuma costiera, senza render target riflettente per camera. Nuvole volumetriche e fog esistente.

Il bloom fullscreen della 2.0 è stato sostituito dalle emissioni dei materiali e dagli aloni già incorporati nelle insegne: è una modifica esplicita della presentazione e del costo del rendering, applicata al solo Kart. Non è stato abbassato il preset globale.

## 5. Settori

- Lungomare: stabilimenti/chioschi, ombrelloni, lettini, cabine a righe, panchine, fioriere, passeggiata e spiaggia che segue la nuova spline. Arredi della spiaggia a quota mare; fondazioni e appoggi per le strutture rialzate.
- Belvedere/viadotto: piattaforme panoramiche e parapetti, pilastri e luci bordo della 2.0 preservati, indicazioni laterali delle rampe e migliore lettura del mare sottostante.
- Paese: facciate di altezze e colori diversi, finestre incassate, persiane, davanzali, balconi con ringhiere, cornici, vetrine, tende a righe e botteghe.
- Porto: moli in legno con appoggi, bitte, corde, barche e container nervati. Gru funzionante con rinforzi e carico identificato, fascia di pericolo e materiale bagnato più leggibile.
- Paddock/bivio: garage, pneumatici, pannelli a scacchi al traguardo; corsia turbo con frecce ripetute e bordi luminosi, indicazione della corsia sicura.

## 6. Effetti di guida e 13 oggetti

Scintille blu/arancio/viola e fumo della derapata conservati e collegati a fanali/HUD; scie geometriche e particelle del turbo, timer residuo, altezza in salto, ombra di contatto e polvere all'atterraggio. FOV, audio e vibrazione già presenti rimangono collegati agli eventi reali.

| Oggetto | Presentazione verificata |
|---|---|
| Turbo | Scia, scarico, FOV e durata residua |
| Super turbo | Stesso linguaggio del boost, durata reale distinta |
| Sfera | Sfera rossa con fascia chiara, rotazione, esito per attaccante/vittima |
| Olio | Chiazza, fumo da slittamento, avviso al contatto |
| Scudo | Anello azzurro persistente finché lo stato è attivo; colpo evitato |
| Disturbo | Anello giallo inclinato/rotante, avviso al bersaglio e all'attaccante |
| Calamita | Modello a U e collegamento al bersaglio, cancellato alla rottura |
| Piccione | Modello e ali animate, feedback d'impatto e audio |
| Turbo difettoso | Razzi e fiamme pulsanti, timer effettivo |
| Buca | Bordo visibile, sobbalzo e messaggio locale |
| Raffica | Frecce animate, direzione e cue d'ingresso nella zona |
| Paraurti | Gabbia visibile e feedback degli urti |
| Mollone | Molla con estensione in volo e risposta dell'atterraggio |

Pesi, durate, scudi, traiettorie e bilanciamento invariati. Il callback aggiunto pubblica solo presentazione.

## 7. Camera e HUD

Traverse dei checkpoint rimosse; cartelli dei settori e delle feature spostati sul bordo; arco di partenza rialzato. Nessuna dissolvenza globale che possa influenzare altre viewport. La camera accompagna meglio rampa/salto e conserva il vincolo sopra la strada.

Risolto un difetto concreto di Babylon GUI: `scaleTo` ridimensionava la texture senza ricalcolare i font già misurati. Ora l'invalidazione avviene solo al cambio di dimensioni/layout. Messaggi temporanei più piccoli e sotto la zona centrale di guida. Abilità con nome dal catalogo, pulsante dal profilo e famiglia del pad associato, stato/carica; telefono indicato esplicitamente. Terzo giro con avviso locale e breve segnale sonoro, arrivo con bandiera/posizione/posa già legati al singolo partecipante.

## 8. Gameplay e ritmo

Spline **1305,659 m**, tre giri, fisica 120 Hz, velocità massima 44 e accelerazione 30 preservati. Nessuna nuova scorciatoia, ostacolo casuale o prestazione dipendente dalla posizione. Rifinita la lettura del bivio e della gru esistenti.

Gara browser naturale con cinque client guidati dalla logica bot esistente: primo arrivo **93,061 s**, 30 decolli, 8 sorpassi e 32 utilizzi di oggetti. Distanza tra concorrenti adiacenti: media 25,07 m, mediana 17,41 m, P90 60,67 m. È una singola gara automatizzata, non una valutazione del divertimento con cinque persone. La frequenza dei contatti fra kart non è stata strumentata in quella gara; lo zero del campo preparatorio `contacts` non costituisce una misura. Collisioni e ostacoli sono invece coperti dai test fisici.

## 9. Ottimizzazioni

Dettagli ambientali in un atlante e un batch condiviso; segnali raggruppati per materiale; carrozzeria in un solo shader; fanali posteriori accorpati. Ombre 1024 Poisson ancora attive: carrozzeria/ruote inviano una silhouette di profondità accorpata e i rig importati mantengono le loro ombre. La silhouette accorpata conserva la geometria della posa base; non segue ogni piccolo dettaglio della sospensione/sterzata. Una mappa direzionale aggiornata per frame è riusata dalle viewport. Eliminati i passaggi fullscreen del glow e il picking al movimento del mouse.

Nessun nuovo profilo adattivo, LOD aggressivo o taglio nascosto della risoluzione. Il sistema di qualità adattiva generale già esistente resta disponibile nel gioco; nei benchmark la scala è bloccata a 1.

## 10. Benchmark finale

| Misura | 2.0 iniziale | 3.0 finale |
|---|---:|---:|
| FPS medi, cinque visuali | 36.187 | **49.699** |
| Step CPU medio | 1.340 ms | 1.205 ms |
| Render medio | 25.382 ms | 18.150 ms |
| Render P95 | 33.700 ms | 24.000 ms |
| Draw call, ultimo frame | 748 | 407 |
| Mesh totali | 399 | 270 |
| Materiali totali | 178 | 228 |

**+37.3% FPS**. Obiettivo di circa 50 raggiunto nel campione (49,7); 60 FPS con cinque visuali non raggiunti. Ombre attive e scala1 in entrambi i campioni. Materiali totali aumentati per la presentazione, ma molti sono riusati o incorporati nei batch: non corrispondono a un draw ciascuno. Draw/mesh attivi variano durante il campione, non sono una costante della pista.

Bloom fullscreen presente nella baseline, sostituito da emissioni e halo incorporati nella versione finale come descritto sopra. Nessuna build, registrazione, transcodifica o altro browser di test concorrente nel campione finale; gli osservatori draw-by-draw diagnostici erano disattivati.

Una sola viewport, con cinque partecipanti (un client e quattro bot): **59.689 FPS**, render medio 6.169 ms. È una misura finale separata, non una nuova baseline iniziale a una viewport.

Metodo: Chrome headless con GPU hardware RTX 3050/D3D11, HIGH, 1280×720, 5 client/viewport, scala 1, ombre attive, stessi punti iniziali/speed/carico bot e campione di 8 s. Non è una garanzia di FPS su tutta la gara o altri dispositivi. Le misure diagnostiche intermedie restano separate.

## 11. Confronti visivi

`comparison.html` affianca 10 sezioni prima/dopo e un dettaglio del kart, acquisite dal renderer della gara reale. `layout-2/3/4/5.png` documentano l'HUD; `before/after-5view.png` il carico di confronto. Coordinate e stabilizzazione della chase camera uguali; HUD, avversari e oggetti temporanei possono variare. Nessuna scena promozionale separata.

## 12. Video e audio

Registrazione reale di **45,129 s**, 1280×720, circa 29,7 frame/s acquisiti: `ribaltati-3-gameplay.mp4` (H.264/AAC) e originale WebM (VP9/Opus). La camera segue un client guidato dal bot esistente e percorre oltre un giro, quindi attraversa tutti i settori; ci sono altri quattro bot. Non è un filmato a 60 FPS né una misura prestazionale.

File decodificato con FFmpeg e riprodotto in Chrome con avanzamento e seek a 18 s, senza errori (`video-streams.json`, `video-playback.json/png`). Audio del mixer dopo il limiter: **media -24,9 dB, picco -8,2 dB**. Non è silenzioso. Mute misurato a zero, ripristino/resume con segnale, bus SFX impostato e verificato a 0,25 poi ripristinato. Provati i cue di tutti i 13 oggetti e dell'arrivo; eventi naturali di turbo, urti, oggetti e atterraggi registrati nel JSON. La musica/motore restano udibili nel menu di pausa secondo il comportamento esistente; resume attivo.

La prima esportazione del video aveva separato male il data URL contenente la virgola dei codec: file scartato, parser corretto, registrazione rifatta e controllata prima della consegna.

Il mixer globale non è stato riscritto. Rimangono necessarie prove di ascolto sugli altoparlanti del sistema dell'utente.

## 13. File

Sorgenti limitati a `src/minigames/kart-race/`: `kartCoachwork.ts` e `coastalPresentation.ts` nuovi; aggiornati `kartEntity.ts`, `kartEnvironment.ts`, `track.ts`, `trackGuides.ts`, `trackSetPieces.ts`, `cameraHud.ts`, `items.ts`, `BabylonKartGame.ts`. Script di acquisizione/QA `scripts/e2e/ribaltati-3-*.mjs`. Artifact e log in questa cartella; `dist/index.html` rigenerato dalla build. Nessun file condiviso di fisica/input/audio modificato, nessun package/lock cambiato.

## 14. Test eseguiti

- Typecheck e build finale superati (3800 moduli, 3m31s): vedere `build.log` (bundle Babylon grande, warning preesistente sulle dimensioni dei chunk).
- 24 gare fisiche complete con 2–5 bot a 30/60/120 Hz: geometria, checkpoint, rampe, collisioni cargo, scudo/salto, corsie, respawn e classifica timeout.
- 336 campioni di camera/split con proiezione del kart nella propria viewport e vincolo sopra la strada.
- Browser con 2/3/4/5 telefoni emulati: input reale del controller HTML, pausa, identità al reload, gara naturale completa e ritorno alla lobby.
- 392 raggi camera-kart senza strutture occludenti, layout e font misurati, sospensioni/sterzo, caricamento rig, eliminazione di motore/scena/25 sistemi particellari/canvas 3D.
- 13 oggetti, cinque abilità, contatti, olio, pad, bot e rotazione round: selftest superati.
- Gamepad simulati Xbox/DualSense: analogico, trigger, drift press/hold/release, item one-shot, abilità, pausa, disconnessione senza input fantasma, fallback telefono, reconnect e 2–5 pad associati in ordine inverso.
- Backrooms: 41 gruppi; Geofall: domande e partite bot; Minigolf: gare sui percorsi; Cornicione: simulazione/abilità/proiettili più browser con dodge, dash, muro, salto, ring-out e respawn Tripo. Test qualità e temi audio superati.

Smoke della build compilata su porta 3007: un telefono touch e quattro bot, 18 s di gara, pausa/lobby e caricamento dei modelli, senza errori.

Log e JSON conservano i risultati effettivi. Un primo controllo di cleanup era eseguito prima dell'arrivo dello stato LOBBY: corretto il test per attendere la transizione, poi verificata la reale distruzione delle risorse.

## 15. Limiti e prove manuali

Circa 50 FPS raggiunti solo nel campione di confronto; 60 con cinque visuali non raggiunti. Nessuna garanzia di assenza di cali lungo tutto il circuito. I raggi di controllo escludono molte occlusioni strutturali ma non sostituiscono una prova umana di ogni traiettoria/urto possibile. Nessun profilo di memoria lungo ore né prova con cinque persone, cinque gamepad fisici e telefoni su rete Wi-Fi reale. La qualità delle animazioni e il bilanciamento percepito richiedono playtest umano. Ambiente sempre stilizzato/procedurale, senza asset commerciali o texture esterne.
