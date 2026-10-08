# Goblin Mbriacone — rapporto finale del pilota

**Pilota integrato e accettato dopo revisione e correzioni. STOP al pilota.**
8 ottobre 2026. Progetto: `C:/Users/niluf.PC-NIKO/Desktop/Ricchioni`.
Baseline: `e1c8ea75b8aad585a141685db7e7f2f81585f86f`.
Questo documento sostituisce le conclusioni e le misure del precedente PILOT-REPORT.md.

Il procedurale resta default e fallback. Tripo è un'alternativa di render DEV/debug. Gameplay, fisica, collider, hitbox, abilità, rete e input non modificati. Nessun commit, push o deploy.

## Prova locale

- `http://localhost:5173/?characters=1`: pulsanti **GOBLIN OLD / GOBLIN NEW**. La scelta manuale prevale su entrambe le query esplicite.
- `http://localhost:5173/?characters=1&goblin=new`: galleria su NEW.
- `http://localhost:5173/?goblin=new`: minigiochi su NEW. La selezione della galleria persiste nei cambi scena del tab; una query esplicita prevale sulla sessione al ricaricamento della pagina.
- In produzione normale resta OLD; per il pilota su una build aggiungere `debug=1`, come per i laboratori esistenti.

Vite/server lasciati disponibili su 5173/3001. Se terminati, avviare `npm run dev` nel progetto.

## Esito per voce richiesta

| Voce | Risultato e limite |
| --- | --- |
| Scala | Bounds locali 0,413536 × 0,979631 × 0,264652. Altezza Arena **2,323** unità, normalizzata al rig esistente in bind pose. FPS 1,75; Kart statura di riferimento 1,35 prima della seduta. Nessuna scala variabile in corsa. |
| Orientamento | Dopo conversione glTF/Babylon guarda nella direzione del procedurale, yaw aggiuntivo 0°. Verificate viste fronte/lato/retro; appoggio e centro corretti solo nel parent visuale. |
| Rig | 65 joint Mixamo, 40 joint dita, una skin, 65 inverse-bind matrices. Indici e pesi validi staticamente. Nomi Mixamo non certificano da soli il retargeting universale. |
| Deformazioni | Nessuna esplosione della skin nelle pose fotografate e nei campioni della corsa; nessuna scansione esaustiva di ogni frame. Seduta scritta sui nodi glTF collegati, quindi persistente dopo sincronizzazione dello skeleton. |
| Animazione | Esatta `run.001`, circa 1,25 s, attiva in locomozione. Idle/salto/colpo/stun/abilità/esultanze mostrano un fotogramma fermo della corsa: **pose provvisorie**, non clip definitive. Nessun morph facciale. |
| Texture | Base color JPEG originale 4096², 1 materiale PBR, metallic 0, roughness circa 0,9, double-sided. Nessuna normal/occlusion/metallic-roughness texture nel materiale. |
| Performance | Misure software sotto; geometria/materiale/texture condivisi per scena, skeleton e clip indipendenti per Goblin. Il procedurale nascosto resta costruito per fallback e ancoraggi. |
| Problemi visivi | Corsa inclinata circa 36°, pose mancanti, arma FPS procedurale senza aggancio alle mani; compenetrazioni del cockpit Kart da rifinire. Colore identificativo del corpo differente dal procedurale. |
| Prima della sostituzione | Clip dedicate/retargeting, revisione export corsa, mani/arma/volante e clipping, leggibilità giocatori, test su GPU reale con più giocatori. |

Il GLB pubblico è byte-identico all'originale: **6.108.164 byte**, SHA256 `e993184137ca316e8730957cba75decb2410b3640b48394661f91b0e1987293f`, verificato anche nella revisione. Nessun LOD, compressione o riduzione della texture. Loader 9.26.2 caricato dinamicamente; core/gui non aggiornati.

## Offset della corsa

La clip mantiene X/Z delle anche circa `(-0,0239; …; 0,47206)` contro il riposo `(0,0019; 0,4764; 0,0172)`: offset `(-0,0258; 0; +0,4548)`, circa **1,08 unità Arena**. L'adapter sottrae l'offset medio nella copia privata per istanza della traccia, prima dell'avvio; l'oscillazione Y resta. Runtime verificato: Z torna circa 0,0172. GLB/container condiviso intatti; inclinazione originale conservata.

## Contesti e verifiche

| Contesto | Prova |
| --- | --- |
| Gallery | OLD/NEW da entrambe le query, fronte/lato/retro/closeup e quattro campioni corsa, fallback, switch senza accumuli, tre Goblin con skeleton/clip e fasi indipendenti ma geometria importata condivisa. |
| Arena | Partita reale host e due controller telefono, NEW presente; rig procedurale mantenuto per ancoraggi/FX/targhetta/fallback. |
| Cornicione | Gioco reale nel fighter lab con bot, OLD/NEW. Core di combattimento intatto. |
| Kart | Partita reale; seduta senza clip attiva, bacino ancorato al sedile. **11 articolazioni**, deriva zero dopo più frame; ginocchia/mani davanti, piedi sotto, testa sopra il bacino. Chase e viste laboratorio frontale/laterale/tre quarti salvate. Cockpit nasconde parte del corpo; clipping ancora possibile. |
| FPS | Split-screen a due: proprio corpo escluso dalla propria camera, visibile all'altra, layer mask preservate. Input simulato: velocità clip **0 → 2,33 → 0**, frame cambia muovendosi e resta 52,5 da fermo. Hitscan/hitbox AABB restano in FpsScene. |

