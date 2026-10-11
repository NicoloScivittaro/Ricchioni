# Checkpoint

Baseline `487ff47`, pulita. M1 completata e verificata; M2 prossima.

Audit iniziale: sei item (turbo, super_turbo, sfera, olio, scudo, disturbo). L'olio crea un cilindro senza posizione e `updateTraps` non la assegna; rimane all'origine. L'effetto chiama `hitKart(.6)`, velocità ×.35 e sterzo disabilitato: non è grip. Materiale viola opaco, diametro 1.6 contro trigger più grande. Correzione su superficie campionata dalla TrackSpline, volume leggibile e grip temporaneo, senza chiamare hitKart.

M1: superficie lucida 4.8×3.4 m, bordo iridescente, rialzo 8.5 cm e offset profondità; curva/rampa dalla spline. Grip per 1.6 s, nessun taglio velocità/stun; inerzia in sterzata, fumo gomme e suono dedicato. Scudo/invulnerabilità e debito Ciro preservati. Trigger continuo, cambio giro, riattraversamento consentito dopo uscita. Durata chiazza 18 s. Materiali propri smaltiti.

PASS: typecheck; kart-oil-selftest (30/60/120, inerzia/recupero/zero freno/Ciro/sweep); kart-contact-selftest; kart-abilities-selftest; browser `kart-oil.mjs` 5 telefoni/viewport, screenshot 1280×720 e 1920×1080 aperti e ispezionati, oil sweep 10 m senza freno, scadenza 15 mesh/materiali, ritorno lobby. `oil-browser.json`. Le prime catture prima della compilazione shader non mostravano l'olio: il test ora attende `whenReadyAsync` prima di render/cattura.
