# GEOFALL — contratto e piano

Baseline pulita `aa91c9f` (include il redesign Minigolf e successive modifiche dell'utente). Root autorizzato senza Flash; nessun push/deploy o commit automatico.

## Analisi

Il registry contiene 13 giochi; non esiste nel checkout un minigioco con caselle che precipitano. Memoria è una sequenza di quattro tessere 2D; Arena restringe una piattaforma circolare. Entrambi restano invariati. Riutilizzare ArenaEntity per le cinque skin, readMove/InputManager, GamepadManager, wrapper Phaser/Babylon, showControls, frameClock, qualità, audio e ctx.finish/ScoreManager.

## Contratti

- Modulo indipendente geofall. Dieci quadrati contigui 2×5, lato5m, spawn collegato. Velocità comune6,5m/s; corsa dalla partenza alla casella più lontana sotto6s. Nessun salto o abilità.
- Autorità pura: presentazione -> risposta -> snapshot irrevocabile -> crollo -> ricostruzione. Tre vite; un danno massimo per round, valutazione del centro del collider con intervalli semiaperti e bordo esterno incluso. Spawn è sempre sbagliato.
- Una spinta istantanea per round, anche mancata; cono/front range, stun breve0,18s/protezione0,7s, movimento e collisioni morbide, contenimento nell'unione arena+spawn. Nessun KO per spinte o contatti.
- Round1–5=10s,6–10=8s,11+=6s. Sacchetto categorie, tutte cinque prima di ripetere; sacchetto domande senza ripetizioni per categoria fino ad esaurimento. Dieci risposte mescolate ad ogni domanda.
- Tre cuori; eliminati senza input/collisioni. Spareggio tra soli ultimi pari, una vita, domanda nuova, ripetizione se tutti perdono. Nessun vincitore artificiale o round massimo. Il watchdog server esistente rimane protezione tecnica esterna (cap1h); non è una regola del minigioco.
- Piazzamenti: vincitore, eliminazione più tardiva, risposte corrette, roster deterministico. Nessuna abilità nel catalogo: comandi MOVE+PUSH e telefono con schema dpad esistente. Segnali informativi cuori/spinta/spettatore, mai risposta anticipata.
- Dataset locale100 domande20/categoria, identificativi/risposta+9distrattori/difficoltà/fonti. Capitali e adiacenze dal countryInfo GeoNames con controllo delle opzioni e esclusione dei casi ambigui; sagome Natural Earth public domain; bandiere flag-icons MIT; monumenti illustrazioni SVG originali con riferimento geografico UNESCO/ente gestore. Nessuna API runtime, chiave o asset generativo pagato.

## Fasi

1. Dati/fonti/asset e validatore100 domande.
2. Regole pure, movimento/spinte/vite/spareggio, test2–5 e tempi30/60/120.
3. Scena3D/HUD/telefono/bot, registro/preload/comandi, pausa/rejoin/dispose.
4. Typecheck/build, test browser con immagini cinque categorie/crollo/spareggio/pad e telefono, screenshot ispezionati1280×720 e telefono, regressione pertinente dei giochi originali e audit risorse. Report italiano con prove e limiti effettivi.
