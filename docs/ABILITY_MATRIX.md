# MATRICE DELLE ABILITÀ — 5 personaggi × 12 minigiochi

> Generata da `scripts/ability-matrix.ts`. La colonna **DOPO** viene dal catalogo (`shared/abilityCatalog.ts`), la stessa fonte di TV, telefono e HUD: non può divergere dal gioco. La colonna **PRIMA** è l'audit dello stato precedente.
> Voti **S/Sk/C/Cl** = significativa / skill richiesta / counterplay / chiarezza, da 1 a 5 (giudizi di design, da confermare con le persone: non sono misure).
> Tipo: TIMING · RISORSA LIMITATA · RISCHIO / PREMIO · REATTIVA · INFORMAZIONE · REGOLA PIEGATA. Impatto: BASSO / MEDIO / ALTO (le ALTE hanno pochi usi, una ricarica, una barra da riempire o un rischio).

**60 combinazioni · 30 impatto ALTO · 30 MEDIO · 0 BASSO.**

## 🤼 ARENA DEL DISAGIO

Tasto abilità: **B / ◯** (profilo di input).

| | PRIMA | DOPO | tipo · impatto · limite |
|---|---|---|---|
| **GOBLIN** | **NCULO!** — dash sporco con direzione CASUALE e spinta ×1,85 · tasto · 1 uso/round · nome sopra la testa<br>S/Sk/C/Cl 3/1/2/3 | **N'CULO!** — Premi un attimo PRIMA dell'urto: per 0,45 s chi ti colpisce vola via con una spinta molto più forte e resta stordito. Se sbagli tempo, perdi 0,7 s e vai fuori equilibrio.<br>S/Sk/C/Cl 4/5/4/4 | TIMING · **ALTO** · 2 usi · ricarica 6 s |
| **BUTTAFUORI** | **MO M'IMPEGNO** — 5 s di resistenza (spinte al 30%) · tasto · 1 uso · effetto invisibile (solo il nome)<br>S/Sk/C/Cl 3/1/3/3 | **MO M'IMPEGNO** — Per 4 s le spinte ti spostano appena. Quello che assorbi si accumula e alla fine lo restituisci in un'onda d'urto attorno a te. Più botte prendi, più forte torna.<br>S/Sk/C/Cl 4/3/4/4 | REATTIVA · **MEDIO** · 1 uso |
| **JUDOKA** | **IPPON** — onda d'urto AUTOMATICA attorno (5,5 m, forza 15) · tasto · 1 uso<br>S/Sk/C/Cl 3/1/2/4 | **IPPON** — Premi quando un avversario è a un passo davanti a te: lo afferri e lo scaraventi via con una spinta enorme. Se non c'è nessuno a portata, perdi 0,6 s a vuoto.<br>S/Sk/C/Cl 4/4/4/4 | TIMING · **ALTO** · 2 usi · ricarica 8 s |
| **DOTTORE** | **20 KG IN UN MESE** — 5 s più veloce ma spinte ×2 · tasto · 1 uso · il nome non c'entra col DNA del personaggio<br>S/Sk/C/Cl 2/1/3/2 | **M'HO SVEJATO** — Per 4,5 s schivi in automatico il primo scatto diretto contro di te e chi ti ha attaccato inciampa. Se nessuno ti attacca, ti riaddormenti e per 1,5 s sei lento.<br>S/Sk/C/Cl 3/3/4/4 | REATTIVA · **MEDIO** · 1 uso |
| **CIRO** | **PAGO DOPO** — arma 4 s: la prossima spinta subita arriva 2 s dopo più debole · tasto · 1 uso<br>S/Sk/C/Cl 3/2/3/3 | **PAGO DOMANI** — Premi prima di finire sul bordo (resta armata 8 s). Se stai per cadere fuori, ti salvi ma hai un DEBITO di 6 s: spingi un avversario prima che scada, o cadi davvero.<br>S/Sk/C/Cl 4/3/4/4 | RISCHIO / PREMIO · **ALTO** · 1 uso |

## 🏐 DODGEBALL DEI COGLIONI

Tasto abilità: **B / ◯** (profilo di input).

