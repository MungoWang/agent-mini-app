import { describe, expect, it } from "vitest";
import { clampPalette, parseThemeCss, runnerThemeCss, themeLabelFromCss, tokensOf } from "./themes.js";

describe("themes", () => {
  it("clamps current and migrated palette ids", () => {
    expect(clampPalette("tokyo")).toBe("tokyo");
    expect(clampPalette("forest")).toBe("forest");
    expect(clampPalette("matcha")).toBe("matcha");
    expect(clampPalette("yellow")).toBe("yellow");
    expect(clampPalette("zoro")).toBe("zoro");
    expect(clampPalette("hokage")).toBe("hokage");
    expect(clampPalette("slate")).toBe("slate");
    // 旧 id 迁移：海蓝 → 东京夜（蓝调），青紫 → 草莓抹茶
    expect(clampPalette("ocean")).toBe("tokyo");
    expect(clampPalette("violet")).toBe("matcha");
    expect(clampPalette("mist")).toBe("tokyo");
    expect(clampPalette("ink")).toBe("matcha");
    expect(clampPalette("paper")).toBe("slate");
    expect(clampPalette("noir")).toBe("slate"); // 极简黑 → 石墨
    expect(clampPalette("khaki")).toBe("default");
    expect(clampPalette(undefined)).toBe("default");
  });

  it("makes palettes visually distinct (bg + primary)", () => {
    const def = tokensOf("default", "light");
    const tokyo = tokensOf("tokyo", "light");
    const forest = tokensOf("forest", "light");
    const matcha = tokensOf("matcha", "light");
    const yellow = tokensOf("yellow", "light");
    const zoro = tokensOf("zoro", "light");
    const hokage = tokensOf("hokage", "light");
    const slate = tokensOf("slate", "light");
    expect(def.primary).toBe("#2563eb");
    expect(tokyo.bg).toBe("#d5d6db");
    expect(tokyo.primary).toBe("#2e7de9");
    expect(forest.primary).toBe("#93b259");
    expect(matcha.primary).toBe("#e08a9c");
    expect(yellow.primary).toBe("#a37b16");
    expect(zoro.primary).toBe("#15803d");
    expect(hokage.primary).toBe("#c2660f");
    expect(slate.primary).toBe("#27272a");
    expect(new Set([def.bg, tokyo.bg, forest.bg, matcha.bg, yellow.bg, zoro.bg, hokage.bg, slate.bg]).size).toBe(8);
    expect(tokyo.accent).not.toBe(tokyo.muted);
  });

  it("dark palettes follow the reference hues", () => {
    const tokyo = tokensOf("tokyo", "dark");
    const forest = tokensOf("forest", "dark");
    const matcha = tokensOf("matcha", "dark");
    const yellow = tokensOf("yellow", "dark");
    const zoro = tokensOf("zoro", "dark");
    const hokage = tokensOf("hokage", "dark");
    expect(tokyo.bg).toBe("#1a1b26"); // Tokyo Night editor bg
    expect(tokyo.primary).toBe("#7aa2f7"); // Tokyo Night blue
    expect(forest.bg).toBe("#2d353b"); // Everforest bg
    expect(forest.primary).toBe("#a7c080"); // Everforest green
    expect(matcha.primary).toBe("#ee9aa6"); // strawberry pink
    expect(yellow.primary).toBe("#facc15"); // pill yellow
    expect(zoro.primary).toBe("#4ade80"); // zoro green
    expect(hokage.primary).toBe("#f59e0b"); // hokage amber
    expect(tokyo.radius).not.toBe(hokage.radius);
  });

  it("emits runner CSS for all palette × mode pairs", () => {
    const css = runnerThemeCss();
    expect(css).toContain('html[data-theme="dark"][data-palette="tokyo"]');
    expect(css).toContain('html[data-theme="light"][data-palette="matcha"]');
    expect(css).toContain('html[data-theme="dark"][data-palette="forest"]');
    expect(css).toContain('html[data-theme="dark"][data-palette="yellow"]');
    expect(css).toContain('html[data-theme="light"][data-palette="zoro"]');
    expect(css).toContain('html[data-theme="dark"][data-palette="hokage"]');
    expect(css).toContain('html[data-theme="dark"][data-palette="slate"]');
    expect(css).not.toContain('data-palette="ocean"');
    expect(css).not.toContain('data-palette="noir"');
    expect(css).not.toContain('data-palette="violet"');
    expect(css).toContain("--accent:");
    expect(css).toContain("--shadow:");
    expect(css).toContain("--card-foreground:");
  });
});

describe("parseThemeCss（自定义主题解析）", () => {
  const CSS = `/* name: 测试主题 */
:root[data-mode="light"]{--bg:#fff;--fg:#111;--surface:#fafafa;--border:#e0e0e0;--muted:#f0f0f0;--muted-fg:#777;--primary:#123abc;--primary-fg:#fff;--accent:#eef;--destructive:#d33;--ring:#123abc;--input:#f5f5f5;--radius:14px;--shadow:rgba(0,0,0,.1);}
:root[data-mode="dark"]{--bg:#111;--fg:#eee;--surface:#1a1a1a;--border:#333;--muted:#222;--muted-fg:#aaa;--primary:#789;--primary-fg:#111;--accent:#234;--destructive:#e55;--ring:#789;--input:#181818;}`;
  it("解析出 light/dark 两套 TokenSet", () => {
    const r = parseThemeCss(CSS, "test")!;
    expect(r).not.toBeNull();
    expect(r.light.bg).toBe("#fff");
    expect(r.light.primary).toBe("#123abc");
    expect(r.dark.bg).toBe("#111");
    expect(r.dark.primary).toBe("#789");
    // 缺失的次要变量补默认
    expect(r.light.radius).toBe("14px");
    expect(r.light.destructiveFg).toBe("#ffffff");
  });
  it("缺 light/dark 任一模式 → null", () => {
    expect(parseThemeCss(':root[data-mode="light"]{--bg:#fff;--fg:#111;--primary:#123}', "x")).toBeNull();
    expect(parseThemeCss("plain text", "x")).toBeNull();
    expect(parseThemeCss("", "x")).toBeNull();
    expect(parseThemeCss(null as unknown as string, "x")).toBeNull();
  });
  it("缺关键变量（bg/fg/primary）→ null", () => {
    const css = ':root[data-mode="light"]{--bg:#fff;--fg:#111;}:root[data-mode="dark"]{--bg:#000;--fg:#eee;}';
    expect(parseThemeCss(css, "x")).toBeNull(); // 无 primary
  });
  it("themeLabelFromCss 提取 name", () => {
    expect(themeLabelFromCss(CSS, "fallback")).toBe("测试主题");
    expect(themeLabelFromCss("no name", "fb")).toBe("fb");
  });
});
