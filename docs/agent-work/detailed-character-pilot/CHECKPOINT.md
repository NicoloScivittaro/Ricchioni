# Buttafuori — checkpoint finale

Task completato come integrazione pilota, 8 ottobre 2026.

- Repository effettivo: `C:/Users/niluf.PC-NIKO/Desktop/Ricchioni`.
- Utente ha scelto esplicitamente **Buttafuori** per `detailed+character+3d+model (1).glb`.
- Autorizzazione preesistente a implementare con il root senza Flash rispettata; nessun nuovo worker.
- GLB originale copiato byte per byte; 31.399 triangoli, 28.141 vertici, 65 bones, 3 texture 4K, **0 clip**.
- Nuovi file: `buttafuoriProfile.ts`, `buttafuoriVisualMode.ts`, `proceduralSkinAnimator.ts`.
- Renderer condiviso permette zero clip solo per un profilo procedurale esplicito. Goblin e Judoka mantengono la validazione delle proprie animazioni.
- Gallery OLD/NEW + Pose Lab; Arena/Cornicione/Dodgeball/FPS/Results supportati; Kart conserva Legacy. Nessuna modifica gameplay.
- Stessa skin in salto/doppio salto/atterraggio e in tutte le 14 mosse; niente fallback temporaneo al vecchio corpo per azioni mancanti.
- Build/TypeScript PASS; integrazione, 86 campioni Cornicione, 5 istanze nei 4 contesti, fallback, gate produzione PASS. Goblin 135 controlli, Judoka salto 72 campioni PASS.
- Limiti: pose temporanee al bind, accessori integrati, assenza di animazioni dedicate/IK/posa arma/Kart; memoria texture stimata 256 MiB per scena con mipmap; silhouette più snella a hitbox invariata.
- Vite locale avviato su `http://127.0.0.1:5174/`, sessione exec 78530. Server 3001 preesistente non modificato.
- Modifiche preesistenti Goblin/Judoka preservate. Nessun commit, push o deploy.
- Report completo: `REPORT.md`. Non procedere allo swap definitivo o alle ottimizzazioni senza una nuova richiesta.
