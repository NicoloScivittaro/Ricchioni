# Accepted local result

Monster Expansion 1.2 complete. Prior Monster System work preserved; baseline snapshot/hashes retained locally. Main HEAD unchanged at 40a2376. No staging, commit, push or deployment; no added dependencies or Sparatoria/weapon registry changes.

Four GLBs: Warrok 13 clips (original geometry/skin/materials/eight clips preserved exactly), Zombiegirl 10, Yaku 11, Pumpkinhulk 10. Offline rest-space baking required by different package rest matrices; original archives/FBX unchanged. Shared MonsterAnimator extended with optional aliases, turns, taunt, Swipe and Jump Attack. One logical Warrok, visual normalization +20.75%, local HP/damage/hitbox increased.

Orda: seven focused logical groups pass; mixed real scheduler and advanced boss; single-hit attack windows, safe leap/landing/recovery and death priority. Existing last survivor rule and six ballistic paths retained. Backrooms: stronger pursuit/senses/search; existing runner/stalker use Zombiegirl/Yaku; no HP introduced, capture/lives/puzzle/escape remain. Turn-animation priority bug found and corrected; affected Backrooms capture check repeated successfully.

Final build (tsc + Vite) passed, 3m44s. Compiled-browser proof passed on localhost:3012 (production.json), including mixed wave, boss, actual airborne Yaku/landing/impact/recovery/death, both new Backrooms models and Swipe capture. No page errors. One development 6s sample: 48.6 FPS, RTX3050, five views, internal1669×939, 20–22 living enemies; harness replenished HP to1000 only to retain five cameras. Not repeated after capture-turn priority fix; not directly comparable to older lower-population samples.

Four screenshot gallery: http://localhost:3012/monster-expansion/. Existing galleries restored. Raw reports remain docs-only, no private specs or baseline copies copied into the gallery. New source provenance in public/assets/monsters/CREDITS.md; licenses remain unknown and require checking before publication. Warrok/Pumpkinhulk intentionally Orda-only for Backrooms clearance. No prolonged endurance or physical-pad test.
