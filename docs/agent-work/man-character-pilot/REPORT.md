# man.glb — Ciro Tripo, integrazione pilota

8 ottobre 2026. Il file `man+3d+model.glb` è associato a **Ciro**, come confermato esplicitamente dall'utente. Corretta la precedente associazione provvisoria al Dottore: il Dottore conserva il corpo originale. Nessuna sostituzione definitiva: Legacy resta il default e il fallback.

## Utilizzo

- Gallery: http://127.0.0.1:5174/?characters=1&ciro=new
- Quattro modelli insieme: http://127.0.0.1:5174/?characters=1&goblin=new&judoka=new&buttafuori=new&ciro=new
- Cornicione: http://127.0.0.1:5174/?fighter=1&ciro=new ; `window.__fighterLab.restart(5,'all-ciro')` crea cinque Ciro.
- Pulsanti **CIRO LEGACY / CIRO TRIPO** e pannello **CIRO · ANIMATION LAB**: tutte le clip, PLAY/LOOP, velocità, GAME STATE, confronto affiancato, 1/2/5 istanze e diagnostica skeleton/attachment.
- Le partite DEV leggono `?ciro=new`; in produzione serve anche `?debug=1`. UI/sessione e gli altri selettori mantengono il comportamento precedente.

## Audit dell'originale

Sorgente: `C:/Users/niluf.PC-NIKO/Downloads/man+3d+model.glb`.
Copia byte per byte: `public/models/man-tripo/man.glb`.
SHA256: `f4a5bd9c74526faa625902b0b43f3bccaebaf2ee0ae648e9d6fd73ade651abe5`.

| Proprietà | Valore |
|---|---|
| File | 17.863.428 byte |
| Mesh / materiale | 1 / 1 PBR |
| Vertici / triangoli | 29.981 / 34.334 |
| Skeleton | 65 ossa con nomi Mixamo, incluse 40 articolazioni delle dita |
| Animazioni | **46 clip**, ciascuna 195 canali su 65 joint |
| Texture | Base color JPEG, normal PNG, metallic/roughness PNG; tutte 4096×4096 |
| Morph facciali | 0 |
| Errori statici | Nessun indice invalido, peso negativo/non finito, vertice senza pesi o bind matrix non finita |
| Somma pesi | Errore massimo circa 1,34×10⁻⁷ |

Inventario completo: [asset-analysis.json](asset-analysis.json), [textures.json](textures.json), [CLIP-AUDIT.md](CLIP-AUDIT.md), [clip-audit.json](clip-audit.json). Nessuna compressione, riduzione texture, LOD o retarget da un altro personaggio.

## Scala, orientamento e animazioni

Altezza originale **0,97844** unità. Il renderer adatta uniformemente il modello all'altezza Legacy del Ciro: in Gallery **2,30820** unità, scala **2,35907**. FPS mantiene il proprio riferimento di 1,75. Pivot ai piedi, Y up, correzione yaw **0°**; confronto frontale e viste di gioco esaminati.

Ogni istanza ha skeleton indipendente e risorse della geometria/materiali/texture condivise per scena. Nessun autoplay: i gruppi sono dati campionati dal renderer sui nodi glTF collegati alle ossa. Tutte le 46 clip sono previewabili; il profilo non usa pose procedurali provvisorie.

Idle/run/jump/fall, dash/dodge, jab/hook/uppercut/heavy/frontKick/roundhouse, block/grab/judoThrow, reazioni, knockback/KO, pickup/throw/catch e victory/defeat sono collegati agli stati esistenti. È presente una **reazione dedicata allo stomaco**, quindi non serve un alias. Walk/wait/frightened/boxing e clip sportive aggiuntive restano disponibili nel lab. Le quattro SoccerCandidate non diventano automaticamente nuovi gesti di gioco.

Le animazioni leggono velocità e tempi delle azioni; la simulazione conserva posizione, traiettoria, collider, hitbox, danni, input e abilità. Root motion X/Z neutralizzata; hips Y neutralizzata in aria. Candidati di contatto e trim sono calcolati dalle keyframe/FK e richiedono revisione artistica (`contactVerified:false`).

Il Ciro mantiene lo stesso corpo Tripo durante salto, doppio salto, discesa, atterraggio e azioni aeree. Anche per un gesto senza corrispondenza specifica mantiene il nuovo corpo. Se il download fallisce resta il Legacy funzionante. Le presentazioni, gli effetti e i modificatori di dimensione esistenti restano gestiti dall'entità originale.

## Contesti e verifiche

