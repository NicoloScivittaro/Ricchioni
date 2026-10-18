# Checkpoint
Baseline 8d644d9. User explicitly: no Flash, commit, push, deploy or new heavy dependencies. Direct root work.

Implemented: 1305.66m circuit (was738.37), same3laps,230s cap, banked/elevated ribbon with ramp humps, jumps, moving cargo swept collider, wet port, narrow express/safe split, deck/piers/lights/signs, geometry-aware camera/sectorHUD, presentation separated from120Hzphysics, glow emitter filtering/static batching, timeout rank fix.

Passed: typecheck; 24 complete real-physics/dynamics/bot/collision races2–5at30/60/120;13items,oil,contact,5abilities;Geofall48botmatches,Backrooms41groups,Minigolf40botrounds;padprofiles,solo-bots,rounds60checks. Baseline duration and before/after comparison saved. First after perf5views34.57 vs28.47fps,843vs1106draw,scaling1/shadows unchanged. Later shoreline/glow refinements need final paired sample.

Browser gamepad-kart first main failed due stale fixture shell (invalid currentitemID) and drift fixture only re-centering lateral without heading; fixed fixture to sfera and aligned heading at each sample without resetting charge. Split subtests2,3,4,5allpassed. Main-only rerun now started.

Next: complete main-only pad rerun, run scripts/e2e/ribaltati-2.mjs (2,4,5 clients, pause/rejoin, section screenshots, full unaccelerated5-driver race), build (can overlap custom browser, no FPS sampled there), then final5view/1view perf and compiled smoke. Review visual artifacts. Restore only Vite-generated tracked node_modules/.vite/deps/_metadata.json to baseline after closing Vite. Leave user source edits and tracked dist/index.html coherent. Report completed/pending checks accurately.

Own servers: backend3006 session37144; Vite5178 session7280. Do not touch other servers. No active children. Final preview local only; no deployment.

## Final QA update
All code now final, including continuous median/body-footprint collision and slope-aligned instances, plus two-sided surface marking materials (verified screenshots show bright express/ramp/warning paints). No further source changes planned.
- Main-only gamepad rerun session19209 exited0; prior split2–5 checks all passed.
- Custom all-count browser92787 passed, full natural race repeated99218 passed after median correction; source-only visual confirmation32306 passed after material flag fix. Camera audit15255samples0bad,29launches, about100wallseconds; natural-race.json contains final results.
- Final dynamics13204:24complete races passed; camera336passed; all earlier item/ability/regression suites passed.
- Build25441passed; superseded build31850was stopped deliberately for final visual material fix. Final build53627 running.
- Next: wait53627, run ribaltati-performance.mjs final5humans phaseafter, then PERF_HUMANS=1 phaseafter-one-view (same5participants), then ribaltati-production.mjs compiled smoke. Avoid other GPU jobs during FPS samples. Review/report values honestly.
- Own backend3006 session37144; Vite5178 session7280. At finish close Vite, restore ONLY our generated tracked node_modules/.vite/deps/_metadata.json from captured baseline8d644d9 if still sole cache diff, leave compiled local preview server3006 available (restart own server to clear test rooms). Do not commit/push/deploy.

## Completato
Final build53627 passed3m22s. Final perf9265 passed:5views35.016fps vs28.471baseline,795drawvs1106;1view59.939fps;1280x720scale1shadowsHIGH,RTX3050. Compiled smoke78415passed,1touchphone4bots230s,pause/lobbycleanup,noerrors. Vite7280closed; local compiled preview3006 remains. REPORT.md finalized. No commit/push/deploy.

Cleanup complete: Vite closed; generated metadata restored byte-for-byte from8d644d9 and index stat refreshed, now clean. Own backend restarted with no connected clients to remove abandoned test rooms; current preview3006 session90549, clean server. No source changes since final build.
