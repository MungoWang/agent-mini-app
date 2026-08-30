/**
 * Standardized publish for the @monkey-mini-app/* packages.
 *
 *   pnpm publish:packages [--bump patch|minor|major]
 *
 * Verifies each package is buildable + has no `workspace:` deps, then publishes in
 * dependency order (ui → host → panel → dsh) with public access, and finishes with a
 * clean-install smoke test. Runs `npm publish` per package (its prepack/prepublishOnly
 * builds first).
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ORDER = ["ui", "host", "panel", "dsh"];

function readPkg(name: string) {
  return JSON.parse(readFileSync(path.join(root, "packages", name, "package.json"), "utf8"));
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
  const deps = { ...(pkg.dependencies || {}), ...(pkg.peerDependencies || {}) };
  const ws = Object.entries(deps).filter(([, v]) => String(v).startsWith("workspace:"));
  if (ws.length) fail(`${name} still has workspace: deps → ${ws.map(([k, v]) => `${k}@${v}`).join(", ")}`);
  if (pkg.private) fail(`${name} is private`);
  if (!pkg.publishConfig?.access) fail(`${name} missing publishConfig.access`);
  console.log(`  ${name.padEnd(6)} v${pkg.version} OK`);
}

console.log("\n[publish] publishing in order ui → host → panel → dsh...");
for (const name of ORDER) {
  console.log(`\n── publish @monkey-mini-app/${name} ──`);
  try {
    execFileSync("npm", ["publish"], { cwd: path.join(root, "packages", name), stdio: "inherit" });
    console.log(`  ✓ @monkey-mini-app/${name} published (v${readPkg(name).version})`);
  } catch {
    fail(`@monkey-mini-app/${name} publish failed`);
  }
}

console.log("\n[publish] clean-install smoke test...");
const tmp = path.join(root, ".publish-smoke");
execFileSync("rm", ["-rf", tmp]);
execFileSync("mkdir", ["-p", tmp]);
execFileSync("npm", ["init", "-y"], { cwd: tmp });
execFileSync("npm", ["i", `@monkey-mini-app/dsh-mini-app@^${readPkg("dsh").version}`], { cwd: tmp, stdio: "inherit" });
execFileSync("rm", ["-rf", tmp]);
console.log("\n[publish] ✅ all packages published + install smoke passed");
