import { asAbsolutePath } from "../brand.ts";
import { HostConfigError } from "../errors.ts";
import {
  type HostConfig,
  type LlmConfig,
  LOCALE_IDS,
  type LocaleId,
  THEME_IDS,
  type ThemeId,
} from "../types.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireField(raw: Record<string, unknown>, key: string): unknown {
  if (!(key in raw) || raw[key] === undefined) {
    throw new HostConfigError(`host config missing ${key}`);
  }
  return raw[key];
}

function parseEnum<T extends string>(
  value: unknown,
  key: string,
  allowed: readonly T[],
): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new HostConfigError(`host config ${key} is invalid`);
  }
  return value as T;
}

function parseHostPort(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 65535) {
    throw new HostConfigError("host config hostPort is invalid");
  }
  return value;
}

function parsePalette(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new HostConfigError("host config palette is invalid");
  }
  return value.trim();
}

function parseLlm(value: unknown): LlmConfig | null {
  if (value === null) {
    return null;
  }
  if (!isRecord(value)) {
    throw new HostConfigError("host config llm is invalid");
  }
  const provider = value.provider;
  const model = value.model;
  if (typeof provider !== "string" || provider.length === 0) {
    throw new HostConfigError("host config llm.provider is invalid");
  }
  if (typeof model !== "string" || model.length === 0) {
    throw new HostConfigError("host config llm.model is invalid");
  }
  return { provider, model };
}

/** Validate a complete host config. Does not apply defaults. */
export function parseHostConfig(raw: unknown): HostConfig {
  if (!isRecord(raw)) {
    throw new HostConfigError("host config must be an object");
  }
  const runtimeRootRaw = requireField(raw, "runtimeRoot");
  if (typeof runtimeRootRaw !== "string") {
    throw new HostConfigError("host config runtimeRoot is invalid");
  }
  let runtimeRoot;
  try {
    runtimeRoot = asAbsolutePath(runtimeRootRaw);
  } catch (cause) {
    throw new HostConfigError("host config runtimeRoot must be an absolute path", { cause });
  }
  return {
    runtimeRoot,
    hostPort: parseHostPort(requireField(raw, "hostPort")),
    theme: parseEnum<ThemeId>(requireField(raw, "theme"), "theme", THEME_IDS),
    palette: parsePalette(requireField(raw, "palette")),
    locale: parseEnum<LocaleId>(requireField(raw, "locale"), "locale", LOCALE_IDS),
    chatLanguage: parseEnum<LocaleId>(
      requireField(raw, "chatLanguage"),
      "chatLanguage",
      LOCALE_IDS,
    ),
    llm: parseLlm(requireField(raw, "llm")),
  };
}
