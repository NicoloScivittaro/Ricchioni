# GEOFALL — Il mondo crolla

12 ottobre 2026. Baseline pulita `aa91c9f`; implementazione con il root autorizzato senza Flash. Modifiche locali, nessun push/deploy o commit automatico.

## Gioco implementato

GEOFALL è il quattordicesimo minigioco, indipendente dagli altri. Nel checkout analizzato non era presente un gioco con caselle che crollano: Memoria usa quattro tessere di sequenza 2D, Arena una piattaforma che si restringe. Non sono stati sostituiti né modificati. Riutilizzati `ArenaEntity`, le quattro skin Tripo e Victor esistente, `InputManager`, profili pad, controller telefonico a schema, audio, qualità, wrapper Phaser/Babylon, `ctx.finish` e `ScoreManager`.

L'arena contiene esattamente dieci quadrati contigui in una griglia 2 × 5, lato 5 m, e una zona neutra collegata larga 12 m. Non ci sono buchi da saltare. Velocità comune 6,5 m/s e collider di raggio 0,46 m; il test di raggiungibilità arriva alla casella lontana in meno di quattro secondi. La piattaforma corretta ospita tutti e cinque, con separazione morbida che evita il blocco totale dei passaggi. Camera dell'intera arena, nomi piccoli e anelli colorati; risposte grandi sulle caselle, domanda e timer sopra, cinque schede cuori sotto.

Ogni partecipante parte con tre vite. Presentazione 1,8 s, poi timer 10 s nei round 1–5,8 s nei 6–10 e 6 s dall'11. Allo scadere si registra il centro del collider sul pianoXZ: intervalli semiaperti tra le caselle, bordo esterno incluso, spawn escluso. Il giudizio non cambia durante l'animazione; non c'è comando di salto. Le nove risposte sbagliate scendono simultaneamente; ogni errore sottrae una sola vita. Crollo 1,8 s e ricostruzione 0,9 s prima della nuova domanda. I cuori e la scritta−1 VITA indicano il danno; alla terza perdita il personaggio diventa spettatore, con input e collisioni disattivati.

Ogni giocatore ha una spinta per round, anche se manca. Colpisce il bersaglio più vicino davanti, entro 2,25 m, con breve barcollamento 0,18 s e protezione 0,7 s. Può cambiare la casella dell'avversario, ma il contenimento nel perimetro impedisce una caduta immediata. Il bersaglio può tornare indietro prima della scadenza. Nessuna differenza di statistiche tra personaggi e nessuna abilità, power-up o piattaforma mobile.

Quando rimane uno solo, vince. Se gli ultimi perdono insieme la terza vita, soltanto quei partecipanti ricevono una vita per lo spareggio; chi era già spettatore rimane escluso. Nuova domanda e ripetizione se tutti perdono ancora. Il sacchetto evita anche la ripetizione immediata di una domanda quando viene rinnovato. Nessun numero massimo di round nelle regole. Il watchdog server esistente ha un cap tecnico esterno di un'ora; non introduce una vittoria artificiale nel motore Geofall.

La classifica include tutti: vincitore, eliminazione più tardiva, risposte corrette, ordine deterministico del roster. I punti globali e il modificatore PUNTI DOPPI rimangono responsabilità del `ScoreManager`.

## Domande e immagini

Database locale di 100 domande:20 BANDIERE,20 CONFINI,20 CAPITALI,20 SAGOME,20 MONUMENTI. Ogni domanda ha identificativo, categoria, testo, difficoltà, una risposta corretta, nove distrattori e riferimenti alle fonti; le immagini sono indicate sulle opzioni. Ogni categoria compare una volta per ciclo di cinque; ciascuna ha un sacchetto di domande senza ripetizione fino all'esaurimento. Le dieci risposte vengono mescolate a ogni round. Nuovi quesiti si aggiungono al JSON senza cambiare le regole del gioco.

Sono presenti 60 SVG:20 bandiere flag-icons/MIT,20 sagome Natural Earth/public domain,20 illustrazioni schematiche originali dei monumenti con didascalia. Nessuna API o CDN a runtime. Capitali e adiacenze GeoNames sono controllate sullo snapshot e integrate con fonti nazionali per confini territoriali omessi dal dato grezzo. In particolare, la Francia non è un distrattore del Brasile; la domanda sulla Francia specifica «metropolitana». Capitali multiple/contestate escluse; Washington è esplicitamente Washington,D.C. [Fonti, licenze e tabella dei 20 paesi](SOURCES.md), [snapshot](source-snapshot.json), [audit accessibilità delle pagine](monument-source-audit.json).

