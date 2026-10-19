# Ribaltati — Strada Arcobaleno 1.3

Aggiornamento del gioco esistente, eseguito direttamente senza Flash, commit, push o deploy. Le modifiche precedenti alla votazione delle mappe sono conservate. [Galleria con dieci confronti e video](preview.html).

## Problemi corretti

- Il camion del Judoka aggiungeva spostamenti laterali a ogni contatto: dodici chiamate consecutive producevano **10,8 m di spostamento istantaneo**. Ora applica un impulso fisico limitato, con tregua di 1,8 s per coppia. In aria l'impulso è ridotto e la velocità resta almeno all'82% del tetto normale.
- Il recupero del Buttafuori riportava al checkpoint anche dopo uno schianto sulla strada. Ora riparte nella posizione effettiva; usa il checkpoint soltanto durante caduta/respawn. In aria può stabilizzare un kart realmente disturbato, senza ricentrarlo o assegnargli un atterraggio.
- La risposta retroattiva di Ciro non restituiva la velocità persa e poteva azzerare l'altezza durante il volo. Ora ripristina la velocità precedente al colpo e conserva la quota; il debito resta dovuto.
- Colpi ripetuti potevano moltiplicare il rallentamento. Il colpo apre una breve protezione; stordimento e impulsi hanno limiti finiti.
- La previsione dell'atterraggio assumeva velocità costante. Ora integra anche decelerazione, turbo, sbandamento e fine dei bonus.
- Nella planata corta la tangente della linea centrale arriva quasi alla verticale. La camera poteva avvicinarsi a circa **2,74 m** e mostrare il fondo del kart. Ora il distacco della camera in aria usa la direzione orizzontale, il kart mantiene un assetto di volo e il salto corto ha un'inquadratura più alta. Controllati anche i margini dello schermo, oltre alle occlusioni.

La registrazione originale citata nel documento, con cadute a 00:23 e 02:26, **non era allegata**: non attribuisco quelle cadute a una causa certa. Le correzioni sopra riguardano difetti riprodotti nel codice e nei test. Le cadute registrano ora una causa diagnostica: bordo strada, corridoio aereo, piattaforma mancata o limite della planata. Le soglie originali di caduta restano invariate.

## Grafica, spazio e materiali

Il nuovo ambiente comprende una panoramica procedurale con nebulose e polvere cosmica, stelle lontane sul cielo, un secondo livello di stelle nello spazio e tre pianeti, uno con anelli. Gli oggetti lontani producono parallasse rispetto al cielo. Le mesh statiche sono unite/congelate quando possibile; nessuna nuova luce dinamica, ombra o catena di post-processing per giocatore. La distanza visibile delle camere Arcobaleno è stata estesa per includere il cielo.

Le piastrelle conservano texture, UV e geometria del GLB. Sono stati ricalibrati componente emissiva, riflessi della strada e risposta dei materiali dorati. I grandi cerchi azzurri sono sostituiti da poche guide laterali aperte; restano cornice e zona di arrivo. Marker e indicatore del proprietario sono più piccoli. Segnaletica delle due planate più chiara.

Ali con supporti, cerniere e montanti meccanici, pannelli mobili, apertura/chiusura progressiva e scie leggere. Gli effetti delle abilità usano colori distinti e i sistemi di particelle già presenti: verde Goblin, ciano Dottore, oro Judoka, arancio recupero e viola Ciro. Gli aloni usano materiali emissivi, senza aggiungere luci per ogni kart.

## Planata e camera

Il profilo di sollevamento, gli ingressi/uscite dei due gap e la fisica di sterzo di base restano quelli esistenti. Le abilità applicano i propri bonus finiti anche al ramo fisico aereo. Lo sterzo conserva correzioni umane e inerzia; non segue una traiettoria obbligata.

La planata lunga ha una ripresa panoramica arretrata. La corta prepara un'inquadratura più alta e ampia per rendere leggibile il dislivello della piattaforma. In aria la direzione della camera e l'assetto visivo non ereditano la quasi verticale del tratto nascosto della strada. Il campo visivo comunica anche l'accelerazione del Dottore. Restano apertura delle ali, effetto di lancio, rumore del vento, compressione all'atterraggio, chiusura delle ali, impatto e piccolo feedback della camera.

Il marker stima il punto d'arrivo con una piccola integrazione limitata, usando lo stato attuale e il rilascio dello sterzo. Nei quattro casi controllati sui due gap, con/senza turbo, l'errore rispetto al successivo atterraggio è **4,3–5,0 cm a 120 Hz**. Successive sterzate o colpi possono cambiarlo: il marker non garantisce l'atterraggio. Il percorso ordinario senza deriva usa un ritorno rapido per evitare calcoli inutili sui bot.

