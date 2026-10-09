# Checkpoint — prova con amici

- Repo effettivo: `C:/Users/niluf.PC-NIKO/Desktop/Ricchioni`; cwd del task Documents/ChatGPT non contiene il gioco.
- Utente: passata stabile prima della prova, nomi BOSCHI/Carbo, sistemare il possibile. Root senza Flash già autorizzato; nessun nuovo worker, commit/push/deploy.
- Tutti gli ID e le integrazioni preesistenti preservati. Nuovi modelli predefiniti in Arena/Cornicione/Dodgeball/FPS; scelte OLD/fallback disponibili; sport/Kart collaudati Legacy.
- Fix di questa fase: nomi, QR LAN/porta reale e risposta vecchia ignorata, creazione successiva stanza, input focus/offline, layout Dpad Cornicione e FPS landscape; avvio locale.
- PASS: server 68; selftest; tre room consecutive; tutti 11 giochi con 3 controller, pause/reconnect/cleanup, Riflessi naturale, finale120 e restart; 33 layout (6 corretti riprovati); FPS fire blur/hidden; fallback; TypeScript; build finale (3m27s).
- Produzione PASS: UI normale senza DEV, stanza LAN, tre controller, tre GLB originali con HTTP 200, Arena conclusa naturalmente; quattro modelli in Gallery e OLD/NEW corretti, nessun errore pagina. Screenshot stanza/Arena controllati a vista. Log `production.log`, dati `production.json`. Sessioni build/test completate.
- Server3001 e Vite5174 preesistenti lasciati attivi. Launcher verificato con `node scripts/start-party.mjs --check`; IP attuale192.168.1.79. Mostrare AVVIA-PARTITA.cmd e istruzioni COME-GIOCARE.md al termine.
- Audit release completato: report aggiornato, screenshot verificati, `git diff --check` PASS. Avvio pronto con AVVIA-PARTITA.cmd. Restano i tre controlli sui telefoni fisici e sul Wi-Fi descritti in COME-GIOCARE.md.
- Richiesta successiva completata: Quiz sul telefono (`PHONE_TEXT`) anche con gamepad associati; profilo pad Quiz rimosso, istruzioni aggiornate, layout telefono adattato. TV e regole conservate. Test tre telefoni + due gamepad simulati PASS (abilità private, risposta, pausa, domanda successiva); selftest Quiz/pad PASS.
- Ultima build PASS (3m52s), `build-quiz-phone.log`; produzione normale con tre telefoni e risposte confermate dall'host PASS, `quiz-phone-production.log/json`. Screenshot controllati. Nessun commit/push/deploy. Per pagine già aperte ricaricare PC/telefoni.
