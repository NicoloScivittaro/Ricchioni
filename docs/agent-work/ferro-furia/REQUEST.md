# PARTY GAME — NUOVO MINIGIOCO: FERRO E FURIA
## L'ULTIMO GUERRIERO — ARENA MULTIPLAYER CON SPADE, ARCHI, LANCE, MARTELLI E ARMI SPECIALI

Claude, voglio aggiungere un nuovo minigioco 3D al Party Game.

**NOME: FERRO E FURIA**

**SOTTOTITOLO: L'ULTIMO GUERRIERO**

È un combattimento arena da 2 a 5 giocatori, tutti contro tutti, con armi medievali differenti.

Voglio un minigioco spettacolare, competitivo, dinamico e divertente, con combattimenti realmente basati su abilità e tempismo.

Ogni giocatore sceglie la propria arma prima del combattimento.

Le armi comprendono:
- Spada.
- Lancia.
- Arco.
- Ascia.
- Martello da guerra.
- Doppie lame.
- Spada e scudo.

Ognuna deve avere attacchi, punti di forza, debolezze e abilità diverse.

**L'ULTIMO GIOCATORE RIMASTO VIVO VINCE IL ROUND.**

Voglio che questo minigioco sembri un vero gioco action arena 3D, non una semplice arena con personaggi che si tolgono punti vita premendo un pulsante.

---

# 1. STRUTTURA DEL MINIGIOCO

La modalità deve funzionare con:
- 2–5 giocatori.
- Controller Xbox.
- Controller PlayStation.
- Telefoni come controller.
- Split-screen.
- Lobby esistente.
- Rullo dei minigiochi.
- ScoreManager.
- Classifica finale.

Non ricostruire i sistemi già funzionanti.

Riutilizza le componenti tecniche esistenti quando appropriato.

## STRUTTURA DELLA PARTITA

La partita è composta da 3 round.

Prima di ogni round:
1. I giocatori scelgono un'arma.
2. Compare un breve countdown.
3. I guerrieri entrano nell'arena.
4. Inizia il combattimento.
5. I giocatori eliminati non possono rientrare.
6. L'ultimo sopravvissuto vince il round.

Dopo il terzo round viene mostrata la classifica finale.

## PUNTEGGIO

Premia:
- Vittoria del round.
- Posizione raggiunta nella sopravvivenza.
- Eliminazioni effettuate.

Le eliminazioni devono offrire un bonus, ma sopravvivere deve rimanere l'obiettivo più importante.

Calibra i punteggi affinché uccidere un solo avversario e morire subito non sia più vantaggioso che arrivare agli ultimi due.

Gestisci correttamente le eliminazioni simultanee.

Se due o più giocatori terminano con lo stesso punteggio in testa, prevedi un breve spareggio invece di scegliere casualmente il vincitore.

Non assegnare una vittoria arbitraria in caso di parità reale.

---

# 2. SCELTA DELLE ARMI

Questa schermata deve essere molto bella.

Prima del round mostra una selezione delle sette armi.

Per ogni arma visualizza:
- Modello 3D o anteprima grafica.
- Nome.
- Danno indicativo.
- Velocità.
- Portata.
- Difesa.
- Abilità speciale.

## CONTROLLER

Ogni giocatore deve poter navigare nella selezione usando il proprio controller.

Sul telefono mostra una selezione chiara e touch-friendly.

La scelta deve appartenere soltanto al giocatore corretto.

I giocatori possono scegliere anche la stessa arma.

Non introdurre limitazioni arbitrarie.

## SCELTA TRA I ROUND

Permetti di cambiare arma prima di ogni nuovo round.

Questo rende il gioco più strategico.

Chi perde con l'arco può provare la spada nel round successivo.

La selezione non deve rallentare eccessivamente la partita.

---

# 3. COMBATTIMENTO 3D IN TERZA PERSONA

Voglio una visuale in terza persona che permetta di vedere il personaggio, l'arma e le animazioni.

### CAMERA

- Leggermente dietro il personaggio.
- Fluida.
- Adatta ai combattimenti ravvicinati.
- Con collisione rispetto ai muri.
- Senza nascondere i nemici dietro al personaggio.
- Funzionante anche con cinque viewport.

Per l'arco utilizza una visuale di mira più precisa, sopra la spalla.

Non introdurre cambi di telecamera bruschi.

