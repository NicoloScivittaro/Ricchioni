# Backrooms fixes — baseline 115874e (clean)

Follow the attached playtest spec; root implementation explicitly authorized without Flash.

Scope: Backrooms rules/render/audio/input, additive input press counter, tests/evidence. Preserve all other games, global mixer settings, skins, score/network/life rules. No dependencies, commits or deployment.

1. Repair input events across independently scheduled frames; camera-facing object anchors, actionable/blocked prompts, true witnessed hiding.
2. Separate visual snapshots and approximate noise areas; 105-degree type-configurable FOV, reaction latency, six requested states, contact + LOS + acquired-target capture. DEV-only sensory overlay.
3. Guard exact consecutive floor topology and numeric seed, deterministic explicit DEV seed; no regeneration on capture.
4. Audible midrange fluorescent bed through shared ambience bus, danger layer, differentiated actions/creatures; lifecycle-safe gesture unlock prompt and retry, preserving mute/volumes.
5. Tests: input brief/repeated/held/cleared/cancelled/substeps, sensory negative cases all types, generated maze series; native Chrome default autoplay with real gesture and post-limiter signal, phones/mocked pads, 2–5 complete rooms, typecheck/build and shared regressions. Capture screenshots, report physical listening/pads separately.