## Le cinque abilità prima/dopo

Valori effettivi da `shared/abilityCatalog.ts`; durata e cooldown sono in secondi. Il sistema resta `CharacterAbilities`, condiviso da TV e telefono.

| Personaggio / abilità | Prima | Versione 1.3 | Attivazione e limiti |
|---|---|---|---|
| **Goblin — SO GUIDARE IO** | 6 s di mini-turbo da drift ×1,6; nessuno scatto immediato. Barra a merito, senza cooldown esplicito. | Scatto **2,2 s**, potenza 32, tetto normale da **44 a 54,56 (+24%)**; conserva drift ×1,6 per 6 s. Cooldown **18 s** e barra. | Barra piena; urto/caduta interrompe la finestra drift. Il normale mini-turbo massimo resta 26 per 1,5 s: lo scatto speciale è più forte. |
| **Buttafuori — RIBALTATO MA NON MORTO** | Un uso a gara; finestra 1,2 s; ritorno al checkpoint anche sulla strada; turbo 20 per 0,9 s. | Una carica ogni **26 s**; finestra **2 s**; recupero sul posto e turbo **28 per 1,6 s**, stabilità 1,6 s e breve protezione. In caduta torna al checkpoint valido. | Serve schianto grave, finestra di recupero o instabilità aerea osservabile. Non dà uno scatto gratuito in condizioni stabili e non cambia la distanza in aria. |
| **Judoka — CARICO E SCARICO** | Camion 5 s, sterzo −25%, bersaglio al 70% per 1,2 s; spinta ripetuta per frame. Barra a merito. | Camion **5 s**, sterzo **−15%**, assorbe **un oggetto** e resiste agli urti. Bersaglio al **65% per 1,6 s**, impulso 5; in aria tetto 82% e impulso 1,75. Cooldown **22 s** e barra. | Occorre contatto reale; tregua **1,8 s per coppia**. Non colpisce un altro camion. Scudo/protezione possono bloccare il colpo; urto grave ferma la modalità. |
| **Dottore — 20 KG IN UN MESE** | 6 s, accelerazione ×1,35 e carica drift ×1,8; stessa velocità massima. Molto vulnerabile alle collisioni. | **6 s**, accelerazione **×1,8**, carica drift **×2**, tetto **×1,12 = 49,28**. Cooldown **20 s** e barra. | Resta leggero e più vulnerabile agli urti. Ridotta la reazione fisica eccessiva che lo scaraventava via. Il limite torna normale alla fine. |
| **Ciro — PAGO DOPO** | Un uso; anticipo 0,5 s o risposta entro 0,6 s; penalità intera dopo 4 s. | Una carica ogni **24 s**; anticipo **2 s** o risposta entro **1,2 s**; debito dopo **8 s**, stordimento/disturbo/olio al **60%**, velocità al 65% durante lo stordimento differito. Risposta retroattiva ripristina la velocità precedente; protezione 0,8 s. | Rimanda un colpo compatibile, senza annullarlo: lo stordimento differito rallenta ancora al pagamento. Non recupera da una caduta; in aria non azzera quota e non applica il rimbalzo terrestre. |

Le abilità a barra si ricaricano anche guidando; drift, checkpoint puliti e sorpassi conservano il guadagno a merito. Ricarica passiva soltanto quando l'effetto non è attivo; il cooldown minimo impedisce il riuso anticipato anche con barra piena. Le cariche reattive tornano dopo la ricarica e, per Ciro, dopo il pagamento del debito.

## Vantaggio misurato

Prova riproducibile: stesso rettilineo, acceleratore premuto, **10 s a 60 Hz**, partenza alla velocità normale **44**, stessa condizione iniziale per caso con/senza abilità. Recuperi provati subito dopo un colpo. Le misure aeree isolano il ramo fisico aereo su un tratto di prova; i veri gap sono verificati separatamente. Valori confrontati alla simulazione priva di attivazione dello stesso caso, non alla durata di una gara completa.

