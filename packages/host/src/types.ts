import type { AbsolutePath } from "./brand.ts";

export const THEME_IDS = ["light", "dark"] as const;
export type ThemeId = (typeof THEME_IDS)[number];

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
  theme: ThemeId;
  /** Builtin {@link PaletteId} or a custom theme id from runtime themes/. */
  palette: string;
  locale: LocaleId;
  chatLanguage: LocaleId;
  llm: LlmConfig | null;
};

export type HostConfigSeed = {
  runtimeRoot: string;
  hostPort: number;
  theme: ThemeId;
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
