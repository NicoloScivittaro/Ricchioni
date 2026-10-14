# Rullo — tutti gli altri prima di ripetere

Il rullo automatico non ripete un gioco finché non sono usciti tutti gli altri abilitati e compatibili con il numero di giocatori. Primo giro casuale, poi stessa sequenza: rimescolare fra giri permetterebbe ripetizioni premature fra fondo e inizio di due giri. Con il pool attuale2–5 giocatori, ogni gioco ritorna dopo17 estrazioni. Nuova partita riparte da un ordine casuale.

`shared/roulette.ts`: candidati dalla storia della stanza, prima i mai usciti, poi l'ultima uscita più lontana dopo il passaggio di tutti gli altri. Rarità/categoria/pity pesano soltanto fra candidati ammessi; fallback non può aggirare il vincolo. Modificatori compatibili conservati. Nessuno stato aggiuntivo o migrazione: la storia esistente conta completamenti, skip e selezioni manuali e si azzera al restart. La scelta esplicita dell'host resta un override manuale, come prima; il vincolo richiesto si applica al rullo automatico.

Verifiche:

- `npx tsx scripts/roulette-cycle-selftest.ts`:45.313 controlli,2–5 giocatori,30 seed e opzione pity sì/no, quattro giri, intervallo con tutti gli altri fra OGNI ripetizione. Confini dei giri, storia precedente con duplicati, disattivati, unico disponibile, cambio pool, FSM GameSession reale con risultato/skip/reset e indipendenza fra stanze.
- `npx tsx scripts/roulette-network-selftest.ts`:51 estrazioni attraverso Socket.IO reale, tre giri completi da17, nessuna ripetizione anticipata.
- `DRAWS=10000 npx tsx scripts/roulette-sim.ts`: confronto pity sì/no per2–5 giocatori,80.000 estrazioni totali; tutti i controlli originali passati, gap massimo17, nessuna incompatibilità e modificatori circa25%.
- `npm run typecheck` e `git diff --check` passati.

Solo algoritmo server: nessuna modifica a rendering/assets/ScoreManager, nessuna nuova build frontend necessaria (RouletteEngine non è importato dal client). Versione aggiornata servita in locale su http://localhost:3003/; server3002 già presente lasciato attivo. Nessun commit automatico, push o deployment per questa richiesta.
