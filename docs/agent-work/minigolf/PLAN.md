# Minigolf dei Disagiati — contratto e milestone

Specifica: allegato 51f084d2-0f66-4a98-9ce1-aac5d81740a9, letto integralmente. Baseline pulita `d9934d8`. Root implementa secondo autorizzazione già concessa senza Flash. Sei piste verificate, tre selezioni senza ripetizioni (facile/media/difficile), simultaneo 2–5p e bot in solo. Nessun asset nuovo generato o servizio a pagamento.

Architettura: modulo Phaser auto-caricato dal registry; Babylon canvas dedicato e menu ESC con cleanup; simulazione pura con passi fissi 1/120 s e sottopassi limitati da distanza percorsa, collisioni di contatto (mai rallentamento per vicinanza); pavimenti con pendenze e piattaforme mobili, urti capsule/muri/bumper/palline, volo e reset. Identiche statistiche base. Input unico `aim`, `shoot`, `cancel`, `ability`; versione di cancellazione e blocco fino al rilascio su fasi/pausa/disconnessione. Modificatore punti doppi soltanto.

Regole iniziali: 50 s/buca, massimo 8 colpi (l'ottavo può completare finché la pallina rotola), DNF almeno 10 colpi senza cancellare penalità, fuori pista +1 dall'ultima zona sicura, stallo tecnico ripristinato senza penalità. Ciro tiro ×1,35; imbucata nella finestra abbuona il colpo speciale (minimo 1 colpo/buca); altrimenti +1. Tutti i numeri delle abilità nel catalogo. Ranking colpi, penalità, hole-in-one (un solo tiro realmente effettuato e zero penalità), tempo, ordine roster deterministico. Solo ScoreManager assegna punti globali.

M1: fisica, pista corridoio, tiro press/hold/release/cancel, buca/colpi; test pura e browser 2p.
M2: registry/profilo, cinque palline, telefono ownership multitouch, camera/HUD, risultati e Companion Card; typecheck e browser 5p.
M3: sei piste diverse, tre buche, superfici/dinamici/pendenze, cinque abilità, bot con waypoint e errore deterministico; test tutte piste/abilità, round naturali 2–5p.
M4: personaggi esistenti, mazza separata all'attacco mano (posa provvisoria), luci/ombre/VFX/audio/musica/preload; screenshot sei piste e varie risoluzioni, performance 5p, controller/pausa/rejoin e regressione dei dodici giochi, build, report italiano e commit locale dedicato. Niente push/deploy.

Rischi: urti veloci (sottopassi spaziali e test crossing), ghost shot (cancel prima di release), stallo pendii (soglia/punti sicuri e watchdog), abilità bumper abusivo (vietato presso buca/spawn e bordi), memoria cambio pista (dispose geometria e pool VFX), UI shared (aggiunte strettamente additive). Il feel e il bilanciamento finale richiedono playtest umano: numeri iniziali documentati, nessuna pretesa di bilanciamento fine.
