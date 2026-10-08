# man.glb — checkpoint

8 ottobre 2026, integrazione pilota conclusa. Repo effettivo: `C:/Users/niluf.PC-NIKO/Desktop/Ricchioni`.

- Richiesta utente: `man+3d+model.glb`, «metti».
- L'utente ha corretto esplicitamente l'identità: **Ciro, non Dottore**. Tutti i collegamenti, namespace clip, selettori DEV e test ora usano Ciro. Dottore conserva corpo e gameplay originali.
- Root senza Flash secondo autorizzazione già presente; nessun worker avviato.
- Asset originale copiato in `public/models/man-tripo/man.glb`, SHA256 `f4a5bd9c74526faa625902b0b43f3bccaebaf2ee0ae648e9d6fd73ade651abe5`; copia dist identica.
- 34.334 triangoli / 29.981 vertici / 65 bones / 46 clip da 195 canali / tre texture 4K. Nessuna compressione, LOD o retarget.
- Nuovi profilo/manifest/selettore: `ciroProfile.ts`, `ciroClips.json`, `ciroVisualMode.ts`.
- Gallery CIRO LEGACY/TRIPO + Animation Lab; quattro import insieme; readonly renderer in Arena/Cornicione/Dodgeball/FPS/Results. Kart Legacy e 2D originali. Gameplay invariato.
- Stessa skin nelle fasi di salto e nelle 14 mosse. Gesti senza clip dedicata conservano il corpo nuovo. Legacy default/fallback su errore.
- PASS dopo la correzione: audit statico, controller Ciro 98, 46 preview/mixed assets/Dottore Legacy/5 rig/results GLB Ciro/disposal, salto 86 campioni, quattro contesti OLD/NEW, fallback, TypeScript/build, gate produzione. Verifiche precedenti sull'asset e regressioni condivise: asset Babylon 46 clip + skin finita, Goblin 135 controlli, salti Judoka 72 e Buttafuori 86 campioni.
- Vite già attivo `http://127.0.0.1:5174/`; server 3001 preesistente preservato. Nessun commit/push/deploy.
- Report completo `REPORT.md`, screenshot `e2e-shots/man-character/`.