| Abilità | Prima: guadagno a terra / in aria | 1.3: guadagno a terra / in aria | Significato |
|---|---:|---:|---|
| Goblin | 0 / 0 m | **24,15 / 22,99 m** | Circa 0,55 s equivalenti a 44. Da 15 m dietro passa avanti dopo **1,5 s** sul rettilineo controllato. |
| Dottore | 0 / 0 m | **31,74 / 26,63 m** | Circa 0,72 s equivalenti a 44. Da 15 m dietro passa dopo **2,9 s**. Lo zero precedente riguarda la partenza già a regime: il vecchio bonus accelerazione aiutava dalle basse velocità. |
| Buttafuori | −9,51 m / non previsto in questa misura | **91,59 m** / stabilizzazione verificata sui due gap | Caso specifico: colpo da 1,3 s a distanza 100, checkpoint 20. Prima il ritorno indietro annullava il beneficio; ora il recupero sul posto evita quella perdita. Non è un guadagno universale per ogni schianto. |
| Ciro | −12,94 / −30,57 m | **42,37 / 27,10 m** | La finestra di 10 s include il pagamento del debito. Misura la difesa contro quel colpo, non un turbo gratuito. |
| Judoka | **9,68 m persi dal bersaglio** | **17,72 m persi dal bersaglio** | Prova separata del solo rallentamento: stessi 10 s a 60 Hz, due kart inizialmente a 62 e successivo rientro al tetto normale, parametri catalogo prima/dopo sullo stesso solver neutro. |

Per Judoka sono verificate anche protezione contro un oggetto, mantenimento del momento nel solver di collisione, fine della corazza e impulso finito. Il confronto visivo/runtime di dodici contatti mostra il passaggio da 10,8 m di spostamento immediato a **zero teletrasporto laterale**, velocità laterale 1,75 e rallentamento aereo limitato.

In una simulazione di **170 s con occasioni continuamente disponibili**, il limite di utilizzi utili è Goblin **9**, Dottore **8**, Judoka **7**, Buttafuori **7**, Ciro **7**. Il confronto precedente senza meriti dava zero ricariche per le tre barre e un uso per ciascuna carica: non significa che nella vecchia gara le barre restassero sempre vuote, perché i meriti erano già presenti.

Turbo speciali, mini-turbo e oggetti usano massimo della potenza/durata, senza somme illimitate. Un oggetto più forte resta utile. I tredici oggetti e le loro restrizioni aeree sono conservati: gli effetti solo a terra restano in inventario durante la planata.

## Bot e ritmo

I bot generano gli stessi comandi dei giocatori. Goblin aspetta stabilità e strada avanti o una planata; Dottore cerca accelerazione/tratto stabile; Judoka un rivale raggiungibile entro 14 m, nella stessa modalità e corsia compatibile. Buttafuori reagisce al recupero o alla deriva aerea; Ciro usa la finestra visibile dopo un colpo. Cooldown, cariche, durata e intensità sono quelli comuni. Nessuna conoscenza di eventi futuri e nessuna velocità legata alla classifica.

**22 prove mirate** verificano occasioni presenti/assenti, aria/terra, rispetto della ricarica e mancata interferenza con il giocatore umano. Sono inclusi i sorpassi controllati di Goblin e Dottore descritti sopra.

Nella gara finale tutti e cinque hanno concluso i tre giri: **2:42,5–2:47,8**, **30 decolli e 30 atterraggi**, **9 sorpassi**, **27 oggetti usati**. Attivazioni: Goblin 9, Dottore 8, Judoka 3, Ciro 2; nessuna occasione consumata dal Buttafuori. È avvenuta **una caduta dalla strada** del Dottore a 129,26 s, laterale −7,07 m oltre il bordo, con abilità inattiva, seguita da recupero e arrivo. Nessuna caduta in planata. Questo è un campione, non una garanzia di assenza di errori.

Il maggiore intervallo tra due usi di oggetti è circa 26,2 s; le altre abilità e i sorpassi sono contati separatamente. Non ho introdotto correzioni nascoste in base alla posizione.

I dati della gara completa finale sono in [natural-race.json](after/natural-race.json). Non considero una singola gara una prova di equilibrio delle vittorie o di pari utilità in tutte le situazioni. Non ho aggiunto oggetti o recuperi artificiali: catalogo e distribuzione originali conservati.

## HUD, finale e audio

Pannello più compatto e testi di volo ridotti: distanza residua e `IN LINEA / CORREGGI`. Restano posizione, giro, minimappa, oggetto, abilità e carica. Nome, tasto effettivo del dispositivo, stato pronta/attiva/ricarica, tempo e feedback leggono lo stato reale dell'abilità. Rimossi i flash continui dei checkpoint su Arcobaleno; il merito continua ad essere assegnato.

Finale Arcobaleno di quattro secondi con vincitore e tutti i partecipanti, nome, posizione e tempo/giro. Segue la normale classifica con `ScoreManager`, senza sostituirne i punti. Anche la schermata precedente mostrava cinque partecipanti quando completata: il cambiamento è la presentazione dedicata.

