# Buttafuori — animazioni completate

8 ottobre 2026. Repository effettivo: `C:/Users/niluf.PC-NIKO/Desktop/Ricchioni`.

- Richiesta: aggiungere le animazioni da `detailed+character+3d+model (2).glb` al Buttafuori già integrato.
- Autorizzazione a continuare con il root senza Flash rispettata; nessuna delega, commit, push o deploy.
- Nuovo GLB copiato byte per byte in `public/models/detailed-tripo/detailed_character_animated.glb`; originale non animato conservato.
- 43 clip originali / 65 bones / 195 canali per clip. Geometria, texture, inverse bind e bind pose identici al modello precedente.
- `buttafuoriClips.json`: tutti i 43 originali previewabili più alias esplicito hitStomach→hitBodyB; calcio Candidate solo preview.
- Profilo usa il sampler nativo, non il backend procedurale. Ability focus render→block; gameplay originale.
- Buttafuori mantiene sempre il corpo importato nelle azioni/salti, anche dopo aver disattivato il flag procedural. Legacy resta default e fallback al fallimento.
- Gallery ha ANIMATION LAB e `buttafuoriPreview`; Arena/Cornicione/Dodgeball/FPS/Results usano il profilo aggiornato; Kart Legacy invariato.
- PASS: TypeScript/build, 44 preview, cinque rig e tre asset misti, 86 campioni salto/14 mosse, controller Buttafuori 96, Goblin 135, Judoka salto 72, quattro contesti a cinque giocatori, fallback e gate produzione.
- Screenshot e dati in `e2e-shots/buttafuori-animations/` e nella presente cartella. Report finale: `REPORT.md`.
- Vite locale `http://127.0.0.1:5174/`, sessione preesistente 78530; server 3001 preesistente preservato.
- Nessuno swap definitivo/LOD/compressione. Lavoro concluso per questa richiesta.
