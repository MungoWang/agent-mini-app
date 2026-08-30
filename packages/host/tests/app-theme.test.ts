import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type { AppTheme } from "@monkey-mini-app/host";

import { appThemeFile, readAppTheme, writeAppTheme } from "../src/apps/app-theme.ts";

function tmpDir(): string {
  return mkdtempSync(path.join(tmpdir(), "mma-theme-"));
}

describe("app theme.json", () => {
  it("points at <dir>/theme.json", () => {
    expect(appThemeFile("/tmp/a")).toBe(path.join("/tmp/a", "theme.json"));
  });

  it("round-trips an explicit override", () => {
    const dir = tmpDir();
    const written = writeAppTheme(dir, { theme: "dark", palette: "ocean" });
    expect(written).toEqual({ theme: "dark", palette: "ocean" });
    expect(JSON.parse(readFileSync(appThemeFile(dir), "utf8"))).toEqual({
      theme: "dark",
      palette: "ocean",
    });
    expect(readAppTheme(dir)).toEqual({ theme: "dark", palette: "ocean" });
  });

  it("clamps an unknown mode to light and a non-string palette to default", () => {
    const dir = tmpDir();
    const written = writeAppTheme(dir, {
      theme: "sepia",
      palette: 7,
    } as unknown as AppTheme);
    expect(written).toEqual({ theme: "light", palette: "default" });
    expect(readAppTheme(dir)).toEqual({ theme: "light", palette: "default" });
  });

  it("defaults the palette when the stored file omits it", () => {
    const dir = tmpDir();
    writeFileSync(appThemeFile(dir), JSON.stringify({ theme: "dark" }));
    expect(readAppTheme(dir)).toEqual({ theme: "dark", palette: "default" });
  });

  it("treats a missing, broken or theme-less file as “follow global”", () => {
    const dir = tmpDir();
    expect(readAppTheme(dir)).toBeNull();

    writeFileSync(appThemeFile(dir), "{not json");
    expect(readAppTheme(dir)).toBeNull();

    writeFileSync(appThemeFile(dir), JSON.stringify({ palette: "ocean" }));
    expect(readAppTheme(dir)).toBeNull();
  });

  it("clears the override, tolerating an already-absent file", () => {
    const dir = tmpDir();
    writeAppTheme(dir, { theme: "dark", palette: "ocean" });
    expect(writeAppTheme(dir, null)).toBeNull();
    expect(readAppTheme(dir)).toBeNull();

    // nothing to unlink — must not throw
    expect(writeAppTheme(dir, null)).toBeNull();
  });

  it("creates the app dir when writing into a path that does not exist yet", () => {
    const dir = path.join(tmpDir(), "nested", "app");
    expect(writeAppTheme(dir, { theme: "light", palette: "default" })).toEqual({
      theme: "light",
      palette: "default",
    });
    expect(readAppTheme(dir)).toEqual({ theme: "light", palette: "default" });
  });
});
