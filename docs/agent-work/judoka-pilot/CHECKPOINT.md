# Judoka pilot — completato

2026-10-08. Workspace effettivo: `C:/Users/niluf.PC-NIKO/Desktop/Ricchioni`.

Richiesta: aggiungere `Downloads/judo+figure+3d+model.glb`. Root attuale autorizzato nella sessione a implementare senza Flash. Nessun nuovo agente, commit, push o deploy.

Asset originale copiato byte-identico in `public/models/judoka-tripo/judo_figure.glb`. 29.435 triangoli, 24.403 vertici, 65 bones, 37 clip, tre texture PBR 4096. Audit completo, 27 clip mappate, profilo distinto su renderer/sampler condiviso. Gallery, render Arena/Cornicione/Dodgeball/Calcio/Volley/FPS e risultati supportano il pilota `?judoka=new` in DEV/debug. Kart resta Legacy. Su richiesta dell'utente, salti e attacchi aerei mantengono sempre il corpo Tripo; salita in hold della posa aerea, discesa con fall, senza modificare fisica.

PASS: TypeScript/build, integrazione Judoka/risultati/disposal, scene reali OLD/NEW con cinque attori e FPS cinque viewport, controller Goblin 135, integrazione Goblin 76, Gallery 1366/1920, gate/import/switch sul bundle produzione. SHA256 sorgente/copia uguale; diff gameplay/server/input assente.

Correzione salto verificata con 72 frame reali del simulatore (jump.log/JSON): stessa mesh/materiali/skeleton visibile per salto, doppio salto, caduta, atterraggio e attacchi aerei; render non modifica lo stato fisico. Controller Goblin 135 PASS dopo la correzione.

Report: [REPORT.md](REPORT.md). Performance hardware breve registrata, non certificazione del picco di una partita; tre texture originali non ottimizzate. Contatti, posa arma, Kart e gesti sportivi restano da rivedere. Default e fallback Legacy mantenuti.

DEV lasciato disponibile: http://localhost:5174/?characters=1&judoka=new . Il server esistente sulla porta 3001 resta attivo. Stop dell'aggiunta pilota.
