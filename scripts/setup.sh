#!/usr/bin/env bash
# One-shot local setup: Node tools + monorepo install + dsh plugin link + print next steps
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Node $(node -v 2>/dev/null || echo MISSING)"
if ! command -v node >/dev/null 2>&1; then
  echo "Install Node.js >= 20 first: https://nodejs.org/" >&2
  exit 1
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "==> install pnpm@9"
  npm install -g pnpm@9
fi

if ! command -v dsh >/dev/null 2>&1; then
  echo "==> install @deepseek-ai/dsh"
  npm install -g @deepseek-ai/dsh
fi

echo "==> pnpm install (monorepo, ignore lifecycle for speed)"
pnpm install --ignore-scripts || true

echo "==> ensure dsh-plugin has isomorphic-git"
(cd packages/dsh-plugin && npm install isomorphic-git --omit=dev)

if [ ! -f packages/dsh-plugin/lib/index.js ]; then
  echo "WARNING: packages/dsh-plugin/lib/index.js missing — plugin will not load until built."
fi

echo "==> link plugin into dsh web profile"
bash "$ROOT/scripts/install-dsh-plugin.sh"

echo
echo "======== next ========"
echo "1) Visual Host demo (no dsh required):"
echo "     bash scripts/run-demo.sh"
echo "     open http://127.0.0.1:8080"
echo
echo "2) dsh web + plugin:"
echo "     dsh web --no-open --port 3080"
echo "     open http://127.0.0.1:3080"
echo "     chat: create a mini app using skill monkey-mini-app"
echo
echo "3) Examples live in: examples/com.example.hello , examples/com.example.counter"
echo "======================"
