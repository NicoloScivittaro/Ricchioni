# GOBLIN TIME — Le carte di noi cinque

25 nuove carte di design: cinque per Goblin, Boschi, Victor, Carbo e Ciro. Ogni gruppo contiene due AZIONI, una TRAPPOLA, una RISPOSTA e una CATASTROFE. Tutti possono pescare e usare qualsiasi carta: il personaggio raffigurato è il protagonista della gag, non un requisito per giocarla.

## Background usato

- **Goblin / Nicolò:** creatore del gioco, competitivo, poco sobrio, exploit e rimonte all'ultimo.
- **Boschi / Christian:** buttafuori, sicurezza, bisogno di capire e poi determinazione; non un truffatore.
- **Victor:** rilassato, sicuro di sé, risveglio improvviso, shaker e battuta dei 20 kg. Il soprannome Dottore non lo rende un medico o uno scienziato.
- **Carbo:** judoka tecnico, granita, contestazioni e regole di casa. «Angora che dici?» resta scritto così.
- **Ciro:** trattative, spicci mancanti, pagamenti rimandati, ripartizioni convenienti e clausole.

Fonti: [scheda del progetto](PARTY_GAME_PER_CHATGPT.md), [personaggi](../shared/characters.ts), [presentazione](../shared/characterPresentation.ts), [Cornicione](CORNICIONE.md). Le scene delle carte sono nuove gag, non fatti biografici aggiunti sugli amici.

## Compatibilità e stato

Il pacchetto è **implementato nella variante NOI CINQUE di GOBLIN TIME**. Dettagli e verifiche nel [report di implementazione](agent-work/goblin-time/REPORT.md). I due originali nei Download restano invariati. Il testo di implementazione allegato è stato usato come contesto delle regole; questa consegna riguarda le carte personalizzate.

Il mazzo base resta di 100 carte. Nella variante NOI CINQUE, il totale diventa **125**: 50 AZIONI, 30 TRAPPOLE, 25 RISPOSTE e 20 CATASTROFI, una copia per ID. Il motore usa il totale del catalogo attivo per gli invarianti. Per mantenere un mazzo da 100 occorrerà definire un elenco esplicito di sostituzioni, conservando il catalogo originale separato. Qui non viene applicata alcuna sostituzione.

Le abilità originali dei cinque personaggi restano separate dalle carte e non vengono modificate. I nuovi effetti hanno handler espliciti; questo JSON non viene interpretato a runtime dal gioco.

## Regole comuni del pacchetto

- Vittoria sempre con esattamente cinque carte e dichiarazione mantenuta fino al prossimo turno effettivo. Ogni uscita o entrata di carte va verificata: tornare a cinque non riattiva una dichiarazione annullata.
- Prima di risolvere una carta giocata, spostarla dalla mano alla zona di risoluzione. Non può pagare il proprio costo né recuperare sé stessa. Una RISPOSTA si consuma prima del suo effetto, anche quando questo viene annullato.
- Le scelte simultanee sono segrete fino alla chiusura. Se serve una seconda scelta di carte, resta privata; la TV vede solamente operazioni pubbliche e carte effettivamente rivelate. Le carte offerte sono visibili solo al destinatario finché un effetto non le rivela.
- Ordine di turno: giocatore attivo, poi gli altri nell'ordine corrente. Trappole concorrenti: ordine di armamento; ricontrollare il trigger e la disponibilità delle carte prima di ciascuna risoluzione. Una carta intercettata non può essere trasferita nuovamente da un effetto successivo.
- Le carte entrano prima nella zona di risoluzione, poi nei normali scarti; non si perdono né si duplicano. Per costi e scelte sono valide soltanto carte effettivamente presenti e non bloccate da altri effetti.
- Una sola attivazione per trappola, una RISPOSTA per giocatore e per evento, massimo quattro reazioni concatenate. Gli effetti del pacchetto generano gli stessi eventi di pescata, furto, scarto, trasferimento, deposito e ritorno previsti dal catalogo base.
- Una pescata di N carte prende al massimo N carte disponibili, rimescolando gli scarti quando necessario. Se non ci sono carte disponibili, la parte di pescata non avviene. Il limite di mano del catalogo base resta valido.
- I debiti sono separati dalla carta che li ha creati. Restituzioni da deposito, debiti, trappole e reazioni obbligatorie si risolvono prima del controllo vittoria. Una sospensione di turno rinvia anche il controllo al prossimo turno effettivo; la pausa sospende i timer.
- Timeout di scelta: prima opzione legale nell'ordine mostrato; per una carta, prima carta legale nella mano corrente; per un bersaglio, primo valido in ordine di turno. Nelle scelte di voto l'ordine è RIEMPI/SVUOTA oppure PAGO/SCAPPO. Per gli scarti facoltativi di PV02 la scelta automatica è zero. La selezione automatica rimane privata.
- Un effetto impossibile non inventa un bersaglio. I requisiti dichiarati impediscono la giocata; se il bersaglio diventa impossibile durante la risoluzione, saltare quella parte senza annullare trasferimenti già completati.

