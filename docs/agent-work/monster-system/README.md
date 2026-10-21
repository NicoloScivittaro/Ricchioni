# Monster System 1.0

Warrok è integrato in Orda Finale dalla sesta ondata, massimo due vivi contemporaneamente. GLB unico: 12.626 triangoli, 81 ossa, tre texture incorporate e otto clip: Idle, Breathing Idle, Walking, Run, Jumping, Roaring, Punch e Dying.

Rig FBX: gerarchia, matrici di riposo e trasformazioni identiche negli undici file ispezionati; hash degli originali invariati. Gli 81 elementi importati sono ossa effettive, distinti dal nodo Armature. Jump Attack e Swiping sono stati verificati ma non aggiunti alle otto clip richieste.

Il sistema condiviso usa cache GLB, dati delle clip/geometria/materiali condivisi e rig/clock indipendenti. Blending fra pose, cadenza adattata a velocità e proporzioni, root motion orizzontale rimosso, salto governato dalle collisioni. Passi ricavati dai contatti delle clip; ruggito, swing, impatto valido e morte usano sintesi audio originale nel mixer esistente. Pool limitato, aggiornamento animazioni 30Hz host/20Hz telefono, bounds conservativi per evitare sparizioni ai bordi della camera.

Pugno Warrok: preparazione, impatto 0,27–0,37s (picco della mano verificato nel renderer a 0,30s), recupero fino a 1,1s e cooldown 0,7s. Verificati distanza, altezza, orientamento, bersaglio vivo, ostacoli e un solo danno. Gli altri umanoidi mantengono i propri tempi di combattimento: cambia soltanto la sincronizzazione della posa. Dying una volta sola, AI/danni fermati subito, corpo conservato per 4,8s salvo cambio scena a fine partita.

| Modello / ruolo | Animazione |
|---|---|
| Warrok | Otto clip native sul rig identico |
| Infetto / Colosso | Hazmat, retarget offline: 65 ossa mappate su 66 joint |
| Corridore di Orda / Partygoer di Backrooms | Partygoer, 22 joint principali mappati su 69; proporzioni, bind e rami twist originali preservati |
| Imitatore mascherato | Hazmat retarget; hook implementato, sequenza naturale di rivelazione non provata |
| Bacteria / Cacciatore / Macellaio | Parti rigide senza scheletro: animazione specifica conservata |
| Smiler / Assalitore | Anatomia non umanoide a 22 joint: procedurale specifica conservata |
| Stalker, Corridore Backrooms, Imitatore rivelato, Hound, Watcher, Howler | Creature procedurali prive di rig skinnato compatibile: mantenuta animazione dedicata |

Test: asset e root motion; sei controlli logici mirati; otto clip su tre rig; dieci Warrok con scheletri/clock indipendenti e geometria condivisa; prova compilata con cinque visuali e due Warrok, modelli arma reali, preparazione/impatto/morte e sincronizzazione umanoidi. Backrooms: Partygoer, cattura/recupero/prima e seconda vita, nessun HP aggiunto; nella versione compilata anche animazione della cattura. Typecheck e build riusciti, nessun errore JavaScript rilevato.

Prestazioni: **59.3 FPS medi** nel singolo campione di sviluppo di 6 secondi, RTX 3050, cinque visuali, risoluzione interna 1669×939 (schermo 1920×1080, scala 1,15), 6–13 nemici vivi fra cui due Warrok. Solo l'harness ripristina gli HP per mantenere cinque camere; AI e rendering reali. Campione precedente agli ultimi ritocchi a eventi/cadenza/bounds, non ripetuto come richiesto. Nessuna promessa per ondate al limite di 22 nemici o confronto diretto con misure precedenti.

Limiti: licenze dei nuovi FBX da verificare prima di pubblicare; non sono stati forniti documenti di licenza. Non eseguite prove prolungate o con pad fisici. Nessun altro problema bloccante osservato nei controlli mirati. Nessun commit, push o deploy. Esecuzione diretta con Sol.

Configurazione: `src/monsters/MonsterAnimator.ts`; bilanciamento locale: `shared/orda/warrok.ts`; pipeline offline: `tools/monsters/`. Provenienza: `public/assets/monsters/CREDITS.md`.
