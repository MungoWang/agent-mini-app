/**
 * Toggle the dsh web profile between local-dev and published-npm dependencies.
 *
 *   pnpm dsh:debug   → link @monkey-mini-app/* to this repo (dev loop)
 *   pnpm dsh:prod    → use published @monkey-mini-app/* from npm
 *
 * Edits ~/.dsh/profiles/web (DSH_HOME if set): package.json deps + pnpm-workspace.yaml,
 * then reinstalls. No repo files change.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const mode = process.argv[2];
if (mode !== "debug" && mode !== "prod") {
  console.error("usage: pnpm dsh:debug|dsh:prod");
  process.exit(1);
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const profileDir = path.join(process.env.DSH_HOME || path.join(homedir(), ".dsh"), "profiles", "web");
const pkgFile = path.join(profileDir, "package.json");
const wsFile = path.join(profileDir, "pnpm-workspace.yaml");

if (!existsSync(pkgFile)) {
  console.error(`[dsh:${mode}] profile not found: ${profileDir}\n  run: bash scripts/install-dsh-mini-app.sh`);
  process.exit(1);
}

const pkg = JSON.parse(readFileSync(pkgFile, "utf8"));
pkg.dependencies = pkg.dependencies || {};

const MONKEY = ["@monkey-mini-app/dsh-mini-app", "@monkey-mini-app/host", "@monkey-mini-app/panel", "@monkey-mini-app/ui"];
const repoPkgs = {
  "@monkey-mini-app/dsh-mini-app": path.join(repoRoot, "packages", "dsh"),
  "@monkey-mini-app/host": path.join(repoRoot, "packages", "host"),
  "@monkey-mini-app/panel": path.join(repoRoot, "packages", "panel"),
  "@monkey-mini-app/ui": path.join(repoRoot, "packages", "ui"),
};

if (mode === "debug") {
  for (const name of MONKEY) {
    pkg.dependencies[name] = `link:${repoPkgs[name]}`;
  }
} else {
  for (const name of MONKEY) {
    pkg.dependencies[name] = "^0.1.0";
  }
}

writeFileSync(pkgFile, JSON.stringify(pkg, null, 2) + "\n");

// pnpm-workspace.yaml: include the repo packages only in debug so workspace:*/link deps
// resolve locally; in prod leave them out (npm versions used).
let ws = existsSync(wsFile) ? readFileSync(wsFile, "utf8") : "packages:\n  - .\n";
for (const name of ["@monkey-mini-app/dsh-mini-app", "@monkey-mini-app/host", "@monkey-mini-app/panel", "@monkey-mini-app/ui"]) {
  void name;
}
const repoWorkspaceLines = ["packages/panel", "packages/host", "packages/ui"].map((p) =>
  path.join(repoRoot, p),
);
const hasRepo = (line: string) => repoWorkspaceLines.some((p) => line.trim().includes(p));
const wsLines = ws.split("\n").filter((line) => !hasRepo(line));
if (mode === "debug") {
  // insert repo packages right after `packages:`
  const idx = wsLines.findIndex((line) => line.trim() === "packages:");
  const insertAt = idx >= 0 ? idx + 1 : 0;
  wsLines.splice(insertAt, 0, ...repoWorkspaceLines.map((p) => `  - ${p}`));
}
writeFileSync(wsFile, wsLines.join("\n") + "\n");

console.log(`[dsh:${mode}] switched deps to ${mode === "debug" ? "LOCAL links (dev)" : "npm (published)"}`);
execFileSync("pnpm", ["install"], { cwd: profileDir, stdio: "inherit" });
const isDebug = mode === "debug";
console.log(`[dsh:${mode}] done — dsh-mini-app = ${isDebug ? "local" : "npm"}, host/panel/ui = ${isDebug ? "local" : "npm"}`);
