# GOBLIN TIME — implementazione

Baseline: 8dc5d1850b0b1a03ce0b392a477f2c59047c1373. Preservare i due log modificati e i quattro file delle carte personalizzate già presenti. Esecuzione diretta Sol autorizzata nella chat; il precedente worker Flash non aveva credito (HTTP 402). Nessun push o pubblicazione.

Specifica: allegato 8c64465c-b67d-46f8-b9b6-b910e2a179c0, catalogo originale 100 carte e supplemento personalizzato 25. Il numero #14 è storico: esistono già 15 giochi, aggiungere un ID senza sostituirne uno.

1. Catalogo tipizzato e motore server: zone esclusive, coroutine di decisione, eventi, trappole, reazioni, vittoria, abilità e bot. Base100 e variante125 selezionabile dall'host prima dell'avvio.
2. Trasporto autorizzato per socket del giocatore, round/version/request ID, riconnessione; ciclo di vita integrato nella stanza. L'host riceve solo proiezioni pubbliche e non può inviare risultati arbitrari per questo gioco.
3. Tavolo TV Phaser con personaggi/ritratti e animazioni; controller DOM con mano privata, bersagli, voti, reazioni, abilità. Grafica SVG locale distinta per carta, nessun asset remoto o libreria aggiuntiva.
4. Test per effetti e invarianti, privacy e accesso, partite bot seedate 2–5, browser host/telefoni, pausa, riconnessione e risultati. Build e regressioni mirate; report con risultati veri e limiti.

Contratti: server unico proprietario del mazzo e dei timer; i client inviano comandi e non uno stato. Scelte simultanee tenute private fino alla chiusura. Una carta in una sola zona. Debiti/restituzioni/trappole prima del controllo vittoria. Annullamento immediato della dichiarazione per ogni conteggio diverso da cinque. Reazioni max4, una per giocatore/evento; trappole consume-once; nessuna copia di copia.

Semantica: main12s, decisioni12s, risposte5s; clock logico sospeso in pausa; timeout deterministici. Limite6min concluso solo dopo la transazione corrente. Riavvio dal menu richiede un nuovo motore server dello stesso round con ID di partita diverso; comandi precedenti rifiutati. Ripiego PESCA se l'effetto non trova bersagli, come catalogo base; requisiti espliciti prevalgono. Nessuna modifica al ScoreManager.
