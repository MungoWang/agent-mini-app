/**
 * Standardized publish for the @monkey-mini-app/* packages.
 *
 *   pnpm publish:packages [--bump patch|minor|major]
 *
 * Verifies each package is buildable + has no `workspace:` deps, then publishes in
 * dependency order (ui → sdk → host → panel → dsh) with public access, and finishes with a
 * clean-install smoke test. Runs `npm publish` per package (its prepack/prepublishOnly
 * builds first).

 * Inputs:       packages/*\/package.json, argv: --bump patch|minor|major
 * Writes:       package.json versions (with --bump) and cross-dep ranges
 * Side effects: network + npm registry publish (irreversible); runs pnpm test:dsh first
 * Run as:       pnpm publish:packages
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const ORDER = ["ui", "sdk", "host", "panel", "dsh"];
const PKG_DIR: Record<string, string> = {
  "@monkey-mini-app/ui": "ui",
  "@monkey-mini-app/sdk": "sdk",
  "@monkey-mini-app/host": "host",
  "@monkey-mini-app/panel": "panel",
  "@monkey-mini-app/dsh-mini-app": "dsh",
};

function readPkg(name: string) {
  return JSON.parse(readFileSync(path.join(root, "packages", name, "package.json"), "utf8"));
}

function pkgPath(name: string) {
  return path.join(root, "packages", name, "package.json");
}

/** workspace:^ is for the monorepo; npm publish needs a semver range. */
function expandWorkspaceRanges(pkg: Record<string, unknown>): boolean {
  let changed = false;
  for (const field of ["dependencies", "peerDependencies"] as const) {
    const deps = pkg[field] as Record<string, string> | undefined;
    if (!deps) continue;
    for (const [k, v] of Object.entries(deps)) {
      if (!String(v).startsWith("workspace:")) continue;
      const dir = PKG_DIR[k];
      if (!dir) fail(`${k} uses workspace: but is not a repo package`);
      deps[k] = `^${readPkg(dir).version}`;
      changed = true;
    }
  }
  return changed;
}

function fail(msg: string): never {
  console.error(`[publish] ❌ ${msg}`);
  process.exit(1);
}

// bump all package versions (used for a release)
const bumpIdx = process.argv.indexOf("--bump");
if (bumpIdx >= 0) {
  const kind = process.argv[bumpIdx + 1];
  for (const name of ORDER) {
    execFileSync("npm", ["version", kind], { cwd: path.join(root, "packages", name), stdio: "inherit" });
  }
  console.log("[publish] bumped all to", readPkg("ui").version);
}

console.log("[publish] pre-check builds + dependency sanity...");
for (const name of ORDER) {
  const pkg = readPkg(name);
  if (pkg.private) fail(`${name} is private`);
  if (!pkg.publishConfig?.access) fail(`${name} missing publishConfig.access`);
  if (pkg.license !== "MIT") fail(`${name} missing license: MIT`);
  console.log(`  ${name.padEnd(6)} v${pkg.version} OK`);
}

if (!process.argv.includes("--skip-e2e")) {
  console.log("\n[publish] dsh-host e2e (verdaccio + real dsh web)...");
  execFileSync("pnpm", ["test:dsh"], { cwd: root, stdio: "inherit" });
} else {
  console.warn("[publish] skipping test:dsh (--skip-e2e)");
}

console.log("\n[publish] publishing in order ui → sdk → host → panel → dsh...");
for (const name of ORDER) {
  console.log(`\n── publish @monkey-mini-app/${name} ──`);
  const file = pkgPath(name);
  const original = readFileSync(file, "utf8");
  const pkg = JSON.parse(original) as Record<string, unknown>;
  if (expandWorkspaceRanges(pkg)) {
    writeFileSync(file, JSON.stringify(pkg, null, 2) + "\n");
  }
  try {
    execFileSync("npm", ["publish"], { cwd: path.join(root, "packages", name), stdio: "inherit" });
    console.log(`  ✓ @monkey-mini-app/${name} published (v${readPkg(name).version})`);
  } catch {
    writeFileSync(file, original);
    fail(`@monkey-mini-app/${name} publish failed`);
  }
  writeFileSync(file, original);
}

console.log("\n[publish] clean-install smoke test...");
const tmp = path.join(root, "publish-smoke");
execFileSync("rm", ["-rf", tmp]);
execFileSync("mkdir", ["-p", tmp]);
execFileSync("npm", ["init", "-y"], { cwd: tmp });
execFileSync("npm", ["i", `@monkey-mini-app/dsh-mini-app@^${readPkg("dsh").version}`], { cwd: tmp, stdio: "inherit" });
execFileSync("rm", ["-rf", tmp]);
console.log("\n[publish] ✅ all packages published + install smoke passed");
