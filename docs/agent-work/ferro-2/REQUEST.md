# PARTY GAME — FERRO E FURIA 2.0
## HONOR & STEEL — COMBATTIMENTO DIREZIONALE 3D ISPIRATO A FOR HONOR

Claude, voglio realizzare un enorme aggiornamento del minigioco **FERRO E FURIA — L'ULTIMO GUERRIERO**.

Ho fornito:
- 10 nuovi asset GLB.
- 2 pacchetti professionali di animazioni FBX.
- Due arene complete.
- Diverse armi e scudi.

Voglio integrare questi asset e trasformare profondamente il combattimento.

## OBIETTIVO PRINCIPALE

Voglio un combattimento ispirato alle sensazioni di **FOR HONOR**.

Non una copia del gioco Ubisoft, ma un sistema originale che utilizzi i suoi principi migliori:

- Combattimento corpo a corpo tattico.
- Bersaglio agganciato.
- Guardia in tre direzioni.
- Attacchi da sinistra, destra e dall'alto.
- Parate direzionali.
- Parry perfetti.
- Attacchi leggeri e pesanti.
- Finte.
- Rottura della guardia.
- Schivate.
- Contrattacchi.
- Stamina.
- Combo.
- Reazioni realistiche ai colpi.
- Combattimenti intensi anche con più avversari.

**NON VOGLIO PIÙ UN COMBATTIMENTO DOVE PREMI ATTACCO E IL PERSONAGGIO AGITA L'ARMA A CASO.**

Voglio che le scelte del giocatore determinino davvero l'esito dello scontro.

Mantieni il carattere accessibile e divertente del Party Game: deve essere abbastanza profondo da premiare l'abilità, ma non complicato al punto da risultare frustrante per cinque amici.

---

# 1. ASSET 3D DISPONIBILI

## ARMI

### LANCIA
`lance_of_longinus.glb`

### SPADE
`shattered_crystal_sword.glb`
`free__steampunk_da_vincis_sword_game-ready.glb`
`autumn_sword.glb`
`the_sword_of_victory.glb`

### SCUDI
`scutum.glb`
`medieval_shield.glb`

### ARCO
`bow_and_arrow.glb`

## ARENE

`hell_arena.glb`
`geonosis_arena.glb`

## ANIMAZIONI

`Human Melee Animations FREE.zip`
`Human Archer Animations FREE.zip`

I due ZIP contengono rispettivamente:
- 102 FBX nel pacchetto Melee.
- 142 FBX nel pacchetto Archer.

Comprendono modelli base maschili e femminili, animazioni di combattimento, movimento e altri asset.

I modelli GLB forniti non contengono clip di animazione integrate.

Non inventare animazioni presenti negli asset.

Individua tutti i file nel workspace. Se non sono disponibili localmente, indicami la cartella in cui devo copiarli.

---

# 2. IMPORTAZIONE DEGLI ASSET

Integra tutti i nuovi modelli senza compromettere il gioco esistente.

## ARMI

Voglio modelli 3D dettagliati, correttamente impugnati.

Controlla:
- Dimensioni.
- Scala.
- Rotazione.
- Punto di impugnatura.
- Orientamento della lama.
- Direzione della punta della lancia.
- Aggancio alle mani.
- Materiali.
- Texture.
- Colliders.

Le armi devono muoversi insieme alle mani.

Non devono fluttuare accanto ai personaggi.

Non devono attraversare vistosamente le braccia.

Non devono rimanere immobili mentre il personaggio esegue un attacco.

## VARIANTI ESTETICHE

Le quattro spade possono essere utilizzate come varianti estetiche.

Permetti eventualmente di sceglierle nella schermata delle armi.

Non assegnare automaticamente statistiche superiori alla spada più spettacolare.

Distingui:
- Categoria di arma.
- Modello equipaggiato.
- Profilo di combattimento.

In questo modo in futuro potrò aggiungere altre spade senza riscrivere le meccaniche.

## ASSET MANCANTI

Il pacchetto Melee contiene anche modelli FBX di spada, pugnale, spadone, lancia/polearm, scudo e martello.

Valuta se utilizzarli per completare le categorie di FERRO E FURIA.

