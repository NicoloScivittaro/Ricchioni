# Report del lavoro dopo il playtest

## 1. Quiz — implementato e verificato

**Problema:** domande mobili non affidabili, aspettative residue di uso del pad, mancanza di conferma/attesa.

**Diagnosi dimostrata dal codice e dalle prove:** il registry era già PHONE_TEXT e la prova precedente con tre telefoni e due pad visualizzava le domande. Il sintomo esatto del playtest non è stato riprodotto in quella configurazione. Esistevano però due lacune concrete: il montaggio della vista azzerava lo snapshot già ricevuto; in pausa l'host non pubblicava più aggiornamenti, quindi ricaricare un telefono lasciava la domanda vuota. Mancava il recupero privato dello stato al rejoin. Risposte senza identità di domanda potevano inoltre riferirsi a un'altra domanda dopo una sostituzione. La sola fase `question` accettava risposte oltre il proprio tempo quando Ciro/Carbo/BOSCHI tenevano la domanda aperta. Il cambio da risposta corretta di Carbo poteva accreditare due volte.

**Prima/dopo:** prima un tocco inviava subito e i pulsanti restavano selezionabili; ora scelta locale, CONFERMA, attesa privata dell'accettazione e blocco delle doppie conferme. Una coppia round/domanda e una revisione per i tentativi autorizzati impediscono di riusare vecchie risposte. Scadenza applicata prima degli input, finestre personali delle abilità conservate. Timer pubblico e tempo residuo personale arrivano dallo stato del gioco. TV e cinque abilità mantenute; nessun percorso di selezione pad nel Quiz.

**Dipendenza condivisa mirata:** `MinigameContext.roundId` proviene dal GameManager. Il relay di testo esistente trasporta la conferma breve senza un nuovo protocollo di rete. RoomManager conserva solo l'ultimo snapshot Quiz privato del giocatore e del round e lo ripropone al suo token; cache WeakMap eliminata all'uscita dal Quiz. Punteggi, rullo e pairing non sono riscritti.

**File:** `src/minigames/quiz/QuizRoundManager.ts`, `QuizScene.ts`, `src/controller/main.ts`, `style.css`, `src/minigames/types.ts`, `src/core/GameManager.ts`, `server/RoomManager.ts`; selftest Quiz e test browser Quiz, gamepad, gamepad-m7-session aggiornati.

**Verifiche già passate:** typecheck/build; Quiz selftest con partite 2–5 giocatori e nuovi casi di scadenza, domanda rifiutata, revisione/duplicati e doppio accredito; pad selftest; 999 controlli abilità. Browser: cinque telefoni reali Chrome, dieci domande, cinque pad associati e ignorati, cinque abilità, privacy di indizio/riepilogo, selezione/conferma, ricarica in pausa, risultati naturali, lobby e un solo canvas finale; nessun pageerror. Gli intermezzi sono accelerati mediante aggiornamenti ordinari della scena, senza `ctx.finish` sostitutivo. Ulteriore test tre telefoni/due pad su schermi 390×800, 800×390 e 360×640: pulsanti raggiungibili, pausa/ripresa e pairing conservato. Screenshot visionato.

**Limiti:** verificare nuovamente i telefoni reali del playtest e il cambio app/standby su iOS/Android. Nessun test automatico dimostra il feeling umano o la qualità della rete Wi-Fi reale. La build conserva l'avviso già presente sui chunk Babylon grandi.

**Produzione:** cinque telefoni, dieci domande senza debug e senza accelerare il tempo, scelte/conferme, rejoin in pausa e risultati naturali verificati. Zero pageerror. Chrome headless ha emesso dopo il reload l'avviso di vibrazione bloccata prima del primo gesto: non un errore della partita. `rounds-selftest` passato. Le suite complete gamepad e gamepad-m7-session hanno aspettative Quiz aggiornate; esecuzione integrale prevista nella regressione finale.

## 2. Arena — implementata e verificata

**Problema/causa:** `checkEndCondition` terminava anche a `gameTime >= durationSec`; `startCelebration/buildResults` sceglievano il vivo più vicino al centro. Un round poteva quindi premiare un giocatore senza eliminare gli altri.

**Prima/dopo:** la durata normale avvia SUDDEN DEATH, non i risultati. Regole e statistiche del combattimento normale intatte. Nei successivi 12 secondi la piattaforma si restringe dal raggio corrente fino a 3,6 m, mantenendo spazio per i collider da 1,05 m. Al minimo arrivano impulsi radiali ogni 3 secondi, preannunciati, e una pressione ambientale crescente e limitata. Anche cinque partecipanti che spingono verso il centro non tengono il round fermo. Il round si decide appena resta uno; se gli ultimi cadono nello stesso passo, ordine deterministico per sopravvivenza, minore uscita dal bordo, eliminazioni ottenute e ordine di ingresso. Nessun sort casuale o scelta per semplice scadenza. La camera esistente già esclude gli eliminati e segue i superstiti: mantenuta e verificata.

**Timeout:** cap Arena server da 240 a 300 secondi, distinto dai 45 normali. Il failsafe esistente salta il gioco senza risultati/punti inventati; verificato con cinque partecipanti. Pausa del server e del renderer conservate.

**File:** `src/minigames/arena/arenaRules.ts`, `BabylonArenaGame.ts`, `arenaHud.ts`, `arenaEnvironment.ts`, registry `shared/minigames.ts`; selftest sopravvivenza e browser dedicati. Il maxischermo non chiama più sudden death il normale restringimento iniziale.

**Verifiche:** typecheck, selftest geometria/pressione/spareggio/cap e skip server; 999 controlli abilità e rounds-selftest passati. Browser: cinque partecipanti, quattro pad e un telefono, stick/dash, rejoin in pausa, cinque ancora vivi alla scadenza normale, minimo giocabile con almeno due vivi, conclusione con un superstite dopo circa 66 secondi simulati nonostante input verso il centro; prova separata delle cinque cadute nello stesso passo e classifica/annuncio coerenti. Risultati tramite il gioco, lobby, zero istanze Tripo e un solo canvas dopo cleanup, zero pageerror. Test di contatto reale da telefono: dash, attribuzione dell'eliminazione, avvisi di bordo e caduta per restringimento passati. Screenshot visionato.

**Playtest umano necessario:** intensità e preavviso della pressione, leggibilità al minimo e divertimento della sudden death. Sono parametri della nuova fase, non modifiche fini degli attacchi normali. Nessuna animazione nuova richiesta.

**Produzione e controller:** cinque telefoni e Arena completa a tempo reale, senza debug/accelerazione: sudden death dopo almeno 44 secondi dal VIA, nessun risultato alla semplice scadenza, conclusione naturale e vincitore coerente con superstite/spareggio. Zero pageerror. Suite `gamepad` intera passata con cinque partecipanti (giri supplementari SMALL disattivati): quattro pad, fallback, disconnessioni/riconnessioni ambigue, pairing attraverso più giochi, Quiz PHONE_TEXT, pausa e tasti tenuti senza input fantasma. Build produzione passata.

## Fasi successive

Kart, Casa Carbo, Cornicione e Calcio non ancora implementati né dichiarati verificati. Regressione completa e commit da registrare a fine di ciascuna fase. Quiz: commit locale `fc1731f`.
