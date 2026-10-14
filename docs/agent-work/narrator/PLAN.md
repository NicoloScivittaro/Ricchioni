# Il Narratore Bastardo — contratto

Sol diretto, autorizzazione persistente utente. Baseline HEAD `defcb4d`; modifiche rullo già presenti e da preservare fuori dal commit narratore: shared/roulette.ts, docs/PARTY_GAME_PER_CHATGPT.md, scripts/roulette-cycle-selftest.ts, scripts/roulette-network-selftest.ts, docs/agent-work/roulette-cycle/. Nessun push/deploy, nessun TTS cloud, nessuna chiave API personale o servizio a pagamento.

## Scopo e fasi

1. Prototipo3 clip Kokoro ONNX italiano maschile locale e verifica browser/qualità tecnica. Modello/voices solo in cache locale, distribuzione soltanto dei file vocali compressi. Licenze MIT runtime, Apache2 modello (fonti upstream).
2. Catalogo134 battute:25 rullo,25 risultati,50 personaggi(10 ciascuno),34 annunci(2 per17 giochi esistenti). Testo esatto, sottotitolo, condizioni, priorità/peso/cooldown, prosodia, asset/durata reali in manifest. Non fingere una voce recitata professionale: eventuali limiti di accento/espressività dichiarati.
3. Selettore puro basato su risultati autoritativi: piazzamenti, ex aequo, prima/dopo punti globali, streak reali; bot distinti; nessuna interpretazione inventata delle stats libere. Anti-ripetizione recente e cooldown, una battuta risultati per round, eventi deduplicati per stanza/round/tipo, scadenze e nessuna coda oltre il cambio fase.
4. Host soltanto, un AudioContext/AudioManager, bus voice e volume dedicato narratore sotto master/muto, ducking musica rilasciato su stop/error/fine. Cache audio progressiva limitata. Sottotitoli DOM max2 righe, sincronizzati alla riproduzione, posizione diversa risultati/rullo. Toggle/volume/sottotitoli/frequenza nel pannello V. Salto parlato con Spazio senza bloccare il flusso già gestito dal gioco.
5. Eventi scene: RollerStarted dopo avvio rullo; GameSelected al reveal reale, voce può finire nell'intro ma viene fermata ai controlli/PLAYING; ResultsShown dopo ultima riga visibile, consentita fino a leaderboard. Rullo7s/intro2,6s/risultati e regole/networking/ScoreManager invariati. Lobby reset, pause/cancel, ascoltatori installati una volta.
6. Test logica/mixer/asset, browser partita naturale e round successivo, volume/ducking/skip/errore/offline/phone senza audio/pause/lobby/subtitoli, regressioni/typecheck/build, report italiano e commit locale dedicato che esclude modifiche rullo preesistenti.

Voce: verificare la disponibilità concreta. Kokoro runtime eFFmpeg già installati; modelli da reperire localmente oppure scaricare da release ufficiale gratuita. Nessuna inferenza online durante le partite.