| | PRIMA | DOPO | tipo · impatto · limite |
|---|---|---|---|
| **GOBLIN** | **N'CULO, RIPIGLIATELA!** — parata a tempo (0,42 s): rimanda la palla più veloce; a vuoto vieni colpito · 1 uso<br>S/Sk/C/Cl 4/4/3/4 | **N'CULO, RIPIGLIATELA!** *(mantenuta)* — Premi quando la palla sta per colpirti: per 0,42 s la pari e la rimandi più veloce a chi l'ha lanciata. Se sbagli il momento, vieni colpito normalmente.<br>S/Sk/C/Cl 4/4/3/4 | TIMING · **ALTO** · 2 usi · ricarica 7 s |
| **BUTTAFUORI** | **OCCHIO DA POLIGONO** — 5 s di linea di mira + primo tiro ×1,4 · 1 uso<br>S/Sk/C/Cl 3/3/3/3 | **OCCHIO DA POLIGONO** *(mantenuta)* — Per 5 s vedi la linea esatta del tuo lancio (la vedono tutti). Il primo tiro parte 1,6× più veloce e dritto. Usalo quando sai chi colpire.<br>S/Sk/C/Cl 4/3/4/4 | INFORMAZIONE · **MEDIO** · 1 uso |
| **JUDOKA** | **CARICO E SCARICO** — camion: bip, scatto che raccoglie 2 palle, le scarichi · 1 uso<br>S/Sk/C/Cl 4/3/3/4 | **CARICO E SCARICO** *(mantenuta)* — Dopo 0,9 s di segnale acustico parti col camion per 1,4 s: raccogli fino a 2 palle sulla strada. Poi le scarichi a raffica. Contro un muro ti stordisci.<br>S/Sk/C/Cl 4/3/3/4 | REGOLA PIEGATA · **ALTO** · 1 uso |
| **DOTTORE** | **TRE MESI DOPO** — 6 s di traiettorie in arrivo visibili · solo informazione · 1 uso<br>S/Sk/C/Cl 2/2/2/3 | **TRE MESI DOPO** *(mantenuta)* — Per 6 s vedi dove arriveranno le palle lanciate verso di te e la schivata si ricarica in un attimo (e ti protegge più a lungo). Usala quando il campo è pieno di palle.<br>S/Sk/C/Cl 3/3/3/4 | INFORMAZIONE · **MEDIO** · 1 uso |
| **CIRO** | **PAGO DOMANI** — il colpo che elimina diventa debito di 4 s: colpisci qualcuno o sei fuori · 1 uso<br>S/Sk/C/Cl 4/3/3/4 | **PAGO DOMANI** *(mantenuta)* — Premi prima di essere colpito (resta armata 4 s): il colpo che ti eliminerebbe diventa un DEBITO di 4 s. Colpisci un avversario prima che scada e sei salvo, altrimenti sei fuori.<br>S/Sk/C/Cl 4/3/3/4 | RISCHIO / PREMIO · **ALTO** · 1 uso |

## ⚽ CALCIO DEI DISAGIATI

Tasto abilità: **Y / △** (profilo di input).

| | PRIMA | DOPO | tipo · impatto · limite |
|---|---|---|---|
| **GOBLIN** | **TRIVELA DEL GOBLIN** — il prossimo tiro curva (automatico: nessuna skill) · 1 uso<br>S/Sk/C/Cl 3/1/2/3 | **N'CULO!** — Premi, poi carica un tiro per 5 s: se lo lasci nella zona verde della barra diventa un tiro a giro fortissimo. Fuori dalla zona verde il tiro esce moscio. Una sola occasione.<br>S/Sk/C/Cl 4/5/3/4 | TIMING · **ALTO** · 1 uso |
| **BUTTAFUORI** | **OCCHIO DA POLIGONO** — 5 s di linea di mira + primo tiro ×1,3 (la linea la vedono già tutti) · copia del Dodgeball<br>S/Sk/C/Cl 2/1/1/3 | **TU QUA NON ENTRI** — Per 4 s chi prova a contrastarti rimbalza e resta fermo 0,9 s. Corri più piano (20% in meno). Usala quando hai la palla e due avversari addosso.<br>S/Sk/C/Cl 3/2/4/4 | REATTIVA · **MEDIO** · 1 uso |
| **JUDOKA** | **CARICO E SCARICO** — il prossimo scatto ruba con una spinta più forte · 1 uso<br>S/Sk/C/Cl 3/2/3/2 | **IPPON** — Premi quando sei a un passo da chi ha la palla: lo afferri, gli strappi la palla e lo butti a terra per 1,2 s. Se ci provi da troppo lontano, perdi 0,8 s.<br>S/Sk/C/Cl 4/4/4/4 | TIMING · **ALTO** · 2 usi · ricarica 10 s |
| **DOTTORE** | **20 KG IN UN MESE** — 5 s più veloce ma contrasti deboli · copia di Arena/Pallavolo/Kart<br>S/Sk/C/Cl 2/1/3/2 | **M'HO SVEJATO** — Per 5 s il tuo prossimo TIRO (non il passaggio) va da solo verso l'angolo meno coperto, con più potenza; vedi dove andrà. Dopo sei lento per 3 s: l'effetto passa.<br>S/Sk/C/Cl 4/3/3/4 | INFORMAZIONE · **MEDIO** · 1 uso |
| **CIRO** | **PAGO DOMANI** — 4 s: il primo contrasto subito non ti toglie la palla · 1 uso<br>S/Sk/C/Cl 3/1/2/3 | **PAGO DOMANI** *(mantenuta)* — Premi con la palla: per 6 s il primo contrasto che subisci non ti toglie palla e stordisce chi ti ha attaccato. Il conto arriva dopo 5 s: passa o tira prima, o perdi la palla.<br>S/Sk/C/Cl 4/3/4/4 | RISCHIO / PREMIO · **ALTO** · 1 uso |