Alcuni siti istituzionali rispondono 403 allo script di download delle pagine; le fonti UNESCO/MyHelsinki sono state consultate tramite ricerca web. Il relativo JSON conserva gli erroriHTTP e non li presenta come download riusciti. I file di gioco sono tutti locali e non dipendono da questi siti.

## Comandi e telefono

| Azione | Pad | Telefono |
| --- | --- | --- |
| Movimento | Stick sinistro | Croce direzionale |
| Spinta | A/✕, una per round | SPINTA |

Il telefono mostra round, cuori, spinta pronta/usata e stato spettatore. I tasti restano disabilitati prima del primo stato autoritativo, durante le fasi non giocabili e dopo l'eliminazione. Niente sistema di input parallelo o pulsanti abilità. Pad scollegato: fallback al telefono e cancellazione degli input; pausa: clock e movimento fermi. Ricaricamento del client e riconnessione conservano il partecipante della stanza. Gli avvisi pad sono spostati ai lati soltanto mentre è montato l'HUD Geofall, così non coprono la domanda.

I bot usano lo stesso movimento e la stessa spinta. Scelgono dopo un ritardo, possono sbagliare e non si teletrasportano sulle risposte. Supportano la partita con un solo umano tramite il riempimento bot già esistente del server.

## Verifiche eseguite