Per ascia e doppie lame, verifica prima gli asset già disponibili nel progetto.

Non presentare come completata una categoria se manca il modello o il comportamento necessario.

---

# 3. NUOVE ARENE

Voglio aggiungere due mappe selezionabili.

## ARENA 1 — HELL ARENA

Asset:
`hell_arena.glb`

Questa deve diventare l'arena più cupa e spettacolare.

Realizza:
- Illuminazione infernale.
- Colori intensi ma leggibili.
- Combattimenti ravvicinati.
- Effetti particellari moderati.
- Atmosfera da duello finale.

Non modificare inutilmente la geometria originale.

## ARENA 2 — GEONOSIS ARENA

Asset:
`geonosis_arena.glb`

Questa deve essere un'arena più ampia e scenografica.

È anche il modello più pesante dei due, con circa 201.000 triangoli e 40 texture.

Ottimizza il rendering senza distruggerne l'aspetto.

Utilizza:
- Percorsi reali.
- Coperture.
- Zone per duelli.
- Spawn distanziati.
- Passaggi sicuri.

## MAP VOTING

Integra entrambe le arene nella selezione della mappa.

I giocatori devono poter votare usando telefoni e gamepad, riutilizzando il sistema già presente negli altri minigiochi.

Mantieni eventuali arene precedenti se già funzionanti.

## COLLISIONI

IMPORTANTISSIMO.

Non voglio ripetere gli errori già avuti in alcune mappe degli altri minigiochi.

Controlla:
- Nessun muro invisibile.
- Nessun passaggio visivamente aperto ma bloccato.
- Nessuna possibilità di attraversare pareti solide.
- Spawn sopra il pavimento.
- Nessuna caduta sotto la mappa.
- Camera che non attraversa le pareti.
- Navigazione dei bot, se presenti.

Non usare necessariamente ogni triangolo del modello come collider.

Crea collider semplificati, ma coerenti con la geometria visibile.

---

# 4. SISTEMA DI LOCK-ON — FONDAMENTALE

Voglio una telecamera da combattimento ispirata a For Honor.

## MOVIMENTO LIBERO

Quando il giocatore non ha agganciato nessuno:
- Muove liberamente il personaggio.
- Controlla la camera.
- Può correre.
- Può orientarsi nell'arena.
- Può avvicinarsi a un avversario.

## LOCK-ON

Quando aggancia un avversario:
- La camera si posiziona dietro il personaggio.
- Mantiene entrambi i combattenti visibili.
- Il guerriero si orienta verso il bersaglio.
- Il movimento diventa uno strafe attorno all'avversario.
- Il giocatore può attaccare e difendersi direzionalmente.

Non ruotare la camera in modo brusco.

Non zoomare eccessivamente.

Il bersaglio deve rimanere visibile anche durante schivate e attacchi.

## CAMBIO BERSAGLIO

Con più avversari:
- Si deve poter passare rapidamente da un bersaglio all'altro.
- La selezione deve essere basata su avversari vivi, visibili o ragionevolmente raggiungibili.
- Il cambio deve essere fluido.
- Non deve agganciare giocatori attraverso tutta l'arena.

Quando il bersaglio muore, sblocca o trasferisci il lock-on in modo prevedibile.

## SPLIT-SCREEN

Il sistema deve funzionare in cinque viewport.

Non creare un'unica camera condivisa.

Ogni giocatore possiede lock-on, bersaglio, guardia e stato di combattimento indipendenti.

---

# 5. GUARDIA IN TRE DIREZIONI

QUESTA È LA CARATTERISTICA PIÙ IMPORTANTE.

Voglio tre posizioni di guardia:

**ALTO**
**SINISTRA**
**DESTRA**

Il giocatore deve poter cambiare direzione rapidamente usando lo stick destro mentre è in lock-on.

L'arma deve effettivamente cambiare posizione.

Non voglio che sia soltanto un simbolo HUD.

## GUARDIA ALTA

Il personaggio porta l'arma in posizione difensiva superiore.

## GUARDIA SINISTRA

Il personaggio protegge il lato sinistro.

## GUARDIA DESTRA

Il personaggio protegge il lato destro.

