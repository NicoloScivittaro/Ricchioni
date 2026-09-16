# 🛠️ Development Tools

Utility scripts usati durante lo sviluppo del progetto. **Non fanno parte del gioco.**

## Script disponibili

### `check_syntax.sh`

Verifica che tutti i file `.js` in `src/` abbiano le graffe bilanciate (utile dopo modifiche manuali o patch veloci).

```bash
bash tools/check_syntax.sh
```

Output di esempio:
```
OK  src/scenes/LauncherScene.js   [424 lines]
OK  src/scenes/SnakeScene.js      [245 lines]
...
10 OK, 0 problemi
```

### `serve_local.sh`

Avvia un server HTTP locale con Python se non vuoi usare `npm run dev`.

```bash
bash tools/serve_local.sh       # porta 3000 (default)
bash tools/serve_local.sh 8080  # porta personalizzata
```

## ⚠️ Nota

Questi script sono ausiliari: il modo ufficiale per avviare il progetto resta `npm run dev` (vedi [README principale](../README.md)).
