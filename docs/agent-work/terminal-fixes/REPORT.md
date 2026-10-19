# Terminal: accessi, movimento, vittoria e rendering

- **Accessi:** griglia di appoggio da 40 a 30 cm, raggio fisico da 28 a 22 cm, mantenimento di tutte le superfici calpestabili anziche' della sola componente principale. 157350 punti di appoggio. Le piccole giunture richiedono supporto da entrambi i lati e restano sottoposte al controllo di pareti e spazio per il corpo.
- **Aereo:** percorso piazzale-scale-ingresso-cabina verificato in quattro punti, fino a z=-54.9; apertura nel pavimento superata con un salto e atterraggio a z=-59.925. Nessun teletrasporto nel test di movimento. Tutti i 19 spawn sono nella stessa componente percorribile.
- **Movimento:** salto di circa 1.07 m, gravita' e atterraggio autorevoli; controllo del corpo in aria contro le coperture. Accovacciamento tenuto, velocita' ridotta, camera a 86 cm, bersaglio dei colpi alto 1.05 m. Nei passaggi bassi il corpo resta accovacciato finche' c'e' spazio per rialzarsi. Alla rinascita si ripristina la postura.
- **Vittoria:** termina al primo giocatore con 10 uccisioni. Ulteriori danni non possono generare un secondo vincitore nello stesso passo. Rimossa la scadenza di 100 secondi; il watchdog esterno conserva un cap tecnico di 20 minuti. HUD e risultati indicano il traguardo.
- **Texture:** derivate delle coordinate calcolate prima della ripetizione UV, campionamento limitato ai mip compatibili con i bordi dell'atlante. Nessuna sostituzione dinamica delle texture. Le sezioni architettoniche non scompaiono piu' a 85 m. Prova di ritorno della camera: immagine identica prima/dopo, senza errori shader.
- **Prestazioni:** architettura raggruppata in celle da 32 m, limiti di distanza delle decorazioni basati sul singolo oggetto, bounding box statiche, rimozione delle sorgenti temporanee degli asset dall'octree dinamico.

## Comandi

Telefono: SALTA e ACCOVACCIATI (tenuto). Controller Xbox: A salto, B accovacciamento tenuto, LB scatto; PlayStation: X salto, cerchio accovacciamento tenuto, L1 scatto. Mira, sparo, ricarica e abilita' restano sugli altri comandi esistenti.

## Verifica e misura

- Movimento del percorso reale, quattro destinazioni in cabina, salto e atterraggio nell'area posteriore, pareti/coperture ancora bloccanti, spawn con spazio per stare in piedi.
- Salto verificato a 30, 60 e 120 Hz; altezza massima coerente.
- Test nel minigioco reale: salto, accovacciamento, ripristino dopo rinascita; un colpo all'altezza della testa danneggia un avversario in piedi (HP 45) e passa sopra quello accovacciato (HP 100).
- Partita ancora attiva oltre il vecchio tempo limite; eliminazione decisiva 9->10, risultato del vincitore e blocco dei danni successivi.
- Telefono reale nel browser, verticale e orizzontale: pressione/rilascio/cancellazione dell'accovacciamento, salto e atterraggio, pulsanti nel viewport e mirino libero. Contatore leggibile anche sotto il badge di fallback.
- Profili gamepad, mira, ADS e watchdog: selftest passati.
- Confronto renderer locale RTX 3050, 1280x720, cinque camere, stessa posizione, scala di rendering 1: **20.0 -> 36.2 FPS**, chiamate di disegno **1303 -> 853**, p95 fotogramma **66.7 -> 33.5 ms**. Campioni di 6.5 secondi; e' una misura del renderer in queste condizioni, non una garanzia per ogni dispositivo o combattimento.

La conversione originale di Terminal rimane parziale: questo intervento migliora la mappa gia' presente e non recupera nuovi modelli o materiali mancanti dal sorgente CoD. `terminal.glb` e le armi sono preservati.

Build e controlli: `build.log`, `navigation-checks.json`, `gameplay-checks.json`, `phone-checks.json`, `before-render.json`, `after-render.json`, `visual-checks.log`.
