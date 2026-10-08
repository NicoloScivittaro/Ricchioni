# Goblin Tripo — rapporto del pilota (integrazione completa, solo DEV)

**Documento storico prima della revisione e delle correzioni. Il rapporto canonico aggiornato è [FINAL-REPORT.md](FINAL-REPORT.md); stato, numeri e limiti di questo documento non sono quelli dell'accettazione finale.**

Stato: **implementazione e verifica completate; pronto per la revisione di Astra**. Data: 8 ottobre 2026.
Baseline: `e1c8ea75b8aad585a141685db7e7f2f81585f86f` (i file di pianificazione `REPORT.md`,
`analyze_glb.py`, `asset-analysis.json` NON sono stati toccati).

Il Goblin procedurale resta il modello **predefinito**: il GLB Tripo è un'alternativa di **render**, attivabile
solo in sviluppo/debug (`?goblin=new` o `setGoblinVisualMode('new')` da console). Nessuna modifica a gameplay,
fisica, abilità, input, rete, collider o hitbox.

---

## 1. Cosa è stato fatto

| Area | File | Effetto |
| --- | --- | --- |
| Asset | `public/models/goblin-tripo/green_goblin_tripo.glb` | copia **byte per byte** dell'originale: 6.108.164 byte, SHA256 `e993184137ca316e8730957cba75decb2410b3640b48394661f91b0e1987293f` (identico alla sorgente) |
| Adapter | `src/minigames/characters/goblinVisual.ts` (nuovo) | selettore OLD/NEW, caricamento GLB condiviso per scena, istanze con scheletro e clip **proprie**, normalizzazione scala/appoggio/orientamento, correzione dello scostamento della clip, posa ferma, posa seduta (Kart), disposal, hook di debug |
| Arena/Cornicione (+ Dodgeball, Calcio, Pallavolo, che usano la stessa entità) | `src/minigames/arena/arenaEntity.ts` | opt-in NEW per il solo Goblin: il modello importato sostituisce **solo il disegno del corpo**, il rig procedurale resta vivo (ancoraggi FX, targhetta, popup, simbolo abilità invariati) |
| Kart | `src/minigames/kart-race/kartEntity.ts` | pilota Goblin importato in **posa seduta**, mini-rig procedurale nascosto solo a caricamento riuscito; il pilota si piega in curva come prima |
| Sparatoria | `src/minigames/fps/BabylonFpsGame.ts` | avversario Goblin importato al posto della capsula; stessa `layerMask` per camera (il proprio corpo resta nascosto solo a se stessi), arma/targhetta/lampo restano visibili, nessuna mesh pickable |
| Galleria DEV | `src/dev/characterGallery.ts` | pulsanti `GOBLIN OLD` / `GOBLIN NEW` + hook `setGoblin`, `goblin`, `goblins`, `stats`, `spawnGoblins`, `goblinDrive`, `setCamera` |
| Test | `scripts/e2e/goblin-tripo.mjs` (nuovo), `scripts/e2e/character-gallery.mjs` (adattato) | vedi §6 |
| Dipendenze | `package.json`, `package-lock.json` | `@babylonjs/loaders` **9.26.2 esatto** (stessa versione installata di core/gui, nessun aggiornamento dello stack) + `babylonjs-gltf2interface` 9.26.2 bloccato (senza, npm faceva salire il peer a 9.30.0) |
| Report | `docs/agent-work/goblin-tripo-pilot/PILOT-REPORT.md` | questo documento |

Screenshot: `e2e-shots/goblin/` (33 nuovi) e `e2e-shots/characters/` (25 rigenerati: la barra della galleria ha
due pulsanti in più). Il repository tiene gli screenshot dei test sotto `e2e-shots/`, quindi restano lì.

---

## 2. Il dato statico da verificare: esito REALE in Babylon

`REPORT.md` segnalava uno scostamento fra la trasformazione iniziale delle anche e la clip `run.001`. Misurato in
Babylon (ossa in spazio scheletro, unità del modello, prima della scala di scena 2,3715):

| Voce | Valore misurato |
| --- | --- |
| Posa di riposo (bind) `mixamorig:Hips`.position | `(0.0019, 0.4764, 0.0172)` |
| Clip `run.001` `mixamorig:Hips`.position | `x = -0.0239` costante, `y = 0.4062…0.4364` (oscillazione = passo), `z = 0.47206` costante |
| Scostamento orizzontale costante | `(-0.0258, 0, +0.4548)` → ~`1,08` unità di mondo nella scala dell'Arena |
| Rotazione di riposo delle anche | `(0, -0.7071, 0, 0.7071)` = −90° su Y (convenzione di coordinate, compensata dal nodo armature: il modello in riposo è **dritto**, verificato a vista) |
| Inclinazione del tronco nella clip | 33,7°–38,5° dalla verticale (riposo: 2,3°) → è la **spinta in avanti della clip stessa** |
| Caviglie nella clip | y 0,077…0,209 (riposo 0,09): un piede a terra, l'altro sollevato — ciclo di corsa plausibile |

