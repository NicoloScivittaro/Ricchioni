# Backrooms 2.0 — Nightmare Update

Integrati tutti e sei gli asset: Hazmat, Bacteria, Partygoer, Smiler, Original Backrooms e Backrooms(ish) Environment. Geometria condivisa, rig separati; file runtime complessivi circa 13,2 MiB contro 60,7 MiB originali. Sorgenti e crediti conservati.

Hazmat: gambe/braccia articolate, idle, corsa, interazione e breve reazione alla cattura; bande colorate e nome visibile soltanto vicino e con linea di vista. Partygoer e Smiler usano pose procedurali sui rispettivi rig. Bacteria usa i suoi pezzi separati (testa e braccia), senza fingere uno scheletro assente.

Bacteria indaga i rumori e cerca l'ultima posizione vista; Partygoer attira con palloncino e note, poi scatta per poco e recupera; Smiler preferisce il buio e arretra brevemente davanti alla torcia puntata, con resistenza di 10 secondi. Conservati i mostri precedenti. Due mostri iniziali; con 4–5 giocatori il terzo si attiva dopo 75 secondi. Sensi, memoria e catture rispettano gli ostacoli.

Labirinti sempre 17×17 / 21×21: stanze di dimensioni diverse, corridoi di servizio, bivi, stanze scure; connettività degli obiettivi verificata prima del round. Pareti modulari reali, moquette e carta da parati derivate dagli atlas originali, foschia e luci fluorescenti. Nessuna scena intera ripetuta per cella.

Torcia sul telefono e Y/△; A/✕ conserva interazioni e puzzle. Prima cattura: ritorno dopo 7 secondi con 7 secondi di immunità; seconda: eliminazione. Chiave, puzzle, fuga e punteggi conservati.

**Cinque visuali: 14,7 → 59,5 FPS** nel confronto breve a 1280×720 su RTX 3050, stesso seed 7, qualità alta e risoluzione fissa. p95 83,5 → 16,8 ms. Eliminata l'invalidazione dei materiali a ogni visuale, usando due SpotLight permanenti riposizionate per camera. Nessun abbassamento della risoluzione nel confronto.

Passati: caricamento e controllo visivo dei sei modelli, sei combinazioni dimensione/seed, sensi e memoria, esca, torcia, catture, chiave e puzzle, una partita sintetica completa, cinque pagine telefono via Socket.IO, mapping Xbox/DualSense simulato, consegna dei risultati per cinque giocatori e cleanup. Audio verificato sotto autoplay restrittivo: zero segnale prima di un vero clic, poi PCM misurato dopo il limiter per ambiente ed effetti.

Typecheck e build finale superati (`npm run build`: `tsc --noEmit && vite build`). Log in `build.log`.

Limiti: animazioni procedurali, non clip originali; gamepad e telefoni fisici non provati. Il benchmark è un campione breve, non una garanzia di 60 FPS in qualsiasi situazione. Nessun altro minigioco modificato da questo intervento; lavoro Minigolf precedente preservato. Nessun commit, push o deploy.
