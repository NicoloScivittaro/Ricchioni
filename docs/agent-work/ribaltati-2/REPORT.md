# Ribaltati — Circuito del Litorale 2.0

Intervento sulla baseline pulita `8d644d9`. Esecuzione diretta, senza Flash, nuove dipendenze, commit, push o deploy. Architettura a spline, tre giri, input, 13 oggetti, cinque abilità e skin sono conservati.

## Confronto misurato

| Parametro | Prima | Adesso |
|---|---:|---:|
| Lunghezza di un giro (unità di pista, circa metri) | 738.37 | 1305.66 |
| Percorso sui tre giri | 2215 | 3917 |
| Punti di controllo del disegno | 17 | 25 |
| Quota massima della strada | circa 2,6 m | circa 12 m |
| Larghezza | 10–20 m | 16–25 m |
| Durata media, stessi piloti/semi | 56.7 s | 98.5 s |
| Limite di gara | 170 s | 230 s |

Pista **+76.8%**, durata simulata **+73.7%**. Il precedente limite di 170 s non determinava la durata: la gara finiva già dopo i tre giri. La velocità massima, accelerazione e sterzo di base sono rimasti identici.

Il confronto durata comprende otto simulazioni per ciascuno dei tre profili imperfetti (principiante, medio, esperto), sia prima sia dopo; isola il cambiamento di geometria con la stessa fisica. Le dinamiche nuove sono verificate separatamente in 24 gare complete con bot, collisioni e 30/60/120 Hz. Il tracciato viene completato senza respawn obbligatori e tutti i partecipanti arrivano in queste prove.

La gara finale nel browser, con cinque client emulati guidati dalla logica bot esistente, ha avuto il primo arrivo a **95.418 s** e si è chiusa in **99.901 s reali** dopo il reset della griglia. Nessuna accelerazione del tempo: 29 decolli, 15255 campioni camera, 0 camere sotto la strada. Questo è un risultato di prova con AI; la durata con persone dipende dalla guida e dagli oggetti.

## Livello e grafica

- Il lungomare sale al Belvedere: prima rampa, parapetti luminosi, impalcato e pilastri leggibili sotto il viadotto.
- Il paese ha un tratto alto, curve larghe, discesa e campanile riposizionato rispetto al nuovo percorso.
- Il porto alterna asfalto bagnato, carico mobile della gru, salita al pontile e seconda rampa.
- Il paddock presenta una scelta fra corsia turbo stretta a sinistra e corsia larga sicura a destra, separate da una barriera continua, poi una S finale. Entrambe seguono i checkpoint della pista; il vantaggio della corsia turbo richiede precisione.
- Nuovo asfalto con dettaglio procedurale, deck laterale, strutture sopraelevate, luce sui parapetti, pennoni, segnaletica per salti e carico mobile, superfici speciali a contrasto e costa adattata alle nuove dimensioni.
- Le parti ripetute usano thin instances e materiali condivisi. I gruppi statici compatibili sono raggruppati. Il bloom disegna gli emettitori luminosi invece di ripassare tutta la scena per ogni visuale.

I salti riusano `jumpHeight`/`jumpVelocity`; la pista rimane continua anche sotto il salto. L'asfalto bagnato riduce moderatamente velocità e riallineamento soltanto in una breve zona. Le collisioni del carico usano uno sweep del volume del kart; il separatore considera la larghezza reale del veicolo. Scudo, invulnerabilità e passaggio sopra il carico sono verificati. Il respawn mantiene il checkpoint valido.

## Camera, HUD, audio e feeling

Camera con quota del salto, lettura della strada davanti e altezza minima sopra il tratto retrostante. Il kart segue l'inclinazione della carreggiata. Ogni visuale mantiene minimappa, posizione, giro, oggetto e abilità, con l'aggiunta di settore e tempo trascorso. Decollo, impatto con ostacolo e atterraggio hanno suoni, vibrazione e feedback coerenti con l'audio esistente. Non cambia il sistema di controllo.

Fisica a 120 Hz preservata; rendering del pilota, HUD e camera vengono aggiornati una volta per passo esterno, evitando il lavoro duplicato dei sottopassi. La classifica alla scadenza ora conserva l'ordine di avanzamento prima di marcare tutti come conclusi.

## File modificati

| File nel repository | Intervento |
|---|---|
| `src/minigames/kart-race/track.ts` | percorso, larghezze, banking, rampe geometriche, asfalto e deck |
| `src/minigames/kart-race/trackDynamics.ts` (nuovo) | superfici, salti, corsia turbo, collisioni e ostacolo mobile |
| `src/minigames/kart-race/trackSetPieces.ts` (nuovo) | pilastri, segnaletica, luci, pennoni, carico/gru e separatore |
| `src/minigames/kart-race/kartEnvironment.ts` | costa, landmark, colori e gruppi statici |
| `src/minigames/kart-race/BabylonKartGame.ts` | integrazione, presentazione separata, bloom e feedback |
| `src/minigames/kart-race/kartPhysics.ts` | risposta opzionale delle superfici, valori base invariati |
| `src/minigames/kart-race/kartEntity.ts` | orientamento del veicolo sul piano inclinato |
| `src/minigames/kart-race/cameraHud.ts` | camera e HUD di settore/tempo |
| `src/minigames/kart-race/race.ts` | classifica corretta dei non arrivati |
| `src/minigames/bots/MotionBots.ts` | scelta della corsia e lettura della gru, soltanto nella guida kart |
| `shared/minigames.ts` | descrizione e limite di Ribaltati |
| `scripts/e2e/gamepad-kart.mjs` | fixture aggiornata a `sfera` e drift isolato anche dalla direzione |
| nuovi script `ribaltati-*`, documenti e `dist/index.html` | test, confronti, immagini e build locale |

