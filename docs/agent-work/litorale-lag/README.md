# Litorale: caricamento e rendering

- Il countdown aspetta i piloti importati e la preparazione degli shader, usando il caricamento già presente. Il rendering nascosto durante gli upload è limitato a 10 Hz; l'adattamento automatico della qualità parte dopo il caricamento, evitando riduzioni di risoluzione causate dall'attesa. Durante la gara il rendering torna normale. Fallback e annullamento del caricamento conservati.
- Solo sul Litorale: ruote in un passaggio invece di due, con geometria, normali, UV, battistrada e colori conservati; testi e minimappe a 30 Hz, con tempo accumulato corretto. Fisica e camere rimangono aggiornate ogni fotogramma.
- Confronto locale, campioni da 6 s, HIGH, 1920×1080, scala 1, cinque visuali, RTX 3050: **44,15 → 57,67 FPS**; render medio **20,81 → 13,82 ms**; chiamate grafiche medie **424 → 394**. Entrambi i campioni hanno 301.690 vertici. Campioni brevi, non una garanzia per ogni PC o tutta la gara.
- Verificati: geometria delle ruote, avvio con caricamento ritardato, fallback su errore, uscita durante il caricamento, HUD a circa 30 Hz con camere a 60 Hz, una e cinque visuali; immagini prima/dopo esaminate.
- Typecheck finale e build superati; prova compilata: superata.

Le prove intermedie sul mare e sulla posa dei piloti non sono state mantenute. Nessun cambiamento a strada, regole, collisioni, oggetti, bot o altre piste. Nessun commit, push o deploy.
