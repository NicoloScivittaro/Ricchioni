# Arena: spallata e instabilità

Implementazione root autorizzata senza Flash. Nessun commit, push o deploy.

Comandi verificati: A/✕ scatto, B/◯ abilità; X/□ libero diventa attacco. Tocco breve = spinta; tenuto e rilasciato = spallata direzionata dallo stick. Telefono: pulsante equivalente con proprietà del dito e cancellazione distinta dal rilascio.

Contratto: numeri comuni ai cinque personaggi; catalogo e logica delle cinque abilità invariati; arena e sudden death invariati. Instabilità aumenta solo dopo impatti effettivi, aumenta la vulnerabilità e recupera dopo una pausa dagli scontri. La spallata blocca la direzione e conserva inerzia; un mancato può eliminare l'attaccante. La fisica attuale taglia il knockback alla velocità di corsa: introdurre una finestra breve di slancio, con limite finito, senza aumentare la forza base dello scatto. Controspinta rinviata al playtest umano.

Accettazione: KO entro 15 s su arena grande, mancato con auto-caduta, spinta rapida corta, accumulo/recupero e uniformità; protezioni abilità e attribuzione colpi; cancellazione pausa/disconnessione/dito/decesso; bot tramite input normali; pose importate mantenute, HUD e telefono leggibili; sudden death/risultati/cleanup; typecheck, regressioni pertinenti, browser e build. Prova produzione con un umano simulato e quattro bot, senza DEV né tempo accelerato. Divertimento e bilanciamento finale richiedono amici con pad reali.
