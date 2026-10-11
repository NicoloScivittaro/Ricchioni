# Audit collisioni — 11 ottobre 2026

## Cornicione

Cause dimostrate nelle catture `corn-before-*`: il simulatore apre il volume a `startup`, il sampler raggiungeva il fotogramma di contatto a `startup + active × .35`; anche il blend e le molle procedurali potevano ritardare il gesto. Ora il contatto della clip arriva a startup, rimane nella breve finestra attiva, poi recupera. Il sampler non interpola dal vecchio gesto dopo quel contatto. Victor e il fallback procedurale seguono il medesimo orologio. `fighterData.ts` è invariato: danni, knockback, portata massima, recuperi e vantaggio del calcio (+35%) preservati.

Le hitbox restano volumi arcade comuni, non geometrie ricavate dalla skin: il bordo estremo di un calcio è più distante del piede del GLB. Questo audit non pretende coincidenza geometrica perfetta; una breve scia, circoscritta alla fase attiva, comunica la portata comune. Ridurla o cambiare le traslazioni dei personaggi richiederebbe una decisione di bilanciamento. Non sono stati deformati gli arti per farli coincidere artificialmente con una hitbox.

Melee: sweep relativo attaccante/bersaglio a sotto-passi ≤1/90 s, limitato temporalmente alla parte attiva del passo; include l'ultima frazione attiva anche se il passo termina in recupero. Immunità e intangibilità limitano il segmento testato; contatti ordinati, una vittima una volta per attacco. Oggetti: sweep relativo, prima collisione parete/vittima, durata residua, sparizioni/bonifico trattati come discontinuità e non traversate fisiche. Schivate, parata e counter melee di Carbo conservati. Nessuna presa ordinaria reintrodotta.

Debug: estensione del laboratorio `?fighter=1` e F3. H abilita il disegno anche nella partita normale in sviluppo. Verde hurtbox, rosso offensivo (anche lato opposto delle mosse bilaterali e proiettili), blu ambiente fisico, viola direzione, giallo contatto recente; incongruenza fase/tempo magenta. Registro circolare massimo 24 contatti, ultimi 3 in F3. Mesh create solo all'attivazione; legenda, listener e mesh smaltiti. `import.meta.env.DEV` impedisce l'accesso anche con `?debug=1&fighter=1` in produzione.

## Arena

Codice esaminato: `BabylonArenaGame.ts`, `shared/arenaCombat.ts`, `arenaAbilities.ts`. Spallata: sweep relativo fra due cerchi comuni di raggio 1.05, primo contatto e semipiano davanti all'attaccante. Corpo/corpo: separazione e impulso solo se convergenti. Instabilità, scatto, bordo e resistenze restano nei moduli esistenti. Non esistono pareti interne nel campo: il bordo è una caduta, non un muro. Nessun aumento indiscriminato delle spinte. Suite arena-combat e survival passate, incluse eliminazioni precoci e immunità delle abilità.

## Sparatoria

Hitscan già corretto: ogni pallino usa yaw/pitch con rinculo e dispersione, stesso raggio disegnato fino al contatto, volume comune .8×.8×1.8, priorità della copertura più vicina. Protezione spawn controllata dentro applyDamage. Difetto trovato: splash verificava soltanto distanza X/Z, danneggiando attraverso solidi. Corretto con visibilità del corpo su tre altezze; coperture basse possono lasciare la parte superiore esposta. Punto esplosione 2 cm prima della superficie colpita; raycast verso il basso incontra anche il pavimento. Nessuna arma rimossa. Corretto inoltre il caso di centro del giocatore già dentro AABB (prima la normale zero impediva di uscire).

Browser: cinque giocatori, bersaglio esposto 60 HP, dietro container 100 HP, protetto spawn 100 HP; sei armi bloccate dalla medesima copertura. L'esplosivo mantiene la regola esistente: esplosione differita al punto determinato allo sparo, senza nuova simulazione balistica homing.

## Dodgeball

