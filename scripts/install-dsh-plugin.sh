#!/usr/bin/env bash
# Install @monkey-mini-app/dsh-plugin into the local dsh *web* profile via path link.
# Mirrors the working flow used in development:
#   1) ensure dsh is installed
#   2) build plugin bundle (optional if lib/ already present)
#   3) pnpm add -w <path> inside ~/.dsh/profiles/web
#   4) append bundle name to package.json dsh.profile.bundles
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLUGIN="$ROOT/packages/dsh-plugin"
PROFILE_DIR="${DSH_HOME:-$HOME/.dsh}/profiles/web"

if ! command -v dsh >/dev/null 2>&1; then
  echo "[install] dsh not found — installing @deepseek-ai/dsh globally..."
  npm install -g @deepseek-ai/dsh
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "[install] pnpm not found — installing pnpm@9..."
  npm install -g pnpm@9
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js >= 20 is required" >&2
  exit 1
fi

# Ensure plugin runtime dependency
if [ ! -d "$PLUGIN/node_modules/isomorphic-git" ]; then
  echo "[install] installing isomorphic-git inside dsh-plugin..."
  (cd "$PLUGIN" && npm install isomorphic-git --omit=dev)
fi

# Optional rebuild when sources changed and esbuild/tsup available
if [ ! -f "$PLUGIN/lib/index.js" ]; then
  echo "[install] lib/ missing — trying to build..."
  if command -v pnpm >/dev/null 2>&1 && [ -f "$ROOT/pnpm-workspace.yaml" ]; then
    (cd "$ROOT" && pnpm install --ignore-scripts) || true
  fi
  if [ -x "$PLUGIN/node_modules/.bin/tsup" ] || command -v tsup >/dev/null 2>&1; then
    (cd "$PLUGIN" && npx --yes tsup) || true
  fi
  if [ ! -f "$PLUGIN/lib/index.js" ]; then
    echo "[install] ERROR: packages/dsh-plugin/lib/index.js is missing and build failed." >&2
    echo "         Open an issue or rebuild the monorepo with pnpm + tsup." >&2
    exit 1
  fi
fi

# Ensure profile skeleton (dsh creates this on first boot; we may create early)
mkdir -p "$PROFILE_DIR"
if [ ! -f "$PROFILE_DIR/package.json" ]; then
  cat > "$PROFILE_DIR/package.json" <<'EOF'
{
  "name": "dsh-profile-web",
  "private": true,
  "dependencies": {},
  "dsh": {
    "profile": {
      "bundles": [
        "@deepseek-ai/dsh-base",
        "@deepseek-ai/dsh-web-app"
      ]
    }
  }
}
EOF
fi
if [ ! -f "$PROFILE_DIR/pnpm-workspace.yaml" ]; then
  cat > "$PROFILE_DIR/pnpm-workspace.yaml" <<'EOF'
packages:
  - .

nodeLinker: hoisted
autoInstallPeers: false
EOF
fi
if [ ! -f "$PROFILE_DIR/cordis.patch.yml" ]; then
  echo '[]' > "$PROFILE_DIR/cordis.patch.yml"
fi

echo "[install] linking plugin from $PLUGIN"
(
  cd "$PROFILE_DIR"
  # -w required: profile package is a workspace root
  pnpm add -w "$PLUGIN"
)

export PROFILE_DIR
PROFILE_DIR="$PROFILE_DIR" node <<'EOF'
const fs = require("fs");
const p = process.env.PROFILE_DIR + "/package.json";
const j = JSON.parse(fs.readFileSync(p, "utf8"));
j.dsh = j.dsh || {};
j.dsh.profile = j.dsh.profile || {};
j.dsh.profile.bundles = j.dsh.profile.bundles || [];
const name = "@monkey-mini-app/dsh-plugin";
if (!j.dsh.profile.bundles.includes(name)) j.dsh.profile.bundles.push(name);
fs.writeFileSync(p, JSON.stringify(j, null, 2) + "\n");
console.log("[install] bundles =", j.dsh.profile.bundles.join(", "));
EOF

echo
echo "[install] verifying composition..."
dsh --profile web --dump-config 2>/dev/null | grep -A5 'monkey-mini-app' || echo "(dump-config grep empty — still try boot)"

echo
echo "OK. Start web UI with:"
echo "  dsh web --no-open"
echo "  # or:  dsh web --port 3080"
echo
echo "Look for log line:  [monkey-mini-app] loaded · tools=13"
echo "Skill is copied to ~/.dsh/skills/monkey-mini-app on first load."