## INDICATORE VISIVO

Mostra un piccolo indicatore triangolare intorno al bersaglio o vicino al centro dell'azione.

Deve indicare:
- Guardia attuale.
- Direzione dell'attacco nemico.
- Momento di pericolo.

Non coprire il modello dell'avversario.

Con cinque viewport, deve essere piccolo ma leggibile.

## LOGICA DIREZIONALE

Gli attacchi arrivano da:
- Alto.
- Sinistra.
- Destra.

Una guardia corretta protegge dal corrispondente attacco bloccabile.

Una guardia sbagliata lascia il giocatore vulnerabile.

ATTENZIONE: definisci chiaramente le direzioni nel sistema di riferimento del difensore, gestendo correttamente l'orientamento e l'effetto specchio fra avversari.

Non permettere che un attacco indicato come destro venga bloccato dalla direzione sbagliata.

La posizione della guardia deve essere sincronizzata con l'animazione reale del personaggio.

---

# 6. ATTACCHI DIREZIONALI

Voglio attacchi realmente diversi.

## ATTACCO DA SINISTRA

Il personaggio prepara l'arma e colpisce da sinistra.

## ATTACCO DA DESTRA

Il personaggio colpisce dal lato destro.

## ATTACCO DALL'ALTO

Il personaggio esegue un colpo verticale.

## ATTACCO LEGGERO

- Rapido.
- Poco danno.
- Recupero breve.
- Utile per interrompere azioni vulnerabili.
- Può iniziare combo.

## ATTACCO PESANTE

- Più lento.
- Maggior danno.
- Animazione evidente.
- Possibilità di finta durante la preparazione.
- Maggiore vulnerabilità se manca.

## CONTROLLO

La direzione dell'attacco dipende dalla guardia selezionata quando viene avviato.

Non deve essere casuale.

## HITBOX

Il danno deve avvenire durante la finestra d'impatto dell'animazione.

Non basta essere vicini a un avversario.

Verifica:
- Distanza.
- Orientamento.
- Collisione dell'arma.
- Direzione.
- Stato del bersaglio.
- Parata.
- Schivata.
- Eventuali ostacoli.

Evita danni multipli accidentali da un solo colpo.

---

# 7. PARATE DIREZIONALI

Quando il giocatore difende correttamente:
- Le armi si scontrano.
- Compare un effetto d'impatto.
- Si sente un suono metallico.
- Il personaggio reagisce.
- L'attacco viene bloccato secondo le regole dell'arma.

Voglio che una parata sia fisicamente credibile.

Non basta far apparire la scritta BLOCCATO.

## PARRY PERFETTO

Il giocatore può tentare un parry con un input difensivo temporizzato, ad esempio un attacco pesante durante la finestra corretta dell'attacco avversario.

Quando riesce:
- Breve animazione di deviazione.
- Scintille.
- Suono caratteristico.
- Piccolo sbilanciamento del nemico.
- Opportunità di contrattacco.

Quando fallisce:
- Può essere colpito.
- Non deve ottenere protezione gratuita.

Le finestre temporali devono essere configurabili.

Non rendere il parry automatico o semplicissimo.

Non rendere però impossibile la reazione in multiplayer.

### COMBO DOPO IL PARRY

Dopo un parry riuscito, premia il buon tempismo con una breve apertura offensiva.

Non garantire eliminazioni istantanee.

Non creare stun-lock infiniti.

---

# 8. FINTE — FEINT

Voglio che il giocatore possa fingere un attacco pesante.

### ESEMPIO

Un giocatore prepara un colpo dall'alto.

L'avversario cambia guardia per bloccarlo.

Il primo giocatore annulla l'attacco durante la preparazione.

Poi attacca da destra.

Questo deve diventare possibile.

## REGOLE

- Solo determinati attacchi possono essere annullati.
- La finta avviene prima della finestra attiva di danno.
- Non deve generare danno.
- Non deve teletrasportare l'arma.
- Deve avere un'animazione coerente.
- Deve rispettare lo stato della stamina.

Le finte devono creare veri duelli psicologici.

---

# 9. GUARD BREAK E CONTRO-GUARD BREAK

