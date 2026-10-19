# Correzione Primo Karting e Sydney Sprint

## Primo Karting

Il blocco invisibile proveniva dal limite laterale simmetrico della spline, non dai collider del GLB. Individuati **5 tratti candidati**, su entrambi i lati: sinistra s=0–46, 56–968, 976–1186; destra s=0–102, 108–1186. Sono intervalli del limite artificiale, non cinque muri distinti. Il caso fotografato è s=758, lato destro, circa (-95, 34): oltre 17 m dal più vicino ostacolo del modello.

Sostituito quel limite con 6.915 bordi ricavati da pneumatici, barriere, coni e pareti visibili. Il passaggio fotografato ora rimane aperto anche oltre il vecchio limite; una prova di attraversamento conferma che le barriere reali continuano a fermare il kart. Chiusi i box non di gara a ovest con una barriera gialla e nera dalla stessa impronta fisica. Aggiunte frecce dipinte alle curve e dopo i checkpoint.

Percorso e 12 checkpoint invariati. Una gara con input ordinari e collisioni reali: **3 giri in 115,68 s**, nessuna penetrazione o contatto sulle traiettorie provate.

## Sydney Sprint

Individuati **4 punti critici**: accesso diagonale attraverso la facciata vetrata dell’Opera House; gradini prima del piazzale superiore; bordo rialzato della rampa di lancio; discesa attraverso la banchina e i cartelloni prima del vecchio atterraggio. I due gradini sono emersi verificando l’intero corpo del kart, oltre ai raggi lungo la spline.

- Accesso esterno che aggira l’angolo chiuso, con raccordo visibile, bordi e frecce scure. Raccordi visibili anche sui due dislivelli dell’Opera. Conservati gli edifici e le loro pareti.
- Planata alzata da 11 a 18 m, discesa ritardata e atterraggio spostato oltre la banchina, sulla strada verso il ponte. Sterzo e fisica di base della planata restano quelli condivisi.
- I checkpoint seguono il nuovo percorso: **12 anziché 13**, eliminando la sovrapposizione del vecchio checkpoint con la nuova zona di volo. Ripartenze prima del decollo e dopo l’atterraggio; minimappa e direzioni usano la stessa spline. Conservati **10 Lucky Block**, spostando quello del vecchio atterraggio sulla strada dopo il nuovo.
- Bot: anticipazione delle curve e frenata nei passaggi stretti tramite input ordinari. Nessuna posizione forzata o esenzione dalle collisioni. Aggiunte 28.708 facce fisiche locali delle pareti visibili, con indice spaziale e controllo dell’altezza anche in volo.
- Grafica: rimosse **192 facce duplicate con stessi attributi**; illuminazione corretta sulle facce a doppio lato; tone mapping per evitare superfici bianche bruciate; panorama del cielo mantenuto entro il far plane delle sole camere Sydney. Nessun quartiere o monumento nascosto. Il GLB contiene **zero immagini**: sono preservati materiali e colori dei vertici, senza dichiarare ripristinate texture assenti dal file.

Gara con navigazione bot di produzione, fisica e collisioni attive: **3 giri in 142,94 s**, 3 decolli e 3 atterraggi, nessuna caduta, contatto o penetrazione. Verificati anche 1.912 posizioni dell’intero corpo lungo il percorso, tutti i checkpoint, un urto volontario contro una parete e il riposizionamento dei Lucky Block. La scansione della geometria visibile non trova altri attraversamenti sulla traiettoria centrale campionata.

## Verifiche e limiti

Catalogo e selezione delle quattro piste verificati; hash invariati per fisica comune, gara, Litorale, planata Arcobaleno, oggetti e abilità. Smoke test del renderer a **5 visuali**, senza errori JavaScript; nessun benchmark lungo. Debug solo DEV con `?trackDebug=1`: collisioni, corridoio, spline, checkpoint, direzioni di respawn e scie effettive dei bot.

Typecheck superato e build di produzione completata (**4 min 1 s**). Corretto un errore del colore DEV emerso nel primo typecheck; build precedente interrotta per includere il riposizionamento del Lucky Block. Resta l’avviso preesistente sulle dimensioni dei chunk.

Il punto esatto originariamente visto dall’utente non è noto: le immagini documentano i candidati effettivamente individuati. Non è stata effettuata una gara guidata personalmente da un essere umano: resta utile una prova con telefono/gamepad per giudicare comodità delle curve, urti tra avversari e leggibilità delle nuove rampe. Le verifiche non garantiscono ogni traiettoria laterale o combinazione di abilità.

Nessuna nuova dipendenza, commit, push o pubblicazione.
