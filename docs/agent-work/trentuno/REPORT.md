# 31 DEGLI INFAMI — consegna e verifiche

Il gioco è completo e integrato come **diciassettesimo minigioco**, ID stabile **trentuno**, CULTURA/uncommon/PHONE_TEXT, 2–5 giocatori, oppure un telefono e bot nella lobby esistente. Tre mani, mazzo napoletano originale da 40 carte, mani private, cinque abilità una volta per torneo, bot, pausa, riconnessione, punteggi globali e ritorno alla lobby. Nessun gioco precedente sostituito. Implementazione diretta con Sol secondo l'autorizzazione utente; nessuna richiesta Flash a pagamento, nessun push o deployment.

## Grafica consegnata

40 SVG originali autonomi (A,2–7,F,C,R per DENARI/COPPE/SPADE/BASTONI), avorio/smeraldo/oro/rosso, cornici decorate e texture vissuta. Semi vettoriali riconoscibili anche senza colore. Figure con pose da Fante, Cavallo a cavallo, Re sul trono. Denari Goblin, Coppe Ciro, Spade Boschi, Bastoni Carbo; Victor protagonista nel Fante di Coppe e Cavallo di Bastoni e nei medaglioni delle altre figure, sempre rilassato e senza elementi medici. Gli angoli riportano i ranghi reali, mai 11 o 31. Il retro è comune, con due composizioni identiche ruotate di 180°, goblin coronato con lingua fuori, quattro semi e titolo.

Il tavolo usa Phaser 2D, panno scuro, bordo di legno con dettagli dorati, ritratti fotografici esistenti e carte coperte per ogni posto. Animazioni di pesca/scarto di 350 ms, tre colpi della bussata e zoom/esultanza dorata del 31. Telefono: tre carte in fila, quattro carte grandi in due righe in verticale, scarto sempre raggiungibile con barra sticky, selezione esplicita, seme/valore/punteggio e abilità. Layout provato320×568,390×800 e740×360.

![Le 40 carte](C:/Users/niluf.PC-NIKO/Desktop/Ricchioni/docs/agent-work/trentuno/browser/mazzo-40.png)

![Tavolo produzione cinque giocatori](C:/Users/niluf.PC-NIKO/Desktop/Ricchioni/docs/agent-work/trentuno/production/solo-5p-tv.png)

![Mano privata telefono](C:/Users/niluf.PC-NIKO/Desktop/Ricchioni/docs/agent-work/trentuno/production/2p-phone.png)

![Scelta dello scarto](C:/Users/niluf.PC-NIKO/Desktop/Ricchioni/docs/agent-work/trentuno/production/2p-phone-discard.png)

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

- Typecheck e **npm run build** completati, build in 3m 12s. Solo il warning preesistente sui chunk grandi Babylon. L'indice dist compilato è mantenuto coerente con i nuovi hash: ripristinare quello vecchio renderebbe incoerente l'app servita.
- **326 controlli core**, **160 partite naturali simulate** con2–5 giocatori, umani automatici e bot, tre mani. Deck/scoring/pescata/scarto/bussata/31/parità/cap/AFK/pausa; tutte le abilità, doppio uso, peek privato, consumo persistente, riciclo, comandi vecchi/doppi, scambio con due31 simultanei.
- **21 controlli trasporto**, socket reale RoomManager su trasporto finto: outsider, impersonazione, carta estranea, host risultati/snapshot falsi, reconnect/vecchio socket, restart, pausa e punti globali ex aequo.
- **203 controlli asset**,40 fronti diversi, rango stampato in entrambi gli angoli, nessun ritaglio/immagine incorporata/remota. SVG totali **287788 byte**. Browser40/40 immagini caricate; simmetria del retro: errore medio pixel **0.564/255**, differenze da antialiasing **0.49%**.
- Browser dev: cinque scenari2/3/4/5 telefoni e1telefono+4bot, tre mani ciascuno, nessun finale forzato, privacy/pausa/reconnect/layout piccoli, ScoreManager, lobby e rimozione texture. Tutte5 abilità osservate. **Zero pageerror**.
- UI mirata in dev e sul bundle produzione finale: scroll verticale320px, SCARTA sticky durante lo scorrimento, clic reale sulla quarta carta, scarto confermato, restart dal menu pausa con matchId nuovo e ritorno alla lobby dal menu; stile del telefono ripristinato. Le 41 texture sono verificate come eliminate nel test dev; il test compilato verifica menu, lobby e ripristino del telefono.
- Produzione compilata:2 telefoni e1telefono+4bot, altre6 mani complete con comandi DOM reali, incluso pause menu via Escape, reload telefono e crypto.randomUUID assente per simulare browser LAN HTTP. **Zero pageerror**. Le prove dev precedono gli ultimi ritocchi di presentazione; le partite produzione precedono la sola correzione finale dello scorrimento, verificata separatamente con clic reali sul bundle finale, restart e lobby. Tavolo/regole/server rimangono gli stessi delle partite misurate.
- Regressioni: catalogo1242/1242, rounds60, pad, audio, Goblin Time241+17 trasporto e Minigolf40 partite naturali (fisica/turni/abilità/ranking). Non è stata ripetuta l'intera matrice browser dei giochi3D: i loro renderer non sono modificati.

