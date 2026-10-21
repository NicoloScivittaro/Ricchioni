# Ferro e Furia — implementation contract

Approved source: REQUEST.md. Direct Sol execution; user explicitly forbids Flash. Repo Desktop/Ricchioni, initial HEAD96afe1e, clean tree. No commit/push/deploy, no modifications inside Arena/FPS/Backrooms/Orda modules.

Phases: (1) deterministic shared combat, geometry, seven weapon configs, round/scoring/tiebreak and fair bots; (2) original Colosseum renderer, registered-character procedural rigs with targeted articulated grip poses, third-person human-only cameras, seven original weapon models, pooled FX, selection/HUD/audio; (3) wrapper/profile/phone/input lifecycle and minimal catalog/narrator/art/server safety integration; (4) indispensable logic, actual two-player/five-view/phone and one six-second benchmark, typecheck/build and max4images.

Contracts: authoritative host fixed120Hz; same attack-pose sampler drives swept weapon collision and render. Damage only active windows, per-swing victim dedup, walls block, oriented guard and fresh130ms parry; stamina, dodge short iframes and recovery. Bow swept physical projectiles, gravity, charge/release,10arrows with regeneration, special pierces at most3targets and never walls. Specials: riposte after parry, spear charge, bow piercing, axe spin, hammer wave, twin offensive dash/two windows, shield bash. All100HP, no character-stat advantages. Visible timed symmetric flame vent event,90srounds then shrinking warning zone with damage over time.

Three scored rounds. Survival12points per placement step, win12extra, kills2; survival gap exceeds maximum kill bonus. Simultaneous damage resolves in one impact batch. Final double elimination replays a short duel among last victims; equal first-place match scores produce a proper contender-only tiebreak; never choose a winner by ID/RNG or server fallback. Existing ScoreManager consumes explicit final placements. No fixed match timeout can truncate an unresolved fair duel.

Seven weapons before every round, selectable independently by pad or phone, shared weapon allowed. Selection18s maximum or all ready; UI uses original SVG previews + stat bars. Same player IDs throughout. 1–5 human TV viewports; bots retain world actors/simulation only. Pause/blur/disconnect cancel bow draw without firing. Late phone state is keyed by server round ID. Scene dispose releases DOM/listeners/audio/engine.

Assets: original project procedural character DNA/rigs, original procedural weapons/arena textures and synthesized audio; no external asset download or unverified license. Existing imported Mixamo rigs have locomotion/fist gestures, no common authored seven-weapon combat set; do not label procedural animation as mocap/professional.


## Accepted subsequent scope

The user subsequently requested holding the game behind a loading bar until final models/textures are ready, and reducing Backrooms endurance. This supersedes the original no-edit restriction only for shared visual loading and the requested Backrooms sprint adjustment. Existing gameplay in FPS/Orda/Arena and the other modes is preserved. Scene-local asset attachment tracking, covered shader preparation and wrapper control gating address the early procedural fallback. All kart tracks wait for drivers; FPS/Orda warm weapon source caches without instantiating every weapon for every camera. Backrooms continuous sprint becomes4s instead of7s, full refill remains5s, restart threshold30%.

Acceptance evidence: logic.json, integration.json, visual.json (five cameras at1920x1080, six seconds), loading.json (delayed actual GLBs, timer0, canvas hidden, reveal after final actors), weapon-loading.json and stamina.json. Articulated procedural combat poses are explicitly documented; no claim of authored combat clips or physical-pad QA.
