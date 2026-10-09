# Solo bots

User-authorized root implementation without Flash (prior credit exhaustion); no delegation. Baseline git status clean.

Contract: starting with exactly one connected, ready human fills the selected 2–5 seats with clearly marked bots and unique available characters. Two or more humans retain existing multiplayer behavior. Bots are server-created participants, never sockets or reconnect tokens. Scores, abilities, collisions, victory and round flow use existing rules. Restart removes bots and releases their characters. Human disconnection never creates a replacement.

Dependency order: public bot metadata/server/lobby -> shared input AI and per-game hooks for all twelve enabled games -> lifecycle/camera fixes -> server, simulation and browser verification -> report. Existing Cornicione and Casa Carbo input bots are reused. AI only advances inside unpaused simulation, writes bot IDs only, uses its own RNG, and never edits positions, damage or results. Tripo selection is unchanged.

Acceptance: one human can start; zero/unready/offline cannot; 2–5 total participants; no duplication; multiplayer unchanged; bots act in every enabled game, respect obstacles and imperfect thinking delays, pause with game, survive round changes and contribute normal results; no bot viewports/gamepad slots. Restart enables real friends to join. No auto commit, push or deploy.
