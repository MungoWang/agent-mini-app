import { homedir } from "node:os";
import path from "node:path";

import type { HostConfig, HostConfigInitInput } from "../types.ts";
import { DEFAULT_HOST_CONFIG_SEED } from "./defaults.ts";
import { detectSystemLocale } from "./detect-locale.ts";
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
  // First boot: follow OS language when the caller did not pin locale fields.
  // Existing host.json is never rewritten by ensureHostConfig, so a saved choice sticks.
  if (input.locale === undefined) {
    merged.locale = detectSystemLocale();
  }
  if (input.chatLanguage === undefined) {
    merged.chatLanguage = detectSystemLocale();
  }
  if (typeof merged.runtimeRoot === "string") {
    merged.runtimeRoot = resolveRuntimeRoot(merged.runtimeRoot);
  }
  return parseHostConfig(merged);
}
