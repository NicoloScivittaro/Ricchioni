# ABILITÀ — come funziona il sistema

Le abilità sono una **feature centrale**: 5 personaggi × 10 minigiochi = 50 combinazioni, ognuna con la sua meccanica. La matrice completa (prima/dopo, voti) è in [ABILITY_MATRIX.md](ABILITY_MATRIX.md), generata da `scripts/ability-matrix.ts`.

## Una sola fonte: `shared/abilityCatalog.ts`

Ogni combinazione (`AB.<gioco>.<personaggio>`) ha:

| campo | cosa è |
|---|---|
| `name` | il nome da urlare ("PAGO DOMANI") |
| `short` / `full` | una riga / 2-4 righe "COSA FA · QUANDO PREMERE · LIMITE" (niente lore) |
| `limit`, `charges`, `cooldown` | usi per round e ricarica |
| `kind` | TIMING · RISORSA LIMITATA · RISCHIO/PREMIO · REATTIVA · INFORMAZIONE · REGOLA PIEGATA |
| `impact` | BASSO / MEDIO / ALTO (ALTO = pochi usi, ricarica, barra o rischio) |
| `p` | i **numeri della meccanica** (durate, moltiplicatori, finestre) |

I giochi leggono i numeri **solo da qui** (`AB.arena.goblin.p.window`), e `full` è generato dagli stessi numeri: se la durata passa da 5 a 6 secondi cambiano insieme codice, schermata CONTROLLI, card del telefono e descrizione. `scripts/ability-selftest.ts` fallisce se un numero in secondi non compare nel testo.

Il **tasto non è nel catalogo**: vive in `src/input/profiles.ts` (la stessa fonte dell'input vero). Dove un gioco usa già un altro tasto resta quello provato (Arena/Dodgeball/Pallavolo `B / ◯`, Calcio e Kart `Y / △`); Memoria, Botta al Volo, Quiz e Sparatoria usano `RB / R1`.

## Stato live: `src/core/abilityHub.ts`

Ogni minigioco resta **l'unica autorità** sul proprio stato e lo pubblica con le stesse cinque parole: `READY · CHARGING · ACTIVE · COOLDOWN · SPENT` (+ tempo residuo, cariche, barra, una nota). Da qui leggono: la striscia giocatori sulla TV (`GameHud.setAbility`), la barra del Kart, la card sul telefono. Nessuno ha una seconda simulazione.

```
gioco  ──setStatus(pid, {state,…})──▶  AbilityHub ──▶ HUD TV (onStatus)
                                                  └▶ telefono (messaggio privato 'ability')
gioco  ──activated(pid) / failed(pid,"NON ORA")──▶ lampo col nome / avviso privato + vibrazione
gioco  ──succeeded / wasted / impact──▶ statistiche per il report F4
```

Cicli di vita: `abilityHub.begin('<gioco>', ctx)` all'avvio del round, `abilityHub.end()` allo shutdown della scena (consegna le statistiche, spegne la card sui telefoni, azzera tutto: nessuna abilità sopravvive a un restart).

## Telefono: Companion Card (`src/controller/abilityCard.ts`)

Con un controller fisico il telefono non è un joystick: è una **guida** ("aspetta, che cazzo fa la mia abilità?"). Ritratto, nome del personaggio, **ABILITÀ** (nome, tasto vero per Xbox/PlayStation, tipo, cosa fa, limite, stato live), poi i comandi. Niente bottoni di gioco. Il Quiz sostituisce la card con l'INFO PRIVATA e poi torna da solo; Cultura (`PHONE_TEXT`) mantiene la sua UI e l'abilità si usa dal bottone ⚡ nella fase di voto.

## TV

* **CONTROLLI** (5 s): il comando ABILITÀ è disegnato in evidenza e sotto c'è una riga per ogni personaggio presente (icona, nome, abilità, cosa fa).
* **HUD**: stato per giocatore (PRONTA / ATTIVA 4,2 s / RICARICA 6 s / ESAURITA) nella striscia (Arena, Dodgeball, Calcio, Pallavolo), nel pannello del Kart, nella finestra della Sparatoria (con barra di ricarica e zona verde per il Goblin), nei badge di Memoria/Botta al Volo/Quiz.
* **Attivazione**: il nome dell'abilità compare sopra il personaggio per ~1,25 s (`ArenaEntity.playAbility`) e nel feed.

## Abilità premuta ma non partita

Mai silenzio. `abilityHub.failed(pid, "NON ORA" | "ESAURITA" | "IN RICARICA" | "SERVE LA PALLA" | …)` manda un avviso **privato** e una vibrazione breve.

## Debug (solo `?debug=1`)

`F4` → SESSION REPORT con la sezione **ABILITÀ**: per ogni abilità di ogni gioco giocato usi, riuscite, fallite/sprecate e la metrica d'impatto specifica (parate, kill, posizioni guadagnate, punti…); in fondo "MAI USATE". `window.__abilityReport()` stampa solo quella sezione.

## Test

```
npx tsx scripts/ability-selftest.ts          # catalogo + logica dei 5 personaggi nei giochi d'azione (trigger valido/invalido, doppia attivazione, pulizia)
npx tsx scripts/kart-abilities-selftest.ts   # Kart (finestre reattive di Buttafuori e Ciro, camion del Judoka)
npx tsx scripts/ability-sim.ts               # Quiz con 5 bot di pari abilità, abilità ON/OFF: nessuna dominante
node scripts/e2e/ability-companion.mjs       # browser vero: card, tasti per famiglia, stato live, avvisi privati, pulizia, Quiz, Sparatoria
```
