# Minigolf dei Disagiati — redesign verificato

12 ottobre 2026. Baseline `91c5e96`. Implementazione con il root, come autorizzato dall'utente senza Flash. Nessun push o deploy. Le modifiche degli aggiornamenti precedenti sono conservate.

## Risultato

Il round ora usa una sola pista e turni rapidi, con una camera prospettica dietro la pallina attiva. La camera segue il tiro, arretra leggermente con la velocità e mantiene la direzione anche sui rimbalzi. Stick destro e trascinamento sul telefono ruotano la visuale; la panoramica dura soltanto mentre si tiene il relativo tasto.

La camera verifica pavimento, pareti, bracci rotanti e bumper prima e dopo l'interpolazione. Vicino a una parete che impedisce di arretrare si alza localmente fino a 3,4 m sopra la pallina: questa eccezione evita di entrare nella sfera o di sovrapporla alla barra della potenza. La vista principale resta bassa e individuale. Il controllo mirato con cinque partecipanti verifica quattro direzioni a 1280×720, inclusa quella contro il muro.

Il giocatore ha sei secondi per preparare il tiro. Alla scadenza riceve un colpo, senza tiro automatico. L'ordine iniziale è mescolato dal generatore della partita; ogni giocatore esegue una giocata per rotazione. Il turno cambia solo quando tutte le palline coinvolte si fermano. Chi ha concluso viene saltato. Il tempo di attesa non entra nello spareggio.

Tutte le palline non imbucate rimangono fisiche sulla pista. Una bocciata può spostare o imbucare un avversario senza assegnargli un nuovo colpo; una caduta della vittima durante il tiro altrui viene ripristinata gratuitamente. La caduta durante il proprio tiro mantiene la penalità. L'ultimo colpo consentito può ancora terminare in buca prima del DNF.

## Comandi e regole

| Azione | Xbox / PlayStation | Telefono |
| --- | --- | --- |
| Orientare il tiro | Stick sinistro; avanti per regolazione fine | Joystick |
| Ruotare la visuale | Stick destro | Area di trascinamento CAMERA |
| Caricare e tirare | Tenere A / ✕, poi rilasciare | Tenere TIRA, poi rilasciare |
| Annullare | B / ◯ | ANNULLA |
| Panoramica temporanea | Tenere Y / △ | Tenere PANORAMICA |
| Abilità | RB / R1 | ABILITÀ |

Il telefono inattivo mostra la Companion Card con turno corrente, colpi, posizione, distanza dalla buca e abilità. La schermata CONTROLLI usa lo stesso profilo degli input. Pausa, cambio turno, perdita del controller e ricaricamento del telefono cancellano la carica senza generare tiri fantasma.

| Pista | Par | Limite colpi |
| --- | ---: | ---: |
| Il Corridoio Maledetto | 4 | 5 |
| La Rotonda del Disagio | 4 | 6 |
| Il Ponte del Litorale | 4 | 6 |
| Il Flipper dei Coglioni | 4 | 6 |
| La Discesa Infame | 5 | 6 |
| L'Ultima Buca | 5 | 6 |

Una delle sei piste viene scelta uniformemente. Budget di gioco 210 s; dopo la scadenza nessun nuovo turno, ma il tiro in corso può assestarsi. Dopo 20 s di movimento persistente interviene il recupero tecnico gratuito. Il cap server è 310 s, con margine per caricamento, comandi e risultati. Il DNF vale almeno limite +2 colpi e aggiunge due penalità; penalità già accumulate possono aumentarlo.

Classifica: colpi, penalità, tempo attivo di mira, ordine originale del roster. Tutti ricevono una posizione; i punti globali continuano a essere assegnati dal `ScoreManager` esistente.

## Contenuti e compatibilità

Conservati solver a passo fisso 120 Hz, networking, pairing, FSM, geometrie delle sei piste, catalogo abilità e statistiche fisiche comuni. Corretto l'ingresso della rampa del Ponte: il segno precedente creava uno scalino di 0,7 m che impediva di salirvi. Migliorata la scelta del percorso dei bot, evitando pareti e tratti non supportati.

Le cinque abilità rimangono quelle del catalogo, utilizzabili nel proprio turno. Carbo può frenare durante il proprio tiro; il debito di Ciro viene chiuso alla fine del suo tiro e non può essere rimborsato da una successiva bocciata altrui. Sono state provate tutte e cinque anche attraverso input pad/touch nel browser.

HUD con pista, par, limite, turno, cronometro, colpi, potenza e abilità; cinque righe compatte di classifica. Nessun grande nome sopra le palline. Colori, piccoli anelli, scie, impatti e audio originali identificano l'azione. Aggiunti prato a pattern procedurale e palme/isole decorative fuori dalle collisioni, senza copiare piste o asset del riferimento.

Goblin, BOSCHI, Victor, Carbo e Ciro restano disponibili. Le quattro skin Tripo originali vengono caricate; Victor conserva il modello esistente. Personaggi e mazze compaiono nelle presentazioni e alla conclusione e vengono nascosti durante mira/tiro per lasciare libera la pallina. Riutilizzate le pose e animazioni esistenti; non è stato aggiunto un nuovo clip dedicato allo swing del golf.

## Verifiche

