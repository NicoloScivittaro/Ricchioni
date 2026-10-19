# Votazione della mappa prima del gioco

## Comportamento

Dopo l'estrazione del gioco e prima dell'introduzione compare **VOTA LA MAPPA**, per 15 secondi, nei giochi con più mappe:

| Gioco | Opzioni |
|---|---|
| Ribaltati | Circuito del Litorale, Strada Arcobaleno |
| Backrooms | Livello 0 / Hall, Livello 1 / Parcheggio, Livello 2 / Caldaie |
| Minigolf | Tutti i dieci percorsi esistenti; il voto sceglie la prima buca del torneo da tre |

Ogni giocatore umano ha un voto, modificabile fino alla scadenza. I telefoni mostrano schede con scelta evidenziata, descrizione e conteggi; la TV mostra i totali e la scelta di ciascuno. Con un controller associato, croce/stick sposta il proprio cursore e A/✕ conferma. Il telefono può cambiare lo stesso voto anche se il controller è associato. I bot si astengono.

Vince la mappa con più voti. In caso di parità il server sorteggia tra le prime a pari merito. Se nessuno vota, sorteggia tra le mappe disponibili; per Ribaltati conserva come ripiego l'eventuale pista richiesta esplicitamente nella lobby. Un voto valido può quindi cambiare anche la pista scelta prima dall'host.

L'introduzione conferma il nome della mappa e il gioco carica la scelta risultante. I giochi con una sola mappa mantengono il flusso precedente, senza una nuova attesa.

## Integrazione

- Nuova fase autoritativa `MINIGAME_MAP_VOTE`, tra rullo e introduzione. Il tempo della votazione non consuma la durata del minigioco.
- Catalogo leggero condiviso in `shared/minigameMaps.ts`, senza importare geometrie o motori 3D su server e telefoni. I nomi di Backrooms e Minigolf sono condivisi con le mappe effettive.
- Snapshot con opzioni, scadenza, orologio del server, identità abilitate e voti. Il countdown locale usa il tempo relativo al server: un orologio del telefono diverso non impedisce di votare.
- Il telefono viene riconosciuto dal socket autenticato, non da un playerId dichiarato nel voto. Il relay dell'host richiede un controller associato al giocatore. Un controller associato può votare anche mentre il telefono è disconnesso o in standby.
- Round errato, mappa inesistente, voto scaduto, identità estranea e socket sostituito vengono rifiutati. Voti ripetuti non aumentano il conteggio.
- Riconnessione di telefono o host conserva scelta e scadenza. Riavvio, ritorno alla lobby e salto d'emergenza liberano il voto. Il normale salto delle animazioni non può saltare la votazione.
- Alla chiusura si aggiorna il contesto dello stesso round, conservando input e protezioni sulla consegna dei risultati. Ribaltati mantiene `kartTrackId`; gli altri giochi ricevono `mapId`.
- Minigolf apre con il percorso votato e seleziona altre due buche diverse; regole, punteggio e spareggio sono conservati. Backrooms mantiene la generazione del labirinto e usa il livello votato, anche se è lo stesso della partita precedente.
- Il pannello di associazione dei controller si chiude durante il voto. Sui telefoni la lista scorre e il timer resta visibile, anche con dieci scelte.

## Verifiche

| Prova | Esito |
|---|---|
| Sessione e catalogo | 206 controlli passati: maggioranza, parità, astensioni, cambio voto, duplicati, round vecchi, scadenza, reset, bot e controller con telefono in standby. Inclusi 120 sorteggi Minigolf con prima buca imposta e tre percorsi distinti. `session-checks.json` |
| Rete Socket.IO reale | 19 controlli passati: identità dal socket, tentativi di impersonificazione, mappa di altro gioco, relay pad, sostituzione socket telefono/host, riconnessione e scadenza reale. `network-checks.json` |
| Browser | 54 controlli passati in sei avvii: Ribaltati Arcobaleno a due umani e Litorale in solitaria con quattro bot; Backrooms Parcheggio a tre umani, Hall e Caldaie a due; Minigolf Odissea a cinque. La mappa è verificata nel gioco effettivamente istanziato. `browser-checks.json` |
| Comandi e layout | Voto dal percorso GamepadManager con pad simulato, cambio dal telefono, pannello non sovrapposto, riconnessione di entrambi i client; telefono con orologio avanti di due minuti; dieci scelte raggiungibili e timer visibile a 320×568 e 844×390. Inclusi nei controlli browser |
| Regressioni | Dieci suite passate: ciclo rullo (42.653 controlli), rete rullo (48 estrazioni), bot, pad, round, Minigolf (40 round con bot su dieci percorsi), camera Minigolf (816 casi), Backrooms (22 gruppi, anche 4.000 labirinti), audio e qualità. `regressions.json` e log |

Nessun errore di pagina nelle sei prove browser. Le prove dei comandi usano client telefono nel browser e un gamepad simulato; resta utile una verifica ergonomica con dispositivi fisici. La prima esecuzione della regressione rete rullo puntava alla vecchia porta di test 3003 inattiva; rieseguita sul server di test 3010, è passata.

## Build e consegna

**PASS**: typecheck indipendente e finale; build Vite con 3.808 moduli in 4 min 10 s; prova del pacchetto compilato sulla porta 3008. Un client touch ha votato Litorale contro il ripiego Arcobaleno della lobby, con quattro bot astenuti. Verificati scadenza prima del gioco, scelta finale, mancata istanziazione del GLB Arcobaleno, avvio, pausa e ritorno alla lobby con un solo canvas e zero errori. Rimane il precedente avviso sulle dimensioni dei chunk Babylon/WebXR. Evidenze in `delivery-checks.json` e `production-checks.json`.

L'intervento non cambia fisica, grafica o loop di gioco: la nuova schermata lavora prima dell'avvio del motore del minigioco. Gli intervalli del telefono e gli ascoltatori della TV vengono rimossi uscendo dalla votazione. Non è stata eseguita una nuova misura FPS, perché il cambiamento riguarda il flusso precedente alla partita.

Le immagini sono catture del gioco e dei client di verifica. `baseline.zip` conserva i file all'inizio del lavoro; `incremental.patch` e `source-manifest.json` documentano la modifica consegnata. Nessun commit, push o deploy eseguito.

## Riproduzione

```powershell
node --import tsx scripts/map-vote-selftest.ts
node --import tsx scripts/map-vote-network.ts
npm run build
$env:GOBLIN_GPU='1'
node scripts/e2e/map-voting.mjs
node scripts/e2e/map-voting-production.mjs
```

Il test browser sorgente richiede il backend sulla porta 3010 e Vite sulla 5180 con `VITE_SERVER_URL=http://localhost:3010`. La prova production usa la porta 3008, configurabile con `MAP_VOTE_PRODUCTION_URL`. Non avviare la prova sorgente mentre si modificano i file: il ricaricamento automatico interrompe la sessione.