## Prestazioni realmente misurate

Chrome headless con accelerazione GPU, NVIDIA GeForce RTX3050/ANGLE Direct3D11, host1280×720, RAF2,5s durante il tavolo, un solo canvas. Nessuna riduzione di qualità/risoluzione dei giochi esistenti. I dati misurano questo hardware; non sono garanzia universale su ogni dispositivo.

| Versione | Giocatori | Telefoni | Bot | FPS | p95 frame ms | Durata automatizzata s |
|---|---:|---:|---:|---:|---:|---:|
| dev | 2 | 2 | 0 | 59.9 | 16.8 | 23.2 |
| dev | 3 | 3 | 0 | 59.9 | 16.8 | 43.8 |
| dev | 4 | 4 | 0 | 59.9 | 16.8 | 45.7 |
| dev | 5 | 5 | 0 | 59.9 | 16.8 | 44.1 |
| dev | 5 | 1 | 4 | 59.9 | 16.8 | 91.8 |
| produzione | 2 | 2 | 0 | 59.9 | 16.8 | 33.2 |
| produzione | 5 | 1 | 4 | 59.9 | 16.8 | 91.7 |

Durate automatizzate: le persone simulate rispondono rapidamente; non sono una misura della durata del playtest umano. Il limite del regolamento resta documentato sopra.

## File creati e modificati

- shared/trentuno/: deck, scoring, rules, types. server/trentuno/: core e servizio indipendenti dal rendering.
- src/minigames/trentuno/: scena Phaser e registrazione lazy. src/controller/trentunoController.ts: telefono privato.
- public/trentuno/:40 fronti, back.svg e atlas.html; generatore ripetibile e test asset.
- Integrazione minima: registry, protocollo, catalogo, RoomManager, GameSession(ex aequo), GameManager, controller/main/style, tema musicale, aspettative dei selftest esistenti.
- scripts/: selftest regole/rete/asset, browser e report; docs/agent-work/trentuno/: piano/checkpoint/report/JSON/log/screenshot; scheda progetto e indice dist aggiornati.

Elenco completo del delta rispetto alla baseline, incluse evidenze:

