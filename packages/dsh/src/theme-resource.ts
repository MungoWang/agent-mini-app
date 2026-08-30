/**
 * ThemeResource adapter for dsh.
 * Host consumes the port; this implementation uses panel theme helpers.
 */
import fs from "node:fs";
import path from "node:path";

import type { CustomThemePalette, ThemeResource } from "@monkey-mini-app/host";
import {
  cssVars,
  parseThemeCss,
  runnerThemeCss,
  themeLabelFromCss,
  type TokenSet,
} from "@monkey-mini-app/panel/themes";

type LoadedCustom = {
  id: string;
  label: string;
  swatch: string;
  tokens: { light: TokenSet; dark: TokenSet };
};

function customThemesDir(runtimeRoot: string): string {
  return path.join(path.resolve(runtimeRoot, ".."), "themes");
}

function loadCustomPalettes(runtimeRoot: string): LoadedCustom[] {
  const dir = customThemesDir(runtimeRoot);
  const out: LoadedCustom[] = [];
  try {
    if (!fs.existsSync(dir)) return out;
    const names = fs.readdirSync(dir).filter((n) => /^theme-.+\.css$/.test(n));
    for (const n of names) {
      const id = n.replace(/^theme-/, "").replace(/\.css$/, "");
      const css = fs.readFileSync(path.join(dir, n), "utf8");
      const tokens = parseThemeCss(css, id);
      if (!tokens) continue;
      out.push({
        id,
        label: themeLabelFromCss(css, id),
        swatch: tokens.dark.primary,
        tokens,
      });
    }
  } catch {
    /* ignore unreadable theme dir */
  }
  return out;
}

function customPaletteCss(runtimeRoot: string): string {
  return loadCustomPalettes(runtimeRoot)
    .map(
      (c) =>
        `html[data-theme="light"][data-palette="${c.id}"]{${cssVars(c.tokens.light)}}` +
        `html[data-theme="dark"][data-palette="${c.id}"]{${cssVars(c.tokens.dark)}}`,
    )
    .join("\n  ");
}

export class DshThemeResource implements ThemeResource {
  constructor(private readonly runtimeRoot: string) {}

  runnerCss(): string {
    return runnerThemeCss() + customPaletteCss(this.runtimeRoot);
  }

  listCustomPalettes(): CustomThemePalette[] {
    return loadCustomPalettes(this.runtimeRoot).map((c) => ({
      id: c.id,
      label: c.label,
      swatch: c.swatch,
      custom: true as const,
      tokens: c.tokens,
    }));
  }
}
