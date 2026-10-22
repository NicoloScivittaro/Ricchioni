# Ferro e Furia 2.1 — scontro direzionale

Nessun commit, push o deploy. Arena, round, punteggi, armi, statistiche, telecamera e gestione controller invariati.

## Principio
La logica decide, la grafica rappresenta. `resolve()` (`shared/ferro/match.ts`) applica le regole di sempre (stesso parry da 130 ms, stessa riduzione del danno in guardia, stessa stamina) e in più scrive su entrambi i guerrieri uno stato `clash` (`block`, `blocked`, `parry`, `parried`, `hurt`, `break`) con direzione, potenza e punto di contatto fra le lame. Il renderer lo legge e basta: se un effetto non parte, la partita non cambia.

## Cosa è cambiato
- **Impugnature** — calibrazione per singolo modello (`GRIPS` in `FerroAssets.ts`: asse, verso, centro del manico, filo). `victory.glb` era normalizzata capovolta (lama sotto l'origine): ora è impugnata dall'elsa e ha di nuovo i suoi colori (`KHR_materials_specular`). Nessuno stiramento dell'arma: la guardia prima la accorciava fino al 50%. Il pugno si chiude sul manico (nocche a 1,6–1,9 cm dall'asse), il filo di asce e martello guida il colpo.
- **Guardia** — pose reali alto/sinistra/destra per spada, scudo, lancia, ascia, martello, doppie lame, a lunghezza piena e alzate sopra la testa di ciascun corpo. Indicatore a triangolo rovesciato (lati ALTO/SINISTRA/DESTRA): guardia = lato spesso; attacco in arrivo = lato rosso pulsante con freccia verso il centro; finestra di parry = barra gialla tremolante negli ultimi 130 ms prima del contatto *previsto*; blocco = lampo bianco; parry = esplosione dorata; guardia sbagliata = lato rosso spezzato. Il triangolo dell'avversario sta sopra la sua testa, specchiato nel tuo verso d'attacco.
- **Scontro** — blocco: la lama si ferma sul punto di contatto, rimbalza (più le armi leggere, meno l'ascia; il martello spinge di più), il difensore assorbe e torna in guardia; nessun altro bersaglio può essere colpito da quel fendente. Parry: la spada del difensore spazza, quella dell'attaccante viene scagliata fuori linea (≈3,7× lo spostamento di un blocco) e il corpo arretra; contrattacco aperto. Scintille, lampo additivo, scossa breve della sola camera (nessun rallentamento), suoni sintetici per coppia di materiali (acciaio, scudo, asta, martello) e uno dedicato al parry. Reazioni 0,2–0,4 s.
- **Asce** — `axe.glb` (9,4 → 0,9 MB, texture 1024) e `volcanic.glb` (5,6 → 2,0 MB, lava emissiva originale) come varianti estetiche di ASCIA con il tasto Y, statistiche identiche. Crediti CC BY 4.0 in `public/assets/ferro2/CREDITS.json` e `src/minigames/ferro/CREDITS.md`.
- **BOT BOSCHI** — vede il colpo solo quando parte, reagisce dopo 0,17–0,34 s, a volte sbaglia lato, tenta il parry con errore umano solo quando fa in tempo, punisce i colpi a vuoto, alterna leggeri/pesanti, usa finte, attacca il lato scoperto, impara la direzione preferita del giocatore (e una finta lo inganna); sotto 30 di stamina smette di attaccare e arretra finché non torna sopra 60.
- **Bug corretto** — l'affondo leggero della lancia da destra non poteva mai colpire (la punta correva parallela al bersaglio).
- **Avviso focus** — stesso comportamento, testo su una riga, più piccolo e in basso (510×25 px invece di 640×77).

## Prove eseguite
| Prova | Esito |
|---|---|
| `npx tsc --noEmit` | ok |
| `scripts/ferro-selftest.ts`, `scripts/ferro2-selftest.ts` (regole esistenti) | ok, invariati |
| `scripts/ferro21-selftest.ts` | ok: 18 blocchi corretti (3 direzioni × 6 coppie d'armi) con danno identico al precedente; guardia sbagliata = danno pieno; parry; colpo mancato senza reazioni; tempi invariati; guardie a lunghezza piena; bot |
| `scripts/e2e/ferro21-grip.mjs`, `ferro21-hands.mjs` | ok: 12 armi/varianti × 7 pose, pugno sul manico |
| `scripts/e2e/ferro21-clash.mjs` | ok: blocco alto → parry → contrattacco a segno; guardia sbagliata; colpo mancato. Video `clash-side.mp4`, `clash-views.mp4`, `wrong-guard-and-miss.mp4` |
| `scripts/e2e/ferro21-duel.mjs` | ok: 20 s contro BOT BOSCHI con render reale (vita finale 286 vs 277 su 400; il bot attacca 6 volte, para 2, fa 2 parry e 1 finta, cambia guardia 22 volte); cinque visuali con indicatori dentro la propria vista |

Bot contro 90 pesanti (spada, ascia, martello): lato giusto 76, blocchi 49, parry 14, colpi puliti subiti 26; si adatta agli attacchi alti 29/30, la finta lo inganna 26/30.

## Da valutare nel playtest
- Un colpo **parato** applica ancora il piccolo stordimento della regola precedente (0,12 s): la guardia cade per un istante. Non l'ho tolto perché è una regola di bilanciamento.
- I leggeri caricano in 0,15 s: non si reagiscono a vista (né umani né bot), si parano solo con la guardia già giusta.
- I fendenti laterali del martello colpiscono solo intorno ai 2,4 m (regola esistente).
- Nessuna prova con controller fisici né con audio ascoltato su casse.
