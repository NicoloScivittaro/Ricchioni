# Checkpoint — 12 ottobre 2026

Baseline `91c5e96`, repo `C:/Users/niluf.PC-NIKO/Desktop/Ricchioni`. Root autorizzato senza Flash; nessun worker usato, nessun push/deploy.

M1/M2/M3 completate: camera bassa dietro pallina, orbit/panoramica, un solo corso, turni 6 s, tutte le palline fisiche, scambio equo, timeout +1 senza impulso, 5/6 colpi, classifica tempo attivo, HUD/Companion/5 abilità/bot. Rampa ponte corretta perché ingresso prima non raggiungibile; scena originale con palme e prato procedurale. Fisica comune mantenuta a 120 Hz.

M4: typecheck e prima build passano. Dieci suite in selftests.json passano. Full browser passa (browser.json): Xbox/PS/generic, CONTROLLI, touch, pause/reload, sei piste, 4 TV risoluzioni, 3 telefoni e Companion, rampa reale, bocciata/rimbalzo veri, 30/60/120 simulati nel browser. Quattro partite naturali 2/3/4/5p in natural-rounds.json, punteggio globale e lobby. Audit minigolf/quiz/fps/cornicione 12 viste telefono passa. Sei cicli risorse (2 warmup, 3 misure + podio), crescita host 0.4 MB, telefono stabile, nessun residuo.

Produzione prima build: una pista con 1 telefono+4 bot, naturale, originale GLB, risultati completi. Dopo ispezione screenshot vicino muro: aumentato rialzo locale camera da 2.2 a 3.4 m per lasciare pallina sopra HUD. Typecheck finale e camera selftest passano (181 casi). Test mirato camera-wall con cinque partecipanti e quattro direzioni passa; screenshot finale ispezionato.

M4 completata: build finale emette BabylonMinigolfGame-CIcVCMz3.js con correzione3.4 m; smoke compilato passa in81.432 s dalla prima disponibilità del telefono, cinque posizioni, punteggio globale con PUNTI DOPPI, asset200, zero errori. Screenshot produzione finali ispezionati. REPORT.md e FINAL-VERIFICATION.json raccolgono prove e limiti: pad simulati, nessun playtest umano/hardware/Wi-Fi, rialzo locale al muro, nessun riferimento visivo allegato, warning bundle preesistente. Ripristino del solo dist/index.html dopo QA secondo guida progetto; commit locale separato autorizzato. Preview Vite5174 disponibile; nessun push/deploy.
