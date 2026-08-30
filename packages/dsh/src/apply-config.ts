import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

import {
  type AbsolutePath,
  asAbsolutePath,
  bootstrapHostConfig,
  type HostConfig,
  HostConfigError,
  loadHostConfig,
  WorkspacePaths,
} from "@monkey-mini-app/host";

export type DshPluginConfig = {
  runtimeRoot?: string;
};

function expandHome(p: string): string {
  if (p === "~") return homedir();
  if (p.startsWith("~/") || p.startsWith("~\\")) return path.join(homedir(), p.slice(2));
  return p;
}

function toRuntimeRoot(input: string): AbsolutePath {
  const resolved = path.resolve(expandHome(input));
  try {
    return asAbsolutePath(resolved);
  } catch (cause) {
    throw new HostConfigError("host config runtimeRoot must be an absolute path", { cause });
  }
}

/** Locate runtimeRoot from plugin config only when provided; else bootstrap seed path. */
export function resolveRuntimeRoot(config: DshPluginConfig = {}): AbsolutePath {
  if (typeof config.runtimeRoot === "string" && config.runtimeRoot.length > 0) {
    return toRuntimeRoot(config.runtimeRoot);
  }
  return bootstrapHostConfig({}).runtimeRoot;
}

/**
 * Runtime load: read host.json.
 * A missing file is bootstrapped on first run (so `dsh plugin add` just works);
 * a present-but-corrupt host.json still fails loud (never silently patched).
 */
export function loadPluginHostConfig(config: DshPluginConfig = {}): HostConfig {
  const runtimeRoot = resolveRuntimeRoot(config);
  const paths = new WorkspacePaths(runtimeRoot);
  try {
    return loadHostConfig(paths);
  } catch (cause) {
    // First run: bootstrap a complete host.json so `dsh plugin add` just works.
    // A present-but-corrupt host.json still fails loud (we never silently patch it).
    if (cause instanceof HostConfigError && cause.code === "HOST_CONFIG_NOT_FOUND") {
      const cfg = bootstrapHostConfig({ runtimeRoot });
      mkdirSync(cfg.runtimeRoot, { recursive: true });
      mkdirSync(paths.appsDir(), { recursive: true });
      writeFileSync(paths.hostConfigFile(), `${JSON.stringify(cfg, null, 2)}\n`);
      return cfg;
    }
    throw cause;
  }
}
