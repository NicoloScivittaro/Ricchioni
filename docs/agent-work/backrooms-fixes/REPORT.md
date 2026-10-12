# BACKROOMS — correzioni dopo il playtest

I quattro interventi sono implementati e verificati automaticamente nel browser. L’architettura Phaser/Babylon, le visuali separate e i sistemi di partita restano quelli esistenti. Restano da fare ascolto sulla TV, prova dei dispositivi fisici e playtest umano del bilanciamento; non sono stati sostituiti da test simulati.

**Audio: cause e correzioni.** Il vecchio ambiente usava sinusoidali a 50 e 100,5 Hz con gain circa 0,018, ulteriormente ridotto dal bus ambience e dal master: un segnale debole e poco adatto agli altoparlanti TV. La scena chiamava `unlock()` durante la creazione asincrona, che non garantisce un gesto riconosciuto dal browser; mancavano controllo dello stato e un percorso visibile per completare lo sblocco. Non posso attribuire retroattivamente il silenzio del tuo dispositivo a una specifica impostazione di volume o autoplay.

Ora il ronzio comprende armoniche udibili intorno a 120/241 Hz, varia con le stanze e con la vicinanza delle creature, include brevi pause e suoni lontani. Passi dei giocatori e dei tre mostri, porte, generatori, interruttori, chiave, rivelazione, cattura e fuga hanno suoni distinti. Cattura e fuga hanno priorità sul budget delle voci. Tutto passa attraverso i bus ambience/sfx del mixer esistente: volume, muto, compressore e limiter continuano a valere. Se il contesto è bloccato compare un pulsante sulla TV; clic o tasto reale dell’host sblocca il contesto. Un input dal telefono non viene considerato un gesto della pagina TV. Ripresa, sospensione e smontaggio sono gestiti senza duplicare i due oscillatori continui. Il tema musicale Backrooms rimane silenzioso.

La prova audio usa Chrome con autoplay che richiede attivazione dell’utente e CDP `userGesture:false` prima dello sblocco (il normale `page.evaluate` di Puppeteer può simulare un gesto, quindi non era una prova valida del blocco). Prima del clic: contesto suspended e uscita zero. Dopo: running e segnale misurato sull’analizzatore dopo il limiter, collegato allo stesso ramo della destinazione. Questo verifica il percorso nel browser, non l’ascolto fisico.

**Interazioni: causa e correzioni.** Il loop Backrooms non azzerava gli edge di frame; la sua latch `edge || held` poteva restare attiva dopo il primo A/✕, scartando le pressioni successive. Anche una neutralità non osservata fra due tap poteva bloccarle. La selezione ordinava per distanza, usava solo yaw e punti a terra, ignorando la reale posizione di pannelli, chiave e armadietti.

Ora il render azzera gli edge una volta a fine frame, mentre un contatore monotono conserva ogni pressione per il consumatore Backrooms anche dopo `clearFrame`. Un cursore per giocatore evita ripetizioni nei sotto-passi e distingue cancellazione, nuova pressione e sostituzione dell’input. Le pressioni accumulate sono elaborate una alla volta; il generatore usa il tempo realmente tenuto. Gli altri giochi mantengono i loro metodi di input e le loro semantiche.

Il bersaglio usa yaw, pitch, distanza, posizione del componente visibile e LOS; per una porta si ignora soltanto il suo stesso pannello, mantenendo l’occlusione delle altre porte. Il prompt mostra già la causa della porta d’uscita bloccata. Un comando senza bersaglio chiede di avvicinarsi e guardare l’oggetto; una porta occupata lo segnala. Avvisi e suggerimento attuale convivono sulla TV. Il telefono conserva due joystick e il pulsante INTERAGISCI indipendente; spettatori cambiano visuale con una pressione.

**Mappe.** Ogni avvio normale confronta il seed e la firma esatta della griglia dei corridoi con la partita precedente. In caso di uguaglianza rigenera prima di costruire la scena. La firma non dipende da mostri o decorazioni e non usa un hash che potrebbe collidere. SessionStorage e memoria locale mantengono il riferimento precedente. Il generatore continua a variare collegamenti, stanze, vicoli, porte, uscita, chiave, puzzle, rifugi e condizione di fuga. Il controllo garantisce strutture diverse fra partite consecutive, non l’assenza eterna di qualsiasi ripetizione.

La cattura riutilizza la stessa istanza di labirinto. In sviluppo `?backroomsSeed=12345` permette di riprodurre lo stesso seed/numero di giocatori e bypassa deliberatamente il controllo di novità, senza sostituire il riferimento dell’ultima partita normale. Gli obiettivi risultano raggiungibili; le porte possono essere aperte e non costituiscono blocchi permanenti.

**Percezione.** Tutti e tre i mostri hanno FOV relativo al proprio orientamento, distanza visiva, distanza ridotta nel buio, LOS con pareti/porte e controllo del giocatore nascosto o protetto. È eliminata la vista a 360° a distanza ravvicinata. Un bersaglio ancora visibile viene mantenuto anche con un altro giocatore più vicino.

PATROL → SUSPICIOUS → INVESTIGATE riguarda i rumori: una zona approssimativa con raggio di una cella, nessun bersaglio giocatore, nessuna memoria visiva. Un avvistamento reale passa dalla breve reazione WATCH a CHASE. Perdita del contatto passa a SEARCH verso l’ultimo punto effettivamente visto, senza aggiornamenti delle coordinate fuori vista; terminata la memoria passa a RETURN e pattuglia. I rumori non sovrascrivono la memoria visiva. Un armadietto utilizzato davanti a una creatura conserva la conoscenza dell’ingresso realmente osservato; nascondersi senza essere visti non assegna tale informazione. REST resta la pausa dopo una cattura.

