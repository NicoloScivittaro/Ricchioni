# GOBLIN TIME — Game Design v0.1 e mazzo originale di 100 carte

**PARTY GAME · minigioco #14 · 2–5 giocatori · telefono + TV.**

> «L’amicizia finisce quando qualcuno sta per vincere.»

## Identità
Gioco di carte competitivo e crudele in senso comico: informazioni private, trappole, ricatti, regole che cambiano, effetti ritardati e controgioco. I 100 titoli e testi sono originali e non riproducono carte di Muffin Time. Il gioco è progettato per essere risolto automaticamente da software; non richiede di spiare, parlare, muoversi o fare gesti nel mondo reale.

## Condizione di vittoria
- Occorrono **esattamente cinque carte in mano**; le trappole armate e le carte in deposito non contano.
- Non appena hai cinque carte, puoi premere **GOBLIN TIME!** dal telefono, anche fuori turno. Appare un allarme sulla TV e tutti conoscono chi sta per vincere.
- Se all’**inizio del tuo prossimo turno effettivo**, dopo gli effetti obbligatori «all'inizio turno» ma prima della tua scelta di gioco, possiedi ancora esattamente cinque carte e il tuo annuncio è tuttora valido, vinci.
- Se scendi sotto cinque o sali sopra cinque, la dichiarazione decade immediatamente. Per provarci di nuovo devi tornare esattamente a cinque e dichiarare di nuovo.
- Se non premi GOBLIN TIME, possedere cinque carte non basta. Per visibilità/accessibilità, il tasto resta evidente finché hai cinque carte.

## Turno semplice
- Ogni giocatore parte con **due carte** pescate dal mazzo unico da 100 senza duplicati.
- Turni in ordine, modificabile dagli effetti. Ogni turno dura al massimo **12 secondi per la scelta principale**, oltre alle finestre di reazione e animazioni.
- Una sola azione principale per turno: **PESCA** (guarda due carte del mazzo, tienine una e scarta l’altra) oppure **GIOCA** una AZIONE/CATASTROFE dalla mano oppure **ARMA** una TRAPPOLA a faccia in giù, massimo **due** attive per giocatore.
- Le RISPOSTE possono essere usate fuori turno quando l'evento che descrivono si verifica, nella finestra di **5 secondi** mostrata solo ai giocatori abilitati.
- Tutti i trasferimenti e le pescate aggiornano le condizioni di GOBLIN TIME. Le carte giocate vanno negli scarti, gli effetti persistenti usano stati separati.
- **Mano massima consigliata:** nove carte. Se un effetto ti porta oltre, selezioni cosa scartare fino a nove prima di qualsiasi verifica vittoria.
- Quando il mazzo si svuota, mischia gli scarti, escludendo le carte in mano, armate o in deposito.

## Regole di risoluzione digitale e protezioni
- Le scelte simultanee si chiudono insieme: non si può copiare il voto di un altro giocatore.
- Per furti casuali, selezione e assegnazione delle carte usa la casualità gestita dall'host con log riproducibili; non mostrare mai carte private a chi non è autorizzato.
- I bersagli impossibili si saltano; se l'effetto non ha alcun bersaglio valido, giocare la carta produce una **PESCA** come ripiego, salvo effetti che descrivono già un ripiego.
- Ogni RISPOSTA viene consumata prima di risolverne l'effetto. Per evitare catene infinite: massimo una RISPOSTA per giocatore per lo stesso evento e massimo quattro reazioni concatenate; copie non copiano copie.
- Ogni TRAPPOLA si attiva una sola volta, solo se il trigger effettivamente avviene. Risolvi in ordine temporale e identifica chiaramente proprietario e bersaglio. Tutte le TRAPPOLE si scartano dopo l'attivazione.
- Gli effetti che contengono «prossimo turno» o «prossimo giro» hanno durate definite dal server. Una pausa sospende tutti i timer. Riconnessione non duplica giocate e ripristina mani e finestre private.
- Nessun reset casuale della partita, nessuna richiesta fisica umiliante, nessun loop di turni extra. Il tono è goliardico, non aggressivo verso persone reali.
- Failsafe di sviluppo: in assenza di vincitore entro 6 minuti, chiudi con una **classifica di emergenza**, non proclamare un falso GOBLIN TIME. Ordina per distanza da cinque carte, poi numero di trappole fatte scattare, poi durata accumulata con cinque carte.