Voglio una meccanica che impedisca ai giocatori di difendersi continuamente.

## GUARD BREAK

Attacco ravvicinato che tenta di aprire la difesa.

Se riesce:
- Breve sbilanciamento.
- Possibilità di un colpo successivo.
- Feedback visivo.
- Piccola animazione di presa/spinta.

Non deve funzionare da distanze irrealistiche.

## CONTRO-GUARD BREAK

Il difensore può reagire con il pulsante corretto entro una finestra temporale.

Se eseguito bene:
- Respinge il tentativo.
- Entrambi ritornano in posizione.
- Nessuno ottiene un vantaggio ingiustificato.

Non far diventare il guard break un pulsante che garantisce danno.

---

# 10. SCHIVATE, STAMINA E COMBO

## SCHIVATE

Consenti:
- Schivata laterale sinistra.
- Schivata laterale destra.
- Schivata indietro.

La direzione dipende dallo stick sinistro.

La schivata deve spostare realmente il personaggio.

Non deve attraversare gli avversari o i muri.

Le eventuali finestre di invulnerabilità devono essere brevi e verificabili.

## STAMINA

Introduci o migliora la stamina.

Consumano stamina:
- Attacchi pesanti.
- Finte.
- Schivate.
- Guard break.
- Attacchi speciali.
- Alcuni blocchi, secondo bilanciamento.

Evita rigenerazione immediata durante azioni incompatibili.

Non consentire a un giocatore di schivare infinite volte.

## COMBO

Realizza combo brevi e riconoscibili.

Esempi:
- Leggero → leggero.
- Leggero → pesante.
- Pesante → leggero.
- Finta → attacco laterale.
- Parry → contrattacco.
- Guard break → attacco rapido.

Ogni arma deve avere un proprio ritmo.

Non voglio combo infinite.

---

# 11. COMBATTIMENTI CON 3–5 GIOCATORI

For Honor è particolarmente interessante nei duelli, ma FERRO E FURIA deve funzionare anche con cinque amici tutti contro tutti.

## PROBLEMA DA RISOLVERE

Se tre giocatori attaccano contemporaneamente uno solo, il difensore non deve essere bloccato in un ciclo infinito di colpi.

## SISTEMA ANTI-ACCERCHIAMENTO

Implementa un sistema originale e leggero che riconosca la pressione di più avversari.

Valuta una barra temporanea di resistenza all'accerchiamento che:
- Si carica quando si ricevono attacchi da diversi giocatori in poco tempo.
- Non si carica semplicemente restando fermi.
- Offre per pochi secondi una difesa o resistenza agli stordimenti.
- Non rende immortali.
- Non infligge automaticamente danni agli avversari.

Deve aiutare il giocatore abile a tentare la fuga o il contrattacco.

Non deve diventare un vantaggio automatico per chi è vicino alla sconfitta.

## ATTACCHI ESTERNI

Quando un altro giocatore attacca mentre siamo agganciati a un bersaglio:
- Mostra un indicatore discreto della provenienza.
- Consenti schivata o risposta appropriata.
- Mantieni la possibilità di cambiare bersaglio.

Non bloccare tutte le azioni soltanto perché il giocatore è in lock-on.

---

# 12. ARMI E STILI DI COMBATTIMENTO

Le sette categorie di FERRO E FURIA devono utilizzare il nuovo sistema dove appropriato.

## SPADA

Stile equilibrato:
- Tre guardie.
- Tre direzioni di attacco.
- Parry.
- Finte.
- Combo veloci.

Utilizza le quattro nuove spade come varianti estetiche.

## SPADA E SCUDO

Stile difensivo:
- Tre direzioni.
- Blocchi più affidabili.
- Attacchi di scudo.
- Guard break.
- Buona resistenza.
- Mobilità inferiore alle doppie lame.

Gli scudi devono essere agganciati correttamente alla mano libera.

## LANCIA

Stile basato sulla distanza:
- Affondi.
- Attacco alto.
- Attacchi laterali coerenti con l'arma.
- Controllo della distanza.
- Vulnerabilità quando il nemico riesce ad avvicinarsi.

Usa Lance of Longinus o il modello polearm dei pack.

