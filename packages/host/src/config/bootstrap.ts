import { homedir } from "node:os";
import path from "node:path";

import type { HostConfig, HostConfigInitInput } from "../types.ts";
import { DEFAULT_HOST_CONFIG_SEED } from "./defaults.ts";
import { parseHostConfig } from "./parse.ts";

function expandHome(p: string): string {
  if (p === "~") {
    return homedir();
  }
  if (p.startsWith("~/") || p.startsWith("~\\")) {
    return path.join(homedir(), p.slice(2));
  }
  return p;
}

function resolveRuntimeRoot(p: string): string {
  return path.resolve(expandHome(p));
}

/** Install/init: apply DEFAULT_HOST_CONFIG_SEED, then parse. */
export function bootstrapHostConfig(input: HostConfigInitInput): HostConfig {
  const merged: Record<string, unknown> = { ...DEFAULT_HOST_CONFIG_SEED };
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) {
      merged[key] = value;
    }
  }
  if (typeof merged.runtimeRoot === "string") {
    merged.runtimeRoot = resolveRuntimeRoot(merged.runtimeRoot);
  }
  return parseHostConfig(merged);
}
