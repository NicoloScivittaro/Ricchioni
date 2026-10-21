# Ferro e Furia 2.0 — Honor & Steel

- Importati tutti i10GLB. Quattro spade cosmetiche con statistiche identiche, due scudi, Longinus, arco e freccia separati. Daghe e martello dal pack Melee; ascia originale conservata.
- Tre mappe nel voto esistente: Colosseo, Hell e Geonosis. Geometria originale preservata; proxy geometrici di terreno/collisione/navigazione da0,4m.
- LT aggancia un bersaglio vivo e visibile entro14m; movimento laterale e camera fluida, R3 cambia bersaglio. Il rilascio di LT libera la camera.
- Guardia alto/sinistra/destra con RS o telefono, specchiata correttamente nello spazio del difensore. Direzione fissata all’avvio del colpo; impugnature e sweep condivisi durante le sole finestre attive.
- Parry130ms su nuova pressione, finte dei soli pesanti in preparazione, presa ravvicinata con270ms per contrastare, schivata fisica e recupero stamina ritardato. Nessun danno gratuito dalla presa.
- 15 clip FBX reali campionate, adattate ai personaggi originali. Guardia, deviazione, finta, presa/contrasto e schivata sono layer originali, non clip dichiarate presenti nei pack. Elenco esatto in CREDITS.md e conversion.json.
- Arco LOAD→HOLD→RELEASE→RECOVERY; freccia fisica al decimo di secondo del rilascio. Mira verticale coerente con arco/freccia impugnata; perdita del tocco annulla senza sparare.
- Cinque partecipanti, visuali dei soli umani, tre manche e spareggi preservati. Bot con percezione ritardata, risorse comuni, direzioni e finte. Tenacia temporanea contro aggressori diversi: riduce lo stordimento senza invulnerabilità.
- Materiali equivalenti e geometria condivisi, texture importate inutilizzate rilasciate, effetti riutilizzati e primo rendering preparato sotto il caricamento. Con3–5 visuali Geonosis rende internamente a1600×900; HUD a1920×1080.

| Mappa | FPS misurati | Rendering interno | Campione |
|---|---:|---|---|
| hell | 59.2 | 1920×1080 | 6.02s |
| geonosis | 60.1 | 1600×900 | 6.01s |

RTX3050, Chrome ANGLE/D3D11, cinque visuali attive, canvas1920×1080.90frame di preparazione prima di ciascun campione finale; FPS=frame/tempo effettivo. HP1000 soltanto nella fixture per mantenere cinque attori. Non è una prova di rete o un confronto garantito con i primi campioni di avvio, risultati variabili.

Passati typecheck, build finale, verifiche mirate nuove e precedenti della logica, visualizzazione degli asset, due umani con interfaccia controller.html e Xbox simulato, tre guardie sul telefono, danno/finta col pad, arco e annullamento su blur, cleanup e prove con cinque visuali. Nessun gamepad fisico dichiarato verificato. Nessun test degli altri minigiochi.

Limiti: collisioni approssimate dai proxy; prestazioni dipendenti dal dispositivo. Arco CC BY-NC-SA4.0; Scutum Standard e diritti su proprietà intellettuali da verificare prima di pubblicare. Crediti e modifiche conservati in ogni GLB e public/assets/ferro2/CREDITS.json. Nessun commit, push o deploy.