| Prova | Esito ed evidenza |
| --- | --- |
| Typecheck e build | Typecheck finale passato; build Vite emessa con il chunk aggiornato `BabylonMinigolfGame-CIcVCMz3.js`, inclusa la correzione camera a 3,4 m. Build precedente completata in 4 min 20 s. |
| Regressione | Dieci suite passate: camera, fisica/turni, pad, round, abilità, bot, qualità, URL controller, animazioni e audio. [Output](selftests.json). |
| Camera | 181 casi automatici, nuovamente passati dopo l'ultima correzione: sei piste, orbite, pareti, visibilità, seguito 30/60/120, rimbalzi e ritorno dalla panoramica. |
| Autorità fisica | Collisioni veloci, superfici, pendenze, bracci/piattaforme mobili, buche, cadute, reset, cancellation e deadline; 24 round naturali simulati, 2–5 giocatori × sei piste. |
| Browser completo | Cinque client telefono, Xbox/PlayStation/generico simulati attraverso GamepadManager/InputManager, touch multitocco, pausa/disconnessione/riconnessione, sei piste, rampa reale, bocciata e rimbalzo. [Dati](browser.json). |
| Risoluzioni | TV 1280×720, 1366×768, 1920×1080, 800×600; telefoni 390×800, 360×640, 844×390, attivi e Companion. Screenshot ispezionati. |
| Ultima correzione camera | Cinque partecipanti, quattro direzioni presso il muro, sfera sopra la potenza, nessun errore e ritorno alla lobby. [Dati finali](camera-wall.json). La voce `closeWall` in `browser.json` documenta la prova precedente, superata da questo controllo. |
| Due telefoni | Tiro touch vero, turno naturale, Companion, annullamento, ricaricamento durante carica e cleanup. [Dati](core-browser.json). |
| UI condivisa | Regressione pertinente su Minigolf, Quiz, FPS e Cornicione: 12 viste telefono. [Catture](controllers/). Non è una nuova esecuzione di tutti i 13 minigiochi. |
| Risorse | Sei cicli caricamento/uscita; due warmup, tre misure e podio finale. Una scena/un canvas, zero overlay residui, timer/listener stabili, nessun errore. [Dati](resources.json). |
| Versione compilata | Selezione reale dal menu/rullo, un telefono con quattro bot, asset GLB originali, round concluso naturalmente in 81,4 s di tempo reale dalla prima disponibilità del telefono; cinque posizioni e punti globali, incluso il modificatore PUNTI DOPPI. Nessun errore di pagina. [Ultima prova](production.json), [prima build](production-first-build.json). |

Round naturali nel browser, con simulazione accelerata per i bot e senza forzare la conclusione:

| Partecipanti | Pista | Tempo simulato |
| ---: | --- | ---: |
| 2 | Corridoio | 40,2 s |
| 3 | Corridoio | 60,0 s |
| 4 | Discesa | 63,3 s |
| 5 | Ponte | 88,1 s |

[Esiti completi](natural-rounds.json). L'audit risorse forza i risultati soltanto per ripetere il ciclo di vita; le prove dei risultati naturali sono separate. Le cadenze 30/60/120 sono simulate sul solver nel browser, non tre misurazioni hardware del rendering.

## Screenshot controllati

- [Camera principale con cinque palline, 1280×720](five-1280x720.png) e [1920×1080](five-1920x1080.png).
- [Seguito del salto dalla rampa](ramp-follow-1280x720.png).
- [Panoramica temporanea](overview-1280x720.png).
- [Correzione finale vicino al muro](camera-wall-8.png).
- [Telefono attivo](phone-390x800.png) e [Companion 360×640](companion-360x640.png).
- [Risultati della versione compilata](production-results.png).

Il vecchio `camera-back-wall.png` mostra il problema scoperto prima del rialzo finale e non rappresenta il risultato attuale. Lo screenshot di riferimento citato nella richiesta non era allegato: la verifica segue i requisiti testuali.

## Prestazioni e parametri per il playtest

Misurati **59,9 FPS su 360 frame**, a 1280×720, RTX 3050/ANGLE D3D11, 524 mesh nella scena completa. Heap host da 35,9 a 36,3 MB nelle tre misure dopo warmup; telefono circa 2,5 MB. Nessuna crescita di scene, canvas, overlay, timer o listener nell'audit finito. Non è una garanzia per ogni macchina o sessione arbitrariamente lunga.

La build mantiene il warning preesistente sui grandi bundle Babylon/main; il chunk Golf aggiornato pesa circa 43,9 KB, 16,1 KB gzip. `dist/index.html` generato viene ripristinato secondo la procedura del progetto: per servire nuovamente la versione di produzione usare `npm run build`. La preview Vite conserva le modifiche dei sorgenti.

Restano da valutare con persone e controller fisici: sei secondi di mira, carica 1,25 s, velocità 1,8–19, attrito 1,65, restituzione delle pareti 0,78, durata del bumper BOSCHI di 5 s, limiti 5/6 colpi e budget 210 s. Il rialzo locale della camera vicino al muro e la leggibilità del prato molto illuminato possono essere affinati dopo quel test. Le animazioni del golf possono ricevere clip dedicati in una fase successiva.

I controller hardware sono stati simulati; i telefoni sono client browser con input touch CDP. Non è stato effettuato un playtest umano, su Wi-Fi reale o con pad fisici. Non sono state modificate le interfacce degli altri minigiochi né effettuato un bilanciamento generale delle loro regole.
