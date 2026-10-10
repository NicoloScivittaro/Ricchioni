# Sparatoria dei Disagiati — ADS

Mira integrata nella simulazione autorevole e nei due renderer: telefono e TV con fino a cinque finestre. Le modifiche già realizzate al Cornicione restano disponibili: calci con maggiore portata/spinta e oggetti al posto della presa comune.

| Comando | Xbox | PlayStation | Telefono |
| --- | --- | --- | --- |
| Movimento | Stick sinistro | Stick sinistro | Joystick |
| Visuale | Stick destro | Stick destro | Trascinamento |
| ADS | LT tenuto | L2 tenuto | MIRA tenuto |
| Sparo | RT | R2 | SPARA tenuto |
| Scatto | A | ✕ | DASH |
| Ricarica | X | □ | RICARICA |
| Abilità | RB | R1 | ABILITÀ |

L’arma si sposta davanti alla camera con un mirino aperto su tutte e sei le armi. Transizione 0,18 s, zoom ottico 1,3×, movimento 75%, sensibilità 65%, rinculo 65% rispetto al tiro senza mira. La dispersione di base viene divisa per 1,35; questo definisce il +35% di precisione proposto, non una percentuale garantita di colpi a segno. La corsa e il fuoco ripetuto aumentano la dispersione, soprattutto senza ADS. Il laser resta perfettamente preciso da fermo in ADS, con un piccolo cono di 0,006 rad senza mira.

La mobilità e la velocità di rotazione superiori mantengono utile il tiro senza mira nel corpo a corpo. Si può sparare durante l’ingresso in ADS; non è stato aggiunto un ritardo obbligatorio al grilletto. Danno, cadenza, munizioni, hitbox, sistema armi e abilità dei personaggi non cambiano. Non è stato aggiunto un aggancio automatico o un’assistenza alla mira: da valutare solo dopo una prova con controller fisici.

Il rinculo adesso sposta realmente la direzione dei colpi; visuale e raggi dell’host usano lo stesso offset, che il giocatore può compensare. L’arma mantiene anche il rinculo meccanico. Il mirino HUD si allarga con il cono di tiro e si riduce a un punto durante ADS. Le finestre TV hanno HUD, FOV e stato ADS separati. Hitmarker X e feedback della kill si attivano solo sul danno confermato. Le frecce del danno ora ricevono dall’host la direzione del colpo: per la Bombarda indicano l’esplosione, anche quando il tiratore si è spostato.

MIRA e SPARA hanno pointer capture e ownership indipendenti; il trascinamento della visuale continua con un altro dito. Rilascio, annullamento, perdita di focus/input, pausa, eliminazione, rinascita e fine round non lasciano ADS o raffiche fantasma. Un asse di visuale assoluta cancellato conserva l’orientamento dell’host, evitando un giro improvviso a zero radianti. I bot mirano sugli avversari visibili oltre 10 metri e usano hipfire da vicino.

## Verifica

- Test puri di transizione a 30/60/120 FPS, zoom, sensibilità/movimento, dispersione e rinculo delle sei armi, bindings e cancellazione.
- Browser con cinque controller simulati (Xbox, DualSense e generici), isolamento della mira fra finestre e controllo della schermata CONTROLLI, ora completa di ricarica.
- Simulazione reale dell’host: movimento ADS/hipfire 1,35/1,80 m nello stesso intervallo; rotazione 0,169/0,260 rad. Campione di 300 colpi isolati con Mitraglia: a 3 m 300/300 per entrambe le modalità; a 28 m 184/300 ADS e 127/300 senza mira. È una verifica del cono base con bersaglio fermo e rinculo azzerato fra le prove, non una previsione di vittoria in un duello.
- Touch reale emulato tramite Chrome: mira, sparo, visuale e movimento contemporanei con quattro dita; zoom del telefono misurato 1,3×, cattura fuori dal pulsante, annullamento e nuova pressione dopo blur. Sei mirini verificati con screenshot.
- Regressione di sacchetto armi, fucile a pallini, raffiche, proiettile/splash, ricariche e protezione dello spawn. Il vecchio campionamento del fucile ora azzera il rinculo fra i colpi indipendenti: sparava 40 colpi nello stesso istante senza tempo di recupero.
- Abilità: 999 controlli; animazioni personaggi: 431; suite strategia/proiettili del Cornicione e profili pad superate.

Campione finale di rendering (cinque camere TV più il telefono FPS emulato): media 59.56 FPS, minimo 58.11; 379 mesh costanti nei cinque campioni. Misura breve su GPU locale, non benchmark di telefoni. Fine round tramite il timer della scena (tempo accelerato per questa verifica), classifica di cinque partecipanti, ritorno alla lobby con un canvas e zero istanze Tripo residue.

I dettagli dell’ultima esecuzione browser sono in `browser.json`; i campioni prestazionali sono misure headless sulla macchina locale, non misure su smartphone reali. Le tabelle `balance-hip.txt` e `balance-ads.txt` stimano il cono base da fermo con rinculo compensato: la tabella ADS include l’attesa volontaria di acquisizione del mirino, non un blocco effettivo dello sparo.

## Limiti da verificare in partita

Il feeling della sensibilità, la leggibilità nel proprio televisore e il bilanciamento fra giocatori reali richiedono il playtest con Carbo e Christian. Sul telefono il rendering segue gli snapshot dell’host a 20 Hz, con interpolazione dell’ADS: latenza e fluidità dipendono anche dalla rete e dal dispositivo. I test automatici non sostituiscono una partita su controller fisici e telefoni reali.

Smoke produzione superato: bundle finale servito da 3001, un telefono con MIRA/SPARA reali più quattro bot, round completo di 100 secondi a tempo reale, cinque risultati e nessun errore di pagina. Nessun debug, accelerazione o risultato artificiale. Evidenza in `production.json`; checksum dei bundle in `ACCEPTANCE.json`.

Build finale (`tsc --noEmit && vite build`) superata. Resta il warning già presente sulle dimensioni dei chunk Babylon/Phaser.

Implementazione locale: nessun push o deployment eseguito da questa fase.