## Quattro famiglie di carte
| Tipo | Quantità | Ruolo |
|---|---:|---|
| AZIONE | 40 | Attacchi diretti, scambi, informazione e controllo dei turni |
| TRAPPOLA | 25 | Condizioni segrete che scattano durante il turno degli altri |
| RISPOSTA | 20 | Difese e contrattacchi rapidi fuori turno |
| CATASTROFE | 15 | Effetti globali spettacolari, giocati come azione principale |
| **Totale** | **100** | **Ogni carta è una sola copia fisica/digitale nel mazzo** |

## Interfaccia PARTY GAME
- **TV:** mano dei partecipanti come numero pubblico (salvo «Silenzio stampa»), tavolo delle trappole coperte, mazzo/scarti, turno, annunci, effetti e timer.
- **Telefono:** mano privata scorrevole, anteprima carta, pulsanti PESCA/GIOCA/ARMA/GOBLIN TIME, richieste bersaglio e finestre RISPOSTA. Dopo ogni azione il telefono riceve un ack privato.
- **Tasti controller:** non necessari; questo è un gioco esclusivamente PHONE_TEXT, come Quiz e Cultura.
- **Punteggio PARTYGAME:** il minigioco restituisce la classifica, ScoreManager assegna i punti globali. Non creare punteggi permanenti interni.

## Identità dei personaggi: proposte di abilità una volta per partita
| Personaggio | Abilità | Effetto / rischio |
|---|---|---|
| Goblin | **N’CULO, NON ERA QUELLA!** | Una volta, dopo una pescata PESCA, sostituisce la carta tenuta con quella scartata; la scelta va fatta entro 3 s e resta pubblica come evento, non come identità delle carte |
| Boschi | **TU QUA NON ENTRI!** | Blocca un furto diretto a sé ma poi deve scartare una propria carta scelta, se ne possiede: una difesa potente che può fargli perdere le cinque carte |
| Victor | **M’HO SVEJATO** | Guarda in privato le prossime tre carte del mazzo e ne rimette due nell'ordine scelto, tenendone una; non può farlo durante un annuncio GOBLIN TIME proprio |
| Carbo | **NO, ASPETTA!** | Se un trasferimento coinvolge Carbo, può obbligare l’autore a cambiare destinatario; se non ne esiste un altro valido, il trasferimento viene annullato ma Carbo pesca una carta (rischiando di superare cinque) |
| Ciro | **PAGO DOMANI** | Rimanda fino all'inizio del suo prossimo turno una perdita di una carta; il debito si paga prima della verifica GOBLIN TIME, quindi non garantisce una vittoria |

*Nota:* le cinque abilità sono idee da bilanciare e centralizzare nel `shared/abilityCatalog.ts`, non carte aggiuntive. Il prototipo deve poterle disattivare senza rompere il mazzo.

## Catalogo completo
Le carte riportate di seguito sono **100 effetti distinti**, tutti da interpretare come regole digitali. Eventi complessi e simultanei richiedono test di combinazione per evitare abusi.

### Azioni (40)

