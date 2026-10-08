# Trim / speed / mapping

Ranges are runtime seconds (Babylon frames = seconds × 60). Original files are unchanged. Preview speed is selectable; gameplay uses the actual authoritative move duration. Attack contact is piecewise warped into startup + 35% of the existing active interval.

| Original | Internal | Source duration s | Used seconds / frames | Default effective s | Mean speed ratio | Contact source s | Loop |
|---|---|---|---|---|---|---|---|
| jump_down.001 | goblin.jumpDown | 3.708 | 0.417–1.250 / 25.0–75.0 | 0.833 | 1.00 | None | False |
| Stylized fighting game grab animation.  The character starts fr | goblin.grab | 2.958 | 0.792–2.500 / 47.5–150.0 | 1.708 | 1.00 | 1.3333 | False |
| hit_to_head.001 | goblin.hitHead | 1.833 | 0.042–1.750 / 2.5–105.0 | 0.280 | 6.10 | None | False |
| Fast stylized fighting game jab punch animation.  The character | goblin.jab | 2.958 | 0.500–2.250 / 30.0–135.0 | 0.230 | 7.61 | 1.0 | False |
| Stylized fighting game front kick animation.  The character sta | goblin.frontKick | 2.958 | 0.167–2.667 / 10.0–160.0 | 0.300 | 8.33 | 1.625 | False |
| Fast stylized fighting game forward dash animation.  The charac | goblin.dash | 2.958 | 0.583–2.708 / 35.0–162.5 | 0.300 | 7.08 | None | False |
| Stylized videogame object pickup animation.  The character star | goblin.pickup | 2.958 | 0.292–2.625 / 17.5–157.5 | 0.240 | 9.72 | 1.4167 | False |
| Stylized fighting game roundhouse kick animation.  The characte | goblin.roundhouse | 2.958 | 0.792–2.583 / 47.5–155.0 | 0.900 | 1.99 | 1.5 | False |
| Stylized fighting game uppercut animation.  The character start | goblin.uppercut | 2.958 | 0.083–1.917 / 5.0–115.0 | 0.310 | 5.91 | 0.5417 | False |
| Stylized videogame victory celebration for a competitive athlet | goblin.victory | 2.958 | 0.167–2.708 / 10.0–162.5 | 2.542 | 1.00 | None | False |
| Stylized fighting game judo throw animation.  The character beg | goblin.judoThrow | 2.958 | 0.167–2.625 / 10.0–157.5 | 2.458 | 1.00 | 0.7083 | False |
| Powerful stylized fighting game heavy haymaker punch animation. | goblin.heavy | 2.958 | 0.167–2.708 / 10.0–162.5 | 0.840 | 3.03 | 0.625 | False |
| idle.001 | goblin.idle | 15.333 | 0.042–15.375 / 2.5–922.5 | 15.333 | 1.00 | None | True |
| hit_to_side.001 | goblin.hitSide | 1.250 | 0.083–1.292 / 5.0–77.5 | 0.280 | 4.32 | None | False |
| jump.001 | goblin.jump | 2.208 | 0.042–0.708 / 2.5–42.5 | 0.667 | 1.00 | None | False |
| hit_to_body_02.001 | goblin.hitBodyB | 1.708 | 0.125–1.708 / 7.5–102.5 | 0.320 | 4.95 | None | False |
| Stylized fighting game heavy knockback animation.  The characte | goblin.knockback | 2.958 | 0.083–2.542 / 5.0–152.5 | 0.450 | 5.46 | 1.1667 | False |
| Stylized fighting game defensive block and counter stance anima | goblin.block | 2.958 | 0.375–2.375 / 22.5–142.5 | 2.000 | 1.00 | None | False |
| run.001 | goblin.run | 1.250 | 0.042–1.292 / 2.5–77.5 | 1.250 | 1.00 | None | True |
| hit_to_body_01.001 | goblin.hitBodyA | 1.292 | 0.042–1.333 / 2.5–80.0 | 0.280 | 4.61 | None | False |
| hit_to_stomach.001 | goblin.hitStomach | 1.542 | 0.042–1.583 / 2.5–95.0 | 0.320 | 4.82 | None | False |
| Stylized competitive dodgeball catch animation.  The character  | goblin.ballCatch | 2.958 | 0.667–2.750 / 40.0–165.0 | 0.260 | 8.01 | 1.4583 | False |
| Stylized videogame defeat animation for a competitive athletic  | goblin.defeat | 2.958 | 0.042–2.875 / 2.5–172.5 | 2.833 | 1.00 | None | False |
| fall.001 | goblin.fall | 3.000 | 0.250–0.875 / 15.0–52.5 | 0.625 | 1.00 | None | False |
| Stylized fighting game hook punch animation.  The character sta | goblin.hook | 2.958 | 0.500–2.333 / 30.0–140.0 | 0.310 | 5.91 | 0.9583 | False |
| Fast stylized fighting game dodge animation.  The character sta | goblin.dodge | 2.958 | 0.167–2.375 / 10.0–142.5 | 0.300 | 7.36 | None | False |
| Stylized competitive dodgeball overhand throw animation.  The c | goblin.ballThrow | 2.958 | 0.167–2.667 / 10.0–160.0 | 0.360 | 6.94 | 1.4167 | False |
| Stylized fighting game knockout animation.  The character recei | goblin.ko | 2.958 | 0.167–2.458 / 10.0–147.5 | 0.800 | 2.86 | 1.9167 | False |

Jump/fall use only their aerial segments; authored hips Y is suppressed while airborne. Idle/run loops have a 0.10 s seam blend. Victory/defeat play once and hold the tail. KO adapts to the existing 0.45 s FPS death presentation. Pickup/throw/catch events begin at the selected contact sample, with no blend delay. Contact candidates remain marked `contactVerified:false` until a manual art acceptance pass. Temporal alignment is automatically tested; anatomical reach and motion quality remain separate review criteria.