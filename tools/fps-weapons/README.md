# Asset Sparatoria

Preparazione locale: Blender 5.2, `blender --background --python tools/fps-weapons/prepare.py` dalla radice del repository. File di ingresso nei Download dell’utente; output `public/assets/fps/weapons`. Fonte e hash in `docs/agent-work/fps-weapons/assets.json`. Non richiede nuove dipendenze del gioco.

`preview.ts` e la pagina in `docs/agent-work/fps-weapons/preview.html` sono una vista di controllo Vite; `gallery.html` è invece statica e utilizzabile con la build. L’integrazione reale è in `fpsWeaponModels.ts`/`fpsViewmodel.ts`, non nella pagina di controllo.

Gli asset provengono dai file forniti dall’utente. La preparazione non attribuisce diritti di distribuzione; nessun caricamento esterno è stato effettuato.
