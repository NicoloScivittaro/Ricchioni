# Sistemazione generale e quattro personaggi Tripo

Goblin, BOSCHI, Carbo e Ciro usano Tripo come render predefinito nelle partite normali. Build locale aggiornata e verificata su **http://localhost:3001/**. Ricaricare PC e telefoni prima di creare una nuova stanza. Le istruzioni pratiche sono in `../morning-playtest/COME-GIOCARE.md`.

## Dove compaiono

| Contesto | Quattro personaggi |
| --- | --- |
| Arena / Cornicione | Tripo, anche durante attacchi, salto e KO |
| Dodgeball | Tripo |
| Calcio | Tripo con carica, calcio e contraccolpo nativi |
| Volley | Tripo con servizio, schiacciata e ricezione nativi |
| Kart | Quattro driver Tripo seduti, persistenti in curva, boost, abilità e arrivo |
| FPS con gamepad | Tripo nella vista 3D sul PC |
| FPS sul telefono | Tripo per gli altri giocatori; prima questo renderer usava ancora i corpi vecchi |
| Casa Carbo | Tripo con azioni dell'acqua e abilità native |
| Gallery e ritratti 3D dei risultati | Profili Tripo, confronto OLD/NEW conservato |

Dottore conserva il proprio personaggio. Foto, icone e schermate 2D mantengono la loro funzione. Una scelta OLD nella Gallery non si trasferisce alle partite normali; il confronto resta disponibile in DEV con `?characters=1`, e nella build con `?characters=1&debug=1`. Il corpo procedurale resta come fallback durante il caricamento o in caso di errore.

## Correzioni e migliorie

- Rimossa l'esclusione dei modelli importati da Calcio/Volley e del driver Kart dalle partite normali.
- Animazioni sportive selezionate sullo stato esistente; posa di contatto campionata nell'istante già deciso dal gioco. La carica avanza nella clip senza cambiare tempi o potenza del tiro.
- Seduta dei quattro piloti con bacino agganciato all'abitacolo. Le braccia vengono orientate usando le articolazioni reali, così le diverse pose di esportazione non producono il braccio alzato di BOSCHI. Ombre dei driver aggiunte anche quando il GLB arriva dopo la creazione del Kart.
- Texture delle particelle Kart appartenente alla scena: il round successivo non riutilizza la texture smaltita del precedente.
- Casa Carbo: annunci più compatti sotto il timer; messaggi dei punti sospesi mentre occupano lo stesso spazio. Nel finale i titoli restano visibili sotto il banner.
- FPS telefono: corpo originale nascosto soltanto dopo il successo del GLB; movimento, danno, KO e rinascita conservano la stessa mesh e lo stesso rig. Raggi X e feedback esistenti conservati. Modelli e listener di resize rilasciati alla chiusura della vista.

Simulazione, hitbox, collider, danni, abilità, input, regole e punteggi non modificati. Nessun nuovo asset, retarget, compressione, LOD, dipendenza, commit, push o deploy.

## Verifiche