## Direzione grafica

Il tipo guida il colore: AZIONE blu, TRAPPOLA rosso, RISPOSTA verde, CATASTROFE viola. Una fascia secondaria usa il colore del personaggio: Goblin verde, Boschi rosso, Victor ciano, Carbo ambra, Ciro viola. Titolo, icona, battuta e scena distinguono ogni carta. L'anteprima HTML contiene simboli SVG originali e sintetici; le descrizioni delle illustrazioni indicano le scene complete per un eventuale passaggio artistico.

## Catalogo

### Goblin

#### PG01 — L'ho fatto io 'sto gioco · AZIONE

**In breve:** Controlla gli scarti: scegli un tipo e recupera una carta, pagando una tua carta.

**Effetto:** Nomina un tipo di carta. Tra le ultime cinque carte degli scarti, recupera una carta di quel tipo a tua scelta; prima devi mettere una carta scelta della tua mano in fondo al mazzo. La carta giocata è ancora in risoluzione e non è recuperabile. Puoi giocarla soltanto se hai un'altra carta da pagare e un recupero valido.

**Quando:** Azione principale; scelta pubblica del tipo e del recupero, pagamento privato.

**Battuta:** «È una feature. L'ho scritta io.»

**Illustrazione:** Goblin col boccale davanti a un terminale; una carta esce da una parentesi graffa.

#### PG02 — Rimonta al 90° · AZIONE

**In breve:** Se sei indietro, pesca due carte; altrimenti pescane una e mostrala.

**Effetto:** Dopo aver messo questa carta in risoluzione, confronta il tuo numero di carte con quello dei rivali. Se hai meno carte di tutti loro, pesca due carte e tienile entrambe. Altrimenti pesca una carta e rivelala pubblicamente. Si applicano normalmente limite della mano e annullamento delle dichiarazioni.

**Quando:** Azione principale; confronto prima della pescata.

**Battuta:** «ANNAMO, C'È ANCORA TEMPO!»

**Illustrazione:** Goblin scivola verso due carte sotto un tabellone 90:00, con boccale inclinato.

#### PG03 — Jäger sul regolamento · TRAPPOLA

**In breve:** Il primo rivale che tiene una carta con PESCA deve pescare anche l'altra.

**Effetto:** Scatta quando un rivale sta per completare PESCA dopo aver scelto quale delle due carte tenere. Anche la carta destinata agli scarti entra nella sua mano. Scatta soltanto se quella carta è ancora nella zona temporanea della pescata; non recupera una carta già intercettata. La trappola si consuma una sola volta.

**Quando:** Prima dello scarto finale di PESCA; competizione con T02 in ordine di armamento.

**Battuta:** «MA N'CULO, PURE QUESTA?!»

**Illustrazione:** Bottiglietta verde rovesciata sul regolamento; due carte incollate da una macchia.

#### PG04 — Rollback istintivo · RISPOSTA

**In breve:** Sostituisci un tuo scarto forzato con una pescata obbligatoria.

**Effetto:** Quando un effetto di un rivale sta per obbligarti a scartare esattamente una carta, consuma questa RISPOSTA, annulla soltanto quello scarto e pesca una carta. Non annulla pagamenti volontari, costi di carte o scarti per il limite della mano. La pescata può farti perdere GOBLIN TIME.

**Quando:** Prima di una perdita forzata singola; la RISPOSTA viene consumata prima della pescata.

**Battuta:** «ASPÈ, TORNIAMO A PRIMA.»

**Illustrazione:** Goblin preme una freccia indietro; una carta rimbalza e ne compare un'altra.

#### PG05 — Patch del venerdì sera · CATASTROFE