## MOVIMENTO

Ogni giocatore può:
- Camminare.
- Correre.
- Ruotare.
- Saltare, se utile al design dell'arena.
- Schivare.
- Attaccare.
- Difendersi.
- Utilizzare la propria abilità speciale.

Il movimento deve essere reattivo.

Non voglio personaggi pesantissimi o bloccati per animazioni inutilmente lunghe.

Ma le armi più grandi devono trasmettere un senso di peso.

---

# 4. LE SETTE ARMI

Ogni arma deve usare meccaniche realmente differenti.

Non voglio sette modelli diversi che eseguono lo stesso attacco.

## ARMA 1 — SPADA

Arma equilibrata.

Caratteristiche:
- Portata media.
- Velocità media.
- Danno medio.
- Buona difesa.
- Combo facili da utilizzare.

### ATTACCHI

Attacco leggero:
Fendente veloce.

Attacco pesante:
Colpo più lento ma potente.

Combo:
Sequenza di due o tre colpi, con animazioni differenti.

### ABILITÀ SPECIALE — CONTRATTACCO

Dopo una parata perfetta, il giocatore può eseguire un rapido contrattacco.

L'abilità deve essere forte ma non garantire automaticamente una kill.

---

## ARMA 2 — LANCIA

Arma a lunga portata.

Caratteristiche:
- Grande distanza di attacco.
- Danno buono.
- Difficoltà negli scontri troppo ravvicinati.
- Attacchi prevalentemente frontali.

### ATTACCHI

Attacco leggero:
Affondo rapido.

Attacco pesante:
Affondo più lungo e potente.

### ABILITÀ SPECIALE — CARICA

Breve avanzamento accompagnato da un affondo.

Deve essere possibile evitarlo spostandosi lateralmente.

Se manca il bersaglio, il giocatore deve subire un breve recupero.

La lancia non deve colpire gli avversari attraverso il corpo del personaggio in maniera irrealistica.

---

## ARMA 3 — ARCO

Arma a distanza.

Caratteristiche:
- Alta portata.
- Danno legato alla carica del tiro.
- Debolezza nel combattimento ravvicinato.
- Necessità di prendere la mira.

### FUNZIONAMENTO

Il giocatore tende l'arco.

Più a lungo carica, entro un limite ragionevole, maggiore è la potenza del colpo.

Quando rilascia il pulsante, scocca la freccia.

### FISICA DELLE FRECCE

Voglio frecce reali:
- Partono dalla posizione corretta.
- Seguono una traiettoria.
- Possono colpire superfici e personaggi.
- Non attraversano muri.
- Possono essere evitate.
- Si conficcano brevemente negli oggetti, se sostenibile.

Non simulare frecce con danno istantaneo invisibile.

### ABILITÀ SPECIALE — FRECCIA PERFORANTE

Una freccia speciale che può attraversare una difesa parziale o più bersagli allineati, secondo un bilanciamento controllato.

Deve avere cooldown.

### BILANCIAMENTO

L'arco non deve dominare tutta la partita.

Inserisci:
- Ostacoli nell'arena.
- Tempo per tendere l'arco.
- Munizioni o recupero delle frecce ragionevole.
- Vulnerabilità agli attacchi ravvicinati.
- Mira leggibile su controller e telefono.

Non rendere però l'arco inutilizzabile contro gli avversari veloci.

---

## ARMA 4 — ASCIA

Arma aggressiva.

Caratteristiche:
- Danno alto.
- Velocità medio-bassa.
- Colpi ampi.
- Difesa inferiore alla spada.

### ATTACCHI

Attacco leggero:
Fendente laterale.

Attacco pesante:
Colpo verticale potente.

### ABILITÀ SPECIALE — COLPO ROTANTE

Attacco circolare che può colpire più avversari vicini.

Richiede preparazione.

Non deve infliggere danni illimitati mentre il personaggio ruota.

Una singola attivazione deve avere finestre di impatto definite.

---

## ARMA 5 — MARTELLO DA GUERRA

L'arma più pesante.

Caratteristiche:
- Danno molto alto.
- Attacchi lenti.
- Grande capacità di interrompere i nemici.
- Forte vulnerabilità dopo un colpo mancato.

### ATTACCHI

Attacco leggero:
Colpo pesante ma relativamente rapido.

Attacco pesante:
Martellata devastante.

