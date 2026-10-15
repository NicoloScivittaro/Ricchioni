# Pallavolo e Casa Carbo — verifica

Baseline `0bb8534`, esecuzione diretta con Sol come richiesto. Nessun commit o push automatico.

## Modifiche
- Pallavolo: **Y / △ = TUFFO**, **LB / L1 tenuto = SPRINT**, più i due nuovi pulsanti sul telefono. Il tuffo dura 0,34 s, ha 1,7 s di recupero, riceve automaticamente una palla viva bassa nella propria metà e può fare un solo salvataggio. Non riceve attraverso la rete o dopo il contatto con il terreno; non diventa uno smash. Animazione, feedback e statistiche MVP accompagnano il contatto.
- Sprint: movimento più rapido, 2,4 s di fiato; rilascio per ricaricare in 3,2 s. Non si attiva durante salto/tuffo/blocco o con la palla in mano. Fiato e recupero sono visibili sul telefono e sulla TV. Fine punto azzera lo slancio e prepara le risorse per lo scambio successivo. Bot con gli stessi comandi e limiti.
- Casa Carbo: **gare di scarico**, prima dopo 8 s di partita. Primo giocatore a scaricare davvero **4 L** allo scarico segnalato vince **+6 punti contributo**. Ogni gara ha 18 s; dopo 4 s parte la prossima. Bersaglio rotante fra tombino, scarico del bagno e lavello. Raccolta, acqua soltanto spostata e scarichi sbagliati non assegnano il bonus. Tiracqua e abilità che scaricano realmente contano. Una sola vittoria per gara, nessun premio duplicato.
- Bersaglio evidenziato, timer, progresso del leader, istruzioni per scarichi intasati e stato personale sul telefono. Guida di percorso e bot seguono lo scarico della gara. Restano le emergenze, le cinque abilità e l’obiettivo comune del 75% di casa asciutta. I bonus entrano nella classifica e nei risultati.

## Verifiche eseguite
- `npm run build`: typecheck e build Vite passati (3m32s). Rimane l’avviso già presente sulle dimensioni dei bundle Babylon.
- `volleyball-defense-selftest.ts`: contatto nella propria metà, quota/raggio, palla a terra, cooldown, una ricezione per tuffo, sprint esaurito/rilascio/ricarica a 30/60/120 Hz.
- `carbo-races-selftest.ts`: consegne con input nel simulatore, progressi individuali, scarico errato, rotazione completa, scadenza, bonus limitato, percorso e conservazione dell’acqua. Dodici partite complete con 2–5 bot, tre semi per numerosità.
- Regressioni: pad (102 verifiche), Casa Carbo (102), obiettivi/emergenze, animazioni Ciro (32), direzione/rete di Pallavolo e simulazioni di bilanciamento preesistenti.
- Suite browser completa `gamepad-volleyball.mjs`: servizio, otto direzioni, salto, ricezione, smash, abilità, pausa, perdita/ripristino del controller, punto, fine match e round successivo senza input fantasma.
- `volleyball-carbo-upgrade.mjs`: 18 verifiche passate, ripetute dopo la pulizia dei comandi; telefono emulato e Xbox simulato. Tuffo automatico fuori dal normale raggio di colpo, cooldown, sprint misurato più veloce, cancellazione del dito, pausa, gara vinta tramite consegna dal telefono, cambio bersaglio e pulizia del canvas. Pulsanti raggiungibili a 320×740, 390×800 e 740×360. Nessun errore di pagina.

## Prestazioni
La qualità grafica non è stata abbassata. Casa Carbo con cinque personaggi originali: **59,94 FPS**, 271 mesh, scaling 1, simulazione media 0,188 ms nel campione browser di 6 s.

Confronto alternato di 20 simulazioni complete, stesso seme, cinque giocatori e input inattivi: CPU per passo **0,0649 ms prima / 0,0640 ms dopo**; differenza entro la variabilità del campione. È un confronto del simulatore, non una misura comparativa GPU. Le misure browser riguardano Chrome con la GPU locale; telefoni e controller sono emulati.

## Prova della versione compilata
`volleyball-carbo-production.mjs` è passato su **http://localhost:3004/**, senza import del codice sorgente o scorciatoie di debug:
- Pallavolo: cinque partecipanti (un telefono emulato e quattro bot), input touch tramite CDP, fiato sceso al 77%, tuffo con cooldown rilevato a 1,6 s, punto naturale, pausa e ritorno alla lobby con un solo canvas. Campione breve: **57,94 FPS**.
- Casa Carbo: cinque partecipanti (un telefono emulato e quattro bot), gara partita naturalmente con bersaglio e tempo sul telefono, input secchio, pausa e ritorno alla lobby con un solo canvas. Campione breve: **59,94 FPS**.
- Nessun errore di pagina. Il primo tentativo di questo script aveva un indice di selezione errato (Kart al posto di Pallavolo): corretto lo script e ripetuta con successo la prova.

I campioni FPS non garantiscono lo stesso risultato su tutti i dispositivi e non sono un confronto prima/dopo dell'intera scena. I server di test su 3005 e 5176 sono stati chiusi; il server abituale su 3004 rimane disponibile e serve la build aggiornata.

Artefatti: `browser-checks.json`, `browser-performance.json`, `simulator-performance.json`, `production-checks.json` e screenshot.