Stessa camera, luce, root, facing e stato semantico per il confronto. **Pose ossee identiche non disponibili**: NEW ha una sola clip, OLD pose procedurali diverse. Acquisizioni separate non dimostrano sincronizzazione perfetta osso-per-osso.

| Verifica | Esito finale |
| --- | --- |
| `npm run typecheck` dopo correzioni | Exit 0, osservato dal root. |
| `npm run build` dopo correzioni | Exit 0, **7m16s**; `evidence/review-build.log`. Warning chunk grandi; adapter 12,89 kB / 4,67 kB gzip. |
| Test pilot/gallery dopo correzioni | **57 assert**, exit 0; `evidence/review-gallery.log`. |
| FPS dopo correzioni | **12 assert**, exit 0; `evidence/review-fps.log`. |
| Kart dopo correzioni | **9 assert**, exit 0; `evidence/review-kart.log`. |
| Galleria preesistente 1366×768 / 1920×1080 | Passata nel primo giro; `evidence/e2e-character-gallery.log`. Non integralmente ripetuta dopo le correzioni, coperte dalla regressione pilot finale. |
| Arena / Cornicione | Primo giro passato: `evidence/e2e-flow-arena.log`, `evidence/e2e-flow-lab.log`. Non ripetuto dopo correzioni; adapter comune riverificato in galleria. |

Disposal: guard prima del load, cleanup container se arriva dopo smontaggio, cleanup costruzione parziale, skeleton/clip obbligatori, visibilità richiesta conservata durante il load. Nel test finale il guard abortisce con **zero istanze vive**. Il ramo container risolto dopo morte scena è revisionato ma non attraversato dal campione finale (late-disposal 0).

Screenshot in `e2e-shots/goblin/`, inclusi `new-idle-*`, `new-run-*`, `cornicione-*`, `arena-new`, `kart3d-new`, `kart-lab-*`, `impact-fps-*`, `fps-new*`, `buttons-from-*`, fallback e multi-Goblin. Esaminati dal worker; root ha controllato anche lato gallery, Kart e FPS. Altri giochi che condividono ArenaEntity ricevono l'adapter, senza nuova QA visuale specifica.

## Performance: unico campione finale

Fonte canonica **`evidence/review-perf.json`**, script `review-perf.mjs`, dopo build; 1600×900, cinque personaggi di cui uno Goblin, IDLE, pagine separate. Renderer dichiarato **ANGLE/Vulkan SwiftShader**, software. Attesa di 5 s da ready. Frame time della finestra gallery può includere avvio/load; draw call per frame osservate tramite SceneInstrumentation. Il contatore grezzo dell'hook DEV è cumulativo e non è una misura per frame.

| Voce | OLD | NEW |
| --- | ---: | ---: |
| FPS campione | 6,05 | 3,78 |
| Frame medio finestra (ms) | 161,71 | 245,06 |
| P95 finestra (ms, include avvio) | 305,0 | 985,1 |
| Draw call/frame | 144 | 118,92 |
| Frame campionati draw call | 32 | 24 |
| Mesh / materiali / texture | 160 / 67 / 18 | 162 / 68 / 21 |
| Skeleton / gruppi animazione | 0 / 0 | 1 / 1 |

Load GLB del campione: **3486,9 ms**. Meno draw call non implica più velocità: la mesh ha molti più triangoli. Causa dominante del rallentamento **non determinata**. Non estrapolare prestazioni GPU hardware. Stima RGBA8 base color: 64 MiB, circa 85,3 MiB con mip complete, condivisa per scena; non è una misura VRAM. Prova GPU reale e cinque giocatori Arena/Kart ancora necessaria.

## Stato finale

Diff sorgente confinato a render e DEV; shared/server/gameplay/abilità/physics intatti. Installazione/build hanno aggiornato anche file generati tracciati node_modules/dist e screenshot.

Il worker Flash ha scritto il pilota e le correzioni; durante il secondo giro DeepSeek ha restituito **402 / credito esaurito**. Nessuna ricarica, cambio provider o paid probe. Root ha revisionato il codice già scritto, completato le verifiche locali e questo report. Route verificata staticamente e provider raggiunto (402); telemetria indipendente completa delle inferenze riuscite non disponibile.

**Accettato come pilota con i limiti dichiarati.** Nessuna prosecuzione automatica con clip nuove, LOD, compressione, sostituzione definitiva o deploy.
