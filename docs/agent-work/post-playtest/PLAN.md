# Sistemazione dopo il primo playtest

Richiesta: allegato del 10 ottobre 2026. Branch esistente `main`, baseline pulita `11ce7dc`. Implementazione nel root autorizzata senza Flash; nessun push. Conservare bot, modelli Tripo, abilità, input centralizzato e FSM.

## Sequenza vincolante

1. Quiz: telefono esclusivo; stato privato completo identificato per domanda, selezione/conferma/attesa, scadenze e riconnessione. Aggiornare aspettative pad obsolete.
2. Arena: unico sopravvissuto, sudden death e pressione anti-stallo; spareggio deterministico e cap tecnico coerente.
3. Kart: diagnosi contatti e rallentamenti, risoluzione proporzionata agli urti reali preservando guida/abilità.
4. Casa Carbo: tutorial locale, acqua/secchi/scarichi leggibili, emergenze competitive sequenziali e feedback concreto delle azioni.
5. Cornicione: calci, prese/proiezioni, calci aerei, parata; comandi centralizzati senza conflitti e animazioni provvisorie dove necessarie.
6. Calcio: identificazione, pallone/possesso, direzione/potenza, feedback e camera.

## Accettazione di ogni fase

Typecheck, selftest pertinenti, input/controller, cinque giocatori ove applicabile, browser con conclusione naturale del round, pausa/riconnessione/lobby, errori e risorse, build produzione. Commit locale separato soltanto dopo le verifiche; nessun risultato simulato tramite `ctx.finish` nelle prove di conclusione. Le accelerazioni del tempo usate nei test vengono esplicitate.

Regressione finale dei dodici giochi e report italiano: cause dimostrate, file, prima/dopo, test, limiti, controlli, animazioni mancanti, rischi da verificare con persone e commit. Le correzioni condivise richiedono una dipendenza effettiva e test mirati.

## Note di analisi

La scheda generale del progetto contiene informazioni obsolete (undici giochi, Quiz da pad): prevalgono codice attuale e richiesta solo telefono. Quiz già PHONE_TEXT; verificare il problema reale senza attribuirlo alla sola dichiarazione. Il trasporto di testo esistente consente messaggi di risposta identificati senza aggiungere librerie o un secondo sistema input.