## 🏖️ PALLAVOLO DEI DISAGIATI

Tasto abilità: **B / ◯** (profilo di input).

| | PRIMA | DOPO | tipo · impatto · limite |
|---|---|---|---|
| **GOBLIN** | **JÄGER BOMB** — prossimo smash "perfetto" ×1,55; se sbagli, sprecata (senza scadenza) · 1 uso<br>S/Sk/C/Cl 3/3/2/3 | **JÄGER BOMB** *(mantenuta)* — Premi, poi colpisci lo smash a mezz'aria nel momento giusto (6 s di tempo): diventa una bomba 1,55× più forte. Colpisci male e l'abilità è sprecata.<br>S/Sk/C/Cl 4/4/2/4 | TIMING · **ALTO** · 1 uso |
| **BUTTAFUORI** | **MURO DEL POLIGONO** — 6 s di "alzata più stabile" (+10%) · effetto quasi invisibile<br>S/Sk/C/Cl 1/1/1/2 | **MURO DEL POLIGONO** *(mantenuta)* — Per 6 s sei un muro: vicino alla rete le tue braccia arrivano più lontano e la palla che colpisci in alto torna giù dall'altra parte, come uno smash.<br>S/Sk/C/Cl 3/3/4/4 | REATTIVA · **MEDIO** · 1 uso |
| **JUDOKA** | **CARICO E SCARICO** — 6 s di accelerazione laterale ×2,6 + colpo ×1,4 · copia di Dodgeball/Calcio<br>S/Sk/C/Cl 3/2/2/2 | **NO, ASPETTA!** — Premi con la palla in aria: la blocchi per 1,2 s e solo tu puoi muoverti, più veloce. Usala per rimontare un pallone impossibile.<br>S/Sk/C/Cl 4/4/3/4 | REGOLA PIEGATA · **ALTO** · 1 uso |
| **DOTTORE** | **20 KG IN UN MESE** — 6 s di salto e corsa ×1,3 · copia<br>S/Sk/C/Cl 2/1/2/2 | **M'HO SVEJATO** — Per 6 s salti e corri meglio, e il tuo prossimo smash va da solo dove nessuno difende. Poi ti gira la testa per 2 s: scivoli.<br>S/Sk/C/Cl 3/3/3/4 | INFORMAZIONE · **MEDIO** · 1 uso |
| **CIRO** | **PAGO DOMANI** — palla a terra vicino a te: si ferma 1 s per un salvataggio disperato · 1 uso<br>S/Sk/C/Cl 3/3/3/3 | **PAGO DOMANI** *(mantenuta)* — Premi (armata 8 s): la prima palla che tocca terra nel tuo campo rimbalza e lo scambio continua. Ma se poi perdi lo scambio, l'avversario ne guadagna 2.<br>S/Sk/C/Cl 4/3/3/4 | RISCHIO / PREMIO · **ALTO** · 1 uso |

## 🏎️ RIBALTATI (KART)

Tasto abilità: **Y / △** (profilo di input).

