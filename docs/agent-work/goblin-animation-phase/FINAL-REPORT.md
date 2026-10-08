# Goblin Mbriacone — integrazione pilota del modello e delle animazioni

8 ottobre 2026. Implementazione eseguita dal root attuale, come autorizzato dopo l'errore di credito Flash. Questo report sostituisce, per il nuovo asset animato, le conclusioni del primo pilot con la sola `run.001`.

La pipeline funziona nel gioco reale e resta un'alternativa DEV. Il procedurale è ancora il default e il fallback. Il pilota tecnico è completato; la sostituzione ufficiale richiede ancora accettazione delle pose e una prova di gioco intensa alla risoluzione di lancio. Nessun commit, push o deploy eseguito.

## Come provarlo

- Gallery: http://localhost:5174/?characters=1&goblin=new — OLD/NEW, confronto LEGACY/TRIPO, stessa camera, luce e riferimento di scala. Nel pannello animazioni: 28 clip, PLAY/LOOP, 0.25×/0.5×/1×/2×, nome originale, range/frame, durata e velocità; toggle skeleton, bones, root e attachment.
- Cornicione: http://localhost:5174/?fighter=1&goblin=new — laboratorio con bot e controlli esistenti. Il test DEV può avviare cinque Goblin con `window.__fighterLab.restart(5,'all-goblin')`.
- Partita normale DEV: http://localhost:5174/?goblin=new — selezionare Goblin nei minigiochi. `?goblin=old` riporta al procedurale. Il selettore UI ha precedenza sull'URL e resta valido per la sessione del tab.
- Produzione: il pilota richiede `?debug=1&goblin=new`; `?goblin=new` da solo lascia il default Legacy. Verificato sul bundle servito da http://localhost:3001/.

Il Vite corretto per questa fase è sulla porta 5174. La porta 5173 ospita un altro servizio.

## GLB audit, rig e materiali

Sorgente: `C:/Users/niluf.PC-NIKO/Downloads/green+goblin+3d+model (2).glb`. Copia di gioco: `public/models/goblin-tripo/green_goblin_animated.glb`. SHA256 di entrambi: `dfa6d845797233570b97beb19a2cad0639f455ba1ebbac348c6be142aa3aad64`. Il file originale non è stato modificato, compresso o retargettato. La prima esportazione del precedente pilot resta disponibile come asset storico.

| Dato | Verifica |
|---|---|
| File | 9.302.908 byte |
| Geometria | 1 mesh, 1 primitive, 33.613 vertici, 35.624 triangoli |
| Materiali | 1 materiale; base color JPEG 4096×4096 originale |
| Skin | 1 skin, 65 articolazioni Mixamo, di cui 40 articolazioni delle dita |
| Animazioni | 36 clip; ciascuna anima 65 nodi con 195 canali posizione/rotazione/scala |
| Morph facciali | Assenti; nessun sistema facciale aggiunto |
| Dati geometrici | Nessun indice invalido o posizione non finita nell'audit |

Audit completo: [CLIP-AUDIT.md](CLIP-AUDIT.md). Inventario strutturale: [asset-analysis.json](asset-analysis.json). Elenco delle ossa effettivamente animate per ogni clip, movimenti hips, energia e candidati contatto: [clip-audit.json](clip-audit.json). Il campo STATIC ANALYSIS del primo JSON descrive quel singolo audit; import e prove runtime sono documentati nei log e JSON di integrazione.

I nomi originali, inclusi quelli lunghi derivati dai prompt, sono centralizzati in `src/minigames/characters/goblinClips.json`. Sono mappate 28 clip: locomozione, jumpDown, dodge/dash, cinque hit, knockback/KO, sei attacchi, grab/judoThrow/block, pickup/ballThrow/ballCatch, victory/defeat. Sette clip senza una corrispondente azione attuale restano solo nell'audit. La clip #22 di Soccer è esplicitamente esclusa anche dal preview mappato.

