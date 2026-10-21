# Orda — distributori, perk, Pack-a-Punch e Wunderwaffe

Implementazione diretta nel seguito del lavoro Sol, preservando tutte le modifiche non committate. Nessun commit/push/deploy, nessuna modifica alle regole di Sparatoria o altri giochi.

Riferimento classico BO2 per Double Tap 2.0; asset WaW/BO2/Minecraft misti, senza ricostruire l’arena. Distributori già alimentati: nessuna nuova missione elettrica.

- Jugger-Nog 2500: resistenza da tre a cinque impatti validi. Danni già subiti conservati; pronto soccorso recupera sempre un colpo.
- Speed Cola 3000: tempi e inserimenti ricarica dimezzati, animazioni originali riprodotte a velocità doppia.
- Double Tap 2.0 2000: cadenza ×4/3 e due proiettili balistici per una munizione, anche pellet; nessun raddoppio di raggi/scariche.
- Bottiglie: tre gusti coerenti coi distributori, animazione bevuta 2s, perk applicato al termine. Altre due bottiglie originali conservate nell’asset; nessun perk Quick Revive/PHD attivato senza un sistema di atterramento/esplosioni autoinflitte.
- Pack-a-Punch 5000: deposito esclusivo dell’arma corrente, lavorazione 5s, ritiro proprietario entro10s. Non si spara con l’arma depositata, nessun altro scambio durante la lavorazione; potenziamento singolo danno×2/caricatore×2 e munizioni rifornite. L’arma migliorata si perde cambiandola. Mancato ritiro: persa, resta la pistola iniziale dato l’inventario singolo.
- Wunderwaffe DG-2 solo Orda e solo cassa: 3/15, scarica concatenata fino10 nemici visibili entro5m fra vicini, elimina i comuni; danno600 ai boss Warrok/Macellaio/Pumpkinhulk. Pack: DG-3 JZ,6/30, ricarica4.7s e danno boss1200. Nessun fuoco amico, nessun attraversamento coperture, nessun raddoppio catena Double Tap. Modello originale calibrato come arma FPS.
- Interazione Quadrato/X contestuale sceglie la stazione raggiungibile più vicina; telefono CASSA rinominato USA per tutte le stazioni. Prezzi/saldo/perk/arma potenziata mostrati su TV e telefono. Bot soggetti a stessi prezzi e distanze.

Contratti: stato e addebiti host, contatori di pressione, nessun acquisto su collisione; niente doppio addebito, duplicazione perk o furto premio. Stati nuovi clonati nei pacchetti. Statistiche esclusive Orda in una lookup separata dalla rotazione Sparatoria. Nuovi asset condivisi fra visuali, batch statici per materiale, texture limitate, nessuna luce dinamica aggiunta.

Verifiche mirate: prezzi, ripetizione/concorrenza/morte, tre/cinque impatti/cure, ricariche normali/shell e clip, Double Tap munizioni/danno, Pap deposito/ritiro/scadenza, Wunder catena/LOS/limite/boss; renderer reale, input pad/telefono, cinque visuali; typecheck e build finale. Massimo tre immagini di sintesi. Fonti e limiti nel report locale.