| | PRIMA | DOPO | tipo · impatto · limite |
|---|---|---|---|
| **GOBLIN** | **SO GUIDARE IO** — barra piena → 6 s di mini-turbo ×1,6; si perde se sbatti · tasto<br>S/Sk/C/Cl 4/4/4/4 | **SO GUIDARE IO** *(mantenuta)* — Guida bene (drift puliti, sorpassi) per riempire la barra, poi premi: per 6 s i mini-turbo dei drift sono 1,6× più forti. Se sbatti o esci di pista, l'effetto finisce subito.<br>S/Sk/C/Cl 4/4/4/5 | TIMING · **ALTO** · a barra piena |
| **BUTTAFUORI** | **RIBALTATO MA NON MORTO** — dopo uno schianto grave torni in pista da SOLO con un boost · automatica · 1 uso<br>S/Sk/C/Cl 3/1/1/2 | **RIBALTATO MA NON MORTO** *(mantenuta)* — Se fai uno schianto grave hai 1,2 s per premere: torni subito in pista con un boost. Se non premi, ti rialzi lentamente come tutti. Una volta a gara.<br>S/Sk/C/Cl 4/3/3/4 | REATTIVA · **ALTO** · 1 uso a gara |
| **JUDOKA** | **MI SO' CADUTI GLI OCCHIALI!** — barra piena → rallenta i rivali vicini davanti; se non ne superi uno, penalità<br>S/Sk/C/Cl 3/2/3/3 | **CARICO E SCARICO** — Riempi la barra, poi premi: per 5 s sei un camion. Chi tocchi viene spinto di lato e rallentato, tu non perdi velocità negli urti. Sterzi 25% peggio.<br>S/Sk/C/Cl 4/3/4/4 | RISCHIO / PREMIO · **ALTO** · a barra piena |
| **DOTTORE** | **20 KG IN UN MESE** — barra piena → 6 s leggerissimo (accelera/derapa) ma voli se ti urtano<br>S/Sk/C/Cl 4/3/4/4 | **20 KG IN UN MESE** *(mantenuta)* — Riempi la barra, poi premi: per 6 s accelerazione e drift facilissimi. Ma sei leggerissimo: chi ti urta ti manda lontano.<br>S/Sk/C/Cl 4/3/4/4 | RISCHIO / PREMIO · **ALTO** · a barra piena |
| **CIRO** | **PAGO DOPO** — premi ENTRO 0,5 s PRIMA del colpo per rimandarlo di 4 s: bisogna indovinare · 1 uso<br>S/Sk/C/Cl 3/3/3/2 | **PAGO DOPO** *(mantenuta)* — Premi appena prima (o subito dopo, entro 0,6 s) di essere colpito da un oggetto: l'effetto non arriva subito ma dopo 4 s come DEBITO. Una volta a gara.<br>S/Sk/C/Cl 4/3/3/4 | REATTIVA · **ALTO** · 1 uso a gara |

## 🔫 SPARATORIA DEI DISAGIATI

Tasto abilità: **RB / R1** (profilo di input).

| | PRIMA | DOPO | tipo · impatto · limite |
|---|---|---|---|
| **GOBLIN** | **—** — nessuna abilità di personaggio (RB riservato e senza effetto)<br>S/Sk/C/Cl 1/1/1/1 | **N'CULO!** — Ricarica, poi premi nella parte finale della ricarica (zona verde): finisce subito e per 6 colpi fai 30% di danno in più. Premi troppo presto e la ricarica si allunga di 0,4 s.<br>S/Sk/C/Cl 4/3/3/4 | TIMING · **MEDIO** · illimitata · ricarica 14 s |
| **BUTTAFUORI** | **—** — nessuna abilità di personaggio (RB riservato e senza effetto)<br>S/Sk/C/Cl 1/1/1/1 | **TU QUA NON ENTRI** — Per 4 s subisci il 40% del danno e corri un po' più piano. Alla fine recuperi il 40% della vita che hai assorbito.<br>S/Sk/C/Cl 4/3/3/4 | REATTIVA · **ALTO** · illimitata · ricarica 25 s |
| **JUDOKA** | **—** — nessuna abilità di personaggio (RB riservato e senza effetto)<br>S/Sk/C/Cl 1/1/1/1 | **NO, ASPETTA!** — Spinta davanti a te (6 metri): chi colpisci non può sparare né ricaricare per 1,2 s ed è respinto. A meno di 2.5 metri è IPPON: resta a terra 1 s.<br>S/Sk/C/Cl 4/3/3/4 | TIMING · **ALTO** · illimitata · ricarica 15 s |
| **DOTTORE** | **—** — nessuna abilità di personaggio (RB riservato e senza effetto)<br>S/Sk/C/Cl 1/1/1/1 | **M'HO SVEJATO** — Per 5 s vedi tutti gli avversari anche dietro i muri. Poi per 3 s la mira ti trema: i colpi si disperdono il doppio.<br>S/Sk/C/Cl 4/3/3/4 | INFORMAZIONE · **MEDIO** · illimitata · ricarica 22 s |
| **CIRO** | **—** — nessuna abilità di personaggio (RB riservato e senza effetto)<br>S/Sk/C/Cl 1/1/1/1 | **PAGO DOMANI** — Premi (armata 8 s): se stai per morire resti a 1 di vita per 5 s, più veloce. Fai una kill e recuperi 50 di vita. Se scade, muori. 2 usi a partita.<br>S/Sk/C/Cl 4/3/3/4 | RISCHIO / PREMIO · **ALTO** · 2 usi |

