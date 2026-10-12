# Backrooms — contratto e milestone

Spec: allegato 0a50e315. Baseline HEAD aa91c9f, Geofall già presente e non committato (baseline.patch). Implementazione root autorizzata senza Flash. Nessuna nuova dipendenza, push o deploy.

Architettura verificata: Phaser gestisce lifecycle/FSM; Babylon UniversalCamera + splitScreenLayout gestiscono già 2–5 viewport. InputManager è l'autorità dei comandi pad e telefono. AudioManager espone contesto/bus condivisi. ctx.finish consegna una sola classifica al server. ArenaEntity conserva i modelli/skin esistenti.

1. Modulo indipendente + camere host per tutti (anche telefoni), controller touch doppio joystick, comandi MOVE/LOOK/SPRINT/INTERACT. Wrapper lifecycle dedicato, nessun rendering mobile.
2. Mappa seed con DFS, anelli e stanze; collisioni, LOS e BFS dalla stessa occupazione. Spawn protetto e validazione raggiungibilità. Porte apribili, rifugi, aree buie. Seed esplicito solo debug.
3. Fuga libera/chiave/puzzle con pesi configurabili; interruttori o generatori; modalità scoperta sul posto. Chiave lasciata alla cattura. Oggetti senza evidenziazione oltre muri.
4. Stalker/Corridore, percezione e memoria finita, navigazione, anticampeggio, due catture/immunità. Verificare prima di aggiungere Imitatore.
5. Materiali propri, neon, moquette, pareti macchiate, arredi e creature articolate; audio sintetizzato sul mixer esistente, silenzi e passi spazializzati. Budget multiview e distanza visiva limitata.
6. HUD per finestra, spettacolo fuga, spettatore passivo, timer 7 minuti, classifica dichiarata (fuggiti in ordine; superstiti per catture/esplorazione; eliminati dopo). Bot e verifiche 2–5, seed, collisione, LOS, oggetti/puzzle/catture; typecheck, controller, regressione, build e screenshot realmente osservati.

Rischi da misurare: cinque viewport con personaggi Tripo, chiarezza del buio e HUD a 1280×720. Atmosfera/panico soggettivi e controller fisici richiedono playtest umano: non considerarli certificati da test automatici.
