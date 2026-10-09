# CASA CARBO — si allaga casa di Carbo

Minigioco #12 (id `casacarbo`, categoria `SKILL`, rarità `uncommon`, 2–5 giocatori, 120 s, controller-first con fallback telefono).
Durante un temporale la pioggia entra in casa **solo dalle due porte dei giardini**. Tiracqua, secchi e tre scarichi: si gareggia su
**chi toglie davvero più acqua dalla casa**, con un obiettivo comune (**almeno il 75% di casa asciutta** a fine partita).
Niente combattimento: ci si scontra solo per sbaglio (urti e scivolate fanno perdere acqua dal secchio).

## Come è fatto (e dove mettere le mani)

| cosa | file |
|---|---|
| **tutti i numeri di gioco** (pioggia, acqua, velocità, tiracqua, secchio, scivolate, porte, eventi) | `src/minigames/casaCarbo/ccTuning.ts` |
| planimetria: pareti, porte rosse, mobili, scarichi, TV, tappeti, partenze, griglia | `mapData.ts` |
| simulatore PURO (nessun Babylon): acqua a griglia, giocatori, scarichi, eventi, contabilità dell'acqua | `waterCore.ts` + `ccTypes.ts` |
| le 5 abilità (meccanica; i numeri stanno nel catalogo) | `ccAbilities.ts` + `shared/abilityCatalog.ts` (`AB.casacarbo`) |
| contributo personale e titoli comici | `scoring.ts` |
| bot di test (solo debug) | `ccBot.ts` |
| rendering 3D, input, eventi → effetti/suoni/HUD, finale, risultati | `CasaCarboGame.ts` |
| casa 3D e acqua disegnata (texture 68×42, solo dentro casa) | `casaCarboEnvironment.ts` |
| HUD (timer, % asciutta, classifica, secchio sopra i personaggi, fumetto del finale) | `casaCarboHud.ts` |

