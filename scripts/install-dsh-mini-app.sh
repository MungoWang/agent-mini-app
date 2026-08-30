#!/usr/bin/env bash
# Install @monkey-mini-app/dsh-mini-app into the local dsh *web* profile via path link.
# Flow:
#   1) ensure dsh / pnpm are installed
#   2) build ui dist + dsh bundle (tsup)
#   3) profile pnpm-workspace.yaml gains repo host/panel/ui as workspace members
#   4) pnpm add -w workspace packages then pnpm add -w <plugin path>
#   5) bootstrap write complete host.json (via bootstrapHostConfig)
#   6) append bundle name to package.json dsh.profile.bundles
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLUGIN="$ROOT/packages/dsh"
UI_PKG="$ROOT/packages/ui"
HOST_PKG="$ROOT/packages/host"
PANEL_PKG="$ROOT/packages/panel"
PROFILE_DIR="${DSH_HOME:-$HOME/.dsh}/profiles/web"
BUNDLE_NAME="@monkey-mini-app/dsh-mini-app"

if ! command -v dsh >/dev/null 2>&1; then
  echo "[install] dsh not found — installing @deepseek-ai/dsh globally..."
  npm install -g @deepseek-ai/dsh
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "[install] pnpm not found — installing pnpm@11..."
  npm install -g pnpm@11
fi

echo "[install] building @monkey-mini-app/ui dist..."
(cd "$ROOT" && node scripts/build-ui.mjs)
echo "[install] building lib/ from src (tsup)..."
(cd "$PLUGIN" && rm -rf lib && pnpm exec tsup)
for f in index.js client.js; do
  if [ ! -f "$PLUGIN/lib/$f" ]; then
    echo "[install] ERROR: packages/dsh/lib/$f missing after build." >&2
    exit 1
  fi
done

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

ensure_workspace_member() {
  local pkg="$1"
  if ! grep -q "$pkg" "$PROFILE_DIR/pnpm-workspace.yaml"; then
    node - "$PROFILE_DIR/pnpm-workspace.yaml" "$pkg" <<'EOF'
const [wsPath, member] = process.argv.slice(2);
const fs = require("fs");
let s = fs.readFileSync(wsPath, "utf8");
if (!s.includes(member)) {
  s = s.replace(/^packages:\n/, "packages:\n  - " + member + "\n");
  fs.writeFileSync(wsPath, s);
}
EOF
    echo "[install] profile workspace now includes $pkg"
  fi
}

ensure_workspace_member "$UI_PKG"
ensure_workspace_member "$HOST_PKG"
ensure_workspace_member "$PANEL_PKG"

echo "[install] linking workspace packages + plugin into $PROFILE_DIR"
(
  cd "$PROFILE_DIR"
  pnpm remove -w @monkey-mini-app/dsh-plugin @monkey-mini-app/dsh-monkey-mini-app dsh-plugin >/dev/null 2>&1 || true
  pnpm add -w "@monkey-mini-app/ui@workspace:*" >/dev/null 2>&1 || true
  pnpm add -w "@monkey-mini-app/host@workspace:*" >/dev/null 2>&1 || true
  pnpm add -w "@monkey-mini-app/panel@workspace:*" >/dev/null 2>&1 || true
  pnpm add -w "$PLUGIN"
)

echo "[install] bootstrapping host.json..."
(
  cd "$PLUGIN"
  if [ -x "$ROOT/node_modules/.bin/tsx" ]; then
    "$ROOT/node_modules/.bin/tsx" "$ROOT/scripts/mma-init.ts"
  else
    pnpm exec tsx "$ROOT/scripts/mma-init.ts"
  fi
)

export PROFILE_DIR
export BUNDLE_NAME
PROFILE_DIR="$PROFILE_DIR" BUNDLE_NAME="$BUNDLE_NAME" node <<'EOF'
const fs = require("fs");
const p = process.env.PROFILE_DIR + "/package.json";
const j = JSON.parse(fs.readFileSync(p, "utf8"));
j.dsh = j.dsh || {};
j.dsh.profile = j.dsh.profile || {};
j.dsh.profile.bundles = j.dsh.profile.bundles || [];
const name = process.env.BUNDLE_NAME;
const stale = [
  "@monkey-mini-app/dsh-plugin",
  "@monkey-mini-app/dsh-monkey-mini-app",
  "dsh-plugin",
];
j.dsh.profile.bundles = j.dsh.profile.bundles.filter((b) => !stale.includes(b));
if (!j.dsh.profile.bundles.includes(name)) j.dsh.profile.bundles.push(name);
fs.writeFileSync(p, JSON.stringify(j, null, 2) + "\n");
console.log("[install] bundles =", j.dsh.profile.bundles.join(", "));
EOF

echo
echo "OK. Start web UI with:"
echo "  dsh web --no-open"
echo
echo "Look for log line:  [monkey-mini-app] loaded"
echo "If host.json is missing, apply fails loud — re-run this script."