## 🍺 MEMORIA DA UBRIACO

Tasto abilità: **RB / R1** (profilo di input).

| | PRIMA | DOPO | tipo · impatto · limite |
|---|---|---|---|
| **GOBLIN** | **ANCORA UN GIRO** — rivedi la sequenza una seconda volta, solo tu · 1 uso/partita<br>S/Sk/C/Cl 3/2/1/4 | **ANCORA UN GIRO** *(mantenuta)* — Premi mentre guardi la sequenza: la rivedi una seconda volta, solo tu, sul tuo schermo. Una volta a partita.<br>S/Sk/C/Cl 4/3/3/4 | INFORMAZIONE · **MEDIO** · 1 uso a partita |
| **BUTTAFUORI** | **MO HO CAPITO** — passiva: il primo errore è perdonato (+1,2 s) · invisibile e automatica<br>S/Sk/C/Cl 3/1/1/2 | **MO HO CAPITO** *(mantenuta)* — Si attiva da sola: se sbagli una casella puoi correggerti e continuare, con 1 s di penalità sul tuo tempo. Non serve premere. Una volta a partita.<br>S/Sk/C/Cl 4/3/3/4 | REATTIVA · **MEDIO** · 1 uso a partita |
| **JUDOKA** | **NO, ASPETTA!** — ferma il tuo tempo 2 s · 1 uso<br>S/Sk/C/Cl 3/2/1/4 | **NO, ASPETTA!** *(mantenuta)* — Premi mentre ripeti la sequenza: il tuo tempo si ferma per 2 s e non puoi toccare. Poi riprendi da dove eri, senza replay. Una volta a partita.<br>S/Sk/C/Cl 4/3/3/4 | REGOLA PIEGATA · **MEDIO** · 1 uso a partita |
| **DOTTORE** | **M'HO SVEJATO** — sbirci la prossima casella giusta (−0,8 s) · 1 uso<br>S/Sk/C/Cl 3/2/1/4 | **M'HO SVEJATO** *(mantenuta)* — Premi mentre ripeti: vedi per un attimo la prossima casella giusta, solo tu. Costa 0,8 s sul tuo tempo. Una volta a partita.<br>S/Sk/C/Cl 4/3/3/4 | INFORMAZIONE · **MEDIO** · 1 uso a partita |
| **CIRO** | **A RATE** — pausa di 2 s a metà sequenza, −1,5 s dal tempo · 1 uso<br>S/Sk/C/Cl 3/2/1/3 | **A RATE** *(mantenuta)* — Premi mentre ripeti: pausa di 2 s e 1,5 s in meno sul tuo tempo. Una volta a partita.<br>S/Sk/C/Cl 4/3/3/4 | RISCHIO / PREMIO · **MEDIO** · 1 uso a partita |

## ⚡ BOTTA AL VOLO

Tasto abilità: **RB / R1** (profilo di input).

| | PRIMA | DOPO | tipo · impatto · limite |
|---|---|---|---|
| **GOBLIN** | **N'CULO!** — annulla il finto VIA (finestra di ~0,2 s) e riparte l'attesa; troppo presto = ubriaco · 1 uso/round<br>S/Sk/C/Cl 3/4/2/3 | **N'CULO!** *(mantenuta)* — Premi durante l'attesa, appena compare un FINTO VIA: lo annulli e riparte un nuovo timer per tutti. Se premi troppo presto (senza finto VIA) sei ubriaco e perdi tempo. Una volta a round.<br>S/Sk/C/Cl 4/3/3/4 | RISCHIO / PREMIO · **MEDIO** · 1 uso a round |
| **BUTTAFUORI** | **MO HO CAPITO** — passiva: falsa partenza → seconda chance (+120 ms) · automatica<br>S/Sk/C/Cl 3/1/1/2 | **MO HO CAPITO** *(mantenuta)* — Si attiva da solo: se parti troppo presto hai una seconda chance nello stesso round, con +120 ms sul tempo. Non serve premere. Una volta a round.<br>S/Sk/C/Cl 4/3/3/4 | REATTIVA · **MEDIO** · 1 uso a round |
| **JUDOKA** | **ASPETTA UN ATTIMO!** — finto reset di 1 s per tutti, poi nuovo timer · 1 uso/round<br>S/Sk/C/Cl 3/2/3/4 | **ASPETTA UN ATTIMO!** *(mantenuta)* — Premi durante l'attesa: finto reset di 1 s per TUTTI, poi nuovo timer casuale. Serve a rovinare il ritmo degli altri. Una volta a round.<br>S/Sk/C/Cl 4/3/3/4 | REGOLA PIEGATA · **MEDIO** · 1 uso a round |
| **DOTTORE** | **M'HO SVEJATO** — focus di 2 s: se il VIA cade dentro lo senti (senza anticipo) · 1 uso/partita<br>S/Sk/C/Cl 2/3/1/3 | **M'HO SVEJATO** *(mantenuta)* — Premi durante l'attesa: apri un FOCUS di 2 s. Se il VIA cade dentro, senti la vibrazione nello stesso istante della TV (nessuna anticipazione). Una volta a partita.<br>S/Sk/C/Cl 4/3/3/4 | INFORMAZIONE · **MEDIO** · 1 uso a partita |
| **CIRO** | **ULTIMO SECONDO** — in guardia: ti avvisa se parte un falso allarme o qualcuno sbaglia · 1 uso/partita<br>S/Sk/C/Cl 2/2/1/3 | **ULTIMO SECONDO** *(mantenuta)* — Premi durante l'attesa: resti in guardia. Se parte un falso allarme o qualcuno sbaglia, il telefono ti dice NON È ANCORA FINITA. Non sai quando arriva il VIA. Una volta a partita.<br>S/Sk/C/Cl 4/3/3/4 | INFORMAZIONE · **MEDIO** · 1 uso a partita |

