#!/usr/bin/env bash
# Install @monkey-mini-app/dsh-monkey-mini-app into the local dsh *web* profile via path link.
# Flow:
#   1) ensure dsh / pnpm are installed
#   2) build plugin bundle (tsup) + ui dist (build-ui.mjs)
#   3) profile pnpm-workspace.yaml gains the repo packages/ui as a workspace member
#   4) pnpm add -w @monkey-mini-app/ui (workspace link) then pnpm add -w <plugin path>
#   5) append bundle name to package.json dsh.profile.bundles
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLUGIN="$ROOT/packages/dsh-plugin"
UI_PKG="$ROOT/packages/ui"
PROFILE_DIR="${DSH_HOME:-$HOME/.dsh}/profiles/web"

if ! command -v dsh >/dev/null 2>&1; then
  echo "[install] dsh not found — installing @deepseek-ai/dsh globally..."
  npm install -g @deepseek-ai/dsh
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "[install] pnpm not found — installing pnpm@11..."
  npm install -g pnpm@11
fi

# Build ui dist (flat index + src + globals.css) and plugin bundle.
echo "[install] building @monkey-mini-app/ui dist..."
(cd "$ROOT" && node scripts/build-ui.mjs)
echo "[install] building lib/ from src (tsup)..."
(cd "$PLUGIN" && rm -rf lib && pnpm exec tsup)
for f in index.js client.js; do
  if [ ! -f "$PLUGIN/lib/$f" ]; then
    echo "[install] ERROR: packages/dsh-plugin/lib/$f missing after build." >&2
    exit 1
  fi
done

# Ensure profile skeleton.
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

# Register the repo packages/ui as a workspace member so dsh-plugin's
# "workspace:*" dependency on @monkey-mini-app/ui resolves locally.
if ! grep -q "$UI_PKG" "$PROFILE_DIR/pnpm-workspace.yaml"; then
  node - "$PROFILE_DIR/pnpm-workspace.yaml" "$UI_PKG" <<'EOF'
const [wsPath, uiPkg] = process.argv.slice(2);
const fs = require("fs");
let s = fs.readFileSync(wsPath, "utf8");
if (!s.includes(uiPkg)) {
  s = s.replace(/^packages:\n/, "packages:\n  - " + uiPkg + "\n");
  fs.writeFileSync(wsPath, s);
}
EOF
  echo "[install] profile workspace now includes $UI_PKG"
fi

echo "[install] linking @monkey-mini-app/ui + plugin into $PROFILE_DIR"
(
  cd "$PROFILE_DIR"
  pnpm remove -w @monkey-mini-app/dsh-plugin dsh-plugin >/dev/null 2>&1 || true
  pnpm add -w "@monkey-mini-app/ui@workspace:*" >/dev/null 2>&1 || true
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
const name = "@monkey-mini-app/dsh-monkey-mini-app";
const stale = ["@monkey-mini-app/dsh-plugin", "dsh-plugin"];
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
