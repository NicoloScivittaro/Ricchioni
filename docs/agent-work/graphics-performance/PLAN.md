# Miglioramento grafico dei 15 giochi senza regressioni prestazionali

## Stato e richiesta

Richiesta: migliorare la grafica in tutti i giochi senza abbassare prestazioni e FPS.
Stato: implementazione diretta Sol completata e accettata; build e verifiche finali passate.
Workspace reale: `C:/Users/niluf.PC-NIKO/Desktop/Ricchioni`.
Baseline Git: `6fe755a` (messaggio `5`), working tree pulito prima di questo documento.
La directory della chat `Documents/ChatGPT/ricchioni` non contiene i sorgenti.

## Vincolo di esecuzione

AGENTS.md fornito dall'utente richiede GPT-6 Astra come root e un solo
`astra_flash_builder` come implementatore. La sessione attiva osservata nei
metadati locali usa `gpt-6.1-sol`, effort `xhigh`, provider `openai`.
Il doctor della skill restituisce `static-ready`: route worker
`deepseek/deepseek-v4.1-flash`, provider DeepSeek API, effort high; inferenza non
verificata. Non cambiare modello root o configurazione del router automaticamente.
Eccezione autorizzata dall'utente il 12 ottobre 2026 con «procedi con S», in
risposta all'opzione «procedi con Sol»: il root Sol conserva pianificazione,
architettura, revisione e integrazione; il worker resta l'unico Flash previsto.
Questa autorizzazione sostituisce il vincolo sul modello root per questo lavoro.
Il primo tentativo Flash ha restituito HTTP 402 Insufficient Balance prima di
eseguire il lavoro. L'utente ha successivamente autorizzato «fallo direttamente
con Sol»: discovery, implementazione, prove e revisione sono ora svolte dal root
senza delega, mantenendo i contratti grafici/prestazionali seguenti.

## Evidenze e direzione grafica

- Registry: `shared/minigames.ts` e scoperta scene in `src/minigames/index.ts`.
- Direzione esistente: `docs/ART_BIBLE.md`, cartoon stilizzato, silhouette pulite,
  colori giocatore distinti dalle decorazioni, leggibilità del gameplay prioritaria.
- Ambienti condivisi: `src/minigames/env/envKit.ts`; materiali condivisi/congelati,
  mesh statiche, istanze e texture disegnate una volta sono già disponibili.
- Giochi 2D: `src/scenes/backdrops.ts` usa scenografie cotte in texture e cache.
- UI: `docs/UI_SYSTEM.md`, `src/core/uiTokens.ts`, `src/core/uiPhaser.ts`, HUD comuni.
- Qualità: `src/core/quality.ts` offre low/medium/high, auto-quality e risoluzione
  adattiva. Conservare impostazioni e comportamento; l'auto-quality non costituisce
  prova di neutralità prestazionale del miglioramento.
- Backrooms, Geofall e Minigolf hanno percorsi grafici propri: non assumere che il
  kit comune da solo copra tutti i giochi.

La strategia è migliorare art direction, palette, materiali, texture statiche,
gerarchia e nitidezza dei pannelli attraverso i percorsi esistenti. Eventuali
ottimizzazioni devono conservare la resa prevista, animazioni e asset originali.
Confrontare queste modifiche con effetti aggiuntivi: preferire il lavoro statico
e condiviso perché nuovi passaggi di rendering, ombre, luci dinamiche o particelle
moltiplicano il costo, soprattutto negli split-screen.

## Copertura obbligatoria

Una verifica grafica esplicita per ciascun gioco:
`quiz`, `reaction`, `memory`, `arena`, `dodgeball`, `soccer`, `volleyball`,
`kart3d`, `cultura`, `fps`, `cornicione`, `casacarbo`, `minigolf`, `geofall`,
`backrooms`. Conservare l'identità dei singoli giochi, incluso l'horror di Backrooms.

## Contratti e limiti

1. Solo presentazione. Nessuna modifica a fisica, collisioni, hitbox, regole,
   abilità, input, punteggi, timer, network, bot o camera di gameplay.
2. Nessun aumento della risoluzione di rendering, del DPR, del numero di luci,
   dei passaggi di rendering o del budget di ombre/particelle/bagliore.
3. Nessun effetto costoso aggiuntivo, dipendenza nuova o chiamata a generatori
   di asset. Non sostituire/comprimere/distruggere modelli e texture originali.
4. Nessuna allocazione, costruzione di texture/materiali o disegno decorativo
   ripetuto per frame. Cache e proprietà degli oggetti devono avere un lifecycle
   corretto fra round; nessun canvas, observer o listener residuo.
