# BOTTE SUL CORNICIONE — platform fighter 2.5D

Minigioco #11 (id `cornicione`, categoria `SKILL`, 2–5 giocatori, controller-first). Idea: **più danno hai, più lontano voli; cadere oltre i limiti = una vita in meno**. A mani nude, 3 vite, libero per tutti, 150 s di limite.
Se sembra "Arena con i salti" non è finito: Arena è fisica/spinte/sumo, qui contano **percentuale, aerial, recovery, edge guard e tempismo dell'abilità**.

## Come è fatto (e dove mettere le mani)

| cosa | file |
|---|---|
| numeri: fisica, schivata, parete, danno, KO, tempi, palco, **tabella delle 14 mosse** | `src/minigames/cornicione/fighterData.ts` |
| simulatore PURO (nessun Babylon): movimento, salti, parete, schivata, attacchi, knockback, stordimento, KO, respawn, classifica | `fighterCore.ts` + `fighterTypes.ts` |
| le 5 abilità (meccanica; i numeri stanno nel catalogo) | `fighterAbilities.ts` + `shared/abilityCatalog.ts` (`AB.cornicione`) |
| bot di test | `fighterBot.ts` |
| rendering 3D, input, eventi → effetti/suoni/HUD, risultati | `BabylonCornicioneGame.ts` |
| palco "Tetto del Disagio" | `cornicioneEnvironment.ts` |
| camera condivisa / HUD / effetti | `fighterCamera.ts` / `fighterHud.ts` / `fighterFx.ts` |
| animazioni dei colpi (rig procedurale condiviso) | `src/minigames/arena/arenaEntity.ts` (`playMove`) |