### ABILITÀ SPECIALE — ONDA D'URTO

Il giocatore colpisce il terreno.

Si genera un'onda d'urto visibile che sbilancia temporaneamente gli avversari molto vicini.

Non deve causare eliminazioni istantanee.

Non deve colpire attraverso barriere solide.

### ANIMAZIONI

Voglio una sensazione di peso notevole.

La preparazione deve essere evidente e offrire una possibilità di schivata.

---

## ARMA 6 — DOPPIE LAME

Arma rapidissima.

Caratteristiche:
- Colpi veloci.
- Portata molto corta.
- Mobilità alta.
- Danno per colpo inferiore.
- Combo rapide.

### ATTACCHI

Attacco leggero:
Taglio veloce.

Attacco pesante:
Sequenza più forte ma rischiosa.

### ABILITÀ SPECIALE — ASSALTO RAPIDO

Breve scatto offensivo con doppio fendente.

Non deve teletrasportare il personaggio attraverso pareti o avversari.

Se lo scatto manca, deve esistere un piccolo tempo di recupero.

---

## ARMA 7 — SPADA E SCUDO

Arma difensiva.

Caratteristiche:
- Buona protezione.
- Velocità inferiore.
- Attacchi relativamente semplici.
- Ottima capacità di contrastare la pressione.

### ATTACCHI

Attacco leggero:
Colpo di spada.

Attacco pesante:
Fendente caricato.

### DIFESA

Lo scudo deve bloccare realmente i colpi frontali.

Non deve proteggere automaticamente dai colpi alle spalle.

### ABILITÀ SPECIALE — COLPO DI SCUDO

Breve attacco che sbilancia il nemico.

Non deve stordirlo per diversi secondi senza possibilità di reagire.

---

# 5. COMBATTIMENTO BASATO SUL TEMPO GIUSTO

Voglio che il giocatore più bravo abbia un vantaggio reale.

Implementa un sistema con:

### ATTACCHI LEGGERI
- Veloci.
- Danno moderato.
- Recupero breve.

### ATTACCHI PESANTI
- Più potenti.
- Preparazione riconoscibile.
- Maggiore recupero se mancati.

### SCHIVATA
- Breve movimento evasivo.
- Direzione controllabile.
- Costo di stamina.
- Piccola finestra difensiva, se appropriata.

### PARATA
- Riduce o annulla il danno secondo l'arma.
- Funziona soltanto con orientamento valido.
- Consuma stamina o espone a una rottura della guardia.

### PARRY
- Finestra temporale breve.
- Richiede tempismo.
- Può interrompere un colpo avversario.
- Apre un'opportunità di contrattacco.

Non dare automaticamente una parata perfetta a chi tiene premuto il pulsante.

### STAMINA

Ogni giocatore possiede stamina.

Serve a limitare:
- Schivate continue.
- Attacchi pesanti ripetuti.
- Difesa permanente.
- Spam delle abilità.

La stamina deve rigenerarsi in maniera ragionevole.

Gli attacchi leggeri non devono esaurirla immediatamente.

Non trasformare il gioco in un simulatore lentissimo.

**VOGLIO UN COMBATTIMENTO ACTION, NON UN SOULSLIKE ESTREMAMENTE PUNITIVO.**

---

# 6. HITBOX E DANNI REALI

Questa è una delle priorità tecniche.

Ogni colpo deve essere sincronizzato all'animazione.

## REGOLE

- Un colpo infligge danno solo nella propria finestra attiva.
- La hitbox deve seguire il movimento dell'arma.
- La portata deve essere coerente con la geometria.
- Il colpo non deve attraversare muri.
- Non deve colpire persone alle spalle se l'animazione è un affondo frontale.
- Un singolo attacco non deve colpire ripetutamente lo stesso bersaglio per errore.
- L'interruzione dell'attacco deve fermare le hitbox.
- La difesa deve essere valutata al momento dell'impatto.

Usa hitbox di combattimento pratiche e robuste, senza ricorrere a costose collisioni triangolo per triangolo.

## REAZIONE AI COLPI

Quando un giocatore viene colpito:
- Piccola reazione del personaggio.
- Effetto d'impatto.
- Feedback sonoro.
- Aggiornamento della vita.
- Breve indicatore del danno ricevuto.

Non usare stordimenti continui che impediscono di giocare.

## BILANCIAMENTO

