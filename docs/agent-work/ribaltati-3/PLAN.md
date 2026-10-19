# Ribaltati 3.0 · 19 ottobre 2026

Baseline pulita: `3bbab91`. Esecuzione diretta, senza Flash, dipendenze, commit, push o deploy.

## Diagnosi prima delle modifiche

Scena Babylon condivisa, 5 UniversalCamera, GUI separata per viewport. HIGH, RTX 3050 D3D11, 1280×720, scaling 1, ombre attive: **36,187 FPS**, render 25,382 ms, 748 draw call, 399 mesh, 178 materiali. Nessuna build concorrente. Evidenza `before-performance.json` e 10 fotografie + dettaglio kart acquisite prima di modificare il gioco.

Carrozzeria e muso sono box, gomme cilindriche a 14 lati, mozzo piatto. Piloti Tripo caricati in modo asincrono con fallback; ruote e sterzo già animati, da preservare. Fumo/scintille/turbo sono già presenti ma mancano sospensioni e reazioni ai salti/atterraggi. Mondo statico batched per materiale e thin instances, spesso con bounds estesi all'intera pista. Tre luci, GlowLayer selettivo ma include superfici gialle molto luminose. Rampe bruciate dal glow, mare uniforme, pontile fotografato con orizzonte perso dietro la rampa. Checkpoint con traversa a 4,2 m: rischio concreto vicino alla camera. Cartelli feature a 7 m. Nessun video nel sottoinsieme di sorgenti/artifact esaminato.

13 oggetti: turbo/super turbo (boost FX), sfera (sfera emissiva), olio (chiazza), scudo (stato difensivo), disturbo (stato invertito), calamita (modello e tether), piccione (ali animate), difettoso (razzi), buca (disco), raffica (frecce), paraurti (gabbia), mollone (molla). Tutti hanno già cue audio. Migliorare riconoscibilità e feedback locale senza toccare pesi, durate o collisioni.

## Milestone

1. Diagnosi e baseline: acquisita.
2. Carrozzeria sagomata, ruote dettagliate, sospensioni e pilota riutilizzabili.
3. Materiali e dettagli coerenti per litorale, paese, porto, belvedere e paddock.
4. FX leggibili e audit dei 13 oggetti; durata boost, salto e impatto.
5. Rimozione occlusioni geometriche, camera, HUD e ultimo giro/arrivo locali.
6. Ottimizzazioni strutturali e confronto nello stesso carico, senza tagli nascosti al preset.
7. Test fisici/browser 2–5, regressioni, build, immagini e video reali, report con limiti.

Contratti: spline 1305,659 m/3 giri, fisica120Hz, vmax44/accel30, 13 item/5 abilità/input invariati. Rifinire bivio e gru esistenti; nessuna nuova scorciatoia o pericolo casuale. Misurare il risultato, non promettere 50 FPS.
