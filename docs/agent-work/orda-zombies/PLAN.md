# Orda — Mystery Box e tre colpi

Implementazione diretta, rispettando la precedente richiesta di usare Sol senza Flash. Base: modifiche FPS pack non committate, conservate in baseline.

Contratto: +50 punti personali per ogni uccisione confermata dall’host; saldo iniziale zero; estrazione a 950 solo su interazione vicina. Una cassa fisica condivisa con fasi idle/rolling/ready/closing, proprietario esclusivo, ritiro volontario e scadenza. Nessuna cassa gratis passando sopra. Dieci armi esistenti, escludendo quella già equipaggiata.

Tre impatti validi per morire, indipendenti dal danno del mostro; protezione breve dopo ogni impatto contro danni ripetuti per frame. Il pronto soccorso esistente recupera un colpo. Nessuna rigenerazione passiva. Manteniamo ondate, ultimo vivo vincitore, mappe/armi/animazioni già funzionanti e gli altri minigiochi.

GLB: conservare versioni originali chiusa/aperta e materiali, ottimizzare texture senza dipendenze nuove, attribuzioni e hash originali. Pad RB/R1 e pulsante telefono CASSA; HUD saldo, costo, stato e colpi rimasti. Bot soggetti agli stessi costi, distanze e tempi.

Verifiche mirate: saldo e premio univoco, 949/950 punti, concorrenza/proprietario/scadenza/morte, danni e cure, percorso input pad/telefono, GLB nella scena reale, typecheck e build finale. Nessun commit/push/deploy.
