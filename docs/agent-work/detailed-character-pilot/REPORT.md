# Buttafuori Tripo — integrazione pilota

**Aggiornamento:** su nuova richiesta, le 43 animazioni del GLB `(2)` sono ora integrate. Questo documento descrive la prima fase senza clip; stato corrente e verifiche in [Buttafuori — animazioni](../buttafuori-animation-phase/REPORT.md).

8 ottobre 2026. Il modello `detailed+character+3d+model (1).glb` è associato al **Buttafuori**, come confermato dall'utente. Implementazione con il root attuale, secondo l'autorizzazione già ricevuta a continuare senza Flash.

## Prova nel gioco

- Gallery: http://127.0.0.1:5174/?characters=1&buttafuori=new
- Tutti e tre gli import: http://127.0.0.1:5174/?characters=1&goblin=new&judoka=new&buttafuori=new
- Cornicione DEV: http://127.0.0.1:5174/?fighter=1&buttafuori=new ; `window.__fighterLab.restart(5,'all-buttafuori')` crea cinque Buttafuori.
- Partite DEV: `?buttafuori=new`, selezionando Buttafuori. Produzione: opt-in solo con `?debug=1&buttafuori=new`.
- Pulsanti **BUTTAFUORI LEGACY / BUTTAFUORI TRIPO**, indipendenti da Goblin e Judoka. Il modello Legacy resta il default e il fallback.
- **BUTTAFUORI · POSE LAB (0 CLIP)**: confronto affiancato, 1/2/5 istanze, skeleton/ossa/root/attachment. Gli stati IDLE/RUN/JUMP/DASH/HIT/STUN/ATTACK/ABILITY/VICTORY/DEFEAT sono controllati dai pulsanti della Gallery. Camera, luci e riferimenti di scala sono comuni; la posa di bind originale è diversa da quella Legacy.

## Asset originale

Sorgente: `C:/Users/niluf.PC-NIKO/Downloads/detailed+character+3d+model (1).glb`.
Copia: `public/models/detailed-tripo/detailed_character.glb`.
SHA256 identico: `b58a967f96e466a98a4734380c1b8cec352d01c5a4d64518d8df7aed32fab03d`.

| Proprietà | Valore |
|---|---|
| File | 15.831.292 byte |
| Mesh / materiale | 1 / 1, materiale PBR double-sided |
| Vertici / triangoli | 28.141 / 31.399 |
| Rig | 65 bones con nomi Mixamo; 40 articolazioni delle dita |
| Animazioni embedded | **0** — non esiste `run.001` in questo file |
| Texture | Base color JPEG, normal PNG, metallic/roughness PNG; tutte 4096×4096 |
| Morph facciali | 0 |
| Audit geometria/skin | Nessun indice invalido, peso negativo/non finito, vertice senza pesi o bind matrix non finita |
| Errore massimo somma pesi | circa 1,27×10⁻⁷ |

Dettagli: [asset-analysis.json](asset-analysis.json), [textures.json](textures.json). GLB e texture preservati senza compressione, riduzione o LOD.

## Scala, orientamento e rig

Altezza originale circa **0,97794** unità. Il renderer adatta uniformemente il modello all'altezza del Buttafuori Legacy: in Gallery **2,02568** unità, scala **2,07137**. FPS usa l'altezza avatar esistente di **1,75**. Pivot ai piedi; Y up; correzione yaw **0°**, verificata frontalmente e nelle scene di gioco.

Ogni istanza ha skeleton indipendente; geometria, materiale e texture sono condivisi per scena. Il loader non avvia animazioni automaticamente. I nodi glTF collegati alle ossa vengono posati sul proprio bind, convertendo gli assi del modello nello spazio locale di ogni articolazione. Non vengono trasferite tracce animate dal Goblin o dal Judoka.

## Animazione provvisoria e continuità della skin

Poiché il GLB non contiene clip, `ProceduralSkinAnimator` applica pose provvisorie al **nuovo skeleton**. Riusa il controller semantico esistente per priorità e tempi; le sue informazioni temporali non sono animazioni embedded del Buttafuori. La diagnostica dichiara `procedural:true`, `clips:0`, `activeTracks:0`, `animationPlaying:false`.

Locomozione, posa aerea, reazioni, attacchi e risultati modificano rotazioni del rig. Tutte le traslazioni delle ossa restano al bind: posizione, velocità, traiettoria, collider, hitbox, danni, startup/active/recovery e abilità restano della simulazione esistente. La posa di attacco raggiunge il massimo nella finestra attiva esistente; non certifica un contatto artistico tra mano/piede e bersaglio.

Una volta caricato, il Buttafuori mantiene lo stesso corpo importato anche durante salto, doppio salto e azioni aeree. Gli stati senza gesto dedicato mantengono il nuovo corpo con una posa di sostituzione. Il Legacy ricompare solo selezionando OLD o se l'importazione fallisce.

## Contesti

