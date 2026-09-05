/**
 * Per-app backend packages (docs/rfcs/per-app-packages.md).
 *
 * A mini-app that must `import` a Node library the platform does not ship gets that
 * library **in its own directory** — not in the host, not in the iframe. `package.json`
 * + lockfile are the app's; `node_modules` is rebuilt by install and never committed
 * (git-history.ts already ignores it).
 *
 * Two rules that keep this from becoming "every app is an npm project":
 * - **`--ignore-scripts` always**, and the `scripts` field is stripped on write, so a
 *   dependency's lifecycle code never runs from our side.
 * - The **denylist** rejects packages the platform already provides. Those are a
 *   compiler concern (`platform-modules.ts`), not something an app may re-add at a
 *   different version.
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { HostError } from "../errors.ts";

export const APP_PACKAGE_JSON = "package.json";

/**
 * Already provided by the platform (or useless/multi-React on the author surface).
 * Compared on the **package name**, so `lodash-es`, `@monkey-mini-app/ui` and a scoped
 * `@monkey-mini-app/host` all hit the same rule.
 */
const DENY_EXACT = new Set(["react", "react-dom", "lodash", "lodash-es", "axios", "typescript"]);

const NPM_TIMEOUT_MS = 120_000;

export type AppPackageRequest = { name: string; version: string };

export type AppPackageManifest = {
  private: true;
  name: string;
  version: string;
  dependencies: Record<string, string>;
};

function denyReason(name: string): string | null {
  if (name.startsWith("@monkey-mini-app/")) {
    return `'${name}' is a platform package — already available, do not install it`;
  }
  if (DENY_EXACT.has(name)) {
    return `'${name}' is a platform package — ${
      name === "axios" ? "use ctx.http" : "it is already provided; do not install it"
    }`;
  }
  return null;
}

/** Reject anything that is not a plain npm package name (no paths, no URLs, no tricks). */
function assertPackageName(name: unknown): string {
  if (typeof name !== "string" || name.length === 0) {
    throw new HostError("INVALID_TOOL_ARGS", "package name must be a non-empty string");
  }
  if (!/^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/.test(name)) {
    throw new HostError("INVALID_TOOL_ARGS", `invalid package name: ${name}`);
  }
  const denied = denyReason(name);
  if (denied) {
    throw new HostError("INVALID_TOOL_ARGS", denied);
  }
  return name;
}

