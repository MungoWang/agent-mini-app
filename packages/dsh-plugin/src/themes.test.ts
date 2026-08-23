import { describe, expect, it } from "vitest";
import { clampPalette, runnerThemeCss, tokensOf } from "./themes.js";

describe("themes", () => {
  it("clamps current and legacy palette ids", () => {
    expect(clampPalette("ocean")).toBe("ocean");
    expect(clampPalette("violet")).toBe("violet");
    expect(clampPalette("slate")).toBe("slate");
    expect(clampPalette("mist")).toBe("ocean");
    expect(clampPalette("paper")).toBe("slate");
    expect(clampPalette("ink")).toBe("violet");
    expect(clampPalette("khaki")).toBe("default");
  });

  it("makes palettes visually distinct (bg + primary + radius)", () => {
    const def = tokensOf("default", "light");
    const ocean = tokensOf("ocean", "light");
    const violet = tokensOf("violet", "light");
    const slate = tokensOf("slate", "light");
    expect(def.primary).toBe("#2563eb");
    expect(ocean.bg).toBe("#e8f1fb");
    expect(ocean.primary).toBe("#1d4ed8");
    expect(violet.primary).toBe("#7c3aed");
    expect(violet.radius).toBe("14px");
    expect(slate.primary).toBe("#27272a");
    expect(new Set([def.bg, ocean.bg, violet.bg, slate.bg]).size).toBe(4);
    expect(ocean.accent).not.toBe(ocean.muted);
    expect(violet.shadow).toContain("124, 58, 237");
  });

  it("emits runner CSS for all palette × mode pairs", () => {
    const css = runnerThemeCss();
    expect(css).toContain('html[data-theme="dark"][data-palette="ocean"]');
    expect(css).toContain('html[data-theme="light"][data-palette="violet"]');
    expect(css).toContain('html[data-theme="dark"][data-palette="slate"]');
    expect(css).toContain("--accent:");
    expect(css).toContain("--shadow:");
    expect(css).toContain("--card-foreground:");
  });
});
