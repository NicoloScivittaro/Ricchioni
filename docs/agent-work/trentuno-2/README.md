# Pulizia minigiochi + 31 2.0

Casa Carbo rimossa dal catalogo condiviso, menu/rullo/selezione, autodiscovery della scena, precaricamento, catalogo abilità, controlli, sottofondo/stinger/narratore, feedback telefono e codice esclusivo. Eliminati anche test esclusivi e voci audio obsolete; aggiornati gli harness condivisi. 15 minigiochi selezionabili, 16 definizioni totali: Goblin Time resta disattivato come prima. I GLB dei personaggi con nomi storici “casacarbo” sono condivisi e conservati.

## 31 senza scadenze

Rimosse le azioni automatiche alla scadenza di pesca, scarto e scelta privata, i limiti di 100 s per mano e 330 s per partita, e il safety cap esterno di 600 s. Le attese non cambiano mano, turno, carte o punteggio. Gli indicatori restano sul nome reale del giocatore.

La finestra del Judoka dopo bussata termina con la prima pesca successiva, anziché dopo 3 s. Sono conservati giro aggiuntivo, ultimo giro e abilità degli altri giocatori. Il Goblin mantiene la sua sostituzione della pescata: nella versione esistente non c’era una scelta tra quattro carte. Conservati scoring, valori, tre carte, tre mani, distribuzione, classifica e privacy.

Restano il polling/reconnect e l’attesa tecnica delle risposte di rete, il ritmo dei bot e la breve presentazione di una mano già conclusa. Nessuno di questi impone una decisione al giocatore.

## Carte e animazioni

40 SVG locali, proporzioni 240×336, carta avorio, dettagli oro, semi ♥ ♦ ♣ ♠ e figure stilizzate speculari J/Q/K. Le identità logiche DENARI/COPPE/SPADE/BASTONI e F/C/R restano le stesse, con valori invariati; cambia soltanto la presentazione. Dorso navy con motivo geometrico e simbolo Party Game, comune a tutte le carte e privo di dati privati.

Distribuzione progressiva coperta sulla TV, pesca/scarto dal mazzo/pila, entrata delle carte private, selezione sollevata ed evidenziata, scarto confermato e flip della rivelazione. Le animazioni non bloccano i comandi. Su telefono piccolo la quarta carta usa due righe per conservare leggibilità e touch target; azione SCARTA sticky.

## Verifiche essenziali

- Motore: attese di 10.000 s in pesca, scarto e peek senza azioni automatiche; pesca/scarto/31; abilità Goblin, Buttafuori, Dottore, Judoka, Ciro; ultimo giro esteso; nessun safety timer di sessione.
- Catalogo/rullo: giro completo, inclusa storia contenente il gioco rimosso; nessuna selezione di Casa Carbo.
- Trasporto: 21 controlli di autorità, privacy, riconnessione e versione round.
- Browser reale: TV + due telefoni, attesa di 13,5 s oltre il vecchio limite, stesso turno/carte/versione, reconnect, pesca/scarto sincronizzati, mani private, layout 320/390 px. Tre screenshot; ricatturata soltanto la mano a tre carte per mostrarla interamente.
- Tutti i 40 SVG e il dorso validati, nessuna dipendenza grafica aggiunta. Typecheck e build finale superati (4m 8s; avviso sulle dimensioni dei chunk). Server locale riavviato su 3012: selezione esplicita del gioco rimosso rifiutata, chunk Casa Carbo assenti e hash delle 40 carte + dorso coincidenti nella build.

Nessun commit, push o deploy. Nessun errore emerso nelle verifiche mirate; nessuna suite degli altri minigiochi eseguita.
