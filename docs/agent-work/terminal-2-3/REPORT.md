# Terminal 2.3

- RTX 3050, WebGL 2, 1280×720, cinque camere, scala 1, stesse posizioni: **42.6 → 59.3 FPS**. P95 frame **33.4 → 16.8 ms**; draw call **521 → 492**. Campioni brevi della stessa scena, senza combattimento prolungato.
- Ingresso completo del benchmark (nav, renderer, armi e shader pronti): **5.75 → 4.20 s**. Preparazione del mondo: **3.76 → 1.97 s**. Sono misure locali, non una misura sul dispositivo o sulla rete del video citato, che non era allegato.
- Raggruppamento offline, istanze GPU nel GLB, sette atlanti compatti a risoluzione nativa invece di ingrandire ogni piccolo dettaglio a 512/1024. Atlanti RGBA con mipmap stimati **761 → 280 MiB**, non VRAM totale. GLB runtime circa **74.1 → 63.0 MB**. Celle statiche da 64 m, istanze da 32 m e frustum/octree conservati; nessun merge globale.
- Il renderer legge 2,138 byte di configurazione al posto dei 14,168,900 byte dell’intero file delle collisioni. La simulazione continua a caricare tutte le collisioni prima di iniziare. Il relativo file è identico al precedente (SHA-256); 1,704,739 triangoli sorgente e trasformazioni conservati.
- Cinque armi convenzionali: riempimento ambientale legato alla loro texture per leggere i dettagli nelle zone scure. Sei armi attive, una Ray Gun rossa. Inquadratura, ADS, animazioni, danni e controlli conservati.
- Rifiniti soltanto `ship_ceiling01`, `com_plastic_wall` e i materiali della moquette dell’aereo, con pannelli coerenti e trama tessile discreta. Nessuna modifica alla geometria o ai due accessi dell’aereo.
- PROTETTO è un piccolo indicatore alto, separato dalle abilità e visibile soltanto quando la protezione reale è attiva. Avvisi di blocco, danno e rientro ridimensionati per cinque visuali.
- Verifiche: sei modelli e ADS, cinque visuali, ingresso coperto fino al caricamento, pavimenti renderizzati dei 19 spawn, morte/respawn e HUD, Cantiere/Nuketown a due visuali. Typecheck e build nei log; smoke del client compilato nel relativo JSON.

Limiti: conversione originale ancora parziale; alcuni materiali sono sostituzioni dichiarate. Nessun nuovo playtest multiplayer completo o controllo con telefoni/gamepad fisici. Nessun commit, push o deploy.

Rigenerazione asset: `python tools/terminal/optimize_atlas.py`, poi `python tools/terminal/prebatch.py`.
