#!/usr/bin/env bash
# Server HTTP locale con Python (alternativa a npm run dev)
PORT="${1:-3000}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
echo "Avvio server su http://localhost:$PORT"
echo "Cartella: $ROOT"
cd "$ROOT" && python3 -m http.server "$PORT"
