# Terminal — conversione geometrica, fase 1

**Prodotto `terminal.glb`, parziale, 114 MB.** È la geometria originale ricomposta; nessuna mappa sostitutiva o serie di cubi. Sparatoria non è stata modificata.

## Geometria recuperata

- **820.606 triangoli unici; 1.985.376 nella scena contando le istanze.** Inclusi aeroporto, interni, corridoi, scale mobili, esterni e aerei.
- **127 prefab utilizzati**, in **884 istanze**, con composizione di posizione, pitch/yaw/roll e scala. Tutti i 106 prefab direttamente referenziati dal file principale sono disponibili; la ricorsione aggiunge i prefab annidati. Lo ZIP ne contiene 128: `prefabs/misc_models/me_electricbox2.map` non è referenziato e non è stato aggiunto arbitrariamente. [Elenco completo](prefabs.csv), [trasformazioni](prefab-instances.json).
- **201 XModel diversi**, per **2.618 istanze**. Letti XModel/XModelSurf binari CoD4 **v25**, usando LOD0; nessun ripiego su LOD inferiori. I relativi XModelParts sono presenti. Conservati materiali e ordine delle superfici. [Modelli recuperati](models.json).
- **318 materiali e 534 immagini incorporate**. Associazioni lette dai riferimenti binari dei materiali; texture IWI convertite in PNG. Il numero delle immagini incorporate include canali colore, normal e specular.

## Pipeline verificata

Il parser standard di [RadiantMapToWavefrontObj](https://github.com/CptWesley/RadiantMapToWavefrontObj) **rifiuta questo specifico campione `iwmap 4`** con `Expected one of EOF but found 'i'`; la sua grammatica non gestisce i costrutti `mesh`/`curve` qui usati. [Prova eseguita](radiant-compatibility.log).

Prima dell’esportazione completa sono stati provati un brush reale, una mesh, una curva e `727_coach_seat01` con la sua texture. [Risultato del campione](probe.json). La pipeline dedicata ricostruisce brush convessi dai piani, mantiene le mesh e tessella le curve quadratiche; decodifica gli asset secondo i layout dell’importatore [cod-asset-importer](https://github.com/mauserzjeh/cod-asset-importer). [Script e riproduzione](../../../tools/terminal/README.md).

Assi convertiti da Z-up a **Y-up destrorso**, scala **0,0254 m/unità**; ricentrata soltanto l’origine orizzontale. Nessuna modifica delle distanze relative.

## Risorse mancanti e limiti

- **128 tipi di XModel, pari a 1.083 istanze**, senza il file corrispondente in `raw/xmodel`. Tra gli altri: `ap_food_cart`, `ap_couch01`, `ap_luggage01`–`04`, `ap_airbus_seat_1`, diversi monitor, tubi e arredi. Gli oggetti mancanti sono omessi, senza sostituti. Il modello `me_lightfluohang_double_on` non è stato usato per fingere di recuperare il diverso `me_lightfluohang`.
- **94 materiali assenti**: la geometria resta presente con un materiale neutro esplicitamente marcato.
- **133 immagini IWI referenziate dai materiali disponibili sono assenti** anche dall’IWD incluso nel RAR. Le dipendenze delle texture dei 94 materiali mancanti non possono essere ricostruite dai soli nomi.
- **Brush 3021**, `mp_mw2_terminal.map`, riga **37654**: nove piani senza un volume convesso possibile, confermato anche con intersezioni indipendenti. È omesso e registrato; non è stata inventata una forma sostitutiva. [Controllo](invalid-brush-check.json).
- Caulk, clip, trigger, portal, sky e superfici con techset `shadowcaster` sono elementi tecnici originali esclusi dalla geometria visiva. Detail shader, illuminazione precalcolata ed effetti specifici del motore CoD non hanno una corrispondenza esatta nel PBR glTF. I `.ff` compilati non sono stati decompilati da questa pipeline dei sorgenti.

**Nomi completi e riferimenti alle istanze:** [inventario CSV](missing-assets.csv), [modelli](missing-models.json), [materiali](missing-materials.json), [texture](missing-textures.json), [errore geometrico](geometry-failures.json).

## Test realmente eseguiti

Struttura GLB, coordinate finite, indici, normali, scala/assi, rotazioni e posizioni esportate. Misura indipendente del sedile: circa 0,78 × 0,61 × 1,30 m. [Controlli geometrici](geometry-checks.json).

**Caricamento effettivo in Babylon.js**, immagini di aeroporto/aereo/scale e movimento della camera con tastiera: nessun errore JavaScript o caricamento fallito. [Risultati](browser-checks.json). Nessun dato di spawn usato come prova geometrica. Nessun test multiplayer, commit, push o deploy; verificati gli hash dei file di Sparatoria e del catalogo.

Prima dell’integrazione completa servono i file originali elencati nell’inventario e la correzione del brush incoerente. La successiva fase di gameplay dovrà creare collider, percorsi realmente camminabili, navigazione dei bot e spawn verificati. La camera libera dell’anteprima non costituisce un test di queste funzioni.
