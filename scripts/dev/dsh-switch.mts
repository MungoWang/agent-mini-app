/**
 * Toggle the dsh web profile between local-dev and published-npm dependencies.
 *
 *   pnpm dev:dsh-debug → link @monkey-mini-app/* to this repo (dev loop)
 *   pnpm dev:dsh-prod  → published @monkey-mini-app/dsh-mini-app only (host/panel/ui/api transitively)
 *
 * Rewrites ~/.dsh/profiles/web (DSH_HOME if set): package.json deps + pnpm-workspace.yaml,
 * then reinstalls. No repo files change.
 *
 * Inputs:       argv: debug | prod; env DSH_HOME (default ~/.dsh)
 * Writes:       ~/.dsh/profiles/web/{package.json,pnpm-workspace.yaml}
 * Side effects: machine — rewrites a dsh profile and runs pnpm install
 * Run as:       pnpm dev:dsh-debug / pnpm dev:dsh-prod
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyProfileSwitch, readPluginVersion } from "./dsh-switch.lib.mts";

const mode = process.argv[2];
if (mode !== "debug" && mode !== "prod") {
  console.error("usage: pnpm dev:dsh-debug | pnpm dev:dsh-prod");
  process.exit(1);
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const profileDir = path.join(process.env.DSH_HOME || path.join(homedir(), ".dsh"), "profiles", "web");
const pkgFile = path.join(profileDir, "package.json");
const wsFile = path.join(profileDir, "pnpm-workspace.yaml");

if (!existsSync(pkgFile)) {
  console.error(`[dsh:${mode}] profile not found: ${profileDir}\n  run: bash scripts/setup/install-dsh-plugin.sh`);
  process.exit(1);
}

const pluginVersion = readPluginVersion(repoRoot);
const pkg = JSON.parse(readFileSync(pkgFile, "utf8")) as Record<string, unknown>;
const next = applyProfileSwitch({ mode, pkg, repoRoot, pluginVersion });

mkdirSync(profileDir, { recursive: true });
writeFileSync(pkgFile, JSON.stringify(next.pkg, null, 2) + "\n");
writeFileSync(wsFile, next.workspaceYaml);

const depNote =
  mode === "debug"
    ? "local link: dsh-mini-app + host + panel + ui + api"
    : `npm ${pluginVersion} (dsh-mini-app only; host/panel/ui/api transitively)`;
console.log(`[dsh:${mode}] switched profile to ${depNote}; nodeLinker=isolated`);
execFileSync("pnpm", ["install"], { cwd: profileDir, stdio: "inherit" });
console.log(`[dsh:${mode}] done`);
