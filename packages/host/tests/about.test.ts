import { describe, expect, it } from "vitest";

import { isUpdateAvailable, resolveAboutInfo } from "../src/about.ts";

describe("about", () => {
  it("resolveAboutInfo includes host package and adapter meta", () => {
    const info = resolveAboutInfo({
      adapter: "dsh",
      packageName: "@monkey-mini-app/dsh-mini-app",
      version: "0.1.0-test",
      env: "test",
    });
    expect(info.adapter).toBe("dsh");
    expect(info.env).toBe("test");
    expect(
      info.packages.some((p) => p.name === "@monkey-mini-app/dsh-mini-app" && p.version === "0.1.0-test"),
    ).toBe(true);
    expect(info.packages.some((p) => p.name === "@monkey-mini-app/host")).toBe(true);
  });

  it("isUpdateAvailable compares versions", () => {
    expect(isUpdateAvailable("0.1.0", "0.1.0")).toBe(false);
    expect(isUpdateAvailable("0.1.0", "0.1.1")).toBe(true);
    expect(isUpdateAvailable("0.1.0-dshhost.abc", "0.1.0")).toBe(true);
    expect(isUpdateAvailable("0.1.0", null)).toBe(false);
  });
});