Non utilizzare le animazioni di spada senza adattarle alla lancia.

## DOPPIE LAME

Stile aggressivo:
- Combo rapide.
- Schivate.
- Breve portata.
- Parry più rischiosi.
- Recupero ridotto.

Utilizza pugnali compatibili dai pack, se il progetto non possiede già modelli migliori.

## ASCIA

Stile offensivo:
- Fendenti laterali.
- Attacchi pesanti.
- Forte pressione.
- Recupero evidente.

## MARTELLO

Stile pesante:
- Attacchi lenti.
- Grande impatto.
- Buona pressione sulle guardie.
- Minore mobilità.

Il pack Melee include un modello Warhammer utilizzabile come base.

## ARCO

ATTENZIONE: l'arco richiede un sistema diverso rispetto alle armi da mischia.

Quando l'arciere non sta mirando:
- Può muoversi.
- Può schivare.
- Può usare una difesa ravvicinata limitata.
- Può tentare di sfuggire agli avversari.

Quando mira:
- La telecamera passa sopra la spalla.
- Compare un reticolo preciso.
- Il giocatore tende la corda.
- La freccia viene scoccata al rilascio.
- Il proiettile segue una traiettoria reale.

Non forzare sull'arco il sistema di tre guardie con una spada invisibile.

L'arciere deve poter vincere usando posizionamento e precisione, ma non può mantenere per sempre la distanza.

---

# 13. ANIMAZIONI REALI DAI DUE PACCHETTI

Questa è una delle parti più importanti dell'aggiornamento.

## HUMAN MELEE ANIMATIONS

Analizza tutti gli FBX.

Sono presenti:
- Animazioni maschili.
- Animazioni femminili.
- Attacchi a una mano.
- Attacchi a due mani.
- Attacchi con polearm.
- Attacchi con scudo.
- Idle da combattimento.
- Corsa direzionale.
- Strafe.
- Reazioni ai danni.
- Morte.
- Pose di impugnatura.
- Modelli di armi.

Non limitarti a importare le clip.

Realizza un Animation Controller capace di usarle correttamente.

## HUMAN ARCHER ANIMATIONS

Il pack contiene:
- Bow Idle.
- Bow Shot Load.
- Bow Shot Hold.
- Bow Shot Release.
- Movimenti.
- Corsa.
- Camminata.
- Strafe.
- Estrazione dell'arma.
- Modelli base e accessori.

Il tiro deve utilizzare la sequenza:

**LOAD → HOLD → RELEASE → RECOVERY**

Il rilascio della freccia deve corrispondere al momento corretto dell'animazione.

## ANIMAZIONI MANCANTI

I pacchetti non contengono clip esplicitamente dedicate a:
- Parry.
- Block.
- Dodge.
- Feint.
- Guard break.

Realizza queste animazioni attraverso:
- Layer procedurali.
- Animazioni additive.
- IK quando utile.
- Retargeting.
- Movimenti mirati creati offline se necessario.

Non inventare che queste clip siano già presenti.

### PRIORITÀ

Voglio soprattutto:
1. Guardie visibili.
2. Fendenti convincenti.
3. Affondi corretti.
4. Parate con contatto credibile.
5. Contrattacchi fluidi.
6. Arco con mani e corda funzionanti.

Non accettare animazioni in cui il personaggio resta immobile mentre l'arma ruota da sola.

---

# 14. CONTROLLER ISPIRATO A FOR HONOR

Deve funzionare su Xbox e PlayStation.

## PROPOSTA GAMEPAD — ARMI DA MISCHIA

**Stick sinistro:** movimento.

**Stick destro senza lock-on:** camera.

**LT/L2 mantenuto:** lock-on / modalità guardia.

**Stick destro durante lock-on:** guardia alto, sinistra, destra.

**R3:** cambia bersaglio.

**RB/R1:** attacco leggero.

**RT/R2:** attacco pesante.

**A/✕:** schivata.

**B/○:** finta.

**X/□:** guard break / contro-guard break.

**LB/L1:** abilità speciale dell'arma.

Il mapping deve essere adattato se il sistema di input condiviso utilizza già un pulsante obbligatorio.

