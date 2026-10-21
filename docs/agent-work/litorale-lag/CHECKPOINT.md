# Litorale lag fix

Direct Sol run. No agents, commit, push or deploy. Preserve the earlier pending bot/catalog changes.

Accepted source scope: `BabylonKartGame.ts`, `kartEntity.ts`, `kartCoachwork.ts`.
Pilot readiness before countdown + hidden loading rendering capped at 10 Hz; 2→1 wheel passes only on Litorale; coastal HUD refresh capped at 30 Hz with accumulated elapsed time, cameras/physics full rate.

Geometry selftest passed; delayed-loading/fallback/dispose/HUD timing browser checks passed. Full-HD/5-view sample: 44.15→57.67 FPS, native HIGH/scale 1/RTX3050. Same total vertex count. Before/after screenshots reviewed.

First final build passed (3m56s), compiled five-player match and pause/room cleanup passed. Product path revealed auto-quality should start after hidden loading; that correction is now applied and all loading/fallback/dispose/HUD checks reran successfully, including native HIGH resolution at readiness.

Second/final build passed (3m34s, including typecheck). Final compiled five-player check passed: native scale=1, all four imported drivers ready, five cameras, actual map voting, throttle, pause and room cleanup; no console errors or failed requests. Final report/galleries are restored by `scripts/litorale-finalize.py`. Backend 3012 remains running. Task-owned Vite 5191 can be stopped. No required implementation or validation remains; no source changes pending for this task.
