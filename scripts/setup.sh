#!/usr/bin/env bash
# Idempotent local setup. Safe to re-run after a bad overwrite.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PLUGIN="$ROOT/packages/dsh-plugin"
LIB="$PLUGIN/lib"

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

echo "==> pnpm install (ignore lifecycle; tsup is a build step)"
pnpm install --ignore-scripts || true

echo "==> isomorphic-git in dsh-plugin (runtime, kept external by tsup)"
(cd "$PLUGIN" && npm install isomorphic-git --omit=dev --ignore-scripts)

echo "==> build lib/ from src (tsup)"
if [ -x "$PLUGIN/node_modules/.bin/tsup" ]; then
  (cd "$PLUGIN" && rm -rf lib && ./node_modules/.bin/tsup)
elif [ -x "$ROOT/node_modules/.bin/tsup" ]; then
  (cd "$PLUGIN" && rm -rf lib && "$ROOT/node_modules/.bin/tsup")
elif command -v tsup >/dev/null 2>&1; then
  (cd "$PLUGIN" && rm -rf lib && tsup)
else
  echo "ERROR: tsup not found. Run pnpm install in the repo first." >&2
  exit 1
fi

echo "==> syntax check"
node --check "$LIB/index.js"
node --check "$LIB/client.js"
node --check "$LIB/ui-kit.js"

echo "==> import smoke (load plugin module, do not apply)"
node --input-type=module -e "import('file://$LIB/index.js').then(m => {
  if (!m.name && !m.default) throw new Error('plugin export missing');
  console.log('plugin export ok', m.name || (m.default && m.default.name) || 'default');
}).catch(e => { console.error(e); process.exit(1); })"

echo "==> link plugin into dsh web profile"
bash "$ROOT/scripts/install-dsh-plugin.sh"

echo
echo "======== next ========"
echo "  dsh web --no-open --port 3080"
echo "  open http://127.0.0.1:3080"
echo "Re-run this script anytime after a bad overwrite."
echo "======================"