## BOW CONTROLS

Per l'arco:
- LT/L2: mira.
- Stick destro: movimento della camera/mira.
- RT/R2 mantenuto: carica.
- Rilascio RT/R2: scocca.
- A/✕: schivata.
- LB/L1: abilità speciale.

Gli altri pulsanti devono mantenere funzioni coerenti.

Non far cambiare direzione di guardia allo stick destro mentre l'arciere sta cercando di mirare.

## CONTROLLER TELEFONO

Il telefono non possiede necessariamente due stick fisici.

Realizza un'interfaccia dedicata:
- Joystick movimento.
- Controllo guardia a tre direzioni.
- Lock-on.
- Attacco leggero.
- Attacco pesante.
- Schivata.
- Finta.
- Guard break.
- Special.

Per l'arco:
- Area di mira touch.
- Pulsante di carica e rilascio.
- Schivata.
- Special.

Mantieni il supporto multitouch.

Non costringere il giocatore a premere contemporaneamente tre pulsanti troppo vicini.

La versione telefono deve essere realmente utilizzabile, non una copia rimpicciolita dei comandi gamepad.

---

# 15. COMBATTIMENTO REALMENTE SINCRONIZZATO

Non voglio animazioni scollegate dalla logica dei colpi.

Ogni attacco deve possedere:
- Startup.
- Finestra attiva.
- Recupero.
- Direzione.
- Portata.
- Danno.
- Consumo stamina.
- Eventuale proprietà speciale.
- Regole di interruzione.

Durante la finestra attiva:
- Verifica collisione reale.
- Verifica ostacoli.
- Valuta guardia.
- Valuta parry.
- Valuta schivata.
- Applica danno soltanto se valido.

## AUTORITÀ DELLA PARTITA

Utilizza il sistema multiplayer già presente.

Lo stato autorevole deve determinare:
- Danni.
- Guardia valida.
- Parry.
- Eliminazioni.
- Stamina.
- Vittoria.

Il client può mostrare immediatamente il feedback visivo, ma non deve poter inventare colpi riusciti.

Non dipendere dal frame rate per finestre di danno o parry.

Evita che latenze normali rendano le parate sistematicamente impossibili.

---

# 16. FEEDBACK DEL COMBATTIMENTO

Voglio che ogni duello sia spettacolare.

## QUANDO DUE SPADE SI SCONTRANO

- Scintille.
- Suono metallico.
- Piccola reazione delle braccia.
- Brevissimo feedback della camera.
- Animazione coerente.

## QUANDO UN ATTACCO VA A SEGNO

- Reazione al colpo.
- Suono specifico.
- Piccolo effetto.
- Aggiornamento vita.
- Feedback chiaro.

## QUANDO UN PARRY RIESCE

Voglio un momento particolarmente soddisfacente:
- Effetto sonoro distintivo.
- Scintille più evidenti.
- Animazione di deviazione.
- Breve apertura per il contrattacco.

## QUANDO UN GIOCATORE MUORE

- Animazione di sconfitta.
- Arma che può cadere, se gestibile.
- Notifica eliminazione.
- Aggiornamento dei superstiti.

Evita eccessivo sangue o effetti che coprono tutta la visuale.

Non usare suoni estratti da For Honor.

---

# 17. CAMERA CINEMATOGRAFICA

Voglio una telecamera in terza persona che faccia sembrare i combattimenti davvero importanti.

Durante un duello:
- Personaggio visibile.
- Bersaglio visibile.
- Animazioni leggibili.
- Movimenti fluidi.
- Distanza corretta.

Durante il parry:
- Piccola risposta della camera.
- Nessun fermo immagine eccessivo.

Durante un attacco pesante:
- Leggero impatto visivo.
- Nessun movimento che renda impossibile orientarsi.

Durante il colpo finale:
- Possibile rallentamento puramente visivo e brevissimo.
- Solo se compatibile con il multiplayer.

NON rallentare la simulazione globale per un singolo giocatore mentre gli altri continuano a combattere.

In cinque viewport, disattiva o riduci effetti cinematografici che compromettono la leggibilità.

---

# 18. ROUND E VITTORIA