Riusati senza crearne di paralleli: GameManager, ScoreManager, InputManager/Gamepad, abilityCatalog + AbilityHub + Companion Card, CONTROLLI, impact, audio, telemetria, rullo (nessuna modifica all'algoritmo).

## Comandi

| | Xbox / PlayStation | |
|---|---|---|
| stick sinistro | | corsa · direzione degli attacchi · ↓ in aria = caduta rapida · ↓ su un ponteggio = scendi |
| A / ✕ | salto (2 salti totali) | tenuto = salto pieno, rilasciato presto = salto corto |
| X / □ | attacco **leggero** | neutro / laterale / ↑ / ↓ (a terra e in aria) |
| Y / △ | attacco **pesante** | laterale / ↑ / ↓. **↑ + Y in aria = RECOVERY ATTACK** |
| B / ◯ | schivata | a terra breve; in aria direzionale (air dodge) |
| RB / R1 | **abilità** | |

Chi non ha il controller gioca col telefono: croce + SALTO / LEGGERO / PESANTE / SCHIVA / ABILITÀ (layout generico `dpad`, nessun codice telefono nuovo). Col controller il telefono mostra la Companion Card (solo informativa).

## Danno, knockback, KO

Niente HP. `percentuale` parte da 0 e non ha tetto. Ogni attacco ha `damage · baseKnockback (bkb) · damageScaling (kbs) · angle · stun · recovery`:

```
velocità di lancio = (bkb + kbs × percentuale_vittima_dopo_il_colpo) × moltiplicatore   [m/s]
stordimento        = (0,10 + velocità × 0,0125) × scala_combo      (min 0,10 · max 0,95 s)
DI                 = la componente PERPENDICOLARE dello stick devia il lancio (14% della velocità): non lo annulla mai
```

- **Anti mash**: la stessa mossa ripetuta sullo stesso bersaglio fa -6% di danno a ripetizione (minimo 60%).
- **Anti combo infinite**: ogni colpo di una combo stordisce 17% in meno (minimo 35%); dopo 6 colpi chi subisce è intangibile 0,5 s a fine stordimento.
- **Leggere** (≈3-4,5 danno, poco knockback): rapide, mai KO. **Pesanti** (11-13 danno): anticipo 0,26-0,30 s, recupero 0,38-0,50 s → leggibili e punibili.
- **KO**: oltre x ±34, y +27 / −22 (molto fuori dall'inquadratura). Respawn dopo 1,8 s a y=12 sopra il centro, 0%, invulnerabile 2 s (finisce prima se attacchi). L'ultimo che ti ha colpito negli ultimi 4 s si prende il KO.
- Soglie misurate (`scripts/fighter-ko-thresholds.ts`, bersaglio che recupera): pesante laterale sul bordo ≈150%, spazzata bassa sul bordo ≈140%, ↑ pesante dalla piattaforma alta ≈130%, dal centro 240%+; i leggeri non fanno KO.

## Recovery (la meccanica centrale)

Essere sparati fuori NON è morire: doppio salto · air dodge (uno per volo, ricarica 1,1 s) · recovery attack (↑ + Y in aria, **una volta** finché non tocchi terra o una parete valida) · **parete della palazzina**: tenendo lo stick verso la parete ti attacchi (max 0,7 s, scivoli piano, 2 attacchi per volo), salto dalla parete spinge via e su; un attacco alla parete riarma il recovery attack. L'edge guard è permesso e voluto.

## Palco: TETTO DEL DISAGIO

Palazzina 26 m larga (pareti che scendono nella foschia = zona di recovery), 3 ponteggi one-way (si attraversano dal basso, ↓ per scendere): due a y 3,6 e uno al centro a y 7,2, simmetrici. Tramonto, skyline con gru e antenne, tre soli cartelli (VIETATO CADERE, PIZZERIA ANGORA, 20 KG*). Nessun elemento decorativo è collidibile né sul piano di gioco.

## Camera e HUD

Una camera laterale condivisa sul centro dei vivi: zoom dinamico (vicini = più vicino), centro limitato a ±9 m e zoom massimo → palco e zona di recovery sempre visibili. Chi vola oltre il quadro ha un indicatore sul bordo (ritratto, freccia, %). HUD: per giocatore ritratto, nome, ♥♥♥, % a fasce (0-50 chiaro · 50-100 caldo · 100-150 pericolo · 150+ ⚠ rosso pulsante), stato dell'abilità. Annunci in alto (non coprono i personaggi). Primo avvio: 3 consigli sotto i comandi (una volta).

## Le 5 abilità (valgono PER VITA; nessuna differenza di statistiche fra i personaggi)

| personaggio | abilità | in una riga |
|---|---|---|
| Goblin | **RIMONTA AL 90°** | in aria e fuori dal palco: scatto fisico diagonale (non teletrasporto); se rientra entro 2,5 s ha 1,2 s per un attacco aereo speciale (non un KO gratis); sprecata = consumata |
| Buttafuori | **ULTIMO ACCESSO: 3 SETTIMANE FA** | sparisce ~1,1 s (intoccabile, non colpisce), riappare a ~4,5 m nella direzione dello stick; il punto si vede 0,45 s prima; poi 0,5 s senza schivata |
| Judoka | **ANGORA CHE DICI?** | 2 cariche: postura 0,5 s; se lo colpiscono corpo a corpo annulla il colpo, afferra e proietta (sinistra / destra / giù) più forte quanto più forte era il colpo (tetto 32 m/s); a vuoto resta scoperto 0,55 s |
| Dottore | **TAGLIO PESO EXPRESS** | 5 s più agile in aria (accelerazione, salto, caduta) ma i colpi lo lanciano ×1,9 |
| Ciro | **BONIFICO IN LAVORAZIONE** | sul punto di morire si apre 0,6 s "BONIFICO? RB": premi = KO rinviato + 2,5 s per rientrare (strumenti di recupero pieni), se rientra +25% di danno, se no sei fuori; se non premi, KO normale |

Stato live (PRONTA / 1/2 / ATTIVA / ESAURITA / DEBITO 1,8 s) su HUD TV e Companion Card dallo stesso AbilityHub; avvisi privati se il tasto non può partire ("SOLO IN ARIA", "SOLO FUORI DAL PALCO", "ESAURITA", "SOLO SE STAI PER USCIRE").

## Fine partita e classifica

Vince l'ultimo con almeno una vita. A 150 s: più vite → % più bassa → più KO → **spareggio rapido** (i pari al comando, 1 vita, 150%, max 20 s) → sorteggio. Eliminati: chi esce dopo è meglio piazzato. Sempre una posizione 1..N per ScoreManager. Statistiche nei risultati (max 3): KO, danno inflitto, recuperi (o counter per il Judoka).

## Telemetria (F4)

`durationSec, endReason, kos, deaths, avgDeathPercent, damageDealt, damageReceived, recoveryAttempts, recoveriesOk, edgeKos, maxCombo, abilityUses/Successes/Failures` + per abilità (sezione ABILITÀ): rimonte riuscite · attacchi evitati · counter tentati/riusciti/KO da counter · recuperi da leggero · KO da leggero · bonifici offerti/attivati/salvataggi. Segnalazioni: partite quasi sempre allo scadere, % media al KO > 220, durata media < 40 s.

## Strumenti di sviluppo (solo dev o `?debug=1`)

- `?fighter=1` — **Fighter Lab**: il gioco vero con spawn 2-5, % di danno, reset vite, "fuori dal palco", "KO imminente", abilità pronta, hitbox/hurtbox/limiti di KO (H), bot, rallentatore 1× / 0,5× / 0,25×. Tastiera: frecce, Z salto, X leggero, C pesante, V schivata, B abilità.
- F3: riga per giocatore (%, vite, a terra, salti, air dodge, recovery, velocità, ultimo che ha colpito, stato abilità).

## Test

```
npx tsx scripts/fighter-selftest.ts            # 165 controlli: movimento, salti, parete, schivata, 14 mosse, danno/knockback, combo, DI, KO, respawn, classifica, 5p
npx tsx scripts/fighter-abilities-selftest.ts  # 82 controlli: valida / non valida / effetto / un uso per vita / pulizia, per ognuna delle 5
npx tsx scripts/fighter-sim.ts [partite]       # bot, 2-5 giocatori, abilità ON/OFF: loop, partite infinite, abilità dominante, durate
npx tsx scripts/fighter-ko-thresholds.ts       # a che % ogni colpo fa KO
node scripts/e2e/gamepad-fighter.mjs           # browser: CONTROLLI, mappatura pad, risposta del gioco, Companion Card, fallback telefono
node scripts/e2e/fighter-abilities.mjs         # browser: le 5 abilità con 5 controller, privacy, pulizia
node scripts/e2e/fighter-session.mjs           # browser: fighter → risultati → rullo → fighter ×4 → menu ESC → lobby (nessuna perdita)
node scripts/e2e/fighter-perf.mjs              # mesh / materiali / draw call (GPU reale da verificare)
node scripts/e2e/fighter-lab-shots.mjs         # foto dei momenti chiave in e2e-shots/fighter/
```

## Da verificare con persone e controller veri (NON fatto)

Il feeling di salto/colpo/schivata, i tempi (anticipo/recupero), la letalità reale, la leggibilità con 5 persone sul divano, il peso delle abilità (nessun bilanciamento fine automatico: i bot non sono giocatori), le prestazioni su GPU reale.

## Oggetti e calci strategici (ottobre 2026)

La presa comune è stata rimossa integralmente. La proiezione dell'abilità RB/R1 di Carbo resta disponibile. Restano le 14 mosse originali, salti, schivate, parata, recovery, anti-mash, anti-combo, vite e cinque abilità.

| comando | scelta | vantaggio e rischio |
|---|---|---|
| LB / L1 / LANCIO sul telefono | lancio | Tocca e rilascia per tiro veloce; tieni fino a 1 s per caricare, poi rilascia. Stick/croce mira in due dimensioni, anche in aria. Neutro = avanti. 6 s di ricarica dal lancio, .10 s anticipo al rilascio, .28 s recupero. |
| RT / R2 | calcio laterale | Portata geometrica +35% rispetto al pugno laterale, stesso danno 4.5. Spinta base 8 invece di 5.5, crescita .075 invece di .05; anticipo .18 s, attivo .10 s, recupero .30 s + .18 s se manca. |
| RT / R2 in aria | calcio aereo | Portata +35% rispetto al laterale aereo, danno 4.5; anticipo .14 s, attivo .12 s, recupero .28 s + .15 s a vuoto. Atterraggio .22 s (+ .15 s a vuoto). |
| ↓ + RT / R2 in aria | calcio dall'alto | 4 danni e maggiore spinta verso il basso: anticipo .16 s, recupero .32 s + .15 s a vuoto, landing .28 s. Intercetta la risalita; non concede altri salti o recovery. |
| LT / L2 | parata a tempo | A terra, anticipo .025 s, finestra frontale .12 s, errore .28 s recupero e ricarica .95 s. Contro corpo a corpo annulla e stordisce l'attaccante .28 s. Contro oggetto lo distrugge senza stordire a distanza il tiratore. |

Il tiro non segue il bersaglio: la direzione è fissata al rilascio. Velocità 18–30 m/s e durata .55–.85 s: percorre 9.9–25.5 m dall'origine del proiettile. Danno 4, knockback base 5 + percentuale × .045 e raggio .26 m restano uguali con ogni carica/personaggio. Si applicano ancora anti-mash, combo, DI, invulnerabilità e credito KO. Il singolo oggetto colpisce soltanto il primo bersaglio valido. La collisione continua evita attraversamenti alle alte velocità. Il tetto blocca i tiri sotto il piano; le piattaforme one-way non diventano barriere agli attacchi.

Ciro lancia monete; Carbo una granita; BOSCHI una lattina di birra; Goblin una bottiglietta di Jägermeister; Victor uno shaker proteico. Monete sparse, schizzi rosa, schiuma, frammenti verdi e liquido proteico sono cosmetici, così come i suoni. Non esiste alcun collider legato alla forma degli oggetti: soltanto le abilità RB/R1 differenziano il gameplay dei personaggi. I frammenti durano .45 s, poi spariscono; non lasciano ostacoli.

La carica si può annullare usando un'altra mossa o una schivata. Colpo subito, KO, pausa, perdita pad, disconnessione/blur del telefono e pointercancel annullano senza tiro fantasma. Il rilascio impegna anticipo e recupero; una nuova pressione durante cooldown non viene accodata per sparare da sola alla scadenza. La ricarica persiste attraverso il respawn. Proiettili del giocatore KO e tutti i proiettili a fine round/spareggio vengono rimossi.

L'abilità di Carbo conserva cariche, tempi, proiezione e intercettazione corpo a corpo. Gli oggetti si difendono con la parata comune o la schivata: il counter non afferra un tiratore distante.

CONTROLLI e Companion Card leggono gli stessi binding del gioco. Il telefono ha LANCIO tenuto con cattura del dito, così un altro dito può mirare sulla croce; card e TV mostrano carica/ricarica. I quattro rig Tripo usano le rispettive clip ballThrow/frontKick/roundhouse/block; Victor mantiene il personaggio procedurale e la posa di lancio. Le animazioni non cambiano hitbox né tempi di gioco. Il laboratorio ?fighter=1 aggiunge K calcio, T lancio tenuto, P parata.

Test: fighter-projectile-selftest.ts, fighter-strategy-selftest.ts, suite core/abilità/pad/animazioni; post-playtest-fighter.mjs (5 giocatori, pad misti + telefono, pause/rejoin/cancellazioni, round naturale accelerato); post-playtest-fighter-production.mjs (1 telefono + 4 bot, build di produzione, tempo reale). Report ed evidenze aggiornate in docs/agent-work/cornicione-throws/. La taratura finale di cooldown, spinta e recupero richiede playtest umano.
