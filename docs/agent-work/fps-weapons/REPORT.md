# Sparatoria — sette armi originali integrate

Modelli GLB presenti in prima persona e sulle armi degli avversari, in tutte le mappe di Sparatoria (renderer condiviso). Le armi entrano nella normale rotazione a ogni vita; USP45 è una settima arma aggiunta.

| Modello | Ruolo nella modalità |
| --- | --- |
| AK-47 | Mitraglia del Goblin |
| M4A1 | Raffica da tre colpi |
| Sniper | Cecchino, precisione |
| Ray Gun | Bombarda, esplosione ad area |
| Ray Gun V1 | Dispersione da vicino |
| Minigun | Raffica rapida, caricatore da 90 |
| USP45 | Pistola: 24 danni, caricatore da 12, ricarica 1,35 s |

Statistiche di combattimento delle sei armi preesistenti verificate identiche; cambiano modello e nome. La pistola usa gli stessi sistemi di danno, munizioni, ricarica e selezione.

Asset ottimizzati da **92.6 MB a 31.0 MB** complessivi: texture fino a 1024 px, geometria delle armi mantenuta, posa statica delle armature normalizzata, esclusi soltanto gli oggetti di controllo aggiunti da Blender nella collezione `glTF_not_exported`. File originali nei Download invariati, verificati con SHA-256. Materiali adattati alle luci già esistenti, compresi gli emissivi della Ray Gun.

Caricamento su richiesta, asset/texture/geometria condivisi per scena fra prima persona e avversari. Cinque M4A1 in split-screen richiedono un solo caricamento del GLB. Gli ID/mask restano separati per ogni giocatore. Il modello provvisorio resta disponibile durante il caricamento o in caso di errore.

ADS posizionato in base all’altezza del modello per lasciare libero il reticolo. Preservati rinculo, estrazione, bob/sway e animazione generale di ricarica; lampi alla nuova volata, anche sugli avversari. Le parti meccaniche delle armi sono statiche: nessuna nuova animazione scheletrica di caricatore o rotazione delle canne.

Verifiche: sette modelli caricati e controllati visivamente; prima persona, ADS con reticolo libero, rinculo/lampo/posa di ricarica; cinque visuali con maschere corrette, armi degli avversari, cache condivisa; client telefono con USP45 e smontaggio scena senza errori; confronto delle statistiche e degli originali. [Evidenze browser](browser-checks.json), [contratti e dimensioni](contracts.json), [manifest sorgenti](assets.json). Typecheck e build finale passati (3m 44s); log in [build.log](build.log).

Nessun nuovo test multiplayer lungo o benchmark FPS. Controller fisici non verificati. Nessuna nuova dipendenza, nessun commit/push/deploy; lavoro locale.
