# Human-only gameplay views

Solo human: one full-screen camera. Two to five humans: one camera/HUD per human in roster order, excluding bots even when interleaved. Human selection independent of pad vs phone. Keep every participant in simulation, world, scoring and bot AI. Shared-camera games remain shared-camera games (minigolf bot turns remain watchable).

Use one lightweight pure selection/layout module across Orda, Backrooms, FPS and kart. Preserve camera subjects, avatar masks, jumpscares, sound panning and phone behavior by identity rather than participant index. Avoid creating bot-only render resources. Extra FPS work: remove unused picking, avoid allocating layout rectangles each frame, skip hidden cosmetic processing where safe. No visual-quality/resolution cuts or simulation changes.

Validation: selection/layout cases 1–5 humans and interleaved bot roster; actual renderer solo, mixed multiplayer and five-human checks; short equivalent-resolution before/after Orda renderer benchmark; typecheck/build once; preserve historical local galleries after build. No commit/staging/push/deploy.

Root is gpt-6.1-sol per static doctor; native delegation requires Astra and prior user explicitly selected Sol. Direct single-agent implementation; no worker request.
