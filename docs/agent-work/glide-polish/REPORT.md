# RIBALTATI — rifinitura della planata

## Risultato

La pista Arcobaleno esistente conserva modello GLB, percorso, due gap, checkpoint, tre giri e regole di gara. La modifica riguarda risposta in aria, presentazione, camera e guida dei bot. Le differenze rispetto allo stato iniziale di questo intervento sono in `incremental.patch`; `scope-checks.json` verifica i sistemi conservati.

### Decollo e atterraggio

- Ali sagomate a V con apertura graduale, lieve flessione e due scie sfumate per lato, riutilizzando due mesh da 13 vertici per kart.
- Piccolo sbuffo allo stacco, nuovo richiamo sonoro crescente e messaggio «ALI APERTE · MIRA AL PORTALE».
- Profilo verticale `sin²(πt)` con velocità verticale nulla agli estremi. Mantiene le altezze massime precedenti: 18 m sul Volo Stellare e 3,5 m sul Salto Aurora. Anche gli anelli di guida usano lo stesso profilo.
- Il passaggio effettivo da GLIDE a DRIVE attiva compressione delle sospensioni, polvere, suono d'impatto e una breve risposta verticale della camera. Nessun turbo aggiuntivo all'atterraggio.

### Controllo e bilanciamento

Lo sterzo in aria richiede un orientamento proporzionale allo stick, con risposta smorzata: obiettivo massimo nominale ±0,24 radianti, frequenza 6/s e limite di sicurezza ±0,48 radianti. Rilasciando, il muso si riallinea gradualmente; la posizione laterale raggiunta resta al giocatore. Un riferimento continuo evita che le curve della guida nel gap generino sterzate involontarie.

Restano acceleratore, freno, inerzia laterale, modificatori di sterzo, urti, stun, controlli invertiti e conseguenze degli oggetti. La planata parte nei soli gap previsti. La tolleranza di atterraggio resta la stessa: sulla pista larga 13,2 m, il centro del kart deve restare entro ±5,45 m. Mancare la piattaforma provoca caduta e recupero al checkpoint esistente. La caduta ora continua visivamente anche durante l'attesa del recupero.

### Traiettoria e camera

Un cerchio con freccia e un piccolo anello rialzato indicano la posizione laterale stimata di atterraggio **se si rilascia lo sterzo in quel momento**. Verde significa entro la piattaforma, arancione richiede correzione; il testo HUD mostra anche i metri residui e «IN LINEA / CORREGGI». È una previsione, non un'assistenza che sposta il kart: nuovi comandi, urti o variazioni di velocità possono cambiarla.

Ogni indicatore appartiene alla sola visuale del giocatore. Bordi luminosi e angoli di un portale aperto rendono riconoscibile la piattaforma successiva. La camera prepara leggermente l'inquadratura 18 m prima del gap, segue meno le oscillazioni di sterzo in volo e guarda più avanti lungo la traiettoria. Il contatto produce un impulso verticale di 0,11 m per 0,3 s, oltre a una vibrazione ridotta.

### Bot

In volo i bot usano un controllo dedicato che compensa scostamento laterale, inerzia da urto e velocità di imbardata. Agiscono sugli stessi comandi dei giocatori e sulla stessa fisica. Il controllo a terra è conservato.

## Verifiche eseguite

| Verifica | Risultato / evidenza |
|---|---|
| Fisica Arcobaleno: entrambi i gap, sterzo, stun, caduta, recupero e otto gare complete a 2–5 kart | Tutti arrivati; 168 atterraggi, zero cadute nelle gare nominali. `physics-races.json` |
| Controllo a 30/60/120 Hz | Sterzo proporzionale, rilascio stabile senza ricentramento laterale, contatto senza turbo; errore previsione nel caso misurato 0,138 / 0,069 / 0,035 m. `control-checks.json` |
| Bot perturbati: ±4 m e impulso laterale ±2, entrambi i gap a 30/60/120 Hz | 12 atterraggi riusciti. `control-checks.json` |
| Browser a 2, 3, 4 e 5 visuali | 38 controlli passati: telefono, asse pad simulato, disconnessione, pausa, riconnessione, caduta visibile, recupero, inventario e abilità. Zero errori di pagina. `browser-qa.json` |
| Presentazione a cinque visuali | Sei controlli passati: marker privati, colori, normali delle ali, sfumatura scie, sospensioni, scomparsa marker al contatto. `presentation-checks.json` |
| Camera lungo tutta la pista, varie posizioni laterali e layout 2–5 | 1.212 raggi camera-kart, zero occlusioni rilevate. `camera-rays.json` |
| Gara browser completa con cinque client e guida AI attraverso i comandi ordinari | Cinque arrivi in 2:46,5–2:48,3, 30 decolli, 30 atterraggi, zero cadute, 27 usi di oggetti, sette attivazioni di abilità e nessun errore di pagina. `natural-race.json` |
| Regressioni | 11 suite passate: Litorale (24 gare a 30/60/120 Hz), camera Litorale (336 posizioni), contatti, olio, 13 oggetti, cinque abilità, pad, bot, round, qualità, audio. `regressions.json` e relativi log |

I test browser dei comandi usano client telefono e un pad simulato; non sostituiscono una prova ergonomica con telefoni e gamepad fisici. Il controllo di occlusione è geometrico e le immagini includono sia una gara reale sia pose predisposte per confrontare gli effetti.

## Prestazioni

Nel campione della gara browser a cinque visuali, qualità HIGH, 1280×720, scala 1, su RTX 3050 / Chrome D3D11: **55,59 FPS medi**, 452 campioni tra il secondo 2 e il secondo 10; durata media CPU della chiamata render 15,33 ms. Il precedente campione di gara raggruppata riportava 49,54 FPS, ma le condizioni dinamiche non sono identiche: il confronto non dimostra un incremento garantito.

Le scie sono incluse nelle mesh delle ali; le guide statiche vengono unite al lotto esistente. Il marker aggiunge un solo disegno nella visuale proprietaria. Non sono stati aggiunti post processing, luci, sistemi particellari o geometrie ricreate ogni frame. La misura è circoscritta a questa macchina e finestra temporale, non una garanzia di 60 FPS su tutti i dispositivi.

## Build e prova del pacchetto

**PASS**: typecheck, build production (3.805 moduli, 3 min 46 s) e prova del pacchetto compilato. Rimane il precedente avviso sulle dimensioni dei chunk Babylon/WebXR; nessun errore di compilazione. Evidenze in `delivery-checks.json` e `production-checks.json`. La prova del pacchetto usa il server locale sulla porta 3008, cinque partecipanti (un client touch e quattro bot), caricamento GLB, input touch, pausa e ritorno alla lobby.

## Riproduzione

```powershell
npm run build
node --import tsx scripts/glide-polish-selftest.ts
node --import tsx scripts/glide-control-selftest.ts
$env:GOBLIN_GPU='1'
node scripts/e2e/glide-polish-qa.mjs
node scripts/e2e/glide-polish-presentation.mjs
node scripts/e2e/glide-polish-camera.mjs
node scripts/e2e/glide-polish-natural.mjs
node scripts/e2e/glide-polish-production.mjs
```

Gli script di verifica sorgente richiedono Vite sulla porta 5180 collegato al backend 3008; la prova production usa solo 3008. Nessun commit, push o deploy eseguito.
