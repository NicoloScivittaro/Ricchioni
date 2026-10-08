# Goblin Tripo — analisi preliminare e piano pilota

Stato: analisi statica completata; integrazione non avviata. Nessun file applicativo o asset originale modificato. Data: 8 ottobre 2026.

## Evidenza

Sorgente: `C:/Users/niluf.PC-NIKO/Downloads/green+goblin+3d+model.glb`.
Progetto effettivo: `C:/Users/niluf.PC-NIKO/Desktop/Ricchioni`.
La directory della task `Documents/ChatGPT/ricchioni` contiene soltanto `.git`, senza commit.
Baseline progetto: `e1c8ea75b8aad585a141685db7e7f2f81585f86f`; al controllo iniziale `git status --short` era vuoto.
Analisi riproducibile: `python docs/agent-work/goblin-tripo-pilot/analyze_glb.py`.
Dettagli e hash: `asset-analysis.json`.

| Voce | Esito statico |
| --- | --- |
| Formato | GLB glTF 2.0, generator Tripo; 6.108.164 byte; nessuna estensione dichiarata |
| Geometria | 1 mesh, 1 primitive TRIANGLES, 33.613 vertici, 35.624 triangoli |
| Scala locale | X 0,413536; Y 0,979631; Z 0,264652 unità, prima delle trasformazioni e della skin |
| Appoggio locale | Y minima circa zero; Y massima 0,979631 |
| Orientamento | Geometria sviluppata lungo Y; fronte nel gioco ancora da verificare, inclusa conversione glTF/Babylon |
| Rig | 1 skin, 65 joint con nomi `mixamorig:*`, 40 joint delle dita, 65 matrici inverse bind |
| Skin | JOINTS_0/WEIGHTS_0 presenti; nessun joint fuori intervallo, nessun peso negativo/non finito, nessun vertice senza pesi |
| Normalizzazione pesi | Errore massimo della somma rispetto a 1: 1,42e-7 |
| Integrità geometria | Nessun indice fuori intervallo e nessuna coordinata non finita |
| Deformazioni | Non verificate visivamente; integrità dei pesi non dimostra qualità della deformazione |
| Animazione | `run.001`, 195 canali su 65 nodi; translation/rotation/scale; intervallo 0,041667–1,291667 s, span circa 1,25 s |
| Materiale | 1 PBR, double-sided, metallic 0, roughness circa 0,9 |
| Texture | Base color JPEG embedded 4096×4096, 4.064.519 byte; nessuna normal/occlusion/metallic-roughness texture nel materiale |
| Viso | Nessun morph target; nomi Mixamo non dimostrano automaticamente compatibilità di retargeting |
| Performance | Nessuna misura runtime. Stima RGBA8: 64 MiB base, circa 85,33 MiB con mip chain completa, per texture residente; condivisione da verificare |

### Punto da verificare nell'animazione

Il nodo `mixamorig:Hips` nella trasformazione iniziale dichiara translation circa `(0,001913; 0,476422; 0,017220)` e una rotazione di circa −90° su Y. In `run.001` la translation delle anche è circa `(-0,023934; 0,406232–0,436447; 0,472064)`. Le componenti X/Z variano pochissimo durante la clip: non emerge un avanzamento orizzontale significativo, ma c'è uno scostamento dalla trasformazione iniziale. Questo dato richiede verifica della gerarchia completa, delle matrici bind e del risultato deformato nel loader; non è sufficiente per dichiarare un difetto o applicare una correzione.

## Contratto dell'integrazione

Un'unica fase end-to-end, con il Goblin procedurale predefinito e fallback durante caricamento o errore. Il modello Tripo è solo un'alternativa di render selezionabile in DEV. Copiare il GLB originale byte per byte nel percorso pubblico previsto dalla repository, confrontando l'hash. Nessuna compressione, riduzione della texture, LOD, modifica di gameplay, fisica, abilità, input, rete, collider o hitbox. Nessun commit, push o deploy.

Introdurre un adapter visuale sotto il root controllato dal gioco: selezione `old`/`new`, caricamento asincrono, aggiornamento da stato visuale esistente, visibilità e disposal. Il render non deve scrivere posizione, velocità o stato gameplay. Mesh importate senza collisioni/picking gameplay. Nel caricamento tardivo verificare che scena e proprietario siano ancora vivi. Condividere risorse per scena dove possibile, mantenendo skeleton e animazioni indipendenti per ogni giocatore; rilasciare risorse quando la scena termina.

Conservare il rig procedurale e le relative API per ancoraggi, FX e fallback. Evitare di ricostruire collider o derivare hitbox dal bounding box del GLB. Normalizzare altezza, appoggio e fronte tramite un parent visuale; preservare le trasformazioni interne del loader. Misurare in Babylon bounds in posa iniziale e durante la corsa, senza usare bounds animati per una scala variabile.

