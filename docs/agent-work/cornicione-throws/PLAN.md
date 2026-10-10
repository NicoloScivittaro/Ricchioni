# Cornicione: oggetti e calci strategici

Implementazione root, come già autorizzato dall'utente senza Flash. Scope: solo Cornicione e i suoi binding/presentazioni condivisi.

- Eliminare presa comune, stato vittima/holder, protezione, bot e istruzioni. Conservare la proiezione dell'abilità RB di Carbo.
- LB/L1/telefono: down inizia carica, up autentico rilascia, stick bidimensionale mira, neutro guarda avanti. Carica massima 1 s; niente auto-lancio. Reset, pausa, perdita input, colpo, schivata annullano senza lancio fantasma.
- Simulazione unica: ricarica 6 s al lancio; 4 danni, stesso knockback/raggio per tutti, velocità 18–30 m/s, vita .55–.85 s. Carica cambia solo velocità/portata. Anticipo al rilascio .10 s e recupero .28 s. Ammesso in aria, nessuna spinta recovery aggiuntiva.
- Collisione continua, prima vittima valida, parete del tetto, scadenza. Schivata attraversa; parata frontale temporizzata distrugge il proiettile senza stordire a distanza il lanciatore. Carbo mantiene counter corpo a corpo, senza teletrascinare un tiratore distante.
- Cinque oggetti Babylon nativi con effetti in pool: monete, granita, lattina, bottiglia verde, shaker. Nessun ostacolo a terra, cleanup su KO/fine/dispose, nessuna nuova dipendenza.
- Portata statica calcio laterale = 1.35 × (hit.x + hit.w/2 + PHYS.halfW) del pugno laterale, stessa formula per aereo laterale. Danno conservato, spinta aumentata e anticipo/recupero/penalità whiff conservati. Nessuna variazione delle 14 mosse originali o delle cinque abilità.
- UI: CONTROLLI, Companion, telefono con carica/ricarica live e HUD TV; animazione throw per i quattro rig Tripo, pose fallback per Victor. Bot mirano e alternano distanza/calcio/difesa/recovery.

Accettazione: test simulazione di tap/charge/direzione/aria/cooldown/equità/parata/dodge/cancellazione/collisione/TTL/KO; test preesistenti core/abilità/pad/rig; browser 5 giocatori, Xbox/DS/generic+telefono, pausa/rejoin, animazioni/oggetti, round naturale e cleanup; build e smoke produzione. Documentare misure reali e limiti del playtest automatico.
