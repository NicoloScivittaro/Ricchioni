# Orda Finale

Implementazione diretta Sol: il documento esclude esplicitamente Flash. Nessun commit/push/deploy.

- Modalità isolata `orda`, simulazione autorevole sull'host, passo fisso 30 Hz; renderer Babylon condiviso fra TV e telefono, input FPS esistenti.
- Deposito industriale originale: collisioni, visibilità e navigazione derivate dallo stesso layout. Passerella raggiungibile da due rampe anche dai nemici.
- Cinque archetipi, Macellaio ogni cinque ondate, spawn graduale e massimo 22 nemici attivi. Nessun timer di partita.
- Sei armi del registro attuale con configurazione locale; munizioni finite e depositi rinnovabili, salute e cassa contese; niente fuoco amico.
- Danni risolti in un unico passo logico: tempo reale dell'impatto, poi uccisioni, danni e ordine stabile degli ID per morti simultanee. Nessuna vittoria casuale.
- Riutilizzo dei soli quattro contenitori di attori Backrooms, senza caricare ambienti/maze. Cambio al costruttore BackActor solo di tipo strutturale, nessuna variazione runtime per Backrooms.
- Controlli e ciclo di vita (pausa, riavvio, pulizia), bot con percezione e munizioni normali, catalogo/rullo/classifica/narratore.
- Verifiche mirate del motore e rete/browser, typecheck, una build finale, breve campione GPU cinque visuali; massimo quattro screenshot.

Limite intenzionale: un boss completo, niente secondo boss opzionale. Arte dei mostri riutilizzata e distinguibile attraverso modello, dimensione uniforme, equipaggiamento e segnali degli attacchi; nessuna capsula sostitutiva.
