# Cornicione — lanci e calci strategici

La presa comune è rimossa. LB/L1 ora lancia gli oggetti, anche in aria. Le 14 mosse originali, la parata, le schivate, la recovery e le cinque abilità restano disponibili; Carbo conserva la proiezione speciale RB/R1 nel corpo a corpo.

## Oggetti

| Personaggio | Oggetto | Impatto cosmetico |
|---|---|---|
| Ciro | Manciata di monete | Le monete viaggiano insieme e si sparpagliano; tintinnio |
| Carbo | Granita | Bicchiere con cannuccia, schizzo rosa, suono liquido |
| BOSCHI | Lattina di birra | Rotazione in volo, schiuma chiara e sfiato |
| Goblin | Bottiglietta Jägermeister | Bottiglia verde, etichetta, frammenti e suono di rottura |
| Victor | Shaker proteico | Shaker con tappo, spruzzo proteico e impatto liquido grave |

Mesh Babylon leggere, create una volta; nessun asset remoto, libreria aggiunta o modifica ai GLB dei personaggi. I quattro personaggi Tripo restano tali durante carica, lancio, salto e colpi. Victor usa il personaggio procedurale già presente.

Il tap rilascia il tiro veloce; tenere carica fino a 1 s, poi il rilascio impegna .10 s di anticipo e .28 s di recupero. Stick/croce mira in due dimensioni, neutro lancia avanti. Il tiro non segue il bersaglio. Tutti hanno **4 danni, raggio .26 m, spinta base 5 + percentuale × .045 e cooldown 6 s**. La carica modifica soltanto velocità (18–30 m/s) e durata (.55–.85 s), cioè percorso 9.9–25.5 m dal punto di partenza del proiettile. Le abilità restano l'unica differenza di gameplay fra personaggi.

Collisione continua, primo bersaglio valido, invulnerabilità/DI/anti-mash/combo/credito KO conservati. Schivata evita il proiettile; parata frontale temporizzata lo distrugge. Il tiratore distante non viene stordito da una parata né afferrato dal counter di Carbo. Il tetto blocca i tiri sotto il piano; le piattaforme one-way conservano la loro funzione.

Impatto/scadenza eliminano il proiettile; i frammenti cosmetici spariscono in .45 s senza collider. KO rimuove gli oggetti del giocatore; fine round/spareggio azzerano quelli rimasti. Carica annullata da colpi, mosse alternative, pausa, perdita pad, blur/disconnessione del telefono o pointercancel. Nessun lancio automatico a carica massima o a fine cooldown. Ricarica continua anche durante respawn, si ferma soltanto con la pausa del gioco.

## Calci

| Mossa | Portata geometrica davanti, inclusa hurtbox | Danno | Anticipo | Recupero / extra a vuoto |
|---|---:|---:|---:|---:|
| Pugno laterale originale | 3.17 m | 4.5 | .07 s | .17 s |
| Calcio laterale | 4.28 m (+35%) | 4.5 | .18 s | .30 / +.18 s |
| Laterale aereo originale | 3.32 m | 4.5 | .06 s | .14 s |
| Calcio aereo | 4.48 m (+35%) | 4.5 | .14 s | .28 / +.15 s |

La misura confronta hitbox e stessa hurtbox; il piccolo avanzamento del pugno originale resta disponibile. Un test di collisione reale a 3.7 m dimostra che il calcio colpisce e il pugno laterale manca, anche con quell'avanzamento. La spinta laterale/aerea passa a base 8 e crescita .075 (pugno: 5.5/.05). Angolo laterale 26° per una spinta più orizzontale. Il calcio ↓ in aria mantiene 4 danni, acquista spinta 8/.07 a -55° per intercettare la risalita. Recuperi e penalità di atterraggio impediscono di usarlo gratuitamente; nessun salto o recovery supplementare.

## Interfaccia e bot

CONTROLLI e Companion Card usano gli stessi binding del gioco: RT/R2 calcio, LB/L1 lancio caricato, LT/L2 parata. Telefono: LANCIO tenuto, carica percentuale e ricarica live. La cattura del dito consente di uscire dal pulsante mantenendo la carica mentre il secondo dito mira. TV mostra il timer del lancio per ciascun giocatore.

Bot: tirano da lontano, scelgono la carica, mirano, reagiscono agli oggetti con difesa, usano calci per lo spazio e al bordo; mantengono salti, abilità e recovery. Animazioni native dei quattro rig: ballThrow, frontKick, roundhouse, block. La carica riusa la posa di lancio; un futuro affinamento può aggiungere clip dedicate e un aggancio alla mano più preciso, senza cambiare collider o statistiche.

## Verifica

- `fighter-projectile-selftest.ts`: cinque cosmetiche equivalenti; tap/charge/aim/aria/30–180 FPS/cooldown; annullamenti anche nell'anticipo; cooldown attraverso respawn; primo impatto, parata frontale/errore/retro, schivata, invulnerabilità, parete, scadenza, KO e fine; bot e partita finita.
- `fighter-strategy-selftest.ts`: +35%, pugno fuori portata/calcio utile, spinta, whiff, calcio aereo/atterraggio, parata e counter Carbo, sei pose su ciascuno dei quattro rig.
- Suite preesistenti: core **165/165**, abilità Cornicione **82/82**, animazioni **431**, catalogo/abilità **999/999**; pad-selftest e gamepad-fighter passati. Simulazione 320 partite con 2–5 bot e abilità ON/OFF: termina senza problemi evidenti.
- Browser DEV, cinque partecipanti: Xbox/DualSense/generico + telefoni; CONTROLLI/Companion; calcio/lancio; tutti gli oggetti; parata; pausa/reload; blur/rejoin; pad perso; touch reale emulato a due dita e cattura fuori pulsante. Round completo con tempo accelerato, cinque risultati, ritorno lobby, zero istanze Tripo residue e un solo canvas. Nessun pageerror. Evidenza: `fighter-browser.json`.
- Produzione: un telefono + quattro bot, input autentici e feedback della carica/ricarica; battaglia e cinque risultati a tempo reale, senza debug, accelerazione o finish forzato. Evidenza: `fighter-production.json`, inclusi asset caricati.
- Typecheck/build superati. Rimane l'avviso preesistente sui chunk Babylon grandi; nessuna nuova dipendenza.

## Prestazioni e limiti

Campione browser headless di 12 s su ANGLE/D3D11, RTX 3050: **87 mesh degli oggetti stabili**, cinque props, 60 frammenti in pool e tre template nascosti, nove materiali e quattro piccole texture di etichette. Nessuna crescita del pool o errore di pagina. FPS medi 54.55 includendo il primo campione a 6.22; successivi medi 58.94 (minimo 54.16). Draw call totali osservate al massimo 93. Il primo campione mostra un rallentamento di avvio/caricamento: non è una prova comparativa del costo degli oggetti. Dati in `performance.json`; la fluidità sui dispositivi degli amici resta da provare.

Valori iniziali da playtest umano: cooldown 6 s, carica 1 s, spinta dei calci e rischio del tiro. I test dimostrano funzionamento e conservazione delle regole, non che una strategia domini o che il bilanciamento sia definitivo. Oggetti e suoni sono stilizzati; non sono nuovi asset fotorealistici.

Modifiche locali nel workspace e build aggiornata. Nessun push o deploy.
