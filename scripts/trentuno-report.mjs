import { readFileSync,writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const home='docs/agent-work/trentuno',read=name=>JSON.parse(readFileSync(`${home}/${name}`,'utf8'));
const core=read('core-tests.json'),network=read('network-tests.json'),assets=read('assets-tests.json'),art=read('art-browser-tests.json'),dev=read('browser/results.json'),prod=read('production/results.json');
if(dev.reports.length!==5||prod.reports.length!==2||dev.errors.length||prod.errors.length)throw Error('Verifiche browser incomplete');
if(!readFileSync(`${home}/build.log`,'utf8').includes('built in'))throw Error('Build non confermata');
const files=[...new Set([`${home}/REPORT.md`,`${home}/VERIFICATION.json`,...execFileSync('git',['diff','--name-only','faa2ae6'],{encoding:'utf8'}).trim().split(/\r?\n/),...execFileSync('git',['ls-files','--others','--exclude-standard'],{encoding:'utf8'}).trim().split(/\r?\n/)])].filter(Boolean).sort();
const abs='C:/Users/niluf.PC-NIKO/Desktop/Ricchioni/';
const frameRows=[...dev.reports.map(r=>({...r,kind:'dev'})),...prod.reports.map(r=>({...r,kind:'produzione'}))].map(r=>`| ${r.kind} | ${r.players} | ${r.humans} | ${r.bots} | ${r.performance.fps} | ${r.performance.p95FrameMs} | ${r.wallSeconds} |`).join('\n');
const ui=read('ui-tests.json'),productionUi=read('production-ui-tests.json');
if(ui.errors.length||productionUi.errors.length||!productionUi.compiled)throw Error('UI finale non verificata');
const buildDuration=/built in (.+)/.exec(readFileSync(`${home}/build.log`,'utf8'))[1];
const verification={date:new Date().toISOString(),baseline:'faa2ae69c1c32af85d00f339972be609a27c7d4a',root:'Sol diretto, autorizzazione utente',core,network,assets,art,dev,prod,ui,productionUi,build:true,regression:['catalogo1242','rounds60','pad','audio','Goblin Time241 +17 rete','Minigolf40 partite naturali'],sourceFiles:files};writeFileSync(`${home}/VERIFICATION.json`,JSON.stringify(verification,null,2));
writeFileSync(`${home}/REPORT.md`, `# 31 DEGLI INFAMI — consegna e verifiche

Il gioco è completo e integrato come **diciassettesimo minigioco**, ID stabile **trentuno**, CULTURA/uncommon/PHONE_TEXT, 2–5 giocatori, oppure un telefono e bot nella lobby esistente. Tre mani, mazzo napoletano originale da 40 carte, mani private, cinque abilità una volta per torneo, bot, pausa, riconnessione, punteggi globali e ritorno alla lobby. Nessun gioco precedente sostituito. Implementazione diretta con Sol secondo l'autorizzazione utente; nessuna richiesta Flash a pagamento, nessun push o deployment.

## Grafica consegnata

40 SVG originali autonomi (A,2–7,F,C,R per DENARI/COPPE/SPADE/BASTONI), avorio/smeraldo/oro/rosso, cornici decorate e texture vissuta. Semi vettoriali riconoscibili anche senza colore. Figure con pose da Fante, Cavallo a cavallo, Re sul trono. Denari Goblin, Coppe Ciro, Spade Boschi, Bastoni Carbo; Victor protagonista nel Fante di Coppe e Cavallo di Bastoni e nei medaglioni delle altre figure, sempre rilassato e senza elementi medici. Gli angoli riportano i ranghi reali, mai 11 o 31. Il retro è comune, con due composizioni identiche ruotate di 180°, goblin coronato con lingua fuori, quattro semi e titolo.

Il tavolo usa Phaser 2D, panno scuro, bordo di legno con dettagli dorati, ritratti fotografici esistenti e carte coperte per ogni posto. Animazioni di pesca/scarto di 350 ms, tre colpi della bussata e zoom/esultanza dorata del 31. Telefono: tre carte in fila, quattro carte grandi in due righe in verticale, scarto sempre raggiungibile con barra sticky, selezione esplicita, seme/valore/punteggio e abilità. Layout provato320×568,390×800 e740×360.

![Le 40 carte](${abs}${home}/browser/mazzo-40.png)

![Tavolo produzione cinque giocatori](${abs}${home}/production/solo-5p-tv.png)

![Mano privata telefono](${abs}${home}/production/2p-phone.png)

![Scelta dello scarto](${abs}${home}/production/2p-phone-discard.png)

## Regolamento definitivo

1. Ogni mano ridistribuisce 3 carte per persona, una scoperta negli scarti e il resto nel mazzo. Prima partenza casuale segreta, poi rotazione di un posto per mano (con2 giocatori uno parte due volte, scelto casualmente). Non ci sono jolly,8/9/10, carte31 o bonus tris.
2. Asso 11, figure 10, numeri 2–7 nominali. Si somma ogni seme separatamente e conta il totale maggiore: A+R+C dello stesso seme31; A+7 e Re diverso18.
3. Prima del proprio turno puoi bussare oppure pescare coperto/prendere la cima degli scarti. Dopo la pesca hai4 carte e devi scartarne una: **vietato scartare immediatamente quella presa dagli scarti**. È consentito scartare la pescata coperta.
4. Bussare sostituisce la pesca. Gli altri ricevono un ultimo turno (N−1 turni), il bussante nessuno. Carbo può aggiungere N turni dopo quelli standard, incluso un turno del bussante. Nessuna vittoria automatica di chi bussa.
5. Un31 si conferma soltanto con 3 carte dopo distribuzione/scarto/scambio risolto completamente. Con 4 carte non è confermato. Chiude subito la mano, rivela i punteggi reali e mostra “TRENTUNO! VE L'HO MESSA IN CULO A TUTTI!”. Due31 simultanei nello scambio condividono il primo posto. Nessuna abilità può annullarlo dopo la conferma.
6. Tre mani. In ogni mano posizione1 + numero di avversari con punteggio maggiore; punti interni N−posizione. Parità reali hanno stessa posizione e stessi punti. Totale delle tre mani, poi somma dei tre punteggi delle carte come spareggio. Pari residui condividono il piazzamento: GameSession attiva l'opzione ex aequo già presente nel ScoreManager, che rimane invariato. L'ordine del roster è solo presentazione dei pari.
7. Decisione 12 s, scarto 10 s, peek 8 s, finestra Carbo 3 s, limite mano 100 s e totale 330 s. AFK/disconnesso pesca coperto e scarta ottimizzando la propria mano; il timeout Victor mantiene l'ordine. La pausa congela tutti i tempi e i4s di reveal/finale. Il cap risolve lo scarto in corso e confronta mani di 3 carte reali, senza assegnare un falso31. Il cap totale può chiudere con meno di tre mani soltanto come conclusione tecnica. Scarti riciclati quando necessario preservando la cima e tutte le 40 carte.

## Cinque abilità — tutte implementate e verificate

| Personaggio | Abilità | Finestra / effetto | Stato |
|---|---|---|---|
| Goblin | N'CULO, CI RIPROVO! | Dopo pesca coperta, prima dello scarto: rifiuta la pescata, mette in fondo, accetta obbligatoriamente la successiva. Nessuna scelta tra le due pescate. | Test e uso naturale osservato |
| Boschi | TU QUA NON ENTRI! | Prima di pescare: prossimo giocatore non può prendere dagli scarti per un turno valido; può ancora bussare. Il blocco scade anche con bussata. | Test e uso naturale osservato |
| Victor | M'HO SVEJATO! | Prima della pesca guarda due carte coperte privatamente, mantiene/inverte soltanto queste e continua. | Test e uso naturale osservato |
| Carbo | NO, ASPETTA! | Solo entro 3 s da bussata avversaria: aggiunge un giro completo; non propria bussata o31 confermato. | Test e uso naturale osservato |
| Ciro | PAGO DOMANI! | Prima della pesca sceglie una propria carta e l'avversario; riceve una carta casuale server. Due mani restano3, eventuale31 di uno o entrambi chiude subito. | Test e uso naturale osservato |

Uso unico mantenuto in tutte le mani. Catalogo centralizzato80 abilità, testi e parametri condivisi. AbilityHub presenta lo stato, il server autorizza/consuma; bot inviano gli stessi comandi degli umani usando soltanto il proprio snapshot e il tavolo pubblico.

## Autorità, privacy e ciclo di vita

RoomManager associa il comando al socket corrente e al giocatore proprietario; nessun playerId client accettato come identità. roundId/matchId/version e deduplicazione limitata proteggono da messaggi vecchi/doppi. RNG crypto server in produzione, seed riproducibile solo per test; nessun seed o mazzo coperto nei pacchetti pubblici. Host riceve soltanto tavolo, conteggi e scarti; telefoni solo mano/peek propri. Le mani avversarie sono pubblicate nella history esclusivamente quando una mano finisce. Risultati e snapshot privati inventati dall'host rifiutati.

Reconnect ripristina mano/decisione senza nuova distribuzione, vecchio socket perde controllo. Restart crea matchId nuovo. Pausa e AFK sono server. Fine/skip/lobby/restart liberano servizio, timer, listener e41 texture del gioco; il canvas Phaser generale rimane. Nessuna seconda lobby o nuovo pairing.

## Verifiche eseguite

- Typecheck e **npm run build** completati, build in ${buildDuration}. Solo il warning preesistente sui chunk grandi Babylon. L'indice dist compilato è mantenuto coerente con i nuovi hash: ripristinare quello vecchio renderebbe incoerente l'app servita.
- **${core.checks} controlli core**, **${core.naturalGames} partite naturali simulate** con2–5 giocatori, umani automatici e bot, tre mani. Deck/scoring/pescata/scarto/bussata/31/parità/cap/AFK/pausa; tutte le abilità, doppio uso, peek privato, consumo persistente, riciclo, comandi vecchi/doppi, scambio con due31 simultanei.
- **${network.checks} controlli trasporto**, socket reale RoomManager su trasporto finto: outsider, impersonazione, carta estranea, host risultati/snapshot falsi, reconnect/vecchio socket, restart, pausa e punti globali ex aequo.
- **${assets.checks} controlli asset**,40 fronti diversi, rango stampato in entrambi gli angoli, nessun ritaglio/immagine incorporata/remota. SVG totali **${assets.totalSvgBytes} byte**. Browser40/40 immagini caricate; simmetria del retro: errore medio pixel **${art.backRotationMeanError.toFixed(3)}/255**, differenze da antialiasing **${(art.backRotationDifferentFraction*100).toFixed(2)}%**.
- Browser dev: cinque scenari2/3/4/5 telefoni e1telefono+4bot, tre mani ciascuno, nessun finale forzato, privacy/pausa/reconnect/layout piccoli, ScoreManager, lobby e rimozione texture. Tutte5 abilità osservate. **Zero pageerror**.
- UI mirata in dev e sul bundle produzione finale: scroll verticale320px, SCARTA sticky durante lo scorrimento, clic reale sulla quarta carta, scarto confermato, restart dal menu pausa con matchId nuovo e ritorno alla lobby dal menu; stile del telefono ripristinato. Le 41 texture sono verificate come eliminate nel test dev; il test compilato verifica menu, lobby e ripristino del telefono.
- Produzione compilata:2 telefoni e1telefono+4bot, altre6 mani complete con comandi DOM reali, incluso pause menu via Escape, reload telefono e crypto.randomUUID assente per simulare browser LAN HTTP. **Zero pageerror**. Le prove dev precedono gli ultimi ritocchi di presentazione; le partite produzione precedono la sola correzione finale dello scorrimento, verificata separatamente con clic reali sul bundle finale, restart e lobby. Tavolo/regole/server rimangono gli stessi delle partite misurate.
- Regressioni: catalogo1242/1242, rounds60, pad, audio, Goblin Time241+17 trasporto e Minigolf40 partite naturali (fisica/turni/abilità/ranking). Non è stata ripetuta l'intera matrice browser dei giochi3D: i loro renderer non sono modificati.

## Prestazioni realmente misurate

Chrome headless con accelerazione GPU, NVIDIA GeForce RTX3050/ANGLE Direct3D11, host1280×720, RAF2,5s durante il tavolo, un solo canvas. Nessuna riduzione di qualità/risoluzione dei giochi esistenti. I dati misurano questo hardware; non sono garanzia universale su ogni dispositivo.

| Versione | Giocatori | Telefoni | Bot | FPS | p95 frame ms | Durata automatizzata s |
|---|---:|---:|---:|---:|---:|---:|
${frameRows}

Durate automatizzate: le persone simulate rispondono rapidamente; non sono una misura della durata del playtest umano. Il limite del regolamento resta documentato sopra.

## File creati e modificati

- shared/trentuno/: deck, scoring, rules, types. server/trentuno/: core e servizio indipendenti dal rendering.
- src/minigames/trentuno/: scena Phaser e registrazione lazy. src/controller/trentunoController.ts: telefono privato.
- public/trentuno/:40 fronti, back.svg e atlas.html; generatore ripetibile e test asset.
- Integrazione minima: registry, protocollo, catalogo, RoomManager, GameSession(ex aequo), GameManager, controller/main/style, tema musicale, aspettative dei selftest esistenti.
- scripts/: selftest regole/rete/asset, browser e report; docs/agent-work/trentuno/: piano/checkpoint/report/JSON/log/screenshot; scheda progetto e indice dist aggiornati.

Elenco completo del delta rispetto alla baseline, incluse evidenze:

\
${files.map(f=>'- '+f).join('\n')}

## Commit locali per milestone

M1 **52e0c9c**, M2 **4a1bade**, M3 **72ffdbc**, M4 **94f20eb**; M5 è il commit finale contenente questo report, prove produzione e casi limite aggiuntivi. Nessun push/deployment, lavoro precedente preservato.

## Limiti e playtest umano

**Nell'allegato c'era soltanto il testo: nessuna immagine concept.** La direzione smeraldo/oro/avorio e le caricature sono realizzate e complete; non è possibile certificare somiglianza a un'immagine non fornita. Per una passata artistica successiva: confrontare tutti40 fronti, dorso e tavolo con il concept; rifinire la somiglianza dei volti vettoriali di Boschi, Ciro, Victor e Carbo, e l'espressione del Goblin, senza cambiare ranghi/semi o SVG funzionali. I ritratti TV sono gli asset reali già esistenti.

Restano da valutare con voi:12/10 s dei turni sui telefoni veri, soglia/bilanciamento della bussata, finestra 3 s di Carbo, impatto dello scambio casuale Ciro e valore del reroll Goblin in tre mani. Bot volutamente imperfetti (errori occasionali); nessun bilanciamento fine dedotto dalle sole simulazioni. Nessun problema funzionale aperto osservato nelle verifiche.
`);
console.log('Report italiano e VERIFICATION.json generati.');
