# Ribaltati — Strada Arcobaleno con planata

Data: 19 ottobre 2026. Nessun commit, push, deploy o nuova dipendenza. Le modifiche Ribaltati 3.0 già presenti sono conservate; snapshot sorgente in `baseline-3.0.zip`.

## 1. Importazione e adattamento del GLB

`public/assets/tracks/gba_rainbow_road.glb` è la copia integrale del file fornito dall’utente (5.708.472 byte). Importazione con il loader glTF Babylon già installato. Otto mesh/materiali, texture incorporate, nessun Draco. Coordinate originali XY, quota Z; la conversione del loader LH richiede scala dell’ancora (-4,+4,-4) e posizione (-800,+40,-240). La superficie di guida è la primitiva originale Object_6 (nodo importato Object_8), riconosciuta dal materiale Nila_1. Il resto del modello rimane il riferimento visivo. Il grande cartellone StarRing è disabilitato perché nasconde l’atterraggio; lo sostituiscono anelli guida sottili originali.

Le UV della sola strada vengono riproiettate sulla spline, con ricucitura della cucitura fra fine e inizio giro: conservate le texture originali, eliminate le ripetizioni 128 x che apparivano come striature. Materiali Standard per le strutture e la strada, con texture originali; fondale senza illuminazione PBR e strada emissiva, senza bloom a schermo intero. Materiali e matrici statiche congelati, segnaletica unita per materiale, luci sole+emisferica e shadow map condivisa tra le camere. Non è caricata la geometria del Litorale sulla nuova pista.

Attribuzione originale: RyanNotHere, “GBA Rainbow Road”, CC BY 4.0; fonte/licenza/modifiche in [ATTRIBUTION](../../../public/assets/tracks/ATTRIBUTION.md). Il GLB originale non viene riscritto.

## 2. Percorso giocabile

Estrazione offline dal triangolato: rasterizzazione, distanza dai bordi, cammino pesato che preferisce il centro, smussatura della griglia e recupero baricentrico delle quote. 817 punti ordinati con normali ricavate dai triangoli; spline chiusa riparametrizzata per lunghezza. Giro di 2200.73 m, corsia logica larga 13,2 m, quota base 40 m. La quota e l’inclinazione trasversale seguono i triangoli, evitando kart sotto la superficie nei cambi di pendenza. Il GLB resta la strada visibile: nessun ponte disegnato sui vuoti. Checkpoint solo a terra, con punto di recupero prima di ogni lancio e conferma dopo ogni atterraggio. Stessa spline per kart, bot, progressione, classifica, respawn e minimappa.

Tre giri e limite 230 s mantenuti. La selezione è l’ultima carta del catalogo: da “IL RULLO DECIDE” basta una freccia sinistra per scegliere “RIBALTATI — STRADA ARCOBALENO”. Il Litorale conserva la propria voce. `kartTrackId` è sincronizzato server/host e nel payload di riconnessione, mentre `kart3d` resta la famiglia di gioco per abilità, controlli e cronologia senza ripetizioni. Il rullo automatico continua a usare il Litorale; Arcobaleno è una variante selezionabile manualmente.

## 3. Gap progettati

| Sezione | Lancio s | Atterraggio s | Tratto di volo | Altezza massima di sostentamento |
|---|---:|---:|---:|---:|
| VOLO STELLARE | 151.90 m | 528.50 m | 376.60 m |18 m|
| SALTO AURORA | 946.05 m | 990.85 m | 44.80 m |3,5 m|

Il primo attraversa il grande vuoto sul lato destro della mappa, il secondo la piccola interruzione del rettilineo alto. Le zone comprendono alcuni metri di superficie prima/dopo il buco per transizioni pulite. Strisce azzurre, cartello, fari laterali, anelli non collidibili e tratteggio ciano sulla minimappa.

## 4. Funzionamento della planata

Stati espliciti DRIVE → GLIDE → DRIVE, oppure FALL → respawn. Attivazione automatica solo attraversando in avanti una zona designata. Ali energetiche e scie geometriche si aprono/chiudono gradualmente. Profilo di sostentamento arcade sinusoidale lungo il tratto, con continuità rispetto al salto eventualmente iniziato prima del lancio. Non è una simulazione aerodinamica: il profilo verticale è assistito, la traiettoria laterale resta guidata dal giocatore e può mancare il bersaglio.