Il renderer Babylon importa skin e skeleton reali. Ogni copia ha controller, skeleton e gruppi propri; geometria e materiale sono condivisi per scena. I gruppi non partono tutti insieme: vengono usati come dati dal sampler, che valuta solo i 195 canali della posa selezionata. I nodi glTF collegati alle bones sono il punto corretto di applicazione della posa, perché Babylon ricostruisce le matrici delle bones da quei nodi.

## Scala e orientamento

Il modello originale misura circa 0,979631 unità in altezza; piedi quasi esattamente a Y=0. Babylon converte glTF nel sistema della scena: Y è up, la direzione visiva coincide con +Z e la correzione yaw verificata è 0°. Il pivot del renderer coincide con il riferimento dei piedi.

Arena, Cornicione, Dodgeball, Calcio, Volley e Gallery adattano l'altezza al rig Legacy, circa 2,32324 unità per Goblin. La scala resta costante durante le clip. FPS conserva l'altezza visiva precedente di 1,75 unità: è una differenza intenzionale del renderer FPS esistente, senza cambiare la hurtbox. Kart conserva il driver Legacy. Non è stata imposta una nuova scala fisica universale ai giochi.

Hips X/Z vengono neutralizzati alla posizione bind per ogni frame. Hips Y resta animato a terra per il body acting e viene neutralizzato in aria: salto e caduta non sommano la traslazione della clip alla traiettoria reale. Le vecchie inclinazioni/squash del render root non vengono sommate alle pose Tripo. L'atterraggio rientra in locomozione con blend breve; nessuna landing pesante inventata.

## Timing, blending e priorità

[ANIMATION-MAPPING.md](ANIMATION-MAPPING.md) contiene original → internal, durata sorgente, range secondi/frame, durata effettiva, velocità media, candidato contatto e loop. I range derivano dalle keyframe e dal moto delle articolazioni, con campionamento visuale; non soltanto dai nomi. Il GLB resta intatto. Il sampler usa secondi sorgente, convertibili nei frame Babylon a 60 FPS; i campioni originali sono a 24 FPS.

Per Cornicione il tempo viene dal vero `attack.t` e dai valori esistenti startup/active/recovery. Un warp a due segmenti porta il candidato contatto a `startup + 0.35 × active` e completa il recupero nella finestra originale. Il down light usa il candidato basso del frontKick. Per pickup/throw/catch, invocati al contatto/evento già esistente, la clip parte dal campione di contatto senza ritardo di blend. Non vengono introdotti attese, timer di rilascio o trigger fisici derivati dall'animazione.

Priorità: KO, risultato, hit/knockback, ability/recovery, attack, dodge, dash, airborne, run, idle. KO rimane latched fino al respawn. Hit può interrompere attack e special. I risultati hanno uno stato dedicato e fermano l'ultima posa. Idle/run non vengono riavviati ogni frame; blend locomozione 0,12 s, attack 0,05 s, reaction 0,035 s. I loop hanno una cucitura di 0,10 s. Nessun sistema mirror fragile aggiunto.

I candidati di contatto sono numericamente allineati e verificati dai test; `contactVerified:false` resta intenzionalmente nel manifest per distinguere questo risultato dall'approvazione artistica del gesto e della sua portata. Il volume hitbox può essere più ampio della mano/piede del modello: il timing è corretto, la distanza di contatto richiede ancora revisione visiva.

## Cornicione — tutte le mosse

| Move esistente | Render scelto |
|---|---|
| nL | jab |
| sL | hook |
| uL | uppercut |
| dL | frontKick, candidato di contatto basso |
| sH | heavy |
| uH | uppercut, durata dell'heavy originale |
| dH | roundhouse |
| nAL | jab |
| sAL | frontKick |
| uAL | uppercut |
| dAL | Legacy: la clip disponibile non comunica un attacco verso il basso |
| sAH | heavy |
| dAH | Legacy: stesso limite di leggibilità verso il basso |
| uAH | uppercut/recovery; salita sempre da fighterCore |
| follow | heavy; finestra originale del follow-up |

Le hit vengono classificate usando metadati di altezza/direzione/intensità già presenti: head, side, stomach, body A/B alternati deterministicamente, knockback per colpi forti. Non si usa random per la scelta A/B. La traiettoria di lancio resta quella del fighterCore.