- Gallery: Dottore ancora Legacy e nessun selettore Tripo per lui; quattro asset contemporaneamente; tutte le 46 preview, 65 bones/195 canali e joint finiti; cinque rig indipendenti con geometria condivisa; OLD/NEW. [integration.log](integration.log), [integration.json](integration.json)
- Prova Babylon dell'asset: tutte le 46 clip con vertici deformati finiti; tre mappe PBR originali pronte; mesh non pickable, nessun autoplay, contatori azzerati al disposal. [asset-render.log](asset-render.log), [asset-render.json](asset-render.json)
- Cornicione: **86 campioni PASS**, salto/doppio salto/discesa/atterraggio e tutte le 14 mosse mantengono mesh/materiali/skeleton nuovi; il render non modifica la fisica. Jump e fall originali, vertici deformati finiti. [jump.log](jump.log), [jump.json](jump.json)
- Scene reali: cinque Ciro OLD/NEW in Arena, Cornicione, Dodgeball e FPS. Pickup/throw/catch e palla/mano verificati, risorse rilasciate. [contexts.log](contexts.log), [hardware-context-performance.json](hardware-context-performance.json)
- Risultati: ritratti animati victory/defeat caricati dal GLB di Ciro (nessun caricamento accidentale del Goblin), atlas condivisa e disposal, nel test di integrazione.
- Controller Ciro: **98 controlli PASS**. [controller.log](controller.log)
- Regressione controller Goblin: **135 controlli PASS**. [goblin-regression.log](goblin-regression.log)
- Download fallito: PASS, corpo Legacy e hide/show ancora funzionanti senza modifiche allo stato fisico congelato. [fallback.log](fallback.log), [fallback.json](fallback.json)
- TypeScript: PASS. [typecheck.log](typecheck.log)
- Regressioni salto: **72 campioni Judoka / 86 Buttafuori PASS**, stessa skin durante salto e azioni aeree nella fase precedente; la correzione attuale verifica nuovamente i quattro asset insieme. [judoka-regression.log](judoka-regression.log), [buttafuori-regression.log](buttafuori-regression.log)
- Build Vite/TypeScript: PASS, con il warning dei chunk grandi già presente. [build.log](build.log)
- Produzione: PASS, nessun GLB/lab senza debug; opt-in debug importa 46 clip/65 bones, OLD/NEW funziona senza errori di pagina. [production.log](production.log), [production.json](production.json)

FPS importa il corpo visto dagli altri e conserva arma/viewmodel/hitscan e maschere del proprio corpo. Calcio/Volley condividono il renderer, ma i gesti sportivi non sono stati approvati o validati come animazioni specifiche. Kart conserva il driver Legacy. Giochi UI/2D non modificati.

## Performance e limiti visivi

Campioni brevi prima della build, RTX 3050 / Chrome D3D11 / 1280×720, cinque personaggi:

| Scena | Intervallo frame OLD / NEW | Draw call OLD / NEW | CPU sampler NEW, cinque istanze |
|---|---|---|---|
| Cornicione | 16,68 / 20,60 ms | 277 / 67 | 0,68 ms |
| Arena | 16,68 / 16,73 ms | 272 / 62 | 0,47 ms |
| Dodgeball | 17,16 / 17,63 ms | 301 / 91 | 0,59 ms |
| FPS | 16,68 / 16,68 ms | 215 / 165 | 0,54 ms |

35 campioni per contesto; non sono una certificazione di partita lunga o di hardware mobile. Cinque istanze valgono 171.670 triangoli, 325 ossa e 975 canali attivi; viewport multiple possono ridisegnare la geometria. Tre texture RGBA8 4K valgono una stima teorica di **192 MiB senza mipmap / 256 MiB con mipmap completa per scena**, condivise fra le istanze: non è memoria driver misurata.

Camicia, capelli, barba, abiti e accessori risultano importati nei campioni esaminati; corsa e salto originali deformano il nuovo corpo senza esplosioni osservate. La sagoma è più snella del Legacy a hitbox invariata. Restano da rifinire corrispondenza visiva dei colpi, foot sliding, clipping nelle pose estreme, dita/accessori, posa arma FPS e posa Kart. Colori originali preservati; non c'è ricolorazione delle texture per squadra o animazione facciale.

Prima dello swap definitivo servono revisione artistica dei contatti/gesti mancanti e prove più lunghe su hardware meno potente. File originale preservato; nessuna ottimizzazione applicata prima della visione nel gioco.

Screenshot: `C:/Users/niluf.PC-NIKO/Desktop/Ricchioni/e2e-shots/man-character/`.
Nessun commit, push o deploy. Implementazione con il root attuale come già autorizzato nella sessione.