| ID | Carta | Effetto |
|---|---|---|
| `A01` | **Furto con ricevuta** | Ruba una carta casuale a un rivale. La carta rubata viene mostrata a tutti prima di entrare nella tua mano. |
| `A02` | **Cambio di tasca** | Dai una carta scelta a un rivale, poi ricevi una sua carta casuale. Si può giocare solo se avete entrambi almeno una carta. |
| `A03` | **Scontrino gonfiato** | Scegli un rivale: pesca due carte e deve tenerle entrambe. Può portarlo sopra le cinque. |
| `A04` | **Resto sbagliato** | Un rivale con almeno quattro carte te ne consegna una casuale; altrimenti pesca una carta. |
| `A05` | **Finta beneficenza** | Pesca due carte e consegnane una a un rivale a tua scelta, senza guardare il mazzo una seconda volta. |
| `A06` | **Ultima goccia** | Un rivale con più carte di te ne scarta una scelta da lui; altrimenti tu peschi una carta. |
| `A07` | **Sequestro temporaneo** | Metti una carta casuale di un rivale in deposito sigillato: non conta in mano; torna all'inizio del suo prossimo turno, prima della verifica vittoria. |
| `A08` | **Cassa comune** | Ogni giocatore con almeno una carta ne deposita una scelta a faccia in giù. Rimescola e ridistribuiscile casualmente ai depositanti. |
| `A09` | **Telefono scarico** | Un rivale non può giocare carte RISPOSTA fino alla fine del suo prossimo turno. Può ancora agire normalmente. |
| `A10` | **Fidati di me** | Un rivale sceglie: ti consegna una carta casuale oppure mostra privatamente a te tutta la sua mano. |
| `A11` | **Patto a metà** | Tu e un rivale pescate una carta ciascuno, poi ognuno scarta una carta scelta: cambia la mano senza cambiare il conteggio netto. |
| `A12` | **Smaschera il furbo** | Guarda privatamente due carte casuali di un rivale. Puoi scambiare una di quelle con una carta casuale della tua mano. |
| `A13` | **Bonus di presenza** | Pesca una carta per ogni rivale che possiede più carte di te, massimo due carte. |
| `A14` | **Bancomat rotto** | Un rivale sceglie: scarta una carta scelta oppure ti dà una carta casuale. |
| `A15` | **Debito di famiglia** | Assegna a un rivale un debito: all'inizio del suo prossimo turno, prima della vittoria, deve scartare una carta oppure rinunciare alla sua azione principale di quel turno. |
| `A16` | **Reso non autorizzato** | Prendi una carta scelta fra le ultime tre della pila degli scarti; poi scarta una carta casuale dalla mano. |
| `A17` | **Sciopero di quartiere** | Un rivale non potrà scegliere PESCA come azione principale nel proprio prossimo turno; potrà giocare o preparare carte. |
| `A18` | **Doppio gioco** | Un rivale mostra due carte a tua scelta casuale della sua mano. Ne scegli una da rubare e gli consegni una carta casuale dalla tua mano. |
| `A19` | **Conto alla rovescia** | Il prossimo turno di un rivale dura quattro secondi per scegliere l'azione principale, invece del tempo normale. |
| `A20` | **Prima io** | Ottieni un turno aggiuntivo subito dopo il tuo, senza poter attivare un altro turno extra durante quello aggiuntivo. |
| `A21` | **Giro di boa** | Inverti l'ordine di gioco e fai pescare una carta al giocatore che sarebbe stato il prossimo prima dell'inversione. |
| `A22` | **Io non c'ero** | Rimuovi da te un effetto negativo temporaneo e, se valido, trasferiscilo a un rivale. |
| `A23` | **Controllo antidoping** | Un rivale con almeno tre carte rivela quante carte RISPOSTA ha. Se ne ha almeno due, deve scartarne una scelta. |
| `A24` | **Tre sul tavolo** | Rivela le prime tre carte del mazzo; prendine una e metti le altre due in fondo nell'ordine che scegli. |
| `A25` | **Sanzione social** | Un rivale non può annunciare GOBLIN TIME fino alla fine del suo prossimo turno, anche se raggiunge cinque carte. |
| `A26` | **Pignoramento** | Riprendi in mano una trappola coperta di un rivale: perde lo stato di trappola e diventa una tua carta. Se non ha trappole, pesca una carta. |
| `A27` | **Prestito lampo** | Pesca tre carte. All'inizio del tuo prossimo turno restituisci due carte scelte al fondo del mazzo, prima di verificare GOBLIN TIME. |
| `A28` | **Falsa sicurezza** | Il prossimo PESCA di un rivale mostra pubblicamente entrambe le carte proposte, prima che ne conservi una. |
| `A29` | **Passaparola** | Scegli due giocatori diversi con almeno una carta ciascuno, anche includendo te: si scambiano simultaneamente una carta casuale. |
| `A30` | **Prima paghi tu** | Un rivale deve scegliere: scartare una carta scelta oppure permetterti di pescare una carta. |
| `A31` | **Terzo incomodo** | Ogni giocatore che ha esattamente cinque carte, incluso te, deve pescare una carta. Se nessuno ne ha cinque, pesca tu una carta. |
| `A32` | **Silenzio stampa** | Fino all'inizio del tuo prossimo turno, gli altri vedono «?» anziché il tuo numero di carte; un eventuale annuncio GOBLIN TIME resta pubblico. |
| `A33` | **Tagliando vincente** | Nomina AZIONE, TRAPPOLA, RISPOSTA o CATASTROFE e scegli un rivale. Se ha almeno una carta del tipo nominato, ne rubi una casuale; altrimenti gli dai una tua carta scelta. |
| `A34` | **Mini truffa** | Se un rivale ti ha sottratto una carta dall'ultimo tuo turno, rubagliene una casuale; altrimenti pesca una carta e rivelala pubblicamente. |
| `A35` | **Evasione creativa** | Piazza immediatamente una TRAPPOLA dalla tua mano senza consumare uno slot aggiuntivo; poi pesca una carta. Se non hai trappole, pesca soltanto una carta. |
| `A36` | **Sospensione cautelare** | Una trappola coperta di un rivale resta disattivata fino all'inizio del tuo prossimo turno, poi torna armata. |
| `A37` | **Proposta indecente** | Tu e un rivale scegliete segretamente «SCAMBIO» o «RIFIUTO». Se entrambi scelgono SCAMBIO, scambiate una carta casuale; altrimenti entrambi pescate una carta. |
| `A38` | **Deposito cauzionale** | Proteggi una tua carta scelta in deposito fino all'inizio del tuo prossimo turno: non conta nelle cinque ma non può essere rubata né scartata nel frattempo. |
| `A39` | **Regalo avvelenato** | Dai a un rivale una carta scelta dalla tua mano. Quella carta non può essere giocata o scartata volontariamente fino alla fine del suo prossimo turno. |
| `A40` | **Ultimo screenshot** | Guarda privatamente la mano di un rivale. Poi scegli se rivelare pubblicamente una delle sue carte oppure pescare una carta per te. |

