#!/usr/bin/env bash
# Start the visual Host demo (Hello + Counter tabs) on http://127.0.0.1:8080
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PORT="${PORT:-8080}"
export MONKEY_MINI_APP_ROOT="${MONKEY_MINI_APP_ROOT:-$HOME/.monkey-mini-app/runtime}"
mkdir -p "$MONKEY_MINI_APP_ROOT/apps"
echo "[demo] runtimeRoot=$MONKEY_MINI_APP_ROOT"
echo "[demo] open http://127.0.0.1:$PORT"
exec node "$ROOT/demo/server.mjs"