Difetti trovati: palla e corpo confrontati solo a fine frame; invulnerabilità della schivata era un hit "survive", con knockback e rimbalzo della palla. Ora sweep relativo fra palla e corpo in movimento, sotto-passi della palla ≤1/120, contatto più vicino; la schivata non viene candidata e la palla prosegue. Parata e armatura/abilità conservano il proprio risultato. Separazione deterministica anche per centri coincidenti. Browser: colpo, schivata, riflessione e corpo che attraversa la traiettoria, a 30/60/120 FPS, cinque partecipanti; stress a 240 unità/s dichiarato (oltre velocità normale), non nuova velocità di gameplay.

## Kart

SAT orientato invariato, half-width1 / half-length1.4 e separazione verticale1.2; massa/impulso paraurti integrati. Nuovo passo locale ≤1/120 per evitare attraversamenti fra kart rapidi, senza toccare il clock globale. Test reale browser: 80 contro -18 unità/s, nessun sorpasso attraverso il corpo, impulso registrato; kart a 10 m paralleli rimangono 40/40. Proiettili e superfici degli item già swept nella M1/M2, salto evita le superfici basse. Contatti laterali, pareti, drift e abilità nelle suite Kart.

## Calcio e Pallavolo

Calcio: passo locale ≤1/120, difesa/possessione/ricezione e regole delle abilità conservate. Apertura della porta verificata al punto di attraversamento, con raggio del pallone rispetto al palo, invece del centro finale del frame. Cinque giocatori: tiro 30 unità/s deviato a 30/60/120 con medesimo esito a tempo simulato equivalente. Etichette compatte già presenti: nessun intervento globale sulle interfacce.

Pallavolo: controllo stick della M3; contatto continuo sfera/rete, altezza al contatto invece della sola altezza finale. Terra al raggio della sfera (prima il centro entrava nel terreno prima del punto); rimbalzo di Ciro sopra il terreno. Colpo resta scelta del giocatore dentro HIT_RADIUS e cooldown, non collisione automatica né ricerca nuova della zona libera; solo l'abilità preesistente di Victor conserva l'assistenza speciale. Timing, Muro, congelamento Carbo e debito Ciro coperti dai test abilità.

## Casa Carbo e Minigolf

Casa Carbo è presente: simulatore waterCore con sotto-passi1/60, solidi da WALLS/FURNITURE, rettangoli dinamici, corpo circolare e uscita deterministica dal rettangolo se incorporato. Porte/zone interazione si basano sulla mappa condivisa; il secchio è possesso/quantità del giocatore, non un nuovo corpo lanciato. Visibilità delle decorazioni non determina collisioni. Nessuna necessità dimostrata di modificare questi solver. Suite CasaCarbo e Ciro passate.

Minigolf esiste realmente nel registry e nel repository: minigolfPhysics limita lo spostamento a raggio/3, controlla pareti a capsula, bumper, differenza di altezza, palline, ostacoli rotanti e pavimento mobile con velocità relativa; reset sicuro per cadute/blocchi/non-finiti. Suite Minigolf passata. Nessuna nuova fisica applicata a quiz/memoria: verifica dell'interfaccia nella regressione controller.

## Evidenza e limiti

`collision-audit-selftest.ts` e le suite pertinenti passate. `collision-audit.mjs` verifica le classi effettive nel browser, con fixture preparate (non rappresentate come input umano), cinque telefoni e ritorno lobby/canvas1/errori0. `collision-poses.mjs` salva anticipo/attivo/recupero per cinque personaggi, verifica clock native e visibilità offensiva, poi genera contatti effettivi; catture aperte e ispezionate. Dati: `corn-before.json`, `corn-after.json`, `collision-browser.json`.

Le prove numeriche a 30/60/120 non significano che il dispositivo renda 120 FPS. Il playtest umano deve valutare leggibilità delle scie e punibilità delle mosse, angoli e tempi di difesa Volley, rischio/beneficio dei sette item, latenza reale del telefono e controller fisici. Nessuna promessa di assenza universale di bug o di bilanciamento definitivo.
