# Fase completata

9 ottobre 2026. BOSCHI, Goblin e Carbo aggiornati ai tre GLB originali forniti; 54 / 52 / 49 clip native, 39 aggiunte complessive. Ciro conserva 59 clip. Root attuale, senza Flash, come autorizzato.

- Audit: geometry, rig, skinning, texture, trasformazioni e ogni clip precedente identici; originali conservati, nuovi file copiati byte per byte.
- Gesti di Casa Carbo collegati per i quattro personaggi, blocco di BOSCHI e costruzione della diga di Carbo. Nessuna modifica a simulazione, collider, input, effetti delle abilità o punteggi.
- Tutte le verifiche elencate in REPORT.md passate. Errori iniziali dei probe corretti: la fixture del blocco deve far trascorrere il tempo dell'azione esistente; Casa Carbo interrompe anche il render quando è in pausa, quindi la misura della sola grafica richiede un ciclo esplicito.
- `npm run build`: PASS, Vite 3m 27s. Avviso di dimensione dei chunk; nessun errore di compilazione.
- Produzione `localhost:3001`: PASS con quattro telefoni, Casa Carbo, quattro modelli aggiornati HTTP 200 e SHA256 dei file serviti uguale a `public/models`; Gallery 52/54/49/59 clip, personaggi corretti, nessun errore pagina.
- `git diff --check`: PASS. Modifiche preesistenti di Ciro preservate. Nessun commit/push/deploy.
- Server 3001 mantenuto attivo. Ricaricare host e telefoni prima di una nuova partita.

Stop dopo questa integrazione. Kart/Soccer/Volley mantengono il renderer precedente; ottimizzazione, LOD e sostituzione definitiva fuori fase.
