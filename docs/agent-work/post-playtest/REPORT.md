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

## Fasi successive

Arena, Kart, Casa Carbo, Cornicione e Calcio non ancora implementati né dichiarati verificati. Regressione completa e commit da registrare a fine di ciascuna fase.