**Cosa sarebbe successo senza correzione:** la clip è "sul posto" ma con tutto lo scheletro ~1 unità davanti
alla posa di riposo; siccome il gioco è responsabile del movimento (disegna il modello nel `root` dell'entità), il
Goblin correva **davanti al proprio root**: nelle foto laterali si vedeva il corpo staccato dalla posizione, in
aria. Non era un errore di scala né di orientamento.

**Correzione applicata (nella copia privata della traccia, per istanza):** l'adapter legge i valori reali della
traccia di posizione delle anche, calcola lo scostamento orizzontale medio rispetto alla posa di riposo e lo
sottrae **prima** di avviare il gruppo di animazione. Nessun numero magico: se il GLB viene sostituito, la
correzione si ricalcola dai dati. Le risorse condivise della scena (materiali, texture, geometrie) non vengono
toccate e ogni Goblin ha la sua copia della traccia.

Dopo la correzione (letto a runtime, in partita): `hipsNow = (0.0019, 0.4364, 0.0172)` con
`restHips = (0.0019, 0.4764, 0.0172)` → x e z tornano esattamente sulla posa di riposo, y resta il passo animato.

**Non corretto (limite dichiarato):** l'inclinazione del tronco (~36°) è la posa autorale della clip. Non esiste
una correzione di rotazione *principiata* senza il rig sorgente (una bind pose diversa non dice nulla sulla posa
di corsa corretta): per un goblin "in scatto" è accettabile, ma è la voce da decidere prima della sostituzione
definitiva (vedi §7).

**Altra trappola risolta:** nel GLB i joint sono **nodi glTF collegati alle ossa**: la clip colpisce il nodo
(`mixamorig:Hips~gN`), non l'oggetto `Bone` dello scheletro clonato. La correzione e la ricerca della traccia
devono usare l'oggetto animato, altrimenti non si trova nulla (errore trovato e corretto durante il pilota).

---

## 3. Scala, appoggio, orientamento, posa ferma

* Bounds locali del GLB misurati in Babylon: `0,4135 × 0,9796 × 0,2647` — identici all'analisi statica.
* L'altezza viene normalizzata sull'altezza del rig procedurale sostituito (`rig.topY`): in Arena il Goblin
  importato misura **2,323** unità di mondo, come il Goblin procedurale. La scala si calcola sui bounds di
  **bind** (mai sui bounds animati).
* Appoggio: il minimo in Y dei bounds va a 0 sul `root`; centro X/Z allineato al `root`.
* Orientamento: il modello importato guarda **dove guarda il rig procedurale** senza correzioni
  (`GOBLIN_YAW_DEG = 0`), verificato con le viste fronte/lato/retro della galleria. `?goblinYaw=<gradi>` e
  `?goblinScale=<percento>` permettono di ritoccare senza ricompilare; valori non validi vengono ignorati.
* **Posa ferma (nessuna clip di idle nel GLB):** si usa un fotogramma REALE della clip, scelto dai dati (il
  fotogramma con le anche più alte: `52.5` di `77.5`). Non è la bind pose e non è autoplay: la clip viene
  avviata con velocità 0 e messa in pausa sul fotogramma (`AnimationGroup.pause()` + `goToFrame`; un gruppo che
  continua a girare riscrive il fotogramma a ogni frame, un gruppo mai avviato non valuta nulla).
* La corsa usa `run.001` con velocità proporzionale a quella reale del gioco; negli stati non coperti
  (salto, colpo, stun, abilità, vittoria, sconfitta) la posa resta **ferma**.

---

## 4. Scheletro, skinning, materiali, deformazioni

* 1 skinned mesh con **33.613 vertici / 35.624 triangoli** (il loader aggiunge un nodo `__root__` vuoto: 2 mesh,
  di cui una senza vertici).
* **65 ossa** per istanza, 1 scheletro **per Goblin** (cloni indipendenti), 1 gruppo di animazione per istanza
  (`run.001~gN`): verificato con 3 Goblin simultanei (3 scheletri, 3 clip, fasi diverse).
* Geometrie **condivise**: le mesh importate dei 3 Goblin puntano alla STESSA geometria (un solo `geometry.uniqueId`
  per tutte le istanze). Il conteggio delle geometrie di scena cresce lo stesso, ma solo perché ogni entità
  costruisce comunque il proprio rig procedurale (nascosto ma vivo): +30 geometrie per entità, nessuna copia dei
  vertici importati.
* Materiale: 1 PBR (base color JPEG 4096², metallic 0, roughness 0,9, double-sided) **condiviso per scena**
  (`cloneMaterials = false`): +1 materiale, +3 texture, non una copia per giocatore.
* Deformazione: nessun artefatto nelle pose fotografate (idle, 4 frame di corsa, colpo, vittoria, seduta);
  peso dei vertici e indici dei joint erano già validati staticamente.
* **Nessuna mesh importata è pickable** e nessuna entra nei raycast: nella Sparatoria il colpo è un hitscan AABB
  in `FpsScene`, indipendente dal rendering.

---

## 5. Integrazione nei contesti richiesti

**Arena** (e Cornicione/Dodgeball/Calcio/Pallavolo, stessa entità): l'entità del Goblin crea l'adapter solo se
la modalità è `new`; il corpo procedurale viene nascosto **solo a caricamento riuscito** (default e fallback =
procedurale). `setBodyVisible` continua a valere per entrambi i corpi (respawn lampeggiante, Buttafuori che
sparisce). `handAnchor`, targhetta, popup e simbolo abilità restano quelli di prima.

**Cornicione**: verificato con il VERO gioco (`?fighter=1`, laboratorio con 3 personaggi): `lab1` (Goblin) ha
il modello importato pronto, 65 ossa, `run.001`.

**Kart**: pilota Goblin importato in posa seduta (rotazioni fisse su 10 ossa + ricalcolo di appoggio/centro sui
bounds deformati), seduto nel posto del vecchio pilota; il mini-rig procedurale resta in memoria e viene nascosto
solo a caricamento riuscito.

**Sparatoria**: avversario Goblin importato. La capsula e i tratti del viso vengono nascosti con `isVisible`
(non `setEnabled`), quindi restano attivi squash/morte, targhetta, arma e lampo; le mesh importate ricevono la
**stessa maschera di layer** dei pezzi sostituiti (`1 << (10 + indice finestra)`), quindi:

* la finestra del Goblin NON vede il proprio corpo (`ownSeesOwn = false` misurato);
* le altre finestre lo vedono (`othersSeeGoblin = [true]`, maschere `[1024, 1024]`).

---

## 6. Verifiche eseguite (comandi e risultati)

| Comando | Esito | Note |
| --- | --- | --- |
| `npm run typecheck` | ✅ exit 0 | `tsc --noEmit` |
| `npm run build` | ✅ exit 0 | 3m21s. Chunk `goblinVisual` 10,5 kB (3,98 kB gzip); il loader glTF è un chunk **lazy** a parte (377 kB, scaricato solo attivando NEW) |
| `node scripts/e2e/character-gallery.mjs` | ✅ TUTTO OK | galleria 1366×768 e 1920×1080: 5 personaggi, 3 viste, 10 stati, nessun accumulo di mesh, **+ 3 assert nuovi sul selettore Goblin** (OLD di default, NEW importato con 65 ossa, ritorno a OLD). Tutti gli assert preesistenti intatti |
| `node scripts/e2e/goblin-tripo.mjs` | ✅ TUTTO OK | 37 assert: OLD/NEW nella galleria, posa ferma su fotogramma reale, correzione clip misurata, altezza normalizzata, corsa che avanza, fallback su asset mancante, switch OLD/NEW ×3 senza accumuli, uscita dalla scena durante il caricamento, 3 Goblin con scheletri/clip indipendenti e geometrie condivise, casi limite del selettore |
| `FLOW=lab node scripts/e2e/goblin-tripo.mjs` | ✅ TUTTO OK | Cornicione con il gioco vero + Sparatoria nel laboratorio impatti (OLD vs NEW, stesso posto) |
| `FLOW=arena node scripts/e2e/goblin-tripo.mjs` | ✅ TUTTO OK | flusso reale host+2 telefoni: Goblin importato nella partita di Arena |
| `FLOW=kart3d node scripts/e2e/goblin-tripo.mjs` | ✅ TUTTO OK | flusso reale: pilota Goblin seduto nel kart |
| `FLOW=fps node scripts/e2e/goblin-tripo.mjs` | ✅ TUTTO OK | split-screen con controller finti: Goblin avversario visibile alle altre finestre, nascosto alla propria |

Screenshot ispezionati a vista (non solo assert): `1600x900-old-idle-{wide,front,side,back,closeup}`,
`1600x900-new-idle-{…}`, `1600x900-{old,new}-run-0..3`, `new-hit`, `new-victory`,
`fallback-missing-asset`, `multi-goblins`, `cornicione-{old,new}`, `arena-new`, `kart3d-new`,
`fps-new` + `fps-new-approach-*`, `impact-fps-{old,new}`.

Log completi delle esecuzioni: `docs/agent-work/goblin-tripo-pilot/evidence/` (`e2e-gallery.log`,
`e2e-character-gallery.log`, `e2e-flow-{lab,arena,kart3d,fps}.log`, `glb-copy.txt` con gli hash).

Nota sulle prestazioni (metodo dichiarato): browser **headless con GL software (SwiftShader)**, 1600×900,
5 personaggi in galleria, campioni di `engine.getFps()` mediati:

| | mesh | materiali | texture | geometrie | scheletri | clip | FPS (software) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| OLD | 160 | 67 | 18 | 160 | 0 | 0 | 6,0 |
| NEW | 162 | 68 | 21 | 161 | 1 | 1 | 3,6 |

Caricamento GLB (dev, senza cache): **1536–1574 ms**. Memoria texture: base color 4096² = 64 MiB RGBA8 (~85 MiB
con mip complete) **per scena, condivisa**; geometria dei vertici ~2,1 MB + indici ~0,43 MB, **condivisa** fra le
istanze (scheletro e clip restano per istanza).
**Questi numeri NON sono prestazioni hardware**: con SwiftShader la caduta 6,0 → 3,6 fps è dominata dal
fill-rate software. Serve una misura su GPU reale prima della sostituzione definitiva.

Confronto OLD/NEW: camera, luci, `root`, facing e stato semantico sono gli stessi; le pose ossee **non possono**
essere identiche (due scheletri diversi, una sola clip). Per questo i confronti sono fatti a stati e istanti
deterministici (stessa posa della galleria, 4 campioni a intervalli fissi), non con un allineamento osso-per-osso.

---

## 7. Limiti, rischi e lavoro prima della sostituzione definitiva

1. **Inclinazione della clip (~36°)** e assenza di idle/camminata/salto/colpo: gli stati non coperti mostrano un
   fotogramma fermo della corsa (scelto come il più disteso). Servono ritargettizzazione o clip dedicate.
2. **Scostamento costante della clip**: neutralizzato automaticamente dai dati della clip; la causa a monte
   (export del rig) resta e andrebbe corretta nella sorgente se il modello diventa il Goblin ufficiale.
3. **Sparatoria**: l'arma resta la scatola procedurale (il modello importato non impugna nulla); resta come
   indicazione di mira, ma è una discrepanza visiva da decidere.
4. **Kart**: la posa seduta è verificata dalla camera di gioco (gambe dentro la carrozzeria); eventuali
   compenetrazioni fini con l'abitacolo non sono misurabili da quell'angolo.
5. **Prestazioni su GPU reale** e prova con 5 giocatori in Arena/Kart non ancora fatte.
6. **Produzione**: il selettore è dietro il gate di debug (`debugEnabled()`, come galleria e laboratori) e il
   loader glTF è importato dinamicamente: in una partita normale (build di produzione, senza `?debug=1`) non
   viene scaricato nulla di nuovo — l'unico costo è il chunk adapter da 3,99 kB gzip, già presente nelle partite
   3D. Con `?debug=1` il pilota è provabile anche su una build di produzione, come gli altri strumenti di debug.
7. **Screenshot versionati**: 33 nuovi in `e2e-shots/goblin/` e 25 rigenerati in `e2e-shots/characters/`
   (mostrano i due nuovi pulsanti della galleria).
8. File generati toccati da installazione/build (non sorgente, nessuna intenzione di modificarli):
   `node_modules/.package-lock.json` (nuova dipendenza), `node_modules/.vite/deps/_metadata.json` (cache di vite)
   e `dist/index.html` (entry tracciata, rigenerata da `npm run build`); il resto di `dist/` è in `.gitignore`.

## 8. Come riprodurre

```bash
# client dev (galleria e giochi 3D): serve vite; per i giochi reali anche il server
npm run dev:client        # oppure npx vite --port 5173
npm start                 # server stanza/telefoni (porta 3001), se vuoi provare i flussi di gioco

http://localhost:5173/?characters=1               # galleria, Goblin procedurale (OLD, default)
http://localhost:5173/?characters=1&goblin=new    # galleria, Goblin importato (NEW)
http://localhost:5173/?goblin=new                 # gioco normale con NEW (Arena, Cornicione, Kart, Sparatoria)
http://localhost:5173/?goblin=new&goblinYaw=90&goblinScale=110   # ritocco di orientamento/scala

npm run typecheck
npm run build
node scripts/e2e/character-gallery.mjs
node scripts/e2e/goblin-tripo.mjs
FLOW=lab|arena|kart3d|fps node scripts/e2e/goblin-tripo.mjs
```
