# Grafica dei 15 giochi — verifica prima/dopo

Stato: completato.

Miglioramento della presentazione con dettagli dipinti nelle texture già esistenti, palette e contorni più puliti. Nessuna modifica a regole, fisica, hitbox, input, abilità, camera, modelli o animazioni. Preset e algoritmo della qualità automatica conservati. Nessuna nuova luce, mesh, texture GPU, ombra, particella o passaggio di postprocessing. I pannelli di Kart e Casa Carbo usano gli stessi controlli e la stessa texture HUD, con spazio sufficiente per le descrizioni.

## Verifiche

- 15/15 giochi: ingresso, rendering e ritorno attraverso fine/risultati/rullo, con 2 giocatori medium e 5 low; nessun errore di pagina e cleanup del canvas 3D. Fine round forzata dal test: non è una nuova simulazione di tutte le condizioni di vittoria.
- Confronto di 30 configurazioni: GPU NVIDIA RTX 3050, ANGLE Direct3D11, viewport host 1280×720. Risorse di scena e risoluzione effettiva uguali nelle coppie accettate.
- I campioni con risoluzione dinamica differente sono stati ripetuti sulla copia congelata dei sorgenti originali e sulla versione nuova a scala fissa; solo i test bloccano la scala, il prodotto conserva l'adattamento.
- Due o tre finestre di 3 secondi, dopo warm-up; valori aggregati con la mediana delle finestre. I dati grezzi mantengono anche pause occasionali di scheduling/GC. Segnalazione di regressioni: perdita oltre 1,5 FPS o incremento p95 oltre il maggiore fra 1,5 ms e 10%; nessun confronto finale supera queste soglie. Le oscillazioni piccole non sono prova di guadagni o perdite.
- Conteggi mesh/materiali/texture/luci/camere invariati nelle 30 coppie. Draw call e tempi CPU registrati; i 60 FPS limitati dalla sincronizzazione non dimostrano da soli margine GPU aggiuntivo.
- Probe FPS separato: 2 e 5 viewport reali più renderer del telefono a 390×800; stessa GPU, risoluzione e risorse nelle coppie.
- Controllo delle righe delle abilità nei pannelli Kart/Casa Carbo con 2 e 5 giocatori: larghezza e altezza effettive sufficienti, inclusi i font delle icone.
- npx tsx scripts/quality-selftest.ts: exit 0, soglie, isteresi, risoluzione e scelta manuale verificati.
- GOBLIN_GPU=1 node scripts/e2e/environment-selftest.mjs: exit 0, low/medium/high, decorazioni non collidibili, nessuna occlusione, cielo fuori dal bagliore e scala di grigi.
- node scripts/e2e/graphics-compare.mjs: exit 0, 30/30 confronti accettati.
- npm run build: exit 0; TypeScript e bundle Vite completati.
- Bundle compilato servito su localhost:3001: prod-bundle.mjs con Kart e due telefoni, exit 0; preload e avvio senza errori.

## FPS e intervallo dei fotogrammi

| Gioco | Configurazione | FPS prima → dopo | p95 ms prima → dopo | Esito |
|---|---|---|---|---|
| Quiz | 2-medium | 60.1 → 60.2 | 16.8 → 16.8 | OK |
| Botta al volo | 2-medium | 59.7 → 60.0 | 16.8 → 16.8 | OK |
| Memoria | 2-medium | 58.3 → 59.1 | 16.8 → 16.8 | OK |
| Arena | 2-medium | 57.7 → 59.8 | 19.6 → 18.1 | OK |
| Dodgeball | 2-medium | 60.1 → 59.9 | 18.4 → 17.5 | OK |
| Calcio | 2-medium | 59.0 → 59.9 | 20.8 → 18.7 | OK |
| Pallavolo | 2-medium | 57.0 → 59.8 | 32.5 → 17.9 | OK |
| Kart | 2-medium | 59.2 → 60.0 | 22.0 → 18.2 | OK |
| Cultura | 2-medium | 59.9 → 59.2 | 16.8 → 16.8 | OK |
| Sparatoria | 2-medium | 57.6 → 58.2 | 16.9 → 16.8 | OK |
| Cornicione | 2-medium | 59.5 → 59.9 | 19.6 → 18.8 | OK |
| Casa Carbo | 2-medium | 60.0 → 60.0 | 18.2 → 18.0 | OK |
| Minigolf | 2-medium | 58.8 → 58.9 | 20.1 → 18.9 | OK |
| Geofall | 2-medium | 60.1 → 59.8 | 18.5 → 17.3 | OK |
| Backrooms | 2-medium | 57.3 → 59.7 | 21.2 → 19.5 | OK |
| Quiz | 5-low | 60.1 → 60.0 | 16.8 → 16.8 | OK |
| Botta al volo | 5-low | 59.6 → 59.9 | 16.8 → 16.8 | OK |
| Memoria | 5-low | 58.6 → 57.6 | 16.8 → 16.8 | OK |
| Arena | 5-low | 59.2 → 59.5 | 18.3 → 19.1 | OK |
| Dodgeball | 5-low | 60.0 → 60.0 | 19.2 → 18.6 | OK |
| Calcio | 5-low | 60.0 → 58.9 | 19.3 → 19.6 | OK |
| Pallavolo | 5-low | 60.0 → 60.0 | 18.3 → 17.7 | OK |
| Kart | 5-low | 59.8 → 58.8 | 19.6 → 20.8 | OK |
| Cultura | 5-low | 59.4 → 60.1 | 16.8 → 16.8 | OK |
| Sparatoria | 5-low | 57.4 → 58.0 | 16.9 → 16.9 | OK |
| Cornicione | 5-low | 60.0 → 60.0 | 18.3 → 17.9 | OK |
| Casa Carbo | 5-low | 60.0 → 59.9 | 18.9 → 18.9 | OK |
| Minigolf | 5-low | 60.0 → 60.1 | 18.7 → 19.0 | OK |
| Geofall | 5-low | 60.0 → 60.1 | 17.9 → 18.2 | OK |
| Backrooms | 5-low | 51.2 → 55.6 | 22.3 → 23.5 | OK |