Cinque nuove firme sonore brevi, più un suono di blocco, sul mixer esistente: scatto Goblin, tono ascendente Dottore, camion grave Judoka, ripartenza Buttafuori, rinvio Ciro. Restano motore, drift, oggetti, lancio, vento, impatti e arrivo. Nessun loop nuovo per le abilità. Verificato nel test finale: cinque motori creati e tutti arrestati, zero voci residue, pannello finale rimosso e un solo canvas al ritorno in lobby. [Esito della pulizia audio](after/audio-cleanup.json).

## Prestazioni

Protocollo: **RTX 3050 reale**, Chrome/ANGLE D3D11, **1280×720**, HIGH, **cinque camere**, scala di rendering bloccata a **1**. Stesso avvio e posizioni distribuite lungo il percorso, riscaldamento prima della finestra di circa 8 s, nessuna registrazione o build contemporanea alla misura.

| Misura | Prima, due campioni | 1.3, due campioni |
|---|---:|---:|
| FPS: media dei due campioni | 47,51 | **56,64** |
| Intervallo FPS | 46,33–48,70 | **55,20–58,07** |
| Frametime medio | 21,06 ms | **17,67 ms** |
| Frametime p95 nei due campioni | 33,40 / 33,40 ms | 16,80 / 33,40 ms |
| Render CPU medio | 18,03 ms | 13,91 ms |
| Render CPU p95 | 28,00 / 29,30 ms | 19,20 / 23,10 ms |
| Draw nell'ultimo frame dei due campioni | 283 / 260 | 281 / 294 |
| Mesh / materiali, due campioni | 208 / 165; 200 / 164 | 220 / 176; 215 / 169 |

[Dati delle due coppie alternate](after/performance-pairs.json). Sono stati ripetuti **due confronti prima/dopo alternati**, usando lo stesso script, cinque client, pose distribuite e GPU, con build e registrazione ferme. Ogni campione controlla anche che sia stata caricata la versione corretta (cielo e stato abilità presenti/assenti). Tutti i dati individuali sono conservati in `before/performance-run-1/2.json` e `after/performance-run-1/2.json`.

Le misure intermedie erano 52,45 FPS sulla base, 55,82 nell'aggiornamento prima dell'ultima rifinitura della camera e **44,58 nel primo campione della versione finale**. Sono conservate nello [storico](after/performance-history.json), insieme al [campione più basso](after/performance-pre-pair.json). La variabilità resta evidente: nei due confronti ripetuti non si osserva un calo, ma questi campioni brevi non garantiscono 60 FPS né un miglioramento universale. Oggetti, posizioni dinamiche e mesh visibili variano tra le corse; non è un benchmark deterministico.

La gara con cattura video ha anche il costo dell'encoder: nel suo campione iniziale ha misurato **40,15 FPS**, render medio 21,44 ms. È una scena diversa (partenza con kart ravvicinati, circa 500 draw), non direttamente confrontabile con le pose distribuite del benchmark. Le sue statistiche sono separate e non sostituiscono il confronto prima/dopo.

## Verifiche eseguite

| Ambito | Esito / evidenza |
|---|---|
| Abilità e sicurezza | **154 controlli**, 30/60/120 Hz, cinque personaggi su entrambi i gap, durata, riuso, fine degli effetti, oggetti, corazza, turbo/drift, debito, contatti, attivazioni simultanee, checkpoint e previsione. [JSON](after/ability-checks.json) |
| Bot e sorpassi | **22 controlli**, condizioni strategiche positive/negative e comandi ordinari. [JSON](after/bot-opportunities.json) |
| Telefoni e gamepad | **58 controlli browser**: tasti abilità di tutti i cinque personaggi a terra/in aria su telefono e Xbox simulato; sterzo, 2/3/4/5 visuali, pausa, riconnessione, disconnessione pad, caduta e respawn, tredici oggetti, pulizia scene. [JSON](after/browser-qa.json) |
| Camere | **1.452 casi** su 2–5 visuali, posizioni laterali e punti densi dei gap: occlusioni, distanza minima in volo **10,27 m** e presenza del kart nell'inquadratura. [JSON](after/camera-rays.json) |
| Controllo planata | Test 30/60/120 Hz e 12 atterraggi di bot perturbati; previsione, stabilità e controllo. [JSON](after/glide-control-checks.json) |
| Gara naturale | Cinque piloti AI attraverso input comuni, tre giri senza progressi forzati, telemetria e registrazione continua con audio. [JSON](after/natural-race.json) |
| Regressioni | **17 suite passate**: kart-abilities, kart-items, kart-contact, kart-oil, ribaltati-2, ribaltati-camera, pad, rounds, ability, geofall, backrooms-fixes, minigolf, minigolf-camera, solo-bots, audio, map-vote, roulette-cycle. [Esiti e log](after/regressions.json) |
| Regressioni estese | Inclusi 24 gare complete del Litorale a 30/60/120 Hz, 336 casi camera Litorale, 40 partite bot Minigolf sui dieci campi e 816 casi camera Minigolf, 4.000 labirinti Backrooms, 1.251 verifiche del catalogo condiviso. |
| Typecheck e build | `npm run build` esegue prima `tsc --noEmit`, poi Vite. [Log finale](after/build.log) |
| Galleria e video | **20 immagini** reali caricate, video riprodotto e ricerca verso la fine riuscita, report servito correttamente. [Esito](after/gallery-checks.json) |
| Versione compilata | Voto Arcobaleno da telefono, modello GLB della build, una persona e quattro bot, input touch, pausa e ritorno in lobby. [Esito](after/production-checks.json) |

