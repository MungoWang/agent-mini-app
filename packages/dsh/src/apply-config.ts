import { homedir } from "node:os";
import path from "node:path";

import {
  type AbsolutePath,
  asAbsolutePath,
  bootstrapHostConfig,
  createHostI18n,
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

function missingConfigError(file: string, cause?: unknown): HostConfigError {
  const i18n = createHostI18n("zh-CN");
  const message = `${i18n.t("config.missingFile", { path: file })} ${i18n.t("config.missingHint")}`;
  return new HostConfigError(message, { code: "HOST_CONFIG_NOT_FOUND", cause });
}

/**
 * Runtime load: read host.json, no field defaults.
 * Missing file fails loud with an install/init hint.
 */
export function loadPluginHostConfig(config: DshPluginConfig = {}): HostConfig {
  const runtimeRoot = resolveRuntimeRoot(config);
  const paths = new WorkspacePaths(runtimeRoot);
  try {
    return loadHostConfig(paths);
  } catch (cause) {
    if (cause instanceof HostConfigError && cause.code === "HOST_CONFIG_NOT_FOUND") {
      throw missingConfigError(paths.hostConfigFile(), cause);
    }
    throw cause;
  }
}
