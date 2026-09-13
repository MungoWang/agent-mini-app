import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

import type { LocaleId } from "../types.ts";

/**
 * Map a BCP 47 / POSIX language tag to a supported host locale.
 * `zh*` (case-insensitive; `_` or `-`) → `zh-CN`; anything else → `en`.
 */
export function localeFromLanguageTag(tag: string | null | undefined): LocaleId {
  if (tag == null) return "en";
  const raw = String(tag).trim();
  if (!raw) return "en";
  // Strip encoding suffixes from LANG-style values (`zh_CN.UTF-8`).
  const primary = raw.split(".")[0] ?? raw;
  const normalized = primary.replace(/_/g, "-").toLowerCase();
  if (normalized === "c" || normalized === "posix") return "en";
  return normalized === "zh" || normalized.startsWith("zh-") ? "zh-CN" : "en";
}

function isBlankOrC(tag: string | null | undefined): boolean {
  if (tag == null) return true;
  const raw = String(tag).trim();
  if (!raw) return true;
  const primary = (raw.split(".")[0] ?? raw).replace(/_/g, "-").toLowerCase();
  return primary === "c" || primary === "posix";
}

export type SystemLocaleSources = {
  /** Override `Intl.DateTimeFormat().resolvedOptions().locale`. Pass `null` to skip. */
  intlLocale?: string | null;
  env?: {
    LC_ALL?: string;
    LC_MESSAGES?: string;
    LANG?: string;
  };
};

export type DshLocaleSources = SystemLocaleSources & {
  /**
   * Override the dsh settings document path.
   * Pass `null` to skip the file and fall through to OS detect.
   */
  settingsPath?: string | null;
};

function readIntlLocale(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {
    return undefined;
  }
}

/**
 * Detect the OS locale for first-boot host.json seeding.
 * Prefers Intl, then LC_ALL / LC_MESSAGES / LANG. Unknown → `en`.
 */
export function detectSystemLocale(sources?: SystemLocaleSources): LocaleId {
  const env = sources?.env ?? process.env;
  const intl =
    sources && Object.prototype.hasOwnProperty.call(sources, "intlLocale")
      ? sources.intlLocale
      : readIntlLocale();

  for (const candidate of [intl, env.LC_ALL, env.LC_MESSAGES, env.LANG]) {
    if (isBlankOrC(candidate)) continue;
    return localeFromLanguageTag(candidate);
  }
  return "en";
}

/**
 * Map dsh `locale.preference` (`zh` | `en` | any zh* tag) to a host locale.
 * Empty / missing → `null` so callers can fall back to OS detect.
 */
