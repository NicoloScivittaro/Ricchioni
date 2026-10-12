# Minigolf 2.0 — contratto e verifica

Implementazione root autorizzata dall'utente senza Flash. Preservare Backrooms e Geofall non committati; nessun commit/push/deploy/dipendenza.

Baseline: sei piste, una sola selezionata, timer 210s; turni di mira 6s e limite 5/6 colpi terminano spesso prima del timer. Riutilizzare fisica120Hz, turni, collisioni fra palline, abilità/input/camera.

1. Autorità: tre piste uniche selezionate facile/media → media → media/difficile; guardia tripletta precedente. Config condivisa150s/buca (costruttore configurabile), mira15s, limite12. Intervallo classifica4s, intro nuova buca, reset risorse/oggetti/palline e rotazione del primo giocatore. Timeout con attuale penalità minimo limite+2 e tolleranza massimo20s del tiro già partito.
2. Sei piste riutilizzate più prato, saliscendi, cancelli e serpentina: geometrie reali nello stesso solver, nessun portale/loop artificiale. Partenze equidistanti dal primo obiettivo.
3. Classifica totale colpi, tempo attivo mira+tiro nelle buche completate (attesa esclusa). Parità esatta: una breve pista di precisione, una giocata per pari, distanza finale e tempo di imbucata. Persistente parità/AFK → ex aequo, mai ordine roster come vincitore; supporto punti condivisi esclusivamente Minigolf, con layout risultati senza sovrapposizioni.
4. HUD TV, finale con dettaglio3buche; telefono attivo e Companion con buca/timer/totale. Metadata durata/watchdog devono coprire torneo+spareggio, senza toccare gli altri giochi.
5. Verifica: simulazioni10percorsi completati da tiri fisici senza teletrasportare palline, selezione/reset/timeout/score/tie/abilità,2–5giocatori, gamepad/phone/cancellation/pausa/rejoin nel browser, screenshot10piste e risoluzioni, torneo completo e build reale, regressioni condivise. Indicare chiaramente fixtures, accelerazione temporale e hardware simulato.

Rischi: capserver vecchio310s troncherebbe torneo; tie server normalizza posizioni; camera/bot cache della pista devono resettarsi alle transizioni; evitare cariche pendenti durante nuove buche; verifica completabilità vera delle pendenze, non soli waypoint.
