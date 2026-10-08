# Preparazione prova con tre giocatori — 9 ottobre 2026

Obiettivo: una partita locale con Nicolò, Carbo e Christian/BOSCHI, dal telefono alla classifica finale senza refresh. Root senza Flash secondo autorizzazione persistente. Preservare tutte le integrazioni GLB già presenti e gli ID interni dei personaggi.

1. Audit e baseline: flusso server, registry/rullo/punti, scene host, controller e reconnect; matrice browser di tutti gli 11 giochi e selftest esistenti.
2. Correzioni piccole: nomi BOSCHI/Carbo coerenti; QR con indirizzo LAN e porta effettiva anche nella build locale; altri difetti riproducibili emersi dai test. Nessuna riscrittura del networking o nuove dipendenze.
3. Modelli: chiarimento opzionale richiesto sulla scelta predefinita. Conservare fallback, collider, hitbox e fisica; non rendere predefinito il driver Kart sperimentale.
4. Accettazione: prova tre controller reali nel browser, minigiochi, input, pausa, reconnect, round successivi, fine partita e nuova partita; fine naturale almeno di un round; build e controllo produzione. Preparare istruzioni locali ripetibili e report breve con limiti reali.

Non obiettivi: ottimizzazione GLB/LOD, nuove animazioni create, deploy, commit/push, certificazione smartphone fisici o rete Wi-Fi da test simulati.
