# Ferro e Furia e caricamento definitivo

Implementato FERRO E FURIA nel catalogo e nel rullo:2–5 partecipanti, tre round, selezione indipendente prima di ogni round e spareggi reali. Una visuale per ciascun umano; i bot rimangono nel mondo e non creano finestre.

| Arma | Combattimento | Special |
|---|---|---|
| Spada | Leggero, pesante, combo di tre pose | Contrattacco dopo parry |
| Lancia | Affondi stretti con punta attiva e distanza utile | Carica bloccata dalle coperture |
| Arco | Tensione e rilascio, frecce fisiche con gravità, dieci frecce recuperabili nel tempo | Perfora fino a tre bersagli, mai i muri |
| Ascia | Fendenti ampi e recupero visibile | Rotazione, un impatto per avversario |
| Martello | Colpi lenti e pesanti | Onda a terra con linea di vista |
| Doppie lame | Due finestre distinte, portata corta | Scatto e due fendenti |
| Spada e scudo | Difesa frontale con stamina, vulnerabile alle spalle | Colpo di scudo con interruzione breve |

Hitbox percorse nelle sole finestre attive, parry130ms, schivata direzionale con breve invulnerabilità e recupero. Arena originale con tribune, colonne, cancelli, coperture e sei griglie di fuoco preannunciate. Dopo90s il cerchio si restringe senza assegnare arbitrariamente il vincitore. La sopravvivenza vale più delle eliminazioni; anche le doppie eliminazioni finali e le parità di punteggio si risolvono in duello.

Camera terza persona con inseguimento fluido, collisione sui muri/colonne e mira sulla spalla per l’arco. La targhetta del proprio personaggio è nascosta nella propria camera; quando un ostacolo costringe la camera a stringere, il proprio corpo sfuma per lasciare leggibile il bersaglio. Bot con percezione ritardata, memoria limitata, navigazione, gestione della distanza e delle stesse risorse dei giocatori. Effetti riutilizzati, geometria statica raggruppata, materiali condivisi e audio originale limitato nel numero di voci.

Identità e accessori dei cinque personaggi registrati preservati, senza bonus statistici nascosti. Animazioni procedurali mirate con braccia articolate e impugnature dedicate: non sono clip professionali o motion capture.

## Caricamento e Backrooms, richiesti successivamente

Barra di attesa sopra canvas e HUD fino al completamento degli asset definitivi, dell’aggancio dei personaggi e della preparazione di texture/shader. Controlli, fisica e countdown vengono trattenuti durante la preparazione. Tutte le piste di Ribaltati attendono anche i piloti; Sparatoria e Orda precaricano le sorgenti delle armi, senza mostrare le armi provvisorie al cambio. Inizializzata anche una texture popup vuota che altrimenti impediva alla scena di diventare pronta. Se una risorsa richiesta fallisce rimane disponibile il recupero del caricamento, senza promuovere silenziosamente il modello di ripiego.

Nelle Backrooms lo sprint continuo passa da circa7 a4secondi; recupero completo5secondi e ripartenza dopo almeno30% di barra per evitare il passo intermittente a resistenza esaurita. Nessuna modifica ai mostri.

## Verifiche

Passati test mirati della logica, transizioni dei tre round e spareggi; sessione reale con due umani attraverso Socket.IO, selezione con pad simulato e telefono, freccia fisica con danno, annullamento su blur senza sparare e cleanup; cinque visuali e sette modelli; minigolf con download GLB deliberatamente trattenuti; disponibilità delle armi finali in Sparatoria; resistenza Backrooms; typecheck e build.

**59.3FPS**, cinque visuali,1920×1080,RTX3050, singolo campione di circa6secondi. È una misura della fixture con renderer e simulazione reali e HP aumentati solo per mantenere cinque combattenti durante la misura; non è un benchmark multiplayer di rete né una garanzia su altri PC.

Limiti: nessun controller fisico provato; animazioni procedurali. Il caricamento è stato provato su scene rappresentative, senza ripetere tutti gli altri minigiochi. Nessun commit, push o deploy.
