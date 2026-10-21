# Orda — grafica e fluidità

Nel confronto breve del renderer: **18.8 → 39.2 FPS**, +109%. RTX3050,5 visuali,22 mostri animati, finestra1920×1080 e interno1669×939 invariati. Circa952→652 disegni per fotogramma. Campioni di6s dopo riscaldamento, fixture visiva ripetibile con le armi reali; nessuna simulazione completa di IA/rete. Non è una garanzia di FPS in ogni partita.

Grafica: pavimento più dettagliato, luce ambientale fredda e direzionale calda, ombre di contatto per mostri e ripari, zone di luce precalcolate, guide luminose, cartelli più curati e HUD meno invasivo. Nessun nuovo ostacolo o luce dinamica. Le ombre degli attori sono27 istanze di una sola mesh.

Ottimizzazione principale: Bacteria e Macellaio condividono un materiale organico scuro e le parti rigide vengono unite. Tutti i15648 vertici originali e i pivot di testa e braccia restano presenti, quattro mesh per attore. Materiali statici congelati, picking inutile disabilitato e framebuffer non conservato. Altre sagome e animazioni preservate.

Verificati renderer reale,5 visuali e layer separati delle armi, geometria/pivot, rampe a doppia faccia, controllo visivo, typecheck e build finale. Prezzi, danni, perk, fisica e comandi non modificati. Nessun commit, push o deploy.
