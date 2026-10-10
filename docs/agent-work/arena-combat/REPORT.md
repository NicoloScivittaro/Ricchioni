# Arena del Disagio — spallata e instabilità

Implementate le due meccaniche principali. Controspinta rinviata al playtest umano. Nessun commit, push o deploy; le modifiche precedenti a Cornicione e Sparatoria restano disponibili.

## Comandi e ruoli

| Azione | Xbox | PlayStation | Telefono |
|---|---|---|---|
| Movimento / direzione di carica | Stick sinistro | Stick sinistro | Joystick |
| Spinta breve | X breve | □ breve | Tocco su SPINTA / SPALLATA |
| Spallata | Tieni X e rilascia | Tieni □ e rilascia | Tieni e rilascia SPINTA / SPALLATA |
| Scatto esistente | A | ✕ | DASH |
| Abilità esistente | B | ◯ | Pulsante abilità |

X/□ era libero. Direzione modificabile durante la preparazione e fissata al rilascio. La spinta è rapida e corta; la spallata ha slancio e recupero durante il quale non puoi compensare immediatamente con uno scatto. Non ci sono nuove finestre di controspinta.

## Valori iniziali

- Carica massima: 1 s; tocco sotto 0,18 s = spinta. Durante la carica ti muovi al 40%.
- Spinta: portata 2,9, potenza 6,5, ricarica 0,45 s; colpisce il rivale più vicino davanti.
- Spallata: velocità 18–28, durata dello slancio 0,20–0,36 s, potenza 18–28, ricarica 2,5 s e recupero 0,38 s. Un mancato a piena carica percorre circa 10 m prima della frenata.
- Instabilità 0–100%; STABILE sotto 35%, SBILANCIATO da 35%, CRITICO da 70%. Vulnerabilità crescente fino a 2,2×.
- Sale con gli impatti effettivi e le collisioni violente, non con i semplici contatti. L’assorbimento riduce anche l’instabilità ricevuta; parata e schivata riuscite non aggiungono instabilità né credito al colpo.
- Recupera 14 punti/s dopo 2,5 s senza impatti. I numeri sono comuni ai cinque personaggi; le differenze restano nelle abilità.

La fisica precedente limitava il knockback alla velocità della corsa subito dopo il colpo. Gli impatti ora mantengono slancio per 0,48 s, con attrito dedicato e limite finito. La forza base dello scatto, le cinque abilità, il restringimento e la Sudden Death conservano i loro valori.

## Verifiche

Fixture sul gioco Babylon reale, con posizioni preparate e tempo accelerato:

- KO attribuito all’attaccante entro 1,81 s, raggio ancora 14.
- Spallata mancata: auto-caduta entro 1,61 s, raggio 14, nessun credito assegnato a un rivale.
- Spinta breve distinta dalla carica, recupero dopo la pausa dagli impatti, moltiplicatore critico ed effetti identici sui cinque personaggi.
- Parata del Goblin e schivata di Victor senza falso colpo; assorbimento di Boschi; salvataggio e debito di Ciro. Regressioni delle abilità: 999 controlli.
- Xbox, DualSense e pad generico simulati attraverso il vero gestore input; telefono con due dita reali emulati (joystick + carica), annullamento del gesto, pausa e disconnessione.
- Le quattro skin Tripo rimangono visibili e usano la posa native `block` in preparazione e `dash` nello slancio. Nessun LOD o compressione aggiunta. La posa Arena non modifica il contesto calcio.
- Barre TV, carica/ricarica sul telefono, layout verticale e orizzontale e Companion Card aggiornati. Victor mantiene il suo modello esistente.
- Sudden Death, pressione contro lo stallo anche opponendosi verso il centro, spareggio, cinque risultati, ritorno lobby: zero istanze Tripo rimaste e un solo canvas.
- Typecheck; test Arena, recupero 30/60/120 Hz, collisioni continue, input pad, animazioni (431), ADS FPS e proiettili del Cornicione passati. Bot verificati per carica, rilascio e riattivazione dopo interruzione.

Dati riproducibili in `browser.json`, `survival-arena-browser.json` e negli script `scripts/arena-combat-selftest.ts`, `scripts/e2e/arena-combat.mjs`, `scripts/e2e/arena-combat-production.mjs`.

## Limiti del collaudo

Le fixture dimostrano che le eliminazioni iniziali sono possibili e attribuite correttamente; non promettono un KO entro 15 s in ogni partita. La scelta fra spinta, spallata e scatto va valutata con amici e pad reali: quanto è facile leggere la preparazione, schivare lo slancio e punire il mancato. Prima di aggiungere la controspinta, provare questo assetto.

## Pacchetto di produzione

Build finale riuscita (`tsc --noEmit && vite build`, 3735 moduli). Resta l’avviso già presente sui chunk grandi di Babylon/Phaser.

Prova finale tramite interfaccia pubblica su `http://127.0.0.1:3001/`, senza DEV, riposizionamenti o tempo accelerato: un telefono e quattro bot; carica e rilascio riconosciuti, primo KO a 7 s, round concluso naturalmente in circa 21 s, cinque risultati e nessun errore del browser. Il round precedente aveva avuto il primo KO a 5 s e si era concluso in circa 26 s; la ripetizione è stata necessaria per correggere nel test il nome del modulo compilato cercato dal controllo finale.

Evidenza definitiva in `production.json`; prima esecuzione conservata in `production-first-run.json`. Bundle verificati: `main-SKThNrtY.js` e `BabylonArenaGame-DDDJ4Z2n.js`. La prova naturale conferma attività utile dei bot, ma non sostituisce un playtest con persone.