**In breve:** Tutti cambiano una carta: scelgono il pagamento, ricevono una carta nuova.

**Effetto:** Ogni giocatore con almeno una carta in mano ne sceglie una in segreto. Le carte selezionate vengono messe insieme in fondo al mazzo, in ordine di turno a partire dall'autore; poi ogni partecipante pesca una carta, nello stesso ordine. Le mani vuote non partecipano. Le perdite e le pescate sono eventi distinti: una dichiarazione invalidata non si ripristina.

**Quando:** Azione principale; selezioni segrete chiuse insieme prima di spostare le carte.

**Battuta:** «TRANQUILLI, HO CAMBIATO DUE RIGHE.»

**Illustrazione:** Goblin col boccale sopra un enorme pulsante AGGIORNA; carte cadono dal terminale.

### Boschi

#### PB01 — Documento, prego · AZIONE

**In breve:** Un rivale ti mostra una carta segreta oppure paga scartandola.

**Effetto:** Scegli un rivale con almeno una carta. Il bersaglio seleziona una propria carta e sceglie se mostrarla soltanto a te oppure scartarla pubblicamente. Se la mostra, rimane nella sua mano. Nessun altro riceve la carta privata e non viene imposto un tipo di carta.

**Quando:** Azione principale; scelta privata del bersaglio.

**Battuta:** «TU QUA ENTRI SOLO SE ME FAI VEDE'.»

**Illustrazione:** Boschi con occhiali scuri ed auricolare confronta una carta con un pass d'ingresso.

#### PB02 — Mo m'impegno · AZIONE

**In breve:** Prepara la tua prossima PESCA: scegli una carta fra tre.

**Effetto:** Fino alla fine del tuo prossimo turno effettivo, la tua prima PESCA propone tre carte invece di due: ne tieni una e scarti le altre due. È sempre una sola azione PESCA, non un turno extra. Il bonus si consuma alla prima PESCA oppure scade; non si cumula con un'altra copia dello stesso bonus. Se il mazzo offre meno carte, scegli tra quelle disponibili.

**Quando:** Azione principale; bonus persistente con una sola attivazione.

**Battuta:** «ADESSO SÌ.»

**Illustrazione:** Boschi si sistema i guanti e punta una torcia su tre carte allineate.

#### PB03 — Lista all'ingresso · TRAPPOLA

**In breve:** Il primo dono a un rivale va direttamente agli scarti.

**Effetto:** Quando un rivale sta per ricevere una carta donata volontariamente da un altro giocatore, manda quella carta negli scarti invece che nella sua mano. Non riguarda pescate, furti, scambi simultanei o restituzioni da deposito. La carta lascia comunque la mano del donatore. Se il dono viene annullato prima, la trappola resta armata.

**Quando:** Prima della consegna di un dono; una sola attivazione.

**Battuta:** «IL TUO NOME NON C'È.»

**Illustrazione:** Un cordone rosso e Boschi che barra una carta su una lista.

#### PB04 — Aspè... famme capì · RISPOSTA

**In breve:** Costringi l'attaccante a pagare una carta o ad annullare l'AZIONE.

**Effetto:** Quando un rivale gioca un'AZIONE diretta soltanto a te, consuma questa RISPOSTA. L'autore sceglie: scarta una carta della propria mano e risolve normalmente l'AZIONE, oppure la annulla. Se non può pagare, l'AZIONE è annullata. La carta AZIONE giocata non può essere usata come pagamento e rimane consumata.

**Quando:** Prima della risoluzione di un'AZIONE con bersaglio unico.

**Battuta:** «MO SE TE RIBALTO VINCO IO?»

**Illustrazione:** Boschi alza un dito; dietro di lui un enorme punto interrogativo e un tornello.

#### PB05 — Buttafuori dal tavolo · CATASTROFE

**In breve:** Chi ha trappole sceglie se perderne una o pagare due carte.

**Effetto:** Ogni giocatore con almeno una trappola armata, incluso l'autore, sceglie in segreto: scartare una propria trappola armata oppure scartare due carte della propria mano. Il pagamento in mano è consentito soltanto con almeno due carte. Le scelte si chiudono insieme e si risolvono in ordine di turno. Le trappole rimosse vengono rivelate e scartate senza attivarsi.

**Quando:** Azione principale; espulsione di trappole, non attivazione.

