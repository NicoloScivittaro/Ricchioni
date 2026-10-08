# Performance measurements

Local DEV, Chrome headless, 1280×720. Hardware run: ANGLE Direct3D11, NVIDIA GeForce RTX 3050. Software run: ANGLE Vulkan SwiftShader, kept separate. Original 4096 texture and original geometry, no compression or generated LOD. Draw calls are per frame from SceneInstrumentation, not the engine cumulative counter. Frame interval includes scheduling/GPU waits; SceneInstrumentation frame CPU time has a narrower scope.


## RTX 3050 — Gallery 1 / 2 / 5

| Gallery | Frame rolling mean ms | FPS mean | Draw calls mean | Sampler CPU mean ms | Skeletons | Active mapped tracks | Original triangles |
|---|---|---|---|---|---|---|---|
| 1-old | 18.73 | 59.93 | 28.00 | 0.000 | 0 | 0 | legacy geometry |
| 1-new | 16.71 | 59.94 | 3.00 | 0.100 | 1 | 195 | 35624 |
| 2-old | 16.75 | 59.95 | 55.00 | 0.000 | 0 | 0 | legacy geometry |
| 2-new | 16.85 | 59.94 | 5.00 | 0.193 | 2 | 390 | 71248 |
| 5-old | 16.92 | 59.94 | 136.00 | 0.000 | 0 | 0 | legacy geometry |
| 5-new | 17.10 | 59.94 | 11.00 | 0.422 | 5 | 975 | 178120 |

## SwiftShader — Gallery 1 / 2 / 5

| Gallery | Frame rolling mean ms | FPS mean | Draw calls mean | Sampler CPU mean ms | Skeletons | Active mapped tracks | Original triangles |
|---|---|---|---|---|---|---|---|
| 1-old | 171.02 | 7.12 | 28.00 | 0.000 | 0 | 0 | legacy geometry |
| 1-new | 161.48 | 5.93 | 3.00 | 0.200 | 1 | 195 | 35624 |
| 2-old | 157.50 | 7.09 | 55.00 | 0.000 | 0 | 0 | legacy geometry |
| 2-new | 162.68 | 5.10 | 5.00 | 0.413 | 2 | 390 | 71248 |
| 5-old | 165.08 | 6.10 | 136.00 | 0.000 | 0 | 0 | legacy geometry |
| 5-new | 174.66 | 4.06 | 11.00 | 1.617 | 5 | 975 | 178120 |

## RTX 3050 — real game scenes, five actors


| Context (5 Goblins) | Frame interval mean / p95 ms | Scene CPU mean ms | Render CPU mean ms | Draw calls mean | Sampler mean ms | Skeleton.prepare mean ms | Skeletons | Active tracks | Scene materials / textures |
|---|---|---|---|---|---|---|---|---|---|
| cornicione-old | 16.71 / 17.40 | 7.13 | 2.97 | 317.00 | 0.000 | 0.000 | 0 | 0 | 115 / 39 |
| arena-old | 16.69 / 16.90 | 6.58 | 2.48 | 312.00 | 0.000 | 0.000 | 0 | 0 | 87 / 32 |
| dodgeball-old | 16.72 / 18.30 | 7.91 | 2.99 | 341.00 | 0.000 | 0.000 | 0 | 0 | 94 / 34 |
| fps-old | 16.68 / 16.90 | 7.01 | 0.41 | 245.00 | 0.000 | 0.000 | 0 | 0 | 131 / 22 |
| cornicione-new | 16.67 / 19.90 | 5.00 | 1.03 | 67.00 | 0.549 | 0.706 | 5 | 975 | 116 / 46 |
| arena-new | 16.68 / 17.10 | 5.09 | 1.03 | 62.00 | 0.537 | 0.597 | 5 | 975 | 88 / 39 |
| dodgeball-new | 17.15 / 17.30 | 5.42 | 1.21 | 91.00 | 0.497 | 0.649 | 5 | 975 | 95 / 41 |
| fps-new | 16.68 / 17.30 | 8.43 | 0.45 | 165.00 | 0.583 | 1.063 | 5 | 975 | 132 / 29 |

## SwiftShader — real game scenes, five actors


| Context (5 Goblins) | Frame interval mean / p95 ms | Scene CPU mean ms | Render CPU mean ms | Draw calls mean | Sampler mean ms | Skeleton.prepare mean ms | Skeletons | Active tracks | Scene materials / textures |
|---|---|---|---|---|---|---|---|---|---|
| cornicione-old | 195.12 / 306.00 | 15.14 | 7.27 | 159.00 | 0.000 | 0.000 | 0 | 0 | 115 / 39 |
| arena-old | 192.86 / 253.50 | 17.36 | 10.39 | 155.00 | 0.000 | 0.000 | 0 | 0 | 86 / 32 |
| dodgeball-old | 186.62 / 268.70 | 16.74 | 10.39 | 169.00 | 0.000 | 0.000 | 0 | 0 | 94 / 34 |
| fps-old | 179.33 / 252.40 | 19.03 | 1.90 | 245.00 | 0.000 | 0.000 | 0 | 0 | 131 / 22 |
| cornicione-new | 212.99 / 348.30 | 19.52 | 5.08 | 34.00 | 0.849 | 2.466 | 5 | 975 | 116 / 46 |
| arena-new | 229.70 / 266.60 | 5.24 | 2.52 | 30.00 | 0.566 | 1.734 | 5 | 975 | 87 / 39 |
| dodgeball-new | 208.85 / 261.30 | 5.42 | 1.91 | 44.00 | 0.386 | 3.680 | 5 | 975 | 95 / 41 |
| fps-new | 282.68 / 323.50 | 13.21 | 3.15 | 165.00 | 0.780 | 1.249 | 5 | 975 | 132 / 29 |

Each Tripo instance: 35,624 triangles, 33,613 vertices, 65 bones, 195 sampled tracks; five actors: 178,120 unique triangles, 325 bones, 975 active tracks. FPS renders visible actors per viewport, so submitted triangle count depends on masks/frustum and may exceed unique geometry.

One shared original base-color texture per scene: estimated RGBA8 64 MiB, ~85.33 MiB with a full mip chain. This is an estimate, not queried driver allocation. Geometry and material are shared; skeletons and controller state are independent. Asset download: 9,302,908 bytes.

Skeleton.prepare timing, when present in raw data, wraps actual prepare calls in the test only and sums them per engine frame. It includes transform/matrix work, not isolated GPU skinning. Sampler timings exclude skeleton.prepare. Mesh/material totals include retained hidden legacy fallback, HUD, world and effects. All 36 animation groups remain instance-owned data; only the chosen 195 tracks are evaluated.

Hardware contexts sustain about 60 FPS at this resolution in the loaded steady scenes. Five-viewport FPS is measured with actual camera masks. These are not five humans fighting/shooting simultaneously with maximum VFX. Auto-quality remains the existing game policy; the tests do not pin every quality/resolution mode. Gallery frameMsAvg is a rolling window that includes startup/import warm-up, whereas the contextual dt samples are measured after loading. VSync near 60 FPS hides spare GPU headroom.

SwiftShader does not meet a normal gameplay frame budget and is not evidence of RTX performance. Before definitive replacement, measure an active five-player session at the launch display resolution and quality, and inspect contact readability. No 2048/1024 variants were generated or compared; no destructive optimization was performed.