### Trappole (25)

| ID | Carta | Effetto |
|---|---|---|
| `T01` | **Mani lunghe, mani vuote** | Quando qualcuno ti ruba una carta, il ladro deve restituirla e consegnarti anche una sua carta casuale, se ne ha. |
| `T02` | **Pesca a strascico** | Quando un rivale sceglie una delle due carte di PESCA, prendi tu la carta che stava per scartare. |
| `T03` | **C'è Goblin Time?** | Quando un rivale annuncia GOBLIN TIME, rubagli subito una carta casuale. |
| `T04` | **Troppa grazia** | Quando un rivale supera cinque carte, deve scartarne una scelta. Non annulla l'eventuale effetto già risolto. |
| `T05` | **Occhio alla mano** | Quando un rivale guarda privatamente la mano di qualcuno, deve rivelare pubblicamente una propria carta casuale e poi scartarla. |
| `T06` | **Tassa sulle trappole** | Quando un rivale piazza una TRAPPOLA, quella nuova trappola viene scartata e tu peschi una carta. |
| `T07` | **Carta bollata** | Quando un rivale scarta una sola carta per un effetto, quella carta entra invece nella tua mano. |
| `T08` | **Assicurazione fasulla** | Quando sei obbligato a scartare per effetto di un rivale, puoi spostare quell'obbligo sull'autore, se ha almeno una carta. |
| `T09` | **Non vale, ma vale** | Quando un rivale annulla una carta con una RISPOSTA, quell'annullamento riesce ma lui deve anche scartare una carta casuale. |
| `T10` | **Indirizzo sbagliato** | Quando un rivale consegna una carta a un altro giocatore, intercetta quella carta e mettila nella tua mano. |
| `T11` | **Notaio infame** | All'inizio del turno di un rivale che aveva annunciato GOBLIN TIME, prima della verifica vittoria, rubagli una carta casuale. |
| `T12` | **Falso straordinario** | Quando un rivale ottiene un turno extra, quel turno viene annullato e lui deve scartare una carta scelta. |
| `T13` | **Sei molto curioso** | Quando un rivale scopre una carta coperta o un effetto segreto di qualcuno, pesca una carta tu e mostragliela. |
| `T14` | **Consegna respinta** | Quando un rivale riceve una carta donata da un altro, il destinatario la restituisce e tu peschi una carta. |
| `T15` | **Ultimo centesimo** | Quando un rivale scende a una sola carta, prendi una carta dal mazzo e passagliela: gli impedisci di restare con una mano «pulita» da ricostruire. |
| `T16` | **Scarto mio** | Quando un rivale scarta due o più carte in un singolo effetto, prendine una casuale prima che tocchi la pila degli scarti. |
| `T17` | **Porta in faccia** | Quando un rivale ti prende di mira con un'AZIONE, quell'azione si risolve ma il rivale non può scegliere te come bersaglio nel prossimo turno. |
| `T18` | **Bomba a orologeria** | Quando un rivale termina il turno con esattamente quattro carte, pesca due carte senza poter scegliere: ora deve gestire l'eccesso. |
| `T19` | **Clausola nascosta** | Quando un rivale trasferisce un effetto negativo su un'altra persona, l'effetto rimbalza su chi l'ha trasferito. |
| `T20` | **Che ti ridi?** | Quando un rivale ottiene una carta grazie a una TRAPPOLA, deve scartarne una casuale subito dopo. |
| `T21` | **Multa per eccesso** | Quando un rivale usa una carta che colpisce almeno due giocatori, scarta una carta scelta o l'effetto viene annullato. |
| `T22` | **Chiusa per ferie** | Quando un rivale tenta di riprendere una carta da un deposito, quella carta viene invece aggiunta in fondo al mazzo e il deposito si svuota. |
| `T23` | **Neanche per sogno** | Quando un rivale prova a giocare la propria ultima carta, la carta si risolve ma il rivale deve pescare subito due nuove carte. |
| `T24` | **Prendi due, dai tre** | Quando un rivale pesca almeno due carte con una singola AZIONE, ne sceglie una tra quelle pescate e la consegna a te. |
| `T25` | **Scambio sospetto** | Quando due giocatori effettuano uno scambio simultaneo, tu puoi scegliere una delle due carte scambiate: diventa tua; il destinatario previsto non la riceve. |

