import type { AbsolutePath } from "./brand.ts";

export const THEME_IDS = ["light", "dark"] as const;
export type ThemeId = (typeof THEME_IDS)[number];

/**
 * What a user may *choose*. `system` is a preference, not a resolved mode:
 * persisting the resolved light/dark would silently stop following the OS
 * after the next reload.
 */
export const THEME_PREF_IDS = ["light", "dark", "system"] as const;
export type ThemePref = (typeof THEME_PREF_IDS)[number];

export const PALETTE_IDS = [
  "default",
  "tokyo",
  "forest",
  "matcha",
  "yellow",
  "zoro",
  "hokage",
  "slate",
] as const;
export type PaletteId = (typeof PALETTE_IDS)[number];

export const LOCALE_IDS = ["zh-CN", "en"] as const;
export type LocaleId = (typeof LOCALE_IDS)[number];

export type LlmConfig = {
  provider: string;
  model: string;
};

export type HostConfig = {
  runtimeRoot: AbsolutePath;
  hostPort: number;
  /** User preference; may be `system` (apps resolve it to light/dark). */
  theme: ThemePref;
  /** Builtin {@link PaletteId} or a custom theme id from runtime themes/. */
  palette: string;
  locale: LocaleId;
  chatLanguage: LocaleId;
  llm: LlmConfig | null;
};

export type HostConfigSeed = {
  runtimeRoot: string;
  hostPort: number;
  theme: ThemePref;
  palette: string;
  locale: LocaleId;
  chatLanguage: LocaleId;
  llm: LlmConfig | null;
};

export type HostConfigInitInput = {
  runtimeRoot?: string;
  hostPort?: number;
  theme?: string;
  palette?: string;
  locale?: string;
  chatLanguage?: string;
  llm?: { provider?: string; model?: string } | null;
};