## Probe Sparatoria

| Modalità | FPS prima → dopo | Risoluzione | Draw call prima → dopo |
|---|---|---|---|
| 2 viewport medium | 59.8 → 59.9 | 1280×720 | 94.0 → 94.0 |
| 5 viewport low | 45.9 → 58.9 | 731×411 | 332.0 → 332.0 |
| Telefono | 59.6 → 59.8 | 390×800 | 29.0 → 29.0 |

## Miglioramenti e immagini

- **Quiz**: Scenografia con luci statiche, fondo della domanda più calmo, testi nitidi. [Prima](C:/Users/niluf.PC-NIKO/Desktop/Ricchioni/docs/agent-work/graphics-performance/before-2-medium/quiz.png) · [Dopo](C:/Users/niluf.PC-NIKO/Desktop/Ricchioni/docs/agent-work/graphics-performance/after-2-medium/quiz.png).
- **Botta al volo**: Luci dello studio e profondità della pedana nella texture esistente. [Prima](C:/Users/niluf.PC-NIKO/Desktop/Ricchioni/docs/agent-work/graphics-performance/before-2-medium/reaction.png) · [Dopo](C:/Users/niluf.PC-NIKO/Desktop/Ricchioni/docs/agent-work/graphics-performance/after-2-medium/reaction.png).
- **Memoria**: Luce calda del bar, schede più leggibili e accenti statici. [Prima](C:/Users/niluf.PC-NIKO/Desktop/Ricchioni/docs/agent-work/graphics-performance/before-2-medium/memory.png) · [Dopo](C:/Users/niluf.PC-NIKO/Desktop/Ricchioni/docs/agent-work/graphics-performance/after-2-medium/memory.png).
- **Arena**: Finitura del pavimento, gradazione di profondità, insegne e HUD. [Prima](C:/Users/niluf.PC-NIKO/Desktop/Ricchioni/docs/agent-work/graphics-performance/before-2-medium/arena.png) · [Dopo](C:/Users/niluf.PC-NIKO/Desktop/Ricchioni/docs/agent-work/graphics-performance/after-2-medium/arena.png).
- **Dodgeball**: Parquet con bordi delle doghe, finitura del campo e cartelli. [Prima](C:/Users/niluf.PC-NIKO/Desktop/Ricchioni/docs/agent-work/graphics-performance/before-2-medium-fixed/dodgeball.png) · [Dopo](C:/Users/niluf.PC-NIKO/Desktop/Ricchioni/docs/agent-work/graphics-performance/after-2-medium-fixed/dodgeball.png).
- **Calcio**: Prato con fibre e palette meno piatta, insegne e HUD. [Prima](C:/Users/niluf.PC-NIKO/Desktop/Ricchioni/docs/agent-work/graphics-performance/before-2-medium/soccer.png) · [Dopo](C:/Users/niluf.PC-NIKO/Desktop/Ricchioni/docs/agent-work/graphics-performance/after-2-medium/soccer.png).
- **Pallavolo**: Granuli e ondulazioni della sabbia, migliore contrasto del campo. [Prima](C:/Users/niluf.PC-NIKO/Desktop/Ricchioni/docs/agent-work/graphics-performance/before-2-medium/volleyball.png) · [Dopo](C:/Users/niluf.PC-NIKO/Desktop/Ricchioni/docs/agent-work/graphics-performance/after-2-medium/volleyball.png).
- **Kart**: Finestre e balconi nelle texture delle facciate; abilità su righe complete in split-screen. [Prima](C:/Users/niluf.PC-NIKO/Desktop/Ricchioni/docs/agent-work/graphics-performance/before-2-medium/kart3d.png) · [Dopo](C:/Users/niluf.PC-NIKO/Desktop/Ricchioni/docs/agent-work/graphics-performance/after-2-medium-fixed/kart3d.png).
- **Cultura**: Scenografia del bar con illuminazione statica e testi più puliti. [Prima](C:/Users/niluf.PC-NIKO/Desktop/Ricchioni/docs/agent-work/graphics-performance/before-2-medium/cultura.png) · [Dopo](C:/Users/niluf.PC-NIKO/Desktop/Ricchioni/docs/agent-work/graphics-performance/after-2-medium/cultura.png).
- **Sparatoria**: Cemento, legno e rilievo dei container; cartelli condivisi su TV e telefono. [Prima](C:/Users/niluf.PC-NIKO/Desktop/Ricchioni/docs/agent-work/graphics-performance/before-2-medium/fps.png) · [Dopo](C:/Users/niluf.PC-NIKO/Desktop/Ricchioni/docs/agent-work/graphics-performance/after-2-medium/fps.png).
- **Cornicione**: Rilievo delle finestre e finitura di facciate e tetto. [Prima](C:/Users/niluf.PC-NIKO/Desktop/Ricchioni/docs/agent-work/graphics-performance/before-2-medium/cornicione.png) · [Dopo](C:/Users/niluf.PC-NIKO/Desktop/Ricchioni/docs/agent-work/graphics-performance/after-2-medium/cornicione.png).
- **Casa Carbo**: Pavimenti in legno e fughe delle piastrelle; note delle abilità leggibili. [Prima](C:/Users/niluf.PC-NIKO/Desktop/Ricchioni/docs/agent-work/graphics-performance/before-2-medium/casacarbo.png) · [Dopo](C:/Users/niluf.PC-NIKO/Desktop/Ricchioni/docs/agent-work/graphics-performance/after-2-medium-fixed/casacarbo.png).
- **Minigolf**: Finitura e strisce del tappeto senza nuove texture GPU. [Prima](C:/Users/niluf.PC-NIKO/Desktop/Ricchioni/docs/agent-work/graphics-performance/before-2-medium/minigolf.png) · [Dopo](C:/Users/niluf.PC-NIKO/Desktop/Ricchioni/docs/agent-work/graphics-performance/after-2-medium/minigolf.png).
- **Geofall**: Caselle con gradiente, bordo interno e numeri su targhette contrastate. [Prima](C:/Users/niluf.PC-NIKO/Desktop/Ricchioni/docs/agent-work/graphics-performance/before-2-medium/geofall.png) · [Dopo](C:/Users/niluf.PC-NIKO/Desktop/Ricchioni/docs/agent-work/graphics-performance/after-2-medium-fixed/geofall.png).
- **Backrooms**: Rilievo delle piastrelle del soffitto e targhe usurate; atmosfera e luci originali. [Prima](C:/Users/niluf.PC-NIKO/Desktop/Ricchioni/docs/agent-work/graphics-performance/before-2-medium/backrooms.png) · [Dopo](C:/Users/niluf.PC-NIKO/Desktop/Ricchioni/docs/agent-work/graphics-performance/after-2-medium/backrooms.png).

