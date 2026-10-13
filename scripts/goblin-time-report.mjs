import { readFileSync,writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const dir='docs/agent-work/goblin-time';
const read=path=>JSON.parse(readFileSync(path,'utf8'));
const core=read(`${dir}/core-tests.json`),network=read(`${dir}/network-tests.json`),browser=read(`${dir}/browser/results.json`),production=read(`${dir}/production/results.json`);
const base=read('shared/goblinTime/baseCards.json'),personal=read('shared/goblinTime/personalCards.json');
if(JSON.stringify(base)!==JSON.stringify(read('docs/goblin_time_100_carte.json'))||JSON.stringify(personal)!==JSON.stringify(read('docs/goblin_time_25_carte_personaggi.json')))throw Error('Cataloghi non sincronizzati');
if(core.cards!==125||core.tests.some(t=>!t.passed)||browser.errors.length||production.errors.length)throw Error('Verifica non accettabile');
if(!readFileSync(`${dir}/build.log`,'utf8').includes('built in'))throw Error('Build non confermata');
for(const card of [...base,...personal])if(!core.tests.some(t=>t.name.startsWith(card.id+' ')&&t.passed))throw Error(`Test assente ${card.id}`);
const hash=createHash('sha256').update(readFileSync('docs/goblin_time_100_carte.json')).digest('hex');
let md=`# GOBLIN TIME — implementazione e verifiche

Verificato il 13 ottobre 2026. ID \`goblinTime\`, CULTURA, rare, PHONE_TEXT, 2–5 giocatori. Aggiunto come sedicesimo gioco: il numero #14 dell'allegato è storico e non sostituisce Geofall né gli altri 15 giochi.

## Giocare

Apri http://localhost:3002/, crea la stanza, collega i telefoni dal QR e scegli GOBLIN TIME nella selezione manuale, oppure attendi l'estrazione nel rullo. Il tavolo propone **MAZZO ORIGINALE** (100) e **NOI CINQUE** (125). Il server serve la build compilata dalla stessa origine, anche ai telefoni sulla LAN. I comandi funzionano su HTTP senza dipendere da crypto.randomUUID disponibile solo in contesti sicuri.

## Realizzato

- 100 effetti originali e 25 personalizzati: handler espliciti, nessuna interpretazione del testo naturale delle carte.
- Base: 40 AZIONI, 25 TRAPPOLE, 20 RISPOSTE, 15 CATASTROFI. Variante: 50/30/25/20. Una copia per ID.
- Due carte iniziali; PESCA conserva una fra due, GIOCA e ARMA; due slot ordinari, carte RISPOSTA contestuali; limite mano9.
- Dichiarazione fuori turno nei momenti stabili della risoluzione. Vittoria solo al successivo turno effettivo, dopo debiti, depositi, trappole e reazioni. Ogni passaggio diverso da cinque annulla immediatamente l'annuncio.
- Cinque abilità una volta per partita, numeri e descrizioni nel catalogo comune; stato server pubblicato sull'AbilityHub. Goblin ha una decisione dedicata di 3s dopo PESCA, sospesa in pausa.
- Tavolo Phaser, modelli procedurali e animazioni già presenti, spostamenti di carte coperte, trappole, catastrofi e grande annuncio GOBLIN TIME. Nessuna modifica ai modelli degli altri giochi.
- Mano privata scorrevole con SVG originali, dettagli completi, scelta di bersagli, voti simultanei, ordine del mazzo, reazioni, deposito e trappole proprie. Scorrimento e pannelli aperti conservati durante gli aggiornamenti.
- Bot che usano i medesimi comandi validati degli umani, guardano solo le proprie opzioni e informazioni autorizzate, dichiarano, sabotano e usano abilità.
- Conclusione per tempo con classifica tecnica; nessuna falsa vittoria GOBLIN TIME. ScoreManager esistente assegna i punti e l'eventuale modificatore PUNTI DOPPI.

## Architettura e privacy

Il motore vive solo in \`server/goblinTime/\`. Le coroutine sospendono le transazioni su decisioni o reazioni; il clock è server e non dipende dagli FPS della TV. Catalogo, contratti e illustrazioni stanno in \`shared/goblinTime/\`. La TV usa \`src/minigames/goblinTime/\`; il telefono \`src/controller/goblinTimeController.ts\`.

Il socket stabilisce il giocatore: playerId inviati nel payload non possono impersonare altri. Comandi con round, partita, versione, richiesta e decisione obsoleti vengono rifiutati. Le richieste ripetute accettate restituiscono l'ack precedente senza eseguire di nuovo l'effetto. Il vecchio socket non può più pilotare dopo la riconnessione. Un riavvio cambia matchId.

La proiezione pubblica contiene esclusivamente conteggi, slot, turno, timer, annunci, abilità usate, scarti e carte effettivamente pubbliche. Le mani, i nomi delle trappole coperte, le offerte, le scelte e le informazioni osservate vanno al rispettivo socket. L'host non riceve queste proiezioni private e non può inviare snapshot o risultati arbitrari per GOBLIN TIME. Una rivelazione negata da R14 non viene recuperata tramite la successiva scelta di A12/A40.

Il generatore deterministico server deriva i sorteggi con SHA-256 da una chiave UUID segreta per partita; i seed numerici sono solo per le simulazioni riproducibili. La chiave non entra nei payload. Ogni movimento verifica che tutte le carte rimangano in una sola zona; la zona temporanea deve essere vuota al termine della transazione.

## Decisioni di risoluzione

- Scelta principale12s, decisioni12s, reazioni5s, cap360s. Pausa sospende tutti i timer, inclusi i4s di conclusione prima dei risultati. Il limite chiude una transazione già iniziata prima di assegnare la classifica tecnica.
- Le scelte simultanee vengono raccolte senza pubblicarle e risolte in ordine di turno. Le trappole si ordinano per armamento e si consumano prima della risposta R06; il trigger si ricontrolla quando necessario.
- Una RISPOSTA per giocatore/evento e massimo quattro nella catena. R11 copia una risposta risolta nello stesso contesto di evento; le sue eventuali scelte native vengono mostrate al copiante. Nessuna copia di copia. T09 intercetta anche l'annullamento di una trappola.
- Dopo la risoluzione di una perdita o un guadagno, eventi HandChanged fanno funzionare T04/T15/T20 anche su recuperi, scambi, deposito, trappole e abilità. Scambi simultanei conservano il conteggio netto; C09/C13 annullano comunque gli annunci come richiesto.
- I debiti si pagano prima della vittoria, con le carte effettivamente disponibili. Un bersaglio impossibile viene saltato o usa il ripiego PESCA previsto dal catalogo; i requisiti espliciti della carta prevalgono. Nessuna carta viene inventata.
- A35 aggiunge al massimo uno slot ausiliario oltre ai due ordinari. La sospensione di A36 termina al prossimo turno dell'autore anche quando cambiano ordine o turni extra.
- C15 impedisce di dichiarare finché non avviene un'altra variazione reale della mano. Arrivare nuovamente a cinque non ripristina un annuncio annullato.
- Timeout: prima scelta legale nell'ordine mostrato; nelle reazioni PASSA, negli scarti facoltativi zero carte. Gli obblighi impossibili non bloccano il tavolo.
- A39 blocca gioco e scarto volontario della carta; doni, scambi, depositi e perdite forzate restano operazioni distinte. Bloccare le RISPOSTE non disattiva le abilità, che non sono carte.

## Verifiche

| Verifica | Risultato |
|---|---|
| Catalogo, singole carte, interazioni, invarianti e bot | ${core.passed} controlli passati, inclusi125 casi nominati per carta |
| Simulazioni naturali | ${core.simulations.length} partite seedate, 2–5 bot, entrambi i mazzi, tutte concluse |
| Autorizzazione, privacy, duplicati, riconnessione e riavvio | ${network.checks} controlli passati |
| Browser dev | ${browser.reports.length} partite: 2/3/4/5 telefoni e 1 telefono+4 bot; pausa, ricarica telefono, risultati, nessun overflow mobile o errore JS |
| Bundle compilato | 2 telefoni e 1 telefono+4 bot; vittoria, punti, assenza di mani private sulla TV, distruzione del canvas3D; crypto.randomUUID disattivata sui telefoni |
| Regressioni | abilità1186/1186, round58 controlli, controller e audio passati |
| Build | TypeScript e Vite passati; resta l'avviso preesistente sui chunk grandi |

Comandi riproducibili:

\`\`\`powershell
npx tsx scripts/goblin-time-selftest.ts
npx tsx scripts/goblin-time-network-selftest.ts
npx tsx scripts/ability-selftest.ts
npx tsx scripts/pad-selftest.ts
npx tsx scripts/rounds-selftest.ts
npx tsx scripts/audio-selftest.ts
npm run build
# Server aggiornato3002 e Vite5175 con VITE_SERVER_URL=http://localhost:3002
$env:HOST_URL='http://127.0.0.1:5175/'
$env:CTRL_URL='http://127.0.0.1:5175/controller.html'
$env:GOBLIN_GPU='1'
node scripts/e2e/goblin-time.mjs
# Bundle compilato sulla porta3002, senza Vite
$env:PROD_HOST='http://localhost:3002/'
$env:CTRL_URL='http://localhost:3002/controller.html'
node scripts/e2e/goblin-time-prod.mjs
\`\`\`

## Prestazioni misurate

Chrome con GPU reale NVIDIA RTX3050, Direct3D11, canvas1280×720, misure di3s sul tavolo dopo il caricamento iniziale. Le miniature usano i rig procedurali esistenti e non caricano i GLB dettagliati.

| Giocatori | Mazzo | FPS | Frame p95 |
|---|---|---:|---:|
${production.reports.map(r=>`| ${r.players} | ${r.mode==='base'?'100':'125'} | ${r.performance.fps} | ${r.performance.p95FrameMs}ms |`).join('\n')}

Queste misure riguardano il tavolo su questo PC; non costituiscono una prova per tutti i dispositivi o per ogni concatenazione di effetti. I telefoni sono emulati a390px e usano DOM/SVG, senza rendering3D.

## Immagini verificate

![Tavolo compilato con cinque personaggi](production/5p-tv.png)

![Telefono compilato, mano privata](production/5p-phone.png)

![Vittoria e conclusione compilata](production/5p-finish.png)

Ulteriori immagini e risultati: cartelle \`browser/\` e \`production/\`; file \`core-tests.json\` e \`network-tests.json\`.

## Stato delle125 carte

Ogni riga ha un handler effettivo e un test dedicato passato. Le100 originali non sono state rinominate o sostituite. SHA-256 del catalogo originale copiato: \`${hash}\`.

| ID | Tipo | Carta | Stato |
|---|---|---|---|
${[...base,...personal].map(c=>`| ${c.id} | ${c.type} | ${c.name.replaceAll('|','/')} | Implementata · test passato |`).join('\n')}

## Limiti e lavoro umano

L'obiettivo3–6min è da misurare con persone: gli script scelgono immediatamente e le partite automatiche risultano molto più rapide. Il limite360s e la classifica tecnica sono verificati. Il bilanciamento delle carte e delle abilità richiede playtest reali; nessun fine tuning è stato spacciato per convalidato.

Riconnessione conserva lo stato sullo stesso server; un riavvio del processo server perde le stanze in memoria, come nell'architettura esistente. Non sono stati introdotti salvataggi permanenti. La vibrazione sui telefoni fisici dipende dal browser e dal gesto dell'utente.

Nessuna nuova libreria, nessun servizio remoto, nessun nuovo personaggio e nessuna modifica al ScoreManager. I due log preesistenti graphics-performance rimangono modificati dal loro server. La build mantiene dist/index.html coerente con i nuovi chunk. Nessun commit, push o pubblicazione eseguiti.
`;
writeFileSync(`${dir}/REPORT.md`,md,'utf8');
writeFileSync(`${dir}/VERIFICATION.json`,JSON.stringify({status:'accepted',date:'2026-10-13',cards:125,base:100,personal:25,coreChecks:core.passed,networkChecks:network.checks,simulations:core.simulations.length,browserGames:browser.reports.length,compiledGames:production.reports.length,performance:production.reports.map(r=>({players:r.players,...r.performance})),originalCatalogSha256:hash,remaining:['Playtest umano: durata e bilanciamento','Prova su telefoni fisici'],commitsCreated:[]},null,2));
console.log('Report e verifica finale generati:125 carte con test dedicato, build e bundle confermati.');
