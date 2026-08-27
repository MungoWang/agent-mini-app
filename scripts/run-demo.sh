#!/usr/bin/env bash
# Start the @monkey-mini-app/ui component gallery (demo-host) on http://127.0.0.1:5173
# The same gallery is served by the embedded host at http://127.0.0.1:17880/demo
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
echo "[demo] open http://127.0.0.1:5173 (or host /demo when dsh web is running)"
exec pnpm --filter demo-host dev