## Verifiche eseguite

- Typecheck e `npm run build` finali passati (Vite 3m22s). Rimane l’avviso preesistente sulle dimensioni dei bundle Babylon. `ribaltati-production.mjs` passato sulla build compilata: un telefono touch emulato e quattro bot, limite 230 s ricevuto dal server, pista attiva, pausa e ritorno alla lobby con un solo canvas, nessun errore di pagina/loop. Questa prova compilata è uno smoke test; le gare naturali complete sono state eseguite nel browser con il sorgente finale della logica di gioco.
- `ribaltati-2-selftest.ts`: chiusura della spline, larghezze, quota, banking, assenza di sovrapposizioni fra tratti non adiacenti, rampe, atterraggio, scudo, sweeps del carico, due corsie, respawn, ordine a scadenza; 24 gare complete 2–5 bot a 30/60/120 Hz.
- `ribaltati-camera-selftest.ts`: **336** posizioni con dislivelli/salto e layout 2–5, proiezione del kart e distanza della camera dalla strada.
- Regressioni kart: contatti, olio, **13 oggetti** e cinque abilità. Profili input, solo-bots e rounds (**60** verifiche) passati.
- Geofall: suite domande e **48 partite bot**; Backrooms: **41 gruppi**; Minigolf: **40 round bot** con dieci campi. Nessuna modifica alle loro implementazioni.
- Browser gamepad: sterzo analogico, pedali, drift e mini-turbo, oggetto singolo, abilità, pausa senza boost fantasma, disconnessione, fallback al telefono e riconnessione. Main ripetuto e passato dopo l'aggiornamento di fixture obsolete. Verifiche split-screen/controller 2, 3, 4 e 5 passate.
- Browser dedicato: client 2, 4 e 5, input telefono su tratto libero, pausa, ricarica/rientro con la stessa identità e pulizia del canvas. Due gare naturali da tre giri con cinque visuali; ultima ripetuta dopo l'allineamento del separatore. Ultima rifinitura dei materiali verificata separatamente con tutte le immagini delle sezioni.
- Prima prova del telefono a quattro giocatori ripetuta su strada libera: la griglia con altri kart fermi interferiva con il test dell'acceleratore. La verifica ora attende il movimento effettivo e non dipende da una pausa fissa di 800 ms.

## Prestazioni e limiti

Confronto locale Chrome/ANGLE Direct3D11, **NVIDIA GeForce RTX 3050**, qualità HIGH, **1280×720, scaling fisso 1, ombre attive**, cinque partecipanti e cinque visuali. Stesse condizioni di campionamento e logica bot, due campioni da otto secondi (prima/dopo). Nessun lavoro di build durante le misure finali.

| Metrica con cinque visuali | Prima | Finale |
|---|---:|---:|
| FPS medi | 28.47 | 35.02 |
| CPU step, media | 2.677 ms | 1.350 ms |
| Render, media | 31.531 ms | 26.404 ms |
| Draw call nel campione | 1106 | 795 |

Circa **+23% FPS**, **-50% costo step** e **-28% draw call** nel campione. Le condizioni della pista cambiano naturalmente durante la guida: sono misure indicative sul PC locale, non una garanzia per ogni scena/dispositivo.

Con una visuale e gli stessi cinque partecipanti (un client e quattro bot), il campione finale è **59.94 FPS**, render medio 6.636 ms, con ombre e scaling identici. Le cinque visuali restano una configurazione impegnativa a qualità HIGH: il campione finale non raggiunge 60 FPS. Nessuna riduzione di risoluzione, nessuna disattivazione delle ombre e nessuna modifica ai preset globali per ottenere il confronto.

Le prove del telefono e dei controller avvengono con browser mobile emulato e pad Xbox/DualSense simulati; restano da provare con 2–5 persone e hardware fisico, soprattutto la leggibilità sui televisori più piccoli e il bilanciamento della corsia turbo. Nessuna garanzia di 60 FPS su tutti i dispositivi. Il livello usa la fisica arcade e la spline esistenti.

Anteprime: `section-belvedere.png`, `section-viadotto.png`, `section-porto.png`, `section-pontile.png`, `section-bivio.png`, `overview.png`; confronto `before-start.png` / `after-start.png`. Dati: `before-duration.json`, `after-duration.json`, `dynamics-races.json`, `natural-race.json`, report browser e prestazioni.

Anteprima compilata locale: **http://localhost:3006/**. Nessuna pubblicazione remota. Il server Vite di sviluppo è stato chiuso.

Nota sul banco di prova: alcune prove iniziali interrotte e la suite gamepad che chiude i client a metà round hanno lasciato stanze senza host; i loro watchdog hanno registrato timeout di sicurezza. Il server locale è stato riavviato dopo le verifiche per ripartire senza queste stanze. Le gare complete e lo smoke finale non hanno mostrato errori di pagina o del loop.
