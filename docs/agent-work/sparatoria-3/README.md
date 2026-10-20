# Sparatoria 3.0

- Sei armi attive e sola Ray Gun rossa, come già confermato. La V1 rimane esclusa. Danni e statistiche della 2.4 invariati, compreso il potenziamento minigun.
- Rinculo visivo immediato, molle e ritorno naturale; AK più deciso, M4 più stabile, USP più rapida, sniper più pesante. Solo micro-roll della camera: il centro della mira non si sposta per l’effetto cosmetico.
- Oscillazione con assestamento, inerzia limitata, estrazione e ricariche differenziate. Modelli sorgenti monoblocco senza clip: niente carrelli/otturatori/canne mossi arbitrariamente. La minigun usa vibrazione e motore audio in accelerazione/rilascio, senza deformare il GLB.
- Bossoli in un pool di tre per visuale; lampi ridotti per non coprire il bersaglio. Impatti con 48 istanze condivise per scena: metallo, cemento, vetro, legno; fallback neutro quando il materiale non è identificabile. Nessuna distruttibilità nuova.
- Terminal: 42.605 triangoli di collisione associati a categorie ricavate dai materiali originali, in un sidecar di 86.516 byte. Gli altri restano neutrali. arena.json e tutte le coperture invariati. Nessun ritocco ambientale ulteriore.
- Traccianti sul telefono dagli endpoint autorevoli, mai da un secondo raggio cosmetico; audio e rinculo locale restano immediati. Ray Gun conserva proiettili swept e impatti energetici originali.
- Hitmarker, reazioni al colpo/KO riutilizzati; decadimento visivo indipendente dal frame-rate. Kill con nome e notifiche di vendetta/doppia/serie/leader basate esclusivamente su eliminazioni reali. HUD split più compatto.
- Audio attraverso SFX/mute/volume esistenti, budget per nodo audio, suoni critici prioritari, attenuazione dei nemici, nessuna ripetizione per viewport. Il motore minigun è uno per tiratore e si rilascia automaticamente.
- Bot: preferenze di distanza, ritirata/ricarica e copertura quando raggiungibile, differenze prudenti/aggressive/laterali. Percezione ogni 120 ms, percorsi ogni 650 ms; LOS nuovamente controllata prima di sparare. Nel Cantiere rimosso l’inseguimento delle posizioni attuali dei nemici dietro i muri, sostituito da memoria temporanea e pattugliamento. Input e collisioni ordinari conservati.
- Ricarica telefono corretta: la fine del timer locale non inventa munizioni; completamento e progresso arrivano dall’host, incluse ricariche anticipate dalle abilità.

## Verifiche

Sei modelli arma, impulso rinculo, ricariche e mancato rifornimento anticipato; completamento autorevole; scope 4× trasparente con variazione della direzione pari a zero dopo rinculo cosmetico; danni USP 30, consumo munizioni, protezione spawn, eliminazione e muro che blocca il colpo; notifiche vere di vendetta/doppia. Brevi simulazioni con FpsScene e input bot reali su Cantiere, Nuketown e Terminal: spari/danni/kill e coordinate valide su tutte. Niente dispositivi fisici né suite degli altri minigiochi.

Verifica visiva ripetuta per correggere bounds iniziali del pool e attendere compilazione shader prima delle catture. I campioni con culling non valido sono stati scartati. Un campione bot con typecheck concorrente non è utilizzabile per confronto.

Campione finale controllato: RTX 3050, 1280×720, scala 1, cinque visuali, stesse posizioni e M4 della 2.4, con fuoco e ricariche effettivi: **58,40 FPS**, p95 **16,8 ms**, 190 colpi totali durante warm-up/campione. La 2.4 ferma era a 59,5 FPS: non sono carichi identici. Le scene dinamiche con bot e armi miste hanno mostrato cali: non si garantiscono 60 FPS costanti.

Typecheck e build finale superati (3m 50s, avviso sulle dimensioni dei chunk). Client compilato: tracciante allineato all’endpoint con errore 1,4e-9 m, pool impatti attivo, anteprima cinque bot con 27 colpi, mute verificato e ripristinato, 17 voci audio. Esiti in production-checks.json. Nessun commit, push o deploy. Quattro screenshot; anteprima locale opzionale in preview.html, eseguita con sorgenti dal server Vite, senza modificare il gioco pubblicato.