L’atterraggio richiede il centro del kart entro metà larghezza meno 1,15 m. Rientro immediato nella fisica normale, riduzione dell’impulso laterale e feedback sonoro/visivo. Se manca la piattaforma o esce dal corridoio di sicurezza, cade visibilmente; dopo 0,9 s di caduta si applica il normale secondo di penalità prima del respawn. Nessun checkpoint acquisito in volo o durante la caduta. Corretto anche il confronto numerico del timer di respawn, che poteva restare con un residuo infinitesimo.

## 5. Controlli e limiti in aria

Stessi comandi di telefono e gamepad. Sterzo a 38% della velocità angolare di terra, orientamento relativo limitato a±0,30 rad (circa 17°). Il rilascio raddrizza gradualmente l’assetto, senza centrare automaticamente la posizione laterale. Nessun volo libero, retromarcia o comando verticale separato. Il freno porta gradualmente verso 28 m/s; l’inerzia viene sostenuta verso 44 m/s. Soglia di sicurezza 24 m/s dopo un colpo per evitare stalli senza possibilità di recupero. Boost e penalità esistenti restano attivi. Derapata e caricamento mini-turbo disattivati in GLIDE, senza assegnare un turbo fantasma all’apertura delle ali.

Rilevate e corrette 13 posizioni laterali in cui la superficie nascondeva il kart: la spline ora usa le normali del GLB, inclusa la pendenza trasversale. Verifica ripetuta su 1.212 raggi camera→kart distribuiti sulla pista e nei layout 2–5: zero occlusioni da strada o struttura. Camera più arretrata e alta, sguardo anticipato verso il percorso di volo, rientro smussato e inseguimento del kart durante la caduta. SFX di decollo, vento breve sul bus comune SFX e atterraggio. Nessun loop audio esterno lasciato aperto.

## 6. Bot

Usano gli input veri dello stesso sistema di guida, senza teletrasporti o completamenti forzati. Solo sulla pista sospesa: anticipo sterzo più corto, correzione laterale più forte, frenata preventiva e niente drift; centro corsia prima/durante il volo. Le inversioni da oggetto sono compensate durante la planata. Il comportamento del Litorale resta coperto dalla suite delle 24 gare originali.

## 7. File

Nuovi: `shared/kartTracks.ts`, `rainbowTrack.ts`, `rainbowWorld.ts`, `rainbowRoute.json`, GLB+attribuzione pubblici; estrattore `scripts/extract-rainbow.py`, test `scripts/rainbow-selftest.ts` e script browser `rainbow-*.mjs`.

File esistenti modificati rispetto allo snapshot 3.0:

- `src/minigames/kart-race/BabylonKartGame.ts`
- `src/minigames/kart-race/cameraHud.ts`
- `src/minigames/kart-race/itemCatalog.ts`
- `src/minigames/kart-race/items.ts`
- `src/minigames/kart-race/kartEntity.ts`
- `src/minigames/kart-race/kartPhysics.ts`
- `src/minigames/kart-race/KartRaceScene.ts`
- `src/minigames/kart-race/race.ts`
- `src/minigames/kart-race/raceTypes.ts`
- `src/minigames/kart-race/track.ts`
- `src/minigames/kart-race/trackGuides.ts`
- `src/minigames/bots/MotionBots.ts`
- `src/core/GameManager.ts`
- `src/scenes/RoomScene.ts`
- `src/minigames/types.ts`
- `server/GameSession.ts`
- `server/RoomManager.ts`
- `shared/types.ts`
- `shared/protocol.ts`
- `src/core/AudioManager.ts`
- `src/scenes/IntroScene.ts`
- `src/scenes/RouletteScene.ts`

Le prove successive hanno confermato anche i layout 2–5 dopo la correzione delle normali; i dati definitivi sono `browser-qa.json`.

La patch incrementale è `changes-from-3.0.patch`; non confondere queste modifiche con il lavoro 3.0 già presente all’inizio.

## 8. Verifiche eseguite