Tutti iniziano con la stessa salute di base.

Utilizza statistiche configurabili per ogni arma.

Evita:
- One-shot normali.
- Combo infinite.
- Stunlock permanente.
- Arco invincibile a distanza.
- Martello imbattibile in corpo a corpo.
- Scudo che blocca ogni attacco per sempre.

Ogni arma deve poter vincere contro le altre grazie alle decisioni e all'abilità del giocatore.

---

# 7. ABILITÀ SPECIALI

Ogni arma ha la propria abilità già descritta.

La special deve:
- Essere visivamente riconoscibile.
- Avere un cooldown.
- Richiedere una scelta tattica.
- Non garantire automaticamente un'eliminazione.
- Avere una possibile risposta difensiva.

Mostra il cooldown chiaramente nell'HUD.

Non permettere di attivare la special durante stati incompatibili come morte, caduta, stordimento o altre animazioni non interrompibili.

---

# 8. ARENA 3D — IL COLOSSEO DEL FERRO

Voglio un'arena molto bella da vedere.

## AMBIENTAZIONE

Un Colosseo fantasy con:
- Grandi tribune.
- Pietra.
- Colonne.
- Torce.
- Bandiere.
- Porte metalliche.
- Statue.
- Pavimentazione curata.
- Piccoli effetti di polvere.
- Illuminazione cinematografica.

Stile: fantasy medievale realistico, ma colorato e leggibile quanto basta per il Party Game.

Non voglio un'arena vuota con pavimento piatto e quattro muri.

## STRUTTURA

La mappa deve contenere:
- Spazio centrale per combattere.
- Colonne che interrompono la linea di tiro degli archi.
- Percorsi laterali.
- Ostacoli utilizzabili.
- Zone dove schivare e aggirare.
- Spawn ben distanziati.

Non creare posizioni dove un arciere diventa irraggiungibile.

Tutti i giocatori devono poter raggiungere qualunque area di combattimento.

## OSTACOLI

Le colonne devono bloccare realmente:
- Personaggi.
- Frecce.
- Attacchi quando appropriato.

Non creare geometria attraversabile che appare solida.

Non aggiungere collisioni invisibili in mezzo a passaggi apparentemente liberi.

## EFFETTI

Aggiungi:
- Polvere durante gli impatti forti.
- Scintille quando le armi si scontrano.
- Tracce visive brevi durante alcuni fendenti.
- Effetti specifici delle abilità.
- Reazioni alle martellate.

Evita particelle eccessive.

Gli effetti non devono impedire di vedere il combattimento.

---

# 9. EVENTI DELL'ARENA

Voglio un po' di caos spettacolare, ma senza rovinare il combattimento competitivo.

Valuta eventi ambientali occasionali, ben annunciati.

Esempi:
- Breve apertura di zone pericolose.
- Getti di fiamme da punti specifici.
- Colonne che diventano temporaneamente rischiose.
- Piccoli cambiamenti nell'arena.
- Nuove coperture accessibili.

Non introdurre tutti questi sistemi se appesantiscono troppo lo sviluppo.

Nella prima versione è sufficiente uno o due eventi ben realizzati.

### REGOLE

Gli eventi devono:
- Essere visibili.
- Essere prevedibili per qualche istante.
- Poter essere evitati.
- Non favorire automaticamente un giocatore.
- Non bloccare le vie di fuga.

Niente trappole che eliminano qualcuno senza preavviso.

---

# 10. SUDDEN DEATH

Non voglio giocatori che scappano all'infinito.

Imposta un tempo ragionevole per ogni round, inizialmente circa 90 secondi, regolabile.

Allo scadere, se rimangono più giocatori:

**SUDDEN DEATH — IL CERCHIO SI CHIUDE**

Una zona pericolosa avanza gradualmente dai bordi dell'arena verso il centro.

Il cerchio deve:
- Restringersi progressivamente.
- Essere chiaramente visibile.
- Lasciare tempo per spostarsi.
- Forzare il combattimento.
- Non provocare morte istantanea appena compare.

Non ridurlo fino a una dimensione che renda impossibile usare qualsiasi arma.

Se si verifica una doppia eliminazione finale, applica le regole di spareggio.

---

# 11. CONTROLLI XBOX, PLAYSTATION E TELEFONO

I controlli devono essere semplici.

Adatta il mapping al sistema condiviso già presente.