### Risposte (20)

| ID | Carta | Effetto |
|---|---|---|
| `R01` | **Nun ce provà** | Annulla un'AZIONE singola appena giocata che ti prende di mira. |
| `R02` | **Rigira la frittata** | Rifletti sull'autore un effetto singolo che ti farebbe pescare, scartare o consegnare carte. |
| `R03` | **Taschine chiuse** | Impedisci un furto a tuo danno e pesca una carta dal mazzo in compensazione. |
| `R04` | **Casco da cantiere** | Impedisci una perdita forzata di carte a tuo danno; l'autore dell'effetto deve rivelare una propria carta casuale. |
| `R05` | **Ultima bastardata** | Subito dopo l'annuncio GOBLIN TIME di un rivale, puoi obbligarlo a pescare una carta. Non è attivabile più di una volta per annuncio per giocatore. |
| `R06` | **Trappola? Quale trappola?** | Annulla una TRAPPOLA appena scattata contro di te; la trappola viene comunque scartata. |
| `R07` | **Sono fuori** | Ignora per te gli effetti di una CATASTROFE che coinvolge più giocatori; gli altri la risolvono normalmente. |
| `R08` | **Rinviato al mittente** | Impedisci di saltare o accorciare il tuo prossimo turno e assegna all'autore il limite di quattro secondi nel suo prossimo turno. |
| `R09` | **Scelta mia** | Quando qualcuno ti ruba una carta casuale, scegli tu quale delle tue carte gli darai. |
| `R10` | **Non così tanto** | Quando un rivale sta per pescare almeno tre carte per un unico effetto, riduci la sua pescata di due e pesca una carta tu. |
| `R11` | **Fotocopia illegale** | Copia l'effetto di una RISPOSTA appena risolta, scegliendo bersagli validi; una copia non può essere nuovamente copiata. |
| `R12` | **Ultimo respiro** | Quando stai per finire con zero carte, annulla solo l'ultima perdita che lo causerebbe e pesca una carta. |
| `R13` | **Gira a destra** | Sposta su un altro bersaglio valido un'AZIONE diretta solo a te; con due giocatori la rimandi all'autore. |
| `R14` | **Privacy, grazie** | Nega a un rivale l'accesso alla tua mano e guarda privatamente una sua carta casuale. |
| `R15` | **Consegna intercettata** | Quando un rivale riceve una carta dal mazzo per effetto di un'AZIONE, rubagli proprio quella carta prima che entri nella sua mano. |
| `R16` | **Ti sei allargato** | Annulla soltanto il turno extra che un rivale sta per ottenere e pesca una carta. |
| `R17` | **Beccato con le mani** | Quando un rivale piazza una trappola, rivela il nome della nuova trappola solo a te; puoi obbligarlo a riprenderla in mano. |
| `R18` | **Riscatto immediato** | Quando una tua carta viene mandata in deposito, riprendila in mano e costringi l'autore a scartare una carta casuale. |
| `R19` | **Un attimo prima** | Dopo che un bersaglio di un effetto casuale è stato estratto, chiedi un nuovo sorteggio fra i bersagli validi e imponi il nuovo risultato. |
| `R20` | **Carta coperta** | Quando una tua carta viene rivelata pubblicamente, impediscilo e costringi chi ha causato la rivelazione a mostrare una propria carta casuale. |