| Contesto | Esito / limite |
|---|---|
| Gallery | Tre modelli importati insieme; stati e confronto OLD/NEW; 1/2/5 istanze |
| Arena | Nuovo corpo e pose provvisorie; VFX, targhette e abilità esistenti |
| Cornicione | Nuova skin continua in aria e nelle 14 mosse; timing e fisica originali |
| Dodgeball | Nuovo corpo, pickup/throw/catch provvisori; palla agganciata alla mano del rig |
| Calcio / Volley | Renderer condiviso disponibile; gesti specifici ancora da realizzare/approvare, non validati come animazioni sportive |
| FPS | Corpo visto dagli altri; proprio corpo escluso dalla propria viewport. Arma, viewmodel e hitscan esistenti |
| Results | Due ritratti 3D victory/defeat verificati, atlas condivisa e disposal completo |
| Kart | Driver Legacy conservato: posa guida del nuovo asset non aggiunta in questa fase |
| UI / giochi 2D | Presentazione esistente |

## Verifiche

- Integrazione: PASS, tre asset insieme, 65 bones/0 clip per Buttafuori, dieci stati con joint finiti e hips al bind, cinque skeleton indipendenti/geometria condivisa, OLD/NEW, risultati e contatori a zero dopo shutdown. [integration.json](integration.json)
- Cornicione: PASS, **86 campioni** attraverso salto/doppio salto/discesa/atterraggio e tutte le 14 mosse. Mesh/materiali/skeleton identici, nuovo corpo visibile, render senza scritture della fisica, vertici deformati finiti. [jump.log](jump.log), [jump.json](jump.json)
- Scene reali: cinque Buttafuori in Cornicione/Arena/Dodgeball/FPS; confronto OLD/NEW e risorse rilasciate. Pickup/throw/catch e palla/mano verificati. [hardware-context-performance.json](hardware-context-performance.json)
- Regressione controller Goblin: **135 controlli PASS**. [goblin-regression.log](goblin-regression.log)
- Regressione salto Judoka: **72 campioni PASS**, stesso corpo Tripo anche in aria dopo l'aggiunta del Buttafuori. [judoka-jump-regression.log](judoka-jump-regression.log)
- SHA256 originale/copia uguale. Nessuna modifica alla simulazione, ai dati delle mosse, al server o agli input.
- TypeScript e build Vite: PASS, build in 3m41s; resta il warning dei chunk grandi. [build.log](build.log)
- Importazione fallita: PASS, corpo Legacy visibile e gestione hide/show ancora funzionante, senza scrivere lo stato fisico congelato. [fallback.log](fallback.log), [fallback.json](fallback.json)
- Bundle produzione: PASS, nessuna Gallery/GLB senza debug; opt-in debug importa 65 bones/0 clip, OLD/NEW funziona, nessun errore di pagina. [production.log](production.log), [production.json](production.json)

## Performance

Campioni brevi su RTX 3050 / Chrome D3D11, 1280×720, cinque personaggi, senza build contemporanea:

| Scena | Intervallo frame OLD / NEW | Draw call OLD / NEW | CPU pose NEW, cinque istanze |
|---|---|---|---|
| Cornicione | 16,67 / 17,65 ms | 307 / 67 | 0,31 ms |
| Arena | 16,72 / 16,69 ms | 302 / 62 | 0,27 ms |
| Dodgeball | 16,69 / 17,63 ms | 331 / 91 | 0,24 ms |
| FPS | 16,67 / 16,69 ms | 225 / 165 | 0,23 ms |

Le misure durano 35–36 frame per contesto e mostrano circa 57–60 fps su questa macchina; non certificano una partita completa o hardware mobile. Le draw call includono la scena intera. Il modello riduce i pezzi del vecchio corpo, ma aumenta il costo di skinning e texture. Cinque istanze condividono risorse per **156.995 triangoli** e hanno 325 bones; più viewport possono disegnare la geometria più volte.

Tre texture RGBA8 4K valgono una stima di **192 MiB senza mipmap / 256 MiB con mipmap completa per scena**, condivise fra le istanze. È una stima teorica, non memoria GPU misurata. Nessuna ottimizzazione applicata prima della visione dell'originale.

## Limiti visivi e prossimi requisiti

Il modello originale ha una posa già caratterizzata: testa inclinata, mani in gesto e bottiglia/accessori integrati nella mesh. Questa impostazione resta riconoscibile nelle pose temporanee. Texture, abiti e accessori sono visibili; nei campioni esaminati non si vedono esplosioni del rig. I vertici deformati restano finiti.

Le pose non equivalgono ad animazioni finite: corsa con possibile foot sliding, nessun foot IK, gesto di attacco approssimato, mani/accessori da rifinire. Nell'FPS la presa dell'arma resta da allineare al nuovo rig. Victory/defeat sono variazioni del bind, non clip dedicate. Non ci sono morph facciali; colori originali preservati, nessuna ricolorazione della texture per squadra. La nuova sagoma è più snella del Legacy: collider/hitbox sono volutamente invariati, quindi la loro corrispondenza visiva richiede revisione prima dello swap definitivo.

Prima dello swap definitivo servono animazioni dedicate per idle/run/jump/fall, attacchi/reazioni/abilità/risultati; retarget e contatti verificati; posa arma FPS; posa Kart e gesti sportivi; controllo di clipping/dita/accessori e leggibilità delle squadre; test più lunghi e su hardware meno potente. LOD e texture compresse restano una fase successiva.

Screenshot: `C:/Users/niluf.PC-NIKO/Desktop/Ricchioni/e2e-shots/detailed-character/`.
Integrazione pilota soltanto; nessuno swap definitivo, commit, push o deploy.
