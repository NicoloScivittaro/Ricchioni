# Ribaltati, Pallavolo e collisioni — 11 ottobre 2026

Baseline pulita: `487ff47`. Richiesta: allegato `df092e6c-d406-4cda-82f5-62f5ce067a3f`. Implementazione con il root attuale, autorizzata nella conversazione dopo l'esaurimento del credito Flash. Nessun push/deploy.

## Contratti

- Conservare networking, pairing, rullo, punteggi e flusso; statistiche base identiche tra personaggi, abilità separate dagli item.
- Kart: mantenere sei item esistenti; aggiungere sette proposte (13 totali). Gli effetti non introducono frenate per vicinanza. Collider comuni; effetti temporanei e pulizia alla fine.
- Pallavolo: impulsi scelti dallo stick al contatto, orientati verso il campo avversario; scelta laterale coerente con la camera. Nessuna nuova mira automatica. Timing e abilità preservati.
- Cornicione: finestre e volumi offensivi verificati rispetto alle pose; nessuna modifica arbitraria a danni/knockback/recuperi. Sweep, immunità e singolo colpo per bersaglio.
- Debug solo `import.meta.env.DEV`, estensione F3 con legenda e diagnostiche limitate; zero strumenti nuovi nella produzione.

## Milestone in ordine

1. Olio: audit, mesh conforme alla pista, grip laterale e feedback; test puri + browser/screenshot; commit.
2. Item: catalogo, pesi per posizione, sette effetti e oggetti, HUD/telefono; test singoli/misti/5 kart, screenshot e cleanup; commit.
3. Pallavolo: mapping, impulso, feedback/touch/CONTROLLI; traiettorie nei due campi e abilità; commit.
4. Hitbox: Cornicione e audit documentato di Arena/FPS/Dodgeball/Kart/Soccer/Volley/CasaCarbo/Minigolf; correggere problemi dimostrabili. Debug reale + screenshot pose, 30/60/120 FPS; commit.
5. Regressione: typecheck, test controller/abilità pertinenti, browser 5 giocatori/telefono/pausa/rejoin/fine/lobby/cleanup; build produzione e report con limiti del playtest umano; commit.

## Evidenza e rischi

Server locale 3001, Vite 5174, Chrome con RTX/ANGLE. Fixture browser possono preparare posizioni, senza spacciarle per input umano. Test accelerati dichiarati. Congelare i sorgenti durante gli E2E (HMR). Separare eventuali problemi preesistenti. Le animazioni native disponibili non coprono ogni attacco: documentare limiti, verificare pose effettive, non promettere clip inesistenti. Bilanciamento fine rimandato ai giocatori reali.
