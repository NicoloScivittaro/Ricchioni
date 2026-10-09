# Ciro — nuove animazioni, 9 ottobre 2026

Sorgente: `C:/Users/niluf.PC-NIKO/Downloads/man+3d+model (1).glb`. Copia originale non compressa: `public/models/man-tripo/man_animated.glb`. Il precedente `man.glb` è conservato. SHA256 della nuova copia: `4a00b680701e36e25507305d53332837337101a850095e5e6e026fb0f0e76743`.

## Asset e associazione

**Ciro, non Dottore**: 59 clip (46 preesistenti + 13 aggiunte), 65 bones Mixamo, 195 canali per clip, 29.981 vertici e 34.334 triangoli. File 18.829.088 byte, incremento di 965.660 byte. Geometria, attributi skin, matrici di bind, ossa e tre texture 4K identici al file precedente. Le 46 animazioni precedenti hanno gli stessi dati di keyframe: conservati nomi semantici, trim, contatti e durate; aggiornati gli indici spostati dalle nuove clip.

Scala, pivot ai piedi e orientamento restano quelli di Ciro già verificati. Nessuna compressione, LOD o retarget. Rig e mesh originali rimangono attivi durante salti e azioni aeree. Il fallback procedurale rimane disponibile su errore o scelta OLD.

## Nuovi gesti

Tutte le 59 clip sono disponibili in **CIRO · ANIMATION LAB** della Character Gallery. In Casa Carbo Ciro usa:

- `bucketWalk`: movimento con acqua nel secchio;
- `scoopB`: raccolta, in loop mentre il comando è attivo;
- `squeegee`: tiracqua, in loop;
- `floodBlock`: contenimento alla porta;
- `bucketEmpty`: svuotamento, avviato dall'evento effettivo di scarico;
- `fallBackward` e `getUp`: caduta e rialzata. Questa caduta termina a terra e si raccorda con la rialzata; l'altra clip `slip` si rialza da sola e resta un'alternativa nel lab.

Le altre sei clip aggiunte sono previewabili: `scoopA`, `floodBarrier`, `interactionA`, `interactionB`, `floodLoop`, `slip`. I due nomi di interazione e quello di loop sono volutamente neutri perché il nome originale nel GLB è troncato e non identifica un'azione precisa. La costruzione della barriera non diventa una nuova abilità di Ciro.

Gli override sono esclusivamente grafici: i loop non ripartono a ogni frame, la durata della caduta segue gli 0,6 s della scivolata già esistente, la rialzata e lo svuotamento non bloccano movimento/input. Nel finale l'override viene tolto e tornano victory/defeat. Il secchio segue la mano destra del Ciro importato, con limite visivo al pavimento. Nessuna modifica a acqua, simulazione, collider, hitbox, danni, input, abilità, punteggi o agli altri personaggi.

## Verifiche

- Audit statico: 46 clip precedenti identiche; asset preservato byte per byte.
- Babylon: **59 clip × 5 pose**, vertici deformati finiti, 65 bones/195 track, tre texture 4K pronte, nessun autoplay, disposal completo.
- Gallery: quattro personaggi corretti, tutte le 59 preview, OLD/NEW, cinque Ciro con rig indipendenti/geometria condivisa, ritratti victory/defeat e risorse rilasciate.
- Cornicione: **86 campioni**, salto/doppio salto/discesa/atterraggio e tutte le 14 mosse, stessa skin/mesh/materiali/skeleton, fisica immutata.
- Casa Carbo: nuovi gesti, avanzamento dei loop, bucket a pavimento, stessa skin, stato dei giocatori e acqua immutati, Carbo invariato, ripristino victory, disposal.
- Arena, Cornicione, Dodgeball e FPS: cinque Ciro OLD/NEW, pickup/throw/catch e palla ancorata alla mano, nessun errore pagina, contatori azzerati a fine scena.
- Download fallito: fallback Legacy e hide/show funzionanti senza scritture alla fisica.
- Selftest: Ciro **111**, selettore Casa Carbo **32**, Goblin **135**, simulatore Casa Carbo **102/102**, tutti PASS.
- TypeScript e build di produzione PASS (3m35s). SHA256 source/public/dist identici.
- Produzione normale senza DEV: Casa Carbo con Ciro/Carbo e nuovo GLB predefinito HTTP 200; Gallery con 59 clip/65 bones, OLD/NEW funzionante, nessun errore pagina. Screenshot di produzione controllato a vista. `git diff --check` PASS.

Evidenze nella stessa cartella: `comparison.json`, `asset-analysis.json`, `asset-render.json/log`, `integration.json/log`, `jump.json/log`, `casacarbo.json/log`, `fallback.json/log`, `production.json/log`, `build.log`, selftest, `hardware-context-performance.json` e screenshot in `shots/`.

## Performance e rifiniture

RTX 3050, Chrome D3D11, 1280×720, cinque Ciro, 35–36 campioni per scena:

| Scena | Frame OLD / NEW (ms) | Draw call OLD / NEW | CPU sampler NEW (ms) |
|---|---|---|---|
| Cornicione | 16,68 / 19,46 | 277 / 67 | 0,72 |
| Arena | 16,68 / 17,17 | 272 / 62 | 0,48 |
| Dodgeball | 16,68 / 18,09 | 301 / 91 | 0,61 |
| FPS | 16,71 / 16,68 | 215 / 165 | 0,50 |

OLD indica il procedurale, NEW il GLB aggiornato; sono campioni brevi, non una prova di partita lunga. Triangoli e texture restano gli stessi: le nuove clip aggiungono dati animati, non un secondo corpo. Le tre mappe originali 4K mantengono il costo precedente.

Restano rifiniture artistiche: loop generati, contatti secchio/dita/tiracqua e raccordi rapidi delle cadute. Le sei alternative non vengono forzate su gesti diversi. Calcio/Volley e Kart conservano le scelte collaudate della fase precedente. Dottore originale. Nessun commit, push o deploy.
