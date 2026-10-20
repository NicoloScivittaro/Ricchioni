# Botte sul Cornicione · 2.0

- Tre arene: Tetto del Disagio rifinito, Darsena degli Schiaffi, Cantiere in Quota. Voto da telefono/pad tramite il sistema mappe esistente.
- Piattaforme: Tetto 3,6/3,6/7,2 m, Darsena 2,8/2,8/6 m, Cantiere 4,4/4,4/8 m. Stessa definizione per simulazione, grafica, spawn, bot e debug. Piano principale largo 26 m, tre vite e medesimi limiti di KO.
- Nessun limite in partita o nel watchdog server. La vittoria richiede eliminazione. Countdown di partenza, ricariche e respawn conservati. Il simulatore conserva l’opzione di un limite esplicito per vecchi strumenti e test, mai impostata dal gioco reale.
- Migliorati bordi e materiali, ridotto il rumore dello sfondo, aggiunti feedback a terra e HUD sui colpi; camera più stabile e consapevole del palco. Effetti riusano il pool, geometria statica raggruppata e congelata, nessuna nuova dipendenza.
- Bot: percorso attraverso piattaforme intermedie; corretto lo stallo a dislivelli di 2,8 m. Nessun vantaggio di movimento rispetto ai giocatori.

## Verifiche eseguite

- fighter-selftest: 165/165; fighter-abilities-selftest: 82/82; fighter-strategy-selftest: PASS.
- fighter-projectile-selftest: PASS dopo aggiornamento dell’asserzione del vecchio termine a 160 s: la partita ora finisce naturalmente, nel caso provato a 237 s. L’output iniziale conserva il fallimento dell’aspettativa precedente; non è un fallimento dell’esecuzione finale.
- cornicione-2-selftest: spawn 2–5 sulle tre mappe, atterraggio su ogni piattaforma, 601 s simulati senza scadenza, KO conclusivo e ranking completi; nessun watchdog anche riarmandolo.
- Tre partite simulate con cinque bot terminate per eliminazione: Tetto 221 s, Darsena 222 s, Cantiere 182 s (campioni deterministici, non garanzia di durata).
- Browser sul renderer reale: tutte le arene con cinque combattenti, avanzamento e danno reali, HUD senza limite, nessun errore JavaScript. Voto di due telefoni seleziona Darsena e avvia il layout corretto. Rientro alla lobby elimina il canvas aggiuntivo.
- Verifica visiva finale ripetuta solo dopo rifinitura dei materiali. Tre screenshot.
- Build finale con typecheck integrato: build.log.

Nessun benchmark FPS prima/dopo: non si dichiara un aumento misurato. Nessun commit, push o deploy. Gli altri minigiochi e il lavoro preesistente sono preservati.
