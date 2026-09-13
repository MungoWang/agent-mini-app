import { homedir } from "node:os";
import path from "node:path";

import type { HostConfig, HostConfigInitInput } from "../types.ts";
import { DEFAULT_HOST_CONFIG_SEED } from "./defaults.ts";
import { detectDshOrSystemLocale, type DshLocaleSources } from "./detect-locale.ts";
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
export function bootstrapHostConfig(
  input: HostConfigInitInput,
  localeSources?: DshLocaleSources,
): HostConfig {
  const merged: Record<string, unknown> = { ...DEFAULT_HOST_CONFIG_SEED };
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) {
      merged[key] = value;
    }
  }
  // First boot: follow dsh locale.preference, else OS language, when the caller
  // did not pin locale fields. Existing host.json is never rewritten by
  // ensureHostConfig, so a saved choice sticks.
  const detected = detectDshOrSystemLocale(localeSources);
  if (input.locale === undefined) {
    merged.locale = detected;
  }
  if (input.chatLanguage === undefined) {
    merged.chatLanguage = detected;
  }
  if (typeof merged.runtimeRoot === "string") {
    merged.runtimeRoot = resolveRuntimeRoot(merged.runtimeRoot);
  }
  return parseHostConfig(merged);
}
