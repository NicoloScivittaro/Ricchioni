# Human-only gameplay views

Working repo: `C:/Users/niluf.PC-NIKO/Desktop/Ricchioni`; HEAD `e97bf0a`. Pre-existing dirty content is captured in `baseline/`; none was reverted. No staging/commit/push/deploy.

Implementation and root diff review complete: human camera selection shared across Orda, Backrooms, Sparatoria and kart; existing shared-camera minigames unchanged. All five participants stay in simulation/world/results. Backrooms uses separate human viewport indices and full roster avatar indices; bot captures do not allocate scare rigs; spectator selection follows humans. Orda removes unused solo own-avatar render actor and bot camera/viewmodel/HUD resources. Cached layouts and unused picking removal preserve graphics.

Passed: pure selection/layout cases 1–5; typecheck; nine real-renderer scenarios (Backrooms/FPS/kart × 1/3/5 humans) including interleaved bots, avatar masks, capture/scare ownership, human spectator target and resize. Two representative visual cases refreshed after fixture camera/weapon settling and inspected. Orda solo six-second same-resolution sample passed at 59.97 FPS vs baseline five-view 36.80 FPS. No full network/AI benchmark claim.

Build passed (3m46s). Remaining Orda samples passed: 3 humans59.28FPS;5humans35.68FPS (baseline5views36.80FPS, approximately stable; no five-human improvement claimed). All compared at1669×939,RTX3050,22animated enemies,5participants,six-second renderer samples. Solo59.97FPS. Finalizer passed and preserved prior galleries. Local result: http://localhost:3012/human-views/ . Root accepted implementation after actual baseline diff and evidence review. No source edits after final build.

No children were spawned. Static routing doctor observed root Sol; explicit previous Sol preference retained using skill's single-agent exception, without changing models or making a routed request.
