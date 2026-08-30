import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { DshThemeResource } from "../src/theme-resource.ts";

describe("DshThemeResource", () => {
  it("runnerCss includes builtin palette selectors from panel", () => {
    const runtimeRoot = mkdtempSync(path.join(tmpdir(), "mma-theme-"));
    const themes = new DshThemeResource(runtimeRoot);
    const css = themes.runnerCss();
    expect(css).toContain('html[data-theme="dark"][data-palette="tokyo"]');
    expect(css).toContain('html[data-theme="light"][data-palette="matcha"]');
  });

  it("listCustomPalettes reads theme-*.css next to runtime", () => {
    const runtimeRoot = mkdtempSync(path.join(tmpdir(), "mma-theme-"));
    const themesDir = path.join(path.resolve(runtimeRoot, ".."), "themes");
    mkdirSync(themesDir, { recursive: true });
    writeFileSync(
      path.join(themesDir, "theme-crimson.css"),
      [
        "/* name: Crimson */",
        ':root[data-mode="light"]{ --bg:#fff; --fg:#111; --primary:#a00; --muted:#eee; }',
        ':root[data-mode="dark"]{ --bg:#111; --fg:#eee; --primary:#f66; --muted:#333; }',
      ].join("\n"),
    );
    const themes = new DshThemeResource(runtimeRoot);
    const list = themes.listCustomPalettes();
    expect(list).toHaveLength(1);
    expect(list[0]?.id).toBe("crimson");
    expect(list[0]?.label).toBe("Crimson");
    expect(list[0]?.custom).toBe(true);
    expect(themes.runnerCss()).toContain('data-palette="crimson"');
  });
});
