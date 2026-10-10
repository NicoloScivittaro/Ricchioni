# Calcio: indicatori compatti

Intervento circoscritto alla presentazione `SoccerReadability`, che ha un solo utilizzatore: il calcio. Implementazione root già autorizzata senza Flash. Preservare tutte le modifiche precedenti; niente commit, push o deploy.

Nomi su una riga, senza pannelli neri né ripetizione della squadra, colore squadra e contorno sottile. Conservare gli indicatori personali/squadra a terra riducendo diametro e spessore. Eliminare l'etichetta PALLA sul campo e riutilizzare l'anello giallo, più piccolo; mantenere il feedback di carica con una barra discreta.

Dimensioni GUI in pixel di progetto, indipendenti dallo zoom. Disposizione deterministica con piccoli spostamenti laterali/verticali, vincoli per pallone, corpi, porte e HUD; collegamenti sottili solo quando servono a distinguere nomi spostati. Se lo spazio non basta, dare priorità all'azione. Nessuna scrittura su giocatori, pallone, comandi, abilità, camera, punteggi o fisica.

Accettazione: browser con cinque giocatori vicini al pallone e alle porte, nomi lunghi, carica/possesso, zoom vicino/lontano; 1280×720, 1366×768, 1920×1080 e 800×600. Controllare realmente gli screenshot. Typecheck, test controller e regressione calcio (passaggio, tiro, contrasto, pausa/rejoin, risultati/cleanup), test significativi sulla disposizione; build finale dopo la verifica visiva.
