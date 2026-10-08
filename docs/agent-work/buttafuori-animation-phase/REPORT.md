# Buttafuori — animazioni originali integrate

8 ottobre 2026. Il nuovo `detailed+character+3d+model (2).glb` sostituisce le pose provvisorie del Buttafuori con animazioni embedded. Resta una variante DEV/debug, con Legacy disponibile; nessuno swap definitivo o modifica del gameplay.

## Utilizzo

- Gallery: http://127.0.0.1:5174/?characters=1&buttafuori=new
- Aprire **BUTTAFUORI · ANIMATION LAB**: selettore clip, PLAY/LOOP, 0,25/0,5/1/2×, GAME STATE, confronto LEGACY/TRIPO, 1/2/5 istanze e diagnostica skeleton/attachment.
- Cornicione: http://127.0.0.1:5174/?fighter=1&buttafuori=new
- Partite DEV: `?buttafuori=new`; produzione: `?debug=1&buttafuori=new`. OLD/NEW resta indipendente da Goblin e Judoka.

## Nuovo asset, stesso personaggio

Sorgente: `C:/Users/niluf.PC-NIKO/Downloads/detailed+character+3d+model (2).glb`.
Copia byte per byte: `public/models/detailed-tripo/detailed_character_animated.glb`.
SHA256: `ae704f9d34958d3facd966b631155d1e4b02f41e9a7601b739a85d5aff49cd61`.

**19.348.092 byte, 31.399 triangoli, 28.141 vertici, 65 bones, 43 animazioni.** Ogni clip ha 195 canali su tutti i 65 joint. Le tre texture PBR 4096×4096, i buffer della geometria/pesi, le inverse bind matrix e le trasformazioni di bind dei joint sono identici al GLB precedente. Scala, orientamento e materiali restano quelli del pilota. Nessun retarget, compressione, LOD o modifica all'originale.

Confronto: [source-comparison.json](source-comparison.json). Inventario: [asset-analysis.json](asset-analysis.json), [CLIP-AUDIT.md](CLIP-AUDIT.md), [clip-audit.json](clip-audit.json).

## Collegamenti al gioco

Il profilo Buttafuori usa ora il sampler delle clip originali; `procedural:false`, `clips:43`, 195 canali campionati per istanza. Il vecchio backend provvisorio non viene usato dal nuovo profilo. Il GLB senza animazioni resta conservato nel repository come asset della prima fase.

Idle/run/jump/fall, dodge/dash, jab/hook/uppercut/heavy/frontKick/roundhouse, grab/judoThrow/block, reazioni/knockback/KO, pickup/throw/catch e victory/defeat sono collegati agli stati esistenti. **L'abilità focus del Buttafuori usa block** per la sola presentazione; effetti e durata dell'abilità restano originali.

Tutte le 43 clip sono disponibili in preview, incluse walk, cry, heart pose, boxing e animazioni sportive. Il manifest ha 44 nomi semantici perché **hitStomach è un alias esplicito di hitBodyB**: il file non contiene una clip dedicata allo stomaco. Le quattro clip SoccerCandidate restano candidate da esaminare in Gallery e non cambiano automaticamente i gesti di calcio/pallavolo.

Range/trim e candidati di contatto sono ricavati dalle keyframe/FK; il GLB non viene riscritto. Attacchi e reazioni seguono i tempi esistenti. I contatti sono marcati `contactVerified:false`: il controllo numerico non certifica il contatto artistico con il bersaglio.

Root motion orizzontale neutralizzata; hips Y neutralizzata in aria. La simulazione controlla la traiettoria. **Salto, doppio salto, discesa, atterraggio e mosse aeree mantengono la stessa mesh/materiale/skeleton Tripo.** Anche quando manca un gesto specifico il Buttafuori mantiene il nuovo corpo. Errori di importazione conservano il Legacy funzionante.

Arena, Cornicione, Dodgeball, FPS e risultati usano il nuovo profilo automaticamente. FPS conserva maschere del proprio corpo, arma/viewmodel e hitscan esistenti. Kart mantiene il driver Legacy; UI e giochi 2D non ricevono modifiche.

## Verifiche

- TypeScript: PASS. [typecheck.log](typecheck.log)
- Gallery/integration: PASS, tre asset contemporaneamente; tutte le 43 clip più l'alias previewabili con 65 bones/195 canali e joint finiti; cinque rig indipendenti/geometria condivisa; OLD/NEW; attacco Cornicione; due ritratti animati e disposal a zero. [integration.log](integration.log), [integration.json](integration.json)
- Salto/mosse: PASS, **86 campioni** con fisica invariata dal render, stessa skin in tutte le fasi del salto e nelle 14 mosse, jump/fall originali e vertici deformati finiti. [jump.log](jump.log), [jump.json](jump.json)
- Controller Buttafuori: **96 controlli PASS**, range, mappature, contatto nei timing originali, salto/caduta, block e alias. [controller.log](controller.log)
- Controller Goblin: **135 controlli PASS**. [goblin-regression.log](goblin-regression.log)
- Scene reali OLD/NEW: cinque personaggi in Cornicione/Arena/Dodgeball/FPS, mano/palla corretta e risorse rilasciate. [contexts.log](contexts.log), [hardware-context-performance.json](hardware-context-performance.json)
- Fallback su download fallito: PASS, Legacy ancora visibile e gestione hide/show funzionante. [fallback.log](fallback.log), [fallback.json](fallback.json)
- Regressione salto Judoka: **72 campioni PASS**, stessa skin anche in aria dopo l'aggiornamento del Buttafuori. [judoka-jump-regression.log](judoka-jump-regression.log)
- Build Vite/TypeScript: PASS, 4m23s; warning dei chunk grandi già presente. [build.log](build.log)
- Produzione: PASS, zero GLB/lab senza debug; opt-in debug importa 43 clip/65 bones, OLD/NEW funziona senza errori di pagina. [production.log](production.log), [production.json](production.json)

## Misure e limiti

Campioni brevi RTX 3050 / Chrome D3D11 / 1280×720, cinque personaggi, prima della build: intervalli medi NEW **18,61 ms Cornicione, 17,63 ms Arena, 18,12 ms Dodgeball, 16,66 ms FPS**, contro circa 16,69 ms OLD. CPU sampler per cinque istanze circa **0,53–0,68 ms**; 975 canali attivi. Sono campioni di 35 frame per contesto, non una certificazione di partita lunga o hardware mobile.

Geometria e texture hanno lo stesso costo della prima fase: cinque modelli valgono 156.995 triangoli, risorse condivise; texture stimate circa 256 MiB per scena con mipmap completa RGBA8. Le animazioni aggiungono dati di clip e lavoro di campionamento/skinning.

Corsa, salto e pose native risultano correttamente applicati nei campioni visivi esaminati. Restano da rifinire foot sliding, contatti delle mosse, eventuale clipping nelle pose estreme, dita/bottiglia/accessori integrati e presa dell'arma FPS. La sagoma più snella conserva gli hitbox precedenti: la corrispondenza visiva richiede revisione prima dello swap definitivo. Posa Kart e gesti sportivi approvati restano separati.

Screenshot: `C:/Users/niluf.PC-NIKO/Desktop/Ricchioni/e2e-shots/buttafuori-animations/`.
Nessun commit, push o deploy; lavoro fermato all'integrazione delle animazioni richiesta.
