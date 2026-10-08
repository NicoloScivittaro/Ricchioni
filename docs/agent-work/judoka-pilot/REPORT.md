# Judoka Tripo — aggiunta pilota

8 ottobre 2026. Il modello allegato è aggiunto come variante DEV del Judoka. Il personaggio procedurale resta il default e il fallback; gameplay e abilità non cambiano. Implementazione con il root attuale, coerentemente con l'autorizzazione della sessione a proseguire senza Flash.

## Utilizzo

- Gallery: http://localhost:5174/?characters=1&judoka=new . Pulsanti JUDOKA LEGACY / JUDOKA TRIPO; pannello JUDOKA · ANIMATION LAB in alto a sinistra, con confronto affiancato, 1/2/5 istanze, PLAY/LOOP, velocità 0.25/0.5/1/2× e diagnostica skeleton/attachment.
- Entrambi i nuovi modelli: http://localhost:5174/?characters=1&goblin=new&judoka=new . I due selettori sono indipendenti.
- Cornicione: http://localhost:5174/?fighter=1&judoka=new . `window.__fighterLab.restart(5,'all-judoka')` nel DEV lab crea cinque Judoka.
- Partita DEV: `?judoka=new`; selezionare Judoka come personaggio. `?judoka=old` ripristina il modello procedurale.
- Produzione: il modello è opt-in con `?debug=1&judoka=new`; senza debug resta Legacy. Il pulsante UI prevale sul parametro URL nella sessione del tab.

## Asset e audit

Sorgente: `C:/Users/niluf.PC-NIKO/Downloads/judo+figure+3d+model.glb`.
Copia di gioco: `public/models/judoka-tripo/judo_figure.glb`.
SHA256 identico: `8446503b4f2ed65035f12b64a96567b4d25ab86ea841c141a29ad84975e2946b`.

| Proprietà | Valore |
|---|---|
| Dimensione file | 16.429.868 byte |
| Mesh / materiale | 1 / 1 |
| Vertici / triangoli | 24.403 / 29.435 |
| Skeleton | 65 bones Mixamo, incluse 40 articolazioni delle dita |
| Animazioni | 37 clip, 195 canali su 65 nodi ciascuna |
| Texture | Color JPEG, normal PNG, metallic/roughness PNG; tutte 4096×4096 |
| Geometria/skin | Nessun indice invalido, nessuna posizione/peso/bind matrix non finita nell'audit |
| Morph facciali | Assenti |

Inventario: [asset-analysis.json](asset-analysis.json), [textures.json](textures.json). Tutte le clip e le ossa animate: [CLIP-AUDIT.md](CLIP-AUDIT.md), [clip-audit.json](clip-audit.json). Questi sono audit statici; prove Babylon e scene reali sono nei log di integrazione.

File e texture originali preservati. Nessuna compressione, riduzione texture, generazione LOD o retarget da Goblin. Il file Judoka contiene già le proprie animazioni: non gli sono state applicate alla cieca le trasformazioni del rig Goblin.

## Pipeline

Il renderer, sampler e controller esistenti supportano ora un profilo per asset: URL, namespace e manifest con nomi/range propri. Goblin mantiene il suo profilo predefinito e tutte le clip precedenti. Il Judoka usa `judoka.*`, con nomi sorgente centralizzati in `judokaClips.json`.

Sono mappate 27 clip: idle/run/fall, dodge/dash, jab/hook/uppercut/heavy/frontKick/roundhouse, grab/judoThrow/block, cinque hit reaction, knockback/KO, pickup/ballThrow/ballCatch, victory/defeat e bow. Le altre dieci restano nell'audit; le quattro clip Soccer non vengono usate per il calcio.

Trim runtime ricavato dalle keyframe e dall'energia delle articolazioni; nessuna modifica al GLB. Attack legge startup/active/recovery esistenti e adatta il playback alla finestra attiva. I candidati di contatto richiedono revisione artistica (`contactVerified:false`). Idle/run loop, reaction/KO priority e risultati in hold usano la pipeline condivisa. Grab/judoThrow/block non introducono nuove meccaniche.

Root motion X/Z neutralizzata; hips Y neutralizzata in aria/caduta. Il modello misura 0,978627 unità di altezza in bind e viene adattato all'altezza del rig Judoka Legacy del contesto. Pivot ai piedi, Y up, correzione yaw 0°, verificata nei confronti frontali e nella vista laterale Cornicione. FPS conserva il riferimento di altezza già usato per gli avatar.

## Contesti e fallback