## GAMEPAD — PROPOSTA

- Stick sinistro: movimento.
- Stick destro: telecamera.
- RT/R2: attacco leggero.
- RB/R1: attacco pesante.
- LT/L2: difesa o mira.
- LB/L1: abilità speciale.
- A/✕: schivata.
- B/○: salto, se presente.

Per l'arco, utilizza un mapping coerente:
- LT/L2 per mirare.
- RT/R2 tenuto per tendere.
- Rilascio RT/R2 per scoccare.
- RB/R1 per l'attacco alternativo, se previsto.
- LB/L1 per la special.

Verifica che il sistema supporti correttamente pressione mantenuta e rilascio.

Non riutilizzare pulsanti già riservati a funzioni obbligatorie senza gestirne il conflitto.

## TELEFONO

Voglio:
- Joystick virtuale per il movimento.
- Controllo della camera tramite tocco/scorrimento o area dedicata.
- Attacco.
- Attacco pesante.
- Difesa/mira.
- Schivata.
- Special.

I controlli devono essere responsive.

Non occupare tutto lo schermo con pulsanti enormi.

Supporta il multitouch.

Per l'arco devono funzionare correttamente la carica e il rilascio del tiro.

---

# 12. ANIMAZIONI

Le animazioni sono fondamentali.

Voglio personaggi che impugnano realmente le armi.

### ANIMAZIONI BASE

- Idle.
- Camminata.
- Corsa.
- Schivata.
- Salto, dove previsto.
- Colpo leggero.
- Colpo pesante.
- Parata.
- Reazione al colpo.
- Morte.
- Vittoria.

### ANIMAZIONI SPECIFICHE

Spada:
Fendenti e affondi.

Lancia:
Affondi frontali e carica.

Arco:
Estrarre la freccia, tendere e scoccare.

Ascia:
Colpi ampi e pesanti.

Martello:
Sollevamento, martellata e impatto.

Doppie lame:
Sequenze rapide con entrambe le braccia.

Spada e scudo:
Blocco, difesa e colpo di scudo.

## IMPORTANTISSIMO

Verifica quali modelli, rig e clip sono già disponibili.

Riutilizza gli asset legittimamente disponibili nel progetto.

Se mancano animazioni complete:
- Utilizza retargeting quando compatibile.
- Implementa animazioni procedurali mirate.
- Mantieni l'arma agganciata correttamente alla mano.
- Non deformare lo scheletro.

Non dichiarare realizzate animazioni professionali se hai implementato soltanto rotazioni generiche dei modelli.

---

# 13. PERSONAGGI DEL PARTY GAME

Voglio utilizzare i personaggi già presenti:
- Ciro.
- Carbo.
- BOSCHI.
- Goblin.
- Victor.

O i personaggi effettivamente registrati nel sistema attuale.

Non creare cinque guerrieri anonimi che cancellano l'identità del Party Game.

Mantieni per quanto possibile:
- Aspetto riconoscibile.
- Nome.
- Colore.
- Differenze estetiche.
- Eventuali personalizzazioni.

Adatta l'impugnatura e le animazioni alla struttura dei personaggi.

Tutti possono utilizzare qualsiasi arma.

Non introdurre vantaggi statistici nascosti a seconda del personaggio scelto.

---

# 14. IA DEI BOT

Se il Party Game supporta bot nei minigiochi multiplayer, implementa bot anche qui riutilizzando la struttura esistente.

Devono:
- Muoversi.
- Individuare avversari.
- Attaccare.
- Schivare occasionalmente.
- Utilizzare la distanza corretta della propria arma.
- Cercare linee di tiro con l'arco.
- Aggirare gli ostacoli.
- Evitare pericoli ambientali.

Un bot con martello deve cercare la distanza ravvicinata.

Un bot con arco deve preferire distanza e linee di vista.

Un bot con lancia deve sfruttare la portata.

Non creare bot che:
- Vedono attraverso i muri.
- Attaccano attraverso ostacoli.
- Schivano automaticamente ogni colpo.
- Hanno reazioni perfette.
- Conoscono gli input futuri del giocatore.

Non rendere i bot più forti degli esseri umani attraverso statistiche nascoste.

Se il sistema bot richiede uno sviluppo sproporzionato, completa prima il multiplayer umano funzionante e segnala ciò che manca.

---

