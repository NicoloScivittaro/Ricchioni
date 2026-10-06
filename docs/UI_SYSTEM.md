# UI — design system

Un solo sistema per TV (Phaser + Babylon GUI + DOM) e telefono. Codice:

| File | Cosa |
|---|---|
| `src/core/uiTokens.ts` | token: font, scala tipografica, spaziature, raggi, colori di stato, contorno/ombra, movimento, squadre, SAFE AREA |
| `src/core/uiPhaser.ts` | TV 2D: `displayText`, `infoText`, `uiPanel`, `pill`, `announce`, `PlayerBadge`, `badgeRow`, `badgeColumns`, `phaseStepper` |
| `src/minigames/hud/hudKit.ts` | HUD 3D: chip del gioco, stato a destra, barra squadre, countdown, annuncio, feed, striscia giocatori |
| `src/core/uiDom.ts` | DOM della TV: card, tasti, toast, avvisi (controlli, controller, errori) |
| `src/dev/uiGallery.ts` | galleria `?ui=1` (solo dev / `?debug=1`) |

## Tipografia

- **DISPLAY** (`Arial Black` → `Segoe UI Black`…): titoli, annunci, numeri, nomi.
- **BODY** (`Segoe UI` / `system-ui`…), in grassetto sulla TV: spiegazioni, stato, controlli.
- Scala (px a 1280×720): XXL 132 · XL 64 · L 40 · M 28 · S 20 · XS 16. **Mai sotto 14** (verificato da `ui-selftest`).
- Testi Phaser nitidi: risoluzione 1 (720p), 2 (1080p/1440p), 3 (4K) — solo i testi, mai il canvas intero.

## Spazio

- SAFE AREA: 48 px ai lati, 32 sopra/sotto (coordinate di progetto). Niente testo fuori.
- Spaziature a passi di 8. Raggi: 8 / 14 / 22.
- Una sola cosa grande per schermata.

## Pannelli e colori

- Pannello: fondo `#111426` al 88%, bordo sottile; bordo d'accento per la cosa importante.
- Stato: **oro** = adesso/importante · **verde** = successo/fatto · **ambra** = avviso · **rosso** = errore/fuori.
- Squadre: colore + PAROLA + SIMBOLO (`ROSSI ▲` / `● BLU`). Nei giochi a squadre il colore della squadra vince su quello del personaggio.
- Stato del giocatore mai solo a colore: `✅ FATTO`, `💀 FUORI`, `⚠ OFFLINE`, scheda spenta.

## Movimento (ms)

ENTER 220 · EXIT 160 · SUCCESS 280 · WARNING 200 · REVEAL 320 · WINNER 350 · PULSE 420. Scatti da game-show,
nessuna animazione aggiunge tempo alla sessione (si usano le finestre gia' esistenti).

## Badge giocatore

`[RITRATTO] NOME  valore / stato` — lo stesso componente in stanza, rullo, Memoria, Botta al Volo, Quiz, HUD 3D
(striscia), risultati e classifiche. Nomi lunghi: si riducono, poi si accorciano con "…", mai fuori dalla scheda.