5. Colori e materiali non devono compromettere obiettivi, giocatori, indicatori,
   mappe, bandiere e cartelli. UI leggibile con 2 e 5 giocatori e schermi piccoli.
6. Non ridurre preset, risoluzione o dettaglio esistente per far sembrare superato
   il confronto FPS. Baseline e versione nuova vanno misurate a parità di preset,
   scala di rendering, viewport, giocatori, seed e condizioni.
7. Conservare ogni modifica preesistente sopravvenuta. Nessun commit, push,
   deploy, produzione, modifica di credenziali/configurazione globale.

## Unico bundle delegato, in ordine di dipendenza

Il worker possiede la discovery interna, implementazione, debug, prove e QA visiva
del bundle. Scope scrivibile: presentazione in `src/minigames/`,
`src/scenes/backdrops.ts`, componenti grafici/UI esistenti in `src/core/`,
eventuali stili di presentazione dei controller in `src/controller/`, script di
verifica in `scripts/`, report e artefatti in questa cartella. `PLAN.md` e
`CHECKPOINT.md` restano del root. Vietate modifiche a server, contratti shared,
manifest/lockfile, asset originali e configurazione di produzione.

### A. Baseline osservabile

Inventariare i 15 percorsi grafici e selezionare miglioramenti concreti per
ciascuno. Prima delle modifiche, acquisire screenshot e campioni prestazionali
locali comparabili. Riutilizzare gli harness browser esistenti, specialmente
`scripts/e2e/lib.mjs`, matrix, prove di performance e leak. Non chiamare produzione.
Registrare renderer/GPU, preset effettivo e scala effettiva. Separare GPU reale
e SwiftShader; la documentazione segnala che il software GL può essere molto lento.

### B. Miglioramento e controllo interno

Applicare un passaggio grafico coerente per tutti i giochi tramite i componenti
condivisi e gli adattamenti specifici necessari. Validare a vista, senza ritenere
sufficiente un semplice cambio di parametri non visibile. Il gioco low deve
beneficiare degli interventi. Correggere internamente leggibilità, regressioni
e costi inutili prima della consegna.

### C. Confronto e consegna per revisione

- `npm run build` e i selftest pertinenti agli eventuali percorsi modificati.
- Giro browser dei 15 giochi, controlli/telefoni, ingresso, gioco, fine, ritorno
  e cleanup, utilizzando gli harness già disponibili.
- Screenshot prima/dopo e copertura nominativa di tutti i 15 giochi.
- Misure prima/dopo a condizioni uguali: FPS, intervallo frame mediano/p95,
  draw call per frame, mesh/materiali/texture ed eventuale CPU rendering.
  Eseguire più campioni dopo il warm-up quando c'è rumore; non includere i tempi
  di caricamento nel campione di gioco stabile. Non usare solo i 60 FPS sotto VSync
  per dedurre che il costo GPU è invariato.
- Verificare 2 e 5 giocatori, low e preset normale, split-screen FPS/Backrooms,
  renderer telefono FPS, e viewport TV/mobile pertinenti.
- Ogni peggioramento ripetibile va corretto o la relativa modifica va rimossa.
  Se GPU reale o dispositivi mobili non sono disponibili, riportare esattamente
  la verifica mancante; non dichiarare invariabilità universale degli FPS.

Il worker scrive `REPORT.md` con stato `ready_for_review`, percorsi modificati,
risultato grafico per gioco, comandi/exit code, artefatti prima/dopo, misure,
limitazioni e checkpoint in caso di blocco. Root Astra verifica il diff reale,
compliance e qualità in un passaggio, poi invia eventuali rilievi insieme in un
solo ciclo di correzione. Nessuna ripetizione integrale delle prove già documentate.

## Criteri di accettazione

Tutti i 15 giochi hanno un miglioramento grafico visibile e coerente, conservano
gameplay e asset, compilano e completano il flusso. Le prove a parità di condizioni
non mostrano regressioni ripetibili di FPS/frame time; i costi aggiuntivi non sono
nascosti da una riduzione di risoluzione o di preset. I limiti hardware verificati
sono dichiarati nel report. L'accettazione finale spetta ad Astra.

## Prossima azione

Eseguire il bundle end-to-end con l'unico `astra_flash_builder`; root Sol per
eccezione esplicitamente autorizzata. Attendere la consegna, rivedere diff ed
evidenze in un solo passaggio e consolidare eventuali correzioni. Non richiedere
un'altra approvazione di scope o di modello già autorizzati.