# 15. HUD E FEEDBACK

Voglio un HUD moderno e leggibile.

Ogni giocatore deve vedere:
- Vita.
- Stamina.
- Arma equipaggiata.
- Cooldown special.
- Timer.
- Stato del round.

Durante il combattimento mostra:
- Feedback dei colpi.
- Parata riuscita.
- Parata perfetta.
- Danno ricevuto.
- Eliminazione di un avversario.

## ELIMINAZIONI

Quando un giocatore viene eliminato:

**GOBLIN HA ELIMINATO CARBO!**

Usa i nomi effettivi.

Non mostrare notifiche enormi che coprano il campo visivo.

## VITTORIA

Quando rimane soltanto un giocatore:

**ULTIMO GUERRIERO: CIRO!**

Aggiungi:
- Breve animazione di vittoria.
- Effetto audio.
- Punteggio del round.
- Transizione al successivo.

### CINQUE VISUALI

Il HUD deve ridimensionarsi automaticamente.

Non devono sovrapporsi barre della vita, numeri e pulsanti.

---

# 16. AUDIO

Il combattimento deve essere soddisfacente.

Ogni arma deve avere un proprio suono.

### SPADA
- Fendente.
- Impatto.
- Scontro metallico.

### LANCIA
- Affondo.
- Impatto.
- Movimento veloce.

### ARCO
- Corda tesa.
- Freccia scoccata.
- Impatto su parete e personaggio.

### ASCIA
- Movimento pesante.
- Impatto potente.

### MARTELLO
- Suono grave.
- Colpo contro il terreno.
- Onda d'urto.

### DOPPIE LAME
- Tagli rapidi.
- Movimento delle lame.

### SCUDO
- Impatto metallico.
- Parata.
- Colpo di scudo.

I suoni devono rispettare distanza e priorità.

Non usare lo stesso suono generico per tutte le armi.

Non sovraccaricare il mixer quando cinque giocatori combattono contemporaneamente.

Usa audio originale o con licenza compatibile.

---

# 17. OTTIMIZZAZIONE

Il minigioco deve funzionare in split-screen con cinque giocatori.

Non voglio che le animazioni o gli effetti facciano crollare le prestazioni.

Ottimizza:
- Modelli 3D.
- Texture.
- Materiali.
- Ombre.
- Particelle.
- Hitbox.
- Collisioni.
- IA.
- Proiettili.
- Viewport.
- Animazioni.

Preferisci:
- Asset condivisi.
- Cloni efficienti.
- Pooling.
- Materiali riutilizzabili.
- Collisioni semplificate.
- Aggiornamenti IA controllati.
- Gestione corretta degli oggetti eliminati.

I danni non devono dipendere dal frame rate.

Non promettere 60 FPS senza misurazioni.

---

# 18. INTEGRAZIONE NEL PARTY GAME

Aggiungi FERRO E FURIA:
- Al catalogo dei minigiochi.
- Al rullo.
- Alla selezione.
- Alla lobby.
- Alla gestione dei giocatori.
- Alla classifica.
- Al ScoreManager.

Mantieni la compatibilità con il sistema di cambio minigioco.

Quando una partita termina:
- Pulisci gli oggetti.
- Ferma le animazioni.
- Rimuovi eventi e callback.
- Libera le risorse non condivise.
- Torna correttamente al flusso del Party Game.

Non lasciare listener o scene attive in background.

Se esiste il narratore del rullo, aggiungi una frase:

**"SETTE ARMI, CINQUE GUERRIERI... MA SOLTANTO UNO RESTERÀ IN PIEDI!"**

---

# 19. PRIORITÀ DI SVILUPPO

Non disperderti in contenuti secondari.

Procedi in questo ordine:

1. Analizza l'architettura del Party Game e gli asset disponibili.
2. Crea FERRO E FURIA.
3. Implementa la terza persona.
4. Realizza l'arena con collisioni.
5. Implementa vita, stamina e combattimento base.
6. Implementa hitbox, parate e schivate.
7. Integra tutte e sette le armi con comportamenti distinti.
8. Implementa abilità speciali.
9. Aggiungi selezione delle armi.
10. Implementa round, eliminazioni e vittoria.
11. Adatta telefoni e gamepad.
12. Aggiungi animazioni e audio.
13. Integra il minigioco nel rullo.
14. Ottimizza per cinque giocatori.
15. Esegui pochi test essenziali.