- TypeScript e build PASS; build completata in 4m24s. Warning dei chunk grandi preesistente.
- Selftest: selezione Tripo/sport **72** verifiche; contratto animazioni **431**; Goblin **183**, Ciro **111**; mira FPS e abilità Kart PASS.
- Calcio/Volley: tutti e quattro i rig da 65 bones, stessa mesh nelle azioni e nel salto, skinning finito, vecchio corpo nascosto e stato fisico immutato. Contatto della clip nell'evento esistente.
- Kart: quattro sedute controllate a vista da davanti e dal fianco; skin persistente in curva/boost/abilità/arrivo. Quattro download falliti mantengono i driver procedurali; quattro importazioni ritardate sono abortite dopo la chiusura della scena. Particelle valide in due scene consecutive.
- FPS telefono: quattro modelli attraverso idle/movimento/danno/KO/respawn; Dottore originale; fallback su quattro download falliti; zero istanze vive dopo disposal. In una partita con quattro telefoni verificati **tre avversari Tripo su ciascun telefono**, poi zero istanze dopo il round.
- Gallery: OLD/NEW per tutti e quattro, cinque scheletri indipendenti per ogni profilo, Dottore originale e fallback per quattro asset falliti.
- Casa Carbo: quattro telefoni, azioni dell'acqua, abilità di BOSCHI/Carbo, loop continui, stessa skin, stato giocatori/acqua immutato, vittoria, cleanup e visibilità annunci/titoli PASS.
- **12 minigiochi coperti con quattro telefoni**, in due sessioni: Arena, Cornicione, Dodgeball, Calcio, Volley, Kart, FPS, Casa Carbo, Quiz, Memory, Cultura e Riflessi. Primo giro: joystick, rilascio al blur, nuovo gesto, pausa/timer fermo e riconnessione Carbo con lo stesso ID. Secondo giro: cinque round di Riflessi conclusi naturalmente, target 120, podio e nuova partita senza refresh. Gli altri risultati sono forniti dal test per verificare transizioni e cleanup; non è una serata naturale completa di dodici giochi.
- Gamepad Calcio e Volley PASS. Kart: sterzo, drift/mini-turbo, item, abilità, pausa, scollegamento, ripartenza e pairing PASS nella prova isolata; split-screen da 2 a 5 giocatori PASS.
- FPS misto: quattro gamepad più un telefono, quattro viewport, un'unica simulazione/timer/classifica, danni e kill in entrambe le direzioni, respawn e assenza di renderer superflui sui telefoni associati ai pad PASS.
- Produzione 3001, senza parametri DEV: Calcio/Volley/Kart/FPS con quattro telefoni, OLD salvato ignorato, GLB originali HTTP 200 e SHA256 uguale agli asset in public. Nessun errore pagina.

Le prime prove del runner richiedevano correzioni al test: nell'FPS senza gamepad il PC usa la vista Phaser e i corpi 3D stanno sui telefoni; Vite assegna URL con timestamp ai moduli, per cui i probe devono leggere la stessa istanza del modulo usata dal gioco. Sei casi iniziali validati sono conservati e gli altri sei sono riprovati dopo la correzione. Due soglie Kart non raggiunte durante i test simultanei passano nella prova isolata (carica 1.77; mini-turbo 0.39 s). Nessuna fisica cambiata per adattarla al test.

## Asset e limiti visivi

GLB originali invariati: Goblin 52 clip, BOSCHI 54, Carbo 49, Ciro 59; 65 bones per profilo. Texture originali 4096 mantenute; circa 64 MiB complessivi di GLB. Scale e orientamenti esistenti conservati per i corpi; driver normalizzati a statura 1.35 e seduta comune. Nessun cambio di skin durante salto o azioni.

Calcio usa il calcio frontale già presente nei GLB, e il Volley adatta lancio/presa: sono pose native riutilizzate, non nuove clip sportive dedicate. Il Kart usa una posa seduta e inclinazione in curva, senza una nuova clip al volante. BOSCHI conserva la bottiglia incorporata nel modello. Questi dettagli potranno essere rifiniti con asset specifici.

Le prove sono su Chrome nel PC con GPU reale e browser con dimensioni da telefono. Non misurano le prestazioni di telefoni fisici o del Wi-Fi degli amici. Risoluzione e qualità adattive già esistenti restano attive; GLB e texture non sono stati alleggeriti. Prima della serata reale è utile il breve giro sul Wi-Fi descritto in COME-GIOCARE.

## Evidenze

`twelve-games.json`, `four-player-first-six.json/log`, `four-player-remaining-six.json/log`, `sports-drivers.json/log`, `fps-phone.json/log`, `kart-fallback.json/log`, `gallery-fallback.json/log`, `casacarbo.json`, `casacarbo-hud.log`, `production-sports.json/log`, `production-fps.json/log`, `gamepad-*.log`, selftest, `build.log` e screenshot in `shots/`.
