# BOSCHI, Goblin e Carbo — integrazione delle nuove animazioni

I tre originali forniti dall'utente sono integrati come aggiornamento grafico dei personaggi esistenti. Ciro conserva il suo aggiornamento precedente. I vecchi GLB e i corpi procedurali restano disponibili; nessuna compressione, LOD o modifica alla simulazione.

| Personaggio | Clip precedenti | Clip attuali | Nuove native | Triangoli | Vertici |
|---|---:|---:|---:|---:|---:|
| BOSCHI (`buttafuori`) | 43 | 54 | 11 | 31.399 | 28.141 |
| Goblin | 36 | 52 | 16 | 35.624 | 33.613 |
| Carbo (`judoka`) | 37 | 49 | 12 | 29.435 | 24.403 |

BOSCHI conserva anche l'alias esplicito `hitStomach`: 55 nomi semantici per 54 clip native. I candidati sportivi e i gesti ambigui sono disponibili in Gallery, senza sostituire attacchi o contatti già tarati.

## Audit degli originali

Mesh, indici, normali, UV, pesi, joint indices, inverse bind matrices, gerarchia e trasformazioni dei nodi, texture e parametri dei materiali risultano identici alle rispettive versioni precedenti. Ogni vecchia clip ha gli stessi dati di animazione: cambiano soltanto ordine e indici. I nomi UUID della mesh cambiano nell'esportazione, senza effetto sul rig.

Tutti hanno 65 ossa Mixamo, incluse le dita, e 195 tracce per clip. Nessun morph target facciale. Scale e orientamento mantengono la taratura precedente: altezza adattata al personaggio nel contesto, yaw aggiuntivo 0°, traiettoria e collider gestiti dal gameplay.

Gli originali sono copiati byte per byte in `public/models`, con URL nuovi terminanti in `_casacarbo.glb`; i tre GLB precedenti non sono sovrascritti. Hash e confronto completo sono nei file `comparison.json` delle sottocartelle.

## Gesti collegati a Casa Carbo

Tutti e quattro i personaggi importati usano le loro clip native per trasportare il secchio, raccogliere acqua, usare il tiracqua, svuotare, cadere e rialzarsi. Il secchio segue la mano destra, con limite grafico per tenerlo sopra il pavimento. Le ripetizioni mantenute non ricominciano a ogni fotogramma.

BOSCHI usa il nuovo blocco durante l'abilità alla porta. Carbo usa la costruzione della barriera all'attivazione della diga. Il Goblin mantiene le animazioni esistenti di carica/onda e di contenimento: il suo nuovo file non contiene il blocco acqua dedicato degli altri. Ciro mantiene i gesti già integrati.

La caduta usa `fallBackward`, che termina a terra e si raccorda a `getUp`; la clip alternativa `slip` recupera già la posizione eretta e resta in preview. I gesti vengono adattati ai tempi esistenti (.6 s di scivolata, .55 s per il gesto di svuotamento e .4 s di rialzata visiva), senza imporre attese o blocchi agli input. La costruzione di Carbo dura 1 s soltanto nel render: l'effetto della diga conserva le proprie regole. Il finale rimuove gli override e ripristina vittoria/sconfitta.

## Verifiche completate in sviluppo

- 155 clip native, ciascuna campionata in cinque pose; skinning finito, materiali originali pronti, nessun autoplay, rilascio delle istanze.
- Gallery con quattro modelli corretti, Dottore invariato, confronto OLD/NEW per i tre aggiornamenti e cinque rig indipendenti per ciascuno, con geometria condivisa.
- Quattro telefoni reali in Casa Carbo: gesti, abilità, transizioni e finale. Snapshot dei giocatori e dell'acqua invariati durante ogni aggiornamento grafico.
- 86 campioni per ciascuno dei tre personaggi in Cornicione: salto, doppio salto, discesa, atterraggio e tutti i 14 attacchi. Nessun cambio di mesh, materiali o scheletro; contatti e tempi precedenti preservati.
- Arena, Cornicione, Dodgeball e FPS con cinque personaggi misti, sia OLD sia NEW. In Dodgeball la palla segue l'ancoraggio della mano. Smaltimento delle istanze verificato in tutti i contesti.
- Download fallito per tutti e tre i GLB: corpo procedurale ancora funzionante, visibilità ripristinabile e nessuna modifica alla fisica.
- Selftest: aggiornamento personaggi 431; Goblin 183; BOSCHI 107; Ciro 111; gesti Ciro 32; simulazione Casa Carbo 102/102. Typecheck passato.

Il cambio dei file aggiorna i contesti che già supportano i modelli importati. Kart, Soccer e Volley mantengono il percorso grafico precedente; questa fase non estende il loro renderer.

## Performance e limiti visivi

Su Chrome headless con RTX 3050/D3D11, la breve prova con cinque personaggi misti ha rilevato tempi medi del frame Babylon di circa 2,2–6,5 ms nei quattro contesti, con 0,54–0,64 ms complessivi di campionamento dei rig. In Casa Carbo, 35 campioni della scena con quattro gesti nativi e simulazione congelata misurano 3,83 ms di frame e 0,61 ms di campionamento. Sono misure locali brevi, non una garanzia di FPS su altri PC o durante una partita completa. Dati grezzi in `hardware-context-performance.json` e `casacarbo.json`.

Il numero di triangoli e le texture sono invariati. Le nuove clip aumentano i dati da scaricare e mantenere in memoria. Goblin conserva una texture 4K; BOSCHI e Carbo conservano tre mappe PBR 4K. Materiali e geometria sono condivisi fra istanze dello stesso modello nella stessa scena; gli scheletri restano individuali.

Le pose campionate non mostrano esplosioni della mesh. Restano rifiniture artistiche: presa a due mani sul secchio, raccordo del tiracqua alle mani, eventuali compenetrazioni nelle pose molto piegate e leggibilità dei personaggi nell'inquadratura ampia di Casa Carbo. Alcune clip includono ritorni alla posa eretta: sono mantenute originali. Nessuna espressione facciale animata. Prima di un'eventuale sostituzione definitiva serviranno revisione artistica delle prese e una partita completa sul PC di destinazione; ottimizzazione e LOD restano fuori da questa integrazione.

Build e verifica della versione servita su `localhost:3001`: consultare `CHECKPOINT.md`, `build.log` e `production.json` per lo stato finale.
