# Ribaltati 2.0
Baseline pulita: 8d644d9. Richiesta del 19 ottobre 2026: upgrade, senza riscrittura, Flash, dipendenze nuove, commit, push o deploy. Esecuzione diretta.

## Analisi prima delle modifiche al gioco
- kart-race/track.ts: Catmull-Rom chiusa, 17 punti, 738,37 m, larghezza 10–20 m, quota massima circa 2,6 m; tre giri, otto checkpoint. Strada e barriere sono ribbon, scenario a quattro quartieri con thin instances.
- race.ts: la gara finisce ai tre giri (12 s di grazia dal primo arrivo), oppure al limite di 170 s. Per questo aumentare il timer da solo non allunga la gara. 24 simulazioni con piloti imperfetti: medie 58,83 / 56,07 / 55,15 s per principiante/medio/esperto, tutti completano.
- kartPhysics.ts: fisica arcade relativa alla spline con imbardata assoluta, drift a tre livelli, boost, retromarcia, barriere e respawn. Il salto esiste già per gli item; mantenere input e numeri di guida.
- items.ts + abilities.ts: 13 item e cinque abilità; preservare sistema, aderenza dell’olio, collisioni e recuperi. MotionBots usa gli stessi input.
- cameraHud.ts: inseguimento/split 1–5 visuali, minimappa e HUD per camera. Camera ancora a quota del terreno e non del salto.
- kartEntity.ts: cinque skin/rig originali, ruote, scintille, fumo, boost e audio esistenti.
- BabylonKartGame.ts: fisica a 120 Hz ma anche rig/HUD/camera vengono aggiornati per ogni sottopasso. Separare presentazione per risparmiare CPU senza cambiare fisica.
- Baseline Chrome GPU, cinque telefoni/visuali, 1280×720, scaling fisso 1, ombre attive: 28,47 FPS, render 31,53 ms, step 2,68 ms, 1106 draw call.

## Intervento
1. Espandere e ridisegnare il percorso mantenendo lungomare, paese, porto e commerciale. Due viadotti a quota circa 12 m, curve/S tecniche e carreggiate differenziate; stessi tre giri. Obiettivo circa 100–120 s per i piloti simulati; limite 230 s per recuperi.
2. Rampe con salti usando jumpHeight/jumpVelocity esistenti, porto scivoloso breve, gru/ostacolo mobile schivabile, biforcazione entro la carreggiata (corsia larga sicura / corsia turbo stretta) delimitata da isola visibile. Nessun salto cieco o buco obbligatorio.
3. Nuova pavimentazione, bordi/deck/pilastri, segnaletica, scenografia del nuovo spazio. Materiali riutilizzati, mesh statiche raggruppate, dettagli ripetuti in thin instances, effetti limitati.
4. Camera che legge rilievo/salto e HUD con settore/tempo, feedback audio di decollo/atterraggio coerente; mantenere controller e personaggi.
5. Pure test di geometria/completabilità/dinamiche, confronto durata e FPS prima/dopo; regressioni kart + Geofall/Backrooms/Minigolf, browser 2–5, bot, input/pad simulato, pausa/rejoin/fallback, pulizia, typecheck/build. Distinguere prove simulate da dispositivi fisici.

Rischi: curvature troppo strette, decorazioni sulla strada, camera sotto un dosso, deriva della superficie durante il salto, troppo lavoro per cinque viewport. Verificare e correggere con misure prima dell’accettazione.

## Completato
Implementazione, due lenti di revisione (specifica e qualità), correzioni di collisione/resa, simulazioni, browser, build finale e smoke compilato completati. Misure definitive e limiti in REPORT.md. Nessun commit/push/deploy.