function assertVersion(version: unknown): string {
  if (version === undefined || version === null || version === "") return "*";
  if (typeof version !== "string" || /[\s;`$]/.test(version)) {
    throw new HostError("INVALID_TOOL_ARGS", "package version must be a plain range string");
  }
  return version;
}

function manifestPath(appDir: string): string {
  return path.join(appDir, APP_PACKAGE_JSON);
}

/** Read the app manifest; `null` when the app has never installed anything. */
export function readAppManifest(appDir: string): AppPackageManifest | null {
  const fp = manifestPath(appDir);
  if (!existsSync(fp)) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(fp, "utf8"));
  } catch {
    throw new HostError("INVALID_APP_PACKAGE", `${APP_PACKAGE_JSON} is not valid JSON`);
  }
  if (typeof raw !== "object" || raw === null) {
    throw new HostError("INVALID_APP_PACKAGE", `${APP_PACKAGE_JSON} must be an object`);
  }
  const obj = raw as Record<string, unknown>;
  const deps = (obj.dependencies ?? {}) as Record<string, unknown>;
  const dependencies: Record<string, string> = {};
  for (const [k, v] of Object.entries(deps)) {
    if (typeof v === "string") dependencies[k] = v;
  }
  return {
    private: true,
    name: typeof obj.name === "string" ? obj.name : "mini-app",
    version: typeof obj.version === "string" ? obj.version : "0.0.0",
    dependencies,
  };
}

/**
 * Write the manifest. `scripts` is deliberately **not** carried over: whatever a
 * dependency (or a hand edit) put there must never be something we execute.
 */
export function writeAppManifest(appDir: string, appId: string, m: AppPackageManifest): void {
  const out = {
    private: true,
    name: m.name || appId,
    version: m.version || "0.0.0",
    dependencies: m.dependencies,
  };
  writeFileSync(manifestPath(appDir), JSON.stringify(out, null, 2) + "\n", "utf8");
}

export type NpmResult = { code: number; stdout: string; stderr: string };

/** Run npm inside the app directory. Never a shell string (no injection), always offline-ish flags. */
export function runNpm(appDir: string, args: string[]): Promise<NpmResult> {
  const cmd = process.platform === "win32" ? "npm.cmd" : "npm";
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    let child: ReturnType<typeof spawn>;
    try {
      child = spawn(cmd, args, { cwd: appDir, env: process.env });
    } catch (cause) {
      reject(new HostError("NPM_UNAVAILABLE", `cannot run npm: ${cause instanceof Error ? cause.message : String(cause)}`));
      return;
    }
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
    }, NPM_TIMEOUT_MS);
    child.stdout?.on("data", (c) => (stdout += String(c)));
    child.stderr?.on("data", (c) => (stderr += String(c)));
    child.on("error", (err: Error) => {
      clearTimeout(timer);
      reject(new HostError("NPM_UNAVAILABLE", `npm failed to start: ${err.message}`));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === null) {
        reject(new HostError("NPM_TIMEOUT", `npm ${args[0] ?? ""} timed out after ${NPM_TIMEOUT_MS / 1000}s`));
        return;
      }
      resolve({ code, stdout, stderr });
    });
  });
}

/** The flags that make this "a library this app needs", not "npm as the user typed it". */
const NPM_SAFE_ARGS = ["--ignore-scripts", "--omit=dev", "--no-audit", "--no-fund"] as const;

export type InstallInput = {
  appDir: string;
  appId: string;
  packages?: unknown;
  remove?: unknown;
};

export type InstallOutcome = {
  ok: boolean;
  dependencies: Record<string, string>;
  /** npm stderr on failure (truncated) or the reason a spec could not be installed. */
  error?: string;
  /** True when nothing was run (no packages/remove requested). */
  noop?: boolean;
};

function asPackageList(value: unknown): AppPackageRequest[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw new HostError("INVALID_TOOL_ARGS", "packages must be an array");
  }
  return value.map((item, i) => {
    if (typeof item === "string") {
      return { name: assertPackageName(item), version: "*" };
    }
    if (typeof item !== "object" || item === null) {
      throw new HostError("INVALID_TOOL_ARGS", `packages[${i}] must be a string or { name, version? }`);
    }
    const rec = item as Record<string, unknown>;
    return { name: assertPackageName(rec.name), version: assertVersion(rec.version) };
  });
}

function asNameList(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw new HostError("INVALID_TOOL_ARGS", "remove must be an array of package names");
  }
  return value.map((x) => assertPackageName(x));
}

/**
 * Add/remove dependencies for one app and let npm materialize them under
 * `<appDir>/node_modules`. Idempotent: an empty request reports the current set.
 */
export async function installAppPackages(input: InstallInput): Promise<InstallOutcome> {
  const { appDir, appId } = input;
  const add = asPackageList(input.packages);
  const remove = asNameList(input.remove);

  const manifest = readAppManifest(appDir) ?? {
    private: true,
    name: appId,
    version: "0.0.0",
    dependencies: {},
  };

  if (add.length === 0 && remove.length === 0) {
    return { ok: true, dependencies: manifest.dependencies, noop: true };
  }

  for (const r of remove) delete manifest.dependencies[r];
  for (const p of add) manifest.dependencies[p.name] = p.version;
  writeAppManifest(appDir, appId, manifest);

  const specs = add.map((p) => (p.version && p.version !== "*" ? `${p.name}@${p.version}` : p.name));
  // ^ `version` is always filled (asPackageList defaults to "*"), so a bare name is the
  //   "let npm resolve latest" case rather than an undefined hole in the type.
  let result: NpmResult;
  try {
    if (specs.length > 0) {
      result = await runNpm(appDir, ["install", ...NPM_SAFE_ARGS, ...specs]);
    } else {
      result = await runNpm(appDir, ["uninstall", ...NPM_SAFE_ARGS, ...remove]);
    }
  } catch (cause) {
    return {
      ok: false,
      dependencies: manifest.dependencies,
      error: cause instanceof Error ? cause.message : String(cause),
    };
  }

  const after = readAppManifest(appDir) ?? manifest;
  if (result.code !== 0) {
    return {
      ok: false,
      dependencies: after.dependencies,
      error: (result.stderr || result.stdout || `npm exited ${result.code}`).slice(0, 4000),
    };
  }
  return { ok: true, dependencies: after.dependencies };
}

/** `@scope/pkg/deep` → `@scope/pkg`; `lodash/groupBy` → `lodash`. */
function packageRootOf(spec: string): string {
  const parts = spec.split("/");
  return spec.startsWith("@") && parts.length >= 2 ? `${parts[0]}/${parts[1]}` : parts[0];
}

/**
 * The resolver returns a **realpath**, and a macOS temp dir is `/var` → `/private/var`.
 * Comparing an unresolved root against it rejects a package that really is inside the
 * app — the same trap `realDir()` avoids in the UI compiler.
 */
function realDir(dir: string): string {
  try {
    return realpathSync(dir);
  } catch {
    return path.resolve(dir);
  }
}

/**
 * Resolve + load a bare specifier **from this app's own node_modules**.
 *
 * `createRequire(<appDir>/package.json)` gives Node's real resolution (so scoped
 * packages, `exports` maps and transitive deps work), and the containment check is
 * what stops the app from reaching the plugin's or the repo's dependency tree.
 */
export function requireFromAppPackages(appDir: string, spec: string): unknown {
  const root = assertPackageName(packageRootOf(spec));
  if (!existsSync(manifestPath(appDir))) {
    throw new HostError(
      "BACKEND_IMPORT",
      `backend cannot import '${spec}' (no ${APP_PACKAGE_JSON}). Install it first: mini_app_install({ appId, packages: [{ name: "${root}" }] })`,
    );
  }
  const req = createRequire(manifestPath(appDir));
  let pkgEntry: string;
  try {
    pkgEntry = req.resolve(root);
  } catch {
    throw new HostError(
      "BACKEND_IMPORT",
      `backend cannot import '${spec}'. Install it first: mini_app_install({ appId, packages: [{ name: "${root}" }] })`,
    );
  }
  const nmRoot = path.join(realDir(appDir), "node_modules");
  const abs = path.resolve(pkgEntry);
  if (abs !== nmRoot && !abs.startsWith(nmRoot + path.sep)) {
    throw new HostError(
      "BACKEND_IMPORT",
      `backend cannot import '${spec}': it resolves outside this app's node_modules — reinstall with mini_app_install`,
    );
  }
  return req(spec);
}