## NON VOGLIO UN PROTOTIPO IN CUI TUTTE LE ARMI FANNO LO STESSO COLPO

Il requisito più importante è avere sette armi realmente differenti e utilizzabili.

Preferisco ridurre qualche decorazione dell'arena per completare il combattimento.

Se alcuni asset necessari non sono presenti, utilizza un fallback chiaramente identificabile, senza spacciare cubi, capsule o animazioni improvvisate per la qualità finale desiderata.

---

# 20. TEST RAPIDI

Voglio lavorare velocemente.

Non perdere ore in simulazioni o benchmark ripetuti.

Esegui soltanto:
- Typecheck.
- Build.
- Controllo caricamento arena.
- Controllo di tutte e sette le armi.
- Verifica hitbox e danni.
- Verifica parata e schivata.
- Verifica frecce, traiettoria e ostacoli.
- Verifica abilità speciali.
- Verifica eliminazione e classifica.
- Una breve partita da due giocatori.
- Una breve verifica a cinque giocatori.
- Un campione prestazionale con cinque visuali.
- Controllo rapido di selezione arma sul telefono.

Non dichiarare test con gamepad fisici se non sono stati effettivamente eseguiti.

Non eseguire centinaia di partite simulate.

Non modificare tutti gli altri minigiochi.

Non produrre video lunghi.

Se un problema viene rilevato, correggilo e ripeti soltanto i test necessari.

---

# 21. REPORT FINALE

Alla fine dimmi:

1. Se FERRO E FURIA è giocabile.
2. Com'è stata realizzata l'arena.
3. Quali sette armi sono funzionanti.
4. Quali attacchi e special sono presenti.
5. Come funzionano schivate e parate.
6. Quali animazioni sono state utilizzate.
7. Come vengono determinati round e vincitore.
8. Se telefono e gamepad sono supportati.
9. FPS realmente misurati con cinque visuali.
10. Test eseguiti e problemi residui.

Mostra al massimo quattro screenshot:
- Selezione delle armi.
- Arena.
- Combattimento spada contro lancia.
- Tiro con l'arco o abilità speciale.

---

# VINCOLI ASSOLUTI

- NON modificare Arena del Disagio.
- NON modificare Sparatoria.
- NON modificare Backrooms.
- NON modificare Orda Finale.
- NON ricostruire il Party Game.
- NON introdurre dipendenze pesanti non necessarie.
- NON introdurre armi sbilanciate intenzionalmente.
- NON creare hitbox che attraversano muri.
- NON utilizzare asset protetti senza verificarne licenza e provenienza.
- NON usare Flash.
- NON fare commit.
- NON fare push.
- NON fare deploy.

## RISULTATO FINALE

Voglio che FERRO E FURIA sia uno dei minigiochi più spettacolari del Party Game.

Immagina:

Cinque giocatori entrano in un Colosseo.

Goblin sceglie due pugnali.

Ciro prende una lancia.

Carbo sceglie il martello.

BOSCHI prende l'arco.

Victor sceglie spada e scudo.

Parte il round.

BOSCHI prova a colpire da lontano.

Goblin corre fra le colonne per avvicinarsi.

Ciro tenta un affondo con la lancia.

Victor para il colpo.

Carbo arriva con il martello e colpisce il terreno.

Goblin schiva appena in tempo.

Ciro viene eliminato.

BOSCHI scocca una freccia e colpisce Carbo.

Rimangono tre guerrieri.

L'arena entra in SUDDEN DEATH.

Il cerchio si restringe.

Goblin tenta una combo con le doppie lame, ma Victor esegue una parata perfetta.

Rimangono soltanto Victor e BOSCHI.

BOSCHI tende l'ultima freccia.

Victor corre verso di lui con lo scudo alzato.

BOSCHI tira.

Victor blocca la freccia, si avvicina e colpisce.

**VICTOR VINCE IL ROUND!**

Voglio situazioni di questo tipo.

Combattimenti dinamici, armi differenti, attacchi spettacolari, contrattacchi, schivate, rivalità e rimonte.

**FERRO E FURIA DEVE ESSERE UN VERO ARENA FIGHTER 3D, CON UN'ARMA A SCELTA E UN SOLO VINCITORE.**

Procedi direttamente, preserva i sistemi esistenti e usa soltanto i test indispensabili.