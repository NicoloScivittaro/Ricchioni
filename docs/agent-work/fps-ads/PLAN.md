# Sparatoria: ADS e feedback

Implementazione root autorizzata dall'utente, senza Flash. Conservare le modifiche già completate al Cornicione.

Contratto: LT/L2 tenuto → aim; RT/R2 → fire. Telefono MIRA e SPARA con pointer capture e ownership separata, joystick/look simultanei. ADS autorevole per giocatore, transizione 0,18 s, zoom 1,3×, movimento 75%, sensibilità 65%, dispersione di base /1,35. Danno/cadenza/abilità invariati. Rinculo reale, visuale e traiettoria coerenti; hipfire resta immediato e più mobile. Nessun aggancio automatico.

Arma centrata con mirino geometrico, mirino HUD dinamico per ciascuna finestra. Riutilizzare hitmarker e indicatori esistenti, rendendo la direzione del danno autorevole anche per esplosioni. Reset su pausa/morte/respawn/fine round/perdita input. Bot usano ADS a distanza e hipfire vicino.

Verifiche: formule pure, typecheck, regressioni abilità/controller/Cornicione; browser con cinque pad e telefono, test simultaneità/cancellazione/hit reali/isolamento viewport, build e smoke del bundle produzione. Report con limiti del playtest umano.
