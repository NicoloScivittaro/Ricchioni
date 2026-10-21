# FPS weapon pack 4.0

Direct Sol implementation, as explicitly requested; no delegation, commits or publication.
Baseline: clean checkout at e97bf0a (monster). Preserve all six existing weapon IDs and their statistics.

1. Inspect all four sources, author cameras, rigs, clip time ranges and licenses.
2. Implement and verify ACR controller, authored hands/fire/reload/locomotion and calibrated ADS first.
3. Integrate Glock with actual global timeline ranges; then shell-by-shell Remington; finally AK74U after identifying its clips visually.
4. Share authoritative insertion schedules across Sparatoria/Orda, with independent rigs per camera and hand-free world weapons.
5. Focused ammunition/damage tests, all 28 clips, ADS/reload visual checks, brief actual game smoke, one five-view sample, typecheck and final build.

Source defects found: six corrupt ACR magazine influences; Remington rigid geometry exported in a different unit scale, with shell away from its bind joint. Repairs affect derived copies only. Glock has absolute timeline offsets; its Idle is a constant pose. Remington has no Idle/Walk/Run clip: use its Shoot ready pose plus restrained procedural locomotion. AK Walk/Run are procedural; RELOAD2 includes bolt movement, OLSER visibly lowers/stows the gun.
