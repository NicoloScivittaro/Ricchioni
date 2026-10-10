# Calcio dei Disagiati — indicatori compatti

Modifica limitata alla presentazione del calcio. Il codice della simulazione, i comandi, le abilità, le squadre, la camera e le interfacce degli altri minigiochi non cambiano. In `BabylonSoccerGame` l'unica modifica passa i nickname al componente grafico esistente.

## Risultato

- Nomi dei giocatori su una sola riga: Arial 14 px di progetto, contorno scuro sottile, colore ROSSI/BLU, senza riquadro nero, bordo o seconda riga squadra. Altezza 22 px invece di 52; larghezza misurata 44–106 px invece di 118. I nickname lunghi vengono abbreviati con ellissi in base alla larghezza effettiva.
- Anello personale da 2,1 a 1,25 unità, anello squadra da 2,65 a 1,55; spessore 0,045. Colori personali e squadre esistenti conservati, materiali Tripo intatti.
- Etichetta flottante `PALLA` eliminata. Riutilizzato l'anello giallo, ridotto a 1,3 unità con spessore 0,045. Il riepilogo del possesso nella parte superiore resta disponibile.
- Carica del tiro conservata come barra di 3 px, visibile solo durante la carica, senza percentuale o testo aggiuntivo sopra il personaggio. Freccia e comandi restano quelli esistenti.
- Disposizione in coordinate schermo: piccoli passi di 40 px, spostamento laterale massimo 160 px, fino a quattro righe aggiuntive di 26 px. Una linea sottile collega un nome spostato al suo personaggio. Protezione di pallone, corpi, porte e fasce HUD; nessuna sovrapposizione tra etichette. Se non esiste una posizione sicura, l'etichetta si nasconde temporaneamente invece di coprire l'azione.
- Dimensioni proporzionate alla risoluzione con `idealHeight=720`, indipendenti dalla distanza della camera. Ordinamento stabile per giocatore e preferenza per gli spostamenti precedenti.

## Verifiche effettuate

- `npm run typecheck`: PASS.
- `npm run build`: PASS, 3736 moduli, Vite completato in 4m 8s. Resta l'avviso preesistente sui chunk Babylon di grandi dimensioni.
- `npx tsx scripts/pad-selftest.ts`: PASS.
- `npx tsx scripts/soccer-label-layout-selftest.ts`: PASS; cinque etichette coincidenti, diversi schermi, zone protette, ordine stabile, fallback e assenza di modifiche agli input del layout.
- `scripts/e2e/gamepad-soccer.mjs`: PASS, casi 2 e 3 giocatori; Xbox/DualSense emulati via Gamepad API e telefono. Movimento, tiro debole/caricato, passaggio singolo, contrasto, abilità, rumble, gol/reset, pausa, disconnessione/fallback, pairing e transizioni senza tiro fantasma. Nessun errore JavaScript.
- `scripts/e2e/post-playtest-soccer.mjs`: PASS sulla versione finale; cinque telefoni, colori personali/squadra, carica/rilascio, passaggio, contrasto, mira dell'abilità Victor, indicatori palla, inquadrature delle porte, pausa/rejoin e pulizia risorse. Partita AI completata attraverso la simulazione, con tempo accelerato e cinque risultati; nessun errore JavaScript.
- `scripts/e2e/soccer-labels.mjs`: PASS, 16 scenari: centro, zoom più ampio (raggio ×1,4), gruppi presso ciascuna porta, a 1280×720, 1366×768, 1920×1080 e 800×600. Cinque telefoni, nickname lunghi e quattro skin native caricate. Tutti e cinque i nomi visibili, nessuna sovrapposizione tra nomi o con rettangoli proiettati di pallone, porte e corpi; misure compatte anche dopo lo zoom. Controllo di stabilità su 20 render e conteggi costanti di mesh/controlli GUI; presentazione senza scritture su giocatori/pallone.
- Screenshot realmente aperti e controllati: centro 1280×720, entrambe le porte, zoom 1920×1080, centro 800×600 e carica del tiro. Il campo e il pallone rimangono visibili. A 800×600 la barra inferiore preesistente taglia le schede esterne; le nuove etichette nel campo rimangono interamente visibili. Questa barra non è stata modificata.

Le verifiche browser usano Chrome headless con rendering GPU; i gruppi e lo zoom del test visivo sono fixture, senza modifiche alla fisica di produzione. I controller sono emulati; non è stata eseguita una nuova prova con gamepad fisici.

## Artefatti

- `visual-browser.json`: misure, visibilità, zone protette e verifiche dei 16 scenari.
- `centre-1280x720.png`: cinque giocatori vicini al pallone.
- `left-goal-1280x720.png`, `right-goal-1280x720.png`: gruppo vicino alle porte.
- `zoom-1920x1080.png`, `centre-800x600.png`: zoom e schermo più piccolo.
- `regression/soccer-browser.json` e screenshot associati: regressione del calcio.

Nessun commit, push o deploy. Le modifiche precedenti ad Arena e Sparatoria sono conservate.