## 🧠 CHI CAZZO LO SA?

Tasto abilità: **—** (profilo di input).

| | PRIMA | DOPO | tipo · impatto · limite |
|---|---|---|---|
| **GOBLIN** | **N'CULO!** — rifiuta la domanda: ne arriva una nuova per tutti · 1 uso<br>S/Sk/C/Cl 3/2/2/4 | **N'CULO!** *(mantenuta)* — Premi prima di rispondere: la domanda viene rifiutata e ne arriva una nuova della stessa difficoltà, per tutti. Se la nuova è peggiore è un problema tuo. Una volta a partita.<br>S/Sk/C/Cl 4/3/3/4 | REGOLA PIEGATA · **MEDIO** · 1 uso a partita |
| **BUTTAFUORI** | **MO HO CAPITO** — dopo un errore hai 4 s per riprovare, metà punti · 1 uso<br>S/Sk/C/Cl 4/2/2/4 | **MO HO CAPITO** *(mantenuta)* — Premi dopo aver sbagliato: hai 4 s per riprovare e, se indovini, prendi metà dei punti. Una volta a partita.<br>S/Sk/C/Cl 4/3/3/4 | REATTIVA · **MEDIO** · 1 uso a partita |
| **JUDOKA** | **NO, ASPETTA!** — dopo aver risposto puoi cambiare (+3 s) · 1 uso<br>S/Sk/C/Cl 3/2/1/4 | **NO, ASPETTA!** *(mantenuta)* — Premi dopo aver risposto: puoi cambiare risposta (+3 s). Una volta a partita.<br>S/Sk/C/Cl 4/3/3/4 | REGOLA PIEGATA · **MEDIO** · 1 uso a partita |
| **DOTTORE** | **M'HO SVEJATO** — indizio vero in privato, valgono il 70% dei punti · 1 uso<br>S/Sk/C/Cl 4/2/1/4 | **M'HO SVEJATO** *(mantenuta)* — Premi quando sei bloccato: un indizio vero, solo sul tuo telefono. Se poi indovini, vale il 70% dei punti. Una volta a partita.<br>S/Sk/C/Cl 4/3/3/4 | INFORMAZIONE · **MEDIO** · 1 uso a partita |
| **CIRO** | **ULTIMO GIORNO UTILE** — aspetti la fine del tempo e vedi come hanno risposto (+4 s) · 1 uso<br>S/Sk/C/Cl 4/3/2/4 | **ULTIMO GIORNO UTILE** *(mantenuta)* — Lascia scadere il timer, poi premi: vedi quanti hanno scelto A/B/C/D e hai altri 4 s per rispondere. Una volta a partita.<br>S/Sk/C/Cl 4/3/3/4 | INFORMAZIONE · **ALTO** · 1 uso a partita |

## 🎭 CULTURA O CAZZATA?

Tasto abilità: **telefono, quando si vota** (profilo di input).