- Typecheck TypeScript passato e build Vite completata con codice 0: 3.804 moduli, 3m45s. Rimane il warning già presente sui grandi chunk Babylon/WebXR; nessun errore di compilazione. Smoke della build compilata passato: import del GLB dal server statico, un telefono touch e quattro bot, 18 secondi di gioco, pausa e ritorno alla lobby, nessun errore runtime.
- Fisica: due lanci, confronto sterzo sinistro/destro, cancellazione drift, colpo in aria e atterraggio dei bot, errore di atterraggio, caduta visibile e respawn automatico reale. Otto gare complete con 2–5 kart e due configurazioni iniziali, ripetute dopo la correzione della pendenza trasversale: tutti 3 giri. Vedere i dati esatti in `physics-races.json`: tempi circa 167,64–168,14 s, nessuna caduta,168 atterraggi complessivi.
- Browser Chrome:2/3/4/5 telefoni virtuali con controller.html reale, selezione dall’interfaccia, import e allineamento del GLB, input touch durante il volo, gamepad Xbox simulato attraverso GamepadManager, distacco del pad senza sterzo residuo, pausa, reload/riconnessione telefono, caduta/respawn, camere e cleanup. Log `browser-qa.json`; screenshot `split-2.png`…`split-5.png`.
-13 oggetti provati a terra e in GLIDE. Conservati in aria olio, buca, raffica, calamita e mollone; messaggio “OGGETTO DA TERRA · CONSERVATO”. Sfera e piccione seguono la quota del corridoio di planata quando lanciati in volo; collisione per quota, così non colpiscono chi è a terra sotto di loro. Scudo, disturbo, turbo, super turbo, turbo difettoso e paraurti restano usabili.
-5 abilità attivate attraverso CharacterAbilities durante volo/recupero. Il recupero del Buttafuori usa il checkpoint esistente e richiude la planata. Goblin mantiene la propria finestra, ma non genera mini-turbo in aria; Dottore/Judoka mantengono i propri modificatori compatibili; il debito di Ciro conserva stun/inversione/grip, senza trasformare il profilo verticale assistito in un lancio incontrollabile.
-15 suite di regressione: Litorale 24 gare,336 posizioni camera, contatti, olio,13 oggetti,5 abilità, pad, solo-bot, round, rullo 42.653 controlli, qualità, audio, Geofall 2, Backrooms e Minigolf 2 con 24 tornei completi. Il primo runner Minigolf ha raggiunto il limite 160 s; rilanciato direttamente senza quel limite, terminato con codice 0.

## 9. Risultati finali e limiti

Gara reale nel browser con 5 client collegati, pilotati dagli input dell’AI esistente: tutti hanno completato 3 giri, senza avanzamenti forzati. Tempi 166,599–168,286 s,30 decolli,30 atterraggi,0 cadute,27 oggetti usati,0 errori pagina; dati e campione iniziale di 49,54 FPS in `natural-race.json`. Questa gara precede l’ultima ottimizzazione dei materiali e la correzione della pendenza trasversale; le otto gare di fisica e i 1.212 raggi sono stati ripetuti sulla geometria finale.

Confronto a parità di HIGH,1280 × 720,scala 1,5 client e 5 visuali, ombre abilitate, RTX 3050/D 3 D 11: Litorale 50,84 FPS contro Arcobaleno 57,94 FPS (campione finale dopo la correzione delle normali;59,19 FPS nel campione precedente) dopo la semplificazione dei materiali. Campioni da 8 s con kart distribuiti sui due tracciati. Il primo campione del GLB con materiali PBR era 46,20 FPS; conservato in `arcobaleno-pbr-performance.json`. FPS e costo CPU di scena completi nei file `*-performance.json`. I tracciati hanno geometrie e inquadrature diverse: il confronto riguarda quelle condizioni, non ogni metro di ogni gara.

Build finale e smoke compilato completati con codice 0. Anteprima locale: http://localhost:3008/ ; galleria: http://localhost:3008/rainbow-glide/preview.html .

Le misure FPS valgono per l’hardware, risoluzione e scena documentati; non sono una garanzia di 60 FPS su tutti i PC. La planata usa un sostentamento verticale arcade assistito. Gli oggetti da terra vengono conservati in aria intenzionalmente. I test con telefoni sono client Chrome automatizzati e il gamepad è simulato, non hardware fisico. Non vengono dichiarati collaudati telefoni/pad reali.

## 10. Verifiche manuali consigliate

1. Scegliere Arcobaleno dal catalogo e avviare 2–5 giocatori reali.
2. Sul gap lungo sterzare delicatamente, poi rilasciare: verificare comfort e visione dell’atterraggio in ogni riquadro.
3. Provare freno, boost, disturbo e scudo in aria; lasciare intenzionalmente la piattaforma e riprovare dal checkpoint.
4. Provare disconnessione/riconnessione di un pad fisico e di uno smartphone su Wi-Fi, pausa e ritorno alla lobby.
5. Confrontare preset e risoluzione sul PC di gioco durante una gara completa.