export function localeFromDshPreference(preference: string | null | undefined): LocaleId | null {
  if (preference == null) return null;
  const raw = String(preference).trim().replace(/^['"]|['"]$/g, "");
  if (!raw) return null;
  return localeFromLanguageTag(raw);
}

function stripYamlScalar(raw: string): string {
  let v = raw.trim();
  if (
    (v.startsWith('"') && v.endsWith('"') && v.length >= 2) ||
    (v.startsWith("'") && v.endsWith("'") && v.length >= 2)
  ) {
    return v.slice(1, -1);
  }
  const hash = v.search(/\s+#/);
  if (hash >= 0) v = v.slice(0, hash).trim();
  else {
    const bareHash = v.indexOf("#");
    if (bareHash >= 0) v = v.slice(0, bareHash).trim();
  }
  return v.replace(/^['"]|['"]$/g, "");
}

function preferenceFromUnknown(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  return undefined;
}

function preferenceFromJsonObject(parsed: unknown): string | undefined {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return undefined;
  const locale = (parsed as { locale?: unknown }).locale;
  if (!locale || typeof locale !== "object" || Array.isArray(locale)) return undefined;
  return preferenceFromUnknown((locale as { preference?: unknown }).preference);
}

/**
 * Extract `locale.preference` from a settings.yaml (or JSON) document body.
 * Tolerates the common indented YAML shape and a flat JSON object.
 */
export function parseDshLocalePreference(documentText: string): string | undefined {
  const text = String(documentText ?? "");
  if (!text.trim()) return undefined;

  const trimmed = text.trim();
  if (trimmed.startsWith("{")) {
    try {
      const pref = preferenceFromJsonObject(JSON.parse(trimmed) as unknown);
      if (pref !== undefined) return pref;
    } catch {
      /* fall through to YAML line scan */
    }
  }

  const lines = text.split(/\r?\n/);
  let inLocale = false;
  let localeIndent = 0;
  for (const line of lines) {
    const indentMatch = /^(\s*)/.exec(line);
    const indent = indentMatch?.[1]?.length ?? 0;
    const body = line.slice(indent);
    if (!body || body.startsWith("#")) continue;

    if (!inLocale) {
      if (indent !== 0) continue;
      if (/^locale:\s*$/.test(body) || /^locale:\s*\{/.test(body) || /^locale:\s+\S/.test(body)) {
        inLocale = true;
        localeIndent = indent;
        const inline = /preference:\s*(.+)$/.exec(body);
        if (inline?.[1]) {
          const value = stripYamlScalar(inline[1].replace(/[,}].*$/, "").trim());
          if (value) return value;
        }
      }
      continue;
    }

    if (indent <= localeIndent) {
      inLocale = false;
      if (indent === 0 && (/^locale:\s*$/.test(body) || /^locale:\s*\{/.test(body))) {
        inLocale = true;
        localeIndent = indent;
        const inline = /preference:\s*(.+)$/.exec(body);
        if (inline?.[1]) {
          const value = stripYamlScalar(inline[1].replace(/[,}].*$/, "").trim());
          if (value) return value;
        }
      }
      continue;
    }

    if (/^preference:\s*/.test(body)) {
      const rest = body.replace(/^preference:\s*/, "");
      const value = stripYamlScalar(rest);
      if (value) return value;
    }
  }
  return undefined;
}

/** `$DSH_HOME/settings.yaml`, or `~/.dsh/settings.yaml` when the env var is unset/blank. */
export function defaultDshSettingsPath(): string {
  const env = process.env.DSH_HOME;
  const home = typeof env === "string" && env.trim() ? env.trim() : path.join(homedir(), ".dsh");
  return path.join(home, "settings.yaml");
}

function readTextIfPresent(file: string): string | undefined {
  try {
    return readFileSync(file, "utf8");
  } catch {
    return undefined;
  }
}

/**
 * Read `locale.preference` from a dsh settings document.
 * Defaults to `$DSH_HOME/settings.yaml` or `~/.dsh/settings.yaml`.
 * Missing / unreadable file → `undefined` (caller falls back to OS detect).
 */
export function readDshLocalePreference(settingsPath?: string): string | undefined {
  const file = settingsPath ?? defaultDshSettingsPath();
  let text = readTextIfPresent(file);
  if (text == null && settingsPath == null) {
    const jsonSibling = file.replace(/\.ya?ml$/i, ".json");
    if (jsonSibling !== file) text = readTextIfPresent(jsonSibling);
  }
  if (text == null) return undefined;
  return parseDshLocalePreference(text);
}

/**
 * First-boot locale: dsh `locale.preference` when set, otherwise {@link detectSystemLocale}.
 */
export function detectDshOrSystemLocale(sources?: DshLocaleSources): LocaleId {
  const skipFile =
    sources != null &&
    Object.prototype.hasOwnProperty.call(sources, "settingsPath") &&
    sources.settingsPath == null;
  if (!skipFile) {
    const pathOverride = typeof sources?.settingsPath === "string" ? sources.settingsPath : undefined;
    const mapped = localeFromDshPreference(readDshLocalePreference(pathOverride));
    if (mapped) return mapped;
  }
  return detectSystemLocale(sources);
}