Riusati senza crearne di paralleli: GameManager, ScoreManager, InputManager/Gamepad, abilityCatalog + AbilityHub + Companion Card,
schermata CONTROLLI, audio, telemetria, rullo (nessuna modifica all'algoritmo). Il minigioco restituisce **solo classifica e statistiche**:
i punti partita li assegna lo ScoreManager in base alla posizione.

## Comandi

| | Xbox / PlayStation | |
|---|---|---|
| stick sinistro | | muoviti |
| X / □ | **tiracqua** (tieni) | spinge l'acqua davanti a te; più lento mentre lo usi |
| Y / △ | **secchio** | tieni = raccogli · premi vicino a uno scarico = svuota |
| A / ✕ | scatto | breve, con ricarica; col secchio pieno ne rovesci un po' |
| B / ◯ | **interagisci** (tieni) | contieni la porta · libera uno scarico intasato · metti in salvo la TV · sposta il tappeto |
| RB / R1 | **abilità** | |

Chi non ha il controller gioca col telefono: croce + TIRACQUA / SECCHIO / SCATTO / INTERAGISCI / ABILITÀ (layout generico `dpad`).
Col controller il telefono mostra la Companion Card (solo informativa; l'avviso di Victor compare SOLO lì).

## Acqua

- Griglia di 68×42 celle da 0,5 m. Ogni cella ha un'altezza d'acqua; le celle vicine si livellano (`spread`), ma sotto `sticky`
  una pozza smette di scorrere: le pozze hanno bordi, quindi la **% di casa asciutta** (celle sotto `dry`) ha un senso.
- La pioggia entra **solo** dalle celle delle due porte dei giardini (anteriore e posteriore), con un'intensità per fase e per numero
  di giocatori (`rain`, `rainBase + rainPerPlayer × giocatori`). Nessun evento crea altre sorgenti.
- Tre scarichi: **bagno** (accetta acqua del tiracqua e dei secchi; beve da solo un po' d'acqua vicina senza dare punti),
  **lavello** e **tombino** del giardino dietro (solo secchi).
- Contabilità esatta, verificata dal self test: `acqua entrata = in casa + nei secchi + tolta con merito + tolta da sola + rovesciata fuori`.

## Fasi del temporale ed eventi

| tempo | fase |
|---|---|
| 0–25 s | pioggia moderata |
| 25–65 s | pioggia forte |
| 65–95 s | raffiche |
| 95–110 s | picco (tutte e due le porte) |
| 110–120 s | spiove: ultima occasione per asciugare |

Eventi (annunciati 3 s prima, nessuno crea acqua nuova): **«AO', MA QUANTO PIOVE?!»** (pioggia più forte per qualche secondo),
**«CHIUDI QUELLA PORTA!»** (raffica su una porta), **«ME SO ROTTO ER CAZZO!»** (tappeto bagnato che blocca un passaggio),
**«È TUTTO INTASATO!»** (uno scarico si intasa: tieni INTERAGISCI per liberarlo), **«LA TV, PORCO DUE!»** (l'acqua minaccia la TV:
portala in salvo prima che si rovini).

## Punteggio (contributo personale)

| azione | punti |
|---|---|
| acqua che lascia davvero la casa da uno scarico (secchio, tiracqua, abilità) | **+1** per unità |
| acqua fermata contenendo una porta | **+0,5** per unità (tetto per giocatore) |
| TV messa in salvo | **+6** |
| scarico intasato liberato | **+4** |
| acqua solo spostata fra stanze · raccolta e poi rovesciata | 0 |

Classifica per contributo; a parità vince chi ha tolto più acqua, poi un ordine deterministico.
Obiettivo comune: ≥ 75% asciutta → **CASA SALVATA!**, altrimenti **ALLAGAMENTO TOTALE**.
Finale col vicino che suona alla porta (fumetto in basso): «CARBO, MA CHE È SUCCESSO QUA?» / «NIENTE, ABBIAMO FATTO UN PO' DE PULIZIE.»
oppure «MA CHE CAZZO AVETE COMBINATO?!» / «IO L'AVEVO DETTO COME DOVEVAMO FA'!».
Titoli comici (non cambiano i punti): L'UNICO CHE HA LAVORATO · IL SECCHIO D'ORO · MO ASCIUGO IO · IL BAGNINO · DANNO COLLATERALE · PRESENTE MA INUTILE.

## Abilità (a PARTITA, tasto RB / R1)

| personaggio | abilità | cosa fa | limite |
|---|---|---|---|
| Goblin | **N'CULO, MO ASCIUGO IO!** | carica 0,5 s poi onda che sposta l'acqua per 5 m davanti (e spinge chi c'è) | 2 usi, ricarica 9 s |
| Boschi | **TU QUA NON ENTRI!** | davanti a una porta: per 6 s entra un decimo della pioggia; fermo; quando molla metà dell'acqua trattenuta entra tutta insieme | 1 uso |
| Victor | **M'HO SVEJATO** | se nei prossimi 25 s arriva una raffica, SOLO il suo telefono dice quale porta e quando; altrimenti sprecata | 2 usi |
| Carbo | **NO, ASPETTA!** | diga di 3 m davanti a sé per 15 s (ferma l'acqua, non le persone); se dietro si accumula troppo cede | 2 usi |
| Ciro | **PAGO DOMANI** | il prossimo secchio porta il doppio; oltre la capienza normale ha 6 s per svuotarlo, se no ne rovescia metà | 2 usi |

Avvisi privati sul proprio telefono quando non può partire: VAI VICINO A UNA PORTA · IN RICARICA · ESAURITA · NON ORA.

## Test

```
npx tsx scripts/casacarbo-selftest.ts            # simulatore: conservazione dell'acqua, direzione del flusso, punteggio, abilità, urti, eventi
npx tsx scripts/casacarbo-sim.ts                 # partite intere coi bot (2-5 giocatori, abilità ON/OFF, nessuno che lavora)
node scripts/e2e/casacarbo-smoke.mjs 5 30 1      # browser: 5 bot fino al finale, screenshot in e2e-shots/casacarbo/, camera sempre in quadro
node scripts/e2e/gamepad-casacarbo.mjs           # controller: CONTROLLI, mappatura, risposta del gioco, Companion Card, fallback telefono
node scripts/e2e/casacarbo-abilities.mjs         # 5 controller: le 5 abilità valide/non valide, privacy di Victor e degli avvisi, pulizia
ROUNDS=4 node scripts/e2e/casacarbo-session.mjs  # round ripetuti + menu ESC -> lobby: nessuna perdita
node scripts/e2e/casacarbo-perf.mjs              # mesh, draw call, costo CPU della simulazione
```

## Stato

Prima versione completa. **I numeri sono iniziali**: con i bot la casa si salva a filo (≈73–84% asciutta a seconda dei giocatori,
≈51–59% se nessuno lavora), ma il bilanciamento vero va fatto con un playtest reale con i controller.
