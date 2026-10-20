# Botte sul Cornicione · 2.0

Obiettivo: migliorare l'arena esistente, aggiungere Darsena e Cantiere con layout reali e voto già presente, togliere il limite in produzione.
Scope: moduli Cornicione, metadati mappe/minigioco, sola esclusione dal watchdog server, laboratorio e verifiche mirate. Preservare tutto il lavoro già presente e gli altri giochi. Nessun commit/push/deploy.

Contratti: mainX=13 e piano principale y=0 per tutte le arene; piattaforme one-way con id 1/2/3, spawn coerenti col layout, unica definizione consumata da simulazione/renderer/bot/debug. Tre vite, stesse mosse, oggetti e abilità. Default timeLimit=Infinity; i soli test che richiedono esplicitamente un limite possono conservarlo. Nessun timer HUD in produzione, nessuna scadenza server anche dopo ripresa; countdown iniziale/respawn/cooldown restano.

Fase unica: stage selezionabile → fisica/renderer → ambienti distinti → HUD/camera/feedback/bot → prove. Criteri: voti e mapId arrivano al gioco; superfici disegnate coincidono coi supporti; spawn 2–5 legali; vecchi limiti 150/420 superati senza termine; KO naturale assegna classifica. Input telefono/pad preservati. Pool effetti e geometria statica, nessun asset esterno o dipendenza.

Verifiche: regressioni core/abilità/oggetti, prova mirata dei tre stage e assenza limite server, verifica browser delle tre mappe e partita reale con voto, typecheck/build una volta a fine modifiche. Massimo tre screenshot rappresentativi.

Esecuzione diretta con Sol come da preferenza precedente dell'utente. La configurazione statica della skill indica root gpt-6.1-sol, non Astra; nessuna delega o cambio modello effettuato.