RIMONTA AL 90° legge il burst esistente, usa uppercut/recovery e mantiene VFX, finestra di ritorno 2,5 s e follow-up. Nessuna modifica a distanza, danno, cariche o condizioni. Verificata l'attivazione attraverso il simulatore reale, non soltanto una clip in Gallery.

Ring-out: il modello continua la posa aerea e viene nascosto quando la simulazione marca il player morto; nessun collasso a terra o teletrasporto da clip KO. Il respawn riabilita il corpo alla posizione stabilita dal gioco. La KO a terra resta disponibile per i contesti appropriati e per il lab.

## Altri contesti e fallback

| Contesto | Integrazione e limiti |
|---|---|
| Arena | Nuove idle/run/dash, reaction, knockback e fall/KO quando lo stato lo consente. Push/recoil senza clip appropriata conserva il gesto procedurale; nessun pugno sostitutivo forzato. |
| Dodgeball | Idle/run/dodge, pickup, ballThrow e ballCatch. La mesh della palla tenuta segue RIGHT_HAND in coordinate mondo, rispettando la rotazione visiva interpolata. Rilascio e fisica restano immediati come prima. ballCatch visualizza il contatto della riflessione/assorbimento Goblin esistente: non è stata aggiunta una meccanica di catch/possessione. |
| Calcio | Nuovo corpo in locomozione; kick, charged kick e tackle mostrano il rig Legacy con i gesti originali. La clip Soccer Tripo #22 non viene usata. |
| Volley | Nuova locomozione; serve, bump, spike/smash e block conservano il corpo/gesto Legacy per la durata dell'azione. |
| FPS | Corpo Tripo third-person con idle/run, hit e KO adattata alla presentazione morte esistente di 0,45 s. La propria viewport non vede il proprio corpo. Arma, muzzle flash, targhetta e viewmodel originale conservati. Non esistono nuove shoot/reload/weapon-hold: le braccia Tripo non impugnano ancora correttamente l'arma. |
| Kart | Driver Legacy anche con NEW selezionato. L'esperimento seated del primo pilot è accessibile solo con `?goblinDriver=1`, senza promuoverlo a driver valido. Manca una posa guida affidabile. |
| Results | Victory/defeat 3D per Goblin dopo i minigiochi 3D, una scena/atlas condivisa per schermata, posa finale in hold. Ritratto originale finché il GLB non è pronto o se fallisce. Battute, punti, animazioni UI, audio e VFX esistenti conservati. |
| Quiz/Memory/Reaction/Cultura | UI e ritratti originali; nessun 3D aggiunto. |

Fallback di caricamento: URL errato, asset incompleto, timeout, errore import o scena chiusa durante il load lasciano disponibile il procedurale. Il loader richiede skin reale e tutte le 28 clip mappate. I container arrivati dopo la chiusura della scena vengono rilasciati; dispose elimina gruppi, skeleton e istanze prima della scena.

Attachment centralizzati: RIGHT_HAND, LEFT_HAND, HEAD, CHEST, HIPS, RIGHT_FOOT, LEFT_FOOT. Nessun nome osso disperso nei minigiochi. Grab/judoThrow/block sono disponibili nel controller e nel preview senza aggiungere meccaniche di combattimento.

I quattro FBX allegati sono stati inventariati, senza conversione o retarget: [FBX-AUDIT.md](FBX-AUDIT.md) e [fbx-audit.json](fbx-audit.json). I due Kick Soccerball hanno hash distinti. L'inventario Mixamo non equivale a una prova di compatibilità bind/assi per il retarget futuro.

## Performance del modello originale

Tabelle OLD/NEW 1/2/5, scene reali a cinque Goblin e cinque viewport FPS: [PERFORMANCE.md](PERFORMANCE.md). Misure hardware e SwiftShader sono separate; dati grezzi `hardware-gallery-performance.json`, `hardware-context-performance.json`, `gallery-performance.json`, `context-performance.json`.

RTX 3050, Chrome headless ANGLE D3D11, 1280×720, dopo caricamento:

