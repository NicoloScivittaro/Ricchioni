#!/usr/bin/env bash
# Verifica graffe bilanciate in tutti i file .js di src/
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ok=0; fail=0
for f in "$ROOT"/src/scenes/*.js "$ROOT"/src/main.js; do
  [ -f "$f" ] || continue
  open=$(grep -o '{' "$f" | wc -l)
  close=$(grep -o '}' "$f" | wc -l)
  lines=$(wc -l < "$f")
  name="${f##*/ROOT/}"
  if [ "$open" -eq "$close" ]; then
    printf "OK  %-40s [%s lines]\n" "$f" "$lines"
    ok=$((ok+1))
  else
    printf "ERR %-40s  { %s  } %s  diff=%s\n" "$f" "$open" "$close" "$((open-close))"
    fail=$((fail+1))
  fi
done
echo ""
echo "$ok OK, $fail problemi"
