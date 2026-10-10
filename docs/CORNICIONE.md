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

## Espansione strategica dopo il playtest (ottobre 2026)

Le quattordici mosse precedenti, schivate, salti, recovery, anti-mash, anti-combo e cinque abilità sono conservati. Si aggiungono quattro mosse alla tabella separata STRATEGY_MOVES e una difesa attiva, identiche per tutti i personaggi:

| comando | scelta | vantaggio e rischio |
|---|---|---|
| RT / R2 | calcio | portata maggiore del pugno, stesso danno del laterale leggero (4,5); anticipo 0,18 s e recupero 0,30 s, più 0,18 s a vuoto |
| RT / R2 in aria | calcio aereo | spazio davanti, anticipo 0,14 s, recupero e penalità all'atterraggio; ↓ + RT/R2 calcia dall'alto, non dà una recovery aggiuntiva |
| LB / L1 | presa a terra | portata corta, anticipo 0,16 s, attivo 0,05 s, tiene 0,22 s; scegli con stick sinistra/destra/su/giù la proiezione, 3 danni, velocità limitata a 30 m/s; recupero 0,43 s |
| LT / L2 | parata a tempo | solo a terra, anticipo 0,025 s, finestra frontale 0,12 s; successo annulla un colpo e scopre chi attacca per 0,28 s; errore 0,28 s di recupero; ricarica 0,95 s |

Contromosse: schivare una presa, colpire chi afferra per liberare il compagno, prendere chi usa la parata. Un bersaglio stordito non può essere afferrato; dopo rilascio/proiezione ha un secondo di protezione dalla sola presa. Può ancora subire colpi normali. Parata riuscita non rende invulnerabili agli altri avversari e non lancia né assegna danni gratuiti. L'abilità di Carbo mantiene finestra, proiezione e cariche proprie e può intercettare anche una presa comune.

I binding provengono da `src/input/profiles.ts`, come gli altri: nuovo elenco completo in CONTROLLI e nella Companion Card. Telefono: CALCIO, PRESA, PARATA, accanto ai cinque pulsanti precedenti. Controller generico standard: RT, LB, LT nelle stesse posizioni. Salto A/✕, leggero X/□, pesante Y/△, schiva B/◯, RB/R1 abilità e ↑+Y/△ recovery non cambiano. I buffer seguono InputManager e azioni a fronte, non navigator.getGamepads diretto.

Animazioni: calci, presa, proiezione e blocco usano le clip semantiche già disponibili dei quattro modelli Tripo; tempi di contatto letti dalla simulazione. Il Dottore conserva il rig procedurale. Calcio aereo e presa interrotta usano per ora clip riadattate e movimento/effetti leggibili; per rifinirli servono in futuro un calcio aereo dedicato, una lotta della vittima afferrata e una transizione parata/contrattacco. Nessuna sostituzione di skin o modifica dei collider legata all'animazione.

Test aggiuntivi: `scripts/fighter-strategy-selftest.ts`, `scripts/e2e/post-playtest-fighter.mjs`, `scripts/e2e/post-playtest-fighter-production.mjs`. Tempi e vantaggi delle nuove scelte richiedono playtest umano; non sono bilanciamento definitivo.
