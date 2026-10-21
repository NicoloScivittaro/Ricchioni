# Monster Expansion 1.2

Quattro modelli integrati. Warrok ingrandito del **20,75%**, riferimento visivo 2,65 → 3,2 e hitbox/collisioni locali adeguate; 900 HP e 40 danni base. Gli altri nemici comuni di Orda hanno statistiche più forti senza cambiare il registro delle sei armi o Sparatoria.

| Creatura | Clip | Ruolo e introduzione |
|---|---:|---|
| Warrok | 13 | Bruto, dalla sesta ondata, massimo due vivi; Punch, Swipe pesante, Roar, Jump Attack |
| Zombiegirl | 10 | Cacciatrice rapida sui fianchi, dalla terza, massimo cinque vive; Swipe |
| Yaku | 11 | Predatore laterale, dall'ottava, massimo tre; scatto breve e Jump Attack |
| Pumpkinhulk | 10 | Boss alle ondate 10/20/30…, uno; Swipe frontale, intimidazione e fase sotto 40% HP |

Tutti: Idle, Breathing Idle, Walk, Run, Jump, Turn Left, Turn Right, Swipe, Taunt/Flex, Death. Warrok conserva anche Punch e Roar; Warrok e Yaku hanno Jump Attack. Le otto clip precedenti e geometria/skin/materiali di Warrok sono preservati esattamente; nessun secondo Warrok. I quattro archivi hanno rig e pose di riposo differenti: conversione offline e adattamento delle rotazioni sulla posa di riposo del singolo modello, conservando le lunghezze delle ossa. Le varianti di svolta ridondanti non vengono caricate.

Gli attacchi usano tempi, danni, portate, velocità e recupero differenti. Swipe ha impatto nel punto ricavato dalla clip; Jump Attack segue i contatti del file sorgente (decollo circa 0,5s, atterraggio 1,6s, impatto 1,7s, adattati al rate di ciascun mostro). Preparazione segnalata, destinazione bloccata, percorso controllato a piccoli passi; niente salto attraverso muri o coperture e niente inseguimento magnetico in aria. Un solo danno per azione, con controllo di distanza, altezza, orientamento, ostacoli e bersaglio vivo. Morte prioritaria, offesa interrotta e corpo conservato per la clip.

**Backrooms:** Zombiegirl dà il modello al Corridore, Yaku allo Stalker. Asset extra caricati soltanto se il ruolo è presente. Pattuglia +5%, inseguimento +7% con limite 6,8, udito +12%, ricerca +2s e reazione più rapida del 12%; Partygoer mantiene il comportamento di inganno, con scatto 2,3s e riposo 4,3s. Restano invariati visibilità/ostacoli, memoria sensoriale, protezione iniziale, immunità, nascondigli, due vite, puzzle, catture e fuga. Warrok e Pumpkinhulk rimangono esclusivi di Orda per non forzarli attraverso porte e corridoi.

**Prestazioni:** 48.6 FPS medi nel singolo campione di sviluppo di 6s, RTX 3050, cinque visuali, interno 1669×939 su 1920×1080 (scala 1.15). 20–22 nemici vivi, ondata mista con boss. Solo l'harness rifornisce gli HP a 1000 per mantenere cinque camere; non è una modifica del gioco. Campione precedente alla correzione della priorità cattura/svolta, non ripetuto. Carico diverso dalle vecchie prove: nessun confronto diretto fra questi FPS e i precedenti.

**Test eseguiti:** archivi/hash invariati; dati precedenti di Warrok preservati; skin weights normalizzati e curve finite; sette gruppi logici mirati (quattro attacchi, danni singoli/ostacoli, Jump Attack, morte, ondate e boss, sei armi e vittoria, Backrooms); quattro modelli con Idle/Walk/Run/Swipe/Death osservati a tre fasi; rig e tempi indipendenti con geometria condivisa; ondata reale mista e boss; salto e atterraggio nel renderer; Backrooms con i due nuovi modelli e cattura Swipe. Typecheck e build finali; prova della versione compilata senza errori JavaScript. Ripetuta soltanto la verifica pertinente dopo il problema cattura/svolta.

**Ottimizzazioni:** un GLB per creatura, niente FBX runtime o mesh per clip, texture incorporate a 1024px, geometria/materiali/clip condivisi, rig indipendenti, buffer delle clip sostituite rimossi, pool e culling esistenti, cap 22 nemici e aggiornamento grafico 30Hz host/20Hz telefono. Nessuna dipendenza aggiunta.

Limiti: licenze non allegate, da verificare prima di pubblicare; nessuna sessione prolungata o con pad fisici. Un cambio scena a fine partita può interrompere un cadavere ancora in animazione. Nessun altro blocco osservato nei controlli mirati. Nessun commit, push o deploy.