**Battuta:** «RAGAZZI, SI CHIUDE.»

**Illustrazione:** Boschi solleva il cordone attorno al tavolo mentre cinque trappole cercano di entrare.

### Victor

#### PV01 — Tutto calcolato. Più o meno · AZIONE

**In breve:** Prevedi il tipo della prossima carta: se indovini, puoi tenerla.

**Effetto:** Nomina AZIONE, TRAPPOLA, RISPOSTA o CATASTROFE prima di rivelare la prima carta disponibile del mazzo. Se il tipo coincide, scegli se tenerla oppure scartarla. Se sbagli, la carta rivelata viene scartata e un rivale scelto da te pesca una carta. Se non esistono carte disponibili, l'effetto termina senza pescate.

**Quando:** Azione principale; previsione pubblica prima di accedere al mazzo.

**Battuta:** «TRANQUILLI, SO QUELLO CHE FACCIO.»

**Illustrazione:** Victor con occhiali e shaker indica una lavagnetta con quattro simboli e un punto interrogativo.

#### PV02 — 20 kg in un mese · AZIONE

**In breve:** Alleggerisci la mano, poi riparti: scarta fino a due carte e pescane una.

**Effetto:** Dopo aver giocato questa carta, scegli zero, una o due carte della tua mano e scartale; poi pesca una carta. Scarti e pescata vengono risolti separatamente. Non è una PESCA: non scegli fra due carte. La dichiarazione GOBLIN TIME può essere annullata anche se il conteggio finale torna a cinque.

**Quando:** Azione principale; scelta privata degli scarti.

**Battuta:** «FACILE. BASTAVA LASCIÀ QUALCOSA.»

**Illustrazione:** Victor rilassato sul divano, shaker accanto e due carte su una bilancia da valigia.

#### PV03 — Sveglia in ritardo · TRAPPOLA

**In breve:** Quando un rivale termina con cinque carte, tutti gli altri pescano.

**Effetto:** Scatta la prima volta che un rivale termina un turno effettivo con esattamente cinque carte. Tutti gli altri giocatori, incluso il proprietario della trappola, pescano una carta in ordine di turno. Il rivale che ha fatto scattare la trappola non pesca. Le pescate non conferiscono una vittoria immediata e possono invalidare altre dichiarazioni.

**Quando:** Fine turno, dopo gli effetti obbligatori di fine turno e prima del passaggio al successivo.

**Battuta:** «AH, MA STAVAMO A GIOCÀ?»

**Illustrazione:** Victor apre un occhio sopra il tavolo; una sveglia fa saltare carte verso gli altri posti.

#### PV04 — Occhio aperto · RISPOSTA

**In breve:** Una rivelazione pubblica diventa privata per un solo rivale.

**Effetto:** Quando un effetto di un rivale sta per rivelare pubblicamente almeno una carta della tua mano senza trasferirla o scartarla, consuma questa RISPOSTA. Le carte interessate restano nella mano e diventano visibili soltanto all'autore dell'effetto; il tavolo vede solo il numero di carte osservate. Non modifica una rivelazione necessaria a un furto pubblico o a uno scarto.

**Quando:** Prima di una rivelazione pubblica separabile da altre operazioni.

**Battuta:** «L'HO VISTA. NON SERVE CHE LA VEDETE TUTTI.»

**Illustrazione:** Victor con un occhio aperto; un siparietto copre le carte davanti al pubblico.

#### PV05 — Pausa sul divano · CATASTROFE

**In breve:** Tutti scelgono: pescare una carta oppure riprendersi una trappola.

**Effetto:** Ogni giocatore sceglie in segreto PESCA UNA oppure RIPRENDI UNA TRAPPOLA. La seconda opzione è disponibile solo se possiede una trappola armata; sceglie quale, la disarma e la rimette nella propria mano senza attivarla. Le scelte si chiudono insieme e si risolvono in ordine di turno. Chi non ha trappole pesca una carta. Non sospende timer o partita.

**Quando:** Azione principale; decisioni simultanee segrete.

**Battuta:** «DUE MINUTI E ARRIVO.»

**Illustrazione:** Victor sul divano al centro del tavolo, con shaker e trappole usate come cuscini.

### Carbo

#### PC01 — Granita sequestrata · AZIONE

**In breve:** Un rivale sceglie: conserva una carta in deposito oppure ne pesca una.