| Contesto | Comportamento |
|---|---|
| Gallery | OLD/NEW e confronto stessa camera/luce/riferimento scala; 27 preview e diagnostica |
| Arena | Nuovo corpo in locomozione e nelle azioni mappate; gesto Legacy quando manca una corrispondenza valida |
| Cornicione | Attacchi seguono i timing originali; hit/risultati nuovi. Il Judoka mantiene sempre il corpo Tripo durante salto, doppio salto e attacchi aerei. Senza jump dedicato, la salita tiene la prima posa del segmento aereo e la discesa riproduce fall; la traiettoria viene esclusivamente dalla simulazione. |
| Dodgeball | Corpo nuovo, pickup/throw/catch render, mano reale per la palla tenuta. Timing, possessione e traiettorie originali. |
| Calcio / Volley | Locomozione nuova; kick/charge/tackle e serve/bump/spike/block conservano il gesto e il corpo Legacy durante l'azione |
| FPS | Corpo visto dagli altri, arma/viewmodel/muzzle flash originali e maschera che nasconde il proprio corpo; hit/KO nel tempo di presentazione originale |
| Kart | Driver procedurale; nessuna posa guida affidabile aggiunta |
| Results | Victory/defeat per Judoka dopo giochi 3D, condividendo la stessa atlas del Goblin. Battute/VFX e scoring originali. |
| Giochi UI/2D | Nessun 3D aggiunto |

Le istanze hanno skeleton indipendenti e geometria/materiali condivisi per scena. Il caricamento usa le protezioni esistenti per errori, timeout e chiusura scena; il corpo Legacy resta disponibile.

## Verifiche

- TypeScript e build Vite: PASS; log `typecheck.log`, `build.log`. Resta il warning dei chunk grandi.
- Integrazione Judoka: PASS (`integration.log` / JSON): Goblin e Judoka insieme, 27 preview finite con 65 bones/195 canali, cinque skeleton indipendenti con geometria condivisa, OLD/NEW, jab Cornicione, victory/defeat e contatori a zero dopo shutdown. Il vecchio fallback del salto è stato rimosso su richiesta dell'utente.
- Correzione salto: PASS (`jump.log` / `jump.json`): 72 frame di salto, doppio salto, discesa, atterraggio e dAL/dAH mantengono esattamente mesh/materiali/skeleton Tripo. Nessuna scrittura della fisica nel render e hips Y neutralizzata. Regressione controller Goblin: 135 PASS in `jump-goblin-regression.log`.
- Build dopo la correzione: PASS (`jump-build.log`); integrazione completa Judoka ripetuta e PASS con il nuovo comportamento in aria.
- Scene reali con cinque Judoka: Cornicione, Arena, Dodgeball e FPS a cinque viewport importano/disposano correttamente; OLD ha zero skeleton importati. Pickup/throw/catch e palla/mano durante la rotazione verificati. `contexts.log`, `hardware-context-performance.json`.
- Regressione controller Goblin: 135 controlli PASS (`goblin-animator-regression.log`).
- Regressione integrazione Goblin: 76 controlli PASS (`goblin-integration-regression.log`). Il runner aspetta ora che la Gallery sia inizializzata prima di contarne i rig, mantenendo tutte le aspettative esistenti; prima quel race di avvio causava timeout.
- Gallery esistente: PASS a 1366×768 e 1920×1080 (`gallery-regression.log`), incluso import Goblin 36 clip e ritorno OLD.
- Preview visivo Goblin: PASS (`goblin-probe.log`); 36 clip presenti e nessun errore.
- Bundle produzione Judoka: PASS (`production.log` / JSON): nessun GLB e nessun lab senza debug; con debug import 37 clip/65 bones, switch OLD/NEW corretto.
- SHA256 sorgente/copia verificato; diff di gameplay, server, input, fighterCore/fighterData assente.

## Performance e limiti visivi

Le tre texture originali valgono una stima totale RGBA8 di 192 MiB senza mipmap, circa 256 MiB con mipmap completa per scena, condivise fra le istanze. È una stima, non allocazione driver misurata. Cinque Judoka hanno 147.175 triangoli unici, 325 bones e 975 canali attivi; il rendering in più viewport può inviare la geometria più volte.

La prima misura breve RTX 3050 / D3D11 / 1280×720 dà intervalli medi di circa 20,0 ms Cornicione, 18,1 ms Arena, 19,6 ms Dodgeball e 16,7 ms FPS. Era contemporanea alla build; non certifica il picco di una partita a cinque giocatori. Il JSON conserva i dettagli per frame, draw call, sampler CPU, skeleton.prepare, materiali e texture.

Gi, cintura, occhiali e volto risultano correttamente importati nei campioni esaminati, senza esplosioni del rig. La leggibilità dei colpi, il clipping nelle pose estreme e il foot sliding richiedono ancora una revisione in partita. Non c'è foot IK. Mancano jump dedicato, presa dell'arma FPS, posa Kart e gesti sportivi approvati. Il salto usa una posa Tripo di sostituzione e non cambia più sagoma; restano fallback per i gesti sportivi a terra. La maglia/gi non viene ricolorata per squadra.

La meccanica e i valori dell'abilità Judoka sono invariati; la rifinitura di presa, contatto col bersaglio e counter completo resta una fase visiva separata. Nessun sistema facciale aggiunto.

## Screenshot e stop

`C:/Users/niluf.PC-NIKO/Desktop/Ricchioni/e2e-shots/judoka/` contiene `legacy-tripo.png`, `cornicione.png`, `results.png` e le scene a cinque Judoka (`*-5goblins.png`, nome storico del runner condiviso), oltre a pickup/throw Dodgeball.

Il nuovo modello è disponibile per confronto e gioco DEV. Lo swap definitivo resta separato; nessun commit, push o deploy eseguito.
