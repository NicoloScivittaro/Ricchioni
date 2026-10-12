# Checkpoint — graphics-performance

- Data: 12 ottobre 2026, Europe/Rome.
- Workspace: `C:/Users/niluf.PC-NIKO/Desktop/Ricchioni`.
- Baseline: `6fe755a90ce678ad47fd9fdf5b239957a0095733`; nessuna modifica tracked.
- Piano: `PLAN.md`, confermato dall'utente. Root Sol autorizzato dall'utente con
  «procedi con S» dopo la proposta di coordinare Flash con Sol.
- Worker unico: `/root/graphics_performance`, ruolo `astra_flash_builder`.
- Delega tentata sul provider previsto; errore immediato HTTP 402
  `Insufficient Balance` da DeepSeek V4.1 Flash API. Nessuna implementazione,
  misura baseline o verifica browser è stata eseguita dal worker.
- Il child errored è stato interrotto per chiudere lo stato di lavoro.
- Nessun cambio automatico di modello/provider, ricarica o smoke test a pagamento.
- Eccezione finale autorizzata: l'utente ha risposto «fallo direttamente con Sol»;
  nessuna ulteriore delega o conferma necessaria.
- Implementazione grafica presente in 17 file sorgente esistenti e nel nuovo
  `src/minigames/env/surfaceDetail.ts`. Solo texture procedurali esistenti, palette,
  cartelli, contorni testo e scenografie cotte. Nessuna modifica gameplay/qualità.
- Baseline completa: 15 giochi con 2 giocatori medium e 5 low; RTX 3050/D3D11.
  Probe FPS baseline con 2/5 viewport e renderer mobile completato.
- Sorgenti originali congelati in directory temporanea, indicata in
  `baseline-path.txt`; Vite baseline porta 5174. Vite versione nuova porta 5173;
  stesso server locale 3001. PID in `processes.json` e `baseline-vite-pid.txt`.
- Test completati: before/after di tutti i 15 giochi con 2-medium e 5-low,
  ripetizioni a scala fissa per coppie inizialmente non comparabili, probe FPS
  con 2/5 viewport e renderer telefono, controllo effettivo delle righe nei due HUD.
  Confronto finale: 30/30 coppie e 3/3 probe passati; stessi conteggi risorse e pixel.
  Aggregazione dichiarata nel report: mediana delle finestre, tolleranza per rumore;
  nessuna pretesa di invarianza universale o di incremento FPS attribuito alla grafica.
- Un commit esterno `38751fc` ha incluso documenti/script/evidenze durante il
  lavoro; nessuna modifica sorgente fra baseline `6fe755a` e quel commit.
  Non annullare o attribuire al root quel commit. Baseline di revisione resta 6fe755a.
- Prima build superseded fermata; build finale exit 0, Vite completato in 3m30s.
- Quality-selftest e environment-selftest low/medium/high: exit 0.
- Bundle compilato su localhost:3001, Kart con 2 telefoni, preload e assenza di errori
  verificati con prod-bundle.mjs, exit 0. Nessuna chiamata a un deployment esterno.
- Screenshot di tutti i giochi e dei due pannelli corretti ispezionati; diff dei
  sorgenti e nuovo helper rivisti. Nessuna modifica a shared/server/qualità/asset
  originali o dipendenze; dist/index.html aggiornato dalla build, preservato.
- Server baseline 5174 fermato; anteprima corrente 5173 e server 3001 disponibili.
- Stato finale: accettato dal root Sol per eccezione autorizzata; REPORT.md contiene
  risultati, fonti dei dati, screenshot e limiti. Nessun lavoro necessario residuo.