| Cinque Tripo | Intervallo frame medio | Draw call/frame | Sampler CPU | Skeleton.prepare CPU |
|---|---|---|---|---|
| Cornicione | 16,67 ms | 67 | 0,549 ms | 0,706 ms |
| Arena | 16,68 ms | 62 | 0,537 ms | 0,597 ms |
| Dodgeball | 17,15 ms | 91 | 0,497 ms | 0,649 ms |
| FPS, cinque viewport | 16,68 ms | 165 | 0,583 ms | 1,063 ms |

Queste scene caricate sostengono circa 60 FPS. Sono misure di stato stabile, non cinque persone che combattono/sparano contemporaneamente con il massimo dei VFX. VSync limita la lettura del margine residuo; la qualità resta quella della politica auto-quality esistente. Nessuna certificazione 1080p/4K o del picco di una partita completa.

Cinque istanze: 178.120 triangoli unici, 325 bones, 975 canali attivi. In FPS le viewport possono inviare più volte la stessa geometria. Una sola texture base color condivisa per scena: stima RGBA8 64 MiB, circa 85,33 MiB con mipmap completa, non allocazione driver misurata. I contatori materiali/texture di scena includono fallback nascosti, mondo, HUD ed effetti. Skeleton.prepare include il lavoro CPU delle matrici; non misura isolatamente skinning GPU.

LOD0 punta all'originale, LOD1/LOD2 sono slot futuri vuoti. Nessun LOD generato, nessuna texture ridotta a 2048/1024 e nessuna conclusione sulla loro indistinguibilità visiva.

## Test e prove

| Verifica | Esito / evidenza |
|---|---|
| Build finale, TypeScript + Vite | PASS, `build-final.log`; resta il warning dei chunk grandi |
| Controller animazioni | 135 controlli PASS, `animator-selftest.log` |
| Import, 28 pose, priorità/stati, 14 mosse + follow, root, contatti, fallback, disposal, RIMONTA reale | 76 controlli PASS, `integration.log` / `integration.json` |
| Cornicione renderer + simulazione reale | Dodge terra, dash aereo, wall cling/jump, fall, ring-out, corpo nascosto, respawn e landing PASS, `cornicione-physics.log` / JSON |
| Fighter / abilities / ability catalog | 165 / 82 / 929 controlli PASS nei rispettivi log; character selftest PASS |
| Gamepad fighter | PASS sia default Legacy sia NEW, `gamepad-fighter.log`, `new-gamepad-fighter.log`; corsa, salto/doppio salto, schivata, attacchi, ability e disconnessione |
| Fighter session | Due round PASS sia default sia NEW, `fighter-session.log`, `new-fighter-session.log` |
| Gamepad Dodgeball NEW | PASS, `new-gamepad-dodgeball.log` |
| Scene a cinque Goblin e FPS cinque viewport | PASS; skeleton indipendenti, mesh/material condivisi, nessun autoplay multiplo, contatori istanze a zero dopo dispose; context JSON/log |
| Attachment Dodgeball | Errore palla/mano dopo rotazione < 1e-5 nel test; eventi pickup/throw/catch verificati senza ritardo aggiunto |
| Soccer / Volley / Kart / FPS | PASS, `fallbacks-final.log`, `fallbacks.json`: fallback gesti, driver Legacy, armi visibili, maschere proprie, KO e respawn FPS |
| Results | Due ritratti victory/defeat visibili, atlas e istanze rimossi dopo shutdown, nessun errore; `results-final.log`, `results.json` |
| Gallery | Suite esistente 1366×768 e 1920×1080 PASS; preview e confronto finale in `visual-probe-final.log` |
| Lobby return / pause / reconnect | PASS; ritorno lobby in tutti i sette giochi 3D |
| Leak, quattro round richiesti | PASS: body/timer stabili, listener window +1, heap host 24→29 MB nei tre round misurati, telefoni circa 2 MB; `leak.log` |
| Produzione con due telefoni | Cornicione parte, chunk precaricato 7,3 s prima, nessun overlay debug o errore; `prod-bundle.log` |
| Gate e import sul bundle produzione | Nessun download GLB/default lab senza debug; import 36 clip/65 bones con debug, OLD/NEW funziona; `production.log`, `production.json` |
| Integrità / diff | SHA256 sorgente=copia; `git diff --check` PASS |