Selezionare esattamente `run.001`, senza autoplay al caricamento; riprodurla solo negli stati di locomozione, mantenendo il gioco responsabile dello spostamento. Per stati non coperti dalla clip, indicare esplicitamente la posa di fallback visuale e le animazioni ancora mancanti. Non presentare la sola bind pose come animazione idle definitiva.

### Punti d'integrazione identificati

- `src/minigames/characters/characterModel.ts`: rig procedurale comune, separato dalla fisica.
- `src/minigames/arena/arenaEntity.ts`: `ArenaEntity` costruisce il rig sotto `root`; numerose pose procedurali e ancoraggi dipendono dal rig esistente.
- `src/dev/characterGallery.ts`: galleria già presente con stati e hook `window.__gallery`; aggiungere OLD / NEW sullo stesso posto, mantenendo camera, luce, facing e tempo della posa comparabili. Nei due rig usare lo stesso stato semantico; una posa ossea identica richiederebbe una mappatura dedicata.
- `src/app/main.ts`: galleria già aperta con `?characters=1` se `debugEnabled()`; mantenere il vincolo DEV/debug esistente.
- `src/minigames/cornicione/BabylonCornicioneGame.ts`: verificare il punto di creazione degli entity e l'orientamento laterale prima dell'aggancio visuale.
- `src/minigames/kart-race/kartEntity.ts`: driver procedurale dedicato, non il rig completo di Arena; occorre una posa seduta visuale esplicita senza toccare kart e fisica.
- `src/minigames/fps/BabylonFpsGame.ts`: visuali body/head dedicate; preservare superfici usate dai raycast e nascondere soltanto la rappresentazione del proprio corpo nella viewport personale.
- `package.json`: Babylon core/gui 9.26.2 compatibili con range dichiarato; loader glTF non presente fra le dipendenze dirette. Aggiungere il loader della stessa versione effettivamente installata, senza aggiornare l'intero stack.

## Accettazione prevista

1. Import GLB riuscito con skin, materiale e texture originali; scelta NEW confermata da stato di caricamento osservabile.
2. OLD / NEW funzionanti nella galleria, stessa camera/luce/root e confronto statico/locomozione; screenshot fronte, lato, retro e più istanti della corsa.
3. Arena e Cornicione mostrano il modello selezionato, senza cambi ai moduli gameplay; test di collisioni, colpi e morte invariati.
4. Kart mostra Goblin seduto come driver con mani/gambe plausibili; registrare clipping o limiti residui.
5. FPS: avversari visibili in tutte le viewport pertinenti, corpo personale nascosto solo dove previsto e raycast/hitbox invariati.
6. Fallback su errore di asset, switch ripetuti OLD/NEW, uscita scena durante caricamento e più Goblin con clip indipendenti, senza risorse accumulate.
7. `npm run typecheck`, `npm run build`, test significativi sugli adapter/lifecycle e suite E2E esistenti pertinenti. Il test della galleria attuale è `node scripts/e2e/character-gallery.mjs`; adattarlo preservando gli assert sugli altri personaggi.
8. Performance OLD/NEW sullo stesso ambiente e numero di giocatori: tempo caricamento, frame time, FPS, draw call, mesh/skeleton/texture, metodo e limiti della GPU usata. Non estrapolare prestazioni hardware da SwiftShader.
9. Report finale per tutte le voci richieste, distinguendo prove riuscite, problemi e verifiche non eseguite. STOP dopo il pilot.

## Blocco del workflow e prossimo passo

La skill `C:/Users/niluf.PC-NIKO/.agents/skills/astra-flash-orchestrator/SKILL.md`, sezione 2, richiede: “Confirm the current ROOT is the user's selected GPT-6 Astra”. Il doctor ha restituito `root_model_observed: gpt-6.1-sol`, `status: static-ready`, `runtime_verified: false`, con route worker `deepseek/deepseek-v4.1-flash`, provider `DeepSeek API`, ruolo `astra_flash_builder` presente. Il controllo statico non verifica override della UI o inferenza.

Non è stato avviato un worker né eseguita un'inferenza di prova. Selezionare GPT-6 Astra per riprendere il workflow richiesto, oppure autorizzare espressamente l'esecuzione con il root attuale. Ripresa: verificare il root della sessione, assegnare a un solo `astra_flash_builder` questo contratto con proprietà di adapter, integrazioni visuali, loader, test e report; preservare questi documenti di pianificazione. Il worker deve leggere le istruzioni applicabili, non delegare ulteriormente e completare discovery, implementazione, test e QA. Revisione finale del diff e delle evidenze nel root, con un'unica richiesta aggregata di correzioni se necessaria.
