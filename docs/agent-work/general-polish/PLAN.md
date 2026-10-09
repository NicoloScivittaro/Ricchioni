# Sistemazione generale e quattro personaggi Tripo

Richiesta interpretata come Tripo predefinito per Goblin, BOSCHI, Carbo e Ciro in tutti i contesti 3D dove compaiono. Interpretazione comunicata; nessuna correzione ricevuta. Root attuale senza Flash, come già autorizzato. Conservare le modifiche delle due fasi precedenti.

1. Unificare la selezione dei quattro profili. La partita normale usa Tripo; le scelte OLD della Gallery non devono contaminare le partite normali. Mantenere confronto DEV e fallback su caricamento fallito.
2. Calcio e Volley: rimuovere l'esclusione grafica, usare clip native disponibili per calcio/carica, servizio/schiacciata, ricezione, contraccolpo. Il contatto viene campionato nell'istante di gioco già previsto; nessuna modifica a fisica, tempi, hitbox, regole o abilità.
3. Kart: quattro profili nel driver seduto, pelle persistente in curva/boost/abilità/arrivo; conservare telaio, fisica e pose di fallback. Verificare seduta e orientamento a vista.
4. Correzioni generali supportate dall'audit: texture particelle Kart per scena (evitare il riuso della texture smaltita nel round precedente), leggibilità HUD di Casa Carbo e dei personaggi importati. Nessun rifacimento dei minigiochi o asset aggiuntivo.
5. Prove mirate delle nuove pose, fallback e ingresso ritardato; giro dei 12 minigiochi con telefoni, risultati e ritorni senza refresh. Build e verifica normale su porta 3001; report e stop.

Asset originali, niente LOD/compressione. Dottore conserva il proprio modello. Le schermate 2D con foto/icone mantengono la loro funzione; il cambio riguarda i corpi e i driver renderizzati in 3D. Nessun commit, push o deploy.


Completata: aggiunto anche il renderer FPS sul telefono, individuato nell’audit. Validazioni e limiti in REPORT.md.
