# Passata prima della prova — 9 ottobre 2026

## Correzioni

- **Stanza bloccata dopo un abbandono:** riprodotto il problema nel browser. Il flag `creating` della lobby ora viene azzerato a ogni riapertura. Tre stanze consecutive senza refresh passano il test.
- **QR errato:** indirizzo LAN anche nella build aperta su localhost e porta effettiva (3001 produzione, 5174 nella sessione Vite attuale). Nessuna porta 5173 fissata. Le risposte QR ritardate di una stanza abbandonata non modificano la stanza nuova.
- **Telefono in secondo piano:** joystick e pulsanti vengono rilasciati su blur/visibility/pagehide/disconnessione. La proprietà del vecchio tocco viene azzerata, il gesto successivo funziona; input offline non accodati da Socket.IO per essere riprodotti dopo la riconnessione. Verificati joystick Arena e SPARA FPS.
- **Cornicione sul telefono:** croce e cinque azioni compatti, a colori, impaginati verticalmente oppure affiancati; tutti e nove i controlli raggiungibili.
- **FPS orizzontale:** azioni su due colonne, senza SPARA fuori schermo.
- **Nomi:** BOSCHI e Carbo in definizioni, selezione, presentazione, telecronista, HUD Cornicione e Gallery. ID `buttafuori`/`judoka` preservati per abilità, rete, rig e asset.
- **Modelli:** predefiniti in contesti verificati, disponibili nella partita normale senza debug. Conservate le scelte OLD e il fallback su errore. Le azioni aeree/cariche non fanno riapparire la vecchia skin. Sport e Kart conservano pose/driver collaudati.
- **Avvio locale:** `AVVIA-PARTITA.cmd` e `scripts/start-party.mjs`; riuso del server sulla porta 3001 oppure avvio in background, indirizzi Wi-Fi stampati e apertura del browser.

## Prove completate

- Server prelaunch: **68 verifiche**, rullo, target, vincitore, eventi/result duplicati, input, pausa, riconnessione e scelta manuale per un solo round.
- Sessione con **tre pagine controller reali nel browser** (Nicolò, BOSCHI, Carbo): tutti gli **11 minigiochi** → risultati → rullo, piazzamenti completi, una scena attiva, canvas 3D rimossi e istanze importate azzerate. Input joystick, pausa con timer fermo, reconnect di Carbo senza duplicazione, finale a target 120 e nuova partita con tre giocatori/punti zero.
- Il round Riflessi termina naturalmente; negli altri giochi della matrice i risultati sono consegnati dal test per coprire il flusso e cleanup, senza attendere la durata intera di ogni partita.
- Matrice due giocatori: 8 casi superati nella baseline; i tre casi interrotti/andati in timeout durante la fase di modifiche sono riprovati a sorgenti ferme e passano (Calcio, Kart, Cornicione). La sessione a tre copre comunque tutti gli undici casi.
- Controller: **33 combinazioni** (11 giochi × verticale 390×800, orizzontale 800×390, piccolo 360×640). I quattro difetti di FPS/Cornicione sono corretti e i sei casi interessati riprovati con PASS. Screenshot controllati a vista.
- Download GLB fallito: Legacy visibile, hide/show funzionante, stato fisico immutato.
- Selftest esistenti: personaggi, round, controller/pad, qualità, abilità, fighter e abilità, Kart, mira FPS, Quiz, audio; controller animazioni Goblin **135** e Ciro **98** verifiche.
- TypeScript PASS; build finale di produzione PASS (3 minuti e 27 secondi), dopo le correzioni dei controller.
- Produzione sulla porta 3001, senza parametri DEV: stanza LAN, tre controller, nomi BOSCHI/Carbo, caricamento dei tre GLB originali con HTTP 200 e Arena conclusa naturalmente con tre piazzamenti e punti assegnati. Nessun errore pagina. Screenshot della stanza e dell'Arena controllati a vista.
- Gallery nella build di produzione: quattro modelli corretti, ciascuno con 65 bones (Goblin 36 clip, BOSCHI 43, Carbo 37, Ciro 46). Dottore originale; passaggio di tutti a OLD e riattivazione del solo Ciro verificati.
- Launcher verificato sul server locale; `git diff --check` PASS.

Evidenze nella stessa cartella: `three-player-session.log/json`, `server-prelaunch.log`, `controllers.log`, `controllers-fixed.log`, `phone-focus.log`, `matrix-recheck.log`, `fallback.log`, `production.log/json`, selftest e `build.log`. Screenshot iniziali e corretti in `controllers/` e `controllers-fixed/`; produzione in `production-room-three.png` e `production-arena-three.png`.

## Limiti e scelte

Nessun minigioco disabilitato. Nessun cambiamento a hitbox, collider, danni, bilanciamento, formato room o networking. Nessuna compressione GLB/texture, nuovo retarget, dipendenza aggiunta, commit/push/deploy.

Calcio/Volley e Kart usano ancora i corpi/driver procedurali nelle partite: le animazioni sportive e la posa al volante dei nuovi modelli restano da approvare. Dottore non ha un nuovo GLB. Le prove sono su Chrome nel PC con GPU reale; i due telefoni fisici, il Wi-Fi e una serata naturale completa richiedono i tre controlli in `COME-GIOCARE.md`. Il warning dei chunk grandi è preesistente.
