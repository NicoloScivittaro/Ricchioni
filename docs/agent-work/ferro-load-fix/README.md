# Correzione avvio Ferro e Furia

Il controllo host interrompeva il caricamento dopo25secondi. Una prova sulla vecchia build con una skin ritardata di28secondi ha riprodotto lo stesso errore della schermata dell’utente.

- Attesa massima di120secondi soltanto per Ferro e Furia; gli altri giochi conservano25secondi.
- Copie delle quattro skin senza214 clip incorporate inutilizzate: risparmiati17967768byte. Geometria, pesi, matrici di bind, materiali e immagini delle texture mantenuti byte per byte; originali in public/models invariati. Nessuna semplificazione o ricompressione.
- Rendering di preparazione sotto la schermata di caricamento: nessun avanzamento della simulazione e nessun modello provvisorio mostrato.
- Avvio dalla lobby verificato con cinque giocatori su Colosseo (skin ritardata di28s), Hell e Geonosis. Tutti passati, nessun errore JavaScript. Pose delle quattro skin e impugnature nuovamente verificate.
- Typecheck passato. Build e controllo finale della versione compilata sono registrati nei rispettivi log.

I tempi nei JSON includono transizione e introduzione; le prove Hell/Geonosis sono state eseguite durante la build e non costituiscono un benchmark. La finestra già aperta deve essere ricaricata per usare il nuovo codice.

Nessun commit, push o deploy.

Build finale passata. Prova della build compilata su localhost:3012: Geonosis con cinque giocatori, una skin ritardata di28secondi, avvio riuscito e nessun errore JavaScript. Verificata corrispondenza SHA256 delle quattro skin fra public e dist.
