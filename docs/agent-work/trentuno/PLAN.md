# 31 DEGLI INFAMI — contratto e milestone

Baseline: `faa2ae69c1c32af85d00f339972be609a27c7d4a`, checkout pulito, 16 giochi già presenti. Implementazione diretta con Sol secondo l'autorizzazione precedente; il workflow Astra/Flash letto non viene delegato perché il root selezionato è Sol. Nessun push/deployment. Commit locali richiesti esplicitamente nella nuova specifica, uno per milestone verificata.

Il concept non è incluso nell'allegato (solo testo). Mazzo vettoriale originale completo: smeraldo, oro, avorio, rosso, ornamenti, caricature dei cinque amici; nessuna immagine scaricata. Il confronto con il concept resta impossibile finché non viene fornito.

## Contratto

- ID stabile `trentuno`, diciassettesimo gioco, PHONE_TEXT, 2–5, un solo servizio server per stanza. TV pubblica e snapshot proprietario per ogni telefono. Nessuna seconda lobby; ScoreManager invariato. GameSession estende al nuovo gioco l'opzione ex aequo già usata da Minigolf.
- 40 carte, ranghi A/2–7/F/C/R, semi DENARI/COPPE/SPADE/BASTONI. Punteggio massimo per seme, senza tris. Tre mani, partenza casuale segreta poi rotazione di un posto per mano.
- PESCA e SCARTO distinti: vietato scartare subito la carta presa dagli scarti. BUSSA solo all'inizio del proprio turno, al posto di pescare; gli altri hanno un turno finale. Finestra Carbo di 3 s: aggiunge N turni dopo gli N−1 standard, incluso il bussante. Il 31 si conferma solo a mano di tre, dopo distribuzione/scarto/scambio atomico; chiude immediatamente e ha priorità sui timeout.
- Internamente punti di posizione N−posizione, pari stessi punti (posizioni di competizione). Somma delle tre mani; poi somma punteggi delle mani come spareggio; pari residui condividono il piazzamento nel sistema esistente, ordine roster solo per presentazione.
- Decisione 12 s, scarto 10 s, peek Victor 8 s, mano 100 s, totale 330 s; AFK pesca coperta e scarta ottimizzando soltanto la propria mano. Cap risolve eventuale scelta in corso e rivela punteggi reali, mai falso 31. Pausa ferma tutti i tempi. Rimescola scarti escludendo la cima quando serve.
- Abilità una volta su tutte le mani: Goblin solo dopo pesca coperta sostituisce la pescata, seconda obbligatoria; Boschi prima di pescare blocca la presa del prossimo giocatore per un turno valido; Victor prima della pesca guarda/ordina due carte in privato; Carbo solo nella finestra dopo bussata avversaria; Ciro prima della pesca consegna carta scelta e riceve carta casuale server di avversario scelto, controllo simultaneo di 31 sulle due mani.
- Comandi con roundId/matchId/version/requestId, socket corrente proprietario, deduplicazione limitata, nessun seed pubblico. Bot stesso comando/validazione e sola vista privata propria più tavolo pubblico.
- Tavolo Phaser 2D con ritratti esistenti, carte SVG locali pregenerate e texture precaricate. Nessun Babylon per questo tavolo. Animazioni brevi, texture/listener/timer liberati al termine.

## Milestone dipendenti

1. **M1** mazzo, punteggio, core turni/tre mani/cap, selftest regole.
2. **M2** cinque abilità nel catalogo, bot, test interazioni e privacy core.
3. **M3** RoomManager, servizio, GameManager e telefono, test autentica/riconnessione/pausa.
4. **M4** 40 SVG+dorso simmetrico, tavolo Phaser, telefono responsive, typecheck e galleria.
5. **M5** build, regressione, browser reale 2/3/4/5 telefoni e bot, tre mani naturali, risultati/lobby, screenshot, FPS, report italiano.

Accettazione: tutte le milestone verificate, nessuna mano avversaria inviata prima di fine mano, nessun risultato inventato dall'host, asset dei 40 ranghi distinti, nessuna regressione nota. Playtest umano e confronto concept dichiarati come limiti separati.