**Effetto:** Scegli un rivale con almeno una carta. Può mettere una carta scelta della propria mano in deposito sigillato oppure pescare una carta. Il deposito non conta nella mano e torna al suo proprietario all'inizio del prossimo turno effettivo, prima del controllo vittoria. Se non ha più carte quando decide, pesca. La restituzione resta soggetta a trappole compatibili.

**Quando:** Azione principale; scelta privata, restituzione obbligatoria prima della vittoria.

**Battuta:** «EH?! LA GRANITA NON SI TOCCA.»

**Illustrazione:** Carbo protegge un bicchiere rosa dentro una cassaforte a forma di carta.

#### PC02 — Ippon di carte · AZIONE

**In breve:** Scambia una tua carta scelta con la trappola coperta di un rivale.

**Effetto:** Scegli un rivale con una trappola armata e una carta della tua mano da consegnargli. Scegli uno dei suoi slot coperti senza conoscerne il contenuto. La trappola viene disarmata ed entra nella tua mano; la carta offerta entra nella mano del rivale. Lo scambio è simultaneo e non attiva la trappola prelevata. Richiede una carta da offrire e uno slot valido.

**Quando:** Azione principale; scambio simultaneo, contenuto dello slot privato fino al trasferimento.

**Battuta:** «ANGORA CHE DICI? IPPON!»

**Illustrazione:** Carbo proietta una carta coperta sopra il tavolo con una cintura da judo.

#### PC03 — Granita finita · TRAPPOLA

**In breve:** Il primo rivale che termina con tre carte ne sceglie una da scartare.

**Effetto:** Scatta quando un rivale termina un turno effettivo con esattamente tre carte. Quel rivale scarta una carta scelta della propria mano. La trappola si consuma una sola volta e non interviene se il conteggio cambia prima della sua risoluzione e non è più tre.

**Quando:** Fine turno; ricontrollo del conteggio prima della risoluzione.

**Battuta:** «MO CHI LA VA A PRENDE'?»

**Illustrazione:** Carbo mostra un bicchiere vuoto; una cannuccia tira via una delle tre carte.

#### PC04 — Angora che dici? · RISPOSTA

**In breve:** Contesta un turno extra: il rivale può comprarlo con due carte.

**Effetto:** Quando un rivale sta per ottenere un turno extra, consuma questa RISPOSTA. Quel rivale può scartare due carte scelte della propria mano per conservare il turno extra; se rifiuta o non può pagare, il turno extra è annullato. Non crea turni aggiuntivi e non toglie il prossimo turno ordinario. Un turno extra rimane incapace di generarne altri.

**Quando:** Prima dell'assegnazione di un turno extra.

**Battuta:** «SECONDO IL REGOLAMENTO DI CASA MIA...»

**Illustrazione:** Carbo in judogi brandisce un regolamento con un cartellino DUE CARTE.

#### PC05 — Casa mia, regole mie · CATASTROFE

**In breve:** Tutti votano: una pescata per tutti oppure uno scarto per tutti.

**Effetto:** Tutti votano in segreto RIEMPI oppure SVUOTA. Vince la maggioranza; in caso di pareggio prevale il voto dell'autore. Con RIEMPI, ogni giocatore pesca una carta; con SVUOTA, ogni giocatore che ha carte ne scarta una scelta. Risolvi in ordine di turno. La votazione avviene una sola volta e non modifica le regole permanenti o il numero necessario per vincere.

**Quando:** Azione principale; votazione segreta, poi eventuali scelte private di scarto.

**Battuta:** «QUESTA REGOLA L'AVEVO DETTA PRIMA.»

**Illustrazione:** Carbo in piedi su un tavolo domestico con granita e due urne PIÙ/MENO.

### Ciro

#### PI01 — 50 e 50: 80 a me · AZIONE

**In breve:** Offri una carta: il rivale accetta e ne pesca una, oppure ti lascia pescare due.

**Effetto:** Scegli un rivale e metti una carta scelta della tua mano in un'offerta privata, visibile solo al destinatario. Se accetta, riceve quella carta e pesca una carta. Se rifiuta, la carta offerta torna nella tua mano e tu peschi due carte. Richiede una carta da offrire. L'offerta è una zona temporanea: uscire dalla mano può invalidare GOBLIN TIME anche se la carta ritorna.

**Quando:** Azione principale; offerta privata e accettazione del bersaglio.

