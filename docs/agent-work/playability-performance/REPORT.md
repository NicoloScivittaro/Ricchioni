# Backrooms, Minigolf e Goblin Time — correzioni

Goblin Time ora offre **60 secondi per turno ordinario, scelta e risposta**, inclusa la scelta dopo la pesca del Goblin. Confermare subito fa proseguire senza aspettare il minuto. Il timer viene gestito dal server e si ferma in pausa; sul telefono appare come `1:00`.

La TV presenta in ordine: istruzione attuale, giocatore di turno/chi deve scegliere, conteggi delle carte, carta pubblica ed effetto completo, ultima mossa. I cinque giocatori sono allineati. Il telefono indica l'obiettivo “5 carte → dichiara → mantienile”, mostra solo le azioni pertinenti, distingue scelta/risposta/attesa, spiega i quattro tipi di carte e presenta l'effetto completo di ogni opzione. Selezione e conferma sono distinte, con contatore; la cronologia e le regole si aprono quando servono. La schermata scorre anche su telefoni piccoli e torna all'istruzione quando cambia la scelta o tocca a te.

Durante la verifica a 320 px è stata corretta anche la barra di conferma: non copre più le opzioni. La mano resta privata e le opzioni private non vengono inviate alla TV; il dato pubblico aggiunto indica soltanto chi deve scegliere. Gli eventi delle risposte sono ora scritti in italiano (“Furto”, “Carta giocata”, “Passaggio di carte”…).

Gli effetti specifici delle carte che impongono un turno più corto restano validi e sono segnalati esplicitamente. Il limite complessivo della partita resta quello esistente di 6 minuti, con risoluzione delle scelte in corso e classifica tecnica alla scadenza. Nessuna modifica agli effetti delle 125 carte, alla vittoria con cinque carte o al punteggio globale; è stata estesa a 60 s anche la finestra dell'abilità post-pesca del Goblin.

## Rallentamenti

Minigolf aggiornava i cinque rig e la posizione delle mazze anche durante il gioco, quando i personaggi erano completamente nascosti. Ora i timer visivi dei personaggi nascosti avanzano in blocchi, mentre le animazioni visibili mantengono la frequenza del rendering. La classifica completa si costruisce solo quando viene mostrata e quando i dati cambiano; il resto dell'HUD si aggiorna al massimo 20 volte al secondo, con cambio fase immediato. Gli oggetti immobili non ricalcolano ogni fotogramma le stesse trasformazioni: piattaforme mobili, bracci rotanti, bandiera e palline restano animati.

Backrooms ora conserva i riferimenti ai nodi HUD, scrive il testo soltanto se cambia e limita gli aggiornamenti dell'interfaccia. Le maschere dei modelli si aggiornano quando arrivano nuove mesh, anziché attraversare tutti i personaggi a ogni passo. Non anima corpi completamente nascosti/eliminati. Le strutture immobili hanno matrici congelate; porte, chiave e personaggi restano mobili. Le interazioni riusano posizioni e viste del labirinto, evitano array/ordinamenti ripetuti e mantengono occlusioni, priorità e stato delle porte. Il picking al movimento del mouse, non usato dai comandi dei due giochi, è disabilitato.

Queste ottimizzazioni seguono le possibilità di [Babylon.js per matrici statiche e picking](https://doc.babylonjs.com/features/featuresDeepDive/scene/optimize_your_scene). Non sono stati ridotti modelli, texture, ombre o risoluzione del prodotto; `quality.ts` non è stato modificato.

## Misure sul PC

Chrome GPU, cinque giocatori (un telefono e quattro bot), stesso seed, stessi modelli e ombre. Il confronto mantiene il buffer iniziale: Backrooms 1024×576 (scala 1,25 già raggiunta dall'auto-quality nel profilo iniziale), Minigolf 1280×720 (scala 1). Otto secondi per campione dopo avvio.

| Misura | Prima | Dopo |
| --- | ---: | ---: |
| Backrooms: costo medio aggiornamento | 2,407 ms | 1,906 ms (−20,8%) |
| Backrooms: FPS | 58,57 | 58,94 |
| Backrooms: chiamate HUD nel campione | 2360 | 720 |
| Minigolf: costo medio aggiornamento | 1,869 ms | 0,784 ms (−58,1%) |
| Minigolf: costo medio animazioni personaggi | 1,185 ms | 0,112 ms (−90,5%) |
| Minigolf: aggiornamenti dei rig | 2390 | 160 |
| Minigolf: FPS | 59,44 | 59,44 |

Il monitor è limitato a circa 60 FPS. Questi dati dimostrano una riduzione del lavoro, non un aumento garantito degli FPS su qualsiasi macchina. Restano singoli fotogrammi lunghi (fino a circa 50–67 ms nel campione): il costo delle cinque viste di Backrooms rimane significativo. Non viene dichiarata l'eliminazione di ogni possibile scatto su ogni hardware. Evidenze: `before-performance.json` e `after-performance.json`.

## Verifiche

- Goblin: 241 verifiche del motore e 96 partite simulate con 2–5 giocatori; test di protocollo/privacy passati; 23 verifiche dei nuovi tempi, pausa, conferma e istruzioni.
- Goblin nel browser: partite naturali con **2 e 5 client smartphone emulati**, scelta ancora attiva dopo 13 secondi, pausa/reload, opzioni complete, risposta leggibile, viewport 320/390/740, nessun overflow, vittoria normale e cleanup. Le schermate di risposta sono alimentate anche da uno stato prodotto dal motore puro, separatamente dalla partita naturale.
- Goblin compilato: menu reale, mazzo Noi Cinque, due telefoni, minuto verificato oltre il vecchio timeout, pausa/ripresa da tastiera, riconnessione, vittoria naturale e zero errori.
- Backrooms: 38 gruppi di test e 22 gruppi di regressione; 18.036 confronti delle interazioni con il comportamento precedente, comprese porte aperte/chiuse, occlusioni, chiave spostata, generatori e nascondigli. Quattro cicli browser di avvio/pausa/lobby senza audio, loop, canvas o HUD residui.
- Minigolf: 24 tornei completi, 9 gruppi di test e 286 verifiche della camera. Browser con cinque client smartphone e tre controller simulati: tiri tramite i comandi, cancellazione della carica, pausa, riconnessione, tre buche, spareggio AFK, ex aequo e punti globali corretti, HUD a 1280×720 e 800×600, cleanup.
- Backrooms e Minigolf compilati: entrambi avviati dal menu reale con cinque giocatori (un client smartphone e quattro bot), quattro modelli originali caricati/riusati dalla cache, input touch, pausa e ritorno alla lobby senza canvas/HUD residui; zero errori di pagina. Il controllo delle risorse accetta correttamente anche HTTP 304 dopo il primo caricamento. Evidenza: `3d-production.json`.
- `npm run build`: typecheck e compilazione di produzione superati (3m26s). Resta il precedente avviso sui bundle Babylon grandi.

I test dei cambi di buca usano una scadenza breve dichiarata per coprire rapidamente tutte le transizioni; i comandi, la rete e la fisica sono quelli effettivi del gioco. Non vengono presentati come un torneo a durata normale. Log, JSON e screenshot sono nella cartella di questo report.

## Stato del lavoro

Baseline iniziale `9b8425e`. Durante il lavoro HEAD è avanzato al checkpoint `009f2e0` (“52”), preservato senza reset o amend. Le correzioni finali e le nuove verifiche sono nel worktree; nessun commit automatico, push o deploy eseguito da questo intervento. Build e backend locale aggiornati su **http://localhost:3004/**; il server è stato ricaricato dopo aver verificato zero connessioni attive.