Le suite esistenti non sono state indebolite. L'unica aspettativa Gallery superata dal nuovo asset (una sola run) è sostituita con controlli più forti: 36 clip, 65 bones, 195 canali e idle reale. Le prove geometriche di contatto sono campioni deterministici delle finestre reali; non costituiscono approvazione artistica di ogni colpo in una partita competitiva.

## Problemi visivi e cosa manca alla sostituzione

1. La portata visiva di alcune mani/piedi è più corta della hitbox; uppercut/heavy e down light meritano un passaggio lento con box visibili. Il timing segue le finestre reali ma non certifica anatomia o leggibilità.
2. dAL/dAH restano Legacy perché le clip disponibili non comunicano un colpo discendente. L'alternanza di sagoma durante questi fallback e i gesti sportivi è visibile ed è accettata soltanto per il pilot.
3. Run non è perfettamente ciclica: il blend nasconde la discontinuità, ma foot sliding va valutato alle diverse velocità e alle distanze camera reali. Non è presente un foot IK; dash/dodge e transizioni possono produrre piccoli scivolamenti/intersezioni.
4. Mani, braccia vicine al torso e orecchie/capelli non mostrano esplosioni del rig nei campioni esaminati. Non è stata garantita l'assenza di clipping in ogni combinazione: niente collisioni accessori/corpo o facial morph.
5. Arma FPS ancora senza presa delle mani/upper-body weapon hold dedicato. I precedenti oggetti arma restano corretti; serve una posa compatibile prima del default Tripo.
6. Kart necessita di seated driving e verifica mani/volante e gambe/telaio. L'esperimento DEV non è approvato.
7. La maglia è quella nera nella texture originale unica. In Calcio/Volley restano cartellini/forme/etichette squadra, ma il tessuto Tripo non assume il colore di squadra: servirà una maschera o una separazione del materiale.
8. Results usa ritratti piccoli nello spazio UI esistente: body acting è visibile, espressioni facciali limitate. Nessun redesign della schermata.
9. Prima dello swap: revisione artistica dei contatti, sostituzione delle pose mancanti, retarget Soccer in fase separata, e partita intensa a cinque giocatori alla risoluzione/qualità di lancio. Solo dopo quei dati valutare eventuale texture 2048 o LOD futuri.

## Screenshot

Directory: `C:/Users/niluf.PC-NIKO/Desktop/Ricchioni/e2e-shots/goblin-animations/`.

- `legacy-tripo-idle.png`: confronto finale con stessa camera/luce/riferimento scala.
- `skeleton-attachments.png` e `gallery-*.png`: diagnostica e preview.
- `cornicione-idle.png`, `cornicione-nL-contact.png`, `cornicione-sH-contact.png`, `cornicione-dH-contact.png`, `cornicione-uAH-contact.png`: pose delle finestre attive.
- `cornicione-dAL-contact.png`, `cornicione-dAH-contact.png`: fallback aerei.
- `cornicione-knockback.png`, `cornicione-rimonta.png`, `cornicione-victory.png`, `cornicione-defeat.png`.
- `dodgeball-pickup.png`, `dodgeball-throw.png`.
- `results-victory-defeat.png`: entrambe le presentazioni nello stesso screenshot.
- `cornicione-5goblins.png`, `arena-5goblins.png`, `dodgeball-5goblins.png`, `fps-5goblins.png`: scene misurate.
- `legacy-kart-driver.png`: driver procedurale mantenuto.

## Stop

Integrazione Goblin pilota conclusa qui. Gameplay, collider/hitbox/hurtbox, frame data, danni, fisica, scoring, input, networking, ability balance e round logic non sono stati modificati. Nessun lavoro avviato sui modelli degli altri personaggi. Legacy rimane disponibile e ufficiale; Tripo rimane opt-in finché i limiti visivi elencati non sono accettati o risolti.