| Prova | Esito / evidenza |
| --- | --- |
| Typecheck e build | Entrambi senza errori; output ed exit code in [build.json](build.json). Rimane il warning preesistente sui grandi bundle Babylon/main. |
| Regressione automatica | Nove suite passate: Geofall, pad, abilità, round, bot, audio, Minigolf, qualità, animazioni. [Output](regression.json). Geofall è esplicitamente escluso dall'obbligo di abilità del catalogo. |
| Database |100 ID unici,20/categoria,10 opzioni e 10 etichette distinte, una corretta, asset esistenti, controlli sui confini e test specifico Francia/Brasile e Canada/Danimarca. |
| Regole | Snapshot irrevocabile, spawn/bordi, danno singolo, spinta mancata e consumata, protezione/recupero, cambio effettivo di casella, nessunKO da spinta, cinque sulla stessa casella, ultimi pari soltanto, spareggio ripetuto e 2000 estrazioni senza ripetizione immediata. |
| Simulazione | Posizione e clock coerenti a 30/60/120;48 partite naturali 2–5 con 12 seed per numero di partecipanti. I FPS indicano qui cadenze simulate della fisica. |
| Browser misto | Cinque client, Xbox/PlayStation/generico simulati nel vero percorso InputManager, touch multitocco movimento+spinta, CONTROLLI, pausa, reload, fallback, cinque categorie e immagini. [Esiti](browser.json). |
| Crollo e spettatori | Nove altezze identiche, unica piattaforma stabile, tutti e cinque salvi sulla stessa risposta, una vita persa nello spawn, spostamento tardivo ininfluente e spareggio fra due soli ultimi pari. Screenshot ispezionati. |
| Risoluzioni | TV 1280 × 720,1920 × 1080,800 × 600; spettatore telefono 390 × 800,360 × 640,844 × 390. Audit attivo di Geofall/Memoria/Arena/Minigolf su 12 viste, senza scroll o pulsanti fuori schermo. [Catture](controllers/). |
| Stanze reali 2–5 | Stanza server e numero di attori verificati prima di ogni prova, un client e riempimento bot esistente; guida automatica di tutti gli attori con bot e simulazione accelerata. Fine naturale, punti globali e lobby per tutti e quattro i conteggi. [Esiti](rooms.json). |
| Memoria originale | Prova browser con eliminazioni intermedie: esattamente cinque round e un invio finale. [Log](memory-regression.log). |
| Produzione | Menu/rullo reali,60 SVG e quattroGLB originali, tre perdite naturali del client fermo nello spawn, spettatore dopo 37,5 s, quattro bot imperfetti, vincitore naturale e classifica completa dopo 174,9 s dalla prima disponibilità del telefono. Nessun import dev o finish iniettato; zero errori di pagina. [Esiti finali](production.json), [prima prova prima dell'audit territoriale](production-before-content-audit.json). |
| Risorse | Sei cicli carica/uscita, due warmup, tre misure e podio finale: una scena/un canvas, zero overlay residui, timer/listener e audio stabili, heap host+0,4 MB, telefono circa 2,5 MB. [Esiti](resources.json). È un audit finito, non una garanzia per qualsiasi durata. |
| Rendering | Campione di 360 frame effettivamente renderizzati in 6 s, cinque personaggi con quattro skin importate,1280 × 720 su RTX 3050/ANGLE D 3D 11: circa 59,9 FPS,194 mesh,37 texture,97 materiali. [Dati](performance.json). |

L'audit risorse forza i risultati per ripetere il ciclo di vita; le prove dei risultati naturali sono distinte. Nessuna nuova prova completa dei restanti 13 minigiochi viene dichiarata. [Note sulle fixture, sulle correzioni e sul raro errore WebGL iniziale](QA-NOTES.md).

## Screenshot controllati

- [Arena compilata con cinque personaggi](production-five.png).
- [Bandiere](category-bandiere.png), [capitali](category-capitali.png), [sagome](category-sagome.png), [monumenti](category-monumenti.png).
- [Nove piattaforme in caduta](collapse-nine.png) e [spareggio fra soli due ultimi pari](final-tie.png).
- [Telefono attivo](production-phone.png) e [spettatore](production-spectator.png).
- [Classifica naturale compilata](production-results.png).
- [Verifica finale e hash dei sorgenti](FINAL-VERIFICATION.json).

## File modificati

- Nuovo modulo `src/minigames/geofall/`: wrapper, renderer/HUD, regole e bot.
- Nuovi `shared/geofallQuestions.ts`, `geofallQuestions.json`, `geofallCountries.json` e `public/geofall/` con asset/licenza.
- Integrazione additiva: `shared/minigames.ts`, `src/input/profiles.ts`, `src/minigames/preload.ts`, `src/controller/main.ts`, `src/core/AudioManager.ts`, `src/core/musicThemes.ts`. In `GameManager.ts` è aggiunto soltanto Geofall alla lista che cancella gli input alla disconnessione.
- Test/strumenti nuovi `geofall-selftest.ts`, `regression-geofall.mjs`, `build-geofall-check.mjs`, generator/auditPython e quattro script browser `geofall`, `geofall-rooms`, `geofall-production`, `geofall-perf`. Adattati i test abilità/round al gioco senza abilità e allo spareggio senza cap interno.
- Documentazione: scheda progetto, licenze e questa cartella con piano, report, fonti, screenshot ed evidenze.

Il file generato `dist/index.html` viene ripristinato dopo la prova compilata secondo la procedura del progetto; per servire la versione di produzione, eseguire nuovamente `npm run build`. I sorgenti aggiornati rimangono disponibili nella preview Vite.

## Limiti e playtest umano

Non sono stati usati pad fisici né telefoni su Wi-Fi reale: sono client Chrome con input CDP e Gamepad API simulata. Le illustrazioni dei monumenti sono schematiche, non fotografie. Le sagome rappresentano il territorio principale con isole vicine; non sono mappe giuridiche. Le fonti sono tracciate e le opzioni verificate, ma aggiungere nuovi paesi richiede una nuova revisione geografica dei distrattori.

Un primo test accelerato 5 p ha rilevato un erroreWebGL `program` nullo; non si è riprodotto nella ripetizione mirata, nel test finale delle stanze né nella partita compilata a tempo reale. La fixture ora attende skin/rendering e non esegue un render manuale dopo i risultati. Il messaggio iniziale è documentato e non viene dichiarato risolto con una causa certa.

Da provare con amici: leggibilità dei dieci simboli dalla distanza reale della TV, difficoltà delle sagome/monumenti, forza e recupero della spinta, protezione 0,7 s e pressione del timer 6 s. Il finale può durare oltre la stima 180 s se i superstiti continuano a rispondere correttamente: è coerente con lo spareggio richiesto, non viene introdotto un vincitore arbitrario.
