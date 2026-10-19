# Votazione mappe

Implementazione diretta, rispettando la precedente preferenza Sol.

- Catalogo leggero condiviso: Ribaltati (2), Backrooms (3), Minigolf (10 percorsi). Gli altri giochi non inseriscono attese.
- Fase server MINIGAME_MAP_VOTE dopo il rullo, prima dell’intro: 15 secondi, un voto modificabile per umano, bot astenuti. Parità: sorteggio tra i più votati; nessun voto: sorteggio, oppure pista kart esplicitamente richiesta in lobby come fallback.
- Contratto: snapshot pubblico con opzioni, roundId, scadenza e voti; evento autenticato dal telefono e relay host solo per controller associati. Rifiutare identità estranee, mappe invalide, voti scaduti o di altri round. Nessun input di gioco prima della partenza.
- Propagare mapId/mapName in payload e contesto; kart mantiene kartTrackId. Backrooms rispetta il livello votato; Minigolf apre con il percorso votato e conserva altre due buche diverse e spareggio.
- TV con conteggi, countdown e cursori pad individuali; telefono con schede, scelta evidenziata e conteggi. Intro conferma la mappa.
- Timer, skip, riconnessioni e restart non devono lasciare voti o contesti vecchi. Nessun avvio del minigioco durante il voto.
- Test di sessione/rete, catalogo contro mappe reali, minoranza/parità/astensioni/stale/reset, selezione reale delle tre modalità, telefono/pad e riconnessione browser; typecheck, regressioni flusso/pad/minigolf e build finale. Preservare le modifiche preesistenti; niente commit/push/deploy.
