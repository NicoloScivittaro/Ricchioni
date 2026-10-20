# Terminal 2.4

- Difetti identificati nel progetto: sfondo ciano uniforme e perimetro giallo; vetri originali glass_green/glass_blue con alpha 73%/67%; materiali senza texture su cavi, porte, strutture e pannelli danneggiati dell’aereo.
- Correzioni: cielo sfumato leggero; perimetro metallico neutro nelle identiche posizioni; solo i due vetri originali BLEND ritinti con alpha 20%; mtl_bunker_wires → metal_aluminum01, me_cube_base → concrete_grey02, ap_interior_standard_door → mtl_airplane_window_clean, me_particleboard → ap_wood_tile_big. Sostituzioni dichiarate, non recuperi delle texture originali assenti.
- Conservati vetri smerigliati, superfici opache, luci intenzionalmente bianche e tabelloni partenze. Nessuna modifica a arena.json: SHA-256 a71cd9af611680830054e2db13d33532cb3ad078207c6dca008eca9110bfbf51.
- Riempimento materiali dedicato a minigun, AK, M4 e sniper solo su Terminal. Nessuna modifica a posa, scala, ADS o rinculo. Sei armi attive, sola Ray Gun rossa.
- Minigun: danno 9 → 12, dispersione .045 → .032 rad, portata 35 → 42 m, ricarica 3.2 → 2.9 s. Conservati 17 colpi/s, 100 colpi e penalità di movimento. TTK ideale su 100 HP: .647 → .471 s, senza protezioni e con tutti i colpi a segno; non è una misura di combattimento reale.
- Geometria: conservati 1.704.739 triangoli, 1.998 istanze e sette materiali atlas.

## Verifiche brevi

Typecheck e build finale superati (3m 57s; avviso preesistente sulle dimensioni dei chunk). Corretta la guardia TypeScript sul clone opzionale della texture. Verificati anche gli hash degli asset compilati e l’accessibilità HTTP dell’anteprima, caricamento Terminal, sei modelli arma e ADS sniper 4×, tre inquadrature visive. La verifica visiva è stata ripetuta solo dopo la correzione della luce della minigun. Nessun errore browser.

Confronto GPU RTX 3050, 1280×720, cinque visuali, scala 1, identiche posizioni e M4, warm-up 1,2 s e campione 6,5 s: **59.63 → 59.48 FPS**, p95 **16.8 → 16.8 ms**. Limite vicino a 60 Hz; nessun miglioramento prestazionale rivendicato e nessuna riscrittura necessaria. Draw call 492 → 497 per il cielo nei cinque riquadri. Non misura una partita multiplayer dinamica o cinque telefoni fisici.

## Limiti

Il video citato non era allegato: le cause sono state individuate ispezionando materiali e renderer, non confrontando i fotogrammi del video. La conversione rimane parziale come in precedenza: alcuni asset originali sono ancora assenti e sostituiti con materiali già disponibili. Nessuna ricostruzione, modifica a collisioni/spawn/bot, commit, push o deploy.
