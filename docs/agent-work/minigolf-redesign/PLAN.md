# Minigolf: camera dietro la pallina e turni rapidi

Baseline pulita: `91c5e96`. Implementazione con root attuale, autorizzata dall'utente senza Flash. Nessun push/deploy. Commit finale separato solo dopo verifica.

## Contratti

- Conservare solver fisico a 120 Hz, collisioni, sei geometrie originali, catalogo abilità, InputManager, ScoreManager, networking e FSM comune.
- Una pista scelta uniformemente; par e limite 5/6. Tutte le palline non imbucate partecipano alla fisica. Solo il giocatore attivo può orientare/tirare/usare abilità. Carbo può frenare durante il seguito del proprio tiro.
- Camera prospettica vicina dietro pallina, direzione indipendente dalla velocità dopo il tiro. Orbit con stick destro/drag, Y tenuto panoramica temporanea. Collisione della camera anche dopo interpolazione.
- Stick sinistro orizzontale ruota progressivamente la mira; avanti permette regolazione fine. Nessun azzeramento della direzione al rilascio.
- Ordine iniziale mescolato con RNG della partita, una giocata per rotazione, salto dei conclusi. Preparazione 6 s; timeout +1 senza impulso. Cambio solo quando tutte le palline coinvolte sono ferme. Attesa non conteggiata nello spareggio.
- Partita: budget dichiarato 210 s, dopo la scadenza nessun nuovo tiro; il tiro già partito termina con margine massimo 20 s. Recupero tecnico gratuito dopo 20 s di movimento persistente. Intro 4 s, risultati 1.8 s, margine hard cap server 310 s (comprende controlli/caricamento). DNF = almeno limite +2 colpi. Il limite di colpi si applica dopo il movimento dell'ultimo tiro.
- Collisioni non aggiungono colpi alla vittima; caduta causata da una bocciata avversaria viene riposizionata senza penalità. Debito Ciro chiuso alla fine del proprio tiro: niente rimborso per una successiva bocciata avversaria.
- Telefono attivo con mira, orbit, potenza, annulla, panoramica, abilità. Telefono inattivo con Companion Card; card controller esistente aggiornata con dati del turno.
- Classifica: colpi, penalità, tempo attivo di mira, ordine roster deterministico.

## Milestone e accettazione

1. M1 camera/tiro: una pista, pallina in basso, tiro touch vero, orbit/panoramica, screenshot ispezionato prima di decorazioni.
2. M2 turni: autorità pura e test 2–5, timeout, collisioni persistenti, ultimo colpo/imbucata, cancellazione/rejoin.
3. M3 sei piste: metadati, HUD compatto, Companion, cinque abilità, bot; restano asset originali.
4. M4 verifica: typecheck/build, fisica 30/60/120, Xbox/PS/generic simulati, touch, pausa/rejoin, sei piste e risoluzioni inclusa 1280×720, risultati naturali, produzione, performance e risorse. Report italiano con prove e limiti reali.

Non è stato allegato uno screenshot di riferimento: le proporzioni vengono verificate contro i requisiti testuali, senza bloccare il lavoro.
