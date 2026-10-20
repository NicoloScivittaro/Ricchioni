# Party home / game picker / roulette

Direct implementation following the persistent direct-Sol preference. No Flash, commit, push or deploy.
Preserve existing Backrooms/Minigolf work. Scope: three menu scenes, scoped menu UI/art helpers and scoped pad menu consumer; pairing panel B-close only.

Design: midnight background, mint/gold accents, bold editorial type, code-native game illustrations; featured game + horizontal cards + accessible catalog; QR and ready states retained. Mouse/touch/keyboard and Xbox/PlayStation menu navigation. Rullo uses same authoritative server pick, order/bag and animation durations; no selection/gameplay/server rule changes.
Input contract: one navigator.getGamepads owner (GamepadManager); scene-scoped menu capture with release suppression and directional repeat. Existing pairing, vote, controls and gameplay routing resume when menu capture ends. Open pairing dialog gets input priority and can close on B/circle.
Acceptance: typecheck/build; 720p/1080p visual checks; mouse and simulated Xbox/DualSense home->room->catalog->selection, ready gate and roulette skip; held-key/scene-transition suppression, pairing and map-vote/gameplay input regression. Few targeted checks, no full minigame reruns.
