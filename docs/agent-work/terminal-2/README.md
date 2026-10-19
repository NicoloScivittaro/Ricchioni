# Terminal 2.0 — preparazione locale

La conversione fedele originale `public/assets/fps/terminal/terminal.glb` rimane invariata e portabile. `terminal-play.glb` è una derivazione per il renderer Terminal: gli atlanti richiedono `terminalAtlasMaterial.ts`, non un visualizzatore glTF generico.

Pipeline, dalla radice del repository (Python numpy/Pillow già presenti, nessuna nuova dipendenza di gioco):

1. `python tools/terminal/prepare_arena.py --geometry-only` — selezione architettura/coperture, collider di tiro, rete multiquota del movimento, spawn validati. Esclude decorazioni/effetti e componenti isolate. Non usa tutti i triangoli come collider.
2. `python tools/terminal/optimize_atlas.py` — raggruppamenti di 16 m, atlanti con padding e UV ripetibili nello shader, fino a 1024 px per aereo/insegne e 512 px per le altre texture diffuse. Materiali sostitutivi espliciti nel report; geometria originale non ricostruita con cubi.
3. `npx tsx scripts/terminal-route-check.ts` — percorso essenziale dal livello inferiore alla cabina, verificato con il movimento autorevole.
4. `npm run build` — typecheck e build finale. Se la preparazione degli asset finisce durante la build, copiare gli asset Terminal aggiornati in `dist/assets/fps/terminal/`.

I test browser utilizzano i server di verifica locali 3012 e Vite 5185 (VITE_SERVER_URL=http://localhost:3012), senza interrompere il server preesistente 3008. `scripts/e2e/terminal.mjs` esegue la partita sintetica; gli altri due script Terminal servono alle sole verifiche mirate dopo correzioni. Non è necessario eseguirli tutti a ogni modifica.

Movimento: griglia di 0,4 m, raggio Terminal 0,28 m per i corridoi dell’aereo, passi fino a 0,52 m; layer sovrapposti e collisioni separati dal rendering. I piani bassi sotto gradini vengono scartati per evitare che il movimento scelga il pavimento sottostante. I colpi usano architettura e coperture selezionate con indice spaziale, mantenendo aperture reali. Limiti dell’arena visibili, originali di questa integrazione e condivisi con i collider.

Nessun commit, push, deploy o distribuzione degli asset. Vedere anche la provenienza/licenze in `tools/terminal/THIRD_PARTY.md` e il report precedente `docs/agent-work/terminal-conversion/REPORT.md`.