Mantieni il principio originale di FERRO E FURIA:

**L'ULTIMO GUERRIERO SOPRAVVISSUTO VINCE IL ROUND.**

Mantieni tre round, se già implementati.

Prima di ogni round:
- Selezione dell'arma.
- Votazione dell'arena quando prevista.
- Countdown.
- Spawn sicuri.

Alla fine:
- Vincitore.
- Punteggio.
- Classifica.
- Transizione successiva.

Non introdurre respawn durante il round.

Non permettere a un giocatore eliminato di colpire o parare.

Mantieni il Sudden Death se già previsto per impedire fughe infinite.

Le nuove mappe devono essere compatibili con l'eventuale restringimento dell'arena.

---

# 19. BOT CON GUARDIA DIREZIONALE

Se esistono bot, adattali al sistema.

I bot devono:
- Agganciare bersagli.
- Cambiare guardia.
- Attaccare da diverse direzioni.
- Schivare.
- Parare occasionalmente.
- Usare finte in modo limitato.
- Cambiare bersaglio.
- Rispettare stamina e distanze.

Non voglio bot che fanno parry perfetto ogni volta.

I bot non devono conoscere anticipatamente gli input dei giocatori.

Possono reagire a segnali visibili e stati realmente disponibili.

Il comportamento deve differire per arma.

---

# 20. OTTIMIZZAZIONE CINQUE GIOCATORI

Le due arene e i nuovi modelli sono dettagliati.

Indicativamente:
- Hell Arena: circa 90.400 triangoli.
- Geonosis Arena: circa 201.200 triangoli.
- Sword of Victory: circa 53.400 triangoli.
- Lance of Longinus: circa 19.100 triangoli.

Non creare materiali, texture e geometrie completamente duplicate per ogni visuale.

Utilizza:
- Asset caching.
- Collisioni semplificate.
- Animazioni condivise a livello di dati.
- Stati scheletrici separati per personaggio.
- Culling.
- Materiali condivisi.
- Ombre selettive.
- Particelle in pooling.
- Hitbox efficienti.

Non semplificare la qualità delle armi inutilmente.

Misura le prestazioni e ottimizza gli elementi realmente costosi.

---

# 21. LICENZE E PROVENIENZA

Conserva la provenienza di ogni asset.

Dai metadati GLB risulta:
- Molti modelli sono CC BY 4.0.
- Sword of Victory è dichiarata CC0.
- Bow and Arrow è dichiarato CC BY-NC-SA 4.0.
- Scutum riporta una licenza Sketchfab Standard da verificare.

Non presumere che tutti gli asset siano utilizzabili commercialmente.

Geonosis Arena richiama un'ambientazione appartenente all'universo Star Wars: verifica separatamente eventuali diritti di proprietà intellettuale prima di pubblicare.

Lo stesso vale per nomi o design riconoscibili di altre opere.

Non modificare le attribuzioni originali.

---

# 22. ORDINE DI SVILUPPO — IMPORTANTISSIMO

Voglio un aggiornamento completo, ma senza perderti in mesi di lavoro.

Procedi con priorità intelligenti.

## FASE A — BASE DEL COMBATTIMENTO
1. Analizza la versione attuale di FERRO E FURIA.
2. Importa le nuove armi e le due mappe.
3. Converti e organizza le animazioni.
4. Implementa lock-on.
5. Implementa guardia nelle tre direzioni.
6. Implementa attacchi leggeri e pesanti direzionali.

Questa fase deve già permettere un duello giocabile.

## FASE B — PROFONDITÀ
7. Parate.
8. Parry.
9. Finte.
10. Guard break.
11. Schivate.
12. Stamina.
13. Combo.

Verifica che le meccaniche funzionino realmente prima di aggiungere altri effetti.

## FASE C — VARIETÀ
14. Adatta le sette armi.
15. Integra completamente le animazioni arciere.
16. Migliora le animazioni delle guardie.
17. Migliora audio e impatti.
18. Aggiungi protezione anti-accerchiamento.
19. Adatta i bot, se disponibili.

## FASE D — RIFINITURA
20. HUD direzionale.
21. Camera.
22. Controlli telefono.
23. Map voting.
24. Performance cinque giocatori.
25. Test essenziali.