## Limiti e tracciabilità

Le misure riguardano questa GPU e scene iniziali con giocatori fermi e personaggi/ambiente in aggiornamento, non una prova su tutti i dispositivi o con il massimo degli effetti durante una partita. Il telefono è emulato su Chrome desktop; gli FPS di uno smartphone fisico non sono misurati. Le decorazioni mantengono il costo di rendering originale; la preparazione delle texture contiene qualche operazione statica aggiuntiva. Nessun incremento FPS è attribuito alla sola grafica: carico del sistema e warm-up hanno influito sui primi campioni.

Baseline sorgenti: commit 6fe755a90ce678ad47fd9fdf5b239957a0095733, copia temporanea indicata in baseline-path.txt. Un commit esterno 38751fc ha incluso alcuni artefatti durante il lavoro, senza differenze ai sorgenti rispetto alla baseline; preservato. Implementazione diretta Sol autorizzata dall'utente dopo HTTP 402 di Flash/DeepSeek; nessun cambio automatico di provider.

Gli screenshot, i risultati JSON e [il confronto completo](C:/Users/niluf.PC-NIKO/Desktop/Ricchioni/docs/agent-work/graphics-performance/comparison.json) sono in questa cartella. [Log build](C:/Users/niluf.PC-NIKO/Desktop/Ricchioni/docs/agent-work/graphics-performance/build-final.log). Server di baseline 5174 fermato; anteprima corrente locale su 5173 e server 3001. Nessun commit, push o deploy eseguito dal root.

Pannelli con cinque giocatori: [Kart](C:/Users/niluf.PC-NIKO/Desktop/Ricchioni/docs/agent-work/graphics-performance/after-5-low-fixed/kart3d.png) · [Casa Carbo](C:/Users/niluf.PC-NIKO/Desktop/Ricchioni/docs/agent-work/graphics-performance/after-5-low-fixed/casacarbo.png).
