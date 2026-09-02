import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type AboutPackage = {
  name: string;
  version: string;
};

export type AboutInfo = {
  adapter: string;
  env: string;
  packages: AboutPackage[];
};

export type UpdateCheck = {
  name: string;
  current: string;
  latest: string | null;
  updateAvailable: boolean;
  error?: string;
};

export type HostAboutMeta = {
  /** Adapter id shown in About (e.g. "dsh", "react-host"). */
  adapter: string;
  /** Primary package to check for updates (usually the adapter package). */
  packageName?: string;
  /** Adapter package version override (when not resolvable from node_modules). */
  version?: string;
  /** Runtime environment label. Defaults to NODE_ENV. */
  env?: string;
};

const PLATFORM_PACKAGES = [
  "@monkey-mini-app/host",
  "@monkey-mini-app/panel",
  "@monkey-mini-app/sdk",
  "@monkey-mini-app/ui",
] as const;

function requireFromHere(): NodeJS.Require {
  return createRequire(fileURLToPath(import.meta.url));
}

function readPkgVersion(req: NodeJS.Require, name: string): string | null {
  try {
    const pkgJson = req.resolve(`${name}/package.json`);
    const pkg = req(pkgJson) as { version?: string };
    return typeof pkg.version === "string" ? pkg.version : null;
  } catch {
    return null;
  }
}

/** Resolve platform (+ optional adapter) package versions for About. */
export function resolveAboutInfo(meta: HostAboutMeta): AboutInfo {
  const req = requireFromHere();
  const packages: AboutPackage[] = [];
  const seen = new Set<string>();

  const push = (name: string, version: string | null | undefined) => {
    if (!version || seen.has(name)) return;
    seen.add(name);
    packages.push({ name, version });
  };

  if (meta.packageName) {
    push(meta.packageName, meta.version ?? readPkgVersion(req, meta.packageName));
  }

  for (const name of PLATFORM_PACKAGES) {
    push(name, readPkgVersion(req, name));
  }

  // Fallback: host's own package.json next to this module when require fails (monorepo edge).
  if (!packages.some((p) => p.name === "@monkey-mini-app/host")) {
    try {
      const here = path.dirname(fileURLToPath(import.meta.url));
      const pkgPath = path.resolve(here, "..", "package.json");
      const pkg = req(pkgPath) as { name?: string; version?: string };
      if (pkg.name && pkg.version) push(pkg.name, pkg.version);
    } catch {
      /* ignore */
    }
  }

  return {
    adapter: meta.adapter,
    env: meta.env ?? process.env.NODE_ENV ?? "development",
    packages,
  };
}

/** Compare loose versions: update available when latest !== current (ignores leading v). */
export function isUpdateAvailable(current: string, latest: string | null): boolean {
  if (!latest) return false;
  const a = current.replace(/^v/, "").trim();
  const b = latest.replace(/^v/, "").trim();
  if (!a || !b) return false;
  // Prerelease local builds (0.1.0-dshhost.*) always suggest checking against npm latest base.
  if (a === b) return false;
  return true;
}

/** Fetch latest version from the npm registry. */
export async function fetchNpmLatest(packageName: string): Promise<string | null> {
  const url = `https://registry.npmjs.org/${encodeURIComponent(packageName)}/latest`;
  const res = await fetch(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) return null;
  const raw: unknown = await res.json();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const version = (raw as { version?: unknown }).version;
  return typeof version === "string" ? version : null;
}

export async function checkPackageUpdate(
  packageName: string,
  current: string,
): Promise<UpdateCheck> {
  try {
    const latest = await fetchNpmLatest(packageName);
    return {
      name: packageName,
      current,
      latest,
      updateAvailable: isUpdateAvailable(current, latest),
    };
  } catch (cause) {
    return {
      name: packageName,
      current,
      latest: null,
      updateAvailable: false,
      error: cause instanceof Error ? cause.message : String(cause),
    };
  }
}