Non dedicare troppo tempo alla decorazione dell'arena prima che il combattimento sia divertente.

---

# 23. TEST MIRATI

Non voglio centinaia di simulazioni.

Esegui soltanto le verifiche necessarie:

- Typecheck.
- Build.
- Caricamento armi.
- Caricamento entrambe le mappe.
- Lock-on e cambio bersaglio.
- Guardia alto/sinistra/destra.
- Attacchi direzionali.
- Blocco corretto e guardia sbagliata.
- Parry riuscito e fallito.
- Finta.
- Guard break e contro.
- Schivata.
- Attacco con lancia.
- Tiro con l'arco.
- Due giocatori in duello.
- Cinque giocatori tutti contro tutti.
- Vittoria del round.
- Un campione FPS su entrambe le mappe.

Verifica che con il telefono si possano realmente usare le tre direzioni.

Non dichiarare verificati gamepad fisici non collegati durante i test.

Non eseguire lunghi benchmark ripetuti.

Non produrre video enormi.

Non testare tutti gli altri minigiochi se non sono stati modificati sistemi condivisi.

---

# 24. REPORT FINALE

Alla fine voglio sapere:

1. Quali asset sono stati integrati.
2. Come funzionano le due mappe.
3. Come funziona il lock-on.
4. Come funziona la guardia a tre direzioni.
5. Come funzionano parry, finte e guard break.
6. Quali animazioni reali sono state utilizzate.
7. Quali animazioni sono state create o adattate.
8. Come funziona l'arco.
9. Come funzionano i combattimenti con cinque persone.
10. FPS misurati e problemi residui.

Mostra poche prove visive significative:
- Guardia direzionale.
- Attacco e parry.
- Hell Arena.
- Geonosis Arena.
- Arciere durante il tiro.

Non serve un report lunghissimo.

---

# VINCOLI ASSOLUTI

- NON ricostruire FERRO E FURIA da zero.
- NON trasformarlo in un FPS.
- NON eliminare le sette categorie di armi.
- NON sacrificare il multiplayer.
- NON rompere telefono e gamepad.
- NON modificare Sparatoria.
- NON modificare Backrooms.
- NON modificare Orda Finale.
- NON usare animazioni incompatibili senza adattarle.
- NON inventare asset mancanti.
- NON replicare direttamente interfaccia, personaggi, audio o animazioni proprietarie di For Honor.
- NON introdurre framework enormi.
- NON usare Flash.
- NON fare commit.
- NON fare push.
- NON fare deploy.

## OBIETTIVO FINALE

Voglio che FERRO E FURIA diventi un vero gioco di duelli medievali.

Immagina:

Goblin e Victor si affrontano in Hell Arena.

Entrambi agganciano il bersaglio.

Goblin porta la spada in alto.

Victor alza la guardia.

Goblin prepara un attacco pesante.

Victor tenta il parry.

Ma Goblin esegue una FINTA.

Victor sbaglia il tempismo.

Goblin cambia direzione e attacca da sinistra.

Victor riceve il colpo.

Prova a reagire con un affondo.

Goblin para perfettamente.

Le spade si scontrano.

Scintille.

Suono metallico.

Goblin prova un guard break.

Victor lo contrasta.

Entrambi si allontanano.

Nel frattempo arriva BOSCHI con una lancia.

Il duello diventa un combattimento a tre.

Victor riesce a schivare.

Goblin viene colpito.

BOSCHI prova a finirlo.

Goblin esegue un ultimo contrattacco.

**QUESTO È IL COMBATTIMENTO CHE VOGLIO.**

Ogni attacco deve avere una direzione.

Ogni parata deve richiedere una decisione.

Ogni finta deve poter ingannare.

Ogni arma deve avere uno stile diverso.

Ogni vittoria deve sembrare meritata.

**FERRO E FURIA 2.0 — HONOR & STEEL.**

Voglio la profondità tattica dei duelli medievali e il divertimento immediato di un Party Game da cinque giocatori.

Procedi direttamente all'implementazione, riutilizza tutto ciò che funziona e svolgi soltanto i test indispensabili.