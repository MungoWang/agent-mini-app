/**
 * Pure helpers for scripts/dev/dsh-switch.mts.
 *
 * Inputs:       mode + profile package.json + repo root + plugin version
 * Writes:       none (returns new documents)
 * Side effects: none
 * Run as:       imported by dsh-switch.mts and dsh-switch.test.mts
 */
import { readFileSync } from "node:fs";
import path from "node:path";

export type SwitchMode = "debug" | "prod";

export const PLUGIN_NAME = "@monkey-mini-app/dsh-mini-app";

/** Repo packages that debug mode path-links into the dsh web profile. */
export const REPO_PACKAGE_DIRS = {
  "@monkey-mini-app/dsh-mini-app": "packages/dsh",
  "@monkey-mini-app/host": "packages/host",
  "@monkey-mini-app/panel": "packages/panel",
  "@monkey-mini-app/ui": "packages/ui",
  "@monkey-mini-app/api": "packages/api",
} as const;

export type RepoPackageName = keyof typeof REPO_PACKAGE_DIRS;

/** Host/panel/ui/api are transitive of the plugin — not direct prod profile deps. */
export const TRANSITIVE_PLUGIN_DEPS = [
  "@monkey-mini-app/host",
  "@monkey-mini-app/panel",
  "@monkey-mini-app/ui",
  "@monkey-mini-app/api",
] as const;

/** Leftover names from install-dsh-plugin / pre-cutover debug. */
export const OBSOLETE_DEP_NAMES = [
  "@monkey-mini-app/dsh-plugin",
  "@monkey-mini-app/dsh-monkey-mini-app",
  "dsh-plugin",
] as const;

export type ProfilePackageJson = {
  dependencies?: Record<string, string>;
  dsh?: {
    profile?: {
      bundles?: string[];
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

const PATH_DEP = /^(link|file|workspace):/;

function isPathDep(spec: string): boolean {
  return PATH_DEP.test(spec);
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function readPluginVersion(repoRoot: string): string {
  const file = path.join(repoRoot, "packages", "dsh", "package.json");
  const pkg = JSON.parse(readFileSync(file, "utf8")) as { version?: unknown };
  if (typeof pkg.version !== "string" || pkg.version.length === 0) {
    throw new Error(`packages/dsh/package.json has no version (${file})`);
  }
  return pkg.version;
}

/**
 * Rewrite the profile workspace from scratch.
 *
 * `nodeLinker: isolated` is mandatory: hoisted flattens peer trees so official
 * dsh plugins share one dsh-llm/session generation and crash on
 * admitPromptContent / deepFreeze / assertNever. See LOCAL.md.
 */
export function renderWorkspaceYaml(mode: SwitchMode, repoRoot: string): string {
  const members = ["."];
  if (mode === "debug") {
    for (const rel of Object.values(REPO_PACKAGE_DIRS)) {
      members.push(path.join(repoRoot, rel));
    }
  }
  return [
    "packages:",
    ...members.map((entry) => `  - ${entry}`),
    "",
    "nodeLinker: isolated",
    "autoInstallPeers: false",
    "",
  ].join("\n");
}

function ensurePluginBundle(pkg: ProfilePackageJson): void {
  pkg.dsh = pkg.dsh ?? {};
  const dsh = pkg.dsh as { profile?: { bundles?: string[]; [key: string]: unknown } };
  dsh.profile = dsh.profile ?? {};
  const bundles = Array.isArray(dsh.profile.bundles) ? [...dsh.profile.bundles] : [];
  const stale = new Set<string>(OBSOLETE_DEP_NAMES);
  const next = bundles.filter((name) => !stale.has(name));
  if (!next.includes(PLUGIN_NAME)) next.push(PLUGIN_NAME);
  dsh.profile.bundles = next;
}

export function applyProfileSwitch(input: {
  mode: SwitchMode;
  pkg: ProfilePackageJson;
  repoRoot: string;
  pluginVersion: string;
}): { pkg: ProfilePackageJson; workspaceYaml: string } {
  const pkg = cloneJson(input.pkg);
  const deps: Record<string, string> = { ...(pkg.dependencies ?? {}) };

  for (const name of OBSOLETE_DEP_NAMES) {
    delete deps[name];
  }

  if (input.mode === "debug") {
    for (const name of Object.keys(REPO_PACKAGE_DIRS) as RepoPackageName[]) {
      deps[name] = `link:${path.join(input.repoRoot, REPO_PACKAGE_DIRS[name])}`;
    }
  } else {
    for (const name of TRANSITIVE_PLUGIN_DEPS) {
      delete deps[name];
    }
    for (const [name, spec] of Object.entries(deps)) {
      if (name.startsWith("@monkey-mini-app/") && isPathDep(spec)) {
        delete deps[name];
      }
    }
    // Exact pin from packages/dsh/package.json — never ^0.1.0.
    deps[PLUGIN_NAME] = input.pluginVersion;
  }

  pkg.dependencies = deps;
  ensurePluginBundle(pkg);
  return { pkg, workspaceYaml: renderWorkspaceYaml(input.mode, input.repoRoot) };
}
