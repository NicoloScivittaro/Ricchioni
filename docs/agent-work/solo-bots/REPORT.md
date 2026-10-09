# Bot in solitaria — integrazione completata

Scegli **2–5 posti in partita**, entra dal telefono (o usa il controller associato), scegli il personaggio e premi PRONTO. Se sei l’unico giocatore reale, INVIO avvia la partita con gli altri posti occupati da bot: 2 posti = 1 bot, 4 posti = 3 bot. I bot entrano al VIA, con nomi BOT e personaggi diversi dal tuo. Con due o più giocatori reali non vengono aggiunti automaticamente.

I bot partecipano ai dodici minigiochi. In Cornicione combattono e recuperano sul palco; in Casa Carbo raccolgono acqua, usano il tiracqua e contengono gli ingressi; in Arena cercano le spinte; in Dodgeball raccolgono e tirano; nel calcio inseguono la palla, fanno tackle e caricano i tiri; nella pallavolo servono e ricevono con errori; nel Kart guidano sulla pista e usano oggetti; nell’FPS aggirano gli ostacoli, mirano, sparano e ricaricano. Quiz, Cultura, memoria e riflessi hanno decisioni ritardate e fallibili.

Gli input usano le stesse regole di movimento, collisione, abilità, danno e punteggio dei giocatori reali. Nessun risultato assegnato artificialmente dall’IA. RNG dell’IA separato da quello della partita. L’IA avanza solo nei passi di simulazione attivi: pausa e schermata controlli la fermano. Sono gestiti anche i controlli invertiti nei giochi che applicano quel modificatore.

I bot conservano ID e punteggi fra i round e durante la riconnessione del telefono o dell’host. Non possiedono socket, token di riconnessione o slot gamepad; un telefono non può impersonarli. “Nuova partita” li rimuove e libera i personaggi, così un amico può entrare. Un amico disconnesso non viene sostituito automaticamente.

Il Kart mantiene una sola visuale in solitaria; gli altri kart sono avversari in pista. I quattro personaggi importati continuano a usare i modelli Tripo originali e il fallback esistente. Verificati i quattro rig in Arena, Cornicione, Dodgeball, calcio, pallavolo, Kart e Casa Carbo, e i tre avversari Tripo sul telefono nell’FPS.

## Verifiche

- `npm run build` e `npm run typecheck`: passati. Rimane l’avviso già noto sulle dimensioni dei bundle Phaser/Babylon.
- `npx tsx scripts/solo-bots-selftest.ts`: avvio solo 2–5 posti, prontezza/connessione, personaggi unici, risultati completi, doppio START, reset, multiplayer; quiz completo con 30 risposte bot e punteggi imperfetti; memoria, riflessi, bluff e voti; controlli invertiti; nessuno sparo attraverso il container; navigazione FPS e tre giri Kart con fisica reale (52,3 s simulati, 100% dei passi su strada nella prova senza avversari).
- `npx tsx scripts/solo-bots-network.ts`: rete Socket.IO reale; riconnessione telefono e host, nessuna impersonificazione di bot, stesso gruppo al round successivo, reset e ingresso dell’amico, multiplayer senza bot.
- Self-test esistenti: round 52 controlli, Cornicione 165/165, Casa Carbo 102/102.
- `scripts/e2e/solo-bots.mjs`: Chrome con GPU, un telefono e tre bot, tutti i dodici minigiochi conclusi dai normali simulatori, classifiche complete. Per coprire tutte le durate vengono accelerati i passi della simulazione, senza inviare risultati di prova. Provati pausa, caricamento Tripo, singola camera Kart, reset e ingresso di un secondo telefono reale. Evidenze accettate in `ACCEPTANCE.json`; i file delle esecuzioni intermedie restano per diagnosi.
- `scripts/e2e/solo-bots-production.mjs`: build servita da `http://localhost:3001`, UI normale, un telefono + un bot, download dei GLB originali e Arena completata in tempo reale con eliminazione e risultati normali, nessun errore pagina.

Nelle prove l’FPS ha registrato spari e kill effettivi dei bot, il calcio gol effettivi, Casa Carbo contributi positivi e acqua rimossa, il quiz risposte corrette e sbagliate. La pallavolo ha chiuso sul 3–5 dopo aver reso le ricezioni meno perfette, evitando scambi troppo lunghi.

È un’IA di difficoltà fissa, senza selettore di livello: quiz e Cultura usano probabilità di conoscenza, la memoria ricorda solo le tessere già mostrate. Per il test completo in solitaria crea una stanza nuova o ricomincia la partita. Build locale aggiornata; nessun commit, push o pubblicazione esterna.
