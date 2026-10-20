# Terminal 2.2

- Accesso alla cabina dalle scale posteriori e dallo scivolo: 22 gradini visibili, con le stesse dimensioni nel renderer e nelle collisioni. Corretta la scelta del piano alle porte basse, con accovacciamento automatico già gestito dalla simulazione.
- Disturbo riprodotto su `sign_russian_airport_02`. Le IWI DXT originali e le immagini nell’atlante erano integre. Il flag emissivo interpolato poteva diventare 1.999999: il modulo lo trasformava in una soglia alpha quasi 2, scartando pixel opachi. La quantizzazione del flag elimina il difetto anche negli altri materiali emissivi. Non è servita una nuova immagine né un offset di profondità aggiuntivo.
- Corrette le UV dei pannelli `sign_russian_airport_01`, `sign_russian_airport_02` e `airport_departure_sign`, mantenendo i ritagli delle immagini originali.
- Dieci materiali senza immagine colore, tra cui `ch_trim_stainlessteel_1`, `me_trim_metalplate_1`, `ap_compartment_trim` e `ap_interior_plastic_trim`, ora usano alluminio o pannelli plastici recuperati dagli asset esistenti. Il modello dell’aereo e le texture originali dei motori sono conservati.
- Luce delle armi più uniforme, con intensità 1 → 1.2 e maggiore riempimento dal basso. Sei armi attive, sola Ray Gun rossa; posizione, danni, rinculo e ADS invariati.
- Atlanti parzialmente vuoti ridimensionati, senza ridurre i texel delle singole texture: stima RGBA con mipmap 984.6 → 761.2 MiB (−22.7%). Non è una misura della VRAM totale.

Verifiche: typecheck; sei modelli nel renderer; sniper ADS 4× trasparente nelle cinque visuali; caricamento e posa iniziale del client; percorsi di ingresso e uscita su entrambi gli accessi (40 e 38 nodi, altezza 1.8 m con ingresso automatico accovacciato); catalogo/votazione delle tre mappe. Build e smoke compilato registrati nei relativi log.

Prestazioni: campione breve con RTX 3050, 1280×720, cinque visuali, scala 1 e identiche posizioni. Campione conclusivo 36.9 → 41.2 FPS (P95 33.5 ms in entrambi). Un primo campione dopo le modifiche aveva restituito 56.7 FPS: la variabilità delle misure brevi non va interpretata come un valore garantito. Risultati in `before-render.json` e `after-render.json`; nessuna garanzia su ogni dispositivo o situazione di combattimento.

Limiti: la conversione sorgente resta parziale e alcune texture sono sostituzioni dichiarate. Non eseguiti nuovi test multiplayer completi, prove con telefono/gamepad fisici o analisi del video, che non era allegato. Nessun commit, push o deploy.