- dist/index.html
- docs/PARTY_GAME_PER_CHATGPT.md
- docs/agent-work/trentuno/CHECKPOINT.md
- docs/agent-work/trentuno/PLAN.md
- docs/agent-work/trentuno/REPORT.md
- docs/agent-work/trentuno/VERIFICATION.json
- docs/agent-work/trentuno/ability-tests.log
- docs/agent-work/trentuno/art-browser-tests.json
- docs/agent-work/trentuno/assets-tests.json
- docs/agent-work/trentuno/audio-tests.log
- docs/agent-work/trentuno/browser/2p-finish.png
- docs/agent-work/trentuno/browser/2p-phone-320.png
- docs/agent-work/trentuno/browser/2p-phone-740.png
- docs/agent-work/trentuno/browser/2p-phone-discard.png
- docs/agent-work/trentuno/browser/2p-phone.png
- docs/agent-work/trentuno/browser/2p-tv.png
- docs/agent-work/trentuno/browser/3p-finish.png
- docs/agent-work/trentuno/browser/3p-phone-320.png
- docs/agent-work/trentuno/browser/3p-phone-740.png
- docs/agent-work/trentuno/browser/3p-phone-discard.png
- docs/agent-work/trentuno/browser/3p-phone.png
- docs/agent-work/trentuno/browser/3p-tv.png
- docs/agent-work/trentuno/browser/4p-finish.png
- docs/agent-work/trentuno/browser/4p-phone-320.png
- docs/agent-work/trentuno/browser/4p-phone-740.png
- docs/agent-work/trentuno/browser/4p-phone-discard.png
- docs/agent-work/trentuno/browser/4p-phone.png
- docs/agent-work/trentuno/browser/4p-tv.png
- docs/agent-work/trentuno/browser/5p-finish.png
- docs/agent-work/trentuno/browser/5p-phone-320.png
- docs/agent-work/trentuno/browser/5p-phone-740.png
- docs/agent-work/trentuno/browser/5p-phone-discard.png
- docs/agent-work/trentuno/browser/5p-phone.png
- docs/agent-work/trentuno/browser/5p-tv.png
- docs/agent-work/trentuno/browser/mazzo-40.png
- docs/agent-work/trentuno/browser/phone-scroll-320.png
- docs/agent-work/trentuno/browser/results.json
- docs/agent-work/trentuno/browser/solo-5p-finish.png
- docs/agent-work/trentuno/browser/solo-5p-phone-320.png
- docs/agent-work/trentuno/browser/solo-5p-phone-740.png
- docs/agent-work/trentuno/browser/solo-5p-phone-discard.png
- docs/agent-work/trentuno/browser/solo-5p-phone.png
- docs/agent-work/trentuno/browser/solo-5p-tv.png
- docs/agent-work/trentuno/build.log
- docs/agent-work/trentuno/core-tests.json
- docs/agent-work/trentuno/goblin-network-regression.log
- docs/agent-work/trentuno/goblin-regression.log
- docs/agent-work/trentuno/minigolf-regression.log
- docs/agent-work/trentuno/network-tests.json
- docs/agent-work/trentuno/pad-tests.log
- docs/agent-work/trentuno/production-ui-tests.json
- docs/agent-work/trentuno/production/2p-finish.png
- docs/agent-work/trentuno/production/2p-phone-320.png
- docs/agent-work/trentuno/production/2p-phone-740.png
- docs/agent-work/trentuno/production/2p-phone-discard.png
- docs/agent-work/trentuno/production/2p-phone.png
- docs/agent-work/trentuno/production/2p-tv.png
- docs/agent-work/trentuno/production/mazzo-40.png
- docs/agent-work/trentuno/production/results.json
- docs/agent-work/trentuno/production/solo-5p-finish.png
- docs/agent-work/trentuno/production/solo-5p-phone-320.png
- docs/agent-work/trentuno/production/solo-5p-phone-740.png
- docs/agent-work/trentuno/production/solo-5p-phone-discard.png
- docs/agent-work/trentuno/production/solo-5p-phone.png
- docs/agent-work/trentuno/production/solo-5p-tv.png
- docs/agent-work/trentuno/rounds-tests.log
- docs/agent-work/trentuno/ui-tests.json
- public/trentuno/BASTONI-2.svg
- public/trentuno/BASTONI-3.svg
- public/trentuno/BASTONI-4.svg
- public/trentuno/BASTONI-5.svg
- public/trentuno/BASTONI-6.svg
- public/trentuno/BASTONI-7.svg
- public/trentuno/BASTONI-A.svg
- public/trentuno/BASTONI-C.svg
- public/trentuno/BASTONI-F.svg
- public/trentuno/BASTONI-R.svg
- public/trentuno/COPPE-2.svg
- public/trentuno/COPPE-3.svg
- public/trentuno/COPPE-4.svg
- public/trentuno/COPPE-5.svg
- public/trentuno/COPPE-6.svg
- public/trentuno/COPPE-7.svg
- public/trentuno/COPPE-A.svg
- public/trentuno/COPPE-C.svg
- public/trentuno/COPPE-F.svg
- public/trentuno/COPPE-R.svg
- public/trentuno/DENARI-2.svg
- public/trentuno/DENARI-3.svg
- public/trentuno/DENARI-4.svg
- public/trentuno/DENARI-5.svg
- public/trentuno/DENARI-6.svg
- public/trentuno/DENARI-7.svg
- public/trentuno/DENARI-A.svg
- public/trentuno/DENARI-C.svg
- public/trentuno/DENARI-F.svg
- public/trentuno/DENARI-R.svg
- public/trentuno/SPADE-2.svg
- public/trentuno/SPADE-3.svg
- public/trentuno/SPADE-4.svg
- public/trentuno/SPADE-5.svg
- public/trentuno/SPADE-6.svg
- public/trentuno/SPADE-7.svg
- public/trentuno/SPADE-A.svg
- public/trentuno/SPADE-C.svg
- public/trentuno/SPADE-F.svg
- public/trentuno/SPADE-R.svg
- public/trentuno/atlas.html
- public/trentuno/back.svg
- scripts/ability-selftest.ts
- scripts/e2e/trentuno-assets.mjs
- scripts/e2e/trentuno-ui.mjs
- scripts/e2e/trentuno.mjs
- scripts/generate-trentuno-assets.ts
- scripts/rounds-selftest.ts
- scripts/trentuno-assets-selftest.ts
- scripts/trentuno-network-selftest.ts
- scripts/trentuno-report.mjs
- scripts/trentuno-selftest.ts
- server/GameSession.ts
- server/RoomManager.ts
- server/trentuno/core.ts
- server/trentuno/service.ts
- shared/abilityCatalog.ts
- shared/minigames.ts
- shared/protocol.ts
- shared/trentuno/deck.ts
- shared/trentuno/rules.ts
- shared/trentuno/scoring.ts
- shared/trentuno/types.ts
- src/controller/main.ts
- src/controller/style.css
- src/controller/trentunoController.ts
- src/core/GameManager.ts
- src/core/musicThemes.ts
- src/minigames/trentuno/TrentunoScene.ts
- src/minigames/trentuno/index.ts

## Commit locali per milestone

M1 **52e0c9c**, M2 **4a1bade**, M3 **72ffdbc**, M4 **94f20eb**; M5 è il commit finale contenente questo report, prove produzione e casi limite aggiuntivi. Nessun push/deployment, lavoro precedente preservato.

## Limiti e playtest umano

**Nell'allegato c'era soltanto il testo: nessuna immagine concept.** La direzione smeraldo/oro/avorio e le caricature sono realizzate e complete; non è possibile certificare somiglianza a un'immagine non fornita. Per una passata artistica successiva: confrontare tutti40 fronti, dorso e tavolo con il concept; rifinire la somiglianza dei volti vettoriali di Boschi, Ciro, Victor e Carbo, e l'espressione del Goblin, senza cambiare ranghi/semi o SVG funzionali. I ritratti TV sono gli asset reali già esistenti.

Restano da valutare con voi:12/10 s dei turni sui telefoni veri, soglia/bilanciamento della bussata, finestra 3 s di Carbo, impatto dello scambio casuale Ciro e valore del reroll Goblin in tre mani. Bot volutamente imperfetti (errori occasionali); nessun bilanciamento fine dedotto dalle sole simulazioni. Nessun problema funzionale aperto osservato nelle verifiche.