Le suite storiche `kart-abilities` e `kart-oil` sono state aggiornate per verificare i nuovi valori previsti di ricarica, debito e recupero sul posto, mantenendo le asserzioni sul comportamento. Le regressioni di partita/browser precedono l'ultima correzione esclusivamente visiva della camera; i controlli camera, le foto, la gara registrata e la prova compilata verificano la versione finale.

## Conservazione e file

Modello GLB identico, SHA-256 `cd38878316f88b8578036a129dce2bd2114987c595bdc4e3ee029036b2599250`. Lunghezza della pista **2200,7326075763294**, larghezza e coordinate dei due gap/checkpoint conservate. Restano tre giri e tutte le tredici voci del catalogo oggetti. Nessuna modifica ai file della presentazione Litorale, `track.ts`, `race.ts`, `itemCatalog.ts`, `trackDynamics.ts`, `trackGuides.ts`, `trackSetPieces.ts` o `ScoreManager`.

Le abilità e i miglioramenti ai contatti sono comuni alle due piste di Ribaltati; i valori delle abilità degli altri minigiochi non sono modificati. Le modifiche alle mappe già presenti all'avvio di questo lavoro restano conservate.

- `shared/abilityCatalog.ts`: cinque definizioni di Ribaltati e descrizioni coerenti.
- `kart-race/abilities.ts`, `raceTypes.ts`, `kartPhysics.ts`, `kartCollisions.ts`, `items.ts`: ricariche, effetti, protezioni, recupero e interazioni.
- `kart-race/glideDynamics.ts`, `rainbowTrack.ts`: previsione aggiornata e causa diagnostica delle cadute.
- `kart-race/rainbowWorld.ts`, **`rainbowCosmos.ts`**, `kartEntity.ts`: materiali, guide aperte, spazio, ali e feedback.
- `kart-race/cameraHud.ts`, `BabylonKartGame.ts`, **`rainbowFinish.ts`**: inquadrature, HUD, finale e collegamento degli eventi.
- `src/core/AudioManager.ts`, `src/minigames/bots/MotionBots.ts`: suoni dedicati e scelte delle abilità dei bot.
- Script `rainbow-13-*` e `e2e/rainbow-13-*`, due suite storiche adeguate e questa cartella: prove ed evidenze. [Elenco delle differenze rispetto alla base](after/changed-sources.json).

I percorsi `kart-race/` sopra sono relativi a `src/minigames/`. La build aggiorna gli artefatti locali in `dist/`; nessuna dipendenza aggiunta.

## Immagini, video e limiti rimasti

Le dieci coppie prima/dopo provengono dal renderer effettivo, nelle stesse pose predisposte e con scala 1: planata lunga, corta, ali, portale, spazio, curva sopraelevata, turbo, difesa, camion e finale. Le pose preparate sono confronti tecnici, non una gara spontanea. Il finale predisposto usa tempi di esempio; i tempi reali sono nella telemetria della gara.

Il [video completo di 2:49,7](after/complete-race.webm) registra il canvas 1280×720 e l'audio del mixer dal countdown all'ultimo arrivo. Il pannello finale è DOM e compare nelle foto, non nella traccia canvas. Il file è stato verificato tramite decodifica di video VP9 e audio Opus. [Dati video](after/video-checks.json).

Restano da valutare con persone reali ergonomia sui telefoni fisici, feeling dei pad e bilanciamento su molte gare tra giocatori di abilità diversa. La presenza di un'opportunità utile conta: una difesa non deve consumarsi se nessuno attacca. Le prove misurano effetti e limiti concreti, non garantiscono pari percentuali di vittoria. Nessuna conclusione certa sui timestamp del video originale non ricevuto; nessuna promessa di 60 FPS su tutti i dispositivi.