Una cattura richiede bersaglio acquisito visivamente, stato di caccia/ricerca valido, contatto entro 0,7 m e LOS valido. Una porta aperta dal mostro nello stesso tick non autorizza una cattura basata su un avvistamento che era ancora occluso. Restano due vite e protezione al respawn.

I parametri regolabili sono esportati in `CREATURE_SENSES` in `src/minigames/backrooms/backroomsRules.ts`:

| Mostro | FOV | Vista / buio | Reazione | Memoria ricerca | Udito | Velocità normale / caccia |
| --- | --- | --- | --- | --- | --- | --- |
| Stalker | 105° | 14 / 7 m | 1,2 s | 5 s | 0,6× | 1,35 / 3,45 m/s |
| Corridore | 105° | 14 / 7 m | 0,12 s | 5 s | 1× | 2,45 / 4,8 m/s |
| Imitatore | 105° | 14 / 7 m | 0,3 s | 5 s | 0,7× | 2,4 / 3,9 m/s |

Il raggio dipende anche dal rumore prodotto (passo 4, corsa 17, porta 10); dietro un ostacolo l’udibilità si riduce. In DEV `?backroomsDebug=1` mostra cono, stato, bersaglio, memoria visiva, zona sonora, LOS e motivo della transizione. L’overlay è aggiornato a 10 Hz e smontato con la scena. La build compilata esclude le query DEV e il relativo overlay.

**Verifiche superate.**

- Typecheck e build: exit 0; chunk Backrooms lazy circa 47,3 kB. Il warning Vite sui chunk generali Babylon/Phaser grandi rimane quello esistente.
- 22 gruppi dedicati e 38 gruppi Backrooms: pressioni brevi/ripetute/tenute, frame da 250 ms, cancellazioni; tutti i mostri davanti/dietro, limite FOV, luce, muri/porte, perdita/reacquisizione, rumori, nascondigli osservati/non osservati, catture/respawn, bersagli multiplayer.
- 4.000 nuove mappe consecutive con seed iniziali duplicati deliberatamente: guardia seed/topologia, riproducibilità, connettività e obiettivi. Ulteriori 4.000 verifiche del generatore nella suite esistente.
- 11 suite: Backrooms, FPS ADS, Geofall, pad, abilità, round, bot solo, audio, minigolf, qualità, animazioni personaggi. Hash dei tre file Geofall verificati invariati.
- Browser: cinque client telefono, pad Xbox/DualSense/generico simulati sul percorso GamepadManager reale; quattro pressioni da 90 ms per famiglia, hold da 700 ms; tap telefono da 12 ms; tre dita CDP con movimento/visuale/interazione; hold generatore; pausa, fallback, riconnessione, cattura/chiave/respawn/eliminazione/spettatore.
- Schermate TV 1280×720, 1920×1080, 800×600; telefono 390×800, 360×640, 844×390. Screenshot aperti e controllati, inclusi prompt e versione compilata.
- Stanze native complete da 2 a 5 partecipanti, con un client telefono e posti bot: per la prova automatica l’umano è guidato dallo stesso autopilota, simulazione accelerata, nessun risultato forzato. Fine naturale, classifica, punti e ritorno lobby verificati.
- Quattro cicli di avvio/pausa/ripresa/uscita: topologie differenti, oscillatori terminati, voci e render loop azzerati, HUD/controller rimossi, solo canvas Phaser rimasto.
- Build compilata servita su localhost: avvio dai menu reali, cinque visuali, quattro GLB caricati, telefono senza renderer 3D, pausa/ripresa, nessun overlay DEV, nessun errore JavaScript/WebGL rilevato. Questa è una prova di avvio, distinta dalle partite complete sulla sorgente.

Misure audio finali: ambiente RMS 0.0414, tensione 0.0742; master dimezzato 0.0214; muto/pausa/bus ambience zero = 0; breve silenzio RMS 0.000073. Nessun picco di prova arriva al clipping. Tempi simulati delle stanze: 2 giocatori: 84.4 s, 3 giocatori: 31.0 s, 4 giocatori: 155.1 s, 5 giocatori: 203.4 s.

**File modificati.** Gameplay/integrazione: `src/minigames/backrooms/BabylonBackroomsGame.ts`, `backroomsRules.ts`, `backroomsAudio.ts`, `maze.ts`; nuovi `backroomsInput.ts` e `backroomsDebug.ts`; contatore additivo in `src/network/PlayerInput.ts`. Test: `scripts/backrooms-selftest.ts`, nuovo `scripts/backrooms-fixes-selftest.ts`, wrapper build/regressione Backrooms, script browser Backrooms/rooms/lifecycle e nuovi audio/interactions/production-fixes. Prove e report in questa cartella. `dist/index.html` è aggiornato dal build locale per mantenere utilizzabile la versione compilata.

**Prova manuale necessaria.** Ascoltare neon/passi/cattura sulla TV reale e calibrare i volumi nel pannello globale; verificare controller e telefoni fisici, soprattutto tap più brevi dell’intervallo di polling e rete Wi-Fi; giocare con persone per valutare ricerca, latenza, difficoltà e tensione sonora. I mock e le misure del segnale non certificano comfort, paura, acustica degli altoparlanti o hardware reale.

Anteprima locale compilata: http://127.0.0.1:3001/ ; sorgente DEV: http://127.0.0.1:5174/ . Nessun commit, push, deploy o dipendenza nuova. `VERIFICATION.json` e i log conservano i risultati effettivi.
