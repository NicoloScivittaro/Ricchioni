# Ribaltati 1.4 — Caos Totale

Solo abilità, Lucky Block e relativo feedback. Piste, GLB, camere, grafica generale, tre giri, checkpoint, punteggi e altri minigiochi conservati.

| Abilità | Prima, versione 1.3 | Ora |
|---|---|---|
| Goblin | Scatto +24% per 2,2 s; drift ×1,6; ricarica 18 s | **+34,5% per 3,4 s**, drift ×1,7; ricarica **20 s** |
| Dottore | Tetto +12% per 6 s; accelerazione ×1,8; ricarica 20 s | **+28% per 5,5 s**, accelerazione ×2,1; ricarica **22 s** |
| Judoka | Camion 5 s; bersaglio al 65% per 1,6 s; ricarica 22 s | **5,5 s**, bersaglio al **52%**, turbo avversario interrotto; ricarica **24 s**. In aria rallentamento limitato all’85% |
| Buttafuori | Recupero + turbo 1,6 s; finestra 2 s; ricarica 26 s | Turbo **+33% per 2,4 s**, stabilizzazione 2,2 s; finestra **2,2 s**, ricarica **24 s** |
| Ciro | Debito dopo 8 s, effetti al 60%; ricarica 24 s | Stordimento/olio/disturbo differiti al **40%**; **contro-turbo 1,2 s** sulla difesa anticipata; ricarica **24 s** |

Restano fragilità del Dottore, sterzo largo del camion, recupero condizionale del Buttafuori e debito effettivamente pagato da Ciro. Il mini-turbo normale non cambia. Tetto dei boost e durate limitati, senza somme infinite.

Lucky Block aggiornati:

- **Turbo:** +21% per 2 s. **Super Turbo:** +36% per 3,8 s. **Turbo Difettoso:** +39% per 3,4 s, sterzo al 68%.
- **Sfera** e **Piccione:** interrompono il turbo. Il Piccione è più rapido e aggiunge un breve impatto al grip ridotto.
- **Olio:** grip ridotto per 2,2 s e turbo interrotto. **Buca:** sobbalzo maggiore e grip ridotto per 1,2 s. **Raffica:** interrompe il turbo, si può parare e mantiene una spinta limitata e compensabile.
- **Scudo:** parata nei primi 0,8 s premiata con contro-turbo di 1,2 s.
- **Calamita:** portata 36 m, trazione 4 s; conserva l’oggetto se salto, stordimento o assenza di bersaglio impediscono l’attivazione.
- **Disturbo:** interrompe il turbo; inversione ridotta a 1,6 s e portata limitata a 45 m, senza colpire automaticamente il leader lontano.
- **Paraurti:** 6,5 s, più impulso e resistenza agli urti. **Mollone:** salto più alto e mini-turbo all’atterraggio, anche se il salto prosegue in una planata.

Due nuovi oggetti, totale **15**:

- **Missile Vendetta:** bersaglio davanti entro 90 m, preavviso di 0,8 s, inseguimento limitato. Schivata, scudo e difese compatibili possono fermarlo.
- **Furto del Secolo:** portata 14 m, preavviso 0,7 s. Il bersaglio può usare l’oggetto, difendersi o allontanarsi. Trasferimento atomico, nessuna duplicazione o furto di abilità.

Le probabilità combinano posizione e distacco stimato dalla distanza dal leader alla velocità normale. Il gruppo Super Turbo/Turbo Difettoso/Missile pesa circa **3,7% per il primo**, **7,8% per il quinto nel gruppo compatto**, **25% per il quinto a 20 s stimati**. Tutti gli oggetti restano possibili; nessuna assegnazione garantita o modifica nascosta della velocità.

Verifiche: typecheck, controlli mirati su cinque abilità e quindici oggetti, probabilità esatte, cooldown, difese, furto, missile, contatti, entrambe le planate e due simulazioni da **15 s con cinque bot**, una per pista. Corretto e riprovato il caso limite della Calamita. [Esiti](checks.json), [casi limite](edge-checks.json), [conservazione](scope-checks.json).

Build finale **superata**, incluso `tsc --noEmit`; unico avviso sui bundle 3D di grandi dimensioni. [Log](build.log).

Limiti: nessuna nuova gara completa o prova su dispositivi fisici; il bilanciamento competitivo resta da valutare tra persone reali. Nessun benchmark grafico, nuova serie di screenshot o video. Nessun commit, push o deploy.
