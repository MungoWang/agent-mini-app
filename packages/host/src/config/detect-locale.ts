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