### Catastrofi (15)

| ID | Carta | Effetto |
|---|---|---|
| `C01` | **Riunione condominiale** | Ogni giocatore con almeno cinque carte consegna simultaneamente una carta scelta al giocatore con meno carte, risolvendo i pari con ordine di turno. |
| `C02` | **Blackout totale** | Fino al termine del prossimo turno del giocatore attivo, nessuno può giocare RISPOSTA; le TRAPPOLE già armate continuano a funzionare. |
| `C03` | **Cambio di identità** | Tutti consegnano la propria mano coperta al server, che ridistribuisce casualmente le carte mantenendo il numero di carte che ciascuno possedeva. |
| `C04` | **Gogna pubblica** | Tutti votano in segreto un giocatore, senza potersi votare. Chi riceve più voti scarta due carte scelte; a pari merito ciascun primo scarta una carta. |
| `C05` | **Mercatino abusivo** | Rivela quattro carte del mazzo. Prendine una, poi assegna le altre tre una alla volta ai rivali (uno stesso rivale può riceverne più di una). |
| `C06` | **Sequestro di reazioni** | Tutti scartano una RISPOSTA scelta se la possiedono, poi tutti pescano una carta. |
| `C07` | **Processo sommario** | Ogni giocatore sceglie in segreto «ACCUSA» oppure «COPRE». Se tutti coprono, ciascuno pesca una carta; altrimenti chi accusa ruba una carta casuale da un giocatore che copre, se disponibile. |
| `C08` | **Ultima chiamata** | Per il prossimo giro completo, tutti hanno quattro secondi per scegliere l'azione principale; chi non sceglie passa il turno senza pescare. |
| `C09` | **Colpo di stato** | Scambia integralmente le mani di due giocatori scelti, incluso eventualmente te; entrambi perdono un annuncio GOBLIN TIME precedente. |
| `C10` | **Redistribuzione maledetta** | Il giocatore con più carte scarta una carta scelta; quello con meno carte ne pesca due. Risolvi i pari in ordine di turno. |
| `C11` | **Rubinetto di cavolate** | Ogni giocatore sceglie: scarta una carta oppure rivela pubblicamente tutte le carte AZIONE che possiede. |
| `C12` | **Ispettore delle trappole** | Tutti i giocatori con trappole armate scelgono una loro trappola: la riprendono in mano oppure scartano una carta dalla mano. |
| `C13` | **Cambio di tavolo** | Ogni giocatore passa tutta la propria mano al giocatore successivo nell'ordine del turno. Annulla tutti gli annunci GOBLIN TIME in corso. |
| `C14` | **Finta pace** | Tutti scelgono segretamente una carta dalla propria mano. Il server le mescola e ne restituisce una casuale a ciascun partecipante; chi non ha carte non partecipa. |
| `C15` | **Reset bastardo** | Tutti i giocatori sopra cinque carte scartano fino ad averne esattamente cinque, ma non possono annunciare GOBLIN TIME per effetto di questa carta; possono farlo dopo una futura variazione della mano. |

## Note per lo sviluppo
- Tutte le regole numeriche (mano iniziale, obiettivo, timer, numero trappole, cap reazioni) devono stare in un file di tuning, non essere sparse in UI e engine.
- Validare 100 ID, 100 nomi differenti, no duplicati, almeno una scelta o controgioco per gli effetti forti, target 2–5 giocatori.
- Testare l'effetto di ogni carta almeno una volta, combinazioni trappola/risposta, annuncio a 5, perdita e recupero di 5, salti/turni extra, svuotamento mazzo, sospensione/riconnessione, timeout e bot.
- Si tratta di un **documento di design da implementare e rifinire**, non di codice già integrato nel repository.
