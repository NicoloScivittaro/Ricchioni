# Sparatoria: inquadratura FPS dal riferimento

L'arma e' ora vicina alla camera, grande in basso a destra, con il calcio tagliato dal bordo e la canna diretta verso il centro.

- Distanza dal giocatore calcolata dalla lunghezza del modello: il retro rimane vicino alla camera anche su pistola e cecchino.
- Offset laterale adattato al rapporto della finestra, aggiornato anche al ridimensionamento.
- Rimossa la riduzione al 50-58% dei modelli nella TV: ogni finestra usa la propria prospettiva.
- ADS centrato, leggermente avanzato, con il profilo superiore sotto il mirino. Rinculo, estrazione e ricarica conservati.
- Scintille e fumo partono dalla posizione effettiva della volata, anche in ADS.
- Nessuna modifica a danni, mira del gameplay, mappe, FOV o dimensioni delle armi degli avversari. Nessuna nuova geometria o texture.

## Verifica

`node scripts/e2e/fps-weapon-framing.mjs` su Chrome/Babylon con GPU: sette modelli caricati, ADS libero, rinculo e lampo, cinque disposizioni reali (1, 2, 3, 4, 5 giocatori), isolamento delle armi per finestra, avversari e client telefono verticale. Nessun errore JavaScript. Esiti in `framing-checks.json`; immagini `framing-*-views.png`, `framing-phone.png`, `first-person.png`, `ads.png`.

Build: `npm run build`, esito in `framing-build.log`.