| | PRIMA | DOPO | tipo · impatto · limite |
|---|---|---|---|
| **GOBLIN** | **—** — nessuna abilità di personaggio: solo TE CONOSCO (uguale per tutti) e i ruoli a caso Secchione / Avvocato<br>S/Sk/C/Cl 1/1/1/2 | **N'CULO!** — Premi prima di votare: se scegli la risposta vera prendi +3 punti in più. Se ti fai fregare da una cazzata perdi 2 punti. Una volta a partita.<br>S/Sk/C/Cl 4/3/3/4 | RISCHIO / PREMIO · **ALTO** · 1 uso a partita |
| **BUTTAFUORI** | **—** — nessuna abilità di personaggio: solo TE CONOSCO (uguale per tutti) e i ruoli a caso Secchione / Avvocato<br>S/Sk/C/Cl 1/1/1/2 | **TU QUA NON ENTRI** — Premi durante il voto: una risposta FALSA a caso sparisce dal tuo telefono. Non cancella mai quella vera. Una volta a partita.<br>S/Sk/C/Cl 4/3/3/4 | INFORMAZIONE · **MEDIO** · 1 uso a partita |
| **JUDOKA** | **—** — nessuna abilità di personaggio: solo TE CONOSCO (uguale per tutti) e i ruoli a caso Secchione / Avvocato<br>S/Sk/C/Cl 1/1/1/2 | **NO, ASPETTA!** — Premi durante il voto: il timer si allunga di 6 s per tutti e il voto non si chiude in anticipo, nemmeno se tutti hanno già votato. Una volta a partita.<br>S/Sk/C/Cl 4/3/3/4 | REGOLA PIEGATA · **MEDIO** · 1 uso a partita |
| **DOTTORE** | **—** — nessuna abilità di personaggio: solo TE CONOSCO (uguale per tutti) e i ruoli a caso Secchione / Avvocato<br>S/Sk/C/Cl 1/1/1/2 | **M'HO SVEJATO** — Premi durante il voto: ti arriva solo un'intuizione sulla risposta vera (iniziale della parola principale e numero di parole). Costa 1 punto di "parcella". Una volta a partita.<br>S/Sk/C/Cl 4/3/3/4 | INFORMAZIONE · **MEDIO** · 1 uso a partita |
| **CIRO** | **—** — nessuna abilità di personaggio: solo TE CONOSCO (uguale per tutti) e i ruoli a caso Secchione / Avvocato<br>S/Sk/C/Cl 1/1/1/2 | **ULTIMO GIORNO UTILE** — Premi durante il voto: vedi in tempo reale quanti voti ha preso ogni risposta (non chi li ha dati) e hai almeno 5 s per scegliere. Una volta a partita.<br>S/Sk/C/Cl 4/3/3/4 | INFORMAZIONE · **ALTO** · 1 uso a partita |

## 🧱 BOTTE SUL CORNICIONE

Tasto abilità: **RB / R1** (profilo di input).

| | PRIMA | DOPO | tipo · impatto · limite |
|---|---|---|---|
| **GOBLIN** | **—** — gioco nuovo: nessuna versione precedente<br>S/Sk/C/Cl 1/1/1/1 | **RIMONTA AL 90°** — Premi in aria quando sei fuori dal palco, muovendo lo stick: scatto diagonale (non è un teletrasporto). Se rimetti piede sul palco entro 2,5 s hai 1,2 s per un attacco aereo speciale. Se lo sprechi, per questa vita è finita. Non funziona mentre sei in stordimento.<br>S/Sk/C/Cl 5/4/4/4 | RISCHIO / PREMIO · **ALTO** · 1 uso per vita |
| **BUTTAFUORI** | **—** — gioco nuovo: nessuna versione precedente<br>S/Sk/C/Cl 1/1/1/1 | **ULTIMO ACCESSO: 3 SETTIMANE FA** — Premi: per 1,1 s sparisci, non colpisci e non puoi essere colpito. Lo stick sceglie dove riappari (a circa 4.5 m): gli altri vedono il punto poco prima. Quando torni non puoi schivare per 0,5 s. Una volta per vita.<br>S/Sk/C/Cl 4/4/4/4 | REGOLA PIEGATA · **ALTO** · 1 uso per vita |
| **JUDOKA** | **—** — gioco nuovo: nessuna versione precedente<br>S/Sk/C/Cl 1/1/1/1 | **ANGORA CHE DICI?** — Premi: per 0,5 s sei in postura. Se in quel momento ti colpisce un attacco corpo a corpo, il colpo si annulla e lo afferri (pausa di 0,18 s): lo stick sceglie dove lo scagli (sinistra, destra, giù); più forte era il colpo, più forte il lancio. Se non ti colpiscono resti scoperto 0,55 s. Due usi per vita.<br>S/Sk/C/Cl 5/5/4/4 | REATTIVA · **ALTO** · 2 usi per vita |
| **DOTTORE** | **—** — gioco nuovo: nessuna versione precedente<br>S/Sk/C/Cl 1/1/1/1 | **TAGLIO PESO EXPRESS** — Premi: per 5 s sei più leggero: controllo aereo, salto e caduta molto migliori. Ma i colpi che prendi ti lanciano 1.9× più lontano: un colpo pesante a percentuale alta ti manda fuori. Una volta per vita.<br>S/Sk/C/Cl 4/4/4/4 | RISCHIO / PREMIO · **ALTO** · 1 uso per vita |
| **CIRO** | **—** — gioco nuovo: nessuna versione precedente<br>S/Sk/C/Cl 1/1/1/1 | **BONIFICO IN LAVORAZIONE** — Quando stai per finire fuori si apre per 0,6 s la finestra "BONIFICO?": premi per rinviare il KO e avere 2,5 s per rientrare. Se rientri paghi +25% di danno; se no, sei fuori. Se non premi, il KO è normale e l'abilità resta.<br>S/Sk/C/Cl 5/3/5/4 | REATTIVA · **ALTO** · 1 uso per vita |