**Battuta:** «FACCIAMO METÀ E METÀ. POI VEDIAMO.»

**Illustrazione:** Ciro tiene una torta di carte: la sua fetta è enorme, quella del rivale minuscola.

#### PI02 — Non c'ho spicci · AZIONE

**In breve:** Liberati di una carta oppure tienila e pescane un'altra.

**Effetto:** Metti una carta scelta della tua mano in un'offerta privata a un rivale. Il destinatario sceglie: accetta il dono, oppure la carta offerta torna nella tua mano e tu peschi una carta. Richiede una carta da offrire. Il dono accettato attiva gli eventi di consegna; l'offerta rifiutata non è un dono. La zona temporanea non conta nella mano.

**Quando:** Azione principale; dono soggetto all'accettazione.

**Battuta:** «TE LI DO, MA IN CARTE.»

**Illustrazione:** Ciro rovescia tasche vuote e porge una carta al posto delle monete.

#### PI03 — Bonifico in lavorazione · TRAPPOLA

**In breve:** Un ladro prende subito la carta, ma poi ti deve pagare prima di poter vincere.

**Effetto:** Scatta dopo che un rivale ti ha rubato almeno una carta con un effetto. Quel rivale riceve un debito: all'inizio del suo prossimo turno effettivo, prima della verifica vittoria, consegna una carta scelta della propria mano al proprietario della trappola. Se non ha carte, pesca una carta dal mazzo e consegna quella; se non esistono carte disponibili, il debito si estingue senza consegna. Il furto iniziale non viene annullato. Un solo debito per attivazione.

**Quando:** Dopo il furto; debito risolto prima del controllo vittoria nel prossimo turno effettivo.

**Battuta:** «È PARTITO. TE GIURO CHE È PARTITO.»

**Illustrazione:** Ciro mostra un telefono con bonifico IN LAVORAZIONE e una freccia che gira.

#### PI04 — Te ne do meno · RISPOSTA

**In breve:** Riduci di una carta una perdita forzata di almeno due carte.

**Effetto:** Quando un singolo effetto di un rivale sta per obbligarti a scartare o consegnare almeno due carte della mano, consuma questa RISPOSTA e riduci quel numero di uno. Il resto dell'obbligo si risolve normalmente e scegli le carte solo se l'effetto originale lo permette. Non modifica furti casuali, scambi di mani, depositi, costi volontari o il limite della mano.

**Quando:** Prima di una perdita multipla forzata; conta separatamente il consumo della RISPOSTA.

**Battuta:** «DUE? FACCIAMO UNA E STAMO A POSTO.»

**Illustrazione:** Ciro cancella il 2 da una ricevuta e scrive 1, con una moneta stretta nel pugno.

#### PI05 — Il conto lo dividiamo · CATASTROFE

**In breve:** Tutti scelgono PAGO o SCAPPO; chi scappa rischia un debito.

**Effetto:** Ogni giocatore sceglie in segreto PAGO oppure SCAPPO. Chi sceglie PAGO scarta una carta scelta se ne ha. Se almeno un giocatore ha scelto PAGO, ogni SCAPPO pesca una carta. Se tutti scelgono SCAPPO, nessuno pesca e ciascuno riceve un debito di uno scarto scelto da pagare all'inizio del proprio prossimo turno effettivo, prima della verifica vittoria. Con mano vuota il debito si estingue senza perdita. Le scelte si chiudono insieme; risolvi in ordine di turno.

**Quando:** Azione principale; decisioni segrete e debiti obbligatori prima della vittoria.

**Battuta:** «IO HO PRESO SOLO L'ACQUA.»

**Illustrazione:** Ciro si nasconde dietro un menù mentre una ricevuta lunghissima attraversa il tavolo.

## Verifiche e limiti

Validati: 25 ID nuovi univoci e senza collisioni con i 100 originali; cinque carte per personaggio; distribuzione 10/5/5/5; tutti i campi richiesti compilati. La verifica del catalogo non prova il motore: interazioni e invarianti sono coperti dai test del gioco; durata con persone e bilanciamento richiedono partite reali.

Da verificare in particolare: PG03 con T02; PB02 con le trappole di PESCA; PC02 con T25; le offerte di PI01/PI02 con T10 e T14; debiti di PI03/PI05 prima della vittoria; consumo delle RISPOSTE e conteggio a cinque.
