# Backrooms: smarter creatures

Direct implementation; supplied request explicitly forbids Flash, commit, push and deploy.
Scope: existing Backrooms AI and its renderer state/animation adapter only. Preserve prior Minigolf and Backrooms work.

- Search several nearby branches from last genuine sight; prioritize observed direction, scan at stops, retain finite memory.
- Short interception only for visible movement with valid floor and LOS; never follow unseen player coordinates.
- Patrol recent-history avoidance, destination spacing and dark/party room preferences.
- Prioritize audible cues; allow fresh approximate noises to redirect a search without replacing visual memory.
- Partygoer waits at a room/junction, Smiler physically backs from a torch, navigation recovers from blocked corners.
- Essential focused rule tests + existing compact regression; one short five-view GPU sample and final typecheck/build. No repeated asset/audio/phone suites because those systems are unchanged.

User trailing “e” clarification requested asynchronously; no dependency on that answer for the AI improvements.