## 🌧️ CASA CARBO

Tasto abilità: **RB / R1** (profilo di input).

| | PRIMA | DOPO | tipo · impatto · limite |
|---|---|---|---|
| **GOBLIN** | **—** — gioco nuovo: nessuna versione precedente<br>S/Sk/C/Cl 1/1/1/1 | **N'CULO, MO ASCIUGO IO!** — Premi guardando dove vuoi spingere: dopo 0,5 s di carica parte un'onda che sposta tutta l'acqua davanti a te per 5 m (e spinge chi c'e' in mezzo). Se mirata male rimanda l'acqua in una stanza pulita. Due usi, ricarica 9 s.<br>S/Sk/C/Cl 4/4/3/4 | RISCHIO / PREMIO · **ALTO** · 2 usi · ricarica 9 s |
| **BUTTAFUORI** | **—** — gioco nuovo: nessuna versione precedente<br>S/Sk/C/Cl 1/1/1/1 | **TU QUA NON ENTRI!** — Premi davanti a una delle due porte: per 6 s entra solo un decimo della pioggia. Intanto non puoi muoverti ne' pulire, e quando molli meta' dell'acqua trattenuta fuori entra tutta insieme. Una volta a partita.<br>S/Sk/C/Cl 4/3/3/4 | RISORSA LIMITATA · **ALTO** · 1 uso a partita |
| **JUDOKA** | **—** — gioco nuovo: nessuna versione precedente<br>S/Sk/C/Cl 1/1/1/1 | **NO, ASPETTA!** — Premi: piazzi davanti a te una diga lunga 3 m che ferma l'acqua (ma non le persone) per 15 s. Se dietro si accumula troppa acqua cede e la libera tutta insieme. Due usi a partita.<br>S/Sk/C/Cl 4/4/3/4 | RISCHIO / PREMIO · **MEDIO** · 2 usi a partita |
| **DOTTORE** | **—** — gioco nuovo: nessuna versione precedente<br>S/Sk/C/Cl 1/1/1/1 | **M'HO SVEJATO** — Premi: se nei prossimi 25 s arriva una raffica, sul tuo telefono vedi quale porta e quando, prima degli altri. Se non arriva niente l'uso e' sprecato. Due usi a partita.<br>S/Sk/C/Cl 3/3/2/4 | INFORMAZIONE · **MEDIO** · 2 usi a partita |
| **CIRO** | **—** — gioco nuovo: nessuna versione precedente<br>S/Sk/C/Cl 1/1/1/1 | **PAGO DOMANI** — Premi: il prossimo secchio contiene il doppio. Appena supera la capienza normale hai 6 s per svuotarlo in uno scarico, se no ne rovesci meta' per terra. Due usi a partita.<br>S/Sk/C/Cl 4/4/3/4 | RISCHIO / PREMIO · **MEDIO** · 2 usi a partita |

## Riepilogo

Media S/Sk/C/Cl: **prima 2.3/1.7/1.7/2.5** → **dopo 4.0/3.3/3.3/4.0**.

Cambiamenti principali: FPS e Cultura passano da nessuna abilità a una per personaggio; le abilità passive o automatiche (Buttafuori in Kart, Memoria e Botta al Volo, Ciro in Kart) restano tali solo dove la passività È il punto (Memoria, Botta al Volo) e diventano reattive con un tasto dove prima scattavano da sole (Kart); Calcio e Pallavolo non copiano più Arena/Dodgeball